// Fait tourner les processeurs de worklets.js hors navigateur, sur une voix de synthèse.
const fs=require('fs');const SR=48000;
function load(file){const P={};const src=fs.readFileSync(file,'utf8');
  const fn=new Function('AudioWorkletProcessor','registerProcessor','sampleRate',src+';');
  class AWP{constructor(){this.port={postMessage(){},onmessage:null}}}
  fn(AWP,(n,c)=>P[n]=c,SR);return P}
function run(Cls,opts,inp,params){const p=new Cls({processorOptions:opts||{}});const n=inp.length,out=[new Float32Array(n),new Float32Array(n)];
  const prm={};for(const k in (params||{}))prm[k]=new Float32Array([params[k]]);
  for(let i=0;i<n;i+=128){const a=inp.subarray(i,i+128);if(a.length<128)break;p.process([[a,a]],[[out[0].subarray(i,i+128),out[1].subarray(i,i+128)]],prm)}return out[0]}
// voix synthétique : harmoniques avec enveloppe de formants (voyelle « a »), notes fausses + vibrato + glissés + souffle
function voice(notes,opt){opt=opt||{};const N=Math.round(notes.reduce((a,x)=>a+x[1],0)*SR),y=new Float32Array(N),truth=new Float32Array(N);let ph=0,t=0,i=0;
  const F=[[700,80,1],[1220,90,.5],[2600,120,.25],[3300,200,.1]];const env=f=>F.reduce((a,[c,b,g])=>a+g/(1+((f-c)/b)**2),0)+.02;
  let prevM=notes[0][0];
  for(const [m,d,cents] of notes){const n=Math.round(d*SR);for(let k=0;k<n;k++,i++){const tt=k/SR;const gl=Math.min(1,tt/.06);const mm=prevM+(m-prevM)*gl+(cents||0)/100+.3*Math.sin(2*Math.PI*5.5*(i/SR))*(opt.vib??1)*Math.min(1,tt/.3);
      const f=440*Math.pow(2,(mm-69)/12);truth[i]=mm;ph+=2*Math.PI*f/SR;let s=0;for(let h=1;h*f<8000;h++)s+=Math.sin(h*ph)*env(h*f)/h**.5;
      const a=Math.min(1,tt/.02)*Math.min(1,(d-tt)/.04);y[i]=.12*s*a+(Math.random()*2-1)*.004}prevM=m}
  return{y,truth}}
// détecteur YIN de référence (pour juger le résultat)
function yin(x,i0,W=1600){const maxT=900,d=new Float32Array(maxT);let run=0;d[0]=1;for(let t=1;t<maxT;t++){let s=0;for(let i=0;i<W;i++){const v=x[i0+i]-x[i0+i+t];s+=v*v}run+=s;d[t]=s*t/run}
  for(let t=40;t<maxT-1;t++)if(d[t]<.12){while(d[t+1]<d[t])t++;const a=d[t-1],b=d[t],c=d[t+1],den=a-2*b+c;const tt=den?t+.5*(a-c)/den:t;return{f:SR/tt,ap:d[t]}}return{f:0,ap:1}}
module.exports={load,run,voice,yin,SR};
