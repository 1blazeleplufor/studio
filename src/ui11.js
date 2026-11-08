// ===== v3.7 : disposition fluide (panneaux redimensionnables / déplaçables / détachables), paroles, prompteur, mode focus,
// dispositions enregistrées, raccourcis, menu « ⋯ », notes dans la règle, prises multiples =====
// Seules deux zones sont fixes : les pistes (#lanesWrap) et leurs noms (#heads). Le reste s'ouvre, se ferme, se redimensionne,
// s'accroche à gauche / à droite (/ en bas pour les paroles) ou se détache dans une fenêtre.
const UI=(()=>{const d={insp:{open:true,w:236,side:'left'},lyr:{open:false,w:340,side:'right',where:'side',font:16,tab:'proj'},focus:false,prompt:true};
  try{const o=JSON.parse(localStorage.getItem('studio_ui')||'{}');for(const k of ['insp','lyr'])Object.assign(d[k],o[k]||{});if(o.prompt===false)d.prompt=false;
    if(!o.v2){d.lyr.side='right'} // v3.7.1 : les paroles passent à droite, comme dans Logic
  }catch(e){}return d})();
const saveUI=()=>{try{localStorage.setItem('studio_ui',JSON.stringify({insp:UI.insp,lyr:UI.lyr,prompt:UI.prompt,v2:1}))}catch(e){}};
const PANEL_NAMES={insp:'ⓘ Inspecteur',lyr:'📝 Paroles',chat:'💬 Chat · notes'};

// ---------- panneaux latéraux dans #main (grille calculée) ----------
let LYR_EL=null;
function ensureLyr(){if(!LYR_EL){LYR_EL=h('div',{id:'lyr'});const M=$('#main');if(M)M.insertBefore(LYR_EL,$('#arr'))}return LYR_EL}
function applyLayout(light){
  const M=_gid.call(document,'main');if(!M)return;const lyr=ensureLyr(),ins=_gid.call(document,'insp');
  if(light){const L=[],R=[];for(const k of ['insp','lyr']){const el=k==='insp'?ins:lyr;if(el&&el.parentNode===M&&el.style.display!=='none')(UI[k].side==='right'?R:L).push(k)}
    M.style.gridTemplateColumns=[...L.map(k=>UI[k].w+'px'),'minmax(0,1fr)',...R.slice().reverse().map(k=>UI[k].w+'px')].join(' ');
    let x=0,xr=0;const gs=[...M.querySelectorAll(':scope>.pgrip')];for(const g of gs){const k=g.dataset.k;if(g.dataset.side==='left'){x=0;for(const q of L){x+=UI[q].w;if(q===k)break}g.style.left=(x-3)+'px'}else{xr=0;for(const q of R){xr+=UI[q].w;if(q===k)break}g.style.right=(xr-3)+'px'}}
    clearTimeout(applyLayout.t);applyLayout.t=setTimeout(()=>{try{drawRuler();schedulePaint()}catch(e){}},30);return}
  M.querySelectorAll(':scope>.pgrip').forEach(g=>g.remove());document.body.classList.toggle('focus',!!UI.focus);
  if(UI.lyr.where==='side'&&!isDetached('lyr')&&lyr.parentNode!==M)M.insertBefore(lyr,$('#arr'));
  if(isSmall()){M.style.gridTemplateColumns='';for(const el of [ins,lyr])if(el&&el.parentNode===M){el.style.order='';el.style.display=''}
    lyr.classList.toggle('mob',true);lyr.style.display=UI.lyr.open&&UI.lyr.where==='side'?'':'none';return}
  lyr.classList.remove('mob');
  const els={insp:ins,lyr},vis=k=>UI[k].open&&!UI.focus&&!isDetached(k)&&(k!=='lyr'||UI.lyr.where==='side')&&els[k]&&els[k].parentNode===M;
  const L=[],R=[];for(const k of ['insp','lyr']){if(!els[k]||els[k].parentNode!==M)continue;if(vis(k))(UI[k].side==='right'?R:L).push(k);els[k].style.display=vis(k)?'':'none'}
  const Ro=R.slice().reverse();
  M.style.gridTemplateColumns=[...L.map(k=>UI[k].w+'px'),'minmax(0,1fr)',...Ro.map(k=>UI[k].w+'px')].join(' ');
  L.forEach((k,i)=>els[k].style.order=-10+i);$('#arr').style.order=0;Ro.forEach((k,i)=>els[k].style.order=10+i);
  let x=0;for(const k of L){x+=UI[k].w;M.append(grip(k,'left',x))}
  let xr=0;for(const k of R){xr+=UI[k].w;M.append(grip(k,'right',xr))}
  M.classList.toggle('noinsp',!vis('insp'));try{renderBar()}catch(e){}
  for(const k of ['insp','lyr'])if(els[k])els[k].classList.toggle('pright',UI[k].side==='right');
  saveUI();clearTimeout(applyLayout.t);applyLayout.t=setTimeout(()=>{try{drawRuler();schedulePaint();fitTools()}catch(e){}},30)}
