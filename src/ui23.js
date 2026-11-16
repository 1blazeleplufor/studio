// ===== v3.13 : effets par bloc (région) =====
// r.plugins = chaîne d'effets propre au bloc, jouée AVANT les effets de la piste.
// Le moteur crée la chaîne à la demande (E.rfx) ; openPlugin(r,i) marche directement (r.id, r.name, r.plugins).
const RFX_NO=new Set(['bridge','tunepro']); // effets liés à la piste entière : pas sur un bloc
function rfxChanged(r){if(r.plugins&&!r.plugins.length)delete r.plugins;const fr=findRegion(r.id);if(fr&&E&&r.plugins)E.rfx(fr[0],r);
  renderInspector();renderLanes();if(typeof mobSched==='function')mobSched()}
function rfxAdd(e,r,replaceIdx){const cats={};
  for(const id in PLUGINS){const p=PLUGINS[id];if(p.hideInMenu||RFX_NO.has(id))continue;(cats[p.cat]=cats[p.cat]||[]).push([id,p.name])}
  const items=[];for(const c in cats){items.push(c);for(const [id,n] of cats[c])items.push([n,()=>{snapshot();r.plugins=r.plugins||[];const pl=plug(id);
    if(replaceIdx!=null){closeAllPlugins();r.plugins[replaceIdx]=pl}else r.plugins.push(pl);rfxChanged(r);openPlugin(r,replaceIdx!=null?replaceIdx:r.plugins.length-1)}])}
  menu(e,items)}
function rfxSlotMenu(e,r,i){const mv=d=>{const j=i+d;if(j<0||j>=r.plugins.length)return;snapshot();const p=r.plugins.splice(i,1)[0];r.plugins.splice(j,0,p);closeAllPlugins();rfxChanged(r)};
  menu(e,[['Ouvrir',()=>openPlugin(r,i)],['Monter',()=>mv(-1)],['Descendre',()=>mv(1)],['Remplacer…',()=>rfxAdd(e,r,i)],'-',['Retirer l’effet',()=>{snapshot();closeAllPlugins();r.plugins.splice(i,1);rfxChanged(r)}]])}
function rfxPreset(r,name){const v=VOCAL_PRESETS[name];if(!v)return;snapshot();closeAllPlugins();
  rfxUnown(r);r.plugins=v.pl.map(([ty,o])=>plug(ty,o)).filter(p=>!RFX_NO.has(p.type));r.fxPreset=name;if(!r.plugins.length)delete r.fxPreset;rfxChanged(r);toast('« '+name+' » sur ce bloc')}
const rfxUnown=r=>{delete r.own;delete r.ownFrom;delete r.ownPan;delete r.fxVol};
function rfxCopyTrack(t,r){snapshot();closeAllPlugins();rfxUnown(r);r.plugins=deep((t.plugins||[]).filter(p=>!RFX_NO.has(p.type)));delete r.fxPreset;rfxChanged(r);toast('Effets de la piste copiés sur ce bloc')}
function rfxClear(r){snapshot();closeAllPlugins();rfxUnown(r);delete r.plugins;delete r.fxPreset;rfxChanged(r);toast('Effets du bloc retirés')}
// coller les effets d'un bloc sur d'autres blocs
let RFX_CLIP=null;
function rfxCopy(r){RFX_CLIP=deep(r.plugins||[]);toast(RFX_CLIP.length?'Effets du bloc copiés : sélectionne d’autres blocs puis « Coller les effets »':'Ce bloc n’a pas d’effet')}
function rfxPaste(){if(!RFX_CLIP)return toast('Copie d’abord les effets d’un bloc');const items=[...SELR].map(findRegion).filter(Boolean);if(!items.length)return toast('Sélectionne des blocs');
  snapshot();closeAllPlugins();for(const [t,r] of items){r.plugins=deep(RFX_CLIP);if(!r.plugins.length)delete r.plugins;delete r.fxPreset;if(r.plugins)E.rfx(t,r)}
  renderInspector();renderLanes();if(typeof mobSched==='function')mobSched();toast('Effets collés sur '+items.length+' bloc'+(items.length>1?'s':''))}

