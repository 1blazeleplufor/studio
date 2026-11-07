// ===== Appli : sauvegarde auto (IndexedDB), Mes projets, installation, tactile =====
const IDB={db:null,
  open(){if(this.db)return Promise.resolve(this.db);return new Promise((res,rej)=>{const r=indexedDB.open('studio',1);
    r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('projects'))d.createObjectStore('projects',{keyPath:'id'});if(!d.objectStoreNames.contains('buffers'))d.createObjectStore('buffers')};
    r.onsuccess=()=>res(this.db=r.result);r.onerror=()=>rej(r.error)})},
  async run(store,mode,fn){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(store,mode),s=t.objectStore(store);let out;const q=fn(s);if(q)q.onsuccess=()=>out=q.result;t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})},
  put(st,v,k){return this.run(st,'readwrite',s=>k!==undefined?s.put(v,k):s.put(v))},get(st,k){return this.run(st,'readonly',s=>s.get(k))},
  all(st){return this.run(st,'readonly',s=>s.getAll())},keys(st){return this.run(st,'readonly',s=>s.getAllKeys())},del(st,k){return this.run(st,'readwrite',s=>s.delete(k))}};
let LAST_SAVED='',SAVED_BUFS=new Set(),SAVING=false,LAST_SAVE_T=0;
function updateSaveState(){const b=$('#saveState');if(!b||!P)return;const ok=LAST_SAVED&&JSON.stringify(P)===LAST_SAVED;b.style.color=ok?'#30d158':'#ff9f0a';
  b.title=ok?'Projet sauvegardé'+(LAST_SAVE_T?' à '+new Date(LAST_SAVE_T).toLocaleTimeString():'')+' (cliquer pour sauvegarder)':'Modifications pas encore sauvegardées : cliquer pour sauvegarder maintenant'}
function usedBufs(pr){const u=new Set();for(const t of pr.tracks)if(t.type==='audio')for(const r of t.regions)u.add(r.buf);return u}
async function saveLocal(force){
  if(SAVING||!P||REC)return;if(!P.id)P.id=uid('p');for(const k in EXT_SRC)P.ext[k]=EXT_SRC[k];
  const js=JSON.stringify(P);if(js===LAST_SAVED&&!force)return;SAVING=true;
  try{for(const id of usedBufs(P)){if(SAVED_BUFS.has(id)||!BUFS[id])continue;const b=BUFS[id],data=[];for(let c=0;c<b.numberOfChannels;c++)data.push(b.getChannelData(c).slice());
      await IDB.put('buffers',{sr:b.sampleRate,ch:b.numberOfChannels,len:b.length,data},id);SAVED_BUFS.add(id)}
    await IDB.put('projects',{id:P.id,name:P.name,updated:Date.now(),bpm:P.bpm,tracks:P.tracks.length,json:js});LAST_SAVED=js;LAST_SAVE_T=Date.now();
    try{localStorage.setItem('studio_last',P.id)}catch(e){}updateSaveState()}
  catch(e){console.warn('Sauvegarde locale impossible',e)}finally{SAVING=false}
}
async function loadLocal(id){
  const rec=await IDB.get('projects',id);if(!rec)throw new Error('Projet introuvable');const pr=JSON.parse(rec.json);
  for(const bid of usedBufs(pr)){if(BUFS[bid])continue;const b=await IDB.get('buffers',bid);if(!b)continue;const ab=ctx.createBuffer(b.ch,b.len,b.sr);b.data.forEach((d,c)=>ab.copyToChannel(d,c));addBuffer(ab,bid);SAVED_BUFS.add(bid)}
  for(const k in (pr.ext||{}))try{loadExternalPlugin(pr.ext[k])}catch(e){console.warn(e)}
  E.stop();P=pr;P.midiMap=P.midiMap||{};P.ext=P.ext||{};UNDO=[];REDO=[];PH=0;SEL=P.tracks[0]&&P.tracks[0].id;SELR.clear();EDIT=null;afterLoad();LAST_SAVED=rec.json;
  try{localStorage.setItem('studio_last',P.id)}catch(e){}
}
async function switchProject(fn){await saveLocal();E.stop();fn();P.id=uid('p');UNDO=[];REDO=[];PH=0;SEL=P.tracks[0]&&P.tracks[0].id;SELR.clear();EDIT=null;afterLoad();LAST_SAVED='';await saveLocal(true)}
async function projectsModal(){
  await saveLocal();let list=[];try{list=(await IDB.all('projects')).sort((a,b)=>b.updated-a.updated)}catch(e){}
  const box=h('div');const m=modal(box);
  const draw=()=>{box.innerHTML='';box.append(h('h2',null,'📂 Mes projets'),h('p',{style:{color:'var(--dim)',fontSize:'11px'}},'Vos projets sont sauvegardés automatiquement dans cet appareil. Pour passer un projet sur un autre appareil : Fichier → Exporter le projet (.studio), puis Importer sur l’autre.'),
    h('div',{class:'row',style:{display:'flex',gap:'6px',margin:'8px 0',flexWrap:'wrap'}},
      h('button',{onclick:()=>{m.remove();switchProject(()=>newProject(false))}},'+ Nouveau projet vide'),h('button',{onclick:()=>{m.remove();switchProject(()=>newProject(true))}},'+ Nouveau projet démo'),h('button',{onclick:()=>{m.remove();$('#fileProj').click()}},'📥 Importer un .studio')));
    for(const p of list){const cur=P&&p.id===P.id;
      box.append(h('div',{class:'kv2',style:{background:cur?'#2b3f5c':'#1e1e20',padding:'8px',borderRadius:'6px'}},
        h('div',{style:{cursor:'pointer',flex:1},onclick:async()=>{m.remove();if(cur)return;await saveLocal();try{await loadLocal(p.id);toast('Projet ouvert : '+p.name)}catch(e){alert(e.message)}}},h('b',null,(cur?'▶ ':'')+p.name),h('div',{style:{color:'var(--dim)',fontSize:'11px'}},new Date(p.updated).toLocaleString()+' · '+p.tracks+' pistes · '+p.bpm+' BPM')),
        h('button',{title:'Renommer',onclick:async()=>{const n=prompt('Nom du projet',p.name);if(!n)return;if(cur){P.name=n;renderBar();await saveLocal(true)}else{const rec=await IDB.get('projects',p.id),pr=JSON.parse(rec.json);pr.name=n;rec.name=n;rec.json=JSON.stringify(pr);await IDB.put('projects',rec)}p.name=n;draw()}},'✎'),
        h('button',{title:'Supprimer',onclick:async()=>{if(cur)return alert('C’est le projet ouvert : ouvrez-en un autre avant de le supprimer.');if(!confirm('Supprimer « '+p.name+' » définitivement ?'))return;await IDB.del('projects',p.id);list=list.filter(x=>x!==p);await cleanBuffers();draw()}},'🗑')))}
    if(!list.length)box.append(h('p',null,'Aucun projet sauvegardé pour l’instant.'))};
  draw();
}
async function cleanBuffers(){try{const keep=new Set();for(const p of await IDB.all('projects'))for(const id of usedBufs(JSON.parse(p.json)))keep.add(id);for(const id of usedBufs(P))keep.add(id);
  for(const k of await IDB.keys('buffers'))if(!keep.has(k)){await IDB.del('buffers',k);SAVED_BUFS.delete(k)}}catch(e){console.warn(e)}}
