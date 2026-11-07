// ===== v3.0 : session à plusieurs (document partagé Yjs) + cadenas =====
// Principe : P reste le modèle local utilisé par toute l'interface. Un pont compare P à l'état partagé
// (toutes les 100 ms et avant chaque snapshot) et écrit la différence dans le Y.Doc. Les modifications
// des autres sont appliquées « en place » dans P (mêmes objets), puis l'interface est redessinée.
// Transport : Supabase Realtime (entre appareils) + BroadcastChannel (fenêtres du même navigateur).
// La salle est sauvegardée dans la table `salles`, les sons dans le stockage `sons` (WAV 16 bits).
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
  collabFlush();COLLAB.ldoc.transact(()=>{if(L)COLLAB.locks.delete(k);else COLLAB.locks.set(k,{u:ME.id,n:ME.name||'Quelqu’un',c:ME.color,t:Date.now()})},'lock');
  toast(L?'🔓 « '+lockLabel(k)+' » libéré':'🔒 « '+lockLabel(k)+' » verrouillé : les autres ne peuvent plus le modifier');decorateLocks()}
function myLocks(){return COLLAB.locks?[...COLLAB.locks.entries()].filter(([,L])=>L.u===ME.id):[]}
function releaseMyLocks(){const m=myLocks();if(m.length&&COLLAB.ldoc)COLLAB.ldoc.transact(()=>m.forEach(([k])=>COLLAB.locks.delete(k)),'lock')}

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

// ---- connexion : Supabase (entre appareils) + BroadcastChannel (même navigateur) ----
const SUPA={url:'https://btkrbzdgtjvjfzpamkjj.supabase.co',key:'sb_publishable_JAuJ-AqcF_6hFESge6X7tg_VuYdcg24'}; // clé publique, faite pour être dans la page
try{const o=JSON.parse(localStorage.getItem('studio_supa')||'null');if(o&&typeof o.url==='string')Object.assign(SUPA,o)}catch(e){} // tests
const NET={ws:null,state:'off',ref:0,topic:null,joinRef:null,joinedAt:0,hb:null,rT:null,retry:0,upQ:{p:[],l:[]},upT:null,parts:{},
  upDone:new Set(),uploading:false,dbMode:'none',dbT:null,startT:0};
try{NET.upDone=new Set(JSON.parse(localStorage.getItem('studio_up')||'[]'))}catch(e){}
const B64K=['u','l','sv','lsv'];
const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const unb64=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
const supaH=x=>Object.assign({apikey:SUPA.key},x||{});
function setNet(s){if(NET.state===s)return;NET.state=s;renderNetDot()}
function netLabel(){if(!SUPA.url)return'Fenêtres de cet appareil seulement';
  return {ok:'🟢 Connecté au serveur',connecting:'🟠 Connexion…',off:'🔴 Hors ligne : vos modifications partiront au retour de la connexion'}[NET.state]||NET.state}
function renderNetDot(){const d=$('#collabBar .net');if(!d)return;d.className='net '+(SUPA.url?NET.state:'ok');d.title=netLabel()}

function send(m){if(!COLLAB.on)return;m.from=ME.id;m.user={id:ME.id,name:ME.name,color:ME.color};m.synced=COLLAB.synced;
  if(COLLAB.ch)try{COLLAB.ch.postMessage(m)}catch(e){console.warn(e)}
  if(m.k==='buf'||m.k==='bufq'||!SUPA.url)return; // les sons passent par le stockage, pas par le direct
  if(m.k==='up'){NET.upQ[m.d||'p'].push(m.u);if(!NET.upT)NET.upT=setTimeout(netFlushUp,90);return} // regroupées (~10 envois/s max)
  netPost(m)}
function netFlushUp(){NET.upT=null;for(const d of ['p','l']){const q=NET.upQ[d];if(!q.length)continue;NET.upQ[d]=[];
  netPost({k:'up',d,u:q.length>1?Y.mergeUpdates(q):q[0],from:ME.id,user:{id:ME.id,name:ME.name,color:ME.color},synced:COLLAB.synced})}}
