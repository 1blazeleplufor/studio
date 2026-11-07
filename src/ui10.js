// ===== v3.6 : défilement automatique, roue de couleurs + pipette, préréglages ZZ, marqueurs, fenêtres détachables =====

// ---------- défilement automatique quand on glisse vers le bord ----------
const AS={on:false,armed:false,sc:null,tgt:null,x:0,y:0,x0:0,y0:0,pid:0,mods:{},raf:0,active:false};
document.addEventListener('pointerdown',e=>{
  if(e.button||!e.target.closest)return;const z=e.target.closest('#lanesWrap,#ruler,#prScroll');if(!z)return;
  if(e.pointerType!=='mouse'&&!e.target.closest('.reg,#playhead,#ruler,#prCanvas'))return; // au doigt, le fond défile déjà nativement
  if(e.target===z&&z.id==='lanesWrap')return; // clic dans la barre de défilement
  Object.assign(AS,{on:true,armed:false,sc:z.id==='ruler'?$('#lanesWrap'):z,tgt:e.target,x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,pid:e.pointerId,vert:z.id!=='ruler'&&e.target.id!=='playhead'})},true);
document.addEventListener('pointermove',e=>{if(!AS.on||!e.isTrusted)return;AS.x=e.clientX;AS.y=e.clientY;AS.mods={shiftKey:e.shiftKey,altKey:e.altKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey};
  if(!AS.armed&&Math.hypot(AS.x-AS.x0,AS.y-AS.y0)>4)AS.armed=true;if(AS.armed&&!AS.raf)AS.raf=requestAnimationFrame(asTick)},true);
for(const ev of ['pointerup','pointercancel'])document.addEventListener(ev,()=>{AS.on=false;AS.active=false},true);
function asTick(){AS.raf=0;if(!AS.on||!AS.armed||!AS.sc||!AS.sc.isConnected)return;
  const r=AS.sc.getBoundingClientRect(),E_=40,sp=d=>Math.ceil(Math.min(1,d/E_)**2*28);let vx=0,vy=0;
  if(AS.x<r.left+E_)vx=-sp(r.left+E_-AS.x);else if(AS.x>r.right-E_)vx=sp(AS.x-(r.right-E_));
  if(AS.vert){if(AS.y<r.top+E_)vy=-sp(r.top+E_-AS.y);else if(AS.y>r.bottom-E_)vy=sp(AS.y-(r.bottom-E_))}
  const sl=AS.sc.scrollLeft,st=AS.sc.scrollTop;if(vx)AS.sc.scrollLeft=Math.max(0,sl+vx);if(vy)AS.sc.scrollTop=Math.max(0,st+vy);
  if(AS.sc.scrollLeft!==sl||AS.sc.scrollTop!==st){AS.active=true;
    if(AS.sc.id==='lanesWrap'&&AS.sc.scrollLeft+AS.sc.clientWidth>=AS.sc.scrollWidth-4&&vx>0){const L=$('#lanes');L.style.width=(L.offsetWidth+400)+'px'} // la timeline s'allonge si besoin
    const t=AS.tgt&&AS.tgt.isConnected?AS.tgt:(AS.sc.id==='lanesWrap'?$('#lanes'):AS.sc.firstElementChild);
    try{t.dispatchEvent(new PointerEvent('pointermove',Object.assign({bubbles:true,cancelable:true,composed:true,clientX:AS.x,clientY:AS.y,pointerId:AS.pid,pointerType:'mouse',buttons:1},AS.mods)))}catch(err){}}
  AS.raf=requestAnimationFrame(asTick)}

