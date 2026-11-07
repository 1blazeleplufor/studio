// ===== AudioWorklet processors (chargés via Blob URL) =====
class RecProcessor extends AudioWorkletProcessor{
  constructor(){super();this.on=false;this.port.onmessage=e=>{this.on=e.data.rec};this.n=0;this.peak=0}
  process(inputs){
    const ch=inputs[0]&&inputs[0][0];
    if(ch){
      let p=0;for(let i=0;i<ch.length;i++){const a=Math.abs(ch[i]);if(a>p)p=a}
      this.peak=Math.max(p,this.peak*0.9);
      if(this.on)this.port.postMessage({t:currentFrame,d:ch.slice(0)});
      if(++this.n%8===0)this.port.postMessage({peak:this.peak});
    }
    return true;
  }
}
registerProcessor('rec-proc',RecProcessor);

// Correcteur de pitch (effet "autotune") : détection YIN + pitch shifter granulaire
class PitchProc extends AudioWorkletProcessor{
  static get parameterDescriptors(){return[
    {name:'amount',defaultValue:1,minValue:0,maxValue:1},
    {name:'speed',defaultValue:0.01,minValue:0,maxValue:0.5},
    {name:'mix',defaultValue:1,minValue:0,maxValue:1},
    {name:'shift',defaultValue:0,minValue:-12,maxValue:12}]}
  constructor(o){
    super();const po=(o&&o.processorOptions)||{};
    this.scale=po.scale||[0,2,3,5,7,8,10];this.key=po.key|0;
    this.port.onmessage=e=>{if(e.data.scale)this.scale=e.data.scale;if(e.data.key!==undefined)this.key=e.data.key};
    this.N=8192;this.W=Math.round(sampleRate*0.024);
    this.bufs=[new Float32Array(this.N),new Float32Array(this.N)];
    this.w=0;this.rp=600;this.rpOld=600;this.xf=0;this.xfN=1;this.P=Math.round(sampleRate/200);this.ratio=1;this.target=1;
    this.det=new Float32Array(1024);this.dw=0;this.dcount=0;this.dec=0;this.decN=0;
    this.hop=256;this.since=0;this.lastNote=-1;
    this.minLag=Math.floor(sampleRate/2/900);this.maxLag=Math.floor(sampleRate/2/70);
    this.win=600;this.d=new Float32Array(this.maxLag+2);this.frame=new Float32Array(this.win+this.maxLag+2);
  }
  detect(){
    const L=this.det.length,need=this.win+this.maxLag+1,f=this.frame;
    for(let i=0;i<need;i++)f[i]=this.det[(this.dw-need+i+L*4)%L];
    let rms=0;for(let i=0;i<this.win;i++)rms+=f[i]*f[i];rms=Math.sqrt(rms/this.win);
    if(rms<0.008)return 0;
    const d=this.d;d[0]=1;let run=0,best=-1;
    for(let tau=1;tau<=this.maxLag;tau++){
      let s=0;for(let i=0;i<this.win;i+=2){const x=f[i]-f[i+tau];s+=x*x}
      run+=s;d[tau]=run>0?s*tau/run:1;
    }
    for(let tau=this.minLag;tau<this.maxLag;tau++){
      if(d[tau]<0.18){while(tau+1<this.maxLag&&d[tau+1]<d[tau])tau++;best=tau;break}
    }
    if(best<0)return 0;
    const a=d[best-1],b=d[best],c=d[best+1];const den=a-2*b+c;
    const t=den!==0?best+0.5*(a-c)/den:best;
    return (sampleRate/2)/t;
  }
  process(inputs,outputs,P){
    const inp=inputs[0],out=outputs[0];if(!out||!out[0])return true;
    const n=out[0].length,chs=out.length;
    const amount=P.amount[0],speed=P.speed[0],mix=P.mix[0],shift=P.shift[0];
    const src0=inp&&inp[0]?inp[0]:null;
    for(let i=0;i<n;i++){
      const x0=src0?src0[i]:0;
      // décimation x2 pour la détection
      this.dec+=x0;if(++this.decN===2){this.det[this.dw]=this.dec*0.5;this.dw=(this.dw+1)%this.det.length;this.dec=0;this.decN=0}
      if(++this.since>=this.hop){
        this.since=0;const f=this.detect();let tgt=Math.pow(2,shift/12);
        if(f>0){
          this.P=this.P*0.5+(sampleRate/f)*0.5;
          const m=69+12*Math.log2(f/440);
          let bestN=m,bd=99;
          for(let o=-1;o<=10;o++)for(const s of this.scale){const nn=o*12+this.key+s;const dd=Math.abs(nn-m);if(dd<bd){bd=dd;bestN=nn}}
          if(this.lastNote>=0&&Math.abs(bestN-this.lastNote)===1&&Math.abs(m-this.lastNote)<0.65)bestN=this.lastNote;
          this.lastNote=bestN;
          tgt*=Math.pow(2,(bestN-m)*amount/12);
        }
        this.target=tgt;
      }
      const k=speed<=0.0005?1:1-Math.exp(-1/(speed*sampleRate));
      this.ratio+=(this.target-this.ratio)*k;
      // lecture à vitesse "ratio" avec sauts d'une période entière + fondu (PSOLA simplifié)
      const Pd=this.P,X=Math.min(256,Pd|0),minD=8+X,maxD=minD+Math.max(3*Pd,700);
      this.rp+=1-this.ratio;if(this.xf>0)this.rpOld+=1-this.ratio;
      if(this.xf<=0){
        if(this.rp<minD){this.rpOld=this.rp;this.rp+=Math.ceil((minD+Pd-this.rp)/Pd)*Pd;this.xf=this.xfN=X}
        else if(this.rp>maxD){this.rpOld=this.rp;this.rp-=Math.ceil((this.rp-(maxD-Pd))/Pd)*Pd;if(this.rp<minD)this.rp+=Pd;this.xf=this.xfN=X}
      }
      const fo=this.xf>0?this.xf/this.xfN:0;if(this.xf>0)this.xf--;
      for(let c=0;c<chs;c++){
        const b=this.bufs[c<2?c:1];const x=inp&&inp[c]?inp[c][i]:x0;b[this.w]=x;
        const rd=dd=>{let r=this.w-dd;if(r<0)r+=this.N;const i1=r|0,f1=r-i1;return b[i1]+(b[(i1+1)%this.N]-b[i1])*f1};
        let y=rd(this.rp);if(fo>0)y=y*(1-fo)+rd(this.rpOld)*fo;
        out[c][i]=x*(1-mix)+y*mix;
      }
      this.w=(this.w+1)%this.N;
    }
    return true;
  }
}
registerProcessor('pitch-proc',PitchProc);

