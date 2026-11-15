// ===== v3.10 — Dossiers de pistes (comme les « Track Stacks » de Logic) =====
// Ranger plusieurs pistes (ex. les 3 lignes d'un couplet) dans un dossier : une seule ligne à l'écran,
// ▸ pour ouvrir / fermer. Volume et Muet du dossier agissent sur toutes ses pistes, S met toutes ses pistes en solo.
// Les prises, effets et réglages de chaque piste ne bougent pas.
function setFoldOpen(f,open){if(open)FOLD_OPEN.add(f.id);else FOLD_OPEN.delete(f.id);saveFoldOpen();renderHeads();renderLanes();if(typeof decorateLocks==='function'&&COLLAB.on)try{decorateLocks()}catch(e){}}
function folderHead(f){
  const ms=foldMembers(f),open=FOLD_OPEN.has(f.id),allSolo=ms.length>0&&ms.every(t=>t.solo);
  const b=(cls,lab,on,fn,tip)=>h('button',{class:cls+(on?' on':''),title:tip,onclick:e=>{e.stopPropagation();fn()}},lab);
  const vol=h('input',{type:'range',min:-60,max:6,step:.5,value:f.vol||0,title:'Volume du dossier (toutes ses pistes)',
    oninput:e=>{f.vol=+e.target.value;ms.forEach(t=>E.updateStrip(t))},onpointerdown:e=>{e.stopPropagation();snapshot()}});
  const name=h('input',{class:'tname',value:f.name,onchange:e=>{snapshot();f.name=e.target.value||'Dossier';renderHeads()},
    onkeydown:e=>{e.stopPropagation();if(e.key==='Enter')e.target.blur()},onpointerdown:e=>e.stopPropagation()});
  const btns=h('div',{class:'msrow',style:{justifyContent:'flex-start'}},
    b('btnM','M',f.mute,()=>{snapshot();f.mute=!f.mute;E.updateAll();renderHeads();if(TAB==='mixer')renderBottom()},'Muet (tout le dossier)'),
    b('btnS','S',allSolo,()=>{ms.forEach(t=>t.solo=!allSolo);E.updateAll();renderHeads();if(TAB==='mixer')renderBottom()},'Solo (tout le dossier)'),
    h('span',{class:'fcount'},ms.length+' piste'+(ms.length>1?'s':'')));
  return h('div',{class:'head fhead'+(open?' open':''),'data-f':f.id,title:'Double-clic : ouvrir / fermer',
      ondblclick:e=>{if(e.target.closest('input,button'))return;setFoldOpen(f,!open)},oncontextmenu:e=>{e.preventDefault();folderMenu(e,f)}},
    h('div',{class:'col',style:{background:f.color}}),
    h('button',{class:'ftog',title:open?'Fermer le dossier':'Ouvrir le dossier',onpointerdown:e=>e.stopPropagation(),onclick:e=>{e.stopPropagation();setFoldOpen(f,!open)}},(open?'▾':'▸')+' 📁'),
    h('div',{class:'info'},name,btns,vol))}
// Couloir du dossier : aperçu des prises de toutes ses pistes, en petites bandes
function folderLane(f){const ms=foldMembers(f),n=Math.max(1,ms.length),bh=(TH-10)/n;
  const ln=h('div',{class:'flane'+(FOLD_OPEN.has(f.id)?' open':''),'data-f':f.id,ondblclick:e=>{e.stopPropagation();setFoldOpen(f,!FOLD_OPEN.has(f.id))}});
  ms.forEach((t,k)=>{for(const r of t.regions)ln.append(h('div',{class:'fsum',title:t.name+(r.name?' — '+r.name:''),
    style:{left:r.start*PPB+'px',width:Math.max(3,rLen(t,r)*PPB)+'px',top:(5+k*bh)+'px',height:Math.max(2,bh-1.5)+'px',background:shade(t.color,.75),opacity:r.mute||t.mute?.3:.95}}))});
  return ln}
