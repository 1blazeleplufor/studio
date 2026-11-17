const {load,SR}=require('./harness');const P=load(__dirname+'/../../src/worklets.js');const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../../src/dsp.js','utf8');const VP=eval('('+src.slice(src.indexOf('const VERB_PRESETS={')+19,src.indexOf('};',src.indexOf('const VERB_PRESETS={'))+1)+')');
module.exports.ir=function ir(params,secs){const p=new P['verb-proc']({processorOptions:{params:Object.assign({},params,{mix:100})}});const N=SR*secs,L=new Float32Array(N),R=new Float32Array(N);
  for(let i=0;i<N;i+=128){const a=new Float32Array(128);if(i===0)a[0]=1;p.process([[a,a]],[[L.subarray(i,i+128),R.subarray(i,i+128)]])}return[L,R]};module.exports.VP=VP;
if(require.main===module)for(const name in VP){const [L]=module.exports.ir(VP[name],4);const r=[];for(let t=0;t<4;t+=.5){let m=0;for(let i=t*SR;i<(t+.5)*SR;i++)m=Math.max(m,Math.abs(L[i]));r.push(isFinite(m)?(20*Math.log10(m+1e-12)).toFixed(0):'NaN')}console.log(name.padEnd(30),r.join(' '))}
