// ===== Encodeur FLAC (sans perte, 16 bits) — pour envoyer les sons en session ~2× plus légers que le WAV =====
// Prédicteurs fixes d'ordre 0 à 4, résidus Rice partitionnés, décorrélation stéréo (gauche/côté, droite/côté, milieu/côté).
// Lu par decodeAudioData dans Chrome, Edge, Safari et Firefox.
const FLAC_CRC8=(()=>{const t=new Uint8Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&0x80?((c<<1)^0x07)&0xff:(c<<1)&0xff;t[i]=c}return t})();
const FLAC_CRC16=(()=>{const t=new Uint16Array(256);for(let i=0;i<256;i++){let c=i<<8;for(let j=0;j<8;j++)c=c&0x8000?((c<<1)^0x8005)&0xffff:(c<<1)&0xffff;t[i]=c}return t})();
class FlacBits{
  constructor(n){this.b=new Uint8Array(n||1<<16);this.p=0;this.acc=0;this.n=0}
  grow(k){if(this.p+k<this.b.length)return;const nb=new Uint8Array(Math.max(this.b.length*2,this.p+k+1024));nb.set(this.b.subarray(0,this.p));this.b=nb}
  w(v,bits){ // bits ≤ 24 à la fois
    while(bits>24){const hi=bits-24;this.w(Math.floor(v/2**24)&((1<<hi)-1)>>>0,hi);v=v&0xffffff;bits=24}
    this.acc=this.acc*2**bits+(v&(2**bits-1));this.n+=bits;this.grow(8); // acc ne garde que les bits en attente (< 32 bits)
    while(this.n>=8){this.n-=8;const d=2**this.n,byte=Math.floor(this.acc/d);this.b[this.p++]=byte&0xff;this.acc-=byte*d}}
  ws(v,bits){this.w(v<0?v+2**bits:v,bits)}
  unary(q){while(q>=24){this.w(0,24);q-=24}this.w(1,q+1)}
  align(){if(this.n)this.w(0,8-this.n)}
  utf8(v){if(v<0x80)return this.w(v,8);let n=v<0x800?2:v<0x10000?3:v<0x200000?4:v<0x4000000?5:6;
    this.w((0xff<<(8-n))&0xff|(v>>>(6*(n-1))),8);for(let i=n-2;i>=0;i--)this.w(0x80|((v>>>(6*i))&0x3f),8)}
  bytes(){return this.b.subarray(0,this.p)}}
function flacResidual(x,n,o,res){ // résidus du prédicteur fixe d'ordre o
  for(let i=o;i<n;i++){let p;switch(o){case 0:p=0;break;case 1:p=x[i-1];break;case 2:p=2*x[i-1]-x[i-2];break;case 3:p=3*x[i-1]-3*x[i-2]+x[i-3];break;default:p=4*x[i-1]-6*x[i-2]+4*x[i-3]-x[i-4]}
    res[i-o]=x[i]-p}return n-o}
function flacRicePlan(res,cnt,n,o){ // meilleur ordre de partition + paramètres Rice → {bits, po, ks}
  let best=null;
  for(let po=0;po<=6;po++){const parts=1<<po;if(n%parts||(n>>po)<=o)break;const ps=n>>po;let bits=6,ks=[],ok=true;
    for(let pi=0;pi<parts;pi++){const a=pi?pi*ps-o:0,b=(pi+1)*ps-o;let sum=0;for(let i=a;i<b;i++){const r=res[i];sum+=r<0?-2*r-1:2*r}
      const len=b-a;let k0=0;if(len&&sum>len)k0=Math.min(14,Math.max(0,Math.floor(Math.log2(sum/len))));let bk=-1,bb=Infinity;
      for(let k=Math.max(0,k0-1);k<=Math.min(14,k0+1);k++){const c=len*(k+1)+Math.floor(sum/2**k);if(c<bb){bb=c;bk=k}}
      if(bb>len*31){ok=false;break}bits+=4+bb;ks.push(bk)}
    if(ok&&(!best||bits<best.bits))best={bits,po,ks}}
  return best}
