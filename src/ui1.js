// ===== Interface : état, projet, utilitaires =====
const $=(s,r=document)=>r.querySelector(s);
function h(tag,props,...kids){const e=document.createElement(tag);if(props)for(const k in props){const v=props[k];if(k==='style'&&typeof v==='object')Object.assign(e.style,v);else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='class')e.className=v;else if(k==='html')e.innerHTML=v;else if(v!==undefined&&v!==null&&v!==false)e.setAttribute(k,v===true?'':v)}
  for(const c of kids.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(c))}return e}
const uid=p=>(p||'x')+Math.random().toString(36).slice(2,9);
const COLORS=['#4a8cff','#30c48d','#ff9f0a','#ff6b6b','#bf5af2','#e6c200','#40c8f0','#ff7ac6','#8e8e93'];
const deep=o=>JSON.parse(JSON.stringify(o));
let ctx,E,P,PH=0,SEL=null,SELR=new Set(),PPB=26,TH=84,UNDO=[],REDO=[],DIRTY=false,TAB=null,TYPING=false,OCT=4,LEARN=null,REC=false,MIDI=null;
const KNOBS={};
const IS_TOUCH=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0&&matchMedia('(hover:none)').matches;
const isSmall=()=>innerWidth<=900;
function toast(m,ms){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(t._t);t._t=setTimeout(()=>t.style.display='none',ms||2600)}
function snapshot(){UNDO.push(JSON.stringify(P));if(UNDO.length>80)UNDO.shift();REDO=[];DIRTY=true}
function undo(){if(!UNDO.length)return toast('Rien à annuler');REDO.push(JSON.stringify(P));P=JSON.parse(UNDO.pop());afterLoad()}
function redo(){if(!REDO.length)return;UNDO.push(JSON.stringify(P));P=JSON.parse(REDO.pop());afterLoad()}
function afterLoad(){closeAllPlugins();E.stop();E.build(P);if(!findTrack(SEL))SEL=P.tracks[0]&&P.tracks[0].id;SELR=new Set([...SELR].filter(id=>findRegion(id)));renderAll()}
const findTrack=id=>P.tracks.find(t=>t.id===id);
const isInstru=t=>!!t&&t.type==='audio'&&(t.role==='instru'||(!t.role&&/^🎵/.test(t.name||'')));
function findObj(id){return id==='master'?P.master:P.tracks.find(t=>t.id===id)||P.auxes.find(a=>a.id===id)}
function findRegion(id){for(const t of P.tracks){const r=t.regions.find(r=>r.id===id);if(r)return[t,r]}return null}
const spb=()=>60/P.bpm;
function rLen(t,r){return t.type==='audio'?r.dur/spb():r.len}
function gridStep(){let s=P.settings.snap;if(!s)return 0;while(s*PPB>=24&&s>1/2048)s/=2;return s*PPB<1?0:s} // plus on zoome, plus c'est fin (zoom extrême = libre)
function snapB(b,s){s=s===undefined?gridStep():s;return s?Math.round(b/s)*s:b}
// accroche aux objets (comme AutoCAD) : en glissant une région, ses bords se collent aux bords des autres régions (toutes pistes),
// aux marqueurs, à la tête de lecture et à la boucle, à moins de 10 px ; une ligne de projection montre l'alignement. Maj = sans accroche.
function edgeCands(ex){const c=[{v:0},{v:PH,k:'ph'}];for(const t of P.tracks)for(const r of t.regions){if(ex.has(r.id))continue;c.push({v:r.start,t:t.id},{v:r.start+rLen(t,r),t:t.id})}
  for(const m of P.marks||[])c.push({v:m.beat,k:'mk'});if(P.cycle.on)c.push({v:P.cycle.start},{v:P.cycle.end});return c}
function magnet(edges,ex,e){if(e&&e.shiftKey)return null;const tol=10/PPB;let best=null;
  for(const c of edgeCands(ex))for(const v of edges){const d=c.v-v;if(Math.abs(d)<tol&&(!best||Math.abs(d)<Math.abs(best.d)-1e-9))best={d,at:c.v,t:c.t}}return best}
function showGuide(g){document.querySelectorAll('#lanes .sguide,#lanes .sgdot').forEach(x=>x.remove());if(!g)return;const L=$('#lanes');if(!L)return;
  L.append(h('div',{class:'sguide',style:{left:g.at*PPB+'px'}}));if(g.t){const i=P.tracks.findIndex(t=>t.id===g.t);if(i>=0)L.append(h('div',{class:'sgdot',style:{left:g.at*PPB+'px',top:(i*TH+TH/2)+'px'}}))}}
