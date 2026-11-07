// ===== v3.3 : écouter ensemble, chat, commentaires sur la timeline, versions, bounce MP3 =====
// Données partagées (même Y.Doc que le projet, hors de la carte « p ») : chat = Y.Array, cmts = Y.Array<Y.Map>.
// Les auditeurs (lien écoute seule) envoient chat et commentaires en message « vmsg » ; le relais les ajoute au document.
const C2={follow:true,clk:{},seenTP:new Set(),tpToast:0,unread:0,open:false,tab:'chat',showDone:false,hi:null,vers:null,applying:false};
try{C2.follow=localStorage.getItem('studio_follow')!=='0'}catch(e){}
const CHAT=()=>COLLAB.doc&&COLLAB.doc.getArray('chat'),CMTS=()=>COLLAB.doc&&COLLAB.doc.getArray('cmts');
const meUser=()=>({u:ME.id,n:ME.name||'?',c:ME.color});
const fmtBar=b=>{const s=P?P.sig:4;return'mesure '+(Math.floor(b/s)+1)+(b%s>.01?' · temps '+(Math.floor(b%s)+1):'')};
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
  if(m.kind==='cmt'&&m.x&&typeof m.beat==='number')cmtAdd(m.beat,String(m.x).slice(0,1000),who);
  if(m.kind==='rep'&&m.x&&m.cid)cmtReply(m.cid,String(m.x).slice(0,1000),who)};
function onChatChange(ev){
  if(ev.transaction.origin==='remote'||ev.transaction.origin==='relay'){const added=[];ev.changes.added.forEach(it=>it.content.getContent().forEach(x=>added.push(x)));
    const others=added.filter(x=>x&&x.u!==ME.id);if(others.length&&!(C2.open&&C2.tab==='chat')){C2.unread+=others.length;const l=others[others.length-1];toast('💬 '+l.n+' : '+(l.b?'📀 '+l.b.title:l.x).slice(0,80),3500)}}
  renderBadge();if(C2.open&&C2.tab==='chat')drawPanel()}

// ---------- 📌 Commentaires sur la timeline ----------
function cmtAdd(beat,x,who){if(!COLLAB.synced)return;if(COLLAB.viewer&&!who)return send({k:'vmsg',kind:'cmt',beat,x});
  const w=who||meUser(),m=new Y.Map();COLLAB.doc.transact(()=>{m.set('id',uid('c'));m.set('beat',beat);m.set('u',w.u);m.set('n',w.n);m.set('c',w.c);m.set('t',Date.now());m.set('x',x);m.set('done',false);m.set('rep',new Y.Array());CMTS().push([m])},'cmt')}
const cmtFind=id=>{const a=CMTS();if(!a)return null;for(let i=0;i<a.length;i++)if(a.get(i).get('id')===id)return[a.get(i),i];return null};
function cmtReply(id,x,who){if(COLLAB.viewer&&!who)return send({k:'vmsg',kind:'rep',cid:id,x});const f=cmtFind(id);if(!f)return;
  COLLAB.doc.transact(()=>f[0].get('rep').push([Object.assign({t:Date.now(),x},who||meUser())]),'cmt')}
function cmtSet(id,k,v){const f=cmtFind(id);if(f)COLLAB.doc.transact(()=>f[0].set(k,v),'cmt')}
function cmtDel(id){const f=cmtFind(id);if(f)COLLAB.doc.transact(()=>CMTS().delete(f[1],1),'cmt')}
const cmtList=()=>{const a=CMTS();return a?a.toArray().map(m=>m.toJSON()).sort((p,q)=>p.beat-q.beat):[]};
function onCmtChange(ev,tr){
  if(tr.origin==='remote'||tr.origin==='relay'){for(const e of ev)if(e.target===CMTS())e.changes.added.forEach(it=>it.content.getContent().forEach(m=>{const j=m.toJSON?m.toJSON():m;
    if(j.u!==ME.id)toast('📌 '+j.n+' a commenté '+fmtBar(j.beat)+' : '+String(j.x).slice(0,60),3500)}))}
  renderPins();if(C2.open&&C2.tab==='cmts')drawPanel()}
function renderPins(){
  document.querySelectorAll('#lanes .cpin,#lanes .cline').forEach(e=>e.remove());if(!COLLAB.on||!COLLAB.synced)return;const L=$('#lanes');if(!L)return;
  for(const c of cmtList()){if(c.done&&!C2.showDone)continue;const x=c.beat*PPB;
    L.append(h('div',{class:'cline'+(c.done?' done':''),style:{left:x+'px','--cc':c.c}}),
      h('div',{class:'cpin'+(c.done?' done':'')+(C2.hi===c.id?' hi':''),style:{left:x+'px','--cc':c.c},title:c.n+' ('+fmtBar(c.beat)+') : '+c.x,
        onpointerdown:e=>e.stopPropagation(),onclick:e=>{e.stopPropagation();C2.hi=c.id;openPanel('cmts')}},'📌 '+(c.n||'?').slice(0,1).toUpperCase()+((c.rep&&c.rep.length)?' '+(c.rep.length+1):'')))}}
