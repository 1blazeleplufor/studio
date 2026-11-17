const {load,run,voice,yin,SR}=require('./harness');const fs=require('fs');
const file=process.argv[2],which=process.argv[3]||'all';const P=load(file);
// gamme de La mineur ; notes chantées un peu fausses
const SC=[0,2,3,5,7,8,10],KEY=9;const inScale=m=>SC.includes(((Math.round(m)-KEY)%12+12)%12);
const v=voice([[57,.6,30],[60,.5,-35],[64,.7,25],[62,.5,-40],[57,.8,15],[52,.6,-30]]);
const notesArr=Array.from({length:12},(_,i)=>SC.includes((i-KEY+12)%12)?0:2);
function score(name,out,lat){let err=[],ap=[];const step=480;
  for(let i=SR*.15|0;i+3000<out.length;i+=step){const src=i-lat;if(src<0)continue;const tr=v.truth[src];const near=Math.round(tr);if(!inScale(near))continue;
    const e=yin(out,i);if(!e.f)continue;const m=69+12*Math.log2(e.f/440);const target=Math.round(m);err.push(Math.abs(m-target)*100);ap.push(e.ap)}
  err.sort((a,b)=>a-b);const med=err[err.length>>1],p90=err[Math.floor(err.length*.9)],apm=ap.reduce((a,b)=>a+b,0)/ap.length;
  console.log(name.padEnd(28),'écart médian',med.toFixed(1).padStart(5),'cents | 90 %',p90.toFixed(1).padStart(5),'cents | apériodicité (rugosité)',apm.toFixed(3))}
score('voix d’origine (fausse)',v.y,0);
const lat=Math.round(.05*SR);
if(P['pitch-proc']&&(which==='all'||which==='old')){const o=run(P['pitch-proc'],{key:KEY,scale:SC,speed:0},v.y,{amount:1,speed:0,mix:1,shift:0});score('ancien « pitch » (dur)',o,0);fs.writeFileSync('old_pitch.raw',Buffer.from(o.buffer))}
for(const [nm,rt,hu] of [['Pitch Pro dur (0 ms)',0,0],['Pitch Pro naturel (35 ms)',35,40]]){const o=run(P['tunepro-proc'],{params:{key:KEY,notes:notesArr,retune:rt,humanize:hu,input:1}},v.y);score(nm,o,lat)}
// transposition -5 (shifter)
const sh=run(P['tunepro-proc'],{params:{key:KEY,notes:new Array(12).fill(1),retune:0,transpose:-5,input:1,amount:0}},v.y);
let ap=[];for(let i=SR*.2|0;i+3000<sh.length;i+=960){const e=yin(sh,i);if(e.f)ap.push(e.ap)}console.log('Pitch Pro transpo −5'.padEnd(28),'apériodicité',(ap.reduce((a,b)=>a+b,0)/ap.length).toFixed(3));