// tête de lecture : grille adaptée au zoom + aimant sur les débuts/fins de régions, marqueurs et cycle (8 px) ; Alt = placement libre
function snapPH(b,e){if(e&&e.altKey)return Math.max(0,b);const tol=8/PPB;let best=null,bd=tol;const chk=x=>{const d=Math.abs(x-b);if(d<bd){bd=d;best=x}};
  for(const t of P.tracks)for(const r of t.regions){chk(r.start);chk(r.start+rLen(t,r))}for(const m of P.marks||[])chk(m.beat);if(P.cycle.on){chk(P.cycle.start);chk(P.cycle.end)}chk(0);
  return Math.max(0,best!=null?best:snapB(b))}
function plug(type,over){const p=defaultParams(type);if(type==='pitch'||type==='tunepro'){p.key=P?P.key:0;p.scale=P?P.scaleIdx:0}return{type,params:Object.assign(p,over||{}),byp:false}}
function emptyPat(n){const rows={};for(const [r] of DRUM_ROWS)rows[r]=new Array(n).fill(0);return{steps:n,rows}}
function newTrack(type,name,extra){
  const n=P.tracks.length,t={id:uid('t'),type,name,color:COLORS[n%COLORS.length],vol:0,pan:0,mute:false,solo:false,arm:false,mon:false,plugins:[],sends:P.auxes.map(()=>-60),regions:[]};
  if(type==='synth')t.instr=deep(SYNTH_PRESETS['Pluck trap']),t.preset='Pluck trap';
  if(type==='drums')t.instr=deep(DRUM_KITS['Trap 808']),t.kit='Trap 808';
  return Object.assign(t,extra||{});
}
const VOCAL_PRESETS={
 'Voix rap propre':{cat:'Base',sends:[-17,-24],pl:[['gate',{thr:-55}],['eq',{hp:90,m1F:300,m1G:-2.5,m2F:3500,m2G:3,hiF:10000,hiG:2.5}],['comp',{thr:-22,ratio:4,att:5,rel:100,gain:5}],['deess',{}]]},
 'Voix lourde / sombre':{cat:'Base',sends:[-18,-60],pl:[['eq',{hp:70,lowF:160,lowG:3,m2F:2500,m2G:-1,hiF:9000,hiG:-3}],['comp',{thr:-26,ratio:5,att:8,gain:6}],['sat',{drive:22,type:1,mix:60,out:-2}]]},
 'Voix drill sale':{cat:'Base',sends:[-22,-18],pl:[['gate',{thr:-50}],['eq',{hp:120,m1F:400,m1G:-3,m2F:3200,m2G:4,hiG:2}],['comp',{thr:-28,ratio:8,att:2,rel:60,gain:8}],['sat',{drive:35,type:2,mix:45,out:-4}],['deess',{}]]},
 'Chuchoté / ASMR':{cat:'Base',sends:[-18,-60],pl:[['eq',{hp:150,m2F:5000,m2G:3,hiF:10000,hiG:5}],['comp',{thr:-32,ratio:6,att:3,gain:10}],['deess',{thr:-34,amt:85}]]},
 'Voix autotune trap':{cat:'Autotune',sends:[-14,-17],pl:[['gate',{thr:-55}],['pitch',{speed:0,amount:100}],['eq',{hp:110,m1F:350,m1G:-3,m2F:4000,m2G:4,hiF:11000,hiG:3}],['comp',{thr:-24,ratio:6,att:3,rel:80,gain:6}],['deess',{}],['chorus',{mix:18}]]},
 'Autotune mélodieux':{cat:'Autotune',sends:[-11,-14],pl:[['gate',{thr:-55}],['pitch',{speed:12,amount:95}],['eq',{hp:100,m1F:300,m1G:-2,m2F:3800,m2G:3,hiG:3.5}],['comp',{thr:-22,ratio:4,gain:5}],['deess',{}],['chorus',{mix:22,depth:30}]]},
 'Autotune naturel':{cat:'Autotune',sends:[-17,-22],pl:[['pitch',{speed:45,amount:75}],['eq',{hp:90,m2F:3200,m2G:2}],['comp',{thr:-20,ratio:3.5,gain:4}],['deess',{}]]},
 'Voix chantée aérienne':{cat:'Autotune',sends:[-8,-14],pl:[['pitch',{speed:25,amount:90}],['eq',{hp:120,m1G:-2,hiF:12000,hiG:5}],['comp',{thr:-24,ratio:4,gain:5}],['deess',{}],['chorus',{mix:30,depth:45}],['width',{w:150}]]},
 'Robot':{cat:'Autotune',sends:[-16,-18],pl:[['pitch',{speed:0,amount:100}],['robot',{freq:45,mix:35}],['crush',{bits:10,down:2,mix:30}],['eq',{hp:120,m2G:3}],['comp',{thr:-22,ratio:5,gain:5}]]},
 'Voix grave (démon)':{cat:'Créatif',sends:[-16,-60],pl:[['shifter',{shift:-7,mix:100}],['eq',{hp:60,lowG:3,hiG:-2}],['sat',{drive:30,type:1,mix:50,out:-3}],['comp',{thr:-24,ratio:5,gain:5}]]},
 'Voix aiguë (pitchée)':{cat:'Créatif',sends:[-16,-20],pl:[['shifter',{shift:5,mix:100}],['eq',{hp:150,m2G:2}],['comp',{thr:-22,ratio:4,gain:4}]]},
 'Doublage octave':{cat:'Créatif',sends:[-14,-20],pl:[['shifter',{shift:-12,mix:35}],['chorus',{mix:35}],['eq',{hp:90}],['comp',{thr:-22,ratio:4,gain:4}]]},
 'Lo-fi / radio vintage':{cat:'Créatif',sends:[-20,-20],pl:[['filter',{type:2,freq:1600,q:.8}],['crush',{bits:8,down:4,mix:55}],['sat',{drive:30,mix:60,out:-3}],['comp',{thr:-20,ratio:4,gain:6}]]},
 'Phaser psyché':{cat:'Créatif',sends:[-12,-16],pl:[['eq',{hp:100}],['comp',{thr:-22,ratio:4,gain:4}],['phaser',{rate:.3,mix:55}]]},
 'Grande salle / stade':{cat:'Créatif',sends:[-5,-13],pl:[['eq',{hp:110,m2G:3,hiG:2}],['comp',{thr:-24,ratio:5,gain:6}],['width',{w:150}]]},
 'Écho slap':{cat:'Créatif',sends:[-20,-60],pl:[['eq',{hp:100,m2G:2}],['comp',{thr:-22,ratio:4,gain:4}],['delay',{sync:0,ms:110,fb:12,pp:0,mix:28}]]},
 'Ad-libs téléphone':{cat:'Ad-libs & backs',sends:[-15,-10],pl:[['filter',{type:3}],['sat',{drive:40,mix:70,out:-4}],['width',{w:160,haas:12}],['comp',{thr:-20,ratio:4,gain:3}]]},
 'Ad-libs lointains':{cat:'Ad-libs & backs',sends:[-6,-9],pl:[['eq',{hp:250,lp:7000}],['comp',{thr:-22,ratio:4,gain:3}],['width',{w:180,haas:15}]]},
 'Backs / doublage':{cat:'Ad-libs & backs',sends:[-14,-20],pl:[['eq',{hp:160,m1F:400,m1G:-3,hiG:2}],['comp',{thr:-24,ratio:4,gain:4}],['chorus',{mix:55,depth:60}],['width',{w:170,haas:8}]]},
 'Aucun effet':{cat:'Base',sends:[-60,-60],pl:[]},
};
function applyVocalPreset(t,name){snapshot();const v=VOCAL_PRESETS[name];t.plugins=v.pl.map(([ty,o])=>plug(ty,o));t.sends=P.auxes.map((a,i)=>v.sends[i]??-60);t.preset=name;closeAllPlugins();E.updateStrip(t);renderAll();toast('Préréglage « '+name+' » appliqué')}
function newProject(demo){
  P={name:'Mon morceau',bpm:140,sig:4,key:0,scaleIdx:0,tracks:[],auxes:[],master:{id:'master',name:'Sortie stéréo',vol:0,pan:0,plugins:[]},cycle:{on:false,start:0,end:16},settings:{snap:.25,latencyMs:0,countIn:1,metro:true,metroPlay:false,inputDev:''},midiMap:{},ext:{}};
  P.auxes=[{id:'aux1',name:'Bus Réverb',color:'#5e5ce6',vol:0,pan:0,mute:false,plugins:[plug('eq',{hp:200,lp:14000}),plug('verbpro',Object.assign({},VERB_PRESETS['Voix chantée – hall 80s'],{mix:100}))]},
           {id:'aux2',name:'Bus Délai',color:'#5e5ce6',vol:0,pan:0,mute:false,plugins:[plug('delay',{mix:100,sync:6,fb:30,lp:4500}),plug('eq',{hp:300})]}];
  P.master.plugins=[plug('limiter',{gain:0,ceil:-1})];
  if(!demo){P.tracks.push(newTrack('audio','Voix 1'));return}
  P.name='Démo trap';P.cycle={on:true,start:0,end:16};
  const d=newTrack('drums','Batterie');const pat=emptyPat(16),R=pat.rows,on=(row,i,v,r)=>R[row][i]={v:v||.85,r:r||1};
  [0,11].forEach(i=>on('kick',i,.95));on('snare',8,.9);on('clap',8,.8);
  [0,2,4,8,10,12].forEach(i=>on('hat',i,.8));on('hat',6,.7,2);on('hat',14,.7,3);on('hat',15,.55,2);on('ohat',13,.5);on('perc',7,.5);
  d.regions.push({id:uid('r'),start:0,len:16,pat,name:'Rythme'});
  const b=newTrack('synth','Basse 808');b.instr=deep(SYNTH_PRESETS['Basse 808']);b.preset='Basse 808';
  b.regions.push({id:uid('r'),start:0,len:16,name:'808',notes:[{p:36,s:0,l:2.5,v:.9},{p:36,s:2.75,l:1.25,v:.8},{p:32,s:4,l:3.5,v:.9},{p:34,s:8,l:3.5,v:.9},{p:31,s:12,l:2,v:.9},{p:43,s:14,l:2,v:.85}]});
  const m=newTrack('synth','Mélodie');m.vol=-4;
  const chords=[[60,63,67],[56,60,63],[58,62,65],[55,59,62]],seq=[2,1,0,1,2,1,0,2],notes=[];
  chords.forEach((c,bi)=>seq.forEach((ix,k)=>notes.push({p:c[ix]+12,s:bi*4+k*.5,l:.45,v:k%2?.6:.8})));
  m.regions.push({id:uid('r'),start:0,len:16,name:'Arpège',notes});
  const pad=newTrack('synth','Nappe');pad.instr=deep(SYNTH_PRESETS['Pad nuage']);pad.preset='Pad nuage';pad.vol=-9;
  pad.regions.push({id:uid('r'),start:0,len:16,name:'Accords',notes:chords.flatMap((c,bi)=>c.map(p=>({p,s:bi*4,l:4,v:.6})))});
  const v=newTrack('audio','Voix 1');
  P.tracks.push(d,b,m,pad,v);P.tracks.forEach((t,i)=>{t.color=COLORS[i%COLORS.length];t.sends=P.auxes.map(()=>-60)});
}
function fmtV(v,d){if(d.opts)return d.opts[v|0];const u=d.u||'';if(u==='dB'&&d.min<=-60&&v<=-59.9)return'-∞';if(u==='Hz'&&v>=1000)return(v/1000).toFixed(v>=10000?1:2)+'k';
  const r=(d.max-d.min);const s=d.step?Math.round(v):r>=100?Math.round(v):r>=10?v.toFixed(1):v.toFixed(2);return s+(u?' '+u:'')}
