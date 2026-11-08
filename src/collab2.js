// ===== Session : écouter ensemble, chat (+ messages vocaux), notes et marqueurs, versions, bounce MP3 =====
// Chat = Y.Array 'chat' du document de session. Notes (P.cmts) et marqueurs (P.marks) sont dans le projet : ils marchent seul et se partagent comme le reste.
// Les auditeurs (lien écoute seule) envoient chat et commentaires en message « vmsg » ; le relais les ajoute au document.
const C2={follow:true,clk:{},seenTP:new Set(),tpToast:0,unread:0,open:false,tab:'chat',showDone:false,hi:null,vers:null,applying:false};
try{C2.follow=localStorage.getItem('studio_follow')!=='0'}catch(e){}
const CHAT=()=>COLLAB.doc&&COLLAB.doc.getArray('chat');
const meUser=()=>({u:ME.id,n:ME.name||'?',c:ME.color});
const fmtMS=sec=>{sec=Math.max(0,sec);const m=Math.floor(sec/60),s=Math.floor(sec%60);return m+'m'+String(s).padStart(2,'0')};
const fmtBar=b=>'à '+fmtMS(b*60/(P?P.bpm:120)); // position dans le morceau en minutes/secondes (ex. « à 1m25 »)
const hhmm=t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

// ---------- 🎧 Écouter ensemble (horloges recalées par ping/pong) ----------
COLLAB_H.ping=(m,via)=>send({k:'pong',to:m.from,t0:m.t0,t1:Date.now()},via==='v'?{v:true}:null);
COLLAB_H.pong=m=>{const now=Date.now(),rtt=now-m.t0;if(rtt<0||rtt>5000)return;const off=m.t1-(m.t0+rtt/2),c=C2.clk[m.from];
  if(!c||rtt<=c.rtt*1.3||now-c.t>30000)C2.clk[m.from]={off,rtt,t:now}};
function sendTP(a,beat){if(!COLLAB.on||!COLLAB.synced||COLLAB.viewer||!C2.follow||REC||C2.applying)return;
  send({k:'tp',id:uid('p'),a,beat,at:Date.now()+(a==='play'?80:0),cyc:Object.assign({},P.cycle)})}
COLLAB_H.tp=(m,via)=>{
  if(via==='v'||!C2.follow||REC||!m.id||C2.seenTP.has(m.id))return;C2.seenTP.add(m.id);if(C2.seenTP.size>200)C2.seenTP=new Set([...C2.seenTP].slice(-100));
  const off=(C2.clk[m.from]||{}).off||0;C2.applying=true;
  try{if(m.cyc&&(m.a==='play')){P.cycle=Object.assign({},m.cyc);renderBar();updateCycleShade();drawRuler()}
    if(m.a==='stop'){if(E.playing)E.stop();PH=m.beat;updatePlayhead(PH);drawRuler();return}
    if(m.a==='seek'){if(!E.playing){PH=m.beat;updatePlayhead(PH);drawRuler()}return}
    if(m.a==='play'){const go=()=>{if(!C2.follow||REC)return;const el=Math.max(0,(Date.now()+off-m.at)/1000)+.08;let b=m.beat+el/spb();/* +80 ms : délai de démarrage de E.play */const c=P.cycle;
        if(c.on&&c.end>c.start&&m.beat<c.end&&b>=c.end)b=c.start+((b-c.start)%(c.end-c.start));
        ctx.resume();C2.applying=true;try{E.play(b)}finally{C2.applying=false}};
      const wait=m.at-(Date.now()+off);if(wait>5)setTimeout(go,Math.min(wait,1000));else go();
      if(Date.now()-C2.tpToast>15000){C2.tpToast=Date.now();toast('🎧 '+((m.user&&m.user.name)||'Quelqu’un')+' a lancé la lecture pour tout le monde',2500)}}}
  finally{C2.applying=false}};
{const _play=play;play=function(){const was=E.playing;const r=_play.apply(this,arguments);if(COLLAB.on){if(E.playing&&!was)sendTP('play',PH);else if(was&&!E.playing)sendTP('stop',PH)}return r}}
{const _s=stopBtn;stopBtn=function(){const was=E.playing;const r=_s.apply(this,arguments);if(COLLAB.on)sendTP(was?'stop':'seek',PH);return r}}
{const _s=setPH;setPH=function(){const r=_s.apply(this,arguments);if(COLLAB.on)sendTP(E.playing?'play':'seek',PH);return r}}
{const _s=scrubEnd;scrubEnd=function(){const on=SCRUB!=null;const r=_s.apply(this,arguments);if(COLLAB.on&&on)sendTP(E.playing?'play':'seek',PH);return r}}
function toggleFollow(){C2.follow=!C2.follow;try{localStorage.setItem('studio_follow',C2.follow?'1':'0')}catch(e){}renderPresence();
  toast(C2.follow?'🎧 Écouter ensemble : ▶ / ■ et la tête de lecture sont partagés avec tout le monde':'🎧 Écoute en solo : votre lecture ne dérange plus les autres (et inversement)',4000)}

// ---------- 💬 Chat ----------
function chatSend(x,extra){x=(x||'').trim().slice(0,1000);if(!x&&!extra)return;if(!COLLAB.synced)return toast('Connexion à la session en cours…');
  if(COLLAB.viewer)return send({k:'vmsg',kind:'chat',x});
  const a=CHAT();COLLAB.doc.transact(()=>{a.push([Object.assign({id:uid('m'),t:Date.now(),x},meUser(),extra||{})]);if(a.length>300)a.delete(0,a.length-300)},'chat')}
