// ===== v3.7.7 : ⭐ Mes réglages voix (enregistrer / appliquer à une piste ou à toutes les voix) =====
const MYP_KEY='studio_mypresets';
function myPresets(){try{const v=JSON.parse(localStorage.getItem(MYP_KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
function myPresetsSave(list){try{localStorage.setItem(MYP_KEY,JSON.stringify(list));return true}catch(e){toast('Impossible d’enregistrer (mémoire du navigateur pleine ?)',5000);return false}}
const voiceTracks=()=>P.tracks.filter(t=>t.type==='audio'&&!isInstru(t));
// ce qui fait « le son » d'une voix : la chaîne d'effets (avec les réglages rapides), les envois écho/réverb, et le volume si demandé
function grabVoice(t){return{plugins:deep(t.plugins||[]).filter(p=>p.type!=='bridge'),sends:(t.sends||[]).slice(),vol:t.vol}}
function putVoice(t,r,withVol){
  t.plugins=deep(r.plugins).map(p=>{if(p.type==='pitch'||p.type==='tunepro'){p.params.key=P.key;p.params.scale=P.scaleIdx}return p}); // l'autotune suit la tonalité du projet
  t.sends=P.auxes.map((a,i)=>r.sends[i]??-60);if(withVol&&typeof r.vol==='number')t.vol=r.vol;}
function applyMine(targets,r,name){const lockFree=typeof lockedByOther==='function'?targets.filter(t=>!lockedByOther(t.id)):targets,skip=targets.length-lockFree.length;
  if(!lockFree.length)return toast('Ces pistes sont verrouillées par quelqu’un d’autre',4000);
  snapshot();for(const t of lockFree){putVoice(t,r,r.withVol!==false);t.preset=null;t.mine=name||null}
  closeAllPlugins();for(const t of lockFree){E.updateStrip(t);if(typeof syncFaders==='function')syncFaders(t.id)}renderAll();
  toast((name?'« '+name+' »':'Réglage')+' appliqué à '+(lockFree.length>1?lockFree.length+' pistes':'« '+lockFree[0].name+' »')+(skip?' ('+skip+' verrouillée'+(skip>1?'s':'')+' ignorée'+(skip>1?'s':'')+')':''),4000)}
function nextMineName(){const L=myPresets();let n=1;while(L.some(p=>p.name==='Réglage voix '+n))n++;return 'Réglage voix '+n}
function saveMineModal(t,over){const L=myPresets();let nameIn,volCb;
  const m=modal([h('h2',null,'💾 Enregistrer le réglage de « '+t.name+' »'),
    h('p',{style:{color:'var(--dim)',fontSize:'12px'}},'Enregistre tous les effets de la piste (avec ce que vous avez changé dans les réglages rapides), l’écho et la réverb. Il restera disponible dans tous vos projets, dans ⭐ Mes réglages.'),
    h('div',{class:'kv2'},'Nom',nameIn=h('input',{type:'text',value:over||t.mine||nextMineName(),style:{width:'200px'}})),
    h('label',{style:{display:'flex',gap:'6px',alignItems:'center',margin:'6px 0'}},volCb=h('input',{type:'checkbox',checked:true}),'Garder aussi le volume de la piste ('+Math.round(t.vol)+' dB)'),
    h('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'10px'}},h('button',{onclick:()=>m.remove()},'Annuler'),
      h('button',{class:'primary',style:{background:'#2b6fd6'},onclick:()=>{const name=nameIn.value.trim().slice(0,40);if(!name)return nameIn.focus();
        const list=myPresets(),i=list.findIndex(p=>p.name===name);
        if(i>=0&&!confirm('« '+name+' » existe déjà. Le remplacer par le réglage actuel ?'))return;
        const r=Object.assign(grabVoice(t),{name,withVol:volCb.checked,at:Date.now()});if(i>=0)list[i]=r;else list.push(r);
        if(myPresetsSave(list)){t.mine=name;t.preset=null;m.remove();renderInspector();toast('✔ « '+name+' » enregistré',3000)}}},'💾 Enregistrer'))]);
  setTimeout(()=>{nameIn.focus();nameIn.select()},50)}
function mineMenu(e,t,r){e.preventDefault();e.stopPropagation();const n=voiceTracks().length;
  menu(e,['⭐ '+r.name,['Appliquer à « '+t.name+' »',()=>applyMine([t],r,r.name)],['Appliquer à toutes les voix ('+n+')',()=>applyMine(voiceTracks(),r,r.name)],
    ['Appliquer aux pistes sélectionnées…',()=>pickTracksModal(r)],'-',
    ['💾 Remplacer par le réglage de « '+t.name+' »',()=>{if(!confirm('Remplacer « '+r.name+' » par le réglage actuel de « '+t.name+' » ?'))return;const L=myPresets(),i=L.findIndex(p=>p.name===r.name);if(i<0)return;L[i]=Object.assign(grabVoice(t),{name:r.name,withVol:r.withVol,at:Date.now()});if(myPresetsSave(L)){t.mine=r.name;renderInspector();toast('✔ « '+r.name+' » mis à jour')}}],
    ['✎ Renommer…',()=>{const v=prompt('Nouveau nom',r.name);if(!v||!v.trim())return;const L=myPresets();if(L.some(p=>p.name===v.trim()))return toast('Ce nom existe déjà');const p=L.find(p=>p.name===r.name);if(!p)return;p.name=v.trim().slice(0,40);P.tracks.forEach(x=>{if(x.mine===r.name)x.mine=p.name});myPresetsSave(L);renderInspector()}],
    ['🗑 Supprimer',()=>{if(!confirm('Supprimer « '+r.name+' » de vos réglages ? (les pistes gardent leur son)'))return;myPresetsSave(myPresets().filter(p=>p.name!==r.name));renderInspector()}]])}
function pickTracksModal(r){const vs=voiceTracks(),cbs=vs.map(t=>h('input',{type:'checkbox',checked:true}));
  const m=modal([h('h2',null,'Appliquer « '+r.name+' » à…'),...vs.map((t,i)=>h('label',{style:{display:'flex',gap:'6px',alignItems:'center',margin:'3px 0'}},cbs[i],h('span',{style:{color:t.color}},'●'),t.name)),
    h('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'10px'}},h('button',{onclick:()=>m.remove()},'Annuler'),
      h('button',{style:{background:'#2b6fd6'},onclick:()=>{const sel=vs.filter((t,i)=>cbs[i].checked);m.remove();if(sel.length)applyMine(sel,r,r.name)}},'Appliquer'))])}
function mineSection(t){const L=myPresets(),box=h('div',{class:'sec mine'});
  const row=h('div',{style:{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'6px'}},
    h('button',{title:'Enregistre le réglage de cette piste pour le réutiliser partout',onclick:()=>saveMineModal(t)},'💾 Enregistrer ce réglage'),
    voiceTracks().length>1&&h('button',{title:'Copie le réglage de cette piste sur toutes les autres voix',onclick:()=>{const o=voiceTracks().filter(x=>x!==t);if(confirm('Copier le réglage de « '+t.name+' » sur '+o.length+' autre(s) voix ?'))applyMine(o,Object.assign(grabVoice(t),{withVol:false}),t.mine)}},'📋 Copier sur toutes les voix'));
  box.append(row);
  if(t.mine&&L.some(p=>p.name===t.mine))box.append(h('div',{style:{fontSize:'11px',color:'var(--dim)',margin:'0 0 4px'}},'Cette piste utilise « '+t.mine+' ». Vous l’avez modifiée ? ',h('a',{href:'#',style:{color:'#64a8ff'},onclick:e=>{e.preventDefault();const L2=myPresets(),i=L2.findIndex(p=>p.name===t.mine);if(i<0)return;L2[i]=Object.assign(grabVoice(t),{name:t.mine,withVol:L2[i].withVol,at:Date.now()});if(myPresetsSave(L2))toast('✔ « '+t.mine+' » mis à jour')}},'💾 Mettre à jour « '+t.mine+' »')));
  if(!L.length)box.append(h('div',{style:{fontSize:'11px',color:'var(--dim)'}},'Trouvez votre son (préréglage + réglages rapides + effets), puis cliquez 💾 : il sera gardé ici pour tous vos projets.'));
  const lib=h('div',{class:'lib'});
  for(const r of L)lib.append(h('div',{style:Object.assign({display:'flex',alignItems:'center',gap:'4px'},t.mine===r.name?{background:'#2b6fd6'}:{}),title:'Clic : appliquer à cette piste · clic droit ou ⋯ : plus d’options',
    onclick:()=>applyMine([t],r,r.name),oncontextmenu:e=>mineMenu(e,t,r)},h('span',{style:{flex:1}},'⭐ '+r.name),
    h('button',{class:'mini',title:'Appliquer à toutes les voix',style:{padding:'0 5px',fontSize:'10px'},onclick:e=>{e.stopPropagation();applyMine(voiceTracks(),r,r.name)}},'→ toutes'),
    h('button',{class:'mini',title:'Options',style:{padding:'0 5px',fontSize:'10px'},onclick:e=>mineMenu(e,t,r)},'⋯')));
  box.append(lib);return box}
// insertion dans l'inspecteur, juste avant les préréglages voix
{const o=renderInspector;renderInspector=function(){const r=o.apply(this,arguments);try{const t=typeof SEL!=='undefined'&&findTrack(SEL);
  if(t&&t.type==='audio'&&!isInstru(t)){const I=document.getElementById('insp');if(I&&!I.querySelector('.mine')&&!I.querySelector('h3.fold[data-k=mine]')){
    const lib=[...I.querySelectorAll('h3.fold')].find(x=>/Préréglages voix/.test(x.textContent));const parts=isec('mine','⭐ Mes réglages',mineSection(t));parts[0].dataset.k='mine';
    if(lib)lib.before(...parts);else I.append(...parts)}}}catch(e){console.warn(e)}return r}}
// appliquer un préréglage d'usine efface le lien avec « mes réglages »
{const o=applyVocalPreset;applyVocalPreset=function(t){const r=o.apply(this,arguments);t.mine=null;return r}}