function grip(k,side,x){const g=h('div',{class:'pgrip','data-k':k,'data-side':side,title:'Glisser pour élargir / rétrécir « '+PANEL_NAMES[k]+' »',style:side==='left'?{left:(x-3)+'px'}:{right:(x-3)+'px'}});
  g.addEventListener('pointerdown',e=>{if(e.button)return;e.preventDefault();g.setPointerCapture(e.pointerId);const x0=e.clientX,w0=UI[k].w;g.classList.add('on');
    const mv=ev=>{UI[k].w=Math.round(clamp(w0+(side==='left'?ev.clientX-x0:x0-ev.clientX),180,Math.min(720,innerWidth-420)));applyLayout(true)};
    const up=()=>{g.removeEventListener('pointermove',mv);g.removeEventListener('pointerup',up);g.classList.remove('on');saveUI();applyLayout()};g.addEventListener('pointermove',mv);g.addEventListener('pointerup',up)});return g}
// en-tête d'un panneau : titre (glisser = déplacer / détacher), ⇆ côté, ⧉ détacher, ✕ fermer
function phead(k,extra){const det=isDetached(k);
  const hd=h('div',{class:'phead',title:det?'':'Glisser vers un bord pour ranger ce panneau, ou hors de la fenêtre pour le détacher'},h('b',null,PANEL_NAMES[k]),h('div',{style:{flex:1}}),extra||null,
    !det&&!isSmall()&&h('button',{title:'Mettre à '+(UI[k].side==='right'?'gauche':'droite'),onclick:()=>{UI[k].side=UI[k].side==='right'?'left':'right';if(k==='lyr')UI.lyr.where='side';applyLayout();renderLyrics()}},'⇆'),
    k==='lyr'&&!det&&!isSmall()&&h('button',{title:UI.lyr.where==='bottom'?'Remettre sur le côté':'Mettre en bas (dans le panneau du bas)',onclick:()=>lyrWhere(UI.lyr.where==='bottom'?'side':'bottom')},UI.lyr.where==='bottom'?'◧':'⬓'),
    !IS_TOUCH&&!isSmall()&&h('button',{title:det?'Remettre dans la fenêtre principale':'Détacher dans une fenêtre (2ᵉ écran)',onclick:()=>det?detachClose(k):detachOpen(k,k==='insp'?_gid.call(document,'insp'):ensureLyr())},det?'⤓':'⧉'),
    h('button',{title:'Fermer',onclick:()=>closePanelK(k)},'✕'));
  if(!det)hd.addEventListener('pointerdown',e=>{if(e.target.closest('button,select,input'))return;startDock(k,e)});return hd}
function closePanelK(k){if(isDetached(k))detachClose(k);if(k==='lyr'&&UI.lyr.where==='bottom'&&TAB==='lyrics'){setTab('lyrics');UI.lyr.open=false;applyLayout();return}UI[k].open=false;applyLayout();if(k==='lyr')renderLyrics()}
function togglePanelK(k,force){if(isDetached(k)){DET.w[k].win.focus();return}
  if(k==='lyr'&&UI.lyr.where==='bottom'){const on=TAB==='lyrics'&&$('#bottom').classList.contains('open');if(force===true&&on)return;UI.lyr.open=true;setTab('lyrics');return}
  UI[k].open=force!=null?force:!UI[k].open;if(UI[k].open)UI.focus=false;applyLayout();if(k==='lyr')renderLyrics();if(k==='insp')renderInspector()}
// l'inspecteur a son en-tête (re-créé à chaque rendu)
{const o=renderInspector;renderInspector=function(){const r=o.apply(this,arguments);const I=$('#insp');if(I&&!isSmall()&&!I.querySelector(':scope>.phead'))I.prepend(phead('insp'));
  if(I&&!I.querySelector('.lyrbtn')){const t=findTrack(SEL);if(t)I.append(h('div',{class:'sec lyrbtn'},h('button',{onclick:()=>{UI.lyr.tab=t.id;togglePanelK('lyr',true);renderLyrics()}},'📝 Paroles de « '+t.name+' » (L)')))}return r}}
// le bouton ⓘ (et la touche I) ouvrent / ferment l'inspecteur dans la nouvelle disposition
document.addEventListener('click',e=>{if(isSmall()||!e.target.closest||!e.target.closest('#bInsp'))return;e.stopPropagation();e.preventDefault();togglePanelK('insp')},true);

// ---------- glisser un panneau vers un bord (zone bleue) ou hors de la fenêtre (détacher) ----------
let DOCK=null;
function startDock(k,e){if(isSmall()||IS_TOUCH||e.button)return;DOCK={k,x0:e.clientX,y0:e.clientY,on:false,el:e.currentTarget,pid:e.pointerId};try{e.currentTarget.setPointerCapture(e.pointerId)}catch(err){}}
function dockZoneAt(x,y,k){if(x<0||y<0||x>innerWidth||y>innerHeight)return'out';if(x<170)return'left';if(x>innerWidth-170)return'right';if(k==='lyr'&&y>innerHeight-150)return'bottom';return null}
document.addEventListener('pointermove',e=>{if(!DOCK)return;if(!DOCK.on){if(Math.hypot(e.clientX-DOCK.x0,e.clientY-DOCK.y0)<8)return;DOCK.on=true;
    const z=h('div',{id:'dockz'},h('div',{class:'dz left'},'⬅ Ranger à gauche'),h('div',{class:'dz right'},'Ranger à droite ➡'),DOCK.k==='lyr'&&h('div',{class:'dz bottom'},'⬇ Ranger en bas'),h('div',{class:'dz hint'},'Relâchez hors de la fenêtre pour détacher « '+PANEL_NAMES[DOCK.k]+' » (2ᵉ écran)'));document.body.append(z)}
  const zone=dockZoneAt(e.clientX,e.clientY,DOCK.k);document.querySelectorAll('#dockz .dz').forEach(d=>d.classList.toggle('hot',d.classList.contains(zone||'-')||(zone==='out'&&d.classList.contains('hint'))))},true);
