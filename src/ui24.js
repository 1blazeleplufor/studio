// ===== v3.13 : Ctrl+J fusionner =====
// • blocs choisis sur PLUSIEURS pistes (ou un dossier) → tout va sur la première piste, sans rien perdre :
//   si la piste d'origine avait d'autres effets / un autre volume, ils deviennent les effets / le volume du bloc.
//   Les pistes vidées sont supprimées.
// • plusieurs blocs sur UNE piste → ils sont collés en un seul bloc (son recalculé, comme « Joindre » de Logic).
const sameFx=(a,b)=>JSON.stringify((a||[]).map(p=>[p.type,p.byp,p.params]))===JSON.stringify((b||[]).map(p=>[p.type,p.byp,p.params]));
function mergeTargetsFromSel(){const items=[...SELR].map(findRegion).filter(Boolean);
  if(!items.length){const t=findTrack(SEL),f=t&&trkFold(P,t);if(f){const ts=P.tracks.filter(x=>x.fold===f.id);return ts.flatMap(x=>x.regions.map(r=>[x,r]))}}
  return items}
async function joinMerge(){
  const items=mergeTargetsFromSel();
  if(!items.length)return toast('Sélectionne les blocs à fusionner (Maj+clic ou cadre), puis Ctrl+J. Ou mets les pistes dans un dossier et sélectionne-le.',5000);
  const tracks=[...new Set(items.map(x=>x[0]))];
  if(tracks.length>1)return mergeTracks(items,tracks);
  if(items.length<2)return toast('Sélectionne au moins 2 blocs (Maj+clic) pour les coller ensemble');
  return joinBlocks(tracks[0],items.map(x=>x[1]));
}
function mergeTracks(items,tracks){
  tracks.sort((a,b)=>P.tracks.indexOf(a)-P.tracks.indexOf(b));const T=tracks[0];
  const bad=tracks.filter(t=>t.type!==T.type);if(bad.length)return toast('Impossible : « '+bad[0].name+' » n’est pas du même type que « '+T.name+' » (voix / instrument / batterie)',5000);
  snapshot();closeAllPlugins();const RX=typeof RFX_NO!=='undefined'?RFX_NO:new Set();let moved=0,gone=[];
  for(const [t,r] of items){if(t===T)continue;t.regions.splice(t.regions.indexOf(r),1);
    const dv=(t.vol||0)+((trkFold(P,t)||{}).vol||0)-(T.vol||0)-((trkFold(P,T)||{}).vol||0);
    if(r.own)r.fxVol=+((r.fxVol||0)+dv).toFixed(2); // déjà « autonome » : il garde son son, on compense juste le volume
    else if(!sameFx(t.plugins,T.plugins)||Math.abs(dv)>.01||(t.pan||0)!==(T.pan||0)){
      // le bloc emporte le son de sa piste : ses effets (après ceux du bloc), son volume et son pan ; ceux de la nouvelle piste ne s'y appliquent pas
      r.plugins=[...(r.plugins||[]),...deep((t.plugins||[]).filter(p=>!RX.has(p.type)))];if(!r.plugins.length)delete r.plugins;delete r.fxPreset;
      r.own=true;r.ownFrom=t.name;r.ownPan=t.pan||0;if(Math.abs(dv)>.01)r.fxVol=+dv.toFixed(2)}
    if(t.mute||(trkFold(P,t)||{}).mute)r.mute=true;
    T.regions.push(r);moved++}
  for(const t of tracks)if(t!==T&&!t.regions.length){P.tracks.splice(P.tracks.indexOf(t),1);gone.push(t.name)}
  if(typeof cleanFolders==='function')cleanFolders();
  SEL=T.id;SELR=new Set(items.map(x=>x[1].id));E.build(P);renderAll();if(typeof mobSched==='function')mobSched();
  toast('🔗 '+moved+' bloc'+(moved>1?'s':'')+' mis sur « '+T.name+' »'+(gone.length?' · '+gone.length+' piste'+(gone.length>1?'s':'')+' vide'+(gone.length>1?'s':'')+' supprimée'+(gone.length>1?'s':''):'')+'. Ctrl+Z pour annuler.',5000)}