const toN=(v,d)=>d.log?Math.log(v/d.min)/Math.log(d.max/d.min):(v-d.min)/(d.max-d.min);
const fromN=(n,d)=>{n=clamp(n,0,1);let v=d.log?d.min*Math.pow(d.max/d.min,n):d.min+n*(d.max-d.min);if(d.step)v=Math.round(v/d.step)*d.step;return v};
// Bouton rotatif
function knob(d,get,set,opt={}){
  if(d.opts){const sel=h('select',{onchange:e=>{set(+e.target.selectedIndex);}},d.opts.map((o,i)=>h('option',{value:i},o)));
    const cur=get();sel.selectedIndex=typeof cur==='number'?cur:Math.max(0,d.opts.indexOf(cur));
    if(opt.key)KNOBS[opt.key]=()=>{const c=get();sel.selectedIndex=typeof c==='number'?c:d.opts.indexOf(c)};
    return h('div',{class:'knob',style:{width:(opt.w||80)+'px'}},sel,h('div',{class:'kl'},d.n))}
  const S=opt.size||38,cv=h('canvas',{width:S*2,height:S*2,style:{width:S+'px',height:S+'px'}}),val=h('div',{class:'kv'}),
    w=h('div',{class:'knob'+(opt.key&&P.midiMap&&Object.values(P.midiMap).includes(opt.key)?' mapped':''),style:opt.w?{width:opt.w+'px'}:null},cv,h('div',{class:'kl',title:d.n},d.n),val);
  const draw=()=>{const g=cv.getContext('2d'),v=get(),n=clamp(toN(v,d),0,1),c=S;g.clearRect(0,0,c*2,c*2);
    const a0=Math.PI*.75,a1=a0+n*Math.PI*1.5;g.lineWidth=5;g.lineCap='round';
    g.strokeStyle='#111';g.beginPath();g.arc(c,c,c-6,a0,a0+Math.PI*1.5);g.stroke();
    g.strokeStyle=opt.color||'#4fa3ff';g.beginPath();if(d.min<0&&d.max>0){const z=a0+toN(0,d)*Math.PI*1.5;g.arc(c,c,c-6,Math.min(z,a1),Math.max(z,a1))}else g.arc(c,c,c-6,a0,a1);g.stroke();
    const gr=g.createLinearGradient(0,0,0,c*2);gr.addColorStop(0,'#5a5a60');gr.addColorStop(1,'#2a2a2e');g.fillStyle=gr;g.beginPath();g.arc(c,c,c-12,0,7);g.fill();
    g.strokeStyle='#eee';g.lineWidth=3;g.beginPath();g.moveTo(c+Math.cos(a1)*(c-24),c+Math.sin(a1)*(c-24));g.lineTo(c+Math.cos(a1)*(c-13),c+Math.sin(a1)*(c-13));g.stroke();
    val.textContent=fmtV(v,d)};
  draw();if(opt.key)KNOBS[opt.key]=draw;
  let y0,n0,moved;
  cv.addEventListener('pointerdown',e=>{if(e.button)return;cv.setPointerCapture(e.pointerId);y0=e.clientY;n0=toN(get(),d);moved=false});
  cv.addEventListener('pointermove',e=>{if(y0==null)return;if(!moved){moved=true;if(opt.undo!==false)snapshot()}const k=e.shiftKey?.0015:.006;set(fromN(n0+(y0-e.clientY)*k,d));draw()});
  cv.addEventListener('pointerup',()=>{y0=null;if(opt.after)opt.after()});
  cv.addEventListener('dblclick',()=>{snapshot();set(d.def!==undefined?d.def:fromN(.5,d));draw();if(opt.after)opt.after()});
  cv.addEventListener('wheel',e=>{e.preventDefault();set(fromN(toN(get(),d)+(e.deltaY<0?.02:-.02),d));draw()},{passive:false});
  cv.addEventListener('contextmenu',e=>{e.preventDefault();if(!opt.key)return;learnMenu(e,opt.key,w)});
  return w;
}
function learnMenu(e,key,w){menu(e,[['MIDI Learn (bougez un potard de votre contrôleur)',()=>{if(!MIDI)initMIDI(true);LEARN={key,w};w.classList.add('learn');toast('MIDI Learn : bougez un contrôle MIDI…',5000)}],
  ['Oublier l’assignation MIDI',()=>{for(const k in P.midiMap)if(P.midiMap[k]===key)delete P.midiMap[k];w.classList.remove('mapped')}]])}