document.addEventListener('pointerup',e=>{if(!DOCK)return;const d=DOCK;DOCK=null;const z=$('#dockz');if(z)z.remove();if(!d.on)return;
  const zone=dockZoneAt(e.clientX,e.clientY,d.k);if(!zone)return;
  if(zone==='out'){if(d.k==='chat')return detachOpen('chat');return detachOpen(d.k,d.k==='insp'?_gid.call(document,'insp'):ensureLyr())}
  if(d.k==='chat'){C2.side=zone==='right'?'right':'left';savePanelPref();layoutPanel();drawPanel();return}
  if(zone==='bottom')return lyrWhere('bottom');
  UI[d.k].side=zone;if(d.k==='lyr')UI.lyr.where='side';UI[d.k].open=true;applyLayout();if(d.k==='lyr')renderLyrics();if(d.k==='insp')renderInspector()},true);
// le panneau du chat se déplace aussi en glissant sa barre d'onglets
document.addEventListener('pointerdown',e=>{const t=e.target.closest&&e.target.closest('#cpanel .ctabs');if(!t||e.target.closest('button,select,input')||isDetached('chat'))return;startDock('chat',e)},true);

// ---------- 📝 paroles (projet + une par piste), comme le bloc-notes de Logic ----------
const lyrTarget=()=>{const k=UI.lyr.tab;if(k!=='proj'&&!findTrack(k))UI.lyr.tab='proj';return UI.lyr.tab};
const lyrGet=k=>k==='proj'?(P.lyrics||''):((findTrack(k)||{}).lyrics||'');
function lyrSet(k,v){if(k==='proj')P.lyrics=v;else{const t=findTrack(k);if(t)t.lyrics=v}DIRTY=true}
const lyrLocked=k=>COLLAB.on&&(COLLAB.viewer||(k!=='proj'&&lockedByOther(k)));
function lyrWhere(w){UI.lyr.where=w;UI.lyr.open=true;if(isDetached('lyr'))detachClose('lyr');
  if(w==='bottom'){applyLayout();TAB=null;setTab('lyrics')}else{if(TAB==='lyrics'){$('#bottom').classList.remove('open');TAB=null;renderBottom()}applyLayout()}renderLyrics();saveUI()}
function renderLyrics(){if(!P)return;
  const el=ensureLyr();el.innerHTML='';const k=lyrTarget(),locked=lyrLocked(k),fs=UI.lyr.font||16;
  el.append(phead('lyr',h('span',{class:'lyrfs'},h('button',{title:'Texte plus petit',onclick:()=>{UI.lyr.font=Math.max(11,fs-2);saveUI();renderLyrics()}},'A−'),h('button',{title:'Texte plus grand',onclick:()=>{UI.lyr.font=Math.min(40,fs+2);saveUI();renderLyrics()}},'A+'))));
  const sel=h('select',{class:'lyrsel',onchange:e=>{UI.lyr.tab=e.target.value;saveUI();renderLyrics()}},h('option',{value:'proj',selected:k==='proj'},'📄 Paroles du projet'),
    (P.tracks||[]).map(t=>h('option',{value:t.id,selected:k===t.id},tIco(t)+' '+t.name+((t.lyrics||'').trim()?' ✎':''))));
  const ta=h('textarea',{class:'lyrtxt',spellcheck:true,readonly:locked||null,style:{fontSize:fs+'px'},placeholder:k==='proj'?'Toutes les paroles du morceau…\n\n[0m00] Intro\n[0m14] Couplet 1 : …\n[0m41] Refrain : …\n\nAstuce : [1m25] en début de ligne = à 1 min 25 (le prompteur suit la lecture). Bouton « [ ] Temps » pour l’ajouter.':'Paroles de cette piste (couplet, ad-libs, backs…)',
    onfocus:e=>{if(e.target.dataset.nosnap){delete e.target.dataset.nosnap;return}if(!locked)snapshot()},oninput:e=>{if(lyrLocked(k)){e.target.value=lyrGet(k);return lockToast(k,lockedByOther(k)||VIEW_LOCK)}lyrSet(k,e.target.value)},onkeydown:e=>e.stopPropagation()});
  ta.value=lyrGet(k);
  el.append(h('div',{class:'lyrbar'},sel,h('button',{title:'Afficher les paroles de la piste sélectionnée',onclick:()=>{const t=findTrack(SEL);if(t){UI.lyr.tab=t.id;saveUI();renderLyrics()}}},'↳ Piste sélectionnée')),
    ta,h('div',{class:'lyrbar'},h('button',{title:'Insérer le temps où est la tête de lecture (ex. [1m25])',disabled:locked||null,onclick:()=>{const b='['+fmtMS((E.playing?E.pos():PH)*spb())+'] ',p=ta.selectionStart||0;
        const ls=ta.value.lastIndexOf('\n',p-1)+1;snapshot();ta.value=ta.value.slice(0,ls)+b+ta.value.slice(ls);lyrSet(k,ta.value);ta.dataset.nosnap=1;ta.focus();ta.selectionStart=ta.selectionEnd=p+b.length}},'[ ] Temps'),
      h('button',{title:'Afficher les paroles en grand (prompteur)',onclick:()=>showPrompter(true)},'🎤 Prompteur'),
      h('label',{class:'dim',title:'Afficher le prompteur automatiquement quand on enregistre'},h('input',{type:'checkbox',checked:UI.prompt,onchange:e=>{UI.prompt=e.target.checked;saveUI()}}),' auto à l’enregistrement')),
    locked&&h('div',{class:'dim',style:{padding:'0 10px 8px'}},COLLAB.viewer?'👁 Écoute seule : lecture seulement.':'🔒 Piste verrouillée par '+lockedByOther(k).n+' : lecture seulement.'));
  if(UI.lyr.where==='bottom'&&!isDetached('lyr')&&TAB==='lyrics'){const C=$('#bcontent');if(C&&el.parentNode!==C){C.innerHTML='';C.append(el)}el.style.display='';el.style.order=''}}