COLLAB_H.vmsg=(m,via)=>{if(via!=='v'||!isRelay()||!COLLAB.synced||!m.user)return;const who={u:m.user.id,n:(m.user.name||'?').slice(0,20)+' 👁',c:m.user.color,v:1};
  if(m.kind==='chat'&&m.x){const a=CHAT();COLLAB.doc.transact(()=>{a.push([Object.assign({id:uid('m'),t:Date.now(),x:String(m.x).slice(0,1000)},who)]);if(a.length>300)a.delete(0,a.length-300)},'chat')}
  if(m.kind==='voc'&&m.voc&&/^[a-z0-9]{12}$/.test(m.voc.f)&&/^(webm|m4a|ogg)$/.test(m.voc.ext)){const a=CHAT();COLLAB.doc.transact(()=>{a.push([Object.assign({id:uid('m'),t:Date.now(),x:'🎤 message vocal',voc:{f:m.voc.f,ext:m.voc.ext,type:String(m.voc.type||''),dur:+m.voc.dur||0}},who)]);if(a.length>300)a.delete(0,a.length-300)},'chat')}
  if(m.kind==='cmt'&&m.x&&typeof m.beat==='number')cmtAdd(m.beat,String(m.x).slice(0,1000),who,typeof m.tid==='string'?m.tid:'');
  if(m.kind==='rep'&&m.x&&m.cid)cmtReply(m.cid,String(m.x).slice(0,1000),who)};
function onChatChange(ev){
  if(ev.transaction.origin==='remote'||ev.transaction.origin==='relay'){const added=[];ev.changes.added.forEach(it=>it.content.getContent().forEach(x=>added.push(x)));
    const others=added.filter(x=>x&&x.u!==ME.id);if(others.length&&!(C2.open&&C2.tab==='chat')){C2.unread+=others.length;const l=others[others.length-1];toast('💬 '+l.n+' : '+(l.b?'📀 '+l.b.title:l.voc?'🎤 message vocal':l.x).slice(0,80),3500)}}
  renderBadge();if(C2.open&&C2.tab==='chat')drawPanel()}

// ---------- 📌 Notes sur la timeline (dans le projet : marchent seul et en session) ----------
// P.cmts = [{id,beat,u,n,c,t,x,done,rep:[{u,n,c,t,x}]}] ; P.marks = [{id,beat,name,color}] (marqueurs de structure)
const cmtArr=()=>P&&(P.cmts||(P.cmts=[]));
function cmtChanged(){DIRTY=true;if(COLLAB.on&&COLLAB.synced)collabFlush();renderPins();if(C2.open&&(C2.tab==='cmts'||C2.tab==='marks'))drawPanel()}
function cmtAdd(beat,x,who,tid){if(COLLAB.on&&COLLAB.viewer&&!who)return send({k:'vmsg',kind:'cmt',beat,x,tid:tid||''});
  const w=who||meUser(),o={id:uid('c'),beat:Math.max(0,beat),u:w.u,n:w.n,c:w.c,t:Date.now(),x,done:false,rep:[]};if(tid&&findTrack(tid))o.tid=tid;
  snapshot();cmtArr().push(o);cmtChanged()}
const cmtFind=id=>((P&&P.cmts)||[]).find(c=>c.id===id);
function cmtReply(id,x,who){if(COLLAB.on&&COLLAB.viewer&&!who)return send({k:'vmsg',kind:'rep',cid:id,x});const c=cmtFind(id);if(!c)return;
  snapshot();(c.rep||(c.rep=[])).push(Object.assign({t:Date.now(),x},who||meUser()));cmtChanged()}
function cmtSet(id,k,v){const c=cmtFind(id);if(!c)return;snapshot();c[k]=v;cmtChanged()}
function cmtDel(id){const a=(P&&P.cmts)||[],i=a.findIndex(c=>c.id===id);if(i<0)return;snapshot();a.splice(i,1);cmtChanged()}
const cmtList=()=>((P&&P.cmts)||[]).slice().sort((p,q)=>p.beat-q.beat);
function renderPins(){
  document.querySelectorAll('#lanes .cpin,#lanes .cline').forEach(e=>e.remove());const L=$('#lanes');if(!L||!P)return;
  const list=cmtList();
  if(C2.knownC){for(const c of list)if(!C2.knownC.has(c.id)&&c.u!==ME.id&&COLLAB.on)toast('📌 '+c.n+' a commenté '+fmtBar(c.beat)+' : '+String(c.x).slice(0,60),3500)}
  C2.knownC=new Set(list.map(c=>c.id));
  for(const c of list){const x=c.beat*PPB,ti=c.tid?P.tracks.findIndex(t=>t.id===c.tid):-1,pos=ti>=0?{top:ti*TH+'px',bottom:'auto',height:TH+'px'}:{};
    L.append(h('div',{class:'cline'+(c.done?' done':''),style:Object.assign({left:x+'px','--cc':c.c},pos)}),
      ti>=0&&h('div',{class:'cpin'+(c.done?' done':'')+(C2.hi===c.id?' hi':''),style:{left:x+'px',top:(ti*TH+2)+'px','--cc':c.c},title:c.n+' ('+fmtBar(c.beat)+', '+P.tracks[ti].name+') : '+c.x+(c.done?' ✔ résolue':''),
        onpointerdown:e=>e.stopPropagation(),onclick:e=>{e.stopPropagation();C2.hi=c.id;openPanel('cmts')}},(c.done?'✔ ':'📌 ')+(c.n||'?').slice(0,1).toUpperCase()+((c.rep&&c.rep.length)?' '+(c.rep.length+1):'')))}
  try{drawRuler()}catch(e){}
  for(const m of (P.marks||[]))L.append(h('div',{class:'mline',style:{left:m.beat*PPB+'px','--mc':m.color}}))}