function netPost(m){
  const ws=NET.ws;if(!ws||ws.readyState!==1||!NET.joinedAt)return; // hors ligne : la resynchro au retour (hello/sync) rattrape tout
  const o=Object.assign({},m);for(const k of B64K)if(o[k] instanceof Uint8Array)o[k]=b64(o[k]);
  const str=JSON.stringify(o),raw=p=>ws.send(JSON.stringify({topic:NET.topic,event:'broadcast',payload:{type:'broadcast',event:'m',payload:p},ref:String(++NET.ref)}));
  if(str.length<120000)return raw(o);
  const id=uid('c'),n=Math.ceil(str.length/100000);for(let i=0;i<n;i++)raw({k:'part',from:ME.id,id,i,n,s:str.slice(i*100000,(i+1)*100000)})}
function netRecv(p){
  if(!p||p.from===ME.id)return;
  if(p.k==='part'){const t=Date.now();for(const id in NET.parts)if(t-NET.parts[id].t>60000)delete NET.parts[id];
    const P_=NET.parts[p.id]||(NET.parts[p.id]={t,n:p.n,got:0,s:[]});if(P_.s[p.i]==null){P_.s[p.i]=p.s;P_.got++}
    if(P_.got<P_.n)return;delete NET.parts[p.id];try{p=JSON.parse(P_.s.join(''))}catch(e){return}}
  for(const k of B64K)if(typeof p[k]==='string')try{p[k]=unb64(p[k])}catch(e){delete p[k]}
  onMsg(p)}
function netConnect(){
  clearTimeout(NET.rT);if(!COLLAB.on||!SUPA.url)return;
  let ws;try{ws=new WebSocket(SUPA.url.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(SUPA.key)+'&vsn=1.0.0')}catch(e){return netRetry()}
  NET.ws=ws;NET.joinedAt=0;setNet('connecting');
  ws.onopen=()=>{NET.joinRef=String(++NET.ref);
    ws.send(JSON.stringify({topic:NET.topic,event:'phx_join',payload:{config:{broadcast:{ack:false,self:false},presence:{key:'',enabled:false},postgres_changes:[],private:false}},ref:NET.joinRef,join_ref:NET.joinRef}));
    clearInterval(NET.hb);NET.hb=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++NET.ref)}))},25000)};
  ws.onmessage=e=>{if(NET.ws!==ws)return;let m;try{m=JSON.parse(e.data)}catch(err){return}
    if(m.event==='phx_reply'&&m.ref===NET.joinRef){if(m.payload&&m.payload.status==='ok')netJoined();else{console.warn('Session : connexion refusée',m.payload);ws.close()}return}
    if(m.topic!==NET.topic)return;
    if(m.event==='broadcast'&&m.payload)netRecv(m.payload.payload);
    else if(m.event==='phx_error'||m.event==='phx_close')ws.close()};
  ws.onerror=()=>{};
  ws.onclose=()=>{clearInterval(NET.hb);if(NET.ws!==ws)return;NET.ws=null;NET.joinedAt=0;setNet('off');netRetry()}}
function netRetry(){if(!COLLAB.on)return;clearTimeout(NET.rT);NET.rT=setTimeout(netConnect,Math.min(15000,800*2**NET.retry++))}
function netJoined(){NET.retry=0;NET.joinedAt=Date.now();setNet('ok');
  sendHello(); // à chaque (re)connexion : on échange les différences avec les autres
  if(NET.dbMode==='err')dbLoad()}
function sendHello(){send({k:'hello',sv:Y.encodeStateVector(COLLAB.doc),lsv:Y.encodeStateVector(COLLAB.ldoc)})}

function onMsg(m){
  if(!COLLAB.on||!m||m.from===ME.id||(m.to&&m.to!==ME.id))return;
  if(m.user&&m.k!=='bye'){const was=COLLAB.peers[m.from];COLLAB.peers[m.from]={user:m.user,t:Date.now()};if(!was||was.user.name!==m.user.name||was.user.color!==m.user.color)renderPresence()}
  switch(m.k){
    case 'hello':
      if(COLLAB.synced)send({k:'sync',to:m.from,u:Y.encodeStateAsUpdate(COLLAB.doc,m.sv),l:Y.encodeStateAsUpdate(COLLAB.ldoc,m.lsv),sv:Y.encodeStateVector(COLLAB.doc),lsv:Y.encodeStateVector(COLLAB.ldoc)});
      else{COLLAB.waiting[m.from]=Date.now();if(COLLAB.ldoc)send({k:'sync',to:m.from,l:Y.encodeStateAsUpdate(COLLAB.ldoc,m.lsv),lsv:Y.encodeStateVector(COLLAB.ldoc)})}break;
    case 'sync':recvUpdate(m.l,'l');recvUpdate(m.u,'p');
      if(COLLAB.synced&&m.sv){const d=Y.encodeStateAsUpdate(COLLAB.doc,m.sv);if(d.length>2)send({k:'up',d:'p',u:d})}
      if(m.lsv){const d=Y.encodeStateAsUpdate(COLLAB.ldoc,m.lsv);if(d.length>2)send({k:'up',d:'l',u:d})}break;
    case 'up':recvUpdate(m.u,m.d);break;
    case 'bye':delete COLLAB.peers[m.from];renderPresence();break;
    case 'bufq':for(const id of m.ids||[])sendBuf(m.from,id);break;
    case 'buf':recvBuf(m);break;
  }}
