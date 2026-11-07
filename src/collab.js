// ===== v3.0 : session à plusieurs (document partagé Yjs) + cadenas =====
// Principe : P reste le modèle local utilisé par toute l'interface. Un pont compare P à l'état partagé
// (toutes les 100 ms et avant chaque snapshot) et écrit la différence dans le Y.Doc. Les modifications
// des autres sont appliquées « en place » dans P (mêmes objets), puis l'interface est redessinée.
// Transport v3.0 : BroadcastChannel (fenêtres/onglets du même navigateur). v3.1 : serveur réseau.
const LOCK_IDLE=120000,LOCAL_ORIGIN={local:true};
const SKIP_ROOT=['settings','midiMap','ext','cycle'],SKIP_TRACK=['arm','mon','solo']; // réglages propres à chacun
const ME={id:uid('u'),name:'',color:''};
try{const u=JSON.parse(localStorage.getItem('studio_user')||'{}');ME.name=u.name||'';ME.color=u.color||''}catch(e){}
if(!ME.color)ME.color=PALETTE[Math.random()*PALETTE.length|0];
const COLLAB={on:false,synced:false,room:null,doc:null,root:null,locks:null,um:null,ch:null,last:null,lastStr:'',
  queue:[],peers:{},waiting:{},lockSeen:{},bufWait:{},timers:[],pRef:null,projDirty:false,lockDirty:false,tT:0};
let LAST_INPUT=Date.now(),POINTER_DOWN=false;

// ---- outils de données ----
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function deepEq(a,b){if(a===b)return true;if(typeof a!=='object'||typeof b!=='object'||!a||!b)return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  if(Array.isArray(a)){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!deepEq(a[i],b[i]))return false;return true}
  const ka=Object.keys(a);if(ka.length!==Object.keys(b).length)return false;for(const k of ka)if(!(k in b)||!deepEq(a[k],b[k]))return false;return true}
const idArr=x=>x.length>0&&x.every(e=>isObj(e)&&typeof e.id==='string')&&new Set(x.map(e=>e.id)).size===x.length;
function sharedView(p){const o={};for(const k in p)if(!SKIP_ROOT.includes(k))o[k]=p[k];
  o.tracks=(p.tracks||[]).map(t=>{const c={};for(const k in t)if(!SKIP_TRACK.includes(k))c[k]=t[k];return c});return o}
function toY(v){if(Array.isArray(v)){const a=new Y.Array();a.push(v.map(toY));return a}
  if(isObj(v)){const m=new Y.Map();for(const k in v)m.set(k,toY(v[k]));return m}return v}
// écrit dans le Y.Map `ym` (qui reflète `o`) ce qu'il faut pour obtenir `n`
function yObj(ym,o,n){for(const k in o)if(!(k in n))ym.delete(k);
  for(const k in n){const a=o[k],b=n[k];if(deepEq(a,b))continue;const cur=ym.get(k);
    if(isObj(a)&&isObj(b)&&cur instanceof Y.Map)yObj(cur,a,b);
    else if(Array.isArray(a)&&Array.isArray(b)&&cur instanceof Y.Array)yArr(cur,a,b);
    else ym.set(k,toY(b))}}
function yArr(ya,o,n){
  if(idArr(o)&&idArr(n)){ // pistes, régions… : réconciliation par identifiant
    const keep=new Set(n.map(e=>e.id)),cur=o.slice();
    for(let i=cur.length-1;i>=0;i--)if(!keep.has(cur[i].id)){ya.delete(i,1);cur.splice(i,1)}
    for(let i=0;i<n.length;i++){const e=n[i];
      if(cur[i]&&cur[i].id===e.id){if(!deepEq(cur[i],e))yObj(ya.get(i),cur[i],e);continue}
      const j=cur.findIndex((x,k)=>k>i&&x.id===e.id);if(j>=0){ya.delete(j,1);cur.splice(j,1)}
      ya.insert(i,[toY(e)]);cur.splice(i,0,e)}
    return}
  let s=0;while(s<o.length&&s<n.length&&deepEq(o[s],n[s]))s++;
  let e=0;while(e<o.length-s&&e<n.length-s&&deepEq(o[o.length-1-e],n[n.length-1-e]))e++;
  const om=o.length-s-e,nm=n.slice(s,n.length-e);
  if(om===nm.length){for(let i=0;i<om;i++){const a=o[s+i],b=nm[i],cur=ya.get(s+i);
      if(isObj(a)&&isObj(b)&&cur instanceof Y.Map)yObj(cur,a,b);else if(Array.isArray(a)&&Array.isArray(b)&&cur instanceof Y.Array)yArr(cur,a,b);
      else{ya.delete(s+i,1);ya.insert(s+i,[toY(b)])}}return}
  if(om)ya.delete(s,om);if(nm.length)ya.insert(s,nm.map(toY))}