function menu(e,items){
  closeMenu();const m=h('div',{class:'menu',id:'menu'});
  for(const it of items){if(it==='-'){m.append(h('div',{class:'sep'}));continue}if(typeof it==='string'){m.append(h('div',{class:'hd'},it));continue}
    m.append(h('div',{onclick:()=>{closeMenu();it[1]()}},it[0]))}
  document.body.append(m);const r=m.getBoundingClientRect();
  m.style.left=Math.min(e.clientX,innerWidth-r.width-6)+'px';m.style.top=Math.min(e.clientY,innerHeight-r.height-6)+'px';
  setTimeout(()=>document.addEventListener('pointerdown',closeMenuOut,true),0);
}
function closeMenuOut(e){if(!e.target.closest('#menu'))closeMenu()}
function closeMenu(){const m=$('#menu');if(m)m.remove();document.removeEventListener('pointerdown',closeMenuOut,true)}
function modal(content){const m=h('div',{class:'modal',onpointerdown:e=>{if(e.target===m)m.remove()}},h('div',{class:'box'},content));document.body.append(m);return m}
async function download(blob,name){
  if(IS_TOUCH&&navigator.canShare){const f=new File([blob],name,{type:blob.type||'application/octet-stream'});
    if(navigator.canShare({files:[f]})){const go=async()=>{try{await navigator.share({files:[f],title:name})}catch(e){}};
      try{await navigator.share({files:[f],title:name});return}catch(e){if(e.name==='AbortError')return;
        const m=modal([h('h2',null,'Fichier prêt ✔'),h('p',null,name),h('p',{style:{color:'var(--dim)'}},'Touchez le bouton puis « Enregistrer dans Fichiers » (iPhone/iPad) ou choisissez une appli (Android).'),h('button',{style:{fontSize:'16px',padding:'10px 16px'},onclick:()=>{go();m.remove()}},'📤 Enregistrer / partager')]);return}}}
  const a=h('a',{href:URL.createObjectURL(blob),download:name});document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000)}
