// ===== Plugins d'effets et instruments =====
const NOTE_NAMES=['Do','Do#','Ré','Ré#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
const SCALES={'Mineur':[0,2,3,5,7,8,10],'Majeur':[0,2,4,5,7,9,11],'Mineur harmonique':[0,2,3,5,7,8,11],'Phrygien':[0,1,3,5,7,8,10],'Penta mineure':[0,3,5,7,10],'Chromatique':[0,1,2,3,4,5,6,7,8,9,10,11]};
const dbToG=d=>d<=-60?0:Math.pow(10,d/20);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function noiseBuf(ctx){
  if(ctx._noise)return ctx._noise;
  const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  return ctx._noise=b;
}
function makeCurve(drive,type){
  const n=2048,c=new Float32Array(n),k=1+drive*30;
  for(let i=0;i<n;i++){const x=i/(n-1)*2-1;
    c[i]=type==='dur'?Math.max(-1,Math.min(1,x*k))*0.9:type==='tube'?(x>=0?Math.tanh(x*k):Math.tanh(x*k*0.6)/0.9)/Math.tanh(k):Math.tanh(x*k)/Math.tanh(k)}
  return c;
}
function mixNode(ctx){ // dry/wet utilitaire
  const input=ctx.createGain(),output=ctx.createGain(),dry=ctx.createGain(),wet=ctx.createGain();
  input.connect(dry);dry.connect(output);wet.connect(output);
  return{input,output,dry,wet,setMix(m){dry.gain.value=Math.cos(m*Math.PI/2);wet.gain.value=Math.sin(m*Math.PI/2)}};
}
const SYNC=[['Libre (ms)',0],['1/2',2],['1/4',1],['1/4 pointée',1.5],['1/4 triolet',2/3],['1/8',.5],['1/8 pointée',.75],['1/8 triolet',1/3],['1/16',.25]];

const PLUGINS={
 eq:{name:'Channel EQ',cat:'EQ',params:[
  {id:'hp',n:'Coupe-bas',min:20,max:1000,def:80,u:'Hz',log:1},
  {id:'lowF',n:'Grave fréq',min:40,max:500,def:120,u:'Hz',log:1},{id:'lowG',n:'Grave',min:-18,max:18,def:0,u:'dB'},
  {id:'m1F',n:'Médium 1',min:150,max:3000,def:350,u:'Hz',log:1},{id:'m1G',n:'Gain M1',min:-18,max:18,def:0,u:'dB'},{id:'m1Q',n:'Q M1',min:.3,max:8,def:1,log:1},
  {id:'m2F',n:'Médium 2',min:800,max:10000,def:3000,u:'Hz',log:1},{id:'m2G',n:'Gain M2',min:-18,max:18,def:0,u:'dB'},{id:'m2Q',n:'Q M2',min:.3,max:8,def:1,log:1},
  {id:'hiF',n:'Aigu fréq',min:2000,max:16000,def:8000,u:'Hz',log:1},{id:'hiG',n:'Aigu',min:-18,max:18,def:0,u:'dB'},
  {id:'lp',n:'Coupe-haut',min:1000,max:20000,def:20000,u:'Hz',log:1},{id:'out',n:'Sortie',min:-18,max:18,def:0,u:'dB'}],
  create(ctx,P){
   const f=[['highpass'],['lowshelf'],['peaking'],['peaking'],['highshelf'],['lowpass']].map(t=>{const b=ctx.createBiquadFilter();b.type=t[0];return b});
   const out=ctx.createGain();for(let i=0;i<5;i++)f[i].connect(f[i+1]);f[5].connect(out);
   return{input:f[0],output:out,filters:f,set(p){
    f[0].frequency.value=p.hp;f[0].Q.value=.707;f[1].frequency.value=p.lowF;f[1].gain.value=p.lowG;
    f[2].frequency.value=p.m1F;f[2].gain.value=p.m1G;f[2].Q.value=p.m1Q;f[3].frequency.value=p.m2F;f[3].gain.value=p.m2G;f[3].Q.value=p.m2Q;
    f[4].frequency.value=p.hiF;f[4].gain.value=p.hiG;f[5].frequency.value=Math.min(p.lp,ctx.sampleRate/2-100);f[5].Q.value=.707;out.gain.value=dbToG(p.out)}};
  }},
 comp:{name:'Compresseur',cat:'Dynamique',params:[
  {id:'thr',n:'Seuil',min:-60,max:0,def:-20,u:'dB'},{id:'ratio',n:'Ratio',min:1,max:20,def:4,u:':1',log:1},
  {id:'att',n:'Attaque',min:.1,max:200,def:10,u:'ms',log:1},{id:'rel',n:'Relâche',min:10,max:1000,def:120,u:'ms',log:1},
  {id:'knee',n:'Genou',min:0,max:30,def:6,u:'dB'},{id:'gain',n:'Gain (makeup)',min:0,max:24,def:4,u:'dB'},{id:'mix',n:'Mix (parallèle)',min:0,max:100,def:100,u:'%'}],
  create(ctx){
   const m=mixNode(ctx),c=ctx.createDynamicsCompressor(),mk=ctx.createGain();m.input.connect(c);c.connect(mk);mk.connect(m.wet);
   return{input:m.input,output:m.output,comp:c,set(p){c.threshold.value=p.thr;c.ratio.value=p.ratio;c.attack.value=p.att/1000;c.release.value=p.rel/1000;c.knee.value=p.knee;mk.gain.value=dbToG(p.gain);m.setMix(p.mix/100)}};
  }},
 pitch:{name:'Pitch Correction (autotune)',cat:'Voix',params:[
  {id:'key',n:'Tonalité',opts:NOTE_NAMES,def:0},{id:'scale',n:'Gamme',opts:Object.keys(SCALES),def:0},
  {id:'speed',n:'Vitesse',min:0,max:200,def:5,u:'ms'},{id:'amount',n:'Correction',min:0,max:100,def:100,u:'%'},
  {id:'shift',n:'Transpo',min:-12,max:12,def:0,u:'demi-t',step:1},{id:'mix',n:'Mix',min:0,max:100,def:100,u:'%'}],
  create(ctx,P){P=P||{};
   const n=new AudioWorkletNode(ctx,'pitch-proc',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{key:P.key|0,scale:SCALES[Object.keys(SCALES)[P.scale|0]],speed:(P.speed??5)/1000}});
   return{input:n,output:n,set(p){const t=ctx.currentTime;n.parameters.get('speed').setValueAtTime(p.speed/1000,t);n.parameters.get('amount').setValueAtTime(p.amount/100,t);n.parameters.get('mix').setValueAtTime(p.mix/100,t);n.parameters.get('shift').setValueAtTime(Math.round(p.shift),t);
    n.port.postMessage({key:p.key|0,scale:SCALES[Object.keys(SCALES)[p.scale|0]]})}};
  }},
 gate:{name:'Noise Gate',cat:'Dynamique',params:[{id:'thr',n:'Seuil',min:-80,max:-10,def:-50,u:'dB'},{id:'rel',n:'Relâche',min:10,max:800,def:120,u:'ms',log:1}],
  create(ctx){const n=new AudioWorkletNode(ctx,'gate-proc',{outputChannelCount:[2]});
   return{input:n,output:n,set(p){n.parameters.get('thr').value=p.thr;n.parameters.get('rel').value=p.rel/1000}}}},
 deess:{name:'De-Esser',cat:'Voix',params:[{id:'freq',n:'Fréquence',min:3000,max:10000,def:6500,u:'Hz',log:1},{id:'thr',n:'Seuil',min:-50,max:0,def:-28,u:'dB'},{id:'amt',n:'Réduction',min:0,max:100,def:70,u:'%'}],
  create(ctx){ // bande haute compressée + bande basse intacte
   const input=ctx.createGain(),out=ctx.createGain(),lo=ctx.createBiquadFilter(),hi=ctx.createBiquadFilter(),c=ctx.createDynamicsCompressor(),hg=ctx.createGain();
   lo.type='lowpass';hi.type='highpass';input.connect(lo);input.connect(hi);lo.connect(out);hi.connect(c);c.connect(hg);hg.connect(out);
   c.attack.value=.001;c.release.value=.06;c.knee.value=3;
   return{input,output:out,comp:c,set(p){lo.frequency.value=p.freq;hi.frequency.value=p.freq;c.threshold.value=p.thr;c.ratio.value=1+p.amt/100*19}};
  }},
 sat:{name:'Saturation',cat:'Distorsion',params:[{id:'drive',n:'Drive',min:0,max:100,def:25,u:'%'},{id:'type',n:'Type',opts:['Douce','Tube','Dure'],def:0},{id:'tone',n:'Tonalité',min:500,max:20000,def:12000,u:'Hz',log:1},{id:'mix',n:'Mix',min:0,max:100,def:100,u:'%'},{id:'out',n:'Sortie',min:-24,max:12,def:-3,u:'dB'}],
  create(ctx){const m=mixNode(ctx),ws=ctx.createWaveShaper(),lp=ctx.createBiquadFilter(),o=ctx.createGain();ws.oversample='4x';m.input.connect(ws);ws.connect(lp);lp.connect(m.wet);m.output.connect(o);let last='';
   return{input:m.input,output:o,set(p){const k=p.drive+'_'+p.type;if(k!==last){ws.curve=makeCurve(p.drive/100,['doux','tube','dur'][p.type|0]);last=k}lp.frequency.value=Math.min(p.tone,ctx.sampleRate/2-100);m.setMix(p.mix/100);o.gain.value=dbToG(p.out)}}}},
 filter:{name:'Filtre / Téléphone',cat:'Filtre',params:[{id:'type',n:'Type',opts:['Passe-bas','Passe-haut','Passe-bande','Téléphone'],def:0},{id:'freq',n:'Fréquence',min:60,max:18000,def:2000,u:'Hz',log:1},{id:'q',n:'Résonance',min:.3,max:15,def:1,log:1},{id:'lfo',n:'LFO vitesse',min:0,max:10,def:0,u:'Hz'},{id:'depth',n:'LFO prof.',min:0,max:100,def:0,u:'%'}],
  create(ctx){const a=ctx.createBiquadFilter(),b=ctx.createBiquadFilter(),lfo=ctx.createOscillator(),lg=ctx.createGain();a.connect(b);lfo.connect(lg);lg.connect(a.frequency);lfo.start();
   return{input:a,output:b,dispose(){try{lfo.stop()}catch(e){}},set(p){const t=p.type|0;
    if(t===3){a.type='highpass';a.frequency.value=500;a.Q.value=1;b.type='lowpass';b.frequency.value=3000;b.Q.value=2;lg.gain.value=0}
    else{a.type=['lowpass','highpass','bandpass'][t];a.frequency.value=p.freq;a.Q.value=p.q;b.type='allpass';lfo.frequency.value=p.lfo;lg.gain.value=p.lfo>0?p.freq*p.depth/100*.9:0}}}}},
 chorus:{name:'Chorus / Doubleur',cat:'Modulation',params:[{id:'rate',n:'Vitesse',min:.05,max:5,def:.6,u:'Hz',log:1},{id:'depth',n:'Profondeur',min:0,max:100,def:40,u:'%'},{id:'delay',n:'Retard',min:5,max:40,def:18,u:'ms'},{id:'mix',n:'Mix',min:0,max:100,def:40,u:'%'}],
  create(ctx){const m=mixNode(ctx),mg=ctx.createChannelMerger(2),dl=ctx.createDelay(.1),dr=ctx.createDelay(.1),lfo=ctx.createOscillator(),gl=ctx.createGain(),gr=ctx.createGain(),inv=ctx.createGain(),wl=ctx.createGain(),wr=ctx.createGain();
   m.input.connect(dl);m.input.connect(dr);dl.connect(wl);dr.connect(wr);wl.connect(mg,0,0);wr.connect(mg,0,1);mg.connect(m.wet);
   lfo.connect(gl);gl.connect(dl.delayTime);lfo.connect(inv);inv.gain.value=-1;inv.connect(gr);gr.connect(dr.delayTime);lfo.start();
   return{input:m.input,output:m.output,dispose(){try{lfo.stop()}catch(e){}},set(p){lfo.frequency.value=p.rate;const d=p.delay/1000,dp=d*.5*p.depth/100;dl.delayTime.value=d;dr.delayTime.value=d*1.13;gl.gain.value=dp;gr.gain.value=dp;
    m.setMix(p.mix/100)}}}},
 delay:{name:'Délai stéréo',cat:'Espace',params:[{id:'sync',n:'Synchro',opts:SYNC.map(s=>s[0]),def:3},{id:'ms',n:'Temps libre',min:10,max:1500,def:350,u:'ms',log:1},{id:'fb',n:'Répétitions',min:0,max:95,def:35,u:'%'},{id:'pp',n:'Ping-pong',opts:['Non','Oui'],def:1},{id:'lp',n:'Filtre',min:500,max:16000,def:5000,u:'Hz',log:1},{id:'mix',n:'Mix',min:0,max:100,def:25,u:'%'}],
  create(ctx,P,env){const m=mixNode(ctx),dl=ctx.createDelay(4),dr=ctx.createDelay(4),lp=ctx.createBiquadFilter(),mg=ctx.createChannelMerger(2),fbM=ctx.createGain(),toR=ctx.createGain(),fbP=ctx.createGain(),dlR=ctx.createGain();
   m.input.connect(lp);lp.connect(dl);dl.connect(mg,0,0);dl.connect(fbM);fbM.connect(lp);dl.connect(toR);toR.connect(dr);dr.connect(mg,0,1);dr.connect(fbP);fbP.connect(lp);dl.connect(dlR);dlR.connect(mg,0,1);mg.connect(m.wet);
   return{input:m.input,output:m.output,set(p){const s=SYNC[p.sync|0][1],t=s?s*60/env.bpm():p.ms/1000;dl.delayTime.value=t;dr.delayTime.value=t;lp.frequency.value=p.lp;m.setMix(p.mix/100);
    const pp=p.pp|0,fb=p.fb/100;fbM.gain.value=pp?0:fb;toR.gain.value=pp?1:0;fbP.gain.value=pp?fb:0;dlR.gain.value=pp?0:1}}}},
 reverb:{name:'Réverbération',cat:'Espace',params:[{id:'size',n:'Durée',min:.2,max:8,def:2,u:'s',log:1},{id:'pre',n:'Pré-délai',min:0,max:150,def:20,u:'ms'},{id:'damp',n:'Brillance',min:1000,max:16000,def:6000,u:'Hz',log:1},{id:'lowcut',n:'Coupe-bas',min:20,max:800,def:200,u:'Hz',log:1},{id:'mix',n:'Mix',min:0,max:100,def:25,u:'%'}],
  create(ctx){const m=mixNode(ctx),pre=ctx.createDelay(1),hp=ctx.createBiquadFilter(),cv=ctx.createConvolver();hp.type='highpass';m.input.connect(pre);pre.connect(hp);hp.connect(cv);cv.connect(m.wet);let key='';
   return{input:m.input,output:m.output,set(p){pre.delayTime.value=p.pre/1000;hp.frequency.value=p.lowcut;m.setMix(p.mix/100);const k=p.size.toFixed(2)+p.damp.toFixed(0);
    if(k!==key){key=k;const sr=ctx.sampleRate,len=Math.floor(sr*p.size),b=ctx.createBuffer(2,len,sr);
     for(let c=0;c<2;c++){const d=b.getChannelData(c);let lpv=0;for(let i=0;i<len;i++){const t=i/len,env=Math.pow(1-t,2.2)*Math.exp(-t*3);const cut=p.damp*(1-t*.85),a=Math.exp(-2*Math.PI*cut/sr);lpv=(1-a)*(Math.random()*2-1)+a*lpv;d[i]=lpv*env*(i<sr*.004?i/(sr*.004):1)}}
     cv.buffer=b}}}}},
 width:{name:'Stéréo / Largeur',cat:'Image',params:[{id:'w',n:'Largeur',min:0,max:200,def:130,u:'%'},{id:'haas',n:'Haas',min:0,max:30,def:0,u:'ms'}],
  create(ctx){const input=ctx.createGain(),out=ctx.createGain(),sp=ctx.createChannelSplitter(2),mg=ctx.createChannelMerger(2),dr=ctx.createDelay(.05);
   input.channelCountMode='explicit';input.channelCount=2;input.connect(sp);
   const ll=ctx.createGain(),lr=ctx.createGain(),rl=ctx.createGain(),rr=ctx.createGain();sp.connect(ll,0);sp.connect(lr,0);sp.connect(rl,1);sp.connect(rr,1);
   ll.connect(mg,0,0);rl.connect(mg,0,0);lr.connect(dr);rr.connect(dr);dr.connect(mg,0,1);mg.connect(out);
   return{input,output:out,set(p){const w=p.w/100,a=(1+w)/2,b=(1-w)/2;ll.gain.value=a;rl.gain.value=b;lr.gain.value=b;rr.gain.value=a;dr.delayTime.value=p.haas/1000}}}},
 limiter:{name:'Limiteur',cat:'Dynamique',params:[{id:'gain',n:'Gain',min:-12,max:18,def:0,u:'dB'},{id:'ceil',n:'Plafond',min:-12,max:0,def:-1,u:'dB'},{id:'rel',n:'Relâche',min:10,max:500,def:80,u:'ms',log:1}],
  create(ctx){const n=new AudioWorkletNode(ctx,'limit-proc',{outputChannelCount:[2]});const comp={reduction:0};n.port.onmessage=e=>{comp.reduction=20*Math.log10(Math.max(1e-4,e.data))};
   return{input:n,output:n,comp,set(p){const t=ctx.currentTime;n.parameters.get('gain').setValueAtTime(dbToG(p.gain),t);n.parameters.get('ceil').setValueAtTime(dbToG(p.ceil),t);n.parameters.get('rel').setValueAtTime(p.rel/1000,t)}}}},
};
// Plugins externes chargés par l'utilisateur
const EXT_SRC={};
function registerPlugin(def){
  if(!def||!def.id||!def.create||!def.params)throw new Error('Plugin invalide : il faut id, name, params et create()');
  const id='ext:'+def.id;PLUGINS[id]=Object.assign({cat:'Plugins externes'},def);return id;
}
function loadExternalPlugin(src){
  let reg=null;const fn=new Function('registerPlugin','dbToG','makeCurve','noiseBuf',src);
  fn(d=>{reg=registerPlugin(d)},dbToG,makeCurve,noiseBuf);
  if(!reg)throw new Error('Le fichier n’appelle pas registerPlugin(...)');
  EXT_SRC[reg]=src;return reg;
}
function defaultParams(type){const o={};for(const p of PLUGINS[type].params)o[p.id]=p.def;return o}