// ---------- pendant la lecture : la vue suit la tête de lecture en continu ----------
const FOL={user:false,auto:-1};
function followPlayhead(pos){const W=$('#lanesWrap');if(!W)return;const x=pos*PPB,vw=W.clientWidth;
  if(FOL.user)return; // vous avez fait défiler à la main : on vous laisse tranquille jusqu'à la prochaine lecture
  if(x<W.scrollLeft||x>W.scrollLeft+vw)W.scrollLeft=Math.max(0,x-vw*.25);else if(x>W.scrollLeft+vw*.45)W.scrollLeft=x-vw*.45;FOL.auto=W.scrollLeft}
{const o=Engine.prototype.play;Engine.prototype.play=function(){if(this.live)FOL.user=false;return o.apply(this,arguments)}}
addEventListener('resize',()=>{if(typeof layoutPanel==='function'&&C2.open)layoutPanel()});
addEventListener('load',()=>{const W=$('#lanesWrap');if(!W)return;
  W.addEventListener('wheel',e=>{if(E&&E.playing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(Math.abs(e.deltaX)>Math.abs(e.deltaY)||e.shiftKey))FOL.user=true},{passive:true});
  W.addEventListener('pointerdown',e=>{if(E&&E.playing&&(e.target===W||e.pointerType!=='mouse'))FOL.user=true});
  const t=$('#arrtools');if(t&&!$('#bNotes'))t.append(h('button',{id:'bNotes',title:'Notes et marqueurs sur la timeline',onclick:()=>C2.open&&C2.tab==='cmts'?closePanel():openPanel('cmts')},'📌'));
  const bt=$('#btabs');if(bt&&!IS_TOUCH)bt.append(h('button',{id:'bDetBottom',title:'Détacher le panneau (mixeur, piano roll, batterie) dans une fenêtre : 2ᵉ écran',style:{marginLeft:'auto'},onclick:()=>isDetached('bottom')?detachClose('bottom'):detachOpen('bottom')},'⧉'));
  setTimeout(restoreBanner,1500)});