function askComment(beat,tid){openPanel('cmts');C2.newAt=beat;C2.newTid=tid||'';drawPanel();setTimeout(()=>{const t=$('#cpanel textarea.newc');if(t)t.focus()},30)}

// ---------- 🎤 Messages vocaux ----------
const VOC={rec:null,chunks:[],t0:0,timer:null,stream:null,mime:''};
function vocMime(){for(const m of ['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'])if(window.MediaRecorder&&MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(m))return m;return''}
async function vocStart(){
  if(!window.MediaRecorder)return toast('Ce navigateur ne permet pas d’enregistrer un message vocal');
  if(!SUPA.url)return toast('Les messages vocaux ont besoin d’internet');
  try{VOC.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch(e){return micError(e)}
  VOC.mime=vocMime();VOC.chunks=[];VOC.rec=new MediaRecorder(VOC.stream,VOC.mime?{mimeType:VOC.mime,audioBitsPerSecond:64000}:undefined);
  VOC.rec.ondataavailable=e=>{if(e.data&&e.data.size)VOC.chunks.push(e.data)};VOC.rec.start(250);VOC.t0=Date.now();
  VOC.timer=setInterval(()=>{const s=Math.floor((Date.now()-VOC.t0)/1000);const t=$('#cpanel .vtime');if(t)t.textContent='● '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+' / 2:00';if(s>=120)vocStop(true)},250);drawPanel()}
function vocStop(sendIt){const r=VOC.rec;if(!r)return;clearInterval(VOC.timer);VOC.rec=null;const dur=(Date.now()-VOC.t0)/1000;
  r.onstop=async()=>{VOC.stream.getTracks().forEach(t=>t.stop());drawPanel();if(!sendIt||dur<.6)return;
    const type=(r.mimeType||VOC.mime||'audio/webm').split(';')[0],ext=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm',blob=new Blob(VOC.chunks,{type}),f=newRoom();
    const st=$('#cpanel .vtime');if(st)st.textContent='Envoi…';
    try{await xhrUpload(SUPA.url+'/storage/v1/object/sons/vocaux/'+f+'.'+ext,blob,type,p=>{const s=$('#cpanel .vtime');if(s)s.textContent='Envoi '+Math.round(p*100)+' %'});
      const voc={f,ext,type,dur:Math.round(dur)};if(COLLAB.viewer)send({k:'vmsg',kind:'voc',voc});else chatSend('🎤 message vocal',{voc})}
    catch(e){toast('⚠ Message vocal non envoyé : '+e.message,5000)}drawPanel()};r.stop()}
const vocURL=v=>SUPA.url+'/storage/v1/object/public/sons/vocaux/'+v.f+'.'+v.ext;
// glisser (ou bouton ➕) un message vocal dans le projet
async function vocToTrack(v,beat,trackId,label){
  if(COLLAB.viewer)return lockToast('',VIEW_LOCK);
  try{toast('⬇ Ajout du vocal au projet…',4000);const ab=await ctx.decodeAudioData(await (await fetch(vocURL(v))).arrayBuffer());
    let t=trackId&&findTrack(trackId);if(t&&(t.type!=='audio'||isInstru(t)||lockedByOther(t.id)))t=null;
    snapshot();if(!t){t=newTrack('audio','Vocal'+(label?' '+label:''));t.role='voice';P.tracks.push(t);E.build(P)}
    const id=addBuffer(ab);t.regions.push({id:uid('r'),start:Math.max(0,beat),offset:0,dur:ab.duration,buf:id,name:'🎤 '+(label||'vocal')});SEL=t.id;renderAll();
    if(COLLAB.on)collabFlush();toast('🎤 Vocal ajouté sur « '+t.name+' » à '+fmtBar(beat))}
  catch(e){toast('⚠ Impossible d’ajouter ce vocal : '+e.message,5000)}}
document.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('text/studio-voc')&&e.target.closest&&e.target.closest('#lanes,#heads')){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy'}},true);
document.addEventListener('drop',e=>{if(!e.dataTransfer||![...e.dataTransfer.types].includes('text/studio-voc'))return;e.preventDefault();e.stopPropagation();
  let d;try{d=JSON.parse(e.dataTransfer.getData('text/studio-voc'))}catch(err){return}const L=$('#lanes').getBoundingClientRect();
  const beat=e.clientX>L.left?snapB((e.clientX-L.left)/PPB):PH,t=P.tracks[Math.floor((e.clientY-L.top)/TH)];vocToTrack(d.voc,beat,t&&t.id,d.n)},true);

// ---------- 🕘 Versions de la session (table « versions », fonctions version_*) ----------
async function versionsLoad(){if(!SUPA.url||COLLAB.viewer||!COLLAB.room)return;try{C2.vers=await rpc('version_list',{p_salle:COLLAB.room})}catch(e){C2.vers='err';console.warn(e)}if(C2.open&&C2.tab==='vers')drawPanel()}
async function versionSave(nom,quiet){if(!COLLAB.synced||COLLAB.viewer)return;collabFlush();
  nom=(nom||'').trim()||('Version du '+new Date().toLocaleString());
  try{await rpc('version_add',{p_salle:COLLAB.room,p_nom:nom,p_auteur:ME.name||'?',p_doc:JSON.stringify({v:1,p:sharedView(P)})});if(!quiet){toast('💾 Version « '+nom+' » sauvegardée');chatSend('💾 a sauvegardé la version « '+nom+' »')}versionsLoad();return true}
  catch(e){toast('⚠ Version non sauvegardée : '+e.message,5000);return false}}
async function versionRestore(v){
  if(!COLLAB.synced||COLLAB.viewer)return;let data;try{data=JSON.parse(await rpc('version_get',{p_salle:COLLAB.room,p_id:v.id})).p}catch(e){return toast('⚠ Version illisible : '+e.message,5000)}
  collabFlush();const bad=lockedChange(COLLAB.last,data);if(bad)return toast('🔒 Impossible de revenir à cette version : « '+lockLabel(bad.k)+' » est verrouillé par '+bad.L.n+'. Demandez-lui de retirer son cadenas.',6000);
  if(!await versionSave('Avant le retour à « '+v.nom+' »',true))return;
  E.stop();snapshot();patchRoot(data);collabFlush();collabRefresh(true);fetchMissingBufs();
  chatSend('↩ est revenu(e) à la version « '+v.nom+' » (Ctrl+Z pour annuler)');toast('↩ Version « '+v.nom+' » rétablie. Ctrl+Z pour annuler.',4000)}

// ---------- 📀 Bounce MP3 partagé ----------
let LAME_P=null;
function loadLame(){if(window.lamejs&&lamejs.Mp3Encoder)return Promise.resolve();if(LAME_P)return LAME_P;
  LAME_P=new Promise((res,rej)=>{const s=document.createElement('script');s.src='lame.min.js';s.onload=()=>window.lamejs&&lamejs.Mp3Encoder?res():rej(new Error('encodeur MP3 absent'));s.onerror=()=>{LAME_P=null;rej(new Error('encodeur MP3 introuvable (connexion ?)'))};document.head.append(s)});return LAME_P}
async function encodeMP3(buf,kbps,onProg){await loadLame();const enc=new lamejs.Mp3Encoder(2,buf.sampleRate,kbps),L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L,N=1152,out=[];
  const l16=new Int16Array(N),r16=new Int16Array(N),cv=v=>v>=1?32767:v<=-1?-32768:v*32767|0;let t0=performance.now();
  for(let i=0;i<L.length;i+=N){const n=Math.min(N,L.length-i);for(let j=0;j<n;j++){l16[j]=cv(L[i+j]);r16[j]=cv(R[i+j])}
    const b=enc.encodeBuffer(n<N?l16.subarray(0,n):l16,n<N?r16.subarray(0,n):r16);if(b.length)out.push(new Uint8Array(b.buffer,b.byteOffset,b.length).slice());
    if(performance.now()-t0>30){onProg&&onProg(i/L.length);await new Promise(r=>setTimeout(r,0));t0=performance.now()}}
  const f=enc.flush();if(f.length)out.push(new Uint8Array(f.buffer,f.byteOffset,f.length).slice());return new Blob(out,{type:'audio/mpeg'})}
const bounceLink=(f,t)=>location.origin+location.pathname.replace(/[^/]*$/,'')+'ecoute.html#f='+f+'&t='+encodeURIComponent(t||'');
function bounceModal(){
  if(!SUPA.url)return toast('Le partage d’un lien d’écoute a besoin d’internet');
  if(location.protocol==='file:')return toast('Ouvrez l’appli depuis son adresse en ligne pour partager un lien d’écoute');
  const ends=P.tracks.flatMap(t=>t.regions.map(r=>r.start+rLen(t,r)));if(!ends.length)return toast('Rien à exporter');
  const title=h('input',{type:'text',value:P.name||'Mon morceau',maxlength:80,style:{width:'240px'},onkeydown:e=>e.stopPropagation()});
  const zone=h('select',null,h('option',{value:'all'},'Tout le morceau'),P.cycle.on&&h('option',{value:'cycle'},'La zone de cycle (boucle)'));
  const q=h('select',null,[[128,'128 kbit/s (léger)'],[192,'192 kbit/s (conseillé)'],[320,'320 kbit/s (meilleure qualité)']].map(([v,n])=>h('option',{value:v,selected:v===192},n)));
  const st=h('div',{style:{margin:'8px 0',minHeight:'18px'}}),bar=h('div',{class:'xb',style:{display:'none'}},h('i')),res=h('div');
  const go=h('button',{style:{padding:'8px 14px'},onclick:async()=>{go.disabled=true;bar.style.display='block';const set=(t,p)=>{st.textContent=t;bar.firstChild.style.width=Math.round(p*100)+'%'};
    try{if(E.playing)E.stop();let a=0,b=Math.max(...ends);if(zone.value==='cycle'){a=P.cycle.start;b=P.cycle.end}
      set('Rendu du mixage…',.05);const buf=await renderMix(P,a,b);
      const mp3=await encodeMP3(buf,+q.value,p=>set('Encodage MP3… '+Math.round(p*100)+' %',.1+p*.5));
      const f=newRoom(),key='bounces/'+f+'.mp3';
      await xhrUpload(SUPA.url+'/storage/v1/object/sons/'+key,mp3,'audio/mpeg',p=>set('Envoi… '+Math.round(p*100)+' %',.6+p*.4));
      set('Prêt ✔ ('+(mp3.size/1048576).toFixed(1)+' Mo, '+Math.round(buf.duration)+' s)',1);const link=bounceLink(f,title.value);
      res.append(linkRow('Lien d’écoute',link,'Écoute « '+title.value+' » 🎧'),h('p',{style:{color:'var(--dim)',fontSize:'11px'}},'Le lien s’ouvre sur n’importe quel téléphone ou ordinateur, sans l’appli. Toute personne qui a le lien peut écouter et télécharger le MP3.'));
      if(COLLAB.on&&COLLAB.synced&&!COLLAB.viewer)chatSend('📀 a partagé un bounce',{b:{f,title:title.value,dur:Math.round(buf.duration)}})}
    catch(e){console.warn(e);st.textContent='⚠ '+e.message;go.disabled=false}}},'📀 Créer le lien');
  modal([h('h2',null,'📀 Partager un lien d’écoute (MP3)'),h('p',{style:{color:'var(--dim)'}},'Le morceau est mixé, encodé en MP3 puis mis en ligne. Vous obtenez un lien à envoyer : on l’écoute sur téléphone sans ouvrir l’appli.'),
    h('div',{class:'kv2'},'Titre',title),h('div',{class:'kv2'},'Partie',zone),h('div',{class:'kv2'},'Qualité',q),st,bar,go,res])}

// ---------- 🏷 Marqueurs de structure ----------
const MARK_NAMES=['Intro','Couplet 1','Refrain','Couplet 2','Pont','Couplet 3','Outro'],MARK_COLORS=['#64d2ff','#30d158','#ff9f0a','#bf5af2','#ff453a','#ffd60a','#8e8e93'];
const markArr=()=>P&&(P.marks||(P.marks=[]));
function markAdd(beat,name){const a=markArr();snapshot();a.push({id:uid('k'),beat:Math.max(0,beat),name:name||MARK_NAMES[a.length%MARK_NAMES.length],color:MARK_COLORS[a.length%MARK_COLORS.length]});
  a.sort((p,q)=>p.beat-q.beat);cmtChanged();drawRuler()}
function markSet(id,k,v,noSnap){const m=markArr().find(m=>m.id===id);if(!m)return;if(!noSnap)snapshot();m[k]=v;if(k==='beat')markArr().sort((p,q)=>p.beat-q.beat);cmtChanged();drawRuler()}
function markDel(id){const a=markArr(),i=a.findIndex(m=>m.id===id);if(i<0)return;snapshot();a.splice(i,1);cmtChanged();drawRuler()}
function markMenu(e,m){menu(e,['Marqueur « '+m.name+' »',['✎ Renommer…',()=>{const n=prompt('Nom du marqueur',m.name);if(n)markSet(m.id,'name',n.slice(0,40))}],
  ['🎨 Couleur…',()=>colorPicker(e,{name:m.name,color:m.color,_set:c=>markSet(m.id,'color',c)})],['▶ Aller ici',()=>setPH(m.beat)],'-',['🗑 Supprimer',()=>markDel(m.id)]])}

// ---------- panneau (chat · notes · marqueurs · versions) — redimensionnable, à gauche ou à droite, détachable ----------
try{const o=JSON.parse(localStorage.getItem('studio_cpanel')||'{}');C2.w=o.w||330;C2.side=o.side||'right'}catch(e){C2.w=330;C2.side='right'}
const savePanelPref=()=>{try{localStorage.setItem('studio_cpanel',JSON.stringify({w:C2.w,side:C2.side}))}catch(e){}};
function panelTabs(){return COLLAB.on?[['chat','💬 Chat'],['cmts','📌 Notes'],['marks','🏷'],!COLLAB.viewer&&['vers','🕘']].filter(Boolean):[['cmts','📌 Notes'],['marks','🏷 Marqueurs']]}
function openPanel(tab){C2.open=true;if(tab)C2.tab=tab;if(!panelTabs().some(t=>t[0]===C2.tab))C2.tab=panelTabs()[0][0];
  if(C2.tab==='chat'){C2.unread=0;renderBadge()}if(C2.tab==='vers'&&C2.vers==null)versionsLoad();drawPanel()}
function closePanel(){if(VOC.rec)vocStop(false);C2.open=false;const p=$('#cpanel');if(p)p.remove();if(typeof detachClose==='function')detachClose('chat');C2.hi=null;layoutPanel();renderPins()}
function renderBadge(){const b=$('#collabBar .chatb');if(!b)return;const n=C2.unread;b.dataset.n=n>99?'99+':n||'';b.classList.toggle('has',n>0)}
function layoutPanel(){const det=typeof isDetached==='function'&&isDetached('chat'),on=C2.open&&!!$('#cpanel')&&!det&&innerWidth-C2.w>=1080; // assez de place : l'appli se pousse à côté, sinon le panneau passe par-dessus
  document.body.classList.toggle('cp-open',on);document.body.classList.toggle('cp-tight',on&&innerWidth-C2.w<1400);document.body.classList.toggle('cp-left',on&&C2.side==='left');document.documentElement.style.setProperty('--cpw',(on?C2.w:0)+'px');
  const p=$('#cpanel');if(p){p.classList.toggle('left',C2.side==='left');p.classList.toggle('det',!!det);if(!det)p.style.width=Math.min(C2.w,innerWidth)+'px'}
  setTimeout(()=>{try{drawRuler();schedulePaint()}catch(e){}},0)}
function panelResize(e){if(e.button)return;e.preventDefault();e.stopPropagation();const h0=e.currentTarget;h0.setPointerCapture(e.pointerId);const x0=e.clientX,w0=C2.w;
  const mv=ev=>{C2.w=Math.round(clamp(w0+(C2.side==='right'?x0-ev.clientX:ev.clientX-x0),240,Math.min(760,innerWidth-320)));layoutPanel()};
  const up=()=>{h0.removeEventListener('pointermove',mv);h0.removeEventListener('pointerup',up);savePanelPref()};h0.addEventListener('pointermove',mv);h0.addEventListener('pointerup',up)}
function drawPanel(){
  if(!C2.open){const p=$('#cpanel');if(p)p.remove();layoutPanel();return}
  let p=$('#cpanel');const body0=p&&p.querySelector('.cbody');
  const ae=p&&p.ownerDocument.activeElement;if(p&&ae&&p.contains(ae)&&ae.matches('.cact input,textarea.newc,.cnew input')&&C2.tab!=='chat'){C2.pendingDraw=true;return} // ne pas effacer une réponse en cours
  C2.pendingDraw=false;const keepScroll=body0&&C2.tab!=='chat'?body0.scrollTop:null,draft=p&&p.querySelector('.cin input')?p.querySelector('.cin input').value:'';
  if(!p){p=h('div',{id:'cpanel',onfocusout:()=>setTimeout(()=>{if(C2.pendingDraw)drawPanel()},50)});(typeof panelHost==='function'?panelHost():document.body).append(p)}p.innerHTML='';
  const det=typeof isDetached==='function'&&isDetached('chat');
  p.append(!det&&h('div',{class:'cgrip',title:'Glisser pour élargir / rétrécir',onpointerdown:panelResize}),
    h('div',{class:'ctabs'},panelTabs().map(([k,n])=>h('button',{class:C2.tab===k?'on':'',title:{marks:'Marqueurs de structure',vers:'Versions'}[k]||'',onclick:()=>openPanel(k)},n+(k==='cmts'?' ('+cmtList().filter(c=>!c.done).length+')':''))),h('div',{style:{flex:1}}),
      !det&&h('button',{title:'Mettre le panneau '+(C2.side==='right'?'à gauche':'à droite'),onclick:()=>{C2.side=C2.side==='right'?'left':'right';savePanelPref();layoutPanel()}},'⇆'),
      !IS_TOUCH&&h('button',{title:det?'Remettre dans la fenêtre principale':'Détacher dans une fenêtre (2ᵉ écran)',onclick:()=>det?detachClose('chat'):detachOpen('chat')},det?'⤓':'⧉'),
      h('button',{title:'Fermer',onclick:closePanel},'✕')));
  const body=h('div',{class:'cbody'});p.append(body);layoutPanel();
  if(COLLAB.on&&!COLLAB.synced){body.append(h('p',{class:'dim'},'Connexion à la session…'));return}
  if(C2.tab==='chat'){
    const a=CHAT().toArray();if(!a.length)body.append(h('p',{class:'dim'},'Aucun message. Dites bonjour 👋'));
    for(const m of a){const mine=m.u===ME.id;let content;
      if(m.voc){const au=h('audio',{controls:true,preload:'none',src:vocURL(m.voc)});
        content=h('div',{class:'ctxt cvoc',draggable:!COLLAB.viewer,ondragstart:e=>{e.dataTransfer.setData('text/studio-voc',JSON.stringify({voc:m.voc,n:m.n}));e.dataTransfer.effectAllowed='copy'}},
          au,h('div',{class:'vrow'},h('span',{class:'dim'},'🎤 '+Math.floor(m.voc.dur/60)+':'+String(m.voc.dur%60).padStart(2,'0')),
            !COLLAB.viewer&&h('button',{title:'Ajouter ce vocal au projet (à la tête de lecture). Vous pouvez aussi le glisser sur une piste.',onclick:()=>vocToTrack(m.voc,PH,SEL,m.n)},'➕ Au projet')))}
      else if(m.b)content=h('div',{class:'ctxt'},m.x+' : ',h('a',{href:bounceLink(m.b.f,m.b.title),target:'_blank',rel:'noopener'},'📀 '+m.b.title+' ('+Math.floor(m.b.dur/60)+':'+String(m.b.dur%60).padStart(2,'0')+')'));
      else content=h('div',{class:'ctxt'},m.x);
      body.append(h('div',{class:'cmsg'+(mine?' me':'')},h('div',{class:'cmeta'},h('b',{style:{color:m.c}},m.n),' ',h('span',null,hhmm(m.t))),content))}
    const inp=h('input',{type:'text',placeholder:'Écrire un message…',maxlength:1000,value:draft,onkeydown:e=>{e.stopPropagation();if(e.key==='Enter'){const v=inp.value;inp.value='';chatSend(v)}}});
    const recUI=VOC.rec?h('div',{class:'cin rec'},h('span',{class:'vtime'},'● 0:00 / 2:00'),h('div',{style:{flex:1}}),h('button',{title:'Annuler',onclick:()=>vocStop(false)},'✕'),h('button',{class:'send',onclick:()=>vocStop(true)},'➤ Envoyer'))
      :h('div',{class:'cin'},h('button',{title:'Message vocal (2 min max)',onclick:vocStart},'🎤'),inp,h('button',{onclick:()=>{const v=inp.value;inp.value='';chatSend(v);const ni=$('#cpanel .cin input');if(ni)ni.focus()}},'➤'));
    p.append(h('div',{class:'cquick'},['🔥','👍','😂','🎧','💯','🙏'].map(x=>h('button',{onclick:()=>chatSend(x)},x))),recUI,h('span',{class:'vtime',style:{display:'none'}}));
    setTimeout(()=>{body.scrollTop=body.scrollHeight},0);if(!IS_TOUCH&&!VOC.rec)setTimeout(()=>inp.focus(),0)}
  else if(C2.tab==='cmts'){
    const curAt=()=>C2.newAt!=null?C2.newAt:(E.playing?E.pos():PH);
    const ta=h('textarea',{class:'newc',rows:2,placeholder:'Ex : refais ce couplet ici, drop trop tôt, ad-lib à ajouter…',onkeydown:e=>{e.stopPropagation();if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();add()}}});
    const tsel=h('select',{class:'ntrack',title:'Sur quelle piste ?',onchange:e=>{C2.newTid=e.target.value}},h('option',{value:''},'🎼 Tout le morceau'),P.tracks.map(t=>h('option',{value:t.id,selected:t.id===C2.newTid},tIco(t)+' '+t.name)));
    const add=()=>{const x=ta.value.trim();if(!x)return;const at=curAt(),tid=tsel.value;C2.newAt=null;C2.newTid='';cmtAdd(Math.max(0,at),x,null,tid);ta.value='';toast('📌 Note ajoutée '+fmtBar(at)+(tid?' sur « '+(findTrack(tid)||{}).name+' »':''))};
    body.append(h('div',{class:'cnew'},h('div',{class:'dim cposlbl'},'📌 Nouvelle note '+fmtBar(curAt())+(C2.newAt==null?' (tête de lecture)':'')),tsel,ta,h('div',{style:{display:'flex',gap:'6px'}},h('button',{onclick:add},'Ajouter'),
      C2.newAt!=null&&h('button',{onclick:()=>{C2.newAt=null;C2.newTid='';drawPanel()}},'Revenir à la tête de lecture'))),
      h('p',{class:'dim',style:{fontSize:'11px'}},'Astuce : clic droit sur une piste (ou dans la règle) pour noter à cet endroit précis. Une note reste affichée sur la timeline jusqu’à ce que quelqu’un la supprime. Les notes sont enregistrées avec le projet'+(COLLAB.on?' et partagées avec la session.':'.')));
    const list=cmtList();if(!list.length)body.append(h('p',{class:'dim'},'Aucune note.'));
    for(const c of list){const rep=h('input',{type:'text',placeholder:'Répondre…',maxlength:1000,onkeydown:e=>{e.stopPropagation();if(e.key==='Enter'&&rep.value.trim()){const v=rep.value.trim();rep.value='';rep.blur();cmtReply(c.id,v)}}});
      const canMod=!COLLAB.viewer;
      body.append(h('div',{class:'ccmt'+(c.done?' done':'')+(C2.hi===c.id?' hi':''),style:{'--cc':c.c}},
        h('div',{class:'cmeta'},h('a',{href:'#',onclick:e=>{e.preventDefault();C2.hi=c.id;setPH(c.beat);renderPins();drawPanel()}},'▶ '+fmtBar(c.beat)),c.tid&&findTrack(c.tid)?' · '+tIco(findTrack(c.tid))+' '+findTrack(c.tid).name:' · 🎼',' · ',h('b',{style:{color:c.c}},c.n),' ',h('span',null,hhmm(c.t)),c.done?' · ✔ résolue':''),
        h('div',{class:'ctxt'},c.x),(c.rep||[]).map(r=>h('div',{class:'crep'},h('b',{style:{color:r.c}},r.n),' ',r.x)),
        h('div',{class:'cact'},rep,canMod&&h('button',{title:c.done?'Rouvrir':'Marquer comme résolue',onclick:()=>cmtSet(c.id,'done',!c.done)},c.done?'↺':'✔'),
          canMod&&(c.u===ME.id||!COLLAB.on)&&h('button',{title:'Supprimer',onclick:e=>{if(e.target.dataset.sure){cmtDel(c.id)}else{e.target.dataset.sure=1;e.target.textContent='Sûr ?'}}},'🗑'))))}
    if(keepScroll!=null)body.scrollTop=keepScroll;
    if(C2.hi){const el=body.querySelector('.ccmt.hi');if(el)setTimeout(()=>el.scrollIntoView({block:'nearest'}),0)}}
  else if(C2.tab==='marks'){
    const canMod=!COLLAB.viewer,at=E.playing?E.pos():PH;
    body.append(h('div',{class:'cnew'},h('div',{class:'dim'},'Les marqueurs découpent le morceau (Intro, Couplet, Refrain…). Ils s’affichent dans la règle : clic = y aller, clic droit = renommer / couleur / supprimer, glisser = déplacer.'),
      canMod&&h('div',{style:{display:'flex',gap:'4px',flexWrap:'wrap',marginTop:'6px'}},MARK_NAMES.map(n=>h('button',{onclick:()=>markAdd(snapB(at,P.sig),n)},'+ '+n)))));
    const ms=P.marks||[];if(!ms.length)body.append(h('p',{class:'dim'},'Aucun marqueur. Ajoutez-en à la tête de lecture ('+fmtBar(snapB(at,P.sig))+').'));
    for(const m of ms)body.append(h('div',{class:'ccmt',style:{'--cc':m.color}},h('div',{class:'cmeta'},h('a',{href:'#',onclick:e=>{e.preventDefault();setPH(m.beat)}},'▶ '+fmtBar(m.beat)),' · ',h('b',{style:{color:m.color}},m.name)),
      canMod&&h('div',{class:'cact'},h('input',{type:'text',value:m.name,maxlength:40,onkeydown:e=>{e.stopPropagation();if(e.key==='Enter')e.target.blur()},onchange:e=>markSet(m.id,'name',e.target.value.slice(0,40)||m.name)}),
        h('button',{title:'Couleur',onclick:e=>colorPicker(e,{name:m.name,color:m.color,_set:c=>markSet(m.id,'color',c)})},'🎨'),h('button',{title:'Supprimer',onclick:()=>markDel(m.id)},'🗑'))))}
  else if(C2.tab==='vers'){
    const nom=h('input',{type:'text',placeholder:'Nom (ex : avant le mix)',maxlength:80,onkeydown:e=>{e.stopPropagation();if(e.key==='Enter')save()}});
    const save=async()=>{sv.disabled=true;await versionSave(nom.value);nom.value='';sv.disabled=false};const sv=h('button',{onclick:save},'💾 Sauvegarder');
    body.append(h('div',{class:'cnew'},h('div',{class:'dim'},'Une version garde l’état complet du projet à cet instant. On peut y revenir à tout moment (et annuler avec Ctrl+Z).'),h('div',{style:{display:'flex',gap:'6px',marginTop:'6px'}},nom,sv)));
    if(C2.vers==null)body.append(h('p',{class:'dim'},'Chargement…'));else if(C2.vers==='err')body.append(h('p',{class:'dim'},'⚠ Impossible de lire les versions (connexion ?)'),h('button',{onclick:versionsLoad},'Réessayer'));
    else if(!C2.vers.length)body.append(h('p',{class:'dim'},'Aucune version pour l’instant.'));
    else for(const v of C2.vers)body.append(h('div',{class:'ccmt'},h('div',{class:'cmeta'},h('b',null,v.nom)),h('div',{class:'dim'},new Date(v.cree).toLocaleString()+' · '+(v.auteur||'?')+' · '+Math.max(1,Math.round(v.taille/1024))+' Ko'),
      h('div',{class:'cact'},h('button',{onclick:e=>{if(e.target.dataset.sure)versionRestore(v);else{e.target.dataset.sure=1;e.target.textContent='Revenir à cette version ? Confirmer'}}},'↩ Revenir à cette version'),
        h('button',{title:'Supprimer cette version',onclick:async e=>{if(!e.target.dataset.sure){e.target.dataset.sure=1;e.target.textContent='Sûr ?';return}try{await rpc('version_del',{p_salle:COLLAB.room,p_id:v.id})}catch(err){toast('⚠ '+err.message)}versionsLoad()}},'🗑'))))}}