// ---- installation ----
let INSTALL_EVT=null;const IS_STANDALONE=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();INSTALL_EVT=e});
addEventListener('appinstalled',()=>{INSTALL_EVT=null;const b=$('#bInstall');if(b)b.style.display='none';toast('Appli installée ✔')});
async function installApp(){
  if(INSTALL_EVT){INSTALL_EVT.prompt();await INSTALL_EVT.userChoice;INSTALL_EVT=null;return}
  if(location.protocol==='file:')return modal(h('div',{html:`<h2>Installer l’appli</h2><p>Vous avez ouvert le fichier directement. Pour l’installer comme une appli (ordinateur, téléphone, tablette), il faut l’ouvrir depuis son adresse en ligne (https://…), voir le guide fourni.</p>`}));
  const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1),mac=/Macintosh/.test(ua)&&!ios,android=/Android/.test(ua);
  modal(h('div',{html:`<h2>Installer Studio</h2>${ios?`<p><b>iPhone / iPad (Safari)</b> : touchez le bouton <b>Partager</b> <span style="font-size:16px">⬆︎</span> puis <b>« Sur l’écran d’accueil »</b> → Ajouter.</p>`:''}
  ${android?`<p><b>Android (Chrome)</b> : menu <b>⋮</b> → <b>« Installer l’application »</b> (ou « Ajouter à l’écran d’accueil »).</p>`:''}
  ${mac?`<p><b>Mac</b> : dans Safari, menu <b>Fichier → « Ajouter au Dock »</b>. Dans Chrome : icône d’installation à droite de la barre d’adresse.</p>`:''}
  ${!ios&&!android&&!mac?`<p><b>Windows</b> : dans Edge ou Chrome, cliquez l’icône <b>Installer</b> ⊕ à droite de la barre d’adresse (ou menu ⋯ → Applications → Installer).</p>`:''}
  <p style="color:var(--dim)">Une fois installée, l’appli s’ouvre en plein écran depuis son icône et fonctionne sans internet.</p>`}));
}
// ---- tactile : appui long = clic droit ----
(function(){let lp=null,lastCtx=0;
  document.addEventListener('contextmenu',()=>{lastCtx=Date.now()},true);
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;if(lp)clearTimeout(lp.t);const x=e.clientX,y=e.clientY;
    lp={x,y,t:setTimeout(()=>{lp=null;if(Date.now()-lastCtx<900)return;const el=document.elementFromPoint(x,y);if(!el)return;if(navigator.vibrate)navigator.vibrate(12);
      el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x,clientY:y}))},550)}},true);
  document.addEventListener('pointermove',e=>{if(lp&&Math.hypot(e.clientX-lp.x,e.clientY-lp.y)>10){clearTimeout(lp.t);lp=null}},true);
  for(const ev of ['pointerup','pointercancel'])document.addEventListener(ev,()=>{if(lp){clearTimeout(lp.t);lp=null}},true);
})();
function initApp(){
  if(navigator.audioSession)try{navigator.audioSession.type='playback'}catch(e){}
  if('serviceWorker' in navigator&&location.protocol.startsWith('http')){const had=!!navigator.serviceWorker.controller;navigator.serviceWorker.register('sw.js').then(r=>r.update()).catch(e=>console.warn(e));
    let done=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!had||done||REC)return;done=true;saveLocal(true).finally(()=>location.reload())})}
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
  setInterval(()=>saveLocal(),8000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveLocal()});addEventListener('pagehide',()=>saveLocal());
  setInterval(updateSaveState,1000);
}