class GateProc extends AudioWorkletProcessor{
  static get parameterDescriptors(){return[{name:'thr',defaultValue:-50},{name:'rel',defaultValue:0.12}]}
  constructor(){super();this.env=0;this.g=0;this.hold=0}
  process(inputs,outputs,P){
    const inp=inputs[0],out=outputs[0];if(!out[0])return true;
    const thr=Math.pow(10,P.thr[0]/20),rel=P.rel[0],n=out[0].length;
    const att=1-Math.exp(-1/(0.002*sampleRate)),rl=1-Math.exp(-1/(Math.max(0.01,rel)*sampleRate));
    for(let i=0;i<n;i++){
      let a=0;for(let c=0;c<inp.length;c++)a=Math.max(a,Math.abs(inp[c][i]));
      this.env=Math.max(a,this.env*0.9995);
      if(this.env>thr)this.hold=Math.floor(0.03*sampleRate);
      const open=this.hold-->0?1:0;
      this.g+=(open-this.g)*(open?att:rl);
      for(let c=0;c<out.length;c++)out[c][i]=(inp[c]?inp[c][i]:0)*this.g;
    }
    return true;
  }
}
registerProcessor('gate-proc',GateProc);

class CrushProc extends AudioWorkletProcessor{
  static get parameterDescriptors(){return[{name:'bits',defaultValue:8,minValue:1,maxValue:16},{name:'down',defaultValue:4,minValue:1,maxValue:64},{name:'mix',defaultValue:1,minValue:0,maxValue:1}]}
  constructor(){super();this.h=[0,0];this.c=0}
  process(inputs,outputs,P){const inp=inputs[0],out=outputs[0];if(!out[0])return true;
    const q=Math.pow(2,P.bits[0]-1),dn=Math.max(1,Math.round(P.down[0])),mix=P.mix[0],n=out[0].length;
    for(let i=0;i<n;i++){if(this.c<=0){for(let c=0;c<out.length;c++){const x=inp[c]?inp[c][i]:(inp[0]?inp[0][i]:0);this.h[c&1]=Math.round(x*q)/q}this.c=dn}this.c--;
      for(let c=0;c<out.length;c++){const x=inp[c]?inp[c][i]:(inp[0]?inp[0][i]:0);out[c][i]=x*(1-mix)+this.h[c&1]*mix}}
    return true}
}
registerProcessor('crush-proc',CrushProc);