function refreshLyrics(){const el=LYR_EL;if(!el||!el.isConnected)return;const ta=el.querySelector('.lyrtxt'),sel=el.querySelector('.lyrsel');if(!ta)return;
  const k=lyrTarget();if(sel&&sel.value!==k)return renderLyrics();const v=lyrGet(k);if(ta.value===v){if(!!ta.readOnly!==!!lyrLocked(k))renderLyrics();return}
  const doc=ta.ownerDocument,focused=doc.activeElement===ta,a=ta.value;let p0=ta.selectionStart,p1=ta.selectionEnd;
  let s=0;while(s<a.length&&s<v.length&&a[s]===v[s])s++;const d=v.length-a.length;ta.value=v;
  if(focused){if(p0>s)p0=Math.max(s,p0+d);if(p1>s)p1=Math.max(s,p1+d);ta.selectionStart=p0;ta.selectionEnd=p1}}
{const o=renderAll;renderAll=function(){const r=o.apply(this,arguments);try{refreshLyrics();if(UI.lyr.open||isDetached('lyr')){const el=LYR_EL;if(el&&!el.querySelector('.lyrtxt'))renderLyrics()}}catch(e){}return r}}
{const o=renderBottom;renderBottom=function(){const r=o.apply(this,arguments);const b=$('#btabs [data-tab=lyrics]');if(b)b.style.display=UI.lyr.where==='bottom'?'':'none';
  if(TAB==='lyrics'&&$('#bottom').classList.contains('open')&&!isDetached('lyr'))renderLyrics();return r}}
// les autres (en session) changent les paroles : l'affichage suit sans perdre le curseur
setInterval(()=>{if(COLLAB.on)try{refreshLyrics()}catch(e){}},400);

// ---------- 🎤 prompteur (paroles en grand pendant la prise) ----------
let PROMPT=null;
function prompterSrc(){const armed=(P.tracks||[]).find(t=>t.arm&&(t.lyrics||'').trim());if(armed)return{txt:armed.lyrics,src:armed.name};
  const s=findTrack(SEL);if(s&&(s.lyrics||'').trim())return{txt:s.lyrics,src:s.name};if((P.lyrics||'').trim())return{txt:P.lyrics,src:'Projet'};
  const k=UI.lyr.tab;if(k!=='proj'&&(lyrGet(k)||'').trim())return{txt:lyrGet(k),src:(findTrack(k)||{}).name};return null}