function recvUpdate(u,d){
  if(!u||!COLLAB.doc)return;
  if(d==='l'){try{Y.applyUpdate(COLLAB.ldoc,u,'remote')}catch(e){console.warn(e)}if(COLLAB.synced)scheduleApply();return}
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
  afterSync();renderAll();dbSave(true);uploadBufs()}
function afterSync(){COLLAB.synced=true;setBase();UNDO=[];REDO=[];
  COLLAB.um=new Y.UndoManager(COLLAB.root,{trackedOrigins:new Set([LOCAL_ORIGIN]),captureTimeout:1e9});
  const now=Date.now();for(const k of COLLAB.locks.keys())COLLAB.lockSeen[k]=now;renderPresence();scheduleApply()}
// personne n'a répondu : salle neuve → on la démarre avec son projet. Si le serveur est injoignable, on attend (pas d'écrasement).
function waitDone(){if(!COLLAB.on||COLLAB.synced||COLLAB.adopting)return;
  const t=Date.now(),again=ms=>{COLLAB.waitT=setTimeout(waitDone,ms)};
  if(Object.keys(COLLAB.waiting).some(id=>t-COLLAB.waiting[id]<6000&&id<ME.id))return again(2000); // un autre arrivant démarre la session
  if(SUPA.url){
    if(NET.dbMode==='pending'||NET.dbMode==='err'){if(t-NET.startT>8000&&!COLLAB.toldWait){COLLAB.toldWait=1;toast('Connexion au serveur… (vérifiez internet)',5000)}return again(1500)}
    if(!(NET.joinedAt&&t-NET.joinedAt>2000)&&t-NET.startT<10000)return again(800)}
  seed();toast('👥 Vous êtes le premier dans la session : votre projet est partagé',4000)}

// ---- sauvegarde de la salle sur le serveur ----
async function dbLoad(){
  if(!SUPA.url||!COLLAB.on)return;const room=COLLAB.room;NET.dbMode='pending';
  try{const r=await fetch(SUPA.url+'/rest/v1/salles?select=doc&id=eq.'+encodeURIComponent(room),{headers:supaH()});
    if(!r.ok)throw new Error('HTTP '+r.status);const rows=await r.json();if(!COLLAB.on||COLLAB.room!==room)return;
    NET.dbMode=rows[0]&&rows[0].doc?'row':'empty';if(NET.dbMode==='row')recvUpdate(unb64(rows[0].doc),'p')}
  catch(e){console.warn('Session : lecture de la salle impossible',e);if(COLLAB.room===room){NET.dbMode='err';clearTimeout(NET.dbT);NET.dbT=setTimeout(()=>{if(!COLLAB.synced)dbLoad()},5000)}}}
function roomBody(){return JSON.stringify({id:COLLAB.room,doc:b64(Y.encodeStateAsUpdate(COLLAB.doc)),maj:new Date().toISOString()})}
async function dbSave(force){
  if(!SUPA.url||!COLLAB.on||!COLLAB.synced)return;if(!force&&!COLLAB.docChanged)return;
  if(!force){const ids=[ME.id,...Object.keys(COLLAB.peers)].sort();if(ids[0]!==ME.id)return} // une seule personne sauvegarde à la fois
  COLLAB.docChanged=false;
  try{const r=await fetch(SUPA.url+'/rest/v1/salles',{method:'POST',headers:supaH({'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'}),body:roomBody()});
    if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,200))}
  catch(e){COLLAB.docChanged=true;console.warn('Session : sauvegarde en ligne impossible',e)}}
function dbSaveOnLeave(){if(!SUPA.url||!COLLAB.synced||!COLLAB.docChanged)return;const body=roomBody();if(body.length>60000)return;
  try{fetch(SUPA.url+'/rest/v1/salles',{method:'POST',keepalive:true,headers:supaH({'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'}),body})}catch(e){}}

