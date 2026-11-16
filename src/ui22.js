// ===== v3.12 : importer des pistes d'un autre projet =====
// Source : un projet de « Mes projets » (même appareil) ou un fichier .studio.
// Les pistes arrivent avec leur son, leurs effets, volume, pan, envois vers les bus et leur dossier.
function trkIco(t){return isInstru(t)?'🎵':({audio:'🎤',synth:'🎹',drums:'🥁'}[t.type]||'🎚')}

async function readStudioFile(f){
  const ab=await f.arrayBuffer();if(ab.byteLength<8)throw new Error('fichier vide');
  const hd=new Uint32Array(ab,0,2);if(hd[0]!==0x53545544)throw new Error('ce n’est pas un fichier .studio');
  const len=hd[1],j=JSON.parse(new TextDecoder().decode(new Uint8Array(ab,8,len)));let off=8+len+(4-len%4)%4;const at={};
  for(const m of j.buffers||[]){at[m.id]={m,off};off+=m.len*4*m.ch}
  return{project:j.project,name:j.project.name||f.name.replace(/\.studio$/i,''),local:false,
    getBuf:id=>{const x=at[id];if(!x)return null;const b=ctx.createBuffer(x.m.ch,x.m.len,x.m.sr);let o=x.off;
      for(let c=0;c<x.m.ch;c++){b.copyToChannel(new Float32Array(ab.slice(o,o+x.m.len*4)),c);o+=x.m.len*4}return b}}
}
async function readLocalProject(id){
  const rec=await IDB.get('projects',id);if(!rec)throw new Error('projet introuvable');const pr=JSON.parse(rec.json);
  return{project:pr,name:pr.name||rec.name,local:true,
    getBuf:async bid=>{if(BUFS[bid])return BUFS[bid];const b=await IDB.get('buffers',bid);if(!b)return null;
      const ab=ctx.createBuffer(b.ch,b.len,b.sr);b.data.forEach((d,c)=>ab.copyToChannel(d,c));return ab}}
}

async function importTracksDialog(){
  try{if(typeof saveLocal==='function')await saveLocal()}catch(e){}
  let list=[];try{list=(await IDB.all('projects')).filter(p=>!P||p.id!==P.id).sort((a,b)=>b.updated-a.updated)}catch(e){}
  const box=h('div',{class:'imptr'});const m=modal(box);
  const open=async get=>{try{toast('Lecture du projet…',60000);const src=await get();$('#toast').style.display='none';m.remove();pickTracksDialog(src)}
    catch(err){console.error(err);$('#toast').style.display='none';alert('Impossible de lire ce projet : '+err.message)}};
  const fi=h('input',{type:'file',hidden:true,onchange:e=>{const f=e.target.files[0];e.target.value='';if(f)open(()=>readStudioFile(f))}});
  box.append(h('h2',null,'📥 Importer des pistes'),
    h('p',{class:'muted'},'Choisis le projet où sont les pistes à copier. Elles arrivent dans ton projet actuel avec leur son, leurs effets et leurs réglages. L’autre projet n’est pas modifié.'),
    fi,h('button',{class:'imfile',onclick:()=>fi.click()},'📁 Choisir un fichier .studio'),
    h('h4',null,'Ou dans Mes projets'));
  if(!list.length)box.append(h('p',{class:'muted'},'Aucun autre projet sur cet appareil.'));
  for(const p of list)box.append(h('button',{class:'imrow',onclick:()=>open(()=>readLocalProject(p.id))},
    h('b',null,p.name),h('small',null,new Date(p.updated).toLocaleDateString()+' · '+p.tracks+' piste'+(p.tracks>1?'s':'')+' · '+p.bpm+' BPM')));
  box.append(h('div',{class:'imfoot'},h('button',{onclick:()=>m.remove()},'Annuler')));
}