function showPrompter(manual){hidePrompter();const s=prompterSrc();if(!s){if(manual)toast('Écrivez d’abord des paroles (touche L)');return}
  const lines=s.txt.split('\n').map(l=>{const m=/^\s*\[\s*(?:(\d+)\s*m\s*(\d{1,2})|(\d+):(\d{2})|(\d+))\s*\]\s*/.exec(l);if(!m)return{at:null,txt:l};
    const at=m[5]!=null?(+m[5]-1)*P.sig:((+(m[1]||m[3]))*60+(+(m[2]||m[4])))/spb(); // [1m25] / [1:25] = temps ; [5] = mesure 5 (anciens repères)
    return{at,txt:l.slice(m[0].length)}});
  const box=h('div',{class:'pbody',style:{fontSize:Math.round((UI.lyr.font||16)*1.9)+'px'}},lines.map((l,i)=>h('div',{class:'pl','data-i':i},l.txt||' ')));
  const el=h('div',{id:'prompter'},h('div',{class:'phd'},h('span',null,'🎤 '+s.src),h('div',{style:{flex:1}}),h('button',{title:'Plus petit',onclick:()=>{UI.lyr.font=Math.max(11,(UI.lyr.font||16)-2);saveUI();showPrompter(PROMPT&&PROMPT.manual)}},'A−'),
    h('button',{title:'Plus grand',onclick:()=>{UI.lyr.font=Math.min(40,(UI.lyr.font||16)+2);saveUI();showPrompter(PROMPT&&PROMPT.manual)}},'A+'),h('button',{title:'Fermer',onclick:hidePrompter},'✕')),box);
  document.body.append(el);let last=-1;
  PROMPT={el,manual,t:setInterval(()=>{const pos=SCRUB!=null?SCRUB:E.playing?E.pos():PH;let cur=-1;lines.forEach((l,i)=>{if(l.at!=null&&l.at<=pos+1e-6)cur=i});
    if(cur!==last){last=cur;box.querySelectorAll('.pl.cur').forEach(x=>x.classList.remove('cur'));const c=box.querySelector('.pl[data-i="'+cur+'"]');if(c){c.classList.add('cur');c.scrollIntoView({block:'center',behavior:'smooth'})}}},120)}}
function hidePrompter(){if(!PROMPT)return;clearInterval(PROMPT.t);PROMPT.el.remove();PROMPT=null}
{const o=toggleRecord;toggleRecord=async function(){const wasRec=!!REC;const r=await o.apply(this,arguments);if(!wasRec&&REC&&UI.prompt&&prompterSrc()&&!PROMPT)showPrompter(false);return r}}

// ---------- 🎙 prises multiples : ré-enregistrer par-dessus garde les anciennes prises ----------
let COMP=null;
{const o=carve;carve=function(t,a,b){if(COMP&&t.type==='audio'){const sp=spb();for(const r of t.regions){const s=r.start,e=s+r.dur/sp;if(e<=a||s>=b)continue;
    (COMP[t.id]||(COMP[t.id]=[])).push(...(r.takes&&r.takes.length?r.takes.map(k=>Object.assign({},k)):[{buf:r.buf,at:r.start-r.offset/sp,name:r.name||'Prise'}]))}}return o.apply(this,arguments)}}
{const o=stopRecord;stopRecord=function(){const rec=REC;COMP={};let res;try{res=o.apply(this,arguments)}finally{const comp=COMP;COMP=null;let n=0;
  if(rec&&comp)for(const tid of rec.tracks){const t=findTrack(tid),old=comp[tid];if(!t||!old||!old.length)continue;const nr=t.regions[t.regions.length-1];if(!nr||Math.abs(nr.start-rec.start)>1e-6||!nr.buf)continue;
    const seen=new Set(),takes=[];for(const k of old){const key=k.buf+'@'+(+k.at).toFixed(4);if(seen.has(key)||!k.buf)continue;seen.add(key);takes.push(k)}
    takes.push({buf:nr.buf,at:nr.start-nr.offset/spb()});takes.forEach((k,i)=>k.name='Prise '+(i+1));nr.takes=takes;nr.take=takes.length-1;nr.name='Prise '+takes.length+' / '+takes.length;n=takes.length}
  if(n){renderLanes();if(COLLAB.on)collabFlush();toast('🎙 Prise '+n+' enregistrée, les précédentes sont gardées : clic sur 🎙 dans la région pour choisir, ✂ (Ctrl+T) pour mélanger les meilleurs bouts.',6000)}
  if(PROMPT&&!PROMPT.manual)hidePrompter()}return res}}
function setTake(t,r,i){const k=r.takes&&r.takes[i];if(!k)return;if(COLLAB.on&&lockedByOther(t.id))return lockToast(t.id,lockedByOther(t.id));snapshot();r.buf=k.buf;r.offset=(r.start-k.at)*spb();r.take=i;r.name='Prise '+(i+1)+' / '+r.takes.length;renderLanes();if(COLLAB.on)collabFlush()}
function takeMenu(e,t,r){menu(e,['Prises de cette région',...r.takes.map((k,i)=>[(i===r.take?'✔ ':'   ')+k.name,()=>setTake(t,r,i)]),'-',
  ['✂ Couper à la tête de lecture (pour mélanger les prises)',()=>{SELR=new Set([r.id]);splitAtPH()}],['🧹 Garder seulement la prise choisie',()=>{snapshot();delete r.takes;delete r.take;r.name='Prise';renderLanes();if(COLLAB.on)collabFlush()}]])}
{const o=regionEl;regionEl=function(t,r){const e=o.apply(this,arguments);if(r.takes&&r.takes.length>1)e.append(h('div',{class:'tk',title:'Prises : cliquer pour choisir',onpointerdown:ev=>ev.stopPropagation(),
  onclick:ev=>{ev.stopPropagation();takeMenu(ev,t,r)}},'🎙 '+((r.take!=null?r.take:r.takes.length-1)+1)+'/'+r.takes.length));return e}}