// ---------- 🎨 roue de couleurs complète + pipette ----------
const RECENT_COLORS=()=>{try{return JSON.parse(localStorage.getItem('studio_colors')||'[]')}catch(e){return[]}};
function hsl2hex(hh,s,l){s/=100;l/=100;const k=n=>(n+hh/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return'#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}
const WHEEL={sect:36,rings:[[95,28],[92,38],[90,48],[85,58],[78,68],[70,78],[60,87]]}; // [saturation, luminosité] de l'extérieur vers l'intérieur
function wheelColor(i,j){const [s,l]=WHEEL.rings[j];return hsl2hex(i*360/WHEEL.sect,s,l)}
colorPicker=function(e,t){
  closeMenu();const doc=(e&&e.target&&e.target.ownerDocument)||document,win=doc.defaultView||window;
  const set=c=>{c=String(c).toLowerCase();try{const r=RECENT_COLORS().filter(x=>x!==c);r.unshift(c);localStorage.setItem('studio_colors',JSON.stringify(r.slice(0,12)))}catch(err){}
    if(t._set)return t._set(c);snapshot();t.color=c;renderAll()};
  const S=250,dp=win.devicePixelRatio||1,cv=h('canvas',{width:S*dp,height:S*dp,style:{width:S+'px',height:S+'px',cursor:'crosshair',display:'block',margin:'0 auto'}});
  const prev=h('div',{class:'cprev',style:{background:t.color}}),code=h('span',{class:'ccode'},String(t.color||''));
  const g=cv.getContext('2d');g.scale(dp,dp);const R=S/2,r0=R*.2,rw=(R-2-r0)/WHEEL.rings.length,da=2*Math.PI/WHEEL.sect;
  for(let j=0;j<WHEEL.rings.length;j++)for(let i=0;i<WHEEL.sect;i++){const ro=R-2-j*rw,ri=ro-rw+1.2,a0=-Math.PI/2+i*da-da/2+.012,a1=a0+da-.024;
    g.beginPath();g.arc(R,R,ro,a0,a1);g.arc(R,R,ri,a1,a0,true);g.closePath();g.fillStyle=wheelColor(i,j);g.fill()}
  g.fillStyle='#fff';g.beginPath();g.arc(R,R,r0-3,0,7);g.fill();
  const pick=ev=>{const b=cv.getBoundingClientRect(),x=ev.clientX-b.left-R,y=ev.clientY-b.top-R,d=Math.hypot(x,y);if(d<r0-3)return'#ffffff';if(d>R-2)return null;
    const j=Math.min(WHEEL.rings.length-1,Math.floor((R-2-d)/rw)),i=((Math.round((Math.atan2(y,x)+Math.PI/2)/da)%WHEEL.sect)+WHEEL.sect)%WHEEL.sect;return wheelColor(i,j)};
  cv.addEventListener('pointermove',ev=>{const c=pick(ev);if(c){prev.style.background=c;code.textContent=c}});
  cv.addEventListener('click',ev=>{const c=pick(ev);if(c){closeMenu();set(c)}});
  const sw=(c,tip)=>h('div',{class:'swatch',title:tip||c,style:{background:c},onclick:()=>{closeMenu();set(c)}});
  const grays=['#ffffff','#d1d1d6','#aeaeb2','#8e8e93','#636366','#48484a','#2c2c2e','#000000'];
  const used=[...new Set([...(P.tracks||[]).map(x=>x.color),...(P.marks||[]).map(x=>x.color)].filter(c=>c&&c!==t.color))];
  const m=h('div',{class:'menu cpick',id:'menu'},h('div',{class:'hd',style:{padding:'0 0 6px'}},'Couleur de « '+(t.name||'')+' »'),cv,
    h('div',{class:'crow'},prev,code,h('div',{style:{flex:1}}),
      win.EyeDropper&&h('button',{title:'Pipette : prendre une couleur n’importe où à l’écran',onclick:async()=>{try{const r=await new win.EyeDropper().open();closeMenu();set(r.sRGBHex)}catch(err){}}},'💧 Pipette'),
      h('label',{class:'cperso',title:'Couleur personnalisée'},'＋',h('input',{type:'color',value:/^#[0-9a-f]{6}$/i.test(t.color)?t.color:'#4a8cff',onchange:ev=>{closeMenu();set(ev.target.value)}}))),
    h('div',{class:'clab'},'Gris'),h('div',{class:'cgrid'},grays.map(c=>sw(c))),
    used.length>0&&h('div',{class:'clab'},'💧 Couleurs du projet (pipette)'),used.length>0&&h('div',{class:'cgrid'},used.map(c=>sw(c,'Couleur déjà utilisée : '+c))),
    RECENT_COLORS().length>0&&h('div',{class:'clab'},'Récentes'),RECENT_COLORS().length>0&&h('div',{class:'cgrid'},RECENT_COLORS().map(c=>sw(c))));
  doc.body.append(m);const r=m.getBoundingClientRect();m.style.left=Math.max(6,Math.min((e&&e.clientX)||100,win.innerWidth-r.width-6))+'px';m.style.top=Math.max(6,Math.min(((e&&e.clientY)||100)+6,win.innerHeight-r.height-6))+'px';
  setTimeout(()=>{doc.addEventListener('pointerdown',closeMenuOut,true);document.addEventListener('pointerdown',closeMenuOut,true)},0)};

// ---------- 🎤 préréglages « style ZZ » (voix mélodique et voix drill/trap) ----------
Object.assign(VOCAL_PRESETS,{
 'ZZ — mélodie (autotune)':{cat:'Style ZZ',sends:[-12,-15],pl:[['gate',{thr:-55}],['tunepro',{input:2,retune:10,humanize:20,flex:15,formant:1,mix:100}],['eq',{hp:100,m1F:300,m1G:-3,m2F:3500,m2G:3,hiF:11000,hiG:3.5}],['comp',{thr:-24,ratio:5,att:4,rel:90,gain:6}],['deess',{}],['chorus',{mix:14,depth:25}],['width',{w:130}]]},
 'ZZ — drill / trap (kickée)':{cat:'Style ZZ',sends:[-24,-18],pl:[['gate',{thr:-50}],['tunepro',{input:2,retune:35,humanize:45,formant:1,mix:100}],['eq',{hp:120,m1F:400,m1G:-3.5,m2F:3000,m2G:4,hiF:10000,hiG:2}],['comp',{thr:-28,ratio:8,att:2,rel:60,gain:8}],['sat',{drive:22,type:1,mix:35,out:-2}],['deess',{}]]},
 'ZZ — ad-libs / backs':{cat:'Style ZZ',sends:[-9,-12],pl:[['tunepro',{input:2,retune:5,humanize:10,formant:1,mix:100}],['eq',{hp:200,m1F:400,m1G:-3,hiG:3}],['comp',{thr:-24,ratio:5,gain:5}],['chorus',{mix:40,depth:50}],['width',{w:170,haas:10}]]}});

// ---------- 🏷 marqueurs dans la règle + menu clic droit (notes, marqueurs) ----------
let MHITS=[];
{const o=drawRuler;drawRuler=function(){const r=o.apply(this,arguments);try{drawMarks()}catch(e){}return r}}
function drawMarks(){MHITS=[];const ms=P&&P.marks;if(!ms||!ms.length)return;const cv=$('#rulerCv'),R=$('#ruler');if(!cv||!R)return;
  const dp=window.devicePixelRatio||1,g=cv.getContext('2d'),sl=$('#lanesWrap').scrollLeft,w=R.clientWidth;g.setTransform(dp,0,0,dp,0,0);g.font='600 10px -apple-system,Segoe UI,Roboto,sans-serif';
  for(const m of ms){const x=m.beat*PPB-sl,tw=g.measureText(m.name).width+10;if(x+tw<0||x>w)continue;
    g.fillStyle=m.color||'#888';g.fillRect(x,14,tw,13);g.fillRect(x,12,2,16);
    const c=(m.color||'#888').replace('#',''),lum=c.length===6?(parseInt(c.slice(0,2),16)*.3+parseInt(c.slice(2,4),16)*.59+parseInt(c.slice(4,6),16)*.11):0;
    g.fillStyle=lum>150?'#111':'#fff';g.fillText(m.name,x+5,24);MHITS.push({m,x0:x,x1:x+tw})}}
const markAt=e=>{const R=$('#ruler').getBoundingClientRect(),y=e.clientY-R.top,x=e.clientX-R.left;if(y<12)return null;const hit=MHITS.filter(k=>x>=k.x0-2&&x<=k.x1).pop();return hit&&hit.m};
let MDRAG=null;
document.addEventListener('pointerdown',e=>{if(e.button||!e.target.closest||!e.target.closest('#ruler'))return;const m=markAt(e);if(!m)return;
  e.stopPropagation();e.preventDefault();MDRAG={m,x0:e.clientX,b0:m.beat,moved:false}},true);
document.addEventListener('pointermove',e=>{if(!MDRAG)return;const dx=e.clientX-MDRAG.x0;if(!MDRAG.moved&&Math.abs(dx)<4)return;
  if(!MDRAG.moved){MDRAG.moved=true;if(COLLAB.viewer)return;snapshot()}if(COLLAB.viewer)return;MDRAG.m.beat=Math.max(0,snapB(MDRAG.b0+dx/PPB,P.settings.snap||.25));drawRuler();renderPins()},true);
document.addEventListener('pointerup',()=>{if(!MDRAG)return;const d=MDRAG;MDRAG=null;if(!d.moved)setPH(d.m.beat);else if(!COLLAB.viewer){P.marks.sort((a,b)=>a.beat-b.beat);cmtChanged()}},true);
document.addEventListener('contextmenu',e=>{if(!e.target.closest||!e.target.closest('#ruler'))return;e.preventDefault();e.stopPropagation();
  const m=markAt(e);if(m&&!COLLAB.viewer)return markMenu(e,m);
  const R=$('#ruler').getBoundingClientRect(),b=Math.max(0,snapB((e.clientX-R.left+$('#lanesWrap').scrollLeft)/PPB,1)),bm=snapB(b,P.sig);
  menu(e,['Timeline',['📌 Ajouter une note ici ('+fmtBar(b)+')',()=>askComment(b)],!COLLAB.viewer&&['🏷 Ajouter un marqueur ici ('+fmtBar(bm)+')',()=>markAdd(bm)],
    COLLAB.on&&['💬 Ouvrir le chat',()=>openPanel('chat')],['📋 Voir toutes les notes et marqueurs',()=>openPanel('cmts')]].filter(Boolean))},true);

// ---------- ⧉ fenêtres détachables (2ᵉ écran) ----------
const DET={w:{},unloading:false},_qs=Document.prototype.querySelector,_qsa=Document.prototype.querySelectorAll,_gid=Document.prototype.getElementById;
const popDocs=()=>{const out=[];for(const k in DET.w){const d=DET.w[k];try{if(d.win&&!d.win.closed)out.push(d.win.document)}catch(e){}}return out};
// les fonctions existantes cherchent leurs éléments dans « document » : on cherche aussi dans les fenêtres détachées
document.querySelector=function(s){const r=_qs.call(this,s);if(r)return r;for(const d of popDocs()){const x=_qs.call(d,s);if(x)return x}return null};
document.querySelectorAll=function(s){const a=Array.from(_qsa.call(this,s));for(const d of popDocs())a.push(..._qsa.call(d,s));return a};
document.getElementById=function(i){const r=_gid.call(this,i);if(r)return r;for(const d of popDocs()){const x=_gid.call(d,i);if(x)return x}return null};
const isDetached=k=>{const d=DET.w[k];return!!(d&&d.win&&!d.win.closed)};
function panelHost(){return isDetached('chat')?DET.w.chat.win.document.body:document.body}
const LAY=()=>{try{return JSON.parse(localStorage.getItem('studio_layout')||'{}')}catch(e){return{}}};
function laySet(k,o){const l=LAY();l[k]=Object.assign(l[k]||{},o);try{localStorage.setItem('studio_layout',JSON.stringify(l))}catch(e){}}
function laySave(kind){const d=DET.w[kind];if(!d)return;try{const w=d.win;if(w.closed)return;laySet(d.lk,{x:w.screenX,y:w.screenY,w:w.outerWidth,h:w.outerHeight})}catch(e){}}
const DET_TITLES={chat:'Chat · notes',bottom:'Mixeur · Piano Roll · Batterie',plug:'Effet'};
function detachOpen(kind,el){
  if(IS_TOUCH||isSmall())return toast('Les fenêtres détachables sont disponibles sur ordinateur');
  if(isDetached(kind)){DET.w[kind].win.focus();return}
  const lk=kind.startsWith('plug:')?'plug':kind,L=LAY()[lk]||{},def={chat:[400,720],bottom:[1180,460],plug:[620,520]}[lk];
  const W=L.w||def[0],H=L.h||def[1],X=L.x!=null?L.x:screenX+80,Y=L.y!=null?L.y:screenY+80;
  const win=window.open('','studio_'+kind.replace(/\W/g,'_'),'popup=yes,width='+W+',height='+H+',left='+X+',top='+Y);
  if(!win)return toast('Le navigateur a bloqué la fenêtre : autorisez les fenêtres pop-up pour ce site, puis réessayez.',6000);
  const title=kind.startsWith('plug:')?((el&&el.querySelector('.pt b')||{}).textContent||'Effet'):DET_TITLES[kind];
  const d=win.document;d.open();d.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>'+title.replace(/</g,'')+' — Studio</title></head><body class="detached det-'+lk+'"></body></html>');d.close();
  for(const st of _qsa.call(document,'style'))d.head.append(st.cloneNode(true));
  const ic=d.createElement('link');ic.rel='icon';ic.href=new URL('icon-192.png',location.href).href;d.head.append(ic);
  if(kind==='chat'){if(!C2.open)openPanel();el=_gid.call(document,'cpanel')}
  else if(kind==='bottom'){if(!TAB){TAB='mixer'}_gid.call(document,'bottom').classList.add('open');el=_gid.call(document,'bottom')}
  if(!el){win.close();return}
  // les boutons écrits avec onclick="…" dans le HTML s'exécuteraient dans la nouvelle fenêtre : on les rattache à la fenêtre principale
  for(const x of [el,..._qsa.call(el.ownerDocument,'[onclick]')].filter(x=>x.getAttribute&&x.getAttribute('onclick')&&el.contains(x))){const code=x.getAttribute('onclick');x.removeAttribute('onclick');const fn=new Function('event',code);x.addEventListener('click',ev=>fn.call(x,ev))}
  const home={parent:el.parentNode,next:el.nextSibling};d.body.append(el);DET.w[kind]={win,el,home,lk};
  win.addEventListener('keydown',e=>{if(e.target&&e.target.closest&&e.target.closest('#cpanel'))return;onKey(e)});win.addEventListener('keyup',onKeyUp);
  win.addEventListener('pointerdown',()=>{try{ctx.resume()}catch(e){}},true);
  win.addEventListener('pagehide',()=>{laySave(kind);setTimeout(()=>detachReturn(kind),0)});win.addEventListener('resize',()=>laySave(kind));
  laySet(lk==='plug'?'plugx':lk,{open:lk==='plug'?0:1});document.body.classList.add('det-'+lk);
  if(kind==='chat'){C2.open=true;drawPanel();layoutPanel()}else if(kind==='bottom'){renderBottom();updDetBtn()}else el.style.left=el.style.top='';
  try{drawRuler();schedulePaint()}catch(e){}toast('⧉ Fenêtre détachée : déplacez-la sur votre 2ᵉ écran. Fermez-la pour la remettre ici.',4500)}
function detachReturn(kind){const d=DET.w[kind];if(!d)return;delete DET.w[kind];const el=d.el;
  if(!DET.unloading)laySet(d.lk,{open:0});document.body.classList.toggle('det-'+d.lk,Object.values(DET.w).some(x=>x.lk===d.lk));
  if(kind==='chat'){el.remove();if(C2.open)drawPanel();layoutPanel()}
  else if(kind==='bottom'){try{d.home.parent.insertBefore(el,d.home.next&&d.home.next.parentNode===d.home.parent?d.home.next:null)}catch(e){_gid.call(document,'app').append(el)}renderBottom();updDetBtn()}
  else{el.remove();for(const k in WINS)if(WINS[k].el===el)delete WINS[k]}
  try{drawRuler();schedulePaint()}catch(e){}}
function detachClose(kind){const d=DET.w[kind];if(!d)return;laySave(kind);try{d.win.close()}catch(e){}detachReturn(kind)}
function updDetBtn(){const b=$('#bDetBottom');if(b){const on=isDetached('bottom');b.textContent=on?'⤓':'⧉';b.title=on?'Remettre le panneau dans la fenêtre principale':'Détacher le panneau (mixeur, piano roll, batterie) dans une fenêtre : 2ᵉ écran'}}
setInterval(()=>{for(const k in DET.w){const d=DET.w[k];let gone=false;try{gone=d.win.closed||!d.el.isConnected||d.el.ownerDocument!==d.win.document}catch(e){gone=true}
  if(gone){if(!d.win.closed)try{d.win.close()}catch(e){}detachReturn(k)}else laySave(k)}},1500);
addEventListener('pagehide',()=>{DET.unloading=true;for(const k in DET.w)try{DET.w[k].win.close()}catch(e){}});
// panneau du bas détaché : il reste ouvert, les onglets changent juste de contenu
{const o=setTab;setTab=function(tab){if(isDetached('bottom')){if(tab===TAB&&tab)return detachClose('bottom');TAB=tab;$('#bottom').classList.add('open');renderBottom();return}return o.apply(this,arguments)}}
// fenêtres d'effets : bouton ⧉ dans la barre de titre
{const o=makeWin;makeWin=function(key,title){const w=o.apply(this,arguments);try{const el=WINS[key]&&WINS[key].el,pt=el&&el.querySelector('.pt');
    if(pt&&!IS_TOUCH&&!isSmall()&&!pt.querySelector('.detb')){const b=h('button',{class:'detb',title:'Détacher dans une fenêtre (2ᵉ écran)',onclick:()=>isDetached('plug:'+key)?detachClose('plug:'+key):detachOpen('plug:'+key,el)},'⧉');pt.insertBefore(b,pt.lastChild)}}catch(e){}return w}}
// menus ouverts depuis une fenêtre détachée : ils s'affichent dans cette fenêtre
{const o=menu;menu=function(e,items){o(e,items);const doc=e&&e.target&&e.target.ownerDocument;if(!doc||doc===document)return;const m=_gid.call(document,'menu');if(!m)return;
  doc.body.append(m);const w=doc.defaultView,r=m.getBoundingClientRect();m.style.left=Math.min(e.clientX,w.innerWidth-r.width-6)+'px';m.style.top=Math.min(e.clientY,w.innerHeight-r.height-6)+'px';
  setTimeout(()=>doc.addEventListener('pointerdown',closeMenuOut,true),0)}}
// disposition mémorisée : proposer de rouvrir les fenêtres qui étaient détachées (un clic = autorisé par le navigateur)
function restoreBanner(){if(IS_TOUCH||isSmall())return;const l=LAY(),ks=['chat','bottom'].filter(k=>l[k]&&l[k].open);if(!ks.length)return;
  const b=h('div',{id:'detBanner'},h('span',null,'⧉ Rouvrir vos fenêtres détachées :'),ks.map(k=>h('button',{onclick:e=>{e.target.remove();detachOpen(k);if(!b.querySelector('button.k'))b.remove()},class:'k'},k==='chat'?'💬 Chat':'🎚 Mixeur')),
    window.getScreenDetails&&h('button',{title:'Permet de rouvrir les fenêtres directement sur le 2ᵉ écran',onclick:async()=>{try{await window.getScreenDetails();toast('2ᵉ écran autorisé ✔')}catch(e){toast('Autorisation refusée')}}},'🖥 Autoriser le 2ᵉ écran'),
    h('button',{title:'Ne plus proposer',onclick:()=>{ks.forEach(k=>laySet(k,{open:0}));b.remove()}},'✕'));
  document.body.append(b);setTimeout(()=>{if(b.isConnected)b.remove()},30000)}