// cible générique d'un paramètre (MIDI learn)
function targetSet(key,n){
  const [k,id,a,b]=key.split('|');const o=findObj(id);if(!o)return;
  if(k==='p'){const pl=o.plugins[+a];if(!pl||!PLUGINS[pl.type])return;const d=PLUGINS[pl.type].params.find(x=>x.id===b);pl.params[b]=d.opts?Math.round(n*(d.opts.length-1)):fromN(n,d);E.updateStrip(o)}
  else if(k==='i'){const d=o.type==='synth'?SYNTH_PARAMS.find(x=>x.id===a):null;if(d){if(d.opts){const ix=Math.round(n*(d.opts.length-1));o.instr[a]=a==='mono'?ix:d.opts[ix]}else o.instr[a]=fromN(n,d)}}
  else if(k==='v'){o.vol=n<.01?-60:-60+66*Math.pow(n,.5);E.updateStrip(o);syncFaders(id)}
  else if(k==='pan'){o.pan=n*2-1;E.updateStrip(o)}
  else if(k==='snd'){o.sends[+a]=n<.01?-60:-60+66*n;E.updateStrip(o)}
  if(KNOBS[key])KNOBS[key]();DIRTY=true;
}
function syncFaders(id){document.querySelectorAll('input.fader[data-id="'+id+'"]').forEach(f=>{const o=findObj(id);f.value=o.vol;const db=f.closest('.strip')&&f.closest('.strip').querySelector('.db');if(db)db.textContent=o.vol<=-60?'-∞':o.vol.toFixed(1)+' dB'})}
// MIDI
async function initMIDI(verbose){
  if(!navigator.requestMIDIAccess){if(verbose)toast('Ce navigateur ne gère pas le MIDI (utilisez Chrome ou Edge)');return}
  try{MIDI=await navigator.requestMIDIAccess();const hook=()=>{MIDI.inputs.forEach(i=>i.onmidimessage=onMidi)};hook();MIDI.onstatechange=hook;
    if(verbose)toast(MIDI.inputs.size?'MIDI prêt : '+[...MIDI.inputs.values()].map(i=>i.name).join(', '):'Aucun appareil MIDI détecté')}catch(e){if(verbose)toast('MIDI refusé')}
}
function onMidi(m){
  const [st,d1,d2]=m.data,cmd=st&0xf0,ch=st&15;
  if(cmd===0xB0){const id='cc:'+ch+':'+d1;
    if(LEARN){for(const k in P.midiMap)if(P.midiMap[k]===LEARN.key)delete P.midiMap[k];P.midiMap[id]=LEARN.key;LEARN.w.classList.remove('learn');LEARN.w.classList.add('mapped');toast('Assigné au CC '+d1);LEARN=null;return}
    const key=P.midiMap[id];if(key)targetSet(key,d2/127);return}
  const t=findTrack(SEL);if(!t||t.type==='audio')return;
  if(cmd===0x90&&d2>0)E.noteOn(t,d1,d2/127);else if(cmd===0x80||(cmd===0x90&&d2===0))E.noteOff(t,d1);
}
