const {load,run,voice,SR}=require('./harness');const P=load(process.argv[2]);
function seg(){const parts=[];const sil=n=>new Float32Array(Math.round(n*SR));const noise=(n,a)=>{const y=new Float32Array(Math.round(n*SR));let l=0;for(let i=0;i<y.length;i++){const x=Math.random()*2-1;y[i]=(x-l)*a;l=x}return y};
 parts.push(sil(.2),noise(.12,.15),voice([[50,.5,20]]).y,noise(.08,.1),voice([[74,.4,-20],[79,.3,30]]).y,sil(.15),voice([[40,.5,0]]).y,noise(.3,.02),voice([[62,.5,35]]).y,sil(.3));
 const N=parts.reduce((a,p)=>a+p.length,0),y=new Float32Array(N);let o=0;for(const p of parts){y.set(p,o);o+=p.length}return y}
const x=seg();let pin=0;for(const v of x)pin=Math.max(pin,Math.abs(v));
for(const cfg of [{retune:0,input:1},{retune:0,input:2},{retune:0,input:0},{retune:20,input:1,transpose:-12},{retune:0,input:1,transpose:7,formant:0},{retune:0,input:1,amount:0,transpose:-5}]){
  const o=run(P['tunepro-proc'],{params:Object.assign({key:2,notes:Array.from({length:12},(_,i)=>[0,2,3,5,7,8,10].includes((i-2+12)%12)?0:2)},cfg)},x);
  let pk=0,nan=0,jump=0;for(let i=1;i<o.length;i++){if(!isFinite(o[i]))nan++;pk=Math.max(pk,Math.abs(o[i]));jump=Math.max(jump,Math.abs(o[i]-o[i-1]))}
  // énergie en sortie vs entrée (doit rester du même ordre)
  let ei=0,eo=0;for(let i=0;i<x.length;i++)ei+=x[i]*x[i];for(let i=0;i<o.length;i++)eo+=o[i]*o[i];
  console.log(JSON.stringify(cfg).padEnd(52),'crête',(pk/pin).toFixed(2),'énergie',(10*Math.log10(eo/ei)).toFixed(1)+' dB','saut max',jump.toFixed(3),nan?'NaN!':'')}
let j=0;for(let i=1;i<x.length;i++)j=Math.max(j,Math.abs(x[i]-x[i-1]));console.log('saut max entrée',j.toFixed(3))