// Limiteur transparent à anticipation (lookahead)
class LimitProc extends AudioWorkletProcessor{
  static get parameterDescriptors(){return[{name:'gain',defaultValue:1},{name:'ceil',defaultValue:.89},{name:'rel',defaultValue:.08}]}
  constructor(){super();this.L=Math.max(8,Math.round(sampleRate*.004));this.N=this.L+1;this.buf=[new Float32Array(this.N),new Float32Array(this.N)];this.tq=new Float32Array(this.N);
    this.qi=new Int32Array(this.N*2);this.qv=new Float32Array(this.N*2);this.qh=0;this.qt=0;this.n=0;this.w=0;this.g=1;this.gr=0;this.k=0}
  process(inputs,outputs,P){const inp=inputs[0],out=outputs[0];if(!out[0])return true;
    const G=P.gain[0],C=P.ceil[0],rel=1-Math.exp(-1/(Math.max(.01,P.rel[0])*sampleRate)),att=1-Math.exp(-1/(this.L/4)),n=out[0].length,Q=this.N*2;
    for(let i=0;i<n;i++){let pk=0;
      for(let c=0;c<2;c++){const x=(inp[c]?inp[c][i]:(inp[0]?inp[0][i]:0))*G;this.buf[c][this.w]=x;const a=Math.abs(x);if(a>pk)pk=a}
      const tg=pk>C?C/pk:1,idx=this.n++;
      while(this.qt>this.qh&&this.qv[(this.qt-1)%Q]>=tg)this.qt--;this.qi[this.qt%Q]=idx;this.qv[this.qt%Q]=tg;this.qt++;
      while(this.qi[this.qh%Q]<=idx-this.L-1)this.qh++;
      const need=this.qv[this.qh%Q];
      this.g=need<this.g?this.g+(need-this.g)*att:this.g+(need-this.g)*rel;if(this.g>need&&need<this.g*0.5)this.g=need;
      const r=(this.w+1)%this.N;
      for(let c=0;c<out.length;c++){let y=this.buf[c&1][r]*this.g;if(y>C)y=C;else if(y<-C)y=-C;out[c][i]=y}
      this.w=r;this.gr=Math.min(this.gr,this.g)}
    if(++this.k%16===0){this.port.postMessage(this.gr);this.gr=1}
    return true}
}
registerProcessor('limit-proc',LimitProc);