// applique `b` dans l'objet local `a` en gardant l'identité des objets (fenêtres et boutons ouverts restent branchés)
function patchVal(a,b){
  if(Array.isArray(a)&&Array.isArray(b)){let out;
    if(idArr(b)&&a.every(isObj)){const by=new Map(a.filter(x=>x.id).map(x=>[x.id,x]));out=b.map(e=>by.has(e.id)?patchObj(by.get(e.id),e):e)}
    else out=b.map((e,i)=>i<a.length?patchVal(a[i],e):e);
    a.length=0;a.push(...out);return a}
  if(isObj(a)&&isObj(b))return patchObj(a,b);return b}
function patchObj(a,b,keep){for(const k of Object.keys(a))if(!(k in b)&&!(keep&&keep.includes(k)))delete a[k];for(const k in b)a[k]=patchVal(a[k],b[k]);return a}
function patchRoot(s){
  for(const k of Object.keys(P))if(!(k in s)&&!SKIP_ROOT.includes(k))delete P[k];
  for(const k in s)if(k!=='tracks')P[k]=patchVal(P[k],s[k]);
  const by=new Map(P.tracks.map(t=>[t.id,t]));
  const nt=(s.tracks||[]).map(st=>by.has(st.id)?patchObj(by.get(st.id),st,SKIP_TRACK):Object.assign({arm:false,mon:false,solo:false},st));
  for(const t of P.tracks)if(!nt.includes(t))try{E.setMonitor(t,false)}catch(e){}
  P.tracks.length=0;P.tracks.push(...nt)}
function setBase(){COLLAB.lastStr=JSON.stringify(sharedView(P));COLLAB.last=JSON.parse(COLLAB.lastStr);COLLAB.pRef=P}
const sigAll=p=>[...p.tracks,...p.auxes,p.master].map(o=>o.id+':'+(o.plugins||[]).map(x=>x.type).join(',')+':'+o.type).join('|');

// ---- cadenas ----
function lockOf(k){const L=COLLAB.locks&&COLLAB.locks.get(k);if(!L)return null;
  if(L.u!==ME.id&&Date.now()-(COLLAB.lockSeen[k]||0)>LOCK_IDLE)return null;return L} // expiré si plus de nouvelles du propriétaire
const lockedByOther=k=>{const L=COLLAB.on&&lockOf(k);return L&&L.u!==ME.id?L:null};
function lockTargets(p){const m={};for(const t of p.tracks||[])m[t.id]=t;for(const a of p.auxes||[])m[a.id]=a;if(p.master)m.master=p.master;
  m.proj={name:p.name,bpm:p.bpm,sig:p.sig,key:p.key,scaleIdx:p.scaleIdx};return m}
function lockLabel(k){if(k==='proj')return'Tempo / tonalité';const o=findObj(k)||(COLLAB.last&&lockTargets(COLLAB.last)[k]);return o&&o.name||'Piste'}
function lockedChange(o,n){const A=lockTargets(o),B=lockTargets(n);
  for(const k in A){const L=lockedByOther(k);if(L&&!deepEq(A[k],B[k]))return{k,L}}return null}
function lockToast(k,L){const t=Date.now();if(t-COLLAB.tT<1500)return;COLLAB.tT=t;
  toast('🔒 « '+lockLabel(k)+' » est verrouillé par '+L.n+'. Libéré quand '+L.n+' le retire ou après 2 min sans activité.',4000)}
function toggleLock(k){
  if(!COLLAB.on)return toast('Les cadenas servent en session à plusieurs : ☰ Fichier → 👥 Session à plusieurs');
  if(!COLLAB.synced)return toast('Connexion à la session en cours…');
  const L=lockOf(k);if(L&&L.u!==ME.id)return lockToast(k,L);
  collabFlush();COLLAB.doc.transact(()=>{if(L)COLLAB.locks.delete(k);else COLLAB.locks.set(k,{u:ME.id,n:ME.name||'Quelqu’un',c:ME.color,t:Date.now()})},'lock');
  toast(L?'🔓 « '+lockLabel(k)+' » libéré':'🔒 « '+lockLabel(k)+' » verrouillé : les autres ne peuvent plus le modifier');decorateLocks()}