// ---- sons (fichiers audio immuables, partagés par identifiant) ----
const sonURL=id=>SUPA.url+'/storage/v1/object/public/sons/'+id+'.wav';
function saveUp(){try{localStorage.setItem('studio_up',JSON.stringify([...NET.upDone].slice(-3000)))}catch(e){}}
async function uploadBufs(){
  if(!SUPA.url||!COLLAB.synced||NET.uploading||!P)return;
  const ids=[...usedBufs(P)].filter(id=>id&&BUFS[id]&&!NET.upDone.has(id));if(!ids.length)return;NET.uploading=true;
  try{for(const id of ids){if(!COLLAB.on)break;
    const r=await fetch(SUPA.url+'/storage/v1/object/sons/'+id+'.wav',{method:'POST',headers:supaH({'Content-Type':'audio/wav','x-upsert':'false'}),body:wavEncode(BUFS[id])});
    const txt=r.ok?'':await r.text();
    if(r.ok||r.status===409||/exist|duplicate/i.test(txt)){NET.upDone.add(id);saveUp()}
    else{console.warn('Session : envoi du son impossible',r.status,txt);if(r.status===413&&!NET['big'+id]){NET['big'+id]=1;toast('⚠ Un son est trop long pour être partagé (5 min max environ)',5000)}}}}
  catch(e){console.warn('Session : envoi des sons interrompu',e)}finally{NET.uploading=false}}
async function fetchMissingBufs(){
  if(!COLLAB.on||!P)return;const t=Date.now();
  const need=[...usedBufs(P)].filter(id=>id&&!BUFS[id]&&!(COLLAB.bufWait[id]&&t-COLLAB.bufWait[id]<6000));if(!need.length)return;
  need.forEach(id=>COLLAB.bufWait[id]=t);const ask=[];let got=0;
  for(const id of need){try{const b=await IDB.get('buffers',id);
      if(b&&!BUFS[id]){const ab=ctx.createBuffer(b.ch,b.len,b.sr);b.data.forEach((d,c)=>ab.copyToChannel(d,c));addBuffer(ab,id);SAVED_BUFS.add(id);got++;continue}}catch(e){}
    if(SUPA.url&&!BUFS[id])try{const r=await fetch(sonURL(id));
      if(r.ok){const ab=await ctx.decodeAudioData(await r.arrayBuffer());if(!BUFS[id]){addBuffer(ab,id);NET.upDone.add(id);got++}continue}}catch(e){}
    if(!BUFS[id])ask.push(id)}
  if(ask.length)send({k:'bufq',ids:ask});if(got)bufsArrived()}
function sendBuf(to,id){const b=BUFS[id];if(!b)return;const data=[];for(let c=0;c<b.numberOfChannels;c++)data.push(b.getChannelData(c).slice());
  send({k:'buf',to,id,sr:b.sampleRate,ch:b.numberOfChannels,len:b.length,data})}
function recvBuf(m){if(BUFS[m.id]||!m.data)return;const ab=ctx.createBuffer(m.ch,m.len,m.sr);m.data.forEach((d,c)=>ab.copyToChannel(d,c));addBuffer(ab,m.id);delete COLLAB.bufWait[m.id];bufsArrived()}
function bufsArrived(){clearTimeout(COLLAB.bufT);COLLAB.bufT=setTimeout(()=>{if(busy())return bufsArrived();renderLanes();if(TAB)renderBottom()},120)}