function rfxPanel(t,r){
  const g=h('div',{class:'tools rfx'});
  g.append(h('div',{class:'rfxh'},'✨ Effets de ce bloc'),
    h('div',{class:'rfxd'},'Seulement sur ce bloc, en plus des effets de la piste. Coupe le son (✂ Ctrl+T) pour mettre des effets différents sur chaque partie.'));
  if(r.own)g.append(h('div',{class:'rfxown'},'🔗 Ce bloc garde le son de sa piste d’origine'+(r.ownFrom?' (« '+r.ownFrom+' »)':'')+' : les effets de « '+t.name+' » ne s’appliquent pas à lui.',
    h('button',{onclick:()=>{snapshot();closeAllPlugins();rfxUnown(r);delete r.plugins;rfxChanged(r);toast('Ce bloc utilise maintenant les effets de « '+t.name+' »')}},'↩ Utiliser les effets de « '+t.name+' »')));
  const sl=h('div',{class:'rfxs'});
  (r.plugins||[]).forEach((pl,i)=>{const def=PLUGINS[pl.type];
    sl.append(h('div',{class:'slot full'+(pl.byp?' byp':''),title:def?def.name:pl.type,onclick:()=>openPlugin(r,i),oncontextmenu:e=>{e.preventDefault();rfxSlotMenu(e,r,i)}},
      h('span',{class:'pw',title:'Activer / contourner',onclick:e=>{e.stopPropagation();snapshot();pl.byp=!pl.byp;rfxChanged(r)}}),
      h('span',null,def?def.name:'⚠ '+pl.type),h('span',{class:'x',title:'Retirer',onclick:e=>{e.stopPropagation();snapshot();closeAllPlugins();r.plugins.splice(i,1);rfxChanged(r)}},'✕')))});
  sl.append(h('div',{class:'slot empty',title:'Ajouter un effet sur ce bloc',onclick:e=>rfxAdd(e,r)},'+ effet'));
  const pre=h('select',{onchange:e=>{if(e.target.value)rfxPreset(r,e.target.value)}},h('option',{value:''},'Préréglage tout prêt…'),
    ...Object.keys(VOCAL_PRESETS).map(n=>h('option',{value:n,selected:r.fxPreset===n},n)));
  const row=h('div',{class:'rfxb'},
    (t.plugins||[]).length?h('button',{title:'Mettre sur ce bloc les mêmes effets que la piste',onclick:()=>rfxCopyTrack(t,r)},'⇣ Effets de la piste'):null,
    r.plugins?h('button',{onclick:()=>rfxCopy(r)},'📋 Copier'):null,
    RFX_CLIP?h('button',{onclick:rfxPaste},'📥 Coller'):null,
    r.plugins?h('button',{onclick:()=>rfxClear(r)},'🗑 Tout retirer'):null);
  g.append(sl,pre,row);return g}
{const o=regionTools;regionTools=function(t,r){const box=o.apply(this,arguments);try{const p=rfxPanel(t,r),ref=box.children[2];ref?box.insertBefore(p,ref):box.append(p)}catch(e){console.error(e)}return box}}
// badge ✨ sur les blocs qui ont des effets
{const o=regionEl;regionEl=function(t,r){const e=o.apply(this,arguments);if(r.plugins&&r.plugins.length){const rt=e.querySelector('.rt');
  const b=h('span',{class:'rfxbadge',title:'Effets du bloc : '+r.plugins.map(p=>PLUGINS[p.type]?PLUGINS[p.type].name:p.type).join(', ')},'✨');rt?rt.prepend(b):e.append(b)}return e}}
// clic droit sur un bloc : entrées « Effets »
{const L=document.getElementById('lanes')||document.getElementById('lanesWrap');
  if(L)L.addEventListener('contextmenu',()=>setTimeout(()=>{const m=document.querySelector('.menu');if(!m||m.querySelector('.rfxmi'))return;const id=[...SELR][0],fr=id&&findRegion(id);if(!fr)return;
    const [t,r]=fr,mk=(lab,fn)=>h('div',{class:'rfxmi',onclick:ev=>{closeMenu();fn(ev)}},lab);const hd=m.querySelector('.hd');
    const its=[mk('✨ Ajouter un effet sur ce bloc…',ev=>rfxAdd(ev,r))];if(r.plugins)its.push(mk('📋 Copier les effets du bloc',()=>rfxCopy(r)));if(RFX_CLIP)its.push(mk('📥 Coller les effets sur la sélection',rfxPaste));
    hd?hd.after(...its):m.prepend(...its)},0))}

// ---------- téléphone ----------
function mobRfxSheet(t,r){
  const wrap=h('div',{class:'mfx'}),cats=[];for(const n in VOCAL_PRESETS){const c=VOCAL_PRESETS[n].cat;if(!cats.includes(c))cats.push(c)}
  let cur=(VOCAL_PRESETS[r.fxPreset]||{}).cat||cats[0];const tabs=h('div',{class:'mfxt'}),grid=h('div',{class:'mfxg'}),info=h('div',{class:'rfxd'});
  const draw=()=>{tabs.innerHTML='';grid.innerHTML='';
    info.textContent=r.own?'🔗 Ce bloc garde le son de sa piste d’origine'+(r.ownFrom?' (« '+r.ownFrom+' »)':'')+'. Choisis un effet ou « Comme la piste » pour changer.':r.plugins?'Sur ce bloc : '+r.plugins.map(p=>PLUGINS[p.type]?PLUGINS[p.type].name:p.type).join(' · '):'Ce bloc n’a pas d’effet à lui : il a seulement ceux de la piste.';
    for(const c of cats)tabs.append(h('button',{class:c===cur?'on':'',onclick:()=>{cur=c;draw()}},c));
    for(const n in VOCAL_PRESETS)if(VOCAL_PRESETS[n].cat===cur&&!/aucun/i.test(n))grid.append(h('button',{class:'mfxc'+(r.fxPreset===n?' on':''),onclick:()=>{rfxPreset(r,n);draw()}},h('span',null,/autotune/i.test(n+cur)?'🎛':/Créatif/i.test(cur)?'✨':/lib|back/i.test(cur)?'🗣':'🎙'),n))};
  draw();
  wrap.append(h('div',{class:'mfxh'},'✨ Effets de ce bloc'),info,tabs,grid,
    h('div',{class:'rfxb'},h('button',{onclick:()=>{rfxCopyTrack(t,r);draw()}},'⇣ Comme la piste'),h('button',{onclick:()=>{rfxClear(r);draw()}},'🚫 Aucun effet')));
  mSheet('✨ '+(r.name||'Bloc'),wrap,'mtrk')}
if(typeof mobTools==='function'){const o=mobTools;mobTools=function(){const r0=o.apply(this,arguments);const T=$('#mTools');
  if(T&&SELR.size===1){const fr=findRegion([...SELR][0]);if(fr){const [t,r]=fr,b=mB('mtl'+(r.plugins?' on':''),'✨ Effets',()=>mobRfxSheet(t,r));const f=T.querySelector('.mtl');f?f.after(b):T.prepend(b)}}return r0}}