function flacSubframe(bw,x,n,bps,res){
  let same=true;for(let i=1;i<n;i++)if(x[i]!==x[0]){same=false;break}
  if(same){bw.w(0,1);bw.w(0,6);bw.w(0,1);bw.ws(x[0],bps);return}
  let best=null;
  // choix rapide de l'ordre : somme des |résidus| des 5 prédicteurs en une passe, puis plan Rice pour les 2 meilleurs
  const sa=[0,0,0,0,0];for(let i=4;i<n;i++){const a=x[i],b=x[i-1],c=x[i-2],d=x[i-3],e=x[i-4],r0=a,r1=a-b,r2=a-2*b+c,r3=a-3*b+3*c-d,r4=a-4*b+6*c-4*d+e;
    sa[0]+=r0<0?-r0:r0;sa[1]+=r1<0?-r1:r1;sa[2]+=r2<0?-r2:r2;sa[3]+=r3<0?-r3:r3;sa[4]+=r4<0?-r4:r4}
  const ord=n>8?[0,1,2,3,4].sort((p,q)=>sa[p]-sa[q]).slice(0,2):[0,1,2,3,4];
  for(const o of ord){if(o>n-1)continue;const m=flacResidual(x,n,o,res),plan=flacRicePlan(res,m,n,o);if(!plan)continue;const bits=8+o*bps+2+plan.bits;
    if(!best||bits<best.bits)best={o,bits,plan}}
  if(!best||best.bits>=8+n*bps){bw.w(0,1);bw.w(1,6);bw.w(0,1);for(let i=0;i<n;i++)bw.ws(x[i],bps);return} // verbatim
  const {o,plan}=best;flacResidual(x,n,o,res);
  bw.w(0,1);bw.w(8|o,6);bw.w(0,1);for(let i=0;i<o;i++)bw.ws(x[i],bps);
  bw.w(0,2);bw.w(plan.po,4);const ps=n>>plan.po;
  for(let pi=0;pi<(1<<plan.po);pi++){const k=plan.ks[pi],a=pi?pi*ps-o:0,b=(pi+1)*ps-o;bw.w(k,4);
    const m=(1<<k)-1;for(let i=a;i<b;i++){const r=res[i],u=r<0?-2*r-1:2*r,q=u>>>k;
      if(q+1+k<=24)bw.w((1<<k)|(u&m),q+1+k);else{bw.unary(q);if(k)bw.w(u&m,k)}}}}
const flacCost=(x,n)=>{let s=0;for(let i=2;i<n;i++){const r=x[i]-2*x[i-1]+x[i-2];s+=r<0?-r:r}return s};
// buf : AudioBuffer → Uint8Array (fichier .flac). onProg(0..1) facultatif ; rend la main régulièrement pour ne pas figer l'appli.
async function encodeFLAC(buf,onProg){
  const ch=Math.min(2,buf.numberOfChannels),sr=buf.sampleRate,len=buf.length,BS=4096,src=[];
  for(let c=0;c<ch;c++){const d=buf.getChannelData(c),q=new Int32Array(len);for(let i=0;i<len;i++){const s=d[i];q[i]=s>=1?32767:s<=-1?-32768:Math.round(s*32767)}src.push(q)}
  const bw=new FlacBits(Math.max(1<<16,len*ch));
  bw.w(0x664c6143,32); // "fLaC"
  bw.w(0x80,8);bw.w(34,24); // STREAMINFO (dernier bloc de métadonnées)
  bw.w(BS,16);bw.w(BS,16);bw.w(0,24);bw.w(0,24);bw.w(sr,20);bw.w(ch-1,3);bw.w(15,5);bw.w(Math.floor(len/2**32),4);bw.w(len>>>0,32);
  for(let i=0;i<16;i++)bw.w(0,8); // MD5 non calculé (autorisé)
  const res=new Int32Array(BS),M=new Int32Array(BS),S=new Int32Array(BS);let t0=performance.now();
  for(let f=0,pos=0;pos<len;f++,pos+=BS){
    const n=Math.min(BS,len-pos),L=src[0].subarray(pos,pos+n),R=ch>1?src[1].subarray(pos,pos+n):null;
    let mode=ch>1?1:0,chans=[L],bpss=[16];
    if(ch>1){for(let i=0;i<n;i++){M[i]=(L[i]+R[i])>>1;S[i]=L[i]-R[i]}const Sm=S.subarray(0,n),Mm=M.subarray(0,n);
      const cl=flacCost(L,n),cr=flacCost(R,n),cm=flacCost(Mm,n),cs=flacCost(Sm,n),opts=[[cl+cr,1,[L,R],[16,16]],[cl+cs,8,[L,Sm],[16,17]],[cs+cr,9,[Sm,R],[17,16]],[cm+cs,10,[Mm,Sm],[16,17]]];
      opts.sort((a,b)=>a[0]-b[0]);[,mode,chans,bpss]=opts[0]}
    const h0=bw.p;
    bw.w(0x3ffe,14);bw.w(0,1);bw.w(0,1); // synchro, bloc de taille fixe
    bw.w(7,4);bw.w(0,4); // taille de bloc sur 16 bits en fin d'en-tête ; fréquence : voir STREAMINFO
    bw.w(ch===1?0:mode===1?1:mode,4);bw.w(4,3);bw.w(0,1); // canaux ; 16 bits
    bw.utf8(f);bw.w(n-1,16);
    let crc=0;for(let i=h0;i<bw.p;i++)crc=FLAC_CRC8[crc^bw.b[i]];bw.w(crc,8);
    for(let c=0;c<chans.length;c++)flacSubframe(bw,chans[c],n,bpss[c],res);
    bw.align();let c16=0;for(let i=h0;i<bw.p;i++)c16=((c16<<8)^FLAC_CRC16[((c16>>8)^bw.b[i])&0xff])&0xffff;bw.w(c16,16);
    if(performance.now()-t0>30){if(onProg)onProg(pos/len);await new Promise(r=>setTimeout(r,0));t0=performance.now()}}
  if(onProg)onProg(1);return bw.bytes().slice()}
