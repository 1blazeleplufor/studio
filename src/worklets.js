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
    this.QN=Math.ceil((p.pre/1000+.1)*sr/128)+3; // saut du silence : pas avant que le pré-délai soit écoulé
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
// ===== v3.15 : moteur d'autotune « VoxTune » =====
// PSOLA synchrone : (1) hauteur mesurée (YIN) et datée ; (2) repères d'analyse posés sur les crêtes de la voix ;
// (3) la correction est calculée pour l'instant exact du grain (pas 50 ms trop tôt) ; (4) grains recollés en phase.
// Utilisé par « Pitch Pro », « Pitch Correction » et « Pitch Shifter ».
class TuneProProc extends AudioWorkletProcessor{
  constructor(o){super();const po=(o&&o.processorOptions)||{},sr=sampleRate;this.sr=sr;
    this.p=Object.assign({input:1,tracking:50,key:0,notes:[0,2,0,0,2,0,2,0,0,2,0,2],retune:20,humanize:0,flex:0,vibrato:0,transpose:0,detune:0,formant:1,throat:100,mix:100,classic:0,amount:100},po.params||{});
    this.port.onmessage=e=>{Object.assign(this.p,e.data);this.cfg()};
    this.NB=65536;this.MK=this.NB-1;this.inb=[new Float32Array(this.NB),new Float32Array(this.NB)];this.outb=[new Float32Array(this.NB),new Float32Array(this.NB)];this.lpb=new Float32Array(this.NB);
    this.n=0;this.D=Math.round(.05*sr);this.QN=Math.ceil(this.D/128)+4; // saut du silence : attendre que tout le retard soit sorti
    this.U=Math.round(.0045*sr);
    this.det=new Float32Array(4096);this.dw=0;this.dn=0;this.dpa=0;this.dpb=0;this.since=0;this.hop=Math.round(sr/187.5);
    this.win=Math.round(512*sr/48000);this.frame=new Float32Array(4096);this.dd=new Float32Array(2200);
    this.HN=1024;this.hT=new Float64Array(this.HN);this.hF=new Float32Array(this.HN);this.hn=0;this.lastF=0;
    this.MN=4096;this.mP=new Float64Array(this.MN);this.mL=new Float32Array(this.MN);this.mV=new Uint8Array(this.MN);this.mn=0;this.mNext=0;this.mSel=0;
    this.l1=0;this.l2=0;this.sNext=-1;this.ratio=1;this.target=1;this.ms=0;this.last=-1;this.holdT=0;this.curM=0;this.outM=0;this.gT=0;
    this.cfg()}
  cfg(){const p=this.p,R=[[150,1100],[75,900],[55,420],[60,1500],[35,320]][p.input|0]||[75,900],h=this.sr/2;
    this.minLag=Math.max(2,Math.floor(h/R[1]));this.maxLag=Math.min(2100,Math.ceil(h/R[0]));this.thr=.07+(p.tracking??50)/100*.16;this.ref=440*Math.pow(2,(p.detune||0)/1200)}
  // ---- hauteur : YIN sur le signal décimé ×2, datée au centre de la fenêtre ----
  detect(){const L=this.det.length,need=this.win+this.maxLag+2,f=this.frame;
    for(let i=0;i<need;i++)f[i]=this.det[(this.dw-need+i+L*4)%L];
    let e=0;for(let i=0;i<this.win;i++)e+=f[i]*f[i];if(Math.sqrt(e/this.win)<.004)return[0,0];
    const d=this.dd;d[0]=1;let run=0,best=-1;
    // fonction de différence calculée au fur et à mesure : on s'arrête dès qu'on a de quoi vérifier 4 périodes
    let top=this.maxLag,t=1;const W=this.win;
    for(;t<=top;t++){let s=0;for(let i=0;i<W;i+=2){const x=f[i]-f[i+t];s+=x*x}run+=s;d[t]=run>0?s*t/run:1;
      if(best<0&&t>this.minLag+1&&d[t-1]<this.thr&&d[t]>=d[t-1]){best=t-1;top=Math.min(this.maxLag,best*4+4)}}
    for(let k=t;k<=this.maxLag+1;k++)d[k]=1;
    if(best<0){let mi=this.minLag;for(let t=this.minLag;t<this.maxLag;t++)if(d[t]<d[mi])mi=t;if(d[mi]<this.thr*1.6)best=mi;else return[0,0]}
    // une harmonique prise pour la note (creux peu profond) : si un multiple de la période est nettement plus creux, c'est lui la vraie note
    for(let k=2;k<=4;k++){const c=Math.round(best*k);if(c+1>=this.maxLag)break;let q=c;for(let t=c-2;t<=c+2;t++)if(d[t]<d[q])q=t;if(d[q]<d[best]-.08&&d[q]<.15){best=q;break}}
    // garde-fou d'octave : si on tombait à l'octave au-dessus de la note tenue
    const b2=best*2;if(this.lastF>0&&b2<this.maxLag&&Math.abs((this.sr/2)/best/this.lastF-2)<.12&&d[b2]<d[best]+.08)best=b2;
    if(best<1||best+1>this.maxLag)return[0,0];
    const a=d[best-1],b=d[best],c=d[best+1],den=a-2*b+c,tau=den?best+.5*(a-c)/den:best;
    return[(this.sr/2)/tau,this.n-2*(need-1-(this.win+best)/2)]}
  F(t){const H=this.HN,n=this.hn;if(!n)return 0;let j=n-1;while(j>0&&j>n-H+1&&this.hT[j%H]>t)j--;const t0=this.hT[j%H],f0=this.hF[j%H];
    if(t<=t0||j===n-1)return f0;const t1=this.hT[(j+1)%H],f1=this.hF[(j+1)%H];if(!f0||!f1)return t-t0<t1-t?f0:f1;return f0*Math.pow(f1/f0,(t-t0)/(t1-t0))}
  // ---- repères d'analyse : un par période, posé sur la crête du signal filtré ----
  marks(){const N=this.n,MK=this.MK;
    while(true){const c=this.mNext,f=this.F(c),v=f>0,L=v?this.sr/f:this.U,R=v?Math.round(.3*L):0;if(c+R+2>N)break;
      let m=Math.round(c);if(v){const lo=Math.max(Math.round(c-R),this.mn?Math.ceil(this.mP[(this.mn-1)%this.MN]+.55*L):-1e9),hi=Math.round(c+R);let bv=-1e9;for(let k=lo;k<=hi;k++){const x=this.lpb[k&MK];if(x>bv){bv=x;m=k}}}
      const i=this.mn%this.MN;this.mP[i]=m;this.mL[i]=L;this.mV[i]=v?1:0;this.mn++;this.mNext=m+L}}
  // ---- note visée pour l'instant tin (dt = temps écoulé depuis le grain précédent) ----
  decide(tin,dt){const p=this.p,f=this.F(tin);if(p.wob){this.wt=(this.wt||0)-dt;if(this.wt<=0){this.wt=.15+Math.random()*.35;this.wg=(Math.random()*2-1)*p.wob}this.wv=(this.wv||0)+((this.wg||0)-(this.wv||0))*(1-Math.exp(-dt/.25))}
    let st=(p.transpose||0)+(p.cents||0)/100+(this.wv||0)/100;
    if(f>0){const m=69+12*Math.log2(f/this.ref);
      if(!this.ms||Math.abs(m-this.ms)>2)this.ms=m;else this.ms+=(m-this.ms)*(1-Math.exp(-dt/.09));const vib=m-this.ms;
      let best=null,bd=99;for(let n=Math.round(m)-6;n<=Math.round(m)+6;n++){const s=p.notes[((n%12)+12)%12]|0;if(s===2)continue;const dd=Math.abs(n-m);if(dd<bd){bd=dd;best=n}}
      if(best!==null&&this.last!==null&&this.last>=0&&best!==this.last&&Math.abs(m-this.last)<.6&&(p.notes[((this.last%12)+12)%12]|0)!==2)best=this.last;
      if(best!==this.last){this.last=best;this.holdT=0}else this.holdT+=dt;
      let sh=0;
      if(best!==null&&(p.notes[((best%12)+12)%12]|0)!==1){
        if(p.classic)sh=best-m;
        else{let w=1;if(p.flex>0){const zone=.5*(1-p.flex/100)+.04,dv=Math.abs(this.ms-best);w=dv<=zone?1:Math.max(0,1-(dv-zone)/.3)}
          // vibrato : 0 = la vitesse de correction décide ; >0 = on garde/renforce le vibrato chanté ; <0 = on l'efface en plus
          const vk=(p.vibrato||0)/100,T=best+(vk>0?vib*vk*1.5:0);sh=(T-m)*w;if(vk<0)sh=(best-m)*w*(-vk)+sh*(1+vk)}}
      st+=sh*((p.amount??100)/100);this.curM=m;this.outM=m+st}
    else{this.holdT=0;this.curM=0;this.outM=0}
    this.target=Math.pow(2,st/12);
    let rt=p.retune||0;if(!p.classic&&p.humanize>0&&this.holdT>.12)rt+=p.humanize/100*350*Math.min(1,(this.holdT-.12)/.5);
    const k=rt<=.5?1:1-Math.exp(-dt/(rt/1000));this.ratio+=(this.target-this.ratio)*k;
    this.gT+=dt;if(this.gT>.011){this.gT=0;this.port.postMessage([this.curM,this.curM?this.outM:0])}}
  process(inputs,outputs){
    const inp=inputs[0],out=outputs[0];if(!out||!out[0])return true;const n=out[0].length,MK=this.MK,D=this.D,p=this.p,mix=(p.mix??100)/100,sr=this.sr;
    const c0=inp&&inp[0]||null,c1=inp&&(inp[1]||inp[0])||null,lpa=1-Math.exp(-2*Math.PI*850/sr),ib0=this.inb[0],ib1=this.inb[1],ob0=this.outb[0],ob1=this.outb[1];
    for(let s=0;s<n;s++){const x0=c0?c0[s]:0,x1=c1?c1[s]:0,N=this.n,wi=N&MK;ib0[wi]=x0;ib1[wi]=x1;
      const xm=(x0+x1)*.5;this.l1+=(xm-this.l1)*lpa;this.l2+=(this.l1-this.l2)*lpa;this.lpb[wi]=this.l2;
      // décimation ×2 (filtre anti-repliement léger) pour la détection
      const fa=(xm+this.dpa*2+this.dpb)*.25;this.dpb=this.dpa;this.dpa=xm;if(++this.dn===2){this.dn=0;this.det[this.dw]=fa;this.dw=(this.dw+1)%this.det.length}
      if(++this.since>=this.hop){this.since=0;const [f,t]=this.detect(),H=this.HN;
        if(this.hn&&t<=this.hT[(this.hn-1)%H]){}else{this.hT[this.hn%H]=t||N-this.win*2;this.hF[this.hn%H]=f;this.hn++}this.lastF=f>0?f:this.lastF*.0}
      this.n++;if(this.hn)this.marks();
      // synthèse : on pose les grains dont l'instant est atteint
      if(this.sNext<0){this.sNext=N+D;this.mNext=N}
      for(let g=0;g<16;g++){
        const tin=this.sNext-D;let j=this.mSel;
        while(j+1<this.mn&&this.mP[(j+1)%this.MN]<=tin)j++;if(j+1<this.mn&&Math.abs(this.mP[(j+1)%this.MN]-tin)<Math.abs(this.mP[j%this.MN]-tin))j++;
        if(j<this.mn-this.MN+8)j=this.mn-this.MN+8;if(j<0)j=0;this.mSel=j;
        const has=this.mn>0&&this.mV[j%this.MN],mi=j%this.MN,m=has?this.mP[mi]:tin,L=has?this.mL[mi]:this.U; // sans note (souffle, consonne) : grain pris pile à l'instant voulu
        const ff=(p.formant?1:this.ratio)*((p.throat??100)/100),W=Math.max(8,Math.min(L,(D-24)/(1+ff)))|0;
        if(this.sNext-W>N+1)break;
        const fz=this.F(tin),Lt=fz>0&&L!==this.U?sr/fz:L;this.decide(tin,Lt/this.ratio/sr);const Po=Math.max(8,Lt/this.ratio); // période réelle à cet instant (pas celle, estimée d'avance, du repère)
        const gain=Math.max(.35,Math.min(2.5,Po/W)),si=Math.round(this.sNext),fr=si-this.sNext;
        for(let k=-W+1;k<W;k++){const kk=k+fr,w=(.5+.5*Math.cos(Math.PI*kk/W))*gain;let src=m+kk*ff;if(src>N)src=N;const a=Math.floor(src),q=src-a,i0=a&MK,i1=(a+1)&MK,o=(si+k)&MK;
          ob0[o]+=(ib0[i0]+(ib0[i1]-ib0[i0])*q)*w;ob1[o]+=(ib1[i0]+(ib1[i1]-ib1[i0])*q)*w}
        this.sNext+=Po}
      const y0=ob0[wi],y1=ob1[wi];ob0[wi]=0;ob1[wi]=0;const di=(N-D)&MK;
      out[0][s]=ib0[di]*(1-mix)+y0*mix;if(out[1])out[1][s]=ib1[di]*(1-mix)+y1*mix}
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

// ===== v3.7.6 : saut du silence =====
// Quand l'entrée est muette (piste sans son à cet endroit, effet contourné…) et que la sortie est retombée à zéro
// (queue de réverb / délai terminée), on sort du silence sans calculer : exports bien plus rapides, moins de CPU en lecture.
for(const C of [PitchProc,GateProc,CrushProc,LimitProc,VerbProc,TuneProProc]){const p=C.prototype.process;
  C.prototype.process=function(inputs,outputs,params){
    const inp=inputs[0];let silent=true;if(inp)for(let c=0;c<inp.length&&silent;c++){const d=inp[c];for(let i=0;i<d.length;i++)if(d[i]!==0){silent=false;break}}
    if(silent&&this._quiet>=(this.QN||3)){for(const o of outputs)for(const ch of o)ch.fill(0);return true}
    const r=p.call(this,inputs,outputs,params);
    if(silent){let pk=0;for(const o of outputs)for(const ch of o)for(let i=0;i<ch.length;i++){const a=ch[i]<0?-ch[i]:ch[i];if(a>pk)pk=a}this._quiet=pk<1e-6?(this._quiet||0)+1:0}else this._quiet=0;
    return r}}

// ===== v3.15 : compresseur, de-esser et niveau auto « studio » =====
const db2g=d=>Math.pow(10,d/20),g2db=g=>20*Math.log10(Math.max(g,1e-9));
// Compresseur : détection stéréo liée, courbe à genou doux, PAS de gain caché (contrairement à celui du navigateur).
// Styles : 0 propre (VCA) · 1 rapide (FET, 1176) · 2 doux (opto, LA-2A, relâche en deux temps)
class CompProc extends AudioWorkletProcessor{
  constructor(o){super();this.p=Object.assign({thr:-20,ratio:4,att:10,rel:120,knee:6,gain:0,mix:100,style:0,legacy:0},(o.processorOptions||{}).params||{});
    this.port.onmessage=e=>Object.assign(this.p,e.data);this.env=0;this.gr=0;this.slow=0;this.k=0;this.mn=0}
  curve(x){const p=this.p,T=p.thr,R=Math.max(1,p.ratio),K=Math.max(0,p.knee),o=x-T;
    if(2*o<-K)return 0;if(K>0&&2*Math.abs(o)<=K)return(1/R-1)*(o+K/2)*(o+K/2)/(2*K);return(1/R-1)*o}
  process(inputs,outputs){const inp=inputs[0],out=outputs[0];if(!out||!out[0])return true;const p=this.p,sr=sampleRate,n=out[0].length,st=p.style|0;
    const a0=inp&&inp[0],a1=inp&&(inp[1]||inp[0]);const att=Math.max(.05,p.att)*(st===1?.35:st===2?2.5:1),rel=Math.max(5,p.rel)*(st===1?.6:1);
    const ca=Math.exp(-1/(att*.001*sr)),cr=Math.exp(-1/(rel*.001*sr)),cs=Math.exp(-1/(1.8*sr)),ce=Math.exp(-1/(.004*sr));
    let mk=db2g(p.gain);if(p.legacy){mk*=Math.pow(1/db2g(this.curve(0)),.6)} // anciens projets : même niveau qu'avant
    const wet=p.mix/100,dry=1-wet;
    for(let i=0;i<n;i++){const x0=a0?a0[i]:0,x1=a1?a1[i]:0;let lv=Math.max(Math.abs(x0),Math.abs(x1));
      if(st===2){this.env=lv>this.env?lv:this.env*ce+lv*(1-ce);lv=this.env} // opto : réagit à l'enveloppe, pas aux crêtes
      const want=-this.curve(g2db(lv)); // réduction voulue (dB, positive)
      if(want>this.gr)this.gr=want+(this.gr-want)*ca;
      else{if(st===2){// relâche opto : vite sur la première moitié, puis lente (mémoire)
          this.slow=Math.max(this.slow*cs,this.gr*.5);const tgt=Math.max(want,this.slow);this.gr=tgt+(this.gr-tgt)*cr}
        else{const c=st===1?Math.exp(-1/((rel*(.5+.5*Math.min(1,this.gr/10)))*.001*sr)):cr;this.gr=want+(this.gr-want)*c}}
      let g=db2g(-this.gr)*mk;let y0=x0*g,y1=x1*g;
      if(st===1){y0=Math.tanh(y0*1.25)/1.25;y1=Math.tanh(y1*1.25)/1.25} // un peu de grain FET
      out[0][i]=x0*dry+y0*wet;if(out[1])out[1][i]=x1*dry+y1*wet;if(this.gr>this.mn)this.mn=this.gr}
    if(++this.k%8===0){this.port.postMessage(this.mn);this.mn=0}
    return true}
}
registerProcessor('comp-proc',CompProc);
function lpCoef(f,q){const w=2*Math.PI*f/sampleRate,c=Math.cos(w),a=Math.sin(w)/(2*q),a0=1+a;return[(1-c)/2/a0,(1-c)/a0,(1-c)/2/a0,-2*c/a0,(1-a)/a0]}
function hpCoef(f,q){const w=2*Math.PI*f/sampleRate,c=Math.cos(w),a=Math.sin(w)/(2*q),a0=1+a;return[(1+c)/2/a0,-(1+c)/a0,(1+c)/2/a0,-2*c/a0,(1-a)/a0]}
// De-esser : on ne touche qu'aux aigus, et seulement quand un « s » dépasse le seuil. Totalement transparent le reste du temps.
class DeessProc extends AudioWorkletProcessor{
  constructor(){super();this.p={freq:6500,thr:-28,amt:70};this.port.onmessage=e=>Object.assign(this.p,e.data);this.z=new Float64Array(12);this.env=0;this.g=1;this.k=0;this.mn=0;this.f=0}
  process(inputs,outputs){const inp=inputs[0],out=outputs[0];if(!out||!out[0])return true;const p=this.p,sr=sampleRate,n=out[0].length,z=this.z;
    if(this.f!==p.freq){this.f=p.freq;this.sc=hpCoef(Math.min(p.freq,sr*.45),.9);this.hb=lpCoef(Math.min(p.freq*.6,sr*.45),.6)}
    const S=this.sc,H=this.hb,a0=inp&&inp[0],a1=inp&&(inp[1]||inp[0]),ea=Math.exp(-1/(.0005*sr)),er=Math.exp(-1/(.05*sr)),ga=Math.exp(-1/(.001*sr)),gr=Math.exp(-1/(.07*sr)),mx=p.amt/100*18;
    for(let i=0;i<n;i++){const x0=a0?a0[i]:0,x1=a1?a1[i]:0,m=(x0+x1)*.5;
      // chaîne latérale : passe-haut à la fréquence choisie
      const s=S[0]*m+z[0];z[0]=S[1]*m-S[3]*s+z[1];z[1]=S[2]*m-S[4]*s;const a=Math.abs(s);this.env=a>this.env?a+(this.env-a)*ea:a+(this.env-a)*er;
      const o=g2db(this.env)-p.thr,red=o<=0?0:Math.min(mx,o<3?o*o/12*.8:(o-.75)*.8),tg=db2g(-red);this.g=tg<this.g?tg+(this.g-tg)*ga:tg+(this.g-tg)*gr;
      // aigus des deux canaux = signal − graves (complémentaire exact, donc en phase) ; y = graves + g·aigus
      const l0=H[0]*x0+z[2];z[2]=H[1]*x0-H[3]*l0+z[3];z[3]=H[2]*x0-H[4]*l0;const l1=H[0]*x1+z[4];z[4]=H[1]*x1-H[3]*l1+z[5];z[5]=H[2]*x1-H[4]*l1;
      out[0][i]=l0+this.g*(x0-l0);if(out[1])out[1][i]=l1+this.g*(x1-l1);if(red>this.mn)this.mn=red}
    if(++this.k%8===0){this.port.postMessage(this.mn);this.mn=0}
    return true}
}
registerProcessor('deess-proc',DeessProc);
// Niveau auto : ramène la voix à un niveau régulier AVANT la chaîne (comme un ingé son qui pousse le fader).
// Une prise trop faible ou trop forte donne alors le même rendu avec les préréglages.
class LevelProc extends AudioWorkletProcessor{
  // niveau mesuré = le plus fort des 40 derniers « instants » de 10 ms (sur 0,4 s) : un début ou une fin de phrase
  // ne fait donc pas croire que la voix est faible (sinon le gain monterait à chaque attaque).
  constructor(){super();this.p={target:-18,speed:400,range:18};this.port.onmessage=e=>Object.assign(this.p,e.data);this.ms=0;this.gdb=0;this.k=0;this.init=0;
    this.H=new Float32Array(40).fill(-120);this.hi=0;this.cnt=0;this.on=0;this.lv=-120}
  process(inputs,outputs){const inp=inputs[0],out=outputs[0];if(!out||!out[0])return true;const p=this.p,sr=sampleRate,n=out[0].length,a0=inp&&inp[0],a1=inp&&(inp[1]||inp[0]);
    const cm=Math.exp(-1/(.03*sr)),up=Math.exp(-1/(Math.max(20,p.speed)*.001*sr)),dn=Math.exp(-1/(Math.max(5,p.speed*.35)*.001*sr)),blk=Math.round(.01*sr);
    for(let i=0;i<n;i++){const x0=a0?a0[i]:0,x1=a1?a1[i]:0,m=(x0*x0+x1*x1)*.5;this.ms=m+(this.ms-m)*cm;
      if(++this.cnt>=blk){this.cnt=0;this.H[this.hi]=10*Math.log10(this.ms+1e-12);this.hi=(this.hi+1)%40;let mx=-120;for(let k=0;k<40;k++)if(this.H[k]>mx)mx=this.H[k];this.lv=mx;
        this.on=mx>Math.max(-56,p.target-34)?this.on+1:0}
      if(this.on>=8){const want=Math.max(-12,Math.min(p.range,p.target-this.lv));
        if(!this.init){this.gdb=want;this.init=1}else this.gdb=want+(this.gdb-want)*(want<this.gdb?dn:up)}
      const g=db2g(this.gdb);out[0][i]=x0*g;if(out[1])out[1][i]=x1*g}
    if(++this.k%8===0)this.port.postMessage(this.gdb);return true}
}
registerProcessor('level-proc',LevelProc);