// ---------- branchements ----------
COLLAB_H.start=doc=>{C2.unread=0;C2.vers=null;C2.hi=null;C2.newAt=null;C2.clk={};doc.getArray('chat').observe(onChatChange)};
COLLAB_H.synced=()=>{
  // v3.3 → v3.4+ : les commentaires étaient dans le document de session ; on les range dans le projet (une seule personne le fait)
  const old=COLLAB.doc.getArray('cmts');if(old.length&&!COLLAB.viewer&&editorIds()[0]===ME.id){const have=new Set(cmtArr().map(c=>c.id)),add=old.toArray().map(m=>m.toJSON?m.toJSON():m).filter(c=>c&&c.id&&!have.has(c.id));
    if(add.length){P.cmts.push(...add);collabFlush()}COLLAB.doc.transact(()=>old.delete(0,old.length),'cmt')}
  renderPins();if(C2.open)drawPanel();COLLAB.timers.push(setInterval(()=>send({k:'ping',t0:Date.now()}),5000));setTimeout(()=>send({k:'ping',t0:Date.now()}),300)};
COLLAB_H.stop=()=>{C2.knownC=null;if(C2.open)openPanel();renderPins()};
COLLAB_H.joined=u=>{if(COLLAB.synced)toast('👋 '+(u.name||'Quelqu’un')+(u.role==='v'?' écoute la session (écoute seule)':' a rejoint la session'),2500);setTimeout(()=>send({k:'ping',t0:Date.now()}),200)};
COLLAB_H.left=u=>{delete C2.clk[u.id]};
COLLAB_H.bar=b=>{
  b.append(h('button',{class:'tbtn ens'+(C2.follow?' on':''),title:C2.follow?'🎧 Écouter ensemble : activé (▶ / ■ partagés). Cliquer pour écouter en solo.':'🎧 Écoute en solo. Cliquer pour écouter ensemble.',onclick:toggleFollow},'🎧'),
    h('button',{class:'tbtn chatb',title:'Chat, notes, marqueurs et versions',onclick:()=>C2.open?closePanel():openPanel(C2.tab==='cmts'&&!C2.unread?'cmts':'chat')},'💬'));renderBadge()};
{const o=renderLanes;renderLanes=function(){const r=o.apply(this,arguments);renderPins();return r}}
{const o=afterLoad;afterLoad=function(){const r=o.apply(this,arguments);C2.knownC=null;renderPins();if(C2.open)drawPanel();try{drawRuler()}catch(e){}return r}}

// la position « tête de lecture » de la nouvelle note se met à jour en direct
setInterval(()=>{if(!C2.open||C2.tab!=='cmts'||C2.newAt!=null||!P)return;const l=$('#cpanel .cposlbl');if(l)l.textContent='📌 Nouvelle note '+fmtBar(E.playing?E.pos():PH)+' (tête de lecture)'},200);