// ===== Réverb Pro « Ères » : réseau de lignes à retard (FDN 8 lignes) =====
const VMODES=[
 {d:[37,43,51,59,67,73,83,97],er:[3.1,4.7,6.3,8.9],ap:[3.1,4.3,5.3,6.7,7.9,9.1,10.3,11.9]},              // 0 Grand hall
 {d:[37,43,51,59,67,73,83,97],er:[2.3,3.7,5.3,7.1],ap:[3.1,4.3,5.3,6.7,7.9,9.1,10.3,11.9],bright:1},     // 1 Hall brillant
 {d:[17,21,23,27,31,37,41,43],er:[1.1,1.7,2.3,2.9],ap:[2.3,2.9,3.7,4.3,5.1,5.9,6.7,7.3],dk:1.2,plate:1}, // 2 Plaque
 {d:[9,11,13,17,19,23,27,29],er:[1.3,2.1,2.9,3.7],ap:[1.7,2.3,2.9,3.1,3.7,4.3,4.7,5.3]},                 // 3 Pièce
 {d:[19,23,27,31,37,41,47,53],er:[2.1,3.1,4.3,5.9],ap:[2.3,3.1,3.7,4.7,5.3,6.1,6.7,7.9]},                // 4 Chambre
 {d:[37,43,51,59,67,73,83,97],er:[3.1,4.7,6.3,8.9],ap:[3.1,4.3,5.3,6.7,7.9,9.1,10.3,11.9],rnd:2},       // 5 Espace aléatoire
 {d:[37,43,51,59,67,73,83,97],er:[3.1,4.7,6.3,8.9],ap:[3.1,4.3,5.3,6.7,7.9,9.1,10.3,11.9],mm:4},        // 6 Espace chorus
 {d:[7,9,11,13,15,17,19,23],er:[0.7,1.3,1.9,2.5],ap:[1.3,1.7,2.1,2.5,2.9,3.3,3.7,4.1],amb:1},           // 7 Ambiance
 {d:[61,71,79,89,101,113,127,139],er:[4.1,6.3,8.7,11.3],ap:[4.3,5.9,7.1,8.3,9.7,11.3,12.7,14.1]},      // 8 Cathédrale
 {d:[37,43,51,59,67,73,83,97],er:[3.1,4.7,6.3,8.9],ap:[3.1,4.3,5.3,6.7,7.9,9.1,10.3,11.9],dirty:1},     // 9 Hall sale
 {d:[17,21,23,27,31,37,41,43],er:[1.1,1.7,2.3,2.9],ap:[2.3,2.9,3.7,4.3,5.1,5.9,6.7,7.3],dk:1.2,plate:1,dirty:1}, // 10 Plaque sale
 {d:[17,21,23,27,31,37,41,43],er:[1.1,1.7,2.3,2.9],ap:[2.3,2.9,3.7,4.3,5.1,5.9,6.7,7.3],dk:1.3,plate:1,smooth:1}, // 11 Plaque douce
 {d:[9,11,13,17,19,23,27,29],er:[1.3,2.1,2.9,3.7],ap:[1.7,2.3,2.9,3.1,3.7,4.3,4.7,5.3],smooth:1},        // 12 Pièce douce
 {d:[19,23,27,31,37,41,47,53],er:[2.1,3.1,4.3,5.9],ap:[2.3,3.1,3.7,4.7,5.3,6.1,6.7,7.9],gate:1},        // 13 Non-linéaire
];
class VerbProc extends AudioWorkletProcessor{
  constructor(o){super();const po=(o&&o.processorOptions)||{},sr=sampleRate;this.sr=sr;
    this.p=Object.assign({mix:30,pre:20,decay:2.5,size:70,attack:40,ed:60,ld:70,mrate:.5,mdepth:30,hicut:9000,locut:120,bmult:1.2,bx:500,hshelf:-6,hfreq:5000,mode:0,color:2},po.params||{});
    this.port.onmessage=e=>{Object.assign(this.p,e.data);this.setup()};
    this.preN=Math.ceil(sr*.75);this.pre=[new Float32Array(this.preN),new Float32Array(this.preN)];this.pw=0;
    this.M=Math.ceil(sr*.32)+256;this.lines=[];for(let i=0;i<8;i++)this.lines.push(new Float32Array(this.M));this.lw=0;
    this.apN=Math.ceil(sr*.04);this.aps=[];for(let i=0;i<8;i++)this.aps.push(new Float32Array(this.apN));this.apw=0;
    this.erN=Math.ceil(sr*.03);this.ers=[[],[]];for(let c=0;c<2;c++)for(let j=0;j<4;j++)this.ers[c].push(new Float32Array(this.erN));this.erw=0;
    this.lo=new Float32Array(8);this.lh=new Float32Array(8);this.ph=new Float32Array(8);this.rw=new Float32Array(8);this.rt=new Float32Array(8);this.mod=new Float32Array(8);
    for(let i=0;i<8;i++)this.ph[i]=i/8*Math.PI*2;
    this.f=new Float32Array(12);this.env=0;this.gate=0;this.hold=[0,0];this.hc=0;this.k=0;this.setup();
  }
  setup(){const p=this.p,sr=this.sr,m=VMODES[p.mode|0]||VMODES[0];this.m=m;const sc=.3+.7*p.size/100;
    this.L=m.d.map((d,i)=>Math.max(8,Math.round(d*sc*sr/1000)+i));this.A=m.ap.map(a=>Math.max(4,Math.round(a*sc*sr/1000)));this.E=m.er.map(a=>Math.max(4,Math.round(a*sc*sr/1000)));
    let T=Math.max(.1,p.decay);if(m.amb)T=Math.min(T,1.2);if(m.gate)T=Math.max(T,1.5);
    const bm=Math.max(.25,p.bmult),hsDb=p.hshelf*(m.bright?.5:1)*(m.dk||1);
    this.g=this.L.map(l=>Math.pow(10,-3*l/(T*sr)));this.glo=this.L.map(l=>Math.pow(10,-3*l/(T*bm*sr)));
    this.ghs=this.L.map(l=>Math.pow(10,hsDb/20*(l/sr)/.3));
    this.ab=Math.exp(-2*Math.PI*Math.min(p.bx,sr/2.2)/sr);this.ah=Math.exp(-2*Math.PI*Math.min(p.hfreq,sr/2.2)/sr);
    this.apk=Math.min(.75,p.ld/100*.62*(m.plate?1.15:1)*(m.smooth?1.1:1));this.erk=p.ed/100*.7;
    const col=p.color|0;let hc=p.hicut;if(col===0)hc=Math.min(hc,8500);if(col===1)hc=Math.min(hc,13500);
    this.ahc=Math.exp(-2*Math.PI*Math.min(hc,sr/2.2)/sr);this.alc=Math.exp(-2*Math.PI*Math.max(10,p.locut)/sr);
    this.depth=p.mdepth/100*.0022*sr*(m.mm||1)*(col===0?1.3:1)*(m.smooth?.6:1);this.depth=Math.min(this.depth,250);
    this.rate=p.mrate;this.rnd=m.rnd||0;this.dirty=!!m.dirty||col===1;this.drive=m.dirty?1.8:1.15;this.col=col;
    const at=p.attack/100;this.taps=[0,.023,.047,.083].map(t=>Math.round((p.pre/1000+t*at)*sr));this.tg=at>0?[1-.55*at,.55*at,.45*at,.35*at]:[1,0,0,0];
    const s=this.tg.reduce((a,b)=>a+b,0);this.tg=this.tg.map(x=>x/s);this.early=(1-at)*.45*p.ed/100+(m.amb?.35:0);
    this.gateRel=1-Math.exp(-1/(Math.max(.05,p.decay*.35)*sr));this.mix=p.mix/100;
  }
  process(inputs,outputs){
    const inp=inputs[0],out=outputs[0];if(!out[0])return true;const n=out[0].length,sr=this.sr,L=this.L,M=this.M,f=this.f;
    const i0=inp[0]||null,i1=inp[1]||inp[0]||null,o0=out[0],o1=out[1]||out[0];
    for(let s=0;s<n;s++){
      const xl=i0?i0[s]:0,xr=i1?i1[s]:0;
      this.pre[0][this.pw]=xl;this.pre[1][this.pw]=xr;
      let il=0,ir=0;for(let t=0;t<4;t++){if(!this.tg[t])continue;let ri=this.pw-this.taps[t];if(ri<0)ri+=this.preN;il+=this.pre[0][ri]*this.tg[t];ir+=this.pre[1][ri]*this.tg[t]}
      this.pw=(this.pw+1)%this.preN;
      // diffusion early (allpass série)
      const ed=[il,ir];for(let c=0;c<2;c++){let v=ed[c];for(let j=0;j<4;j++){const b=this.ers[c][j];let ri=this.erw-this.E[j]-c*3;if(ri<0)ri+=this.erN;const d=b[ri];const w=v+this.erk*d;b[this.erw]=w;v=d-this.erk*w}ed[c]=v}
      this.erw=(this.erw+1)%this.erN;
      if(this.m.gate){const a=Math.max(Math.abs(xl),Math.abs(xr));this.env=a>this.env?a:this.env+(a-this.env)*this.gateRel}
      // modulation (toutes les 16 éch.)
      if((this.k++&15)===0){const dt=16/sr;for(let i=0;i<8;i++){if(this.rnd){if(this.rw[i]<=0){this.rt[i]=Math.random()*2-1;this.rw[i]=sr/(Math.max(.05,this.rate)*(1+i*.13))}this.rw[i]-=16;this.mod[i]+=(this.rt[i]-this.mod[i])*.02}
        else{this.ph[i]+=2*Math.PI*this.rate*(1+i*.07)*dt;this.mod[i]=Math.sin(this.ph[i])}}}
      // lecture des lignes
      let sum=0;const o=f;for(let i=0;i<8;i++){let pos=this.lw-L[i]-this.depth*(1+this.mod[i])-1;while(pos<0)pos+=M;const a=pos|0,fr=pos-a,b=this.lines[i];o[i]=b[a]+(b[(a+1)%M]-b[a])*fr;sum+=o[i]}
      sum*=.25;let wl=0,wr=0;
      for(let i=0;i<8;i++){let x=o[i]-sum;
        const lo=this.lo[i]=(1-this.ab)*x+this.ab*this.lo[i],lh=this.lh[i]=(1-this.ah)*x+this.ah*this.lh[i];
        x=lo*this.glo[i]+(lh-lo)*this.g[i]+(x-lh)*this.g[i]*this.ghs[i];
        const ab=this.aps[i];let ri=this.apw-this.A[i];if(ri<0)ri+=this.apN;const d=ab[ri],w=x+this.apk*d;ab[this.apw]=w;x=d-this.apk*w;
        if(this.dirty)x=Math.tanh(x*this.drive)/this.drive;
        this.lines[i][this.lw]=x+((i&1)?ed[1]:ed[0])*.35;
        if(i&1)wr+=(i&2?-o[i]:o[i]);else wl+=(i&2?-o[i]:o[i])}
      this.lw=(this.lw+1)%M;this.apw=(this.apw+1)%this.apN;
      wl=wl*.85+ed[0]*this.early;wr=wr*.85+ed[1]*this.early;
      // EQ de sortie + couleur
      f[8]=(1-this.ahc)*wl+this.ahc*f[8];f[9]=(1-this.ahc)*f[8]+this.ahc*f[9];wl=f[9];
      f[10]=(1-this.ahc)*wr+this.ahc*f[10];f[11]=(1-this.ahc)*f[10]+this.ahc*f[11];wr=f[11];
      this.hold[0]=(1-this.alc)*wl+this.alc*this.hold[0];this.hold[1]=(1-this.alc)*wr+this.alc*this.hold[1];wl-=this.hold[0];wr-=this.hold[1];
      if(this.col===0){if((this.hc++&1)===0){this.shl=wl;this.shr=wr}wl=this.shl;wr=this.shr}
      if(this.m.gate){const tg=this.env>.015?1:0;this.gate+=(tg-this.gate)*(tg?.01:.0015);wl*=this.gate;wr*=this.gate}
      o0[s]=xl*(1-this.mix)+wl*this.mix;o1[s]=xr*(1-this.mix)+wr*this.mix;
    }
    return true}
}
registerProcessor('verb-proc',VerbProc);