function myLocks(){return COLLAB.locks?[...COLLAB.locks.entries()].filter(([,L])=>L.u===ME.id):[]}
function releaseMyLocks(){const m=myLocks();if(m.length&&COLLAB.doc)COLLAB.doc.transact(()=>m.forEach(([k])=>COLLAB.locks.delete(k)),'lock')}

// ---- pont P ↔ document partagé ----
function collabFlush(){
  if(!COLLAB.on||!COLLAB.synced||!P)return;
  if(P!==COLLAB.pRef){collabStop();toast('Vous avez ouvert un autre projet : vous avez quitté la session',4500);return}
  const str=JSON.stringify(sharedView(P));if(str===COLLAB.lastStr)return;
  const n=JSON.parse(str),o=COLLAB.last,bad=lockedChange(o,n);
  if(bad){revertToDoc();lockToast(bad.k,bad.L);return}
  COLLAB.doc.transact(()=>{try{yObj(COLLAB.root,o,n)}catch(e){console.warn('Session : resynchronisation complète',e);
    for(const k of [...COLLAB.root.keys()])if(!(k in n))COLLAB.root.delete(k);for(const k in n)COLLAB.root.set(k,toY(n[k]))}},LOCAL_ORIGIN);
  COLLAB.last=n;COLLAB.lastStr=str}
function revertToDoc(){patchRoot(COLLAB.root.toJSON());setBase();collabRefresh(true)}
function pullFromDoc(){const s0=sigAll(P);patchRoot(COLLAB.root.toJSON());setBase();collabRefresh(s0!==sigAll(P));fetchMissingBufs()}
function collabRefresh(structural){
  if(structural)closeAllPlugins();
  const keepScroll=['#insp','#prScroll','#bcontent'].map(s=>{const e=$(s);return e&&[s,e.scrollTop,e.scrollLeft]}).filter(Boolean);
  E.build(P);if(!findTrack(SEL))SEL=P.tracks[0]&&P.tracks[0].id;SELR=new Set([...SELR].filter(id=>findRegion(id)));
  if(EDIT&&!findRegion(EDIT.r))EDIT=null;renderAll();
  for(const k in KNOBS)try{KNOBS[k]()}catch(e){}
  for(const [s,t,l] of keepScroll){const e=$(s);if(e){e.scrollTop=t;e.scrollLeft=l}}}
function busy(){if(POINTER_DOWN||REC)return true;const a=document.activeElement;
  return !!a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.type!=='range'&&Date.now()-LAST_INPUT<3000}
function scheduleApply(d){clearTimeout(COLLAB.applyT);COLLAB.applyT=setTimeout(applyQueued,d||30)}
function applyQueued(){
  if(!COLLAB.on||!COLLAB.synced)return;if(!COLLAB.queue.length&&!COLLAB.lockDirty)return;
  if(busy())return scheduleApply(150);
  collabFlush();if(!COLLAB.on)return;
  const q=COLLAB.queue;COLLAB.queue=[];COLLAB.projDirty=false;
  for(const u of q)try{Y.applyUpdate(COLLAB.doc,u,'remote')}catch(e){console.warn(e)}
  if(COLLAB.projDirty){COLLAB.projDirty=false;COLLAB.lockDirty=false;pullFromDoc()}
  else if(COLLAB.lockDirty){COLLAB.lockDirty=false;decorateLocks()}}

// ---- annuler / rétablir : chacun n'annule que ses propres actions ----
const _snapshot=snapshot,_undo=undo,_redo=redo;
snapshot=function(){if(!COLLAB.on)return _snapshot();collabFlush();if(COLLAB.um)COLLAB.um.stopCapturing();DIRTY=true};
undo=function(){if(!COLLAB.on)return _undo();collabUndo(false)};
redo=function(){if(!COLLAB.on)return _redo();collabUndo(true)};
function collabUndo(re){if(!COLLAB.synced)return;collabFlush();const um=COLLAB.um;
  if(!(re?um.canRedo():um.canUndo()))return toast(re?'Rien à rétablir':'Rien à annuler');
  const before=COLLAB.last;re?um.redo():um.undo();
  const bad=lockedChange(before,COLLAB.root.toJSON());
  if(bad){re?um.undo():um.redo();lockToast(bad.k,bad.L);return}
  pullFromDoc()}

