// ===== v3.8.1 : historique lisible (↶ ↷ 🕘), retrait direct du mastering =====
let UTIMES=[],CH=[],CR=[];// heures des étapes ; en session : copies d'état pour décrire les étapes
{const s=snapshot,u=undo,r=redo;
  snapshot=function(){const pre=COLLAB&&COLLAB.on?JSON.stringify(P):null;const res=s.apply(this,arguments);
    if(pre!==null){CH.push({j:pre,t:Date.now()});if(CH.length>80)CH.shift();CR=[]}else{UTIMES.push(Date.now());if(UTIMES.length>UNDO.length)UTIMES=UTIMES.slice(-UNDO.length)}
    setTimeout(histBtns,400);return res};
  undo=function(){const on=COLLAB&&COLLAB.on;const res=u.apply(this,arguments);if(on){const x=CH.pop();if(x)CR.push(x)}else if(UTIMES.length>UNDO.length)UTIMES.length=UNDO.length;histBtns();histRefresh();return res};
  redo=function(){const on=COLLAB&&COLLAB.on;const res=r.apply(this,arguments);if(on){const x=CR.pop();if(x)CH.push(x)}else{while(UTIMES.length<UNDO.length)UTIMES.push(Date.now())}histBtns();histRefresh();return res}}
// étapes annulables, de la plus récente à la plus ancienne : {before, after, t}
function histSteps(){const on=COLLAB&&COLLAB.on,L=on?CH.map(x=>x.j):UNDO,T=on?CH.map(x=>x.t):UTIMES,out=[];
  for(let i=L.length-1;i>=0;i--)out.push({b:L[i],a:i===L.length-1?null:L[i+1],t:T[i-(L.length-T.length)]||null});return out}
function redoSteps(){const on=COLLAB&&COLLAB.on,L=on?CR.map(x=>x.j):REDO,out=[];for(let i=L.length-1;i>=0;i--)out.push({a:L[i],b:i===L.length-1?null:L[i+1]});return out} // a = état rétabli
const plName=ty=>(PLUGINS[ty]&&PLUGINS[ty].name||ty).replace(/ \(.*\)$/,'');
const J=x=>JSON.stringify(x===undefined?null:x);
function describeChange(A,B){if(!A||!B)return['Modification'];const out=[],add=s=>{if(!out.includes(s))out.push(s)};
  if(A.bpm!==B.bpm)add('Tempo '+A.bpm+' → '+B.bpm+' BPM');if(A.key!==B.key||A.scaleIdx!==B.scaleIdx)add('Tonalité changée');if(A.name!==B.name)add('Projet renommé « '+B.name+' »');
  const mA=(A.master&&A.master.plugins||[]).find(p=>p._master),mB=(B.master&&B.master.plugins||[]).find(p=>p._master);
  if(!mA&&mB)add('🎚 Mastering « '+mB._master+' » ajouté');else if(mA&&!mB)add('🎚 Mastering retiré');else if(J(A.master)!==J(B.master))add(mB?'🎚 Mastering modifié':'Sortie stéréo modifiée');
  const ta=new Map((A.tracks||[]).map(t=>[t.id,t])),tb=new Map((B.tracks||[]).map(t=>[t.id,t]));
  for(const [id,t] of tb)if(!ta.has(id))add('Piste « '+t.name+' » ajoutée');for(const [id,t] of ta)if(!tb.has(id))add('Piste « '+t.name+' » supprimée');
  if((A.tracks||[]).map(t=>t.id).join()!==(B.tracks||[]).map(t=>t.id).join()&&ta.size===tb.size)add('Ordre des pistes');
  for(const [id,b] of tb){const a=ta.get(id);if(!a)continue;const n='« '+b.name+' »';
    if(a.name!==b.name)add('Piste renommée '+n);
    if(a.preset!==b.preset&&b.preset)add(n+' : préréglage « '+b.preset+' »');else if(a.mine!==b.mine&&b.mine)add(n+' : réglage « '+b.mine+' »');
    else if(J(a.plugins)!==J(b.plugins)){const pa=(a.plugins||[]).map(p=>p.type),pb=(b.plugins||[]).map(p=>p.type),plus=pb.filter(x=>!pa.includes(x)),moins=pa.filter(x=>!pb.includes(x));
      if(plus.length)add(n+' : effet ajouté ('+plus.map(plName).join(', ')+')');if(moins.length)add(n+' : effet retiré ('+moins.map(plName).join(', ')+')');
      if(!plus.length&&!moins.length){const ch=[];(b.plugins||[]).forEach((p,i)=>{const q=(a.plugins||[])[i];if(q&&J(q)!==J(p))ch.push(q.byp!==p.byp?plName(p.type)+(p.byp?' coupé':' activé'):plName(p.type))});add(n+' : réglage '+(ch.length?ch.slice(0,3).join(', '):'des effets'))}}
    if(J(a.sends)!==J(b.sends))add(n+' : écho / réverb');if(a.vol!==b.vol)add(n+' : volume');if(a.pan!==b.pan)add(n+' : panoramique');if(a.mute!==b.mute)add(n+(b.mute?' : muet':' : son remis'));if(a.solo!==b.solo)add(n+' : solo');
    if(J(a.instr)!==J(b.instr))add(n+' : son de l’instrument');if(J(a.lyrics)!==J(b.lyrics))add(n+' : paroles');if(a.color!==b.color)add(n+' : couleur');
    if(J(a.regions)!==J(b.regions)){const ra=new Map(a.regions.map(r=>[r.id,r])),rb=new Map(b.regions.map(r=>[r.id,r]));const nAdd=[...rb.keys()].filter(k=>!ra.has(k)).length,nDel=[...ra.keys()].filter(k=>!rb.has(k)).length;
      const what=new Set();for(const [k,r] of rb){const q=ra.get(k);if(!q)continue;if(q.start!==r.start)what.add('déplacée');if(q.dur!==r.dur||q.len!==r.len||q.offset!==r.offset)what.add('coupée / redimensionnée');if(q.buf!==r.buf)what.add('son traité');
        if(q.gain!==r.gain||J(q.tone)!==J(r.tone))what.add('volume / son de prise');if(q.fi!==r.fi||q.fo!==r.fo)what.add('fondu');if(q.mute!==r.mute)what.add(r.mute?'rendue muette':'réactivée');if(q.name!==r.name)what.add('renommée');
        if(J(q.notes)!==J(r.notes))what.add('notes');if(J(q.pat)!==J(r.pat))what.add('rythme')}
      if(nAdd&&nDel&&!what.size)add(n+' : '+(b.type==='audio'?'prise refaite / découpée':'régions modifiées'));
      else{if(nAdd)add(n+' : '+(nAdd>1?nAdd+' régions ajoutées':b.type==='audio'?'prise ajoutée':'région ajoutée'));if(nDel)add(n+' : '+(nDel>1?nDel+' régions supprimées':'région supprimée'))}
      if(what.size)add(n+' : '+(what.has('notes')||what.has('rythme')?'':'région ')+[...what].join(', '))}}
  if(J(A.auxes)!==J(B.auxes))add('Bus écho / réverb modifié');if(J(A.lyrics)!==J(B.lyrics))add('Paroles du projet');
  if(J(A.marks)!==J(B.marks))add('Marqueurs');if(J(A.cmts)!==J(B.cmts))add('Notes');if(J(A.cycle)!==J(B.cycle))add('Zone de cycle');
  if(J(A.settings)!==J(B.settings))add(A.settings&&B.settings&&A.settings.xfade!==B.settings.xfade?'Fondu entre prises':'Réglages');
  return out.length?out:['Petit changement']}
