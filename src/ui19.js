// ===== v3.10.1 — Enregistrer sur iPhone / iPad =====
// Sur iPhone, tous les navigateurs (Safari, Chrome…) utilisent le même moteur (WebKit). Corrections :
// 1) le son ne démarre qu'après un « vrai » toucher (touchend / click), pas sur pointerdown → on débloque aussi là ;
//    et iOS met l'audio en pause (« interrupted ») quand le micro s'ouvre ou après un appel → on relance.
// 2) un micro choisi sur un autre appareil (ex. le casque du PC, dans un projet importé) n'existe pas sur le téléphone → micro par défaut.
// 3) le retour casque « sans décalage » (2e moteur audio) est désactivé par défaut sur iPhone, où il peut couper le micro.
// 4) si une prise revient vide, on explique quoi faire au lieu de ne rien dire.
const IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
function audioUnlock(){try{if(ctx&&ctx.state!=='running')ctx.resume()}catch(e){}try{if(MON.ctx&&MON.ctx.state!=='running')MON.ctx.resume()}catch(e){}}
for(const ev of ['touchend','click','keydown'])document.addEventListener(ev,audioUnlock,true);
try{ctx.addEventListener('statechange',()=>{if(ctx.state==='interrupted'||ctx.state==='suspended'&&(REC||E.playing))ctx.resume().catch(()=>{})})}catch(e){}
if(IOS){const o=monMode;monMode=function(){try{return localStorage.getItem('studio_mon')||'full'}catch(e){return'full'}}}
{const o=Engine.prototype.openMic;Engine.prototype.openMic=async function(dev){
  try{const r=await o.apply(this,arguments);if(this.ctx.state!=='running')try{await this.ctx.resume()}catch(e){}return r}
  catch(e){if(dev&&/Overconstrained|NotFound|NotReadable/.test(e.name||'')){
      if(this===E&&P&&P.settings)P.settings.inputDev='';
      const r=await o.call(this,'');toast('🎤 Le micro choisi n’existe pas sur cet appareil : micro par défaut utilisé.',4000);return r}
    throw e}}}
{const o=micError;micError=function(e){if(!IOS)return o.apply(this,arguments);console.error(e);
  modal([h('h2',null,'Micro inaccessible'),h('p',null,'L’iPhone n’a pas pu ouvrir le micro ('+(e&&(e.name||e.message))+').'),
    h('ul',null,
      h('li',null,'Dans Safari : touche « ᴀA » à gauche de l’adresse → Réglages du site web → Micro → Autoriser.'),
      h('li',null,'Dans l’appli installée (écran d’accueil) : Réglages de l’iPhone → Safari → Micro → Demander ou Autoriser.'),
      h('li',null,'Raccroche les appels en cours et ferme les autres applis qui utilisent le micro (WhatsApp, Discord, dictée…).'),
      h('li',null,'Puis ferme Studio complètement (balaye-le vers le haut) et rouvre-le.'))])}}
{const o=Engine.prototype.startRec;Engine.prototype.startRec=function(){this.recT=Date.now();return o.apply(this,arguments)}}
{const o=stopRecord;stopRecord=function(){const had=E.recChunks&&E.recChunks.length,st=ctx.state,long=Date.now()-(E.recT||0)>2500;const r=o.apply(this,arguments);
  if(!had&&long)modal([h('h2',null,'La prise est vide'),h('p',null,'Aucun son n’est arrivé du micro'+(st!=='running'?' (le son de l’appli était en pause).':'.')),
    h('ul',null,h('li',null,'Touche une fois ▶ (lecture) puis relance l’enregistrement : sur iPhone, le son ne démarre qu’après un toucher.'),
      IOS&&h('li',null,'Vérifie l’autorisation du micro : Réglages de l’iPhone → Safari → Micro.'),
      h('li',null,'Si tu es en appel ou qu’une autre appli utilise le micro, ferme-la.'))]);
  return r}}