document.addEventListener('keydown',e=>{if(!(e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown'))||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))return; // Alt+↑/↓ : prise suivante / précédente
  const ids=[...SELR];if(ids.length!==1)return;const f=findRegion(ids[0]);if(!f||!f[1].takes||f[1].takes.length<2)return;e.preventDefault();e.stopPropagation();const [t,r]=f,n=r.takes.length;setTake(t,r,((r.take||0)+(e.key==='ArrowUp'?-1:1)+n)%n)},true);

// ---------- 📌 notes « tout le morceau » dans la règle + clic droit sur une piste ----------
let NHITS=[];
{const o=drawRuler;drawRuler=function(){const r=o.apply(this,arguments);try{drawNotePins()}catch(e){}return r}}
function drawNotePins(){NHITS=[];const list=(P&&P.cmts||[]).filter(c=>!c.tid||!findTrack(c.tid));if(!list.length)return;const cv=$('#rulerCv'),R=$('#ruler');if(!cv||!R)return;
  const dp=window.devicePixelRatio||1,g=cv.getContext('2d'),sl=$('#lanesWrap').scrollLeft,w=R.clientWidth;g.setTransform(dp,0,0,dp,0,0);g.font='700 8px -apple-system,Segoe UI,Roboto,sans-serif';g.textAlign='center';
  for(const c of list){const x=c.beat*PPB-sl;if(x<-8||x>w+8)continue;g.fillStyle=c.done?'#6e6e73':(c.c||'#ffd60a');g.beginPath();g.arc(x,6,5.5,0,7);g.fill();g.fillStyle='#fff';g.fillText(c.done?'✔':(c.n||'?').slice(0,1).toUpperCase(),x,9);NHITS.push({c,x})}g.textAlign='left'}
const notePinAt=e=>{const R=$('#ruler').getBoundingClientRect(),x=e.clientX-R.left,y=e.clientY-R.top;if(y>13)return null;let best=null,bd=8;for(const k of NHITS){const d=Math.abs(k.x-x);if(d<bd){bd=d;best=k.c}}return best};
document.addEventListener('pointerdown',e=>{if(e.button||!e.target.closest||!e.target.closest('#ruler'))return;const c=notePinAt(e);if(!c)return;e.stopPropagation();e.preventDefault();C2.hi=c.id;openPanel('cmts');renderPins()},true);
document.addEventListener('mousemove',e=>{let tip=_gid.call(document,'ntip');const inR=e.target.closest&&e.target.closest('#ruler'),c=inR&&notePinAt(e);
  if(!c){if(tip)tip.remove();return}if(!tip){tip=h('div',{id:'ntip'});document.body.append(tip)}tip.textContent='📌 '+c.n+' · '+fmtBar(c.beat)+(c.done?' · ✔ résolue':'')+' — '+c.x+((c.rep||[]).length?' ('+c.rep.length+' réponse'+(c.rep.length>1?'s':'')+')':'');
  tip.style.left=Math.min(e.clientX+12,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=(e.clientY+16)+'px'});
document.addEventListener('contextmenu',e=>{if(!e.target.closest||!e.target.closest('#lanes')||e.target.closest('.reg,.cpin'))return;const ln=e.target.closest('.lane');if(!ln)return;e.preventDefault();e.stopPropagation();
  const t=findTrack(ln.dataset.t),L=$('#lanes').getBoundingClientRect(),b=Math.max(0,snapB((e.clientX-L.left)/PPB,1)),bm=snapB(b,P.sig);
  menu(e,[t?t.name:'Piste',['📌 Ajouter une note ici, sur cette piste ('+fmtBar(b)+')',()=>askComment(b,t&&t.id)],['📌 Note pour tout le morceau ici',()=>askComment(b,'')],
    !COLLAB.viewer&&['🏷 Ajouter un marqueur ici ('+fmtBar(bm)+')',()=>markAdd(bm)],t&&['📝 Paroles de cette piste',()=>{UI.lyr.tab=t.id;togglePanelK('lyr',true);renderLyrics()}]].filter(Boolean))},true);

// ---------- 🎯 mode focus (F) ----------
function toggleFocus(){UI.focus=!UI.focus;applyLayout();layoutPanel();toast(UI.focus?'🎯 Mode focus : seulement les pistes. F (ou Échap) pour tout réafficher.':'Mode focus désactivé',3000)}

// ---------- 🖥 dispositions enregistrées (1, 2, 3) ----------
const SCREEN_DEF={1:{n:'Écriture',insp:{open:false},lyr:{open:true,where:'side',side:'right',w:380},chat:{open:true,side:'right',tab:'chat'},bottom:{open:false}},
  2:{n:'Enregistrement',insp:{open:true,side:'left'},lyr:{open:true,where:'side',side:'right',w:420,font:20},chat:{open:false},bottom:{open:false},prompt:true},
  3:{n:'Mix',insp:{open:true,side:'left'},lyr:{open:false},chat:{open:false},bottom:{open:true,tab:'mixer',h:.55}}};
const SCREENS=()=>{const s=JSON.parse(JSON.stringify(SCREEN_DEF));try{Object.assign(s,JSON.parse(localStorage.getItem('studio_screens')||'{}'))}catch(e){}return s};
function captureScreen(n){const B=$('#bottom');return{n,insp:Object.assign({},UI.insp),lyr:Object.assign({},UI.lyr),prompt:UI.prompt,chat:{open:C2.open,side:C2.side,w:C2.w,tab:C2.tab},
  bottom:{open:!!(B&&B.classList.contains('open')),tab:TAB,h:B?Math.round(B.offsetHeight/innerHeight*100)/100:.35}}}
function saveScreen(i,name){const all=(()=>{try{return JSON.parse(localStorage.getItem('studio_screens')||'{}')}catch(e){return{}}})();all[i]=captureScreen(name||SCREENS()[i].n);try{localStorage.setItem('studio_screens',JSON.stringify(all))}catch(e){}toast('🖥 Disposition '+i+' « '+all[i].n+' » enregistrée')}
function applyScreen(i){const s=SCREENS()[i];if(!s)return;UI.focus=false;Object.assign(UI.insp,s.insp||{});Object.assign(UI.lyr,s.lyr||{});if(s.prompt!=null)UI.prompt=s.prompt;
  if(s.chat&&s.chat.open){if(s.chat.side)C2.side=s.chat.side;if(s.chat.w)C2.w=s.chat.w;savePanelPref();openPanel(s.chat.tab==='chat'&&!COLLAB.on?'cmts':(s.chat.tab||'cmts'))}else if(C2.open&&!isDetached('chat'))closePanel();
  const B=$('#bottom');if(!isDetached('bottom')&&B){if(s.bottom&&s.bottom.open){if(s.bottom.h)document.documentElement.style.setProperty('--bh',Math.round(clamp(s.bottom.h,.15,.8)*innerHeight)+'px');
      const tb=s.bottom.tab==='lyrics'&&UI.lyr.where!=='bottom'?'mixer':(s.bottom.tab||'mixer');TAB=tb;B.classList.add('open');renderBottom()}
    else if(!(UI.lyr.where==='bottom'&&UI.lyr.open)){B.classList.remove('open');TAB=null;renderBottom()}}
  if(UI.lyr.open&&UI.lyr.where==='bottom'){TAB=null;setTab('lyrics')}
  applyLayout();renderLyrics();renderInspector();layoutPanel();saveUI();toast('🖥 Disposition '+i+' · '+s.n,2200)}
function resetLayout(){for(const k of Object.keys(DET.w))detachClose(k);try{['studio_ui','studio_cpanel','studio_layout'].forEach(k=>localStorage.removeItem(k))}catch(e){}
  Object.assign(UI.insp,{open:true,w:236,side:'left'});Object.assign(UI.lyr,{open:false,w:340,side:'right',where:'side',font:16});UI.focus=false;C2.w=330;C2.side='right';
  document.documentElement.style.removeProperty('--bh');if(C2.open)closePanel();applyLayout();renderLyrics();renderInspector();toast('Disposition réinitialisée')}
function screensModal(){const box=h('div'),m=modal(box);const draw=()=>{box.innerHTML='';const S=SCREENS();
  box.append(h('h2',null,'🖥 Dispositions et panneaux'),h('p',{style:{color:'var(--dim)'}},'Une disposition retient quels panneaux sont ouverts, leur côté et leur taille. Passez de l’une à l’autre avec les touches 1, 2, 3.'),
    [1,2,3].map(i=>{const nm=h('input',{type:'text',value:S[i].n,maxlength:30,style:{width:'150px'},onkeydown:e=>e.stopPropagation()});
      return h('div',{class:'kv2'},h('span',null,h('kbd',null,i),' ',nm),h('span',{style:{display:'flex',gap:'6px'}},h('button',{onclick:()=>{m.remove();applyScreen(i)}},'Afficher'),h('button',{title:'Enregistrer la disposition actuelle à cette place',onclick:()=>{saveScreen(i,nm.value.trim()||S[i].n);draw()}},'💾 Mettre la disposition actuelle')))}),
    h('h4',null,'Panneaux'),
    h('div',{class:'kv2'},'ⓘ Inspecteur',h('kbd',null,'I')),h('div',{class:'kv2'},'📝 Paroles',h('kbd',null,'L')),h('div',{class:'kv2'},'🎚 Mixeur',h('kbd',null,'X')),h('div',{class:'kv2'},'💬 Chat (en session)',h('kbd',null,'T')),
    h('div',{class:'kv2'},'📌 Notes et marqueurs',h('kbd',null,'N')),h('div',{class:'kv2'},'🎯 Mode focus (seulement les pistes)',h('kbd',null,'F')),
    h('p',{style:{color:'var(--dim)',fontSize:'11px'}},'Chaque panneau : tirez son bord pour le redimensionner, glissez son titre vers la gauche / la droite (ou en bas pour les paroles) pour le ranger, ou hors de la fenêtre pour le détacher sur un 2ᵉ écran. Les pistes et leurs noms restent toujours à leur place.'),
    h('div',{style:{display:'flex',gap:'8px',marginTop:'8px'}},h('button',{onclick:()=>{m.remove();toggleFocus()}},'🎯 Mode focus'),h('button',{onclick:()=>{m.remove();resetLayout()}},'↺ Réinitialiser la disposition')))};draw()}

// ---------- raccourcis ----------
document.addEventListener('keydown',e=>{
  const tg=e.target.tagName;if(/^(INPUT|SELECT|TEXTAREA)$/.test(tg)&&e.target.type!=='range')return;if(e.ctrlKey||e.metaKey||e.altKey||TYPING)return;
  const k=e.key.toLowerCase(),dg=/^(Digit|Numpad)([123])$/.exec(e.code||'');
  if(dg&&!e.shiftKey){e.preventDefault();applyScreen(+dg[2]);return}
  if(e.shiftKey)return;
  if(k==='l'){e.preventDefault();togglePanelK('lyr');return}
  if(k==='t'){e.preventDefault();if(COLLAB.on)C2.open&&C2.tab==='chat'?closePanel():openPanel('chat');else toast('Le chat marche en session : ☰ Fichier → 👥 Session à plusieurs');return}
  if(k==='n'){e.preventDefault();C2.open&&C2.tab==='cmts'?closePanel():openPanel('cmts');return}
  if(k==='f'){e.preventDefault();toggleFocus();return}
  if(k==='escape'&&UI.focus){toggleFocus();return}});
{const o=shortcutsModal;shortcutsModal=function(){const r=o.apply(this,arguments);const ms=document.querySelectorAll('.modal .box'),b=ms[ms.length-1];
  if(b)b.append(h('h4',null,'Panneaux et dispositions (v3.7)'),h('p',null,h('kbd',null,'1'),' ',h('kbd',null,'2'),' ',h('kbd',null,'3'),' dispositions · ',h('kbd',null,'L'),' paroles · ',h('kbd',null,'T'),' chat · ',h('kbd',null,'N'),' notes · ',h('kbd',null,'F'),' mode focus · ',h('kbd',null,'Alt'),'+',h('kbd',null,'↑'),h('kbd',null,'↓'),' changer de prise'));return r}}

// ---------- barre d'outils : ce qui ne tient pas va dans « ⋯ » ----------
function fitTools(){const T=$('#arrtools');if(!T||T.closest('.detached'))return;let more=_gid.call(document,'bToolsMore');
  if(!more){more=h('button',{id:'bToolsMore',title:'Plus d’outils',onclick:e=>{const items=[...T.children].filter(x=>x!==more&&x.dataset.hid&&x.tagName==='BUTTON');
    menu(e,['Outils',...items.map(x=>[(x.textContent.trim()+' '+(x.title||'')).trim(),()=>x.click()])])}},'⋯');T.append(more)}
  const kids=[...T.children].filter(x=>x!==more);kids.forEach(x=>{if(x.dataset.hid){x.style.display='';delete x.dataset.hid}});more.style.display='none';
  if(T.scrollWidth<=T.clientWidth+1)return;more.style.display='';
  for(let i=kids.length-1;i>=0&&T.scrollWidth>T.clientWidth+1;i--){const x=kids[i];if(x.tagName==='SELECT'||x.id==='bAdd')continue;x.style.display='none';x.dataset.hid='1'}}
addEventListener('resize',()=>{clearTimeout(fitTools.t);fitTools.t=setTimeout(()=>{applyLayout();fitTools()},120)});

// ---------- démarrage ----------
addEventListener('load',function boot11(){if(typeof P==='undefined'||!P||!E)return setTimeout(boot11,60); // attendre que le projet soit chargé
  setTimeout(()=>{
  const T=$('#arrtools'),sn=$('#snapSel'),pin=$('#bNotes');
  if(T&&sn){const after=sn.nextSibling;if(pin)T.insertBefore(pin,after);
    T.insertBefore(h('button',{id:'bLyr',title:'Paroles du projet et des pistes (L)',onclick:()=>togglePanelK('lyr')},'📝'),pin?pin.nextSibling:after);
    T.insertBefore(h('button',{id:'bScreens',title:'Dispositions et panneaux (1, 2, 3, F)',onclick:screensModal},'🖥'),$('#bLyr').nextSibling)}
  const bt=$('#btabs');if(bt&&!bt.querySelector('[data-tab=lyrics]')){const b=h('button',{'data-tab':'lyrics',style:{display:UI.lyr.where==='bottom'?'':'none'},onclick:()=>setTab('lyrics')},'📝 Paroles');const ref=bt.querySelector('.sp');bt.insertBefore(b,ref||null)}
  if(!UI.insp.open&&!isSmall())_gid.call(document,'main').classList.add('noinsp');
  applyLayout();renderLyrics();renderInspector();fitTools();
  if(UI.lyr.open&&UI.lyr.where==='bottom'&&!isSmall()){TAB=null;setTab('lyrics')}},50)});
// bibliothèque de plugins : détachable aussi
{const o=renderLibrary;renderLibrary=function(){const r=o.apply(this,arguments);const hd=$('#library .lib-hd');if(hd&&!hd.querySelector('.detb')&&!IS_TOUCH&&!isSmall()){const det=isDetached('library');
  hd.append(h('button',{class:'detb',title:det?'Remettre dans la fenêtre principale':'Détacher dans une fenêtre (2ᵉ écran)',onclick:()=>isDetached('library')?detachClose('library'):detachOpen('library',_gid.call(document,'library'))},det?'⤓':'⧉'))}return r}}