// ===== Instruments =====
const DRUM_ROWS=[['kick','Kick','#ff6b4a'],['808','808','#ff9f0a'],['snare','Snare','#ffd60a'],['clap','Clap','#30d158'],['hat','Hi-hat fermé','#64d2ff'],['ohat','Hi-hat ouvert','#0a84ff'],['perc','Perc','#bf5af2'],['rim','Rim / Click','#ff375f']];
const DRUM_KITS={
 'Trap 808':{kick:{lvl:.9,tune:0,dec:.35},'808':{lvl:.9,tune:0,dec:1.4},snare:{lvl:.75,tune:0,dec:.18},clap:{lvl:.75,tune:0,dec:.22},hat:{lvl:.45,tune:0,dec:.05},ohat:{lvl:.4,tune:0,dec:.35},perc:{lvl:.5,tune:0,dec:.15},rim:{lvl:.5,tune:0,dec:.05},drive:.35,note:36,swing:0},
 'Drill':{kick:{lvl:.8,tune:2,dec:.25},'808':{lvl:1,tune:0,dec:1.1},snare:{lvl:.8,tune:3,dec:.15},clap:{lvl:.6,tune:2,dec:.18},hat:{lvl:.5,tune:4,dec:.035},ohat:{lvl:.35,tune:0,dec:.25},perc:{lvl:.6,tune:5,dec:.08},rim:{lvl:.6,tune:0,dec:.04},drive:.6,note:37,swing:.08},
 'Boom bap':{kick:{lvl:1,tune:-2,dec:.45},'808':{lvl:.5,tune:0,dec:.5},snare:{lvl:.9,tune:-3,dec:.25},clap:{lvl:.5,tune:-2,dec:.25},hat:{lvl:.5,tune:-3,dec:.07},ohat:{lvl:.4,tune:-2,dec:.4},perc:{lvl:.5,tune:-3,dec:.2},rim:{lvl:.6,tune:-2,dec:.06},drive:.15,note:33,swing:.22},
};
function drumHit(ctx,dest,row,t,vel,kit,st){
  const k=kit[row]||{lvl:.7,tune:0,dec:.2},L=k.lvl*vel,tn=Math.pow(2,(k.tune||0)/12);
  const env=(g,a,d)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+d);};
  const nz=()=>{const s=ctx.createBufferSource();s.buffer=noiseBuf(ctx);s.loop=true;return s};
  const end=[];
  if(row==='kick'){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(160*tn,t);o.frequency.exponentialRampToValueAtTime(45*tn,t+.08);env(g,L,k.dec);o.connect(g);g.connect(dest);o.start(t);o.stop(t+k.dec+.05);
    const c=ctx.createOscillator(),cg=ctx.createGain();c.type='square';c.frequency.value=1200;env(cg,L*.15,.008);c.connect(cg);cg.connect(dest);c.start(t);c.stop(t+.02)}
  else if(row==='808'){const f=440*Math.pow(2,((st&&st.note!=null?st.note:kit.note)-69)/12)*tn;const o=ctx.createOscillator(),g=ctx.createGain(),ws=ctx.createWaveShaper();ws.curve=makeCurve(kit.drive||0,'doux');
    o.frequency.setValueAtTime(f*2.2,t);o.frequency.exponentialRampToValueAtTime(f,t+.04);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(L,t+.003);g.gain.setTargetAtTime(0,t+.05,k.dec/4);
    o.connect(ws);ws.connect(g);g.connect(dest);o.start(t);o.stop(t+k.dec*1.6+.1);if(st){if(st.last){try{st.last.g.gain.cancelScheduledValues(t);st.last.g.gain.setTargetAtTime(0,t,.01)}catch(e){}}st.last={g}}}
  else if(row==='snare'){const n=nz(),bp=ctx.createBiquadFilter(),g=ctx.createGain();bp.type='bandpass';bp.frequency.value=3000*tn;bp.Q.value=.7;env(g,L*.9,k.dec);n.connect(bp);bp.connect(g);g.connect(dest);n.start(t,Math.random());n.stop(t+k.dec+.05);
    const o=ctx.createOscillator(),og=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(220*tn,t);o.frequency.exponentialRampToValueAtTime(170*tn,t+.05);env(og,L*.6,.09);o.connect(og);og.connect(dest);o.start(t);o.stop(t+.12)}
  else if(row==='clap'){const n=nz(),bp=ctx.createBiquadFilter(),g=ctx.createGain();bp.type='bandpass';bp.frequency.value=1300*tn;bp.Q.value=1.2;g.gain.setValueAtTime(0,t);
    for(let i=0;i<3;i++){const ti=t+i*.011;g.gain.setValueAtTime(L,ti);g.gain.exponentialRampToValueAtTime(L*.2,ti+.01)}g.gain.setValueAtTime(L*.8,t+.034);g.gain.exponentialRampToValueAtTime(.0001,t+.034+k.dec);n.connect(bp);bp.connect(g);g.connect(dest);n.start(t,Math.random());n.stop(t+k.dec+.1)}
  else if(row==='hat'||row==='ohat'){const n=nz(),hp=ctx.createBiquadFilter(),g=ctx.createGain();hp.type='highpass';hp.frequency.value=7500*tn;env(g,L*.7,k.dec);n.connect(hp);hp.connect(g);g.connect(dest);n.start(t,Math.random());n.stop(t+k.dec+.05);
    if(st){if(row==='hat'&&st.oh&&st.oh.t<t){try{st.oh.g.gain.cancelScheduledValues(t);st.oh.g.gain.setTargetAtTime(0,t,.005)}catch(e){}}if(row==='ohat')st.oh={g,t}}}
  else if(row==='perc'){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(900*tn,t);o.frequency.exponentialRampToValueAtTime(500*tn,t+k.dec);env(g,L,k.dec);o.connect(g);g.connect(dest);o.start(t);o.stop(t+k.dec+.05)}
  else if(row==='rim'){const o=ctx.createOscillator(),bp=ctx.createBiquadFilter(),g=ctx.createGain();o.type='square';o.frequency.value=1700*tn;bp.type='bandpass';bp.frequency.value=2500*tn;env(g,L*.6,k.dec);o.connect(bp);bp.connect(g);g.connect(dest);o.start(t);o.stop(t+k.dec+.05)}
}
const SYNTH_PRESETS={
 'Pluck trap':{w1:'sawtooth',w2:'square',det:8,oct2:0,mix2:.4,sub:0,cut:2400,res:3,fenv:3500,a:.002,d:.25,s:.0,r:.25,glide:0,mono:0,drive:0,vol:.5},
 'Basse 808':{w1:'sine',w2:'triangle',det:0,oct2:1,mix2:.12,sub:.0,cut:900,res:.5,fenv:300,a:.003,d:1.6,s:.55,r:.25,glide:.07,mono:1,drive:.45,vol:.85},
 'Pad nuage':{w1:'sawtooth',w2:'sawtooth',det:14,oct2:0,mix2:.5,sub:.2,cut:1400,res:1,fenv:600,a:.6,d:1,s:.8,r:1.4,glide:0,mono:0,drive:0,vol:.35},
 'Cloche':{w1:'sine',w2:'sine',det:3,oct2:2,mix2:.45,sub:0,cut:9000,res:0,fenv:0,a:.001,d:1.2,s:0,r:1,glide:0,mono:0,drive:0,vol:.45},
 'Lead':{w1:'square',w2:'sawtooth',det:10,oct2:1,mix2:.3,sub:0,cut:3500,res:4,fenv:1500,a:.01,d:.3,s:.7,r:.2,glide:.04,mono:1,drive:.15,vol:.4},
 'Piano doux':{w1:'triangle',w2:'sine',det:4,oct2:1,mix2:.3,sub:0,cut:3000,res:.5,fenv:2000,a:.002,d:.9,s:.15,r:.5,glide:0,mono:0,drive:0,vol:.55},
 'Flûte':{w1:'sine',w2:'triangle',det:2,oct2:1,mix2:.15,sub:0,cut:4000,res:0,fenv:0,a:.06,d:.2,s:.85,r:.25,glide:0,mono:0,drive:0,vol:.5},
};
const SYNTH_PARAMS=[{id:'w1',n:'Osc 1',opts:['sine','triangle','sawtooth','square']},{id:'w2',n:'Osc 2',opts:['sine','triangle','sawtooth','square']},
 {id:'det',n:'Désaccord',min:0,max:50,u:'ct'},{id:'oct2',n:'Octave Osc 2',min:-2,max:2,step:1},{id:'mix2',n:'Niveau Osc 2',min:0,max:1},{id:'sub',n:'Sub',min:0,max:1},
 {id:'cut',n:'Filtre',min:80,max:16000,u:'Hz',log:1},{id:'res',n:'Résonance',min:0,max:20},{id:'fenv',n:'Env. filtre',min:0,max:8000,u:'Hz'},
 {id:'a',n:'Attaque',min:.001,max:3,u:'s',log:1},{id:'d',n:'Decay',min:.01,max:4,u:'s',log:1},{id:'s',n:'Sustain',min:0,max:1},{id:'r',n:'Release',min:.01,max:5,u:'s',log:1},
 {id:'glide',n:'Glide',min:0,max:.5,u:'s'},{id:'mono',n:'Mono',opts:['Non','Oui']},{id:'drive',n:'Drive',min:0,max:1},{id:'vol',n:'Volume',min:0,max:1}];
