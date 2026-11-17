const {SR}=require('./harness');
module.exports=function res(L,a){const n=8192,re=new Float64Array(n/2);for(let k=20;k<n/2;k++){let x=0,y=0;const w=2*Math.PI*k/n;for(let i=0;i<n;i++){const v=L[a+i]*(.5-.5*Math.cos(2*Math.PI*i/n));x+=v*Math.cos(w*i);y+=v*Math.sin(w*i)}re[k]=10*Math.log10(x*x+y*y+1e-20)}
  let c=0;for(let k=60;k<n/2-60;k++){let m=0;for(let j=-40;j<=40;j++)m+=re[k+j];m/=81;if(re[k]-m>8)c++}return c}
if(require.main===module){const N=SR*2,L=new Float32Array(N);for(let i=0;i<N;i++)L[i]=(Math.random()*2-1)*Math.exp(-6.9*i/SR/1.5);console.log('bruit pur (référence) :',module.exports(L,Math.round(.15*SR)))}