function pickTracksDialog(src){
  const pr=src.project,ts=pr.tracks||[];
  if(!ts.length)return alert('« '+src.name+' » ne contient aucune piste.');
  const fold=t=>t.fold&&(pr.folders||[]).find(f=>f.id===t.fold);
  const chk={};const box=h('div',{class:'imptr'});const m=modal(box);
  const btn=h('button',{class:'imgo'});
  const upd=()=>{const n=ts.filter(t=>chk[t.id].checked).length;btn.textContent=n?'Importer '+n+' piste'+(n>1?'s':''):'Coche au moins une piste';btn.disabled=!n};
  const rows=h('div',{class:'imlist'});let lastF=null;
  for(const t of ts){const f=fold(t);
    if(f&&f!==lastF){const cb=h('input',{type:'checkbox',onchange:e=>{ts.filter(x=>fold(x)===f).forEach(x=>chk[x.id].checked=e.target.checked);upd()}});
      rows.append(h('label',{class:'imf'},cb,'📁 '+f.name))}
    lastF=f;
    const n=t.regions.length;chk[t.id]=h('input',{type:'checkbox',onchange:upd});
    rows.append(h('label',{class:'imt'+(f?' in':'')},chk[t.id],h('span',{class:'imdot',style:{background:t.color||'#888'}}),
      h('span',null,trkIco(t)+' '+t.name),h('small',null,n?n+' prise'+(n>1?'s':''):'vide')))}
  const all=v=>{ts.forEach(t=>chk[t.id].checked=v);rows.querySelectorAll('.imf input').forEach(c=>c.checked=v);upd()};
  const place=h('select',null,h('option',{value:'same'},'Même place que dans l’autre projet'),h('option',{value:'ph'},'À la tête de lecture (mesure '+(Math.floor(PH/(P.sig||4))+1)+')'));
  const diff=pr.bpm&&pr.bpm!==P.bpm,bpmCb=h('input',{type:'checkbox'});
  box.append(h('h2',null,'📥 Pistes de « '+src.name+' »'),
    h('div',{class:'imall'},h('button',{onclick:()=>all(true)},'Tout cocher'),h('button',{onclick:()=>all(false)},'Tout décocher')),rows,
    h('div',{class:'imopt'},h('span',null,'Placer les prises'),place),
    diff&&h('div',{class:'imwarn'},'⚠️ « '+src.name+' » est à ',h('b',null,pr.bpm+' BPM'),' et ton projet à ',h('b',null,P.bpm+' BPM'),'. Les voix et les sons gardent leur vitesse mais peuvent tomber à côté du temps ; batteries et instruments suivent le tempo de ton projet.',
      h('label',{class:'imbpm'},bpmCb,' Passer mon projet à '+pr.bpm+' BPM')),
    h('div',{class:'imfoot'},h('button',{onclick:()=>m.remove()},'Annuler'),btn));
  btn.onclick=async()=>{const ids=ts.filter(t=>chk[t.id].checked).map(t=>t.id);if(!ids.length)return;btn.disabled=true;btn.textContent='Import…';
    try{await doImportTracks(src,ids,{atPH:place.value==='ph',bpm:diff&&bpmCb.checked});m.remove()}
    catch(e){console.error(e);alert('Import impossible : '+e.message);upd()}};
  upd();
}

