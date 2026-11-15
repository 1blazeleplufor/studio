// ===== Décodeur FLAC maison (v3.9.1) =====
// Les sons partagés en session sont en FLAC. Certains téléphones (iPhone / Safari) n'arrivent pas toujours à les lire
// avec decodeAudioData (format, taille, mémoire). Ce décodeur lit le FLAC directement dans un AudioBuffer, sans copie en plus.
// Gère tout le FLAC standard : constant, verbatim, prédicteurs fixes, LPC, Rice/Rice2, échappement, bits perdus, stéréo décorrélée.
class FlacIn{
  constructor(b){this.b=b;this.p=0}
  read(n){const b=this.b;let r=0;while(n>0){const i=this.p>>3;if(i>=b.length)throw new Error('FLAC tronqué');const off=this.p&7,av=8-off,t=av<n?av:n;
    r=r*(1<<t)+((b[i]>>(av-t))&((1<<t)-1));n-=t;this.p+=t}return r}
  sread(n){const v=this.read(n);return v>=2**(n-1)?v-2**n:v}
  unary(){const b=this.b;let q=0;for(;;){const i=this.p>>3;if(i>=b.length)throw new Error('FLAC tronqué');const off=this.p&7,x=(b[i]<<off)&0xff;
    if(!x){q+=8-off;this.p+=8-off;continue}const lz=Math.clz32(x)-24;q+=lz;this.p+=lz+1;return q}}
  align(){this.p=(this.p+7)&~7}
}
function flacResid(rd,out,o,n){const meth=rd.read(2);if(meth>1)throw new Error('FLAC : résidu inconnu');const kb=meth?5:4,esc=meth?31:15;
  const po=rd.read(4),parts=1<<po,ps=n>>po;let i=o;
  for(let pi=0;pi<parts;pi++){const cnt=pi?ps:ps-o,k=rd.read(kb);
    if(k===esc){const nb=rd.read(5);for(let j=0;j<cnt;j++)out[i++]=nb?rd.sread(nb):0}
    else{const m=2**k;for(let j=0;j<cnt;j++){const u=rd.unary()*m+(k?rd.read(k):0);out[i++]=u%2?-(u+1)/2:u/2}}}}
function flacSub(rd,x,n,bps){rd.read(1);const t=rd.read(6);let w=0;if(rd.read(1)){w=rd.unary()+1;bps-=w}
  if(t===0){const v=rd.sread(bps);x.fill(v,0,n)}
  else if(t===1){for(let i=0;i<n;i++)x[i]=rd.sread(bps)}
  else if(t>=8&&t<=12){const o=t-8;for(let i=0;i<o;i++)x[i]=rd.sread(bps);flacResid(rd,x,o,n);
    for(let i=o;i<n;i++){const r=x[i];x[i]=o===0?r:o===1?r+x[i-1]:o===2?r+2*x[i-1]-x[i-2]:o===3?r+3*x[i-1]-3*x[i-2]+x[i-3]:r+4*x[i-1]-6*x[i-2]+4*x[i-3]-x[i-4]}}
  else if(t>=32){const o=t-31;for(let i=0;i<o;i++)x[i]=rd.sread(bps);const prec=rd.read(4)+1,sh=rd.sread(5),c=[];for(let i=0;i<o;i++)c.push(rd.sread(prec));
    flacResid(rd,x,o,n);const d=2**Math.max(0,sh);for(let i=o;i<n;i++){let s=0;for(let j=0;j<o;j++)s+=c[j]*x[i-1-j];x[i]+=Math.floor(s/d)}}
  else throw new Error('FLAC : sous-trame inconnue');
  if(w)for(let i=0;i<n;i++)x[i]*=2**w}
// bytes : Uint8Array du .flac → AudioBuffer (créé avec mk(ch,len,sr)). onProg(0..1) facultatif.
async function decodeFLAC(bytes,mk,onProg){
  const rd=new FlacIn(bytes);if(rd.read(32)!==0x664c6143)throw new Error('pas un FLAC');
  let sr=0,ch=0,bps=0,total=0;
  for(let last=0;!last;){last=rd.read(1);const type=rd.read(7),len=rd.read(24),st=rd.p;
    if(type===0){rd.read(16);rd.read(16);rd.read(24);rd.read(24);sr=rd.read(20);ch=rd.read(3)+1;bps=rd.read(5)+1;total=rd.read(36)}
    rd.p=st+len*8}
  if(!sr||!total)throw new Error('FLAC : durée inconnue');
  const ab=mk(ch,total,sr),outs=[];for(let c=0;c<ch;c++)outs.push(ab.getChannelData(c));
  let buf=[new Int32Array(65536),new Int32Array(65536)],pos=0,t0=performance.now();const L=bytes.length;
  while(pos<total&&(rd.p>>3)<L-2){
    rd.align();let i=rd.p>>3;while(i<L-1&&!(bytes[i]===0xff&&(bytes[i+1]&0xfe)===0xf8))i++;if(i>=L-1)break;rd.p=i*8;
    rd.read(16);const bsc=rd.read(4),src=rd.read(4),ca=rd.read(4),bc=rd.read(3);rd.read(1);
    let f=rd.read(8);if(f&0x80){let k=0;while(f&(0x80>>k))k++;for(let j=1;j<k;j++)rd.read(8)}
    const n=bsc===1?192:bsc>=2&&bsc<=5?576<<(bsc-2):bsc===6?rd.read(8)+1:bsc===7?rd.read(16)+1:bsc>=8?256<<(bsc-8):0;
    if(src===12)rd.read(8);else if(src===13||src===14)rd.read(16);
    rd.read(8);if(!n)throw new Error('FLAC : bloc invalide');
    const fb=[0,8,12,0,16,20,24,32][bc]||bps,nch=ca<8?ca+1:2;
    for(let c=0;c<nch;c++)if(!buf[c]||buf[c].length<n)buf[c]=new Int32Array(Math.max(n,65536));
    for(let c=0;c<nch;c++){const side=(ca===8&&c===1)||(ca===9&&c===0)||(ca===10&&c===1);flacSub(rd,buf[c],n,fb+(side?1:0))}
    rd.align();rd.read(16);
    const a=buf[0],b=buf[1];
    if(ca===8)for(let j=0;j<n;j++)b[j]=a[j]-b[j];
    else if(ca===9)for(let j=0;j<n;j++)a[j]=a[j]+b[j];
    else if(ca===10)for(let j=0;j<n;j++){const s=b[j],m=a[j]*2+(s&1);a[j]=(m+s)>>1;b[j]=(m-s)>>1}
    const sc=1/2**(fb-1),m=Math.min(n,total-pos);
    for(let c=0;c<ch;c++){const o=outs[c],x=buf[Math.min(c,nch-1)];for(let j=0;j<m;j++)o[pos+j]=x[j]*sc}
    pos+=m;
    if(performance.now()-t0>30){if(onProg)onProg(pos/total);await new Promise(r=>setTimeout(r,0));t0=performance.now()}}
  if(pos<total*.99)throw new Error('FLAC incomplet');
  if(onProg)onProg(1);return ab}
// Son reçu en session : notre décodeur d'abord, celui du navigateur en secours.
async function decodeSon(bytes,fmt,onProg){
  if(fmt==='flac')try{return await decodeFLAC(bytes,(c,l,s)=>ctx.createBuffer(c,l,s),onProg)}catch(e){console.warn('FLAC maison → décodeur du navigateur',e)}
  return await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length))}
