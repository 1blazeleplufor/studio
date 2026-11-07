// ===== Moteur audio =====
const BUFS={};let bufSeq=1;
function addBuffer(b,id){id=id||('b'+Date.now().toString(36)+(bufSeq++));BUFS[id]=b;PEAKS[id]=null;return id}
const PEAKS={};
function getPeaks(id){ // min/max par bloc de 256 échantillons
  if(PEAKS[id])return PEAKS[id];const b=BUFS[id];if(!b)return null;
  const B=256,n=Math.ceil(b.length/B),mn=new Float32Array(n),mx=new Float32Array(n),chs=[];
  for(let c=0;c<b.numberOfChannels;c++)chs.push(b.getChannelData(c));
  for(let i=0;i<n;i++){let lo=0,hi=0;const e=Math.min(b.length,(i+1)*B);for(let j=i*B;j<e;j++){for(const d of chs){const v=d[j];if(v<lo)lo=v;if(v>hi)hi=v}}mn[i]=lo;mx[i]=hi}
  return PEAKS[id]={mn,mx,B,sr:b.sampleRate};
}
let WORKLET_URL=null;
class Engine{
  constructor(ctx,live){this.ctx=ctx;this.live=live;this.strips={};this.sources=[];this.voices={};this.playing=false;this.segs=[];this.recording=false}
  async init(){
    const src=document.getElementById('worklet-src').textContent;
    const urls=[WORKLET_URL,location.protocol.startsWith('http')?'worklets.js':null,'data:application/javascript;base64,'+btoa(unescape(encodeURIComponent(src))),URL.createObjectURL(new Blob([src],{type:'application/javascript'}))].filter(Boolean);
    let err;for(const u of urls){try{await this.ctx.audioWorklet.addModule(u);WORKLET_URL=u;return}catch(e){err=e}}throw err;
  }
  env(){return{bpm:()=>this.project.bpm}}
  // ---- graphe ----
  makeStrip(obj,isMaster){
    const c=this.ctx,s={id:obj.id,input:c.createGain(),fader:c.createGain(),pan:c.createStereoPanner(),mute:c.createGain(),an:c.createAnalyser(),plugins:[],sig:'',sends:[],st:{},playIn:c.createGain()};
    s.an.fftSize=1024;s.playIn.connect(s.input);
    s.fader.connect(s.pan);s.pan.connect(s.mute);s.mute.connect(s.an);
    if(isMaster){s.an.connect(c.destination)}else{s.mute.connect(this.strips.master.input)}
    this.strips[obj.id]=s;return s;
  }
  rebuildChain(s,obj){
    try{s.input.disconnect()}catch(e){}
    for(const p of s.plugins){try{p.output.disconnect()}catch(e){}if(p.dispose)p.dispose()}
    s.plugins=[];let prev=s.input;
    for(const pl of obj.plugins||[]){
      if(!PLUGINS[pl.type]){s.plugins.push(null);continue}
      let inst;try{inst=PLUGINS[pl.type].create(this.ctx,pl.params,this.env());inst.set(pl.params)}catch(e){console.error(e);s.plugins.push(null);continue}
      s.plugins.push(inst);if(pl.byp)continue;
      prev.connect(inst.input);prev=inst.output;
    }
    prev.connect(s.fader);
    s.latency=(obj.plugins||[]).reduce((a,pl)=>a+(!pl.byp&&PLUGINS[pl.type]&&PLUGINS[pl.type].latency?PLUGINS[pl.type].latency(this.ctx.sampleRate):0),0);
    s.sig=(obj.plugins||[]).map(p=>p.type+(p.byp?'b':'')).join(',');
  }
  build(project){
    this.project=project;
    if(!this.strips.master){this.makeStrip({id:'master'},true)}
    const all=[...project.auxes,...project.tracks];const ids=new Set(['master',...all.map(o=>o.id)]);
    for(const id in this.strips)if(!ids.has(id)){const s=this.strips[id];try{s.mute.disconnect();s.playIn.disconnect()}catch(e){}for(const p of s.plugins)if(p&&p.dispose)p.dispose();delete this.strips[id]}
    for(const a of project.auxes)if(!this.strips[a.id])this.makeStrip(a);
    for(const t of project.tracks)if(!this.strips[t.id])this.makeStrip(t);
    this.updateAll();
  }
  updateAll(){const p=this.project;this.updateStrip(p.master,this.strips.master);for(const o of [...p.auxes,...p.tracks])this.updateStrip(o)}
  updateStrip(obj,s){
    s=s||this.strips[obj.id];if(!s)return;const p=this.project;
    const sig=(obj.plugins||[]).map(q=>q.type+(q.byp?'b':'')).join(',');
    if(sig!==s.sig||!s.built){this.rebuildChain(s,obj);s.built=1}
    else (obj.plugins||[]).forEach((pl,i)=>{const inst=s.plugins[i];if(inst)try{inst.set(pl.params)}catch(e){}});
    const t=this.ctx.currentTime;s.fader.gain.setTargetAtTime(dbToG(obj.vol),t,.01);s.pan.pan.setTargetAtTime(obj.pan||0,t,.01);
    const anySolo=p.tracks.some(x=>x.solo);let audible=!obj.mute;
    if(anySolo&&p.tracks.includes(obj))audible=audible&&obj.solo;
    s.mute.gain.setTargetAtTime(audible?1:0,t,.005);
    if(obj.sends){ // envois vers les bus
      p.auxes.forEach((a,i)=>{let g=s.sends[i];if(!g){g=s.sends[i]=this.ctx.createGain();s.mute.connect(g);g._to=null}
        const dst=this.strips[a.id];if(g._to!==dst){try{g.disconnect()}catch(e){}g.connect(dst.input);g._to=dst}
        g.gain.setTargetAtTime(dbToG(obj.sends[i]??-60),t,.01)});
    }
  }
  // ---- lecture ----
  spb(){return 60/this.project.bpm}
  scheduleWindow(a,b,t0,fresh,stopCtx,metro){
    const p=this.project,spb=this.spb(),c=this.ctx,minT=this.live?c.currentTime+.003:0;
    for(const tr of p.tracks){
      const s=this.strips[tr.id];if(!s)continue;const dest=s.playIn,lat=s.latency||0,T=x=>t0+(x-a)*spb-lat,stopC=stopCtx-lat;
      for(const r of tr.regions){if(r.mute)continue;
        if(tr.type==='audio'){
          const buf=BUFS[r.buf];if(!buf)continue;const rs=r.start,re=rs+r.dur/spb;let st=null,off=r.offset;
          if(rs>=a&&rs<b)st=T(rs);else if(fresh&&rs<a&&re>a){st=T(a);off=r.offset+(a-rs)*spb}
          if(st===null)continue;
          let end=T(re);if(fresh&&rs<a)end=st+(re-a)*spb;end=Math.min(end,stopC);if(st<minT){off+=minT-st;st=minT}if(end<=st+.002)continue;
          const src=c.createBufferSource(),g=c.createGain();src.buffer=buf;src.connect(g);g.connect(dest);
          const G=r.gain!=null?dbToG(r.gain):1,fromStart=off<=r.offset+1e-4,toEnd=end>=T(re)-1e-4,span=end-st;
          const fi=Math.min(fromStart?Math.max(.005,r.fi||0):.005,span/2),fo=Math.min(toEnd?Math.max(.005,r.fo||0):.005,span/2);
          g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(G,st+fi);g.gain.setValueAtTime(G,end-fo);g.gain.linearRampToValueAtTime(0,end);
          src.start(st,Math.max(0,off),end-st+.01);this.sources.push(src);
        }else if(tr.type==='synth'){
          const re=r.start+r.len;
          for(const n of r.notes){const ab=r.start+n.s;if(n.s>=r.len||ab<a||ab>=b)continue;
            const st=Math.max(minT,T(ab));let e=T(Math.min(ab+n.l,re));e=Math.min(e,stopC);if(e<=st)continue;
            const v=synthVoice(c,dest,st,n.p,n.v??.8,tr.instr,s.st);v.release(e);s.st.lastEnd=e;}
        }else if(tr.type==='drums'){
          const pat=r.pat,N=pat.steps,re=r.start+r.len,lo=Math.max(a,r.start),hi=Math.min(b,re);if(lo>=hi)continue;
          let k=Math.ceil((lo-r.start)/.25-1e-9);
          for(;;k++){const pos=r.start+k*.25;if(pos>=hi)break;if(pos<lo)continue;const si=k%N;
            const sw=(k%2===1)?(tr.instr.swing||0)*.25*spb:0;
            for(const [row] of DRUM_ROWS){const cell=pat.rows[row]&&pat.rows[row][si];if(!cell)continue;
              const rr=cell.r||1;for(let j=0;j<rr;j++){const tt=Math.max(minT,T(pos)+sw+j*.25*spb/rr);if(tt>=stopC)break;drumHit(c,dest,row,tt,(cell.v||.8)*(j?.75:1),tr.instr,s.st)}}
          }
        }
      }
    }
    if(metro){const sig=p.sig||4,Tm=x=>t0+(x-a)*spb;for(let x=Math.ceil(a-1e-9);x<b;x++){this.click(Tm(x),((x%sig)+sig)%sig===0)}}
  }
  click(t,acc){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.frequency.value=acc?1760:1100;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.35,t+.001);g.gain.exponentialRampToValueAtTime(.001,t+.06);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.08)}
  play(fromBeat,opt={}){
    if(this.playing)this.stop();
    const c=this.ctx;c.resume();this.playing=true;this.nextBeat=fromBeat;this.nextCtx=c.currentTime+.08;this.fresh=true;this.segs=[];this.opt=opt;
    for(const id in this.strips){const s=this.strips[id];s.playIn=c.createGain();s.playIn.connect(s.input);s.st={}}
    this.tick();this.timer=setInterval(()=>this.tick(),20);
  }
  tick(){
    const c=this.ctx,p=this.project,spb=this.spb(),cy=p.cycle;
    while(this.nextCtx<c.currentTime+.16){
      let a=this.nextBeat,b=a+.05/spb;const useCy=cy.on&&!this.opt.noCycle&&a<cy.end&&cy.end>cy.start;
      if(useCy&&b>=cy.end)b=cy.end;
      const stopCtx=useCy?this.nextCtx+(cy.end-a)*spb:Infinity;
      this.scheduleWindow(a,b,this.nextCtx,this.fresh,stopCtx,p.settings.metro&&(this.opt.rec||p.settings.metroPlay)||(a<this.opt.recStart));
      this.segs.push({c0:this.nextCtx,b0:a,b1:b});if(this.segs.length>200)this.segs.shift();
      this.nextCtx+=(b-a)*spb;this.nextBeat=b;this.fresh=false;
      if(useCy&&b>=cy.end){this.nextBeat=cy.start;this.fresh=true}
    }
    if(this.sources.length>300)this.sources=this.sources.slice(-200);
  }
  pos(){
    const t=this.ctx.currentTime,spb=this.spb();let s=null;
    for(let i=this.segs.length-1;i>=0;i--)if(this.segs[i].c0<=t){s=this.segs[i];break}
    if(!s)return this.segs.length?this.segs[0].b0:0;return Math.min(s.b1,s.b0+(t-s.c0)/spb);
  }
  stop(){
    if(!this.playing)return;this.playing=false;clearInterval(this.timer);const t=this.ctx.currentTime;
    for(const id in this.strips){const s=this.strips[id],g=s.playIn;g.gain.setTargetAtTime(0,t,.005);setTimeout(()=>{try{g.disconnect()}catch(e){}},200)}
    for(const s of this.sources)try{s.stop(t+.03)}catch(e){}this.sources=[];
  }
  // ---- jeu en direct (clavier) ----
  noteOn(tr,midi,vel){const s=this.strips[tr.id];if(!s)return;this.ctx.resume();const k=tr.id+':'+midi;if(this.voices[k])this.voices[k].release(this.ctx.currentTime);
    if(tr.type==='drums'){const row=DRUM_ROWS[(midi-60+800)%8][0];drumHit(this.ctx,s.input,row,this.ctx.currentTime+.005,vel,tr.instr,s.st);return}
    this.voices[k]=synthVoice(this.ctx,s.input,this.ctx.currentTime+.005,midi,vel,tr.instr,s.liveSt||(s.liveSt={}))}
  noteOff(tr,midi){const k=tr.id+':'+midi;const v=this.voices[k];if(v){v.release(this.ctx.currentTime);delete this.voices[k]}}
  // ---- micro / enregistrement ----
  async openMic(deviceId){
    if(this.mic&&this.micDev===deviceId)return true;
    if(this.micStream)this.micStream.getTracks().forEach(t=>t.stop());
    const cons={echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1};if(deviceId)cons.deviceId={exact:deviceId};
    this.micStream=await navigator.mediaDevices.getUserMedia({audio:cons});this.micDev=deviceId;
    const c=this.ctx;await c.resume();this.mic=c.createMediaStreamSource(this.micStream);
    if(!this.recNode){this.recNode=new AudioWorkletNode(c,'rec-proc',{numberOfOutputs:1,outputChannelCount:[1]});const z=c.createGain();z.gain.value=0;this.recNode.connect(z);z.connect(c.destination);
      this.recNode.port.onmessage=e=>{const m=e.data;if(m.peak!==undefined){this.inPeak=m.peak;return}if(this.recording){this.recChunks.push(m);this.recLive.push(peakOf(m.d))}}}
    this.mic.connect(this.recNode);
    const st=this.micStream.getAudioTracks()[0].getSettings();this.inLatency=st.latency||0;
    for(const k in this.monGains){try{this.monGains[k].disconnect()}catch(e){}}this.monGains={};
    return true;
  }
  setMonitor(tr,on){this.monGains=this.monGains||{};const g=this.monGains[tr.id];
    if(on&&!g&&this.mic){const n=this.ctx.createGain();this.mic.connect(n);n.connect(this.strips[tr.id].input);this.monGains[tr.id]=n}
    if(!on&&g){try{g.disconnect();this.mic.disconnect(g)}catch(e){}delete this.monGains[tr.id]}}
  startRec(recStart,countIn){
    this.recChunks=[];this.recLive=[];this.recStart=recStart;this.recording=true;this.recNode.port.postMessage({rec:true});
    this.play(recStart-countIn,{rec:true,noCycle:true,recStart});
  }
  stopRec(){
    this.recNode.port.postMessage({rec:false});this.recording=false;
    const segs=this.segs.slice(),chunks=this.recChunks;this.stop();if(!chunks.length||!segs.length)return null;
    const c=this.ctx,sr=c.sampleRate,spb=this.spb(),s0=segs[0];
    const tRec=s0.c0+(this.recStart-s0.b0)*spb;
    const lat=(c.outputLatency||0)+(c.baseLatency||0)+(this.inLatency||0)+(this.project.settings.latencyMs||0)/1000;
    const f0=chunks[0].t/sr;let total=0;for(const ch of chunks)total+=ch.d.length;
    const all=new Float32Array(total);let o=0;for(const ch of chunks){all.set(ch.d,o);o+=ch.d.length}
    let idx=Math.round((tRec+lat-f0)*sr);let data;
    if(idx>=0)data=all.subarray(Math.min(idx,all.length));else{data=new Float32Array(all.length-idx);data.set(all,-idx)}
    if(data.length<sr*.05)return null;
    const b=c.createBuffer(1,data.length,sr);b.copyToChannel(data,0);return b;
  }
}
function peakOf(d){let p=0;for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>p)p=a}return p}
function meterLevel(an){const d=an._buf||(an._buf=new Float32Array(an.fftSize));an.getFloatTimeDomainData(d);let p=0;for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>p)p=a}return p}
async function renderMix(project,from,to){
  const sr=44100,spb=60/project.bpm,len=Math.ceil(((to-from)*spb+2.5)*sr);
  const ctx=new OfflineAudioContext(2,len,sr),e=new Engine(ctx,false);await e.init();e.build(project);
  e.scheduleWindow(from,to,0,true,(to-from)*spb,false);
  return await ctx.startRendering();
}
function wavEncode(buf){
  const ch=buf.numberOfChannels,len=buf.length,sr=buf.sampleRate,ab=new ArrayBuffer(44+len*ch*2),v=new DataView(ab);
  const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');v.setUint32(4,36+len*ch*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);v.setUint32(24,sr,true);v.setUint32(28,sr*ch*2,true);v.setUint16(32,ch*2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,len*ch*2,true);
  const cs=[];for(let c=0;c<ch;c++)cs.push(buf.getChannelData(c));let o=44;
  for(let i=0;i<len;i++)for(let c=0;c<ch;c++){const s=Math.max(-1,Math.min(1,cs[c][i]));v.setInt16(o,s<0?s*32768:s*32767,true);o+=2}
  return new Blob([ab],{type:'audio/wav'});
}
