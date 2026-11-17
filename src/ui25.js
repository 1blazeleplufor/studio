// ===== v3.14 : chat — emojis et GIF =====
// Un GIF est un message dont le texte est seulement l'adresse de l'image (hébergeurs connus ou stockage de la session) :
// rien ne change dans le format du chat, les auditeurs peuvent en envoyer aussi, les anciennes versions voient un lien.
const EMOJIS=[['😀','😀😁😂🤣😅😊😍🥰😘😎🤩🥳😏😇🤔🤨😐😴🥱😮😱😭😢😤😡🤬🤯🥶🥵🤮🤡💀👻👽🤖😈'],
 ['👍','👍👎👌🤌🤏✌️🤞🤟🤘🤙👊✊👏🙌🙏💪🫶🤝👋🫡👀🧠🗣️'],
 ['❤️','❤️🧡💛💚💙💜🖤🤍💔💯🔥✨⭐🌟💥💫⚡💎🏆🥇🎉🎊🚀💸💰✅❌⚠️❓❗'],
 ['🎵','🎵🎶🎤🎧🎙️🎚️🎛️🎹🥁🎸🎺🎷🎻📀💿📻🔊🔉🔇🎼👑🐐🧊🌊🌙☀️🌈'],
 ['🍕','🍕🍔🍟🌮🍜🍩🍪☕🥤🍺🥂🍾🐶🐱🦁🐍🦅🚗✈️🏠⏰📱💻⌛']];
