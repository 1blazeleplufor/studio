// ===== 3.11 — 💾 Sauvegarder, bien visible (téléphone et ordinateur) =====
// Deux niveaux, expliqués simplement :
// 1) automatique : le projet est gardé dans « Mes projets » de CET appareil / navigateur ;
// 2) le fichier .studio : une copie complète (sons compris) rangée où on veut (dossier du PC, Fichiers / iCloud, envoyée à soi-même…).
// On retient, par projet, quand la dernière copie .studio a été faite et si le projet a changé depuis (pastille orange).
function expMap(){try{return JSON.parse(localStorage.getItem('studio_exp')||'{}')}catch(e){return{}}}
function projHash(){const s=JSON.stringify(P.tracks.map(t=>[t.id,t.name,t.regions.map(r=>[r.id,r.start,r.dur,r.len,r.offset,r.buf])]))+P.name+P.bpm;let x=5381;for(let i=0;i<s.length;i++)x=(x*33^s.charCodeAt(i))>>>0;return x}
function expState(){const e=expMap()[P.id];if(!e)return{never:true};return{t:e.t,changed:e.h!==projHash()}}
function markExported(){const m=expMap();m[P.id]={t:Date.now(),h:projHash()};try{localStorage.setItem('studio_exp',JSON.stringify(m))}catch(e){}refreshSaveBadges()}
function agoTxt(t){const s=(Date.now()-t)/1000;return s<90?'à l’instant':s<3600?'il y a '+Math.round(s/60)+' min':s<86400*2?'il y a '+Math.round(s/3600)+' h':'il y a '+Math.round(s/86400)+' jours'}
async function saveStudioFile(blob,name){
  if(window.showSaveFilePicker&&!IS_TOUCH){ // ordinateur (Chrome / Edge) : on choisit le dossier
    try{const fh=await showSaveFilePicker({suggestedName:name,types:[{description:'Projet Studio',accept:{'application/octet-stream':['.studio']}}]});
      const w=await fh.createWritable();await w.write(blob);await w.close();DIRTY=false;markExported();toast('💾 Projet enregistré : '+fh.name,3500);return true}
    catch(e){if(e.name==='AbortError')return false;console.warn(e)}}
  await download(blob,name);DIRTY=false;markExported();
  toast(IS_TOUCH?'💾 Choisis « Enregistrer dans Fichiers » pour le ranger où tu veux':'💾 Projet enregistré dans tes Téléchargements',4500);return true}
function saveHub(){saveLocal(true).then(()=>{try{updateSaveState()}catch(e){}});
  const st=expState(),mob=typeof MOB!=='undefined'&&MOB;
  const status=st.never?h('div',{class:'svwarn'},'⚠️ Pas encore de copie de ce projet en dehors de Studio.')
    :st.changed?h('div',{class:'svwarn'},'🟠 Dernière copie '+agoTxt(st.t)+', mais tu as modifié le projet depuis.')
    :h('div',{class:'svok'},'✅ Copie à jour ('+agoTxt(st.t)+').');
  const body=h('div',{class:'svhub'},
    h('div',{class:'svcard'},h('b',null,'Automatique'),h('p',null,'✔ Studio garde ton projet tout seul dans 📂 Mes projets, mais seulement sur '+(IS_TOUCH?'ce téléphone':'cet ordinateur')+'.')),
    h('div',{class:'svcard main'},h('b',null,'💾 Fichier du projet (.studio)'),
      h('p',null,'Une copie complète, sons compris, que tu ranges où tu veux : '+(IS_TOUCH?'dans Fichiers, iCloud Drive, ou envoyée à toi-même':'dans le dossier de ton choix, une clé USB, un cloud')+'. Pour la rouvrir sur un autre appareil ou si tu changes de téléphone.'),
      status,
      h('button',{class:'svbig',onclick:async()=>{close();await saveProject()}},'💾 Enregistrer le fichier .studio'),
      h('button',{class:'svsec',onclick:()=>{close();$('#fileProj').click()}},'📂 Ouvrir un fichier .studio')),
    h('button',{class:'svsec',onclick:()=>{close();projectsModal()}},'Voir 📂 Mes projets'));
  let box;const close=()=>box&&box.remove();
  box=mob?mSheet('💾 Sauvegarder « '+(P.name||'Projet')+' »',body):modal([h('h2',null,'💾 Sauvegarder « '+(P.name||'Projet')+' »'),body])}
// pastilles : orange tant qu’il n’y a pas de copie à jour
function refreshSaveBadges(){if(!P)return;const st=expState(),need=st.never||st.changed;
  document.querySelectorAll('.svdot').forEach(d=>d.style.display=need?'block':'none')}
setInterval(refreshSaveBadges,5000);setTimeout(refreshSaveBadges,800);
// ordinateur : bouton 💾 Sauvegarder dans la barre du haut + en tête du menu Fichier
{const go=()=>{const b=$('#saveState');if(!b)return setTimeout(go,100);
  const nb=h('button',{id:'bSave',class:'tbtn svbtn',title:'Sauvegarder le projet (Ctrl+S)',onclick:saveHub},'💾 Sauvegarder',h('i',{class:'svdot'}));
  b.before(nb);b.onclick=null;refreshSaveBadges()};go()}
{const B=document.getElementById('bFile');if(B)B.addEventListener('click',()=>setTimeout(()=>{const m=document.querySelector('.menu');if(!m||m.querySelector('.svmi'))return;
  const hd=m.querySelector('.hd');const it=h('div',{class:'svmi',style:{fontWeight:'700'},onclick:()=>{m.remove();saveHub()}},'💾 Sauvegarder / fichier .studio…');
  hd?hd.after(it):m.prepend(it)},0))}
// Ctrl+S : ouvre l’écran de sauvegarde (qui sauvegarde aussi tout de suite dans Mes projets)
document.addEventListener('keydown',e=>{const c=e.ctrlKey||e.metaKey;if(c&&!e.shiftKey&&!e.altKey&&(e.key==='s'||e.key==='S')&&!e.target.closest('input,textarea,[contenteditable]')){e.preventDefault();e.stopImmediatePropagation();saveHub()}},true);
// téléphone : 💾 dans la barre du haut + en tête du menu ⋯
if(typeof mobInit==='function'){const o=mobInit;mobInit=function(){const r=o.apply(this,arguments);const t=document.querySelector('#mob .mtop'),ti=$('#mTitle');
  if(t&&ti)ti.after(h('button',{class:'mic svm',title:'Sauvegarder',onclick:e=>{e.stopPropagation();saveHub()}},'💾',h('i',{class:'svdot'})));refreshSaveBadges();return r}}
if(typeof mobMenuSheet==='function'){const o=mobMenuSheet;mobMenuSheet=function(){const r=o.apply(this,arguments);const b=document.querySelector('.msheet .mbody>div');
  if(b){[...b.querySelectorAll('.mrowb')].filter(x=>/Enregistrer le projet dans Fichiers|Ouvrir un projet \.studio/.test(x.textContent)).forEach(x=>x.remove());
    b.prepend(mRow('💾','Sauvegarder',saveHub,'Fichier .studio à ranger où tu veux'))}return r}}
