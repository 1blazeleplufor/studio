// ===== v3.7.6 : dossier d'enregistrement (File System Access API) + export MP3 =====
const FS_OK=typeof window.showDirectoryPicker==='function';
let FSDIR=null,FS_LASTBUF=null;
function fsIdb(){return new Promise((res,rej)=>{const q=indexedDB.open('studio_fs',1);q.onupgradeneeded=()=>q.result.createObjectStore('h');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function fsStore(v){try{const db=await fsIdb();await new Promise(r=>{const tx=db.transaction('h','readwrite');v?tx.objectStore('h').put(v,'dir'):tx.objectStore('h').delete('dir');tx.oncomplete=r;tx.onerror=r})}catch(e){}}
async function fsLoad(){try{const db=await fsIdb();FSDIR=await new Promise(r=>{const q=db.transaction('h').objectStore('h').get('dir');q.onsuccess=()=>r(q.result||null);q.onerror=()=>r(null)})}catch(e){FSDIR=null}return FSDIR}
// renvoie le dossier si l'accès est accordé ; ask=true → redemande l'autorisation (nécessite un clic)
async function fsDir(ask){if(!FS_OK)return null;if(!FSDIR)await fsLoad();if(!FSDIR)return null;
  try{let p=await FSDIR.queryPermission({mode:'readwrite'});if(p!=='granted'&&ask)p=await FSDIR.requestPermission({mode:'readwrite'});return p==='granted'?FSDIR:null}catch(e){return null}}
const fsClean=s=>String(s||'sans nom').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim().slice(0,80)||'sans nom';
async function fsWrite(parts,name,blob,ask){const d=await fsDir(ask);if(!d)return false;
  try{let cur=d;for(const p of parts)cur=await cur.getDirectoryHandle(fsClean(p),{create:true});
    const fh=await cur.getFileHandle(fsClean(name),{create:true}),w=await fh.createWritable();await w.write(blob);await w.close();return true}
  catch(e){console.warn('dossier :',e);return false}}
// sortie d'un export : dossier choisi (sous-dossier Projet/Exports) sinon Téléchargements
async function saveOut(blob,name){if(await fsWrite([P.name||'Projet','Exports'],name,blob,true))return 'dossier';await download(blob,name);return 'dl'}
const fsStamp=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+' '+z(d.getHours())+'h'+z(d.getMinutes())+'m'+z(d.getSeconds())};

// ---- prises : copie WAV automatique dans le dossier ----
{const o=Engine.prototype.stopRec;Engine.prototype.stopRec=function(){const b=o.apply(this,arguments);FS_LASTBUF=b||null;return b}}
{const o=stopRecord;stopRecord=function(){const r=REC;FS_LASTBUF=null;const res=o.apply(this,arguments);const buf=FS_LASTBUF;FS_LASTBUF=null;
  if(buf&&r&&FSDIR){const tr=(r.tracks||[]).map(findTrack).filter(Boolean),t=tr[0],n=t?t.regions.length:1;
    const name=(t?t.name:'Piste')+' - Prise '+n+' - '+fsStamp()+'.wav';
    fsWrite([P.name||'Projet','Prises'],name,wavEncode(buf),false).then(ok=>{if(!ok)fsNeedPerm()})}
  return res}}
let FS_WARNED=false;
function fsNeedPerm(){if(FS_WARNED)return;FS_WARNED=true;toast('Prise gardée dans Studio, mais pas copiée dans votre dossier : ouvrez ⚙ Réglages → « Autoriser » le dossier d’enregistrement.',7000)}

// ---- choix du dossier ----
async function fsPick(){try{const d=await window.showDirectoryPicker({id:'studio-rec',mode:'readwrite',startIn:'music'});FSDIR=d;FS_WARNED=false;await fsStore(d);toast('Dossier d’enregistrement : 📁 '+d.name);return d}
  catch(e){if(e.name!=='AbortError')toast('Impossible d’utiliser ce dossier : '+e.message,5000);return null}}
async function fsCopyAll(){const d=await fsDir(true);if(!d)return toast('Choisissez d’abord un dossier');let n=0,i=0;const seen=new Set();
  for(const t of P.tracks)for(const r of t.regions){if(seen.has(r.buf))continue;seen.add(r.buf);const b=BUFS[r.buf];if(!b||!b.getChannelData)continue;i++;
    toast('Copie des sons… '+i,60000);if(await fsWrite([P.name||'Projet','Sons'],t.name+' - '+(r.name||'son')+' - '+r.buf+'.wav',wavEncode(b),false))n++}
  toast(n?n+' son(s) copiés dans 📁 '+d.name+' / '+fsClean(P.name||'Projet')+' / Sons':'Aucun son à copier',5000)}
function fsRow(){const box=h('div');const draw=async()=>{box.innerHTML='';
  if(!FS_OK){box.append(h('div',{class:'kv2'},'Dossier d’enregistrement',h('span',null,'Interne au navigateur')),h('div',{style:{color:'var(--dim)',fontSize:'11px'}},'Choisir un dossier n’est possible que dans Chrome ou Edge sur ordinateur. Vos prises restent sauvegardées dans Studio (mémoire du navigateur).'));return}
  if(!FSDIR)await fsLoad();const ok=FSDIR&&await fsDir(false);
  const lab=!FSDIR?h('span',null,'Interne au navigateur (pas de fichiers)'):h('span',null,'📁 '+FSDIR.name+(ok?'':' (à autoriser)'));
  box.append(h('div',{class:'kv2'},'Dossier d’enregistrement',lab),
    h('div',{style:{display:'flex',gap:'6px',flexWrap:'wrap',margin:'4px 0'}},
      h('button',{onclick:async()=>{if(await fsPick())draw()}},FSDIR?'Changer de dossier…':'📁 Choisir un dossier…'),
      FSDIR&&!ok&&h('button',{onclick:async()=>{await fsDir(true);draw()}},'🔓 Autoriser'),
      FSDIR&&h('button',{title:'Écrit tous les sons du projet en WAV dans le dossier',onclick:fsCopyAll},'Copier les sons du projet'),
      FSDIR&&h('button',{onclick:async()=>{FSDIR=null;await fsStore(null);toast('Dossier retiré : les exports repartent dans Téléchargements');draw()}},'Ne plus utiliser')),
    h('div',{style:{color:'var(--dim)',fontSize:'11px'}},FSDIR?'Chaque prise est copiée en WAV dans « '+fsClean(P.name||'Projet')+' / Prises », les exports vont dans « '+fsClean(P.name||'Projet')+' / Exports ». Le navigateur ne montre que le nom du dossier, pas son chemin complet (sécurité). Les prises restent aussi gardées dans Studio.':'Aujourd’hui vos prises sont gardées dans la mémoire de Chrome (pas de fichiers visibles) et les exports vont dans Téléchargements. Choisissez un dossier pour avoir vos prises en WAV et vos exports directement dedans.'))};
  draw();return box}
{const o=settingsModal;settingsModal=async function(){const r=await o.apply(this,arguments);const ms=document.querySelectorAll('.modal .box'),b=ms[ms.length-1];if(!b)return r;
  const rows=[...b.querySelectorAll('.kv2')],ref=rows.find(x=>/Compensation de latence/.test(x.textContent));const row=fsRow();
  if(ref){const n=ref.nextElementSibling;(n&&!n.classList.contains('kv2')?n:ref).after(row)}else b.append(row);return r}}