// ---- démarrer / quitter ----
function collabStart(room,host){
  if(COLLAB.on)collabStop(true);
  if(typeof Y==='undefined')return toast('Ce navigateur ne permet pas les sessions à plusieurs');
  Object.assign(COLLAB,{on:true,synced:false,room,queue:[],peers:{},waiting:{},lockSeen:{},bufWait:{},um:null,adopting:false,projDirty:false,lockDirty:false,docChanged:false,toldWait:0});
  const doc=COLLAB.doc=new Y.Doc(),ldoc=COLLAB.ldoc=new Y.Doc();COLLAB.root=doc.getMap('p');COLLAB.locks=ldoc.getMap('locks');
  doc.on('update',(u,origin)=>{COLLAB.docChanged=true;if(origin!=='remote')send({k:'up',d:'p',u})});
  ldoc.on('update',(u,origin)=>{if(origin!=='remote')send({k:'up',d:'l',u})});
  COLLAB.root.observeDeep((ev,tr)=>{if(tr.origin==='remote')COLLAB.projDirty=true});
  COLLAB.locks.observe(ev=>{const t=Date.now();ev.keysChanged.forEach(k=>COLLAB.lockSeen[k]=t);
    if(ev.transaction.origin==='remote')COLLAB.lockDirty=true;else decorateLocks()});
  COLLAB.ch=null;try{if(window.BroadcastChannel){COLLAB.ch=new BroadcastChannel('studio-room-'+room);COLLAB.ch.onmessage=e=>onMsg(e.data)}}catch(e){}
  if(!COLLAB.ch&&!SUPA.url){COLLAB.on=false;return toast('Session impossible ici : ouvrez l’appli depuis son adresse en ligne')}
  try{history.replaceState(null,'',location.pathname+location.search+'#room='+room)}catch(e){}
  NET.topic='realtime:studio-'+room;NET.retry=0;NET.startT=Date.now();NET.dbMode=SUPA.url?'pending':'none';NET.upQ={p:[],l:[]};NET.parts={};
  const T=(fn,ms)=>COLLAB.timers.push(setInterval(fn,ms));
  T(collabFlush,100);
  T(()=>{send({k:'pres'});const t=Date.now();let ch=false;for(const id in COLLAB.peers)if(t-COLLAB.peers[id].t>12000){delete COLLAB.peers[id];ch=true}if(ch)renderPresence();
    fetchMissingBufs();uploadBufs();decorateLocks()},4000);
  T(()=>dbSave(false),8000);
  T(()=>{if(!COLLAB.synced)return;const m=myLocks();if(!m.length)return;const idle=Date.now()-LAST_INPUT>LOCK_IDLE;
    COLLAB.ldoc.transact(()=>m.forEach(([k,L])=>idle?COLLAB.locks.delete(k):COLLAB.locks.set(k,Object.assign({},L,{t:Date.now(),n:ME.name||L.n,c:ME.color}))),'lock');
    if(idle)toast('🔓 Vos cadenas ont été libérés (2 min sans activité)',4000)},20000);
  if(host)seed();else{sendHello();if(SUPA.url)dbLoad();COLLAB.waitT=setTimeout(waitDone,2500)}
  netConnect();renderPresence()}
function collabStop(silent){
  if(!COLLAB.on)return;releaseMyLocks();netFlushUp();dbSaveOnLeave();send({k:'bye'});
  COLLAB.timers.forEach(clearInterval);COLLAB.timers=[];clearTimeout(COLLAB.waitT);clearTimeout(COLLAB.applyT);clearTimeout(NET.rT);clearTimeout(NET.dbT);clearTimeout(NET.upT);NET.upT=null;clearInterval(NET.hb);
  const ws=NET.ws;NET.ws=null;NET.joinedAt=0;if(ws)setTimeout(()=>{try{ws.close()}catch(e){}},300);setNet('off');
  try{COLLAB.ch&&COLLAB.ch.close()}catch(e){}try{COLLAB.doc.destroy();COLLAB.ldoc.destroy()}catch(e){}
  Object.assign(COLLAB,{on:false,synced:false,room:null,doc:null,ldoc:null,root:null,locks:null,um:null,ch:null,queue:[],peers:{}});
  try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
  UNDO=[];REDO=[];renderPresence();clearLk();renderAll();if(!silent)toast('Vous avez quitté la session (le projet reste dans 📂 Mes projets)',3500)}