// ---- transport (v3.0 : entre fenêtres du même navigateur) ----
function send(m){if(!COLLAB.ch)return;m.from=ME.id;m.user={id:ME.id,name:ME.name,color:ME.color};m.synced=COLLAB.synced;try{COLLAB.ch.postMessage(m)}catch(e){console.warn(e)}}
function onMsg(m){
  if(!COLLAB.on||!m||m.from===ME.id||(m.to&&m.to!==ME.id))return;
  if(m.user&&m.k!=='bye'){const was=COLLAB.peers[m.from];COLLAB.peers[m.from]={user:m.user,t:Date.now()};if(!was||was.user.name!==m.user.name||was.user.color!==m.user.color)renderPresence()}
  switch(m.k){
    case 'hello':if(COLLAB.synced)send({k:'sync',to:m.from,u:Y.encodeStateAsUpdate(COLLAB.doc,m.sv),sv:Y.encodeStateVector(COLLAB.doc)});
      else COLLAB.waiting[m.from]=Date.now();break;
    case 'sync':recvUpdate(m.u);if(COLLAB.synced&&m.sv){const d=Y.encodeStateAsUpdate(COLLAB.doc,m.sv);if(d.length>2)send({k:'up',u:d})}break;
    case 'up':recvUpdate(m.u);break;
    case 'bye':delete COLLAB.peers[m.from];renderPresence();break;
    case 'bufq':for(const id of m.ids||[])sendBuf(m.from,id);break;
    case 'buf':recvBuf(m);break;
  }}
function recvUpdate(u){
  if(!u)return;
  if(!COLLAB.synced){try{Y.applyUpdate(COLLAB.doc,u,'remote')}catch(e){console.warn(e);return}
    if(COLLAB.root.has('tracks')&&!COLLAB.adopting){COLLAB.adopting=true;clearTimeout(COLLAB.waitT);adoptDoc().finally(()=>COLLAB.adopting=false)}return}
  COLLAB.queue.push(u);scheduleApply()}
async function adoptDoc(){ // on rejoint : le projet de la session remplace l'affichage (le vôtre reste dans 📂 Mes projets)
  try{await saveLocal()}catch(e){}
  if(!COLLAB.on)return;
  const s=COLLAB.root.toJSON();E.stop();
  P=Object.assign({},s,{settings:P.settings,midiMap:P.midiMap||{},ext:P.ext||{},cycle:{on:false,start:0,end:16}});
  P.tracks.forEach(t=>{t.arm=false;t.mon=false;t.solo=false});
  PH=0;SELR.clear();EDIT=null;SEL=P.tracks[0]&&P.tracks[0].id;LAST_SAVED='';closeAllPlugins();E.build(P);
  afterSync();renderAll();fetchMissingBufs();toast('👥 Vous avez rejoint « '+P.name+' »',3500)}
function seed(){
  const v=JSON.parse(JSON.stringify(sharedView(P)));COLLAB.doc.transact(()=>{for(const k in v)COLLAB.root.set(k,toY(v[k]))},'seed');
  afterSync();renderAll()}
function afterSync(){COLLAB.synced=true;setBase();UNDO=[];REDO=[];
  COLLAB.um=new Y.UndoManager(COLLAB.root,{trackedOrigins:new Set([LOCAL_ORIGIN]),captureTimeout:1e9});
  const now=Date.now();for(const k of COLLAB.locks.keys())COLLAB.lockSeen[k]=now;renderPresence()}
function waitDone(){if(!COLLAB.on||COLLAB.synced||COLLAB.adopting)return;
  const t=Date.now(),first=Object.keys(COLLAB.waiting).filter(id=>t-COLLAB.waiting[id]<6000&&id<ME.id);
  if(first.length){COLLAB.waitT=setTimeout(waitDone,2000);return} // un autre arrivant démarre la session : on l'attend
  seed();toast('👥 Vous êtes le premier dans la session : votre projet est partagé',4000)}