const parseJ=s=>{try{return typeof s==='string'?JSON.parse(s):s}catch(e){return null}};
function stepLabel(st,redo){const A=parseJ(st.b)||(redo?P:null),B=parseJ(st.a)||P;return redo?describeChange(parseJ(st.b)||P,parseJ(st.a)):describeChange(parseJ(st.b),B)}
const ago=t=>{if(!t)return'';const s=Math.round((Date.now()-t)/1000);return s<10?'à l’instant':s<60?'il y a '+s+' s':s<3600?'il y a '+Math.floor(s/60)+' min':'il y a '+Math.floor(s/3600)+' h'};
function undoN(n){for(let i=0;i<n;i++)undo();toast(n>1?n+' actions annulées':'Action annulée',2500)}
function redoN(n){for(let i=0;i<n;i++)redo();toast(n>1?n+' actions rétablies':'Action rétablie',2500)}

// ---- mastering : retrait direct ----
const masterOn=()=>P&&P.master&&(P.master.plugins||[]).find(p=>p._master);
function removeMaster(){const m=masterOn();if(!m)return toast('Pas de mastering sur ce projet');if(typeof lockedByOther==='function'&&lockedByOther('master'))return toast('La Sortie stéréo est verrouillée par quelqu’un d’autre');
  snapshot();const pre=P.master._pre;P.master.plugins=pre?deep(pre):P.master.plugins.filter(p=>!p._master);if(!P.master.plugins.some(p=>p.type==='limiter'))P.master.plugins.push(plug('limiter',{gain:0,ceil:-1}));delete P.master._pre;
  closeAllPlugins();E.updateStrip(P.master);renderAll();histRefresh();toast('🎚 Mastering « '+m._master+' » retiré ✔ — la Sortie stéréo est revenue comme avant',5000)}
{const o=applyMaster;applyMaster=function(){const pre=masterOn()?P.master._pre:deep(P.master.plugins);const r=o.apply(this,arguments);if(pre)P.master._pre=pre;return r}}

// ---- boutons ↶ ↷ 🕘 ----
function histBtns(){const u=document.getElementById('bUndo'),r=document.getElementById('bRedo');if(!u)return;const hs=histSteps(),rs=redoSteps();
  u.disabled=!hs.length;r.disabled=!rs.length;u.title=hs.length?'Annuler : '+stepLabel(hs[0]).join(' · ')+'  (Ctrl+Z)':'Rien à annuler';r.title=rs.length?'Rétablir : '+stepLabel(rs[0],true).join(' · ')+'  (Ctrl+Maj+Z)':'Rien à rétablir'}