const roomFromHash=()=>{const m=/(?:^|[#&])room=([\w-]{4,40})/.exec(location.hash);return m&&m[1]};
const roomLink=r=>location.origin+location.pathname+'#room='+r;
const newRoom=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>(b%36).toString(36)).join('');
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
      h('p',null,'Cliquez « Partager », puis envoyez le lien à vos amis (message, WhatsApp…). Ils l’ouvrent sur leur ordinateur, téléphone ou tablette et vous rejoignent. Le projet de la session reste sauvegardé en ligne : rouvrez le même lien plus tard pour continuer.'),
      location.protocol==='file:'&&h('p',{style:{color:'#ffb340',fontSize:'12px'}},'Vous avez ouvert le fichier directement : pour inviter d’autres personnes, ouvrez l’appli depuis son adresse en ligne.'),
      h('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'10px'}},
        h('button',{style:{padding:'8px 14px'},onclick:()=>{m.remove();const go=()=>{collabStart(newRoom(),true);collabModal()};ME.name?go():askName(go)}},'▶ Partager ce projet'),
        roomFromHash()&&h('button',{onclick:()=>{m.remove();const go=()=>collabStart(roomFromHash(),false);ME.name?go():askName(go)}},'Rejoindre la session du lien')));return}
    const link=roomLink(COLLAB.room),ppl=[{name:ME.name+' (vous)',color:ME.color},...Object.values(COLLAB.peers).map(p=>p.user)];
    box.append(h('h2',null,'👥 Session en cours'),
      h('div',{class:'kv2'},'Lien de la session',h('span',{style:{display:'flex',gap:'6px'}},h('input',{type:'text',readonly:true,value:link,style:{width:'260px'},onfocus:e=>e.target.select()}),
        h('button',{onclick:async()=>{try{await navigator.clipboard.writeText(link);toast('Lien copié ✔')}catch(e){toast('Sélectionnez le lien et copiez-le')}}},'Copier'))),
      h('div',{class:'kv2'},'Connexion',h('span',null,netLabel())),
      navigator.share&&h('div',{class:'kv2'},'Inviter',h('button',{onclick:()=>navigator.share({title:'Session Studio',text:'Rejoins ma session Studio 🎧',url:link}).catch(()=>{})},'📤 Envoyer le lien')),
      h('div',{class:'kv2'},'Connectés ('+ppl.length+')',h('span',{style:{display:'flex',gap:'6px',flexWrap:'wrap'}},ppl.map(p=>h('span',{class:'chip',style:{background:p.color}},p.name||'?')))),
      h('div',{class:'kv2'},'Mon nom',h('button',{onclick:()=>{m.remove();askName(()=>{renderPresence();COLLAB.ldoc&&myLocks().length&&COLLAB.ldoc.transact(()=>myLocks().forEach(([k,L])=>COLLAB.locks.set(k,Object.assign({},L,{n:ME.name,c:ME.color}))),'lock');send({k:'pres'})})}},ME.name+' ✎')),
      h('div',{class:'kv2'},'Mes cadenas',h('span',null,myLocks().length?myLocks().map(([k])=>lockLabel(k)).join(', '):'aucun')),
      h('p',{style:{color:'var(--dim)',fontSize:'11px'}},'Seules les personnes qui ont le lien peuvent entrer : ne le publiez pas. Un cadenas se retire en recliquant dessus, ou tout seul après 2 min sans activité (ou si vous quittez). Personne ne peut forcer le cadenas d’un autre. Ctrl+Z n’annule que vos propres actions. Restent personnels : le solo, l’armement R, le retour micro et la boucle (cycle).'),
      h('div',{style:{display:'flex',gap:'8px',marginTop:'10px'}},h('button',{onclick:()=>{m.remove();collabStop()}},'Quitter la session')))};
  draw()}
function collabBoot(){
  const r=roomFromHash();if(r){const go=()=>collabStart(r,false);ME.name?go():askName(go)}
  addEventListener('hashchange',()=>{const r=roomFromHash();if(r&&r!==COLLAB.room){const go=()=>collabStart(r,false);ME.name?go():askName(go)}});
  addEventListener('pagehide',()=>{if(COLLAB.on){releaseMyLocks();netFlushUp();dbSaveOnLeave();send({k:'bye'})}});
  addEventListener('online',()=>{if(COLLAB.on&&!NET.ws)netConnect()})}

// ---- présence + affichage des cadenas ----
function renderPresence(){let b=$('#collabBar');
  if(!COLLAB.on){if(b)b.remove();return}
  if(!b){b=h('div',{class:'grp',id:'collabBar'});const ref=$('#bSettings').parentElement;ref.parentElement.insertBefore(b,ref)}
  b.innerHTML='';const av=h('span',{class:'avs',title:'Session à plusieurs',onclick:collabModal},h('span',{class:'net'}));
  for(const p of [ME,...Object.values(COLLAB.peers).map(x=>x.user)])av.append(h('span',{class:'av',title:(p.name||'?')+(p===ME?' (vous)':''),style:{background:p.color}},(p.name||'?').slice(0,1).toUpperCase()));
  b.append(av,h('button',{class:'tbtn lkproj',title:'Cadenas sur le tempo, la mesure et la tonalité',onclick:()=>toggleLock('proj')},'🔒'));renderNetDot();decorateLocks()}
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