// ---- sons (fichiers audio immuables, partagés par identifiant) ----
async function fetchMissingBufs(){
  if(!COLLAB.on||!P)return;const t=Date.now();
  const need=[...usedBufs(P)].filter(id=>id&&!BUFS[id]&&!(COLLAB.bufWait[id]&&t-COLLAB.bufWait[id]<6000));if(!need.length)return;
  need.forEach(id=>COLLAB.bufWait[id]=t);const ask=[];let got=0;
  for(const id of need){try{const b=await IDB.get('buffers',id);
      if(b&&!BUFS[id]){const ab=ctx.createBuffer(b.ch,b.len,b.sr);b.data.forEach((d,c)=>ab.copyToChannel(d,c));addBuffer(ab,id);SAVED_BUFS.add(id);got++;continue}}catch(e){}
    if(!BUFS[id])ask.push(id)}
  if(ask.length)send({k:'bufq',ids:ask});if(got)bufsArrived()}
function sendBuf(to,id){const b=BUFS[id];if(!b)return;const data=[];for(let c=0;c<b.numberOfChannels;c++)data.push(b.getChannelData(c).slice());
  send({k:'buf',to,id,sr:b.sampleRate,ch:b.numberOfChannels,len:b.length,data})}
function recvBuf(m){if(BUFS[m.id]||!m.data)return;const ab=ctx.createBuffer(m.ch,m.len,m.sr);m.data.forEach((d,c)=>ab.copyToChannel(d,c));addBuffer(ab,m.id);delete COLLAB.bufWait[m.id];bufsArrived()}
function bufsArrived(){clearTimeout(COLLAB.bufT);COLLAB.bufT=setTimeout(()=>{if(busy())return bufsArrived();renderLanes();if(TAB)renderBottom()},120)}

// ---- démarrer / quitter ----
function collabStart(room,host){
  if(COLLAB.on)collabStop(true);
  if(typeof Y==='undefined'||!window.BroadcastChannel)return toast('Ce navigateur ne permet pas les sessions à plusieurs');
  Object.assign(COLLAB,{on:true,synced:false,room,queue:[],peers:{},waiting:{},lockSeen:{},bufWait:{},um:null,adopting:false,projDirty:false,lockDirty:false});
  const doc=COLLAB.doc=new Y.Doc();COLLAB.root=doc.getMap('p');COLLAB.locks=doc.getMap('locks');
  doc.on('update',(u,origin)=>{if(origin!=='remote')send({k:'up',u})});
  COLLAB.root.observeDeep((ev,tr)=>{if(tr.origin==='remote')COLLAB.projDirty=true});
  COLLAB.locks.observe(ev=>{const t=Date.now();ev.keysChanged.forEach(k=>COLLAB.lockSeen[k]=t);
    if(ev.transaction.origin==='remote')COLLAB.lockDirty=true;else decorateLocks()});
  try{COLLAB.ch=new BroadcastChannel('studio-room-'+room)}catch(e){COLLAB.on=false;return toast('Session impossible ici : ouvrez l’appli depuis son adresse en ligne')}
  COLLAB.ch.onmessage=e=>onMsg(e.data);
  try{history.replaceState(null,'',location.pathname+location.search+'#room='+room)}catch(e){}
  const T=(fn,ms)=>COLLAB.timers.push(setInterval(fn,ms));
  T(collabFlush,100);
  T(()=>{send({k:'pres'});const t=Date.now();let ch=false;for(const id in COLLAB.peers)if(t-COLLAB.peers[id].t>12000){delete COLLAB.peers[id];ch=true}if(ch)renderPresence();
    fetchMissingBufs();decorateLocks()},4000);
  T(()=>{if(!COLLAB.synced)return;const m=myLocks();if(!m.length)return;const idle=Date.now()-LAST_INPUT>LOCK_IDLE;
    COLLAB.doc.transact(()=>m.forEach(([k,L])=>idle?COLLAB.locks.delete(k):COLLAB.locks.set(k,Object.assign({},L,{t:Date.now(),n:ME.name||L.n,c:ME.color}))),'lock');
    if(idle)toast('🔓 Vos cadenas ont été libérés (2 min sans activité)',4000)},20000);
  if(host)seed();else{send({k:'hello',sv:Y.encodeStateVector(doc)});COLLAB.waitT=setTimeout(waitDone,2500)}
  renderPresence()}
function collabStop(silent){
  if(!COLLAB.on)return;releaseMyLocks();send({k:'bye'});
  COLLAB.timers.forEach(clearInterval);COLLAB.timers=[];clearTimeout(COLLAB.waitT);clearTimeout(COLLAB.applyT);
  try{COLLAB.ch.close()}catch(e){}try{COLLAB.doc.destroy()}catch(e){}
  Object.assign(COLLAB,{on:false,synced:false,room:null,doc:null,root:null,locks:null,um:null,ch:null,queue:[],peers:{}});
  try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
  UNDO=[];REDO=[];renderPresence();clearLk();renderAll();if(!silent)toast('Vous avez quitté la session (le projet reste dans 📂 Mes projets)',3500)}