const GIF_HOSTS=/^https:\/\/((media\d*|i)\.giphy\.com|media\d*\.tenor\.com|c\.tenor\.com|static\.klipy\.com|i\.imgur\.com)\/[^\s"'<>]+$/i;
function gifURL(x){x=String(x||'').trim();if(!x||/\s/.test(x)||x.length>400)return null;
  if(SUPA.url&&x.startsWith(SUPA.url+'/storage/v1/object/public/sons/vocaux/')&&/^[a-z0-9]{12}\.(gif|webp|png|jpg)$/.test(x.slice(x.lastIndexOf('/')+1)))return x;
  if(!/^https:\/\//i.test(x))return null;
  const pg=x.match(/^https:\/\/(?:www\.)?giphy\.com\/(?:gifs|stickers|clips)\/(?:[^\/?#]*-)?([A-Za-z0-9]{8,})(?:[\/?#].*)?$/);if(pg)return'https://media.giphy.com/media/'+pg[1]+'/giphy.gif';
  if(SUPA.url&&x.startsWith(SUPA.url+'/storage/v1/object/public/sons/vocaux/')&&/^[a-z0-9]{12}\.(gif|webp|png|jpg)$/.test(x.slice(x.lastIndexOf('/')+1)))return x;
  return GIF_HOSTS.test(x)?x:null}
const EMO_ONLY=/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;
function chatContent(x){const g=gifURL(x);
  if(g){const im=h('img',{class:'cgif',src:g,alt:'GIF',loading:'lazy',referrerpolicy:'no-referrer',onclick:()=>window.open(g,'_blank','noopener'),
      onload:()=>{const b=im.closest('.cbody');if(b&&b.scrollHeight-b.scrollTop-b.clientHeight<im.height+80)b.scrollTop=b.scrollHeight}});
    im.addEventListener('error',()=>{im.replaceWith(h('a',{href:g,target:'_blank',rel:'noopener'},'🖼 image (ouvrir)'))});return h('div',{class:'ctxt cgifw'},im)}
  const big=x&&x.length<=24&&EMO_ONLY.test(x)&&!/^[\d\s#*]+$/.test(x);return h('div',{class:'ctxt'+(big?' cbig':'')},x)}
function chatInsert(txt){const i=C2.inpEl&&C2.inpEl.isConnected?C2.inpEl:$('#cpanel .cin input');if(!i)return;const a=i.selectionStart??i.value.length,b=i.selectionEnd??a;
  i.value=(i.value.slice(0,a)+txt+i.value.slice(b)).slice(0,1000);const p=a+txt.length;if(!IS_TOUCH){i.focus();try{i.setSelectionRange(p,p)}catch(e){}}}
function emojiRecent(add){let r=[];try{r=JSON.parse(localStorage.getItem('studio_emo')||'[]')}catch(e){}if(add){r=[add,...r.filter(x=>x!==add)].slice(0,16);try{localStorage.setItem('studio_emo',JSON.stringify(r))}catch(e){}}return r}
const emoSplit=s=>typeof Intl!=='undefined'&&Intl.Segmenter?[...new Intl.Segmenter().segment(s)].map(x=>x.segment):[...s];
function chatPicker(){ // tiroir au-dessus de la zone de saisie : C2.pick = 'emo' | 'gif' | null
  if(C2.pick==='emo'){const cat=C2.emoCat||0,grid=h('div',{class:'cpgrid'}),rec=emojiRecent();
    const tabs=h('div',{class:'cptabs'},EMOJIS.map(([ic],k)=>h('button',{class:k===cat?'on':'',onclick:()=>{C2.emoCat=k;drawPanel()}},ic)),h('span',{style:{flex:1}}),h('button',{title:'Fermer',onclick:()=>{C2.pick=null;drawPanel()}},'✕'));
    const add=e=>h('button',{onclick:()=>{chatInsert(e);emojiRecent(e)}},e);
    if(rec.length&&cat===0)grid.append(...rec.map(add),h('i'));grid.append(...emoSplit(EMOJIS[cat][1]).map(add));return h('div',{class:'cpick'},tabs,grid)}
  if(C2.pick==='gif'){const st=h('div',{class:'dim cpst'},'GIF, WebP, PNG ou JPG · 8 Mo max');
    const sendURL=v=>{const g=gifURL(v);if(!g){st.textContent='Lien non reconnu : colle un lien GIPHY, Tenor ou Imgur (clic droit sur le GIF → Copier l’adresse de l’image).';st.style.color='#ff9f0a';return}C2.pick=null;chatSend(g)};
    const fi=h('input',{type:'file',accept:'image/gif,image/webp,image/png,image/jpeg',hidden:true,onchange:e=>{const f=e.target.files[0];e.target.value='';if(f)gifUpload(f,st)}});
    const li=h('input',{type:'text',placeholder:'Colle ici le lien d’un GIF…',onkeydown:e=>{e.stopPropagation();if(e.key==='Enter')sendURL(li.value)},onpaste:()=>setTimeout(()=>{if(gifURL(li.value))sendURL(li.value)},0)});
    return h('div',{class:'cpick'},h('div',{class:'cptabs'},h('b',null,'GIF'),h('span',{style:{flex:1}}),h('button',{title:'Fermer',onclick:()=>{C2.pick=null;drawPanel()}},'✕')),
      fi,h('div',{class:'cpgif'},h('button',{onclick:()=>fi.click()},'📁 Depuis mon appareil'),h('a',{class:'btnlike',href:'https://giphy.com/',target:'_blank',rel:'noopener'},'🔍 Chercher sur GIPHY ↗')),
      h('div',{class:'cplink'},li,h('button',{onclick:()=>sendURL(li.value)},'➤')),st)}
  return null}
async function gifUpload(f,st){const ext={'image/gif':'gif','image/webp':'webp','image/png':'png','image/jpeg':'jpg'}[f.type];const say=(m,bad)=>{if(st&&st.isConnected){st.textContent=m;st.style.color=bad?'#ff9f0a':''}else toast(m)};
  if(!ext)return say('Ce fichier n’est pas une image (GIF, WebP, PNG, JPG).',1);if(f.size>8*1048576)return say('Image trop lourde ('+(f.size/1048576).toFixed(1)+' Mo) : 8 Mo max.',1);
  if(!COLLAB.synced)return say('Connexion à la session en cours…',1);
  const id=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('');
  try{say('Envoi 0 %');await xhrUpload(SUPA.url+'/storage/v1/object/sons/vocaux/'+id+'.'+ext,f,f.type,p=>say('Envoi '+Math.round(p*100)+' %'));
    C2.pick=null;chatSend(SUPA.url+'/storage/v1/object/public/sons/vocaux/'+id+'.'+ext)}
  catch(e){console.error(e);say('Envoi impossible : '+e.message,1)}}
// coller une image (capture, GIF copié) directement dans le champ du chat
document.addEventListener('paste',e=>{if(!e.target.closest||!e.target.closest('#cpanel .cin'))return;const it=[...(e.clipboardData&&e.clipboardData.files||[])].find(f=>/^image\//.test(f.type));if(it){e.preventDefault();toast('Envoi de l’image…');gifUpload(it,null)}},true);
// téléphone : bouton 💬 dans la barre du haut pendant une session (avec le nombre de messages non lus)
setInterval(()=>{const top=document.querySelector('#mob .mtop');if(!top)return;let b=top.querySelector('.mchat');
  if(!COLLAB.on){if(b)b.remove();return}
  if(!b){b=h('button',{class:'mic mchat',title:'Chat de la session',onclick:()=>C2.open?closePanel():openPanel('chat')},'💬');const u=[...top.querySelectorAll('button')].find(x=>x.textContent==='↶');u?u.before(b):top.append(b)}
  const n=C2.unread>99?'99+':C2.unread||'';if(b.dataset.n!==String(n))b.dataset.n=n;b.classList.toggle('has',!!n)},700);