async function doImportTracks(src,ids,o){
  o=o||{};const pr=src.project,sel=pr.tracks.filter(t=>ids.includes(t.id));if(!sel.length)return 0;
  toast('Import des pistes…',60000);
  // 1) les sons : chaque son garde son identifiant, sauf s'il en existe déjà un différent sous le même nom
  const map={};let lost=0;
  for(const t of sel)if(t.type==='audio')for(const r of t.regions)for(const id of [r.buf,...(r.takes||[]).map(k=>k.buf)]){
    if(!id||id in map)continue;map[id]=id;let b=null;try{b=await src.getBuf(id)}catch(e){}
    if(!b){if(!BUFS[id])lost++;continue}
    const cur=BUFS[id];
    if(!cur){addBuffer(b,id);if(src.local)SAVED_BUFS.add(id)}
    else if(cur!==b&&(cur.length!==b.length||cur.sampleRate!==b.sampleRate||cur.numberOfChannels!==b.numberOfChannels))map[id]=addBuffer(b)}
  // 2) plugins externes utilisés par ces pistes
  for(const t of sel)for(const pl of t.plugins||[])if(!PLUGINS[pl.type]&&pr.ext&&pr.ext[pl.type])try{loadExternalPlugin(pr.ext[pl.type]);P.ext=P.ext||{};P.ext[pl.type]=pr.ext[pl.type]}catch(e){console.warn(e)}
  snapshot();
  if(o.bpm&&pr.bpm){P.bpm=pr.bpm;const i=$('#bpm');if(i)i.value=P.bpm}
  // 3) bus d'effets : même nom = même bus ; sinon on recopie le bus de l'autre projet
  const SA=pr.auxes||[],auxAt=SA.map(a=>P.auxes.findIndex(x=>x.name===a.name));let newAux=0;
  for(const t of sel)(t.sends||[]).forEach((v,i)=>{if(v>-60&&SA[i]&&auxAt[i]<0){const a=deep(SA[i]);if(P.auxes.some(x=>x.id===a.id)||P.tracks.some(x=>x.id===a.id))a.id=uid('aux');
    a.plugins=(a.plugins||[]).filter(pl=>PLUGINS[pl.type]);P.auxes.push(a);for(const x of P.tracks)(x.sends=x.sends||[]).push(-60);auxAt[i]=P.auxes.length-1;newAux++}});
  // 4) les pistes
  let shift=0;if(o.atPH){const st=sel.flatMap(t=>t.regions.map(r=>r.start));if(st.length)shift=PH-Math.min(...st)}
  const fmap={},made=[];let dropped=0;
  for(const t of sel){const c=deep(t);c.id=uid('t');c.arm=false;c.mon=false;c.solo=false;
    c.regions.forEach(r=>{r.id=uid('r');r.start=Math.max(0,r.start+shift);if(r.buf&&map[r.buf])r.buf=map[r.buf];(r.takes||[]).forEach(k=>{if(k.buf&&map[k.buf])k.buf=map[k.buf]})});
    const n0=(c.plugins||[]).length;c.plugins=(c.plugins||[]).filter(pl=>PLUGINS[pl.type]);dropped+=n0-c.plugins.length;
    c.sends=P.auxes.map(()=>-60);(t.sends||[]).forEach((v,i)=>{if(auxAt[i]>=0)c.sends[auxAt[i]]=v});
    const f=t.fold&&(pr.folders||[]).find(x=>x.id===t.fold);
    if(f){if(!fmap[f.id]){const nf=deep(f);nf.id=uid('f');P.folders=P.folders||[];P.folders.push(nf);fmap[f.id]=nf.id}c.fold=fmap[f.id]}else delete c.fold;
    made.push(c)}
  // l'instru reste en haut, le reste arrive en bas
  const ins=made.filter(isInstru),oth=made.filter(t=>!isInstru(t));
  if(ins.length)P.tracks.splice(P.tracks.filter(isInstru).length,0,...ins);P.tracks.push(...oth);
  if(typeof cleanFolders==='function')cleanFolders();
  SEL=made[0].id;SELR=new Set();
  E.build(P);E.updateAll();renderAll();if(typeof mobSched==='function')mobSched();
  try{if(COLLAB.on&&typeof uploadBufs==='function')uploadBufs()}catch(e){}
  let msg='✔ '+made.length+' piste'+(made.length>1?'s importées':' importée')+' depuis « '+src.name+' »';
  if(newAux)msg+=' (+ '+newAux+' bus d’effets)';if(lost)msg+='. ⚠️ '+lost+' son'+(lost>1?'s':'')+' introuvable'+(lost>1?'s':'');
  if(dropped)msg+='. ⚠️ '+dropped+' effet'+(dropped>1?'s':'')+' externe'+(dropped>1?'s':'')+' manquant'+(dropped>1?'s':'');
  toast(msg,5000);return made.length
}

// téléphone : entrée dans le menu ⋯ (sous « Mes projets »)
if(typeof mobMenuSheet==='function'){const o=mobMenuSheet;mobMenuSheet=function(){const r=o.apply(this,arguments);const b=document.querySelector('.msheet .mbody>div');
  if(b){const mp=[...b.querySelectorAll('.mrowb')].find(x=>/Mes projets/.test(x.textContent));const it=mRow('📥','Importer des pistes',importTracksDialog,'Copier des pistes d’un autre projet');
    mp?mp.after(it):b.append(it)}return r}}