async function joinBlocks(t,rs){
  if(t.type==='drums')return toast('Pour la batterie, on ne peut pas coller les blocs ensemble');
  rs.sort((a,b)=>a.start-b.start);const a=rs[0].start,b=Math.max(...rs.map(r=>r.start+rLen(t,r)));
  if(t.type==='synth'){snapshot();const n={id:uid('r'),start:a,len:b-a,name:rs[0].name,notes:rs.flatMap(r=>r.notes.filter(x=>x.s<r.len).map(x=>Object.assign({},x,{s:x.s+r.start-a})))};
    t.regions=t.regions.filter(r=>!rs.includes(r));t.regions.push(n);SELR=new Set([n.id]);renderAll();if(typeof mobSched==='function')mobSched();return toast('🔗 '+rs.length+' blocs collés en un seul')}
  if(rs.some(r=>!BUFS[r.buf]))return toast('Un des sons n’est pas encore chargé, réessaie dans un instant');
  toast('🔗 Collage des blocs…',60000);
  try{const spb=60/P.bpm,pr=deep(P),tt=deep(t);tt.plugins=[];tt.vol=0;tt.pan=0;tt.mute=false;tt.solo=false;delete tt.fold;tt.sends=[];tt.regions=rs.map(r=>deep(r));
    pr.tracks=[tt];pr.auxes=[];pr.folders=[];pr.master.plugins=[];pr.master.vol=0;pr.master.pan=0;
    const out=await renderMix(pr,a,b),sr=out.sampleRate,keepTail=rs.some(r=>(r.plugins||[]).some(p=>!p.byp&&/verb|delay|echo/.test(p.type)));
    let n=Math.min(out.length,Math.ceil((b-a)*spb*sr));
    if(keepTail){const L=out.getChannelData(0),R=out.getChannelData(1);let e=out.length-1;while(e>n&&Math.abs(L[e])<1e-4&&Math.abs(R[e])<1e-4)e--;n=Math.max(n,e+1)}
    // tout en mono → on garde du mono (le panoramique a baissé le mono de 3 dB : on le remet)
    const mono=rs.every(r=>BUFS[r.buf].numberOfChannels===1&&!(r.plugins&&r.plugins.length)),ch=mono?1:2,nb=ctx.createBuffer(ch,n,sr);
    if(mono){const s=out.getChannelData(0).subarray(0,n),d=nb.getChannelData(0);for(let i=0;i<n;i++)d[i]=s[i]*Math.SQRT2}
    else for(let c=0;c<2;c++)nb.copyToChannel(out.getChannelData(c).subarray(0,n),c);
    snapshot();const id=addBuffer(nb),r={id:uid('r'),start:a,offset:0,dur:n/sr,buf:id,name:rs[0].name||'Bloc'};
    t.regions=t.regions.filter(x=>!rs.includes(x));t.regions.push(r);SELR=new Set([r.id]);E.build(P);renderAll();if(typeof mobSched==='function')mobSched();
    try{if(COLLAB.on&&typeof uploadBufs==='function')uploadBufs()}catch(e){}
    toast('🔗 '+rs.length+' blocs collés en un seul. Ctrl+Z pour annuler.',4000)}
  catch(e){console.error(e);toast('Collage impossible : '+e.message,5000)}}
// raccourci
document.addEventListener('keydown',e=>{const c=e.ctrlKey||e.metaKey;if(c&&!e.shiftKey&&!e.altKey&&(e.key==='j'||e.key==='J'||e.code==='KeyJ')&&!e.target.closest('input,textarea,select,[contenteditable]')){e.preventDefault();e.stopImmediatePropagation();joinMerge()}},true);
// menus : clic droit sur un bloc, menu d'un dossier
{const L=document.getElementById('lanes');if(L)L.addEventListener('contextmenu',()=>setTimeout(()=>{const m=document.querySelector('#menu');if(!m||m.querySelector('.jmi'))return;
  const ts=new Set([...SELR].map(findRegion).filter(Boolean).map(x=>x[0]));const lab=ts.size>1?'🔗 Fusionner sur une seule piste (Ctrl+J)':SELR.size>1?'🔗 Coller les blocs en un seul (Ctrl+J)':null;if(!lab)return;
  const it=h('div',{class:'jmi',onclick:()=>{closeMenu();joinMerge()}},lab);const hd=m.querySelector('.hd');hd?hd.after(it):m.prepend(it)},0))}
if(typeof folderMenu==='function'){const o=folderMenu;folderMenu=function(e,f){const r=o.apply(this,arguments);const m=document.querySelector('#menu');
  if(m&&P.tracks.filter(t=>t.fold===f.id).length>1){const it=h('div',{onclick:()=>{closeMenu();const ts=P.tracks.filter(t=>t.fold===f.id);mergeTracks(ts.flatMap(x=>x.regions.map(r=>[x,r])),ts)}},'🔗 Fusionner le dossier en une seule piste (Ctrl+J)');
    const hd=m.querySelector('.hd');hd?hd.after(it):m.prepend(it)}return r}}