function askComment(beat){openPanel('cmts');C2.newAt=beat;drawPanel();setTimeout(()=>{const t=$('#cpanel textarea.newc');if(t)t.focus()},30)}

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

// ---------- panneau (chat · commentaires · versions) ----------
function openPanel(tab){C2.open=true;if(tab)C2.tab=tab;if(C2.tab==='chat'){C2.unread=0;renderBadge()}if(C2.tab==='vers'&&C2.vers==null)versionsLoad();drawPanel()}
function closePanel(){C2.open=false;const p=$('#cpanel');if(p)p.remove();C2.hi=null;renderPins()}
function renderBadge(){const b=$('#collabBar .chatb');if(!b)return;const n=C2.unread;b.dataset.n=n>99?'99+':n||'';b.classList.toggle('has',n>0)}
function drawPanel(){
  if(!C2.open||!COLLAB.on){const p=$('#cpanel');if(p)p.remove();return}
  let p=$('#cpanel');const keepScroll=p&&p.querySelector('.cbody')&&C2.tab!=='chat'?p.querySelector('.cbody').scrollTop:null;
  const draft=p&&p.querySelector('.cin input')?p.querySelector('.cin input').value:'';
  if(!p){p=h('div',{id:'cpanel'});document.body.append(p)}p.innerHTML='';
  const tabs=[['chat','💬 Chat'],['cmts','📌 Commentaires'],!COLLAB.viewer&&['vers','🕘 Versions']].filter(Boolean);
  p.append(h('div',{class:'ctabs'},tabs.map(([k,n])=>h('button',{class:C2.tab===k?'on':'',onclick:()=>openPanel(k)},n+(k==='cmts'?' ('+cmtList().filter(c=>!c.done).length+')':''))),h('div',{style:{flex:1}}),h('button',{title:'Fermer',onclick:closePanel},'✕')));
  const body=h('div',{class:'cbody'});p.append(body);
  if(!COLLAB.synced){body.append(h('p',{class:'dim'},'Connexion à la session…'));return}
  if(C2.tab==='chat'){
    const a=CHAT().toArray();if(!a.length)body.append(h('p',{class:'dim'},'Aucun message. Dites bonjour 👋'));
    for(const m of a){const mine=m.u===ME.id;body.append(h('div',{class:'cmsg'+(mine?' me':'')},h('div',{class:'cmeta'},h('b',{style:{color:m.c}},m.n),' ',h('span',null,hhmm(m.t))),
      m.b?h('div',{class:'ctxt'},m.x+' : ',h('a',{href:bounceLink(m.b.f,m.b.title),target:'_blank',rel:'noopener'},'📀 '+m.b.title+' ('+Math.floor(m.b.dur/60)+':'+String(m.b.dur%60).padStart(2,'0')+')')):h('div',{class:'ctxt'},m.x)))}
    const inp=h('input',{type:'text',placeholder:'Écrire un message…',maxlength:1000,value:draft,onkeydown:e=>{e.stopPropagation();if(e.key==='Enter'){chatSend(inp.value);inp.value=''}}});
    p.append(h('div',{class:'cquick'},['🔥','👍','😂','🎧','💯','🙏'].map(x=>h('button',{onclick:()=>chatSend(x)},x))),h('div',{class:'cin'},inp,h('button',{onclick:()=>{chatSend(inp.value);inp.value='';inp.focus()}},'➤')));
    setTimeout(()=>{body.scrollTop=body.scrollHeight},0);if(!IS_TOUCH)setTimeout(()=>inp.focus(),0)}
  else if(C2.tab==='cmts'){
    const at=C2.newAt!=null?C2.newAt:(E.playing?E.pos():PH);
    const ta=h('textarea',{class:'newc',rows:2,placeholder:'Ex : refais ce couplet ici, drop trop tôt…',onkeydown:e=>{e.stopPropagation();if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();add()}}});
    const add=()=>{const x=ta.value.trim();if(!x)return;cmtAdd(Math.max(0,at),x);C2.newAt=null;ta.value='';toast('📌 Commentaire ajouté '+fmtBar(at))};
    body.append(h('div',{class:'cnew'},h('div',{class:'dim'},'📌 Nouveau commentaire '+fmtBar(at)+(C2.newAt==null?' (tête de lecture)':'')),ta,h('div',{style:{display:'flex',gap:'6px'}},h('button',{onclick:add},'Ajouter'),
      C2.newAt!=null&&h('button',{onclick:()=>{C2.newAt=null;drawPanel()}},'Annuler'))),
      h('label',{class:'dim',style:{display:'flex',gap:'6px',alignItems:'center',margin:'6px 0'}},h('input',{type:'checkbox',checked:C2.showDone,onchange:e=>{C2.showDone=e.target.checked;drawPanel();renderPins()}}),'Afficher les commentaires résolus'),
      h('p',{class:'dim',style:{fontSize:'11px'}},'Astuce : clic droit (ou appui long) dans la règle pour commenter à un endroit précis.'));
    const list=cmtList().filter(c=>C2.showDone||!c.done);if(!list.length)body.append(h('p',{class:'dim'},'Aucun commentaire.'));
    for(const c of list){const rep=h('input',{type:'text',placeholder:'Répondre…',maxlength:1000,onkeydown:e=>{e.stopPropagation();if(e.key==='Enter'&&rep.value.trim()){cmtReply(c.id,rep.value.trim());rep.value=''}}});
      const canMod=!COLLAB.viewer;
      body.append(h('div',{class:'ccmt'+(c.done?' done':'')+(C2.hi===c.id?' hi':''),style:{'--cc':c.c}},
        h('div',{class:'cmeta'},h('a',{href:'#',onclick:e=>{e.preventDefault();C2.hi=c.id;setPH(c.beat);renderPins();drawPanel()}},'▶ '+fmtBar(c.beat)),' · ',h('b',{style:{color:c.c}},c.n),' ',h('span',null,hhmm(c.t))),
        h('div',{class:'ctxt'},c.x),(c.rep||[]).map(r=>h('div',{class:'crep'},h('b',{style:{color:r.c}},r.n),' ',r.x)),
        h('div',{class:'cact'},rep,canMod&&h('button',{title:c.done?'Rouvrir':'Marquer comme résolu',onclick:()=>cmtSet(c.id,'done',!c.done)},c.done?'↺':'✔'),
          canMod&&(c.u===ME.id)&&h('button',{title:'Supprimer',onclick:e=>{if(e.target.dataset.sure){cmtDel(c.id)}else{e.target.dataset.sure=1;e.target.textContent='Sûr ?'}}},'🗑'))))}
    if(keepScroll!=null)body.scrollTop=keepScroll;
    if(C2.hi){const el=body.querySelector('.ccmt.hi');if(el)setTimeout(()=>el.scrollIntoView({block:'nearest'}),0)}}
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
COLLAB_H.start=doc=>{C2.unread=0;C2.vers=null;C2.hi=null;C2.newAt=null;C2.clk={};
  doc.getArray('chat').observe(onChatChange);doc.getArray('cmts').observeDeep(onCmtChange)};