function synthVoice(ctx,dest,t,midi,vel,p,st){
  const f=440*Math.pow(2,(midi-69)/12);const o1=ctx.createOscillator(),o2=ctx.createOscillator(),g2=ctx.createGain(),flt=ctx.createBiquadFilter(),amp=ctx.createGain(),out=ctx.createGain();
  o1.type=p.w1;o2.type=p.w2;const f2=f*Math.pow(2,p.oct2|0);
  let from=null;if((p.mono|0)&&st&&st.lastF&&p.glide>0&&t-st.lastEnd<.05)from=st.lastF;
  if(from){o1.frequency.setValueAtTime(from,t);o1.frequency.exponentialRampToValueAtTime(f,t+p.glide);o2.frequency.setValueAtTime(from*Math.pow(2,p.oct2|0),t);o2.frequency.exponentialRampToValueAtTime(f2,t+p.glide)}
  else{o1.frequency.value=f;o2.frequency.value=f2}
  o1.detune.value=-p.det/2;o2.detune.value=p.det/2;g2.gain.value=p.mix2;
  o1.connect(flt);o2.connect(g2);g2.connect(flt);let sub=null;
  if(p.sub>0){sub=ctx.createOscillator();sub.type='sine';sub.frequency.value=f/2;const sg=ctx.createGain();sg.gain.value=p.sub;sub.connect(sg);sg.connect(flt)}
  flt.type='lowpass';flt.Q.value=p.res;const top=Math.min(p.cut+p.fenv*vel,ctx.sampleRate/2-100);
  flt.frequency.setValueAtTime(p.cut,t);flt.frequency.linearRampToValueAtTime(top,t+p.a);flt.frequency.setTargetAtTime(p.cut+(top-p.cut)*p.s,t+p.a,p.d/3);
  let last=flt;if(p.drive>0){const ws=ctx.createWaveShaper();ws.curve=makeCurve(p.drive,'doux');flt.connect(ws);last=ws}
  last.connect(amp);amp.connect(out);out.gain.value=p.vol*vel*.6;out.connect(dest);
  const pk=1;amp.gain.setValueAtTime(0,t);amp.gain.linearRampToValueAtTime(pk,t+p.a);amp.gain.setTargetAtTime(p.s*pk,t+p.a,Math.max(.005,p.d/3));
  o1.start(t);o2.start(t);if(sub)sub.start(t);
  const v={f,release(t2){t2=Math.max(t2,t+.005);
    if(amp.gain.cancelAndHoldAtTime){amp.gain.cancelAndHoldAtTime(t2)}else{amp.gain.cancelScheduledValues(t2);amp.gain.setValueAtTime(p.s*pk,t2)}
    amp.gain.setTargetAtTime(0,t2,Math.max(.005,p.r/4));const e=t2+p.r*1.5+.05;o1.stop(e);o2.stop(e);if(sub)sub.stop(e)},kill(t2){amp.gain.cancelScheduledValues(t2);amp.gain.setTargetAtTime(0,t2,.008);o1.stop(t2+.1);o2.stop(t2+.1);if(sub)sub.stop(t2+.1)}};
  if((p.mono|0)&&st){if(st.voice&&st.voice!==v)try{st.voice.kill(t)}catch(e){}st.voice=v;st.lastF=f}
  return v;
}
// ===== v2 : effets supplémentaires =====
Object.assign(PLUGINS,{
 shifter:{name:'Pitch Shifter (voix grave/aiguë)',cat:'Voix',params:[{id:'shift',n:'Transposition',min:-12,max:12,def:-5,u:'demi-t',step:1},{id:'mix',n:'Mix',min:0,max:100,def:100,u:'%'}],
  create(ctx,P){P=P||{};const n=new AudioWorkletNode(ctx,'pitch-proc',{outputChannelCount:[2],processorOptions:{scale:[0,1,2,3,4,5,6,7,8,9,10,11],key:0}});
   return{input:n,output:n,set(p){const t=ctx.currentTime;n.parameters.get('amount').setValueAtTime(0,t);n.parameters.get('speed').setValueAtTime(.02,t);n.parameters.get('shift').setValueAtTime(Math.round(p.shift),t);n.parameters.get('mix').setValueAtTime(p.mix/100,t)}}}},
 crush:{name:'Lo-Fi / Bitcrusher',cat:'Distorsion',params:[{id:'bits',n:'Bits',min:2,max:16,def:8,step:1},{id:'down',n:'Échantillonnage',min:1,max:40,def:4,u:'x',step:1},{id:'tone',n:'Tonalité',min:800,max:16000,def:6000,u:'Hz',log:1},{id:'mix',n:'Mix',min:0,max:100,def:60,u:'%'}],
  create(ctx){const n=new AudioWorkletNode(ctx,'crush-proc',{outputChannelCount:[2]}),lp=ctx.createBiquadFilter();n.connect(lp);
   return{input:n,output:lp,set(p){const t=ctx.currentTime;n.parameters.get('bits').setValueAtTime(p.bits,t);n.parameters.get('down').setValueAtTime(p.down,t);n.parameters.get('mix').setValueAtTime(p.mix/100,t);lp.frequency.value=Math.min(p.tone,ctx.sampleRate/2-100)}}}},
 robot:{name:'Robot (modulateur)',cat:'Modulation',params:[{id:'freq',n:'Fréquence',min:10,max:1000,def:60,u:'Hz',log:1},{id:'mix',n:'Mix',min:0,max:100,def:50,u:'%'}],
  create(ctx){const m=mixNode(ctx),rg=ctx.createGain(),o=ctx.createOscillator();rg.gain.value=0;o.connect(rg.gain);m.input.connect(rg);rg.connect(m.wet);o.start();
   return{input:m.input,output:m.output,dispose(){try{o.stop()}catch(e){}},set(p){o.frequency.value=p.freq;m.setMix(p.mix/100)}}}},
 phaser:{name:'Phaser',cat:'Modulation',params:[{id:'rate',n:'Vitesse',min:.05,max:8,def:.4,u:'Hz',log:1},{id:'depth',n:'Profondeur',min:0,max:100,def:70,u:'%'},{id:'freq',n:'Centre',min:200,max:4000,def:900,u:'Hz',log:1},{id:'mix',n:'Mix',min:0,max:100,def:50,u:'%'}],
  create(ctx){const m=mixNode(ctx),lfo=ctx.createOscillator(),lg=ctx.createGain();let prev=m.input;const aps=[];
   for(let i=0;i<6;i++){const a=ctx.createBiquadFilter();a.type='allpass';a.Q.value=.6;prev.connect(a);prev=a;aps.push(a);lg.connect(a.frequency)}prev.connect(m.wet);lfo.connect(lg);lfo.start();
   return{input:m.input,output:m.output,dispose(){try{lfo.stop()}catch(e){}},set(p){lfo.frequency.value=p.rate;aps.forEach((a,i)=>a.frequency.value=p.freq*(1+i*.35));lg.gain.value=p.freq*.8*p.depth/100;m.setMix(p.mix/100)}}}},
 tremolo:{name:'Trémolo',cat:'Modulation',params:[{id:'rate',n:'Vitesse',min:.5,max:20,def:6,u:'Hz',log:1},{id:'depth',n:'Profondeur',min:0,max:100,def:50,u:'%'}],
  create(ctx){const g=ctx.createGain(),lfo=ctx.createOscillator(),d=ctx.createGain();lfo.connect(d);d.connect(g.gain);lfo.start();
   return{input:g,output:g,dispose(){try{lfo.stop()}catch(e){}},set(p){lfo.frequency.value=p.rate;d.gain.value=p.depth/200;g.gain.value=1-p.depth/200}}}},
});