function guessFolderName(ts){const base=ts.map(t=>String(t.name).replace(/[\s#._-]*\d+$/,'').trim()).filter(Boolean);
  return base.length&&base.every(x=>x===base[0])?base[0]:'Dossier '+((P.folders||[]).length+1)}
function createFolder(ids,name){const ts=P.tracks.filter(t=>ids.includes(t.id));if(!ts.length)return;snapshot();
  P.folders=P.folders||[];const f={id:uid('f'),name:name||guessFolderName(ts),color:ts[0].color,vol:0,mute:false};P.folders.push(f);
  // les pistes du dossier se suivent, à la place de la première
  const at=P.tracks.indexOf(ts[0]);const rest=P.tracks.filter(t=>!ts.includes(t));const pos=rest.indexOf(P.tracks.slice(at).find(t=>!ts.includes(t)));
  rest.splice(pos<0?rest.length:pos,0,...ts);P.tracks.length=0;P.tracks.push(...rest);
  for(const t of ts)t.fold=f.id;cleanFolders();FOLD_OPEN.delete(f.id);saveFoldOpen();E.updateAll();renderAll();
  toast('📁 « '+f.name+' » : '+ts.length+' piste'+(ts.length>1?'s rangées':' rangée')+'. Clique sur ▸ pour les voir.',4000);return f}
function addToFolder(t,f){snapshot();t.fold=f.id;const ms=P.tracks.filter(x=>x.fold===f.id&&x!==t);
  if(ms.length){P.tracks.splice(P.tracks.indexOf(t),1);P.tracks.splice(P.tracks.indexOf(ms[ms.length-1])+1,0,t)}
  cleanFolders();E.updateAll();renderAll();toast('📁 « '+t.name+' » rangée dans « '+f.name+' »')}
function removeFromFolder(t){const f=FOLD(t.fold);snapshot();delete t.fold;
  if(f){const ms=foldMembers(f);if(ms.length){P.tracks.splice(P.tracks.indexOf(t),1);P.tracks.splice(P.tracks.indexOf(ms[ms.length-1])+1,0,t)}}
  cleanFolders();E.updateAll();renderAll();toast('📤 « '+t.name+' » sortie du dossier')}
function ungroupFolder(f){snapshot();for(const t of foldMembers(f))delete t.fold;P.folders=P.folders.filter(x=>x!==f);FOLD_OPEN.delete(f.id);saveFoldOpen();
  E.updateAll();renderAll();toast('📂 Dossier « '+f.name+' » défait : les pistes sont toujours là')}
function deleteFolder(f){const ms=foldMembers(f);if(!confirm('Supprimer le dossier « '+f.name+' » ET ses '+ms.length+' piste(s) ?\n(Ctrl+Z pour annuler)'))return;snapshot();
  for(const t of ms){try{E.setMonitor(t,false)}catch(e){}P.tracks.splice(P.tracks.indexOf(t),1)}P.folders=P.folders.filter(x=>x!==f);
  if(!findTrack(SEL))SEL=(P.tracks[0]||{}).id;SELR.clear();E.build(P);renderAll();toast('Dossier « '+f.name+' » supprimé — Ctrl+Z pour annuler')}
// dossiers vides ou cassés : retirés
function cleanFolders(){if(!P.folders)return;P.folders=P.folders.filter(f=>P.tracks.some(t=>t.fold===f.id));for(const t of P.tracks)if(t.fold&&!FOLD(t.fold))delete t.fold}
function folderMenuItems(t){const it=[],f=FOLD(t.fold);
  if(f)it.push(['📤 Sortir du dossier « '+f.name+' »',()=>removeFromFolder(t)]);
  else{it.push(['📁 Ranger dans un nouveau dossier…',()=>folderDialog(t)]);for(const g of P.folders||[])it.push(['📁 Mettre dans « '+g.name+' »',()=>addToFolder(t,g)])}
  return it}
function folderMenu(e,f){const open=FOLD_OPEN.has(f.id);menu(e,['Dossier : '+f.name,
  [open?'▾ Fermer le dossier':'▸ Ouvrir le dossier',()=>setFoldOpen(f,!open)],
  ['Renommer…',()=>{const v=prompt('Nom du dossier',f.name);if(v){snapshot();f.name=v;renderHeads()}}],
  ['Changer la couleur…',()=>colorPicker(e,f)],
  ['Ajouter / retirer des pistes…',()=>folderDialog(null,f)],'-',
  ['📂 Défaire le dossier (garder les pistes)',()=>ungroupFolder(f)],
  ['Supprimer le dossier et ses pistes',()=>deleteFolder(f)]])}
// Fenêtre : cocher les pistes à ranger
function folderDialog(seed,f){
  const pre=new Set(f?foldMembers(f).map(t=>t.id):[]);
  if(!f){if(seed)pre.add(seed.id);for(const id of SELR){const x=findRegion(id);if(x&&x[0])pre.add(x[0].id)}}
  const boxes=P.tracks.map(t=>{const other=t.fold&&(!f||t.fold!==f.id)&&FOLD(t.fold);
    const cb=h('input',{type:'checkbox',checked:pre.has(t.id)});cb.dataset.t=t.id;
    return h('label',{class:'fpick'},cb,h('span',{class:'fdot',style:{background:t.color}}),h('span',null,tIco(t)+' '+t.name),other&&h('span',{class:'muted'},'  (dans « '+other.name+' »)'))});
  const sel=()=>boxes.map(l=>l.querySelector('input')).filter(c=>c.checked).map(c=>c.dataset.t);
  const name=h('input',{value:f?f.name:guessFolderName(P.tracks.filter(t=>pre.has(t.id))),style:{width:'100%'},onkeydown:e=>e.stopPropagation()});
  const m=modal([h('h2',null,f?'📁 Pistes du dossier':'📁 Ranger dans un dossier'),
    h('p',{class:'muted',style:{fontSize:'12px',marginTop:0}},'Coche les pistes à regrouper (par exemple les 3 lignes de ton couplet). Elles restent intactes : le dossier les range sur une seule ligne.'),
    h('div',{class:'kv2'},'Nom du dossier',name),
    h('div',{class:'flist'},boxes),
    h('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'10px'}},
      h('button',{onclick:()=>m.remove()},'Annuler'),
      h('button',{class:'primary',onclick:()=>{const ids=sel();if(!ids.length)return toast('Coche au moins une piste');m.remove();
        if(!f)return createFolder(ids,name.value.trim());
        snapshot();f.name=name.value.trim()||f.name;for(const t of P.tracks){if(ids.includes(t.id))t.fold=f.id;else if(t.fold===f.id)delete t.fold}
        const ms=P.tracks.filter(t=>t.fold===f.id),at=P.tracks.indexOf(ms[0]),rest=P.tracks.filter(t=>t.fold!==f.id),nxt=P.tracks.slice(at).find(t=>t.fold!==f.id),pos=rest.indexOf(nxt);
        rest.splice(pos<0?rest.length:pos,0,...ms);P.tracks.length=0;P.tracks.push(...rest);cleanFolders();E.updateAll();renderAll()}},f?'Valider':'Créer le dossier'))]);
  m.classList.add('foldm')}
// une piste armée ou écoutée doit être visible : son dossier s'ouvre
{const o=toggleArm;toggleArm=function(t){const r=o.apply(this,arguments);const f=t&&FOLD(t.fold);if(t&&t.arm&&f&&!FOLD_OPEN.has(f.id))setFoldOpen(f,true);return r}}