const roomFromHash=()=>{const m=/(?:^|[#&])room=([\w-]{4,40})/.exec(location.hash);return m&&m[1]};
const roomLink=r=>location.origin+location.pathname+'#room='+r;
function saveMe(){try{localStorage.setItem('studio_user',JSON.stringify({name:ME.name,color:ME.color}))}catch(e){}}
function askName(then){
  const inp=h('input',{type:'text',value:ME.name,placeholder:'Ton prénom ou pseudo',maxlength:20,style:{fontSize:'15px',padding:'6px 8px',width:'220px'},onkeydown:e=>{e.stopPropagation();if(e.key==='Enter')ok()}});
  let col=ME.color;const sw=h('div',{style:{display:'flex',gap:'6px',flexWrap:'wrap',margin:'8px 0'}});
  const drawSw=()=>{sw.innerHTML='';for(const c of PALETTE.slice(0,14))sw.append(h('div',{class:'swatch big'+(c===col?' cur':''),style:{background:c},onclick:()=>{col=c;drawSw()}}))};drawSw();
  const m=modal([h('h2',null,'👥 Comment tu t’appelles ?'),h('p',{style:{color:'var(--dim)'}},'Ton nom et ta couleur s’affichent chez les autres (sur tes cadenas).'),inp,sw,h('button',{style:{padding:'8px 16px'},onclick:()=>ok()},'Continuer')]);
  function ok(){const n=inp.value.trim();if(!n){inp.focus();return}ME.name=n.slice(0,20);ME.color=col;saveMe();m.remove();then()}
  setTimeout(()=>inp.focus(),50)}
function collabModal(){
  const box=h('div'),m=modal(box);
  const draw=()=>{box.innerHTML='';
    if(!COLLAB.on){box.append(h('h2',null,'👥 Session à plusieurs'),
      h('p',null,'Faites de la musique à plusieurs sur le même projet : chacun voit en direct ce que font les autres et écoute sur son propre appareil.'),
      h('p',null,'Posez un 🔒 cadenas sur une piste (en haut à droite de son nom) pour que personne d’autre ne la modifie pendant que vous travaillez dessus. Vous pouvez en poser plusieurs.'),
      h('p',{style:{color:'#ffb340',fontSize:'12px'}},'Version 3.0 (essai) : la session marche entre plusieurs fenêtres de ce navigateur, sur cet appareil. La connexion entre plusieurs ordinateurs et téléphones arrive dans la prochaine version.'),
      h('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'10px'}},
        h('button',{style:{padding:'8px 14px'},onclick:()=>{m.remove();const go=()=>{collabStart(uid('s').slice(1),true);collabModal()};ME.name?go():askName(go)}},'▶ Partager ce projet'),
        roomFromHash()&&h('button',{onclick:()=>{m.remove();const go=()=>collabStart(roomFromHash(),false);ME.name?go():askName(go)}},'Rejoindre la session du lien')));return}
    const link=roomLink(COLLAB.room),ppl=[{name:ME.name+' (vous)',color:ME.color},...Object.values(COLLAB.peers).map(p=>p.user)];
    box.append(h('h2',null,'👥 Session en cours'),
      h('div',{class:'kv2'},'Lien de la session',h('span',{style:{display:'flex',gap:'6px'}},h('input',{type:'text',readonly:true,value:link,style:{width:'260px'},onfocus:e=>e.target.select()}),
        h('button',{onclick:async()=>{try{await navigator.clipboard.writeText(link);toast('Lien copié ✔')}catch(e){toast('Sélectionnez le lien et copiez-le')}}},'Copier'))),
      h('div',{class:'kv2'},'Tester à plusieurs',h('button',{onclick:()=>window.open(link,'_blank')},'Ouvrir une 2ᵉ fenêtre')),
      h('div',{class:'kv2'},'Connectés ('+ppl.length+')',h('span',{style:{display:'flex',gap:'6px',flexWrap:'wrap'}},ppl.map(p=>h('span',{class:'chip',style:{background:p.color}},p.name||'?')))),
      h('div',{class:'kv2'},'Mon nom',h('button',{onclick:()=>{m.remove();askName(()=>{renderPresence();COLLAB.doc&&myLocks().length&&COLLAB.doc.transact(()=>myLocks().forEach(([k,L])=>COLLAB.locks.set(k,Object.assign({},L,{n:ME.name,c:ME.color}))),'lock');send({k:'pres'})})}},ME.name+' ✎')),
      h('div',{class:'kv2'},'Mes cadenas',h('span',null,myLocks().length?myLocks().map(([k])=>lockLabel(k)).join(', '):'aucun')),
      h('p',{style:{color:'var(--dim)',fontSize:'11px'}},'Un cadenas se retire en recliquant dessus, ou tout seul après 2 min sans activité (ou si vous quittez). Personne ne peut forcer le cadenas d’un autre. Ctrl+Z n’annule que vos propres actions. Restent personnels : le solo, l’armement R, le retour micro et la boucle (cycle).'),
      h('div',{style:{display:'flex',gap:'8px',marginTop:'10px'}},h('button',{onclick:()=>{m.remove();collabStop()}},'Quitter la session')))};
  draw()}
function collabBoot(){
  const r=roomFromHash();if(r){const go=()=>collabStart(r,false);ME.name?go():askName(go)}
  addEventListener('hashchange',()=>{const r=roomFromHash();if(r&&r!==COLLAB.room){const go=()=>collabStart(r,false);ME.name?go():askName(go)}});
  addEventListener('pagehide',()=>{if(COLLAB.on){releaseMyLocks();send({k:'bye'})}})}

// ---- présence + affichage des cadenas ----
function renderPresence(){let b=$('#collabBar');
  if(!COLLAB.on){if(b)b.remove();return}
  if(!b){b=h('div',{class:'grp',id:'collabBar'});const ref=$('#bSettings').parentElement;ref.parentElement.insertBefore(b,ref)}
  b.innerHTML='';const av=h('span',{class:'avs',title:'Session à plusieurs',onclick:collabModal});
  for(const p of [ME,...Object.values(COLLAB.peers).map(x=>x.user)])av.append(h('span',{class:'av',title:(p.name||'?')+(p===ME?' (vous)':''),style:{background:p.color}},(p.name||'?').slice(0,1).toUpperCase()));
  b.append(av,h('button',{class:'tbtn lkproj',title:'Cadenas sur le tempo, la mesure et la tonalité',onclick:()=>toggleLock('proj')},'🔒'));decorateLocks()}
function lockBtn(k,small){const L=lockOf(k),mine=L&&L.u===ME.id;
  return h('button',{class:'lkb'+(L?(mine?' me':' other'):''),style:L?{'--lkc':L.c}:null,'data-free':'1',
    title:L?(mine?'Verrouillé par vous : cliquer pour libérer':'Verrouillé par '+L.n):'Poser un cadenas (les autres ne pourront plus modifier)',
    onpointerdown:e=>e.stopPropagation(),onclick:e=>{e.stopPropagation();toggleLock(k)}},L?(mine?'🔒':'🔒 '+(small?'':L.n)):'🔓')}
function markLk(el,k){if(!el)return;el.dataset.lk=k;const L=lockOf(k),other=L&&L.u!==ME.id;
  el.classList.toggle('lk-other',!!other);el.classList.toggle('lk-me',!!L&&!other);if(L)el.style.setProperty('--lkc',L.c);
  el.querySelectorAll('input,select,button,textarea').forEach(x=>{if(x.dataset.free||x.classList.contains('btnS'))return;
    if(other){if(!x.disabled){x.disabled=true;x.dataset.lkdis='1'}}else if(x.dataset.lkdis){x.disabled=false;delete x.dataset.lkdis}})}
function clearLk(){document.querySelectorAll('[data-lk]').forEach(el=>{el.classList.remove('lk-other','lk-me');delete el.dataset.lk;
  el.querySelectorAll('[data-lkdis]').forEach(x=>{x.disabled=false;delete x.dataset.lkdis})});document.querySelectorAll('.lkb').forEach(b=>b.remove())}
function decorateLocks(){
  if(!COLLAB.on||!P){clearLk();return}
  document.querySelectorAll('#heads .head').forEach((d,i)=>{const t=P.tracks[i];if(!t)return;const o=d.querySelector(':scope>.lkb');if(o)o.remove();d.append(lockBtn(t.id));markLk(d,t.id)});
  document.querySelectorAll('#lanes .lane[data-t]').forEach(ln=>{const k=ln.dataset.t,L=lockedByOther(k);markLk(ln,k);ln.dataset.lkn=L?'🔒 '+L.n:''});
  document.querySelectorAll('.strip').forEach(s=>{const f=s.querySelector('input.fader[data-id]');if(!f)return;const k=f.dataset.id,o=s.querySelector(':scope>.lkb');if(o)o.remove();s.prepend(lockBtn(k,true));markLk(s,k)});
  const ins=$('#insp');if(SEL&&findTrack(SEL))markLk(ins,SEL);
  const bc=$('#bcontent');if(bc){if((TAB==='piano'||TAB==='steps')&&EDIT)markLk(bc,EDIT.t);else if(bc.dataset.lk){bc.classList.remove('lk-other','lk-me');delete bc.dataset.lk;bc.querySelectorAll('[data-lkdis]').forEach(x=>{x.disabled=false;delete x.dataset.lkdis})}}
  for(const k in WINS)markLk(WINS[k].el,k.split(':')[0]);
  ['#bpm','#sigSel','#keySel'].forEach(s=>{const c=$(s)&&$(s).closest('.cell');if(c)markLk(c,'proj')});
  const lp=$('#collabBar .lkproj');if(lp){const L=lockOf('proj'),mine=L&&L.u===ME.id;lp.classList.toggle('on',!!L);lp.style.background=L?L.c:'';lp.title=L?(mine?'Tempo/tonalité verrouillés par vous : cliquer pour libérer':'Tempo/tonalité verrouillés par '+L.n):'Cadenas sur le tempo, la mesure et la tonalité'}}
// les rendus existants + décoration des cadenas
for(const fn of ['renderHeads','renderLanes','renderInspector','renderBottom']){const o=window[fn];window[fn]=function(){const r=o.apply(this,arguments);if(COLLAB.on)decorateLocks();return r}}
{const o=makeWin;makeWin=function(){const r=o.apply(this,arguments);if(COLLAB.on)decorateLocks();return r}}
// blocage préventif : un clic sur quelque chose de verrouillé par un autre ne fait rien (et explique pourquoi)
for(const ev of ['pointerdown','mousedown','touchstart','click','dblclick','contextmenu','wheel','keydown'])
  document.addEventListener(ev,e=>{
    if(ev==='pointerdown'||ev==='keydown')LAST_INPUT=Date.now();
    if(!COLLAB.on)return;const el=e.target&&e.target.closest&&e.target.closest('[data-lk]');if(!el)return;
    if(e.target.closest('[data-free],.btnS'))return;const L=lockedByOther(el.dataset.lk);if(!L)return;
    if(ev==='keydown'&&!/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))return;
    if(ev==='wheel'&&!e.target.closest('.knob,input,select'))return; // le défilement/zoom reste libre
    const soft=el.classList.contains('head')||el.classList.contains('lane')||el.id==='insp'; // sélectionner/regarder reste possible
    if(soft&&/^(pointerdown|mousedown|touchstart|click)$/.test(ev)&&!e.target.closest('input,button,select,textarea,canvas,.reg,.col,.swatch,.knob,.slot,.lib>div'))return;
    e.preventDefault();e.stopPropagation();if(ev==='pointerdown'||ev==='touchstart'||ev==='keydown')lockToast(el.dataset.lk,L)},{capture:true,passive:false});
document.addEventListener('pointerdown',()=>{POINTER_DOWN=true},true);
for(const ev of ['pointerup','pointercancel'])document.addEventListener(ev,()=>{POINTER_DOWN=false;if(COLLAB.on){setTimeout(collabFlush,0);scheduleApply(60)}},true);
document.addEventListener('focusout',()=>{if(COLLAB.on)scheduleApply(80)},true);
// pas d'enregistrement sur une piste verrouillée par quelqu'un d'autre (la prise serait refusée)
{const o=toggleRecord;toggleRecord=function(){
  if(!REC&&COLLAB.on){let a=P.tracks.filter(t=>t.type==='audio'&&t.arm&&!isInstru(t));if(!a.length){const t=findTrack(SEL);if(t)a=[t]}
    const t=a.find(t=>lockedByOther(t.id));if(t){const L=lockedByOther(t.id);toast('🔒 Impossible d’enregistrer sur « '+t.name+' » : verrouillée par '+L.n,4000);return}}
  return o.apply(this,arguments)}}