COLLAB_H.synced=()=>{renderPins();if(C2.open)drawPanel();COLLAB.timers.push(setInterval(()=>send({k:'ping',t0:Date.now()}),5000));setTimeout(()=>send({k:'ping',t0:Date.now()}),300)};
COLLAB_H.stop=()=>{closePanel();renderPins()};
COLLAB_H.joined=u=>{if(COLLAB.synced)toast('👋 '+(u.name||'Quelqu’un')+(u.role==='v'?' écoute la session (écoute seule)':' a rejoint la session'),2500);setTimeout(()=>send({k:'ping',t0:Date.now()}),200)};
COLLAB_H.left=u=>{delete C2.clk[u.id]};
COLLAB_H.bar=b=>{
  b.append(h('button',{class:'tbtn ens'+(C2.follow?' on':''),title:C2.follow?'🎧 Écouter ensemble : activé (▶ / ■ partagés). Cliquer pour écouter en solo.':'🎧 Écoute en solo. Cliquer pour écouter ensemble.',onclick:toggleFollow},'🎧'),
    h('button',{class:'tbtn chatb',title:'Chat, commentaires et versions',onclick:()=>C2.open?closePanel():openPanel()},'💬'));renderBadge()};
{const o=renderLanes;renderLanes=function(){const r=o.apply(this,arguments);if(COLLAB.on)renderPins();return r}}
document.addEventListener('contextmenu',e=>{if(!COLLAB.on||!COLLAB.synced||!e.target.closest||!e.target.closest('#ruler'))return;e.preventDefault();e.stopPropagation();
  const R=$('#ruler').getBoundingClientRect(),b=Math.max(0,snapB((e.clientX-R.left+$('#lanesWrap').scrollLeft)/PPB,1));
  menu(e,['Commentaire',['📌 Commenter ici ('+fmtBar(b)+')',()=>askComment(b)],['💬 Ouvrir le chat',()=>openPanel('chat')]])},true);