function bootHist(){const f=document.getElementById('bInsp');if(!f||document.getElementById('bUndo'))return;
  const B=(id,txt,fn)=>h('button',{id,class:'tbtn',onclick:fn},txt);
  f.after(B('bUndo','↶',()=>{const s=histSteps()[0];if(!s)return toast('Rien à annuler');undo();toast('Annulé : '+stepLabel(s).join(' · '),3500)}),B('bRedo','↷',()=>{const s=redoSteps()[0];if(!s)return toast('Rien à rétablir');redo();toast('Rétabli : '+stepLabel(s,true).join(' · '),3500)}),B('bHist','🕘',histPanel));
  ['bUndo','bRedo'].forEach(i=>document.getElementById(i).addEventListener('mouseenter',histBtns));document.getElementById('bHist').title='Historique : voir les dernières actions et choisir quoi annuler';histBtns();setInterval(histBtns,5000)}
let HISTM=null;
function histRefresh(){if(HISTM&&HISTM.isConnected){const b=HISTM.querySelector('.hbody');if(b)b.replaceWith(histBody())}}
function histBody(){const box=h('div',{class:'hbody'}),hs=histSteps(),rs=redoSteps(),m=masterOn();
  if(m)box.append(h('div',{class:'hmaster'},h('span',null,'🎚 Un mastering « '+m._master+' » est en place sur la Sortie stéréo.'),h('button',{style:{background:'#c0392b'},onclick:()=>{removeMaster()}},'Retirer le mastering')));
  else box.append(h('div',{class:'hmaster ok'},'🎚 Pas de mastering sur ce projet.'));
  if(rs.length){box.append(h('h4',null,'Annulé récemment (vous pouvez le remettre)'));rs.slice(0,10).reverse().forEach((s,i,arr)=>{const n=arr.length-i;box.append(h('div',{class:'hrow redo'},h('span',{class:'hl'},stepLabel(s,true).join(' · ')),h('button',{title:'Remet cette action'+(n>1?' et les '+(n-1)+' d’avant':''),onclick:()=>{redoN(n)}},'↷ Remettre')))})}
  box.append(h('h4',null,hs.length?'Dernières actions (la plus récente en haut)':'Aucune action à annuler'));
  hs.slice(0,40).forEach((s,i)=>{const lab=stepLabel(s);box.append(h('div',{class:'hrow'+(i===0?' last':'')},h('span',{class:'hn'},String(i+1)),h('span',{class:'hl'},lab.slice(0,3).join(' · ')+(lab.length>3?' (+'+(lab.length-3)+')':'')),h('span',{class:'ht'},ago(s.t)),
    h('button',{onclick:()=>confirmUndo(i+1)},i===0?'↶ Annuler':'↶ Annuler jusqu’ici')))});
  if(hs.length>40)box.append(h('div',{style:{color:'var(--dim)',fontSize:'11px'}},'… et '+(hs.length-40)+' actions plus anciennes'));
  box.append(h('p',{style:{color:'var(--dim)',fontSize:'11px',marginTop:'8px'}},'Annuler une ligne annule aussi toutes celles au-dessus d’elle (plus récentes). Rien n’est perdu : « ↷ Remettre » les rétablit tant que vous ne faites pas de nouvelle action.'+(COLLAB&&COLLAB.on?' En session, seules vos propres actions sont annulées.':'')));
  return box}
function confirmUndo(n){const hs=histSteps().slice(0,n);
  const m=modal([h('h2',null,'↶ Annuler '+(n>1?'ces '+n+' actions':'cette action')+' ?'),h('p',{style:{color:'var(--dim)',fontSize:'12px'}},'Voici exactement ce qui va être enlevé :'),
    h('ol',{style:{fontSize:'12px',maxHeight:'260px',overflow:'auto'}},hs.map(s=>h('li',null,stepLabel(s).join(' · ')))),
    h('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end'}},h('button',{onclick:()=>m.remove()},'Non, garder'),h('button',{style:{background:'#c0392b'},onclick:()=>{m.remove();undoN(n)}},'↶ Oui, annuler'))])}
function histPanel(){if(HISTM&&HISTM.isConnected){HISTM.remove();HISTM=null;return}HISTM=modal([h('h2',null,'🕘 Historique'),histBody()]);HISTM.classList.add('histm')}
// menu Fichier : retrait du mastering
{const o=menu;menu=function(e,items){if(Array.isArray(items)&&items.some(x=>Array.isArray(x)&&x[0]==='🎚 Mastering 1 clic…')){const i=items.findIndex(x=>Array.isArray(x)&&x[0]==='🎚 Mastering 1 clic…');items=items.slice();
  items.splice(i+1,0,masterOn()?['❌ Retirer le mastering « '+masterOn()._master+' »',removeMaster]:null,['🕘 Historique (annuler en voyant quoi)…',histPanel]);items=items.filter(Boolean)}return o.call(this,e,items)}}
(function wait(){if(typeof P!=='undefined'&&P&&document.getElementById('bInsp'))bootHist();else setTimeout(wait,300)})();
