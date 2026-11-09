// ===== Fenêtres de plugins, éditeurs, transport, fichiers =====
const WINS={};let winZ=50;
function closeAllPlugins(){for(const k in WINS){WINS[k].el.remove();delete WINS[k]}}
function makeWin(key,title,body,onClose){
  if(WINS[key]){WINS[key].el.remove();delete WINS[key];return null}
  const el=h('div',{class:'pwin',style:{left:(120+Object.keys(WINS).length*30)+'px',top:(110+Object.keys(WINS).length*30)+'px',zIndex:++winZ}});
  const bar=h('div',{class:'pt'},h('b',null,title),h('button',{onclick:()=>{el.remove();delete WINS[key];if(onClose)onClose()}},'✕'));
  el.append(bar,h('div',{class:'pb'},body));document.body.append(el);WINS[key]={el};
  el.addEventListener('pointerdown',()=>el.style.zIndex=++winZ);
  let d=null;bar.addEventListener('pointerdown',e=>{if(e.target.tagName==='BUTTON')return;d={x:e.clientX-el.offsetLeft,y:e.clientY-el.offsetTop};bar.setPointerCapture(e.pointerId)});
  bar.addEventListener('pointermove',e=>{if(d){el.style.left=clamp(e.clientX-d.x,0,innerWidth-80)+'px';el.style.top=clamp(e.clientY-d.y,0,innerHeight-40)+'px'}});bar.addEventListener('pointerup',()=>d=null);
  return WINS[key];
}
function openPlugin(o,i){
  const pl=o.plugins[i],def=PLUGINS[pl.type];if(!def)return toast('Plugin introuvable : rechargez le fichier .js');
  if(pl.type==='bridge')return openBridgePlugin(o,i);if(pl.type==='verbpro')return openVerbPro(o,i);if(pl.type==='tunepro')return openTunePro(o,i);
  const body=h('div');const w=makeWin(o.id+':'+i,def.name+' — '+o.name,body);if(!w)return;
  const upd=()=>{E.updateStrip(o);if(disp)drawDisp()};let disp=null,drawDisp=null;
  const strip=()=>E.strips[o.id]&&E.strips[o.id].plugins[i];
  if(pl.type==='eq'){disp=h('canvas',{class:'disp',width:760,height:240,style:{width:'380px',height:'120px'}});body.append(disp);
    drawDisp=()=>{const inst=strip();const g=disp.getContext('2d'),W=760,H=240;g.clearRect(0,0,W,H);g.strokeStyle='#1d2a36';g.lineWidth=1;
      for(const f of [50,100,200,500,1000,2000,5000,10000]){const x=Math.log(f/20)/Math.log(1000)*W;g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();g.fillStyle='#4a6075';g.font='16px sans-serif';g.fillText(f>=1000?f/1000+'k':f,x+3,H-6)}
      for(const db of [-12,0,12]){const y=H/2-db/24*H/2*1.6;g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
      if(!inst||!inst.filters)return;const N=200,fr=new Float32Array(N),mag=new Float32Array(N),ph=new Float32Array(N),tot=new Float32Array(N).fill(1);
      for(let k=0;k<N;k++)fr[k]=20*Math.pow(1000,k/(N-1));for(const f of inst.filters){f.getFrequencyResponse(fr,mag,ph);for(let k=0;k<N;k++)tot[k]*=mag[k]}
      g.beginPath();for(let k=0;k<N;k++){const db=20*Math.log10(tot[k]+1e-9)+pl.params.out,y=H/2-db/24*H/2*1.6,x=k/(N-1)*W;k?g.lineTo(x,y):g.moveTo(x,y)}
      g.strokeStyle='#4fa3ff';g.lineWidth=3;g.stroke();g.lineTo(W,H);g.lineTo(0,H);g.fillStyle='rgba(79,163,255,.12)';g.fill()};setTimeout(drawDisp,30)}
  if(pl.comp||['comp','limiter','deess'].includes(pl.type)){const gr=h('div',{class:'kv2'},'Réduction de gain',h('div',{class:'meter',style:{width:'200px',height:'10px'}},h('i',{style:{height:'100%',width:'0%',left:'auto',right:'0',background:'#ff9f0a'}})));body.append(gr);
    const tick=()=>{if(!WINS[o.id+':'+i])return;const inst=strip();if(inst&&inst.comp){gr.querySelector('i').style.width=Math.min(100,-inst.comp.reduction*5)+'%'}requestAnimationFrame(tick)};tick()}
  if(pl.type==='pitch')body.append(h('div',{style:{color:'var(--dim)',fontSize:'11px',maxWidth:'380px',margin:'0 auto 8px',textAlign:'center'}},'Vitesse 0 ms = effet robot « autotune » marqué. 30-60 ms = correction naturelle. Réglez la tonalité de l’instru (bouton en haut : Tonalité du projet).'),
    h('div',{class:'row'},h('button',{onclick:()=>{snapshot();pl.params.key=P.key;pl.params.scale=P.scaleIdx;closeAllPlugins();upd();openPlugin(o,i)}},'Prendre la tonalité du projet ('+NOTE_NAMES[P.key]+' '+Object.keys(SCALES)[P.scaleIdx]+')')));
  const ks=h('div',{class:'knobs'});for(const d of def.params.filter(x=>!x.hidden))ks.append(knob(d,()=>pl.params[d.id],v=>{pl.params[d.id]=v;upd()},{key:'p|'+o.id+'|'+i+'|'+d.id,w:d.opts?110:64}));
  body.append(ks,h('div',{class:'row'},h('button',{class:pl.byp?'':'on',onclick:e=>{snapshot();pl.byp=!pl.byp;e.target.classList.toggle('on',!pl.byp);e.target.textContent=pl.byp?'Contourné':'Actif';E.updateStrip(o);rerenderStrips()}},pl.byp?'Contourné':'Actif'),
    h('button',{onclick:()=>{snapshot();pl.params=Object.assign(defaultParams(pl.type),pl.type==='pitch'?{key:P.key,scale:P.scaleIdx}:{});closeAllPlugins();upd();openPlugin(o,i)}},'Réinitialiser'),
    h('span',{style:{color:'var(--dim)',fontSize:'10px'}},'Double-clic = valeur par défaut · Maj = réglage fin · clic droit = MIDI Learn')));
}
function openInstr(t){
  const body=h('div');const w=makeWin(t.id+':instr',(t.type==='synth'?'Synthé':'Drum Machine')+' — '+t.name,body);if(!w)return;
  if(t.type==='synth'){const sel=h('select',{onchange:e=>{snapshot();t.instr=deep(SYNTH_PRESETS[e.target.value]);t.preset=e.target.value;refreshInstrWin(t);renderInspector()}},Object.keys(SYNTH_PRESETS).map(n=>h('option',{value:n,selected:n===t.preset},n)));
    body.append(h('div',{class:'row'},'Son : ',sel,h('span',{style:{color:'var(--dim)',fontSize:'11px'}},'Jouez avec 🎹 (clavier de l’ordi) ou un clavier MIDI')));
    const ks=h('div',{class:'knobs',style:{maxWidth:'560px'}});for(const d of SYNTH_PARAMS){const dd=Object.assign({},d);if(!d.opts)dd.def=undefined;
      ks.append(knob(dd,()=>t.instr[d.id],v=>{t.instr[d.id]=d.opts&&d.id!=='mono'?d.opts[v]:v},{key:'i|'+t.id+'|'+d.id,w:d.opts?90:62,color:'#30d158'}))}body.append(ks)}
  else{const k=t.instr;const sel=h('select',{onchange:e=>{snapshot();t.instr=deep(DRUM_KITS[e.target.value]);t.kit=e.target.value;refreshInstrWin(t);renderInspector()}},Object.keys(DRUM_KITS).map(n=>h('option',{value:n,selected:n===t.kit},n)));
    body.append(h('div',{class:'row'},'Kit : ',sel));
    const g=h('div',{class:'knobs'});
    g.append(knob({n:'Note du 808',min:24,max:48,step:1,def:36},()=>k.note,v=>k.note=v,{w:70}),knob({n:'Saturation 808',min:0,max:1,def:.35},()=>k.drive,v=>k.drive=v,{w:70}),knob({n:'Swing',min:0,max:.5,def:0},()=>k.swing||0,v=>k.swing=v,{w:70}));
    body.append(g);
    const tb=h('div',{style:{display:'grid',gridTemplateColumns:'90px repeat(3,64px)',gap:'2px 6px',alignItems:'center',justifyContent:'center',marginTop:'8px'}});
    tb.append(h('b',null,''),h('b',null,'Niveau'),h('b',null,'Accord'),h('b',null,'Durée'));
    for(const [row,n,c] of DRUM_ROWS){const r=k[row];tb.append(h('div',{style:{color:c,cursor:'pointer'},onclick:()=>E.noteOn(t,60+DRUM_ROWS.findIndex(x=>x[0]===row),.9)},'▶ '+n),
      knob({n:'',min:0,max:1.2,def:.8},()=>r.lvl,v=>r.lvl=v,{size:28,color:c}),knob({n:'',min:-12,max:12,step:1,def:0,u:'dt'},()=>r.tune,v=>r.tune=v,{size:28,color:c}),knob({n:'',min:.02,max:3,def:.3,u:'s',log:1},()=>r.dec,v=>r.dec=v,{size:28,color:c}))}
    body.append(tb)}
}
function refreshInstrWin(t){const k=t.id+':instr';if(WINS[k]){const l=WINS[k].el.style.left,tp=WINS[k].el.style.top;WINS[k].el.remove();delete WINS[k];openInstr(t);WINS[k].el.style.left=l;WINS[k].el.style.top=tp}}
// ---- panneau du bas ----
let PR={edit:false,ppb:70,rowH:13,lo:24,hi:100,sel:new Set(),lastLen:.5},EDIT=null;
function openEditorFor(t,r,force){if(t.type==='audio')return;EDIT={t:t.id,r:r.id};const want=t.type==='synth'?'piano':'steps';if(force||TAB==='piano'||TAB==='steps'){TAB=want;$('#bottom').classList.add('open');renderBottom()}}
function setTab(tab){if(TAB===tab&&$('#bottom').classList.contains('open')){$('#bottom').classList.remove('open');TAB=null}else{TAB=tab;$('#bottom').classList.add('open')}renderBottom();setTimeout(drawRuler,10)}
function renderBottom(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===TAB));
  const C=$('#bcontent');C.innerHTML='';if(!TAB||!$('#bottom').classList.contains('open'))return;
  if(TAB==='mixer')return renderMixer(C);
  const fr=EDIT&&findRegion(EDIT.r);const t=fr&&fr[0],r=fr&&fr[1];
  if(TAB==='piano'){if(!r||t.type!=='synth')return C.append(h('div',{style:{padding:'20px',color:'var(--dim)'}},'Sélectionnez (ou double-cliquez pour créer) une région MIDI sur une piste 🎹 Instrument.'));return renderPiano(C,t,r)}
  if(TAB==='steps'){if(!r||t.type!=='drums')return C.append(h('div',{style:{padding:'20px',color:'var(--dim)'}},'Sélectionnez (ou double-cliquez pour créer) une région sur une piste 🥁 Batterie.'));return renderSteps(C,t,r)}
}
function renderSteps(C,t,r){
  const pat=r.pat,N=pat.steps,S=h('div',{id:'seq'});
  const ctl=h('div',{class:'seqctl'},h('b',{style:{color:t.color}},t.name+' · '+(r.name||'')),
    h('label',null,'Pas : ',h('select',{onchange:e=>{snapshot();const n=+e.target.value;for(const k in pat.rows){const a=pat.rows[k];pat.rows[k]=Array.from({length:n},(_,i)=>a[i%a.length]?deep(a[i%a.length]):0)}pat.steps=n;renderBottom();renderLanes()}},[8,16,32,64].map(n=>h('option',{value:n,selected:n===N},n+(n===16?' (1 mesure)':n===32?' (2 mesures)':n===64?' (4 mesures)':'')) ))),
    h('button',{onclick:()=>{snapshot();for(const k in pat.rows)pat.rows[k].fill(0);renderBottom();renderLanes()}},'Effacer'),
    h('button',{title:'Génère des hi-hats trap avec roulements',onclick:()=>{snapshot();const a=pat.rows.hat;for(let i=0;i<N;i++){a[i]=i%2===0?{v:i%4===0?.85:.65,r:1}:0;if(Math.random()<.18)a[i]={v:.6,r:[2,3,4][Math.random()*3|0]}}renderBottom();renderLanes()}},'🎲 Hi-hats trap'),
    h('button',{onclick:()=>openInstr(t)},'🥁 Réglages du kit'),
    h('span',{style:{color:'var(--dim)',fontSize:'11px'}},IS_TOUCH?'Toucher = poser/retirer · appui long = roulement x2/x3/x4':'Clic = poser/retirer · clic droit = roulement x2/x3/x4 · Maj+clic = vélocité'));
  S.append(ctl);
  for(const [row,name,col] of DRUM_ROWS){const line=h('div',{class:'seqrow'},h('div',{class:'rn',style:{color:col},onclick:()=>E.noteOn(t,60+DRUM_ROWS.findIndex(x=>x[0]===row),.9)},'▶ '+name));
    for(let i=0;i<N;i++){const c=pat.rows[row][i];const st=h('div',{class:'step'+(c?' on':'')+(i%4===0&&i?' q':''),'data-i':i,style:{'--c':col,opacity:c?.4+c.v*.6:1}},c&&c.r>1?h('b',null,'x'+c.r):null);
      st.addEventListener('pointerdown',e=>{if(e.button===2)return;e.preventDefault();snapshot();const cur=pat.rows[row][i];
        if(e.shiftKey&&cur){cur.v=cur.v>.9?.6:cur.v>.5?.35:1}else pat.rows[row][i]=cur?0:{v:.85,r:1};
        if(pat.rows[row][i]&&!E.playing)E.noteOn(t,60+DRUM_ROWS.findIndex(x=>x[0]===row),pat.rows[row][i].v);renderBottom();renderLanes()});
      st.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();snapshot();const cur=pat.rows[row][i];pat.rows[row][i]={v:cur?cur.v:.75,r:cur&&cur.r<4?(cur.r||1)+1:cur&&cur.r>=4?1:2};renderBottom();renderLanes()});line.append(st)}
    S.append(line)}
  C.append(S);
}
function renderPiano(C,t,r){
  const wrap=h('div',{id:'proll'}),keys=h('canvas',{id:'prKeys'}),kw=h('div',{id:'prKeysWrap'},keys),sc=h('div',{id:'prScroll'}),cv=h('canvas',{id:'prCanvas'});
  const top=h('div',{class:'seqctl',style:{padding:'4px 8px',margin:0}},h('b',{style:{color:t.color}},t.name+' · '+(r.name||'')),
    h('label',null,'Longueur (temps) ',h('input',{type:'number',min:1,max:256,value:r.len,style:{width:'56px'},onchange:e=>{snapshot();r.len=Math.max(1,+e.target.value);renderLanes();renderBottom()}})),
    h('button',{onclick:()=>{snapshot();const q=P.settings.snap||.25;(PR.sel.size?r.notes.filter((n,i)=>PR.sel.has(i)):r.notes).forEach(n=>n.s=Math.round(n.s/q)*q);draw();renderLanes()}},'Quantifier'),
    h('button',{onclick:()=>tr(1)},'+1 demi-ton'),h('button',{onclick:()=>tr(-1)},'−1'),h('button',{onclick:()=>tr(12)},'+octave'),h('button',{onclick:()=>tr(-12)},'−octave'),
    h('button',{class:'prmode'+(PR.edit?' on':''),onclick:e=>{PR.edit=!PR.edit;e.target.classList.toggle('on',PR.edit);e.target.textContent=PR.edit?'✏️ Écrire':'✋ Défiler';cv.style.touchAction=PR.edit?'none':'pan-x pan-y'}},PR.edit?'✏️ Écrire':'✋ Défiler'),
    h('button',{onclick:()=>openInstr(t)},'🎹 Son'),h('span',{style:{color:'var(--dim)',fontSize:'11px'}},IS_TOUCH?'✏️ puis toucher = note · glisser = déplacer · bord droit = durée · double-tap = effacer':'Clic = note · glisser = déplacer · bord droit = durée · double-clic/clic droit = effacer · Ctrl+molette = zoom'));
  function tr(d){snapshot();(PR.sel.size?r.notes.filter((n,i)=>PR.sel.has(i)):r.notes).forEach(n=>n.p=clamp(n.p+d,0,127));draw();renderLanes()}
  const box=h('div',{style:{display:'flex',flexDirection:'column',height:'100%'}},top,wrap);wrap.style.flex='1';wrap.style.minHeight='0';
  wrap.append(kw,sc);sc.append(cv);C.append(box);
  const rows=PR.hi-PR.lo+1,H=rows*PR.rowH;
  function draw(){
    const W=Math.max(r.len+8,16)*PR.ppb,dp=window.devicePixelRatio||1;cv.width=Math.round(W*dp);cv.height=Math.round(H*dp);cv.style.width=W+'px';cv.style.height=H+'px';const g=cv.getContext('2d');g.setTransform(dp,0,0,dp,0,0);
    for(let i=0;i<rows;i++){const p=PR.hi-i,bk=[1,3,6,8,10].includes(p%12);g.fillStyle=bk?'#222225':'#2b2b2f';g.fillRect(0,i*PR.rowH,W,PR.rowH);if(p%12===0){g.fillStyle='#3a3a40';g.fillRect(0,(i+1)*PR.rowH-1,W,1)}}
    const q=P.settings.snap||.25;for(let b=0;b*PR.ppb<W;b+=q){const x=Math.round(b*PR.ppb);g.fillStyle=b%P.sig===0?'#555':Math.abs(b-Math.round(b))<1e-6?'#3d3d42':'#2f2f33';g.fillRect(x,0,1,H)}
    g.fillStyle='rgba(0,0,0,.4)';g.fillRect(r.len*PR.ppb,0,W,H);
    r.notes.forEach((n,i)=>{const x=n.s*PR.ppb,y=(PR.hi-n.p)*PR.rowH,w=Math.max(4,n.l*PR.ppb-1);g.fillStyle=PR.sel.has(i)?'#fff':shade(t.color,.7+(n.v??.8)*.6);g.fillRect(x,y+1,w,PR.rowH-2);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x+w-3,y+1,3,PR.rowH-2)});
    const kg=keys.getContext('2d');keys.width=Math.round(52*dp);keys.height=Math.round(H*dp);keys.style.width='52px';keys.style.height=H+'px';kg.setTransform(dp,0,0,dp,0,0);
    for(let i=0;i<rows;i++){const p=PR.hi-i,bk=[1,3,6,8,10].includes(p%12);kg.fillStyle=bk?'#111':'#e8e8e8';kg.fillRect(0,i*PR.rowH,bk?34:52,PR.rowH-1);if(p%12===0){kg.fillStyle='#555';kg.font='9px sans-serif';kg.fillText(NOTE_NAMES[0]+(p/12-1),36,i*PR.rowH+PR.rowH-3)}}
  }
  draw();sc.addEventListener('scroll',()=>{keys.style.transform=`translateY(${-sc.scrollTop}px)`});
  if(PR.region!==r.id||PR.scrollTop==null){const ps=r.notes.map(n=>n.p);const c=ps.length?(Math.max(...ps)+Math.min(...ps))/2:60;PR.scrollTop=Math.max(0,(PR.hi-c)*PR.rowH-120);PR.sel.clear()}requestAnimationFrame(()=>{sc.scrollTop=PR.scrollTop;keys.style.transform=`translateY(${-sc.scrollTop}px)`});sc.addEventListener('scroll',()=>PR.scrollTop=sc.scrollTop);
  keys.addEventListener('pointerdown',e=>{const p=PR.hi-Math.floor((e.offsetY)/PR.rowH);E.noteOn(t,p,.8);setTimeout(()=>E.noteOff(t,p),300)});
  const hit=(x,y)=>{const b=x/PR.ppb,p=PR.hi-Math.floor(y/PR.rowH);for(let i=r.notes.length-1;i>=0;i--){const n=r.notes[i];if(n.p===p&&b>=n.s&&b<n.s+n.l)return i}return -1};
  let dr=null;const preview=p=>{E.noteOn(t,p,.7);setTimeout(()=>E.noteOff(t,p),180)};
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.style.touchAction=IS_TOUCH&&!PR.edit?'pan-x pan-y':'none';let lastTap=null;
  cv.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!PR.edit)return;const x=e.offsetX,y=e.offsetY,i=hit(x,y),q=P.settings.snap||.25;
    if(e.pointerType!=='mouse'&&i>=0){const now=Date.now();if(lastTap&&lastTap.i===i&&now-lastTap.t<350){snapshot();r.notes.splice(i,1);PR.sel.clear();lastTap=null;draw();renderLanes();return}lastTap={i,t:now}}
    if(e.button===2){if(i>=0){snapshot();r.notes.splice(i,1);PR.sel.clear();draw();renderLanes()}return}
    snapshot();let idx=i;
    if(i<0){const b=Math.floor(x/PR.ppb/q)*q,p=PR.hi-Math.floor(y/PR.rowH);r.notes.push({p,s:b,l:PR.lastLen,v:.8});idx=r.notes.length-1;preview(p);PR.sel=new Set([idx])}
    else if(!PR.sel.has(i)){PR.sel=e.shiftKey?new Set([...PR.sel,i]):new Set([i]);preview(r.notes[i].p)}
    const n=r.notes[idx],edge=x>(n.s+n.l)*PR.ppb-7;
    dr={idx,edge,x0:x,y0:y,orig:[...PR.sel].map(j=>({j,s:r.notes[j].s,p:r.notes[j].p,l:r.notes[j].l}))};cv.setPointerCapture(e.pointerId);draw()});
  cv.addEventListener('pointermove',e=>{const n0=hit(e.offsetX,e.offsetY);if(!dr){cv.style.cursor=n0>=0&&e.offsetX>(r.notes[n0].s+r.notes[n0].l)*PR.ppb-7?'ew-resize':'default';return}
    const q=P.settings.snap||.25,db=(e.offsetX-dr.x0)/PR.ppb,dp=-Math.round((e.offsetY-dr.y0)/PR.rowH);
    for(const o of dr.orig){const n=r.notes[o.j];if(dr.edge){n.l=Math.max(q/2,Math.round((o.l+db)/q)*q||q);PR.lastLen=n.l}else{n.s=Math.max(0,Math.round((o.s+db)/q)*q);const np=clamp(o.p+dp,0,127);if(np!==n.p&&o.j===dr.idx)preview(np);n.p=np}}draw()});
  cv.addEventListener('pointerup',()=>{if(dr){dr=null;renderLanes()}});
  cv.addEventListener('dblclick',e=>{const i=hit(e.offsetX,e.offsetY);if(i>=0){r.notes.splice(i,1);PR.sel.clear();draw();renderLanes()}});
  sc.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();PR.ppb=clamp(PR.ppb*(e.deltaY<0?1.15:.87),15,400);draw()}},{passive:false});
  PR.draw=draw;PR.region=r.id;
}
// ---- transport ----
function play(){if(REC)return stopRecord();if(E.playing){PH=E.pos();E.stop();return}ctx.resume();E.play(PH)}
function stopBtn(){if(REC)return stopRecord();if(E.playing){E.stop();}else{PH=P.cycle.on?P.cycle.start:0}updatePlayhead(PH);drawRuler()}
function setPH(b){PH=Math.max(0,b);if(E.playing){E.stop();E.play(PH)}updatePlayhead(PH);drawRuler()}
async function toggleArm(t){t.arm=!t.arm;if(t.arm){try{await E.openMic(P.settings.inputDev)}catch(e){t.arm=false;micError(e)}}renderHeads();rerenderStrips()}
async function toggleMon(t){t.mon=!t.mon;if(t.mon){try{await E.openMic(P.settings.inputDev);E.setMonitor(t,true);toast('Écoute du micro activée : utilisez un casque !')}catch(e){t.mon=false;micError(e)}}else E.setMonitor(t,false);renderHeads()}
function micError(e){console.error(e);modal([h('h2',null,'Micro inaccessible'),h('p',null,'Le navigateur n’a pas pu ouvrir le micro ('+(e.name||e.message)+').'),h('ul',null,h('li',null,'Cliquez sur l’icône 🔒 ou 🎤 à gauche de la barre d’adresse et autorisez le micro.'),h('li',null,'Vérifiez que le micro est branché et choisi dans ⚙ Réglages.'),h('li',null,'Fermez les autres logiciels qui utilisent le micro (Discord, etc.).'))])}
async function toggleRecord(){
  if(REC)return stopRecord();
  let armed=P.tracks.filter(t=>t.type==='audio'&&t.arm&&!isInstru(t));
  if(!armed.length){let t=findTrack(SEL);if(!t||t.type!=='audio'||isInstru(t)){t=P.tracks.find(x=>x.type==='audio'&&!isInstru(x));}if(!t){addTrack('audio');t=findTrack(SEL)}t.arm=true;armed=[t];renderHeads()}
  try{await E.openMic(P.settings.inputDev)}catch(e){armed.forEach(t=>t.arm=false);renderHeads();return micError(e)}
  if(E.playing){PH=E.pos();E.stop()}
  REC={start:PH,tracks:armed.map(t=>t.id)};$('#bRec').classList.add('recon');
  E.startRec(PH,(P.settings.countIn|0)*P.sig);
}
function stopRecord(){
  const r=REC;REC=false;$('#bRec').classList.remove('recon');document.querySelectorAll('.recLive').forEach(x=>x.remove());
  const buf=E.stopRec();if(!buf){toast('Prise trop courte');return}
  snapshot();const id=addBuffer(buf);let n=0;
  for(const tid of r.tracks){const t=findTrack(tid);if(!t)continue;n=t.regions.length+1;carve(t,r.start,r.start+buf.duration/spb());t.regions.push({id:uid('r'),start:r.start,offset:0,dur:buf.duration,buf:id,name:'Prise '+n})}
  PH=r.start;renderLanes();toast('Prise enregistrée ('+buf.duration.toFixed(1)+' s). Ctrl+Z pour l’annuler.');
}
// ---- fichiers ----
async function importAudio(files,atBeat,trackId){
  for(const f of files){try{toast('Import de '+f.name+'…');const ab=await f.arrayBuffer(),b=await ctx.decodeAudioData(ab);const id=addBuffer(b);snapshot();
    const instru=INSTRU_MODE;INSTRU_MODE=false;let t=!instru&&trackId&&findTrack(trackId);if(t&&!isInstru(t))t=null;
    if(!t){t=newTrack('audio',instru?'Instru':f.name.replace(/\.[^.]+$/,'').slice(0,24));t.role='instru';t.color='#e6c200';t.plugins=[];t.sends=P.auxes.map(()=>-60);t.vol=-5;P.tracks.splice(P.tracks.filter(isInstru).length,0,t);E.build(P)}
    const r={id:uid('r'),start:instru?0:(atBeat!=null?atBeat:0),offset:0,dur:b.duration,buf:id,name:f.name};t.regions.push(r);SEL=t.id;SELR=new Set([r.id]);renderAll();
    if(instru||b.duration>30)analyzeRegion(t,r,true);else toast('Importé : '+f.name)}
  catch(e){console.error(e);toast('Format non lu : '+f.name)}}
}
function saveProject(){
  const used=new Set();for(const t of P.tracks)if(t.type==='audio')for(const r of t.regions)used.add(r.buf);
  const meta=[],parts=[];for(const id of used){const b=BUFS[id];if(!b)continue;meta.push({id,sr:b.sampleRate,ch:b.numberOfChannels,len:b.length});for(let c=0;c<b.numberOfChannels;c++)parts.push(b.getChannelData(c))}
  for(const k in EXT_SRC)P.ext[k]=EXT_SRC[k];
  const js=new TextEncoder().encode(JSON.stringify({v:1,project:P,buffers:meta})),hd=new Uint32Array([0x53545544,js.length]),pad=new Uint8Array((4-js.length%4)%4);
  download(new Blob([hd,js,pad,...parts]),(P.name||'projet').replace(/[^\w\- àâéèêëîïôûùç]/gi,'_')+'.studio');DIRTY=false;toast('Projet enregistré (fichier .studio dans vos téléchargements)');
}
async function openProject(f){
  try{const ab=await f.arrayBuffer(),hd=new Uint32Array(ab,0,2);if(hd[0]!==0x53545544)throw new Error('Ce n’est pas un fichier .studio');
    const len=hd[1],j=JSON.parse(new TextDecoder().decode(new Uint8Array(ab,8,len)));let off=8+len+(4-len%4)%4;
    for(const m of j.buffers){const b=ctx.createBuffer(m.ch,m.len,m.sr);for(let c=0;c<m.ch;c++){b.copyToChannel(new Float32Array(ab.slice(off,off+m.len*4)),c);off+=m.len*4}addBuffer(b,m.id)}
    for(const k in (j.project.ext||{}))try{loadExternalPlugin(j.project.ext[k])}catch(e){console.warn(e)}
    E.stop();P=j.project;P.midiMap=P.midiMap||{};P.ext=P.ext||{};UNDO=[];REDO=[];PH=0;SEL=P.tracks[0]&&P.tracks[0].id;SELR.clear();EDIT=null;afterLoad();DIRTY=false;toast('Projet ouvert : '+P.name)}
  catch(e){console.error(e);alert('Impossible d’ouvrir : '+e.message)}
}
async function exportMix(mode,fmt){fmt=fmt||'wav';
  if(E.playing)E.stop();const ends=P.tracks.flatMap(t=>t.regions.map(r=>r.start+rLen(t,r)));if(!ends.length)return toast('Rien à exporter');
  let a=0,b=Math.max(...ends);if(mode==='cycle'){if(!P.cycle.on)return toast('Activez le cycle (C) pour définir la zone');a=P.cycle.start;b=P.cycle.end}
  const base=(P.name||'morceau').replace(/[^\w\- ]/g,'_'),t0=performance.now();let where='dl';
  const doOne=async(pr,name,i,n)=>{const tag=n>1?' '+i+'/'+n:'';toast('Export'+tag+' : calcul du son… ('+name+')',600000);const buf=await renderMix(pr,a,b);
    let blob;if(fmt==='mp3')blob=await encodeMP3(buf,320,p=>toast('Export'+tag+' : MP3 '+Math.round(p*100)+' %',600000));else blob=wavEncode(buf);
    where=await saveOut(blob,name+'.'+fmt)};
  try{if(mode==='stems'){const ts=P.tracks.filter(t=>t.regions.length);let i=0;
      // stem : on ne calcule que la piste visée (+ ses bus d'effets), pas tout le projet
      for(const t of ts){const pr=deep(P);pr.tracks=pr.tracks.filter(x=>x.id===t.id);pr.tracks.forEach(x=>{x.solo=false;x.mute=false});await doOne(pr,base+' - '+t.name,++i,ts.length)}}
    else await doOne(P,base+(mode==='cycle'?' (cycle)':''),1,1);
    toast('Export terminé ✔ en '+Math.round((performance.now()-t0)/1000)+' s ('+(where==='dossier'?'dossier d’enregistrement / Exports':'dossier Téléchargements')+')',6000)}
  catch(e){console.error(e);toast('Erreur d’export : '+e.message,6000)}
}
const PLUGIN_TEMPLATE=`// Modèle de plugin externe pour Studio
// 1) Copiez ce fichier, changez id/name/params et le traitement dans create()
// 2) Dans l'appli : slot "+ effet" → "Charger un plugin externe (.js)"
// create(ctx) doit renvoyer { input, output, set(params), dispose() } avec des nœuds Web Audio.
// Outils fournis : dbToG(dB), makeCurve(drive, 'doux'|'tube'|'dur'), noiseBuf(ctx)
registerPlugin({
  id: 'tremolo',
  name: 'Trémolo (exemple)',
  params: [
    { id: 'rate',  n: 'Vitesse',    min: 0.5, max: 20,  def: 5,  u: 'Hz', log: 1 },
    { id: 'depth', n: 'Profondeur', min: 0,   max: 100, def: 60, u: '%' },
    { id: 'shape', n: 'Forme', opts: ['Sinus', 'Carré', 'Triangle'], def: 0 }
  ],
  create(ctx) {
    const amp = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.connect(depth); depth.connect(amp.gain); lfo.start();
    return {
      input: amp, output: amp,
      set(p) {
        lfo.type = ['sine', 'square', 'triangle'][p.shape | 0];
        lfo.frequency.value = p.rate;
        depth.gain.value = p.depth / 200;
        amp.gain.value = 1 - p.depth / 200;
      },
      dispose() { lfo.stop(); }
    };
  }
});
`;