// ===== Pitch Pro : autotune avancé (TD-PSOLA, formants, humanize, flex-tune, vibrato) =====
class TuneProProc extends AudioWorkletProcessor{
  constructor(o){super();const po=(o&&o.processorOptions)||{},sr=sampleRate;this.sr=sr;
    this.p=Object.assign({input:1,tracking:50,key:0,notes:[0,2,0,0,2,0,2,0,0,2,0,2],retune:20,humanize:0,flex:0,vibrato:0,transpose:0,detune:0,formant:1,throat:100,mix:100,classic:0},po.params||{});
    this.port.onmessage=e=>{Object.assign(this.p,e.data);this.cfg()};
    this.NB=16384;this.inb=[new Float32Array(this.NB),new Float32Array(this.NB)];this.outb=[new Float32Array(this.NB),new Float32Array(this.NB)];
    this.n=0;this.D=Math.round(.05*sr);this.det=new Float32Array(2048);this.dw=0;this.dec=0;this.decN=0;this.since=0;this.hop=256;
    this.win=512;this.frame=new Float32Array(2048);this.dd=new Float32Array(1100);
    this.P=Math.round(sr/200);this.voiced=false;this.ratio=1;this.target=1;this.ms=0;this.last=-1;this.holdT=0;this.sNext=-1;this.aMark=0;this.cnt=0;this.curM=0;this.tgtM=0;this.cfg()}
  cfg(){const p=this.p,R=[[150,1100],[75,900],[55,420],[60,1500],[35,320]][p.input|0]||[75,900],h=this.sr/2;
    this.minLag=Math.max(2,Math.floor(h/R[1]));this.maxLag=Math.min(1050,Math.ceil(h/R[0]));this.thr=.06+p.tracking/100*.24;this.ref=440*Math.pow(2,p.detune/1200)}
  detect(){const L=this.det.length,need=this.win+this.maxLag+2,f=this.frame;
    for(let i=0;i<need;i++)f[i]=this.det[(this.dw-need+i+L*4)%L];
    let e=0;for(let i=0;i<this.win;i++)e+=f[i]*f[i];if(Math.sqrt(e/this.win)<.006)return 0;
    const d=this.dd;d[0]=1;let run=0,best=-1;
    for(let t=1;t<=this.maxLag;t++){let s=0;for(let i=0;i<this.win;i+=2){const x=f[i]-f[i+t];s+=x*x}run+=s;d[t]=run>0?s*t/run:1}
    for(let t=this.minLag;t<this.maxLag;t++)if(d[t]<this.thr){while(t+1<this.maxLag&&d[t+1]<d[t])t++;best=t;break}
    if(best<0)return 0;const a=d[best-1],b=d[best],c=d[best+1],den=a-2*b+c;return(this.sr/2)/(den?best+.5*(a-c)/den:best)}
  analyse(){const p=this.p,f=this.detect(),hopS=this.hop/this.sr;let st=p.transpose;
    if(f>0){this.voiced=true;this.P=this.P*.4+(this.sr/f)*.6;const m=69+12*Math.log2(f/this.ref);
      if(!this.ms||Math.abs(m-this.ms)>2)this.ms=m;else this.ms+=(m-this.ms)*.18;const vib=m-this.ms;
      let best=null,bd=99;for(let n=Math.round(m)-6;n<=Math.round(m)+6;n++){const s=p.notes[((n%12)+12)%12]|0;if(s===2)continue;const dd=Math.abs(n-m);if(dd<bd){bd=dd;best=n}}
      if(best!==null&&this.last>=0&&best!==this.last&&Math.abs(m-this.last)<.62&&(p.notes[((this.last%12)+12)%12]|0)!==2)best=this.last;
      if(best!==this.last){this.last=best;this.holdT=0}else this.holdT+=hopS;
      let shift=0;
      if(best!==null&&(p.notes[((best%12)+12)%12]|0)!==1){
        if(p.classic){shift=best-m}
        else{let w=1;if(p.flex>0){const zone=.5*(1-p.flex/100)+.04,dv=Math.abs(m-best);w=dv<=zone?1:Math.max(0,1-(dv-zone)/.3)}
          const T=best+vib*(1+p.vibrato/100);shift=(T-m)*w}}
      st+=shift;this.curM=m;this.tgtM=m+shift}
    else{this.voiced=false;this.P+=(Math.round(this.sr*.006)-this.P)*.3;this.curM=0;this.holdT=0}
    this.target=Math.pow(2,st/12);
    let rt=p.retune;if(!p.classic&&p.humanize>0&&this.holdT>.12)rt+=p.humanize/100*350*Math.min(1,(this.holdT-.12)/.5);
    this.rcoef=rt<=.5?1:1-Math.exp(-1/(rt/1000*this.sr));
    if((++this.cnt&1)===0)this.port.postMessage([this.curM,this.voiced?this.curM+12*Math.log2(this.ratio):0])}
  process(inputs,outputs){
    const inp=inputs[0],out=outputs[0];if(!out[0])return true;const n=out[0].length,NB=this.NB,D=this.D,p=this.p,mix=p.mix/100;
    const c0=inp[0]||null,c1=inp[1]||inp[0]||null;
    for(let s=0;s<n;s++){const x0=c0?c0[s]:0,x1=c1?c1[s]:0,N=this.n,wi=N%NB;this.inb[0][wi]=x0;this.inb[1][wi]=x1;
      this.dec+=x0;if(++this.decN===2){this.det[this.dw]=this.dec*.5;this.dw=(this.dw+1)%this.det.length;this.dec=0;this.decN=0}
      if(++this.since>=this.hop){this.since=0;this.analyse()}
      this.ratio+=(this.target-this.ratio)*(this.rcoef||1);
      if(this.sNext<0){this.sNext=N+D;this.aMark=N}
      let guard=0;
      while(guard++<8){
        const P=Math.max(16,this.P),Po=P/this.ratio,ff=(p.formant?1:this.ratio)*(p.throat/100);const Wg=Math.min(P,(D-24)/(1+ff));
        if(this.sNext-Wg>N+1)break;const tgt=this.sNext-D;
        while(this.aMark+P*.5<tgt)this.aMark+=P;while(this.aMark-P*1.5>tgt)this.aMark-=P;
        const gain=Math.max(.5,Math.min(2,Po/Wg)),W=Math.floor(Wg),am=this.aMark,sN=this.sNext;
        for(let k=-W;k<=W;k++){const w=(.5+.5*Math.cos(Math.PI*k/Wg))*gain;let src=am+k*ff;if(src>N)src=N;const si=Math.floor(src),fr=src-si,a=((si%NB)+NB)%NB,b=(a+1)%NB,oi=((Math.round(sN)+k)%NB+NB)%NB;
          this.outb[0][oi]+=(this.inb[0][a]+(this.inb[0][b]-this.inb[0][a])*fr)*w;this.outb[1][oi]+=(this.inb[1][a]+(this.inb[1][b]-this.inb[1][a])*fr)*w}
        this.sNext+=Po}
      const ri=wi,y0=this.outb[0][ri],y1=this.outb[1][ri];this.outb[0][ri]=0;this.outb[1][ri]=0;
      const di=((N-D)%NB+NB)%NB;out[0][s]=this.inb[0][di]*(1-mix)+y0*mix;if(out[1])out[1][s]=this.inb[1][di]*(1-mix)+y1*mix;
      this.n++}
    return true}
}
registerProcessor('tunepro-proc',TuneProProc);

// ===== Studio Bridge : envoi du son vers un plugin de l'ordinateur et retour, avec latence fixe =====
class BridgeProc extends AudioWorkletProcessor{
  constructor(o){super();const po=(o&&o.processorOptions)||{};this.D=po.lat||4096;this.N=512;this.R=1<<17;
    this.ring=[new Float32Array(this.R),new Float32Array(this.R)];this.stamp=new Float64Array(this.R).fill(-1);this.dry=[new Float32Array(this.R),new Float32Array(this.R)];
    this.acc=new Float32Array(2*this.N);this.ap=0;this.n=0;this.cs=0;this.online=false;this.under=0;this.sil=0;
    this.port.onmessage=e=>{const m=e.data;if(m.online!==undefined){this.online=m.online;return}
      if(m.out){const d=m.out,N=m.frames;for(let i=0;i<N;i++){const k=(m.start+i)%this.R;this.ring[0][k]=d[i];this.ring[1][k]=d[N+i];this.stamp[k]=m.start+i}}}}
  process(inputs,outputs){const inp=inputs[0],out=outputs[0];if(!out[0])return true;const n=out[0].length,R=this.R;
    for(let s=0;s<n;s++){const x0=inp[0]?inp[0][s]:0,x1=inp[1]?inp[1][s]:x0,k=this.n%R;this.dry[0][k]=x0;this.dry[1][k]=x1;
      if(this.ap===0)this.cs=this.n;this.acc[this.ap]=x0;this.acc[this.N+this.ap]=x1;this.ap++;
      if(this.ap===this.N){if(this.online){const b=this.acc.slice(0);this.port.postMessage({start:this.cs,frames:this.N,data:b},[b.buffer])}this.ap=0}
      const i=this.n-this.D;let y0=0,y1=0;
      if(i>=0){const r=i%R;if(this.online&&this.stamp[r]===i){y0=this.ring[0][r];y1=this.ring[1][r]}else{y0=this.dry[0][r];y1=this.dry[1][r];if(this.online)this.under++}}
      out[0][s]=y0;if(out[1])out[1][s]=y1;this.n++}
    if(this.under&&(this.n%48000)<n){this.port.postMessage({under:this.under});this.under=0}
    return true}
}
registerProcessor('bridge-proc',BridgeProc);
// Capture stéréo de la sortie (bounce en temps réel)
class CapProc extends AudioWorkletProcessor{
  constructor(){super();this.on=true;this.port.onmessage=e=>{this.on=e.data.on}}
  process(inputs){const i=inputs[0];if(this.on&&i&&i[0]){this.port.postMessage({t:currentFrame,l:i[0].slice(0),r:(i[1]||i[0]).slice(0)})}return true}
}
registerProcessor('cap-proc',CapProc);
