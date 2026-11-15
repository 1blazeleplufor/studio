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
      h('li',null,'Puis ferme Studio complètement (balaye-le vers le haut) et rouvre-le.')),h('button',{onclick:e=>{e.target.closest('.modal').remove();micTest()}},'🩺 Lancer le test du micro')])}}
{const o=Engine.prototype.startRec;Engine.prototype.startRec=function(){this.recT=Date.now();return o.apply(this,arguments)}}
{const o=stopRecord;stopRecord=function(){const had=E.recChunks&&E.recChunks.length,st=ctx.state,long=Date.now()-(E.recT||0)>2500;const r=o.apply(this,arguments);
  if(!had&&long)modal([h('h2',null,'La prise est vide'),h('p',null,'Aucun son n’est arrivé du micro'+(st!=='running'?' (le son de l’appli était en pause).':'.')),
    h('ul',null,h('li',null,'Touche une fois ▶ (lecture) puis relance l’enregistrement : sur iPhone, le son ne démarre qu’après un toucher.'),
      IOS&&h('li',null,'Vérifie l’autorisation du micro : Réglages de l’iPhone → Safari → Micro.'),
      h('li',null,'Si tu es en appel ou qu’une autre appli utilise le micro, ferme-la.')),h('button',{onclick:e=>{e.target.closest('.modal').remove();micTest()}},'🩺 Lancer le test du micro')]);
  return r}}
// ---- 🩺 Test du micro : dit à quelle étape ça bloque (pour le dépannage) ----
async function micTest(){
  const lines=[],out=h('pre',{style:{whiteSpace:'pre-wrap',fontSize:'12px',background:'#1c1c1f',padding:'10px',borderRadius:'8px',maxHeight:'50vh',overflow:'auto'}});
  const say=(ok,txt)=>{lines.push((ok===true?'✅ ':ok===false?'❌ ':'• ')+txt);out.textContent=lines.join('\n')};
  const copy=h('button',{onclick:async()=>{try{await navigator.clipboard.writeText('Test micro Studio v'+APP_VERSION+'\n'+lines.join('\n'));toast('Rapport copié ✔')}catch(e){toast('Fais une capture d’écran')}}},'📋 Copier le rapport');
  modal([h('h2',null,'🩺 Test du micro'),h('p',{class:'muted',style:{fontSize:'12px',marginTop:0}},'Parle ou souffle dans le micro pendant le test. Ensuite copie le rapport (ou fais une capture) et envoie-le-moi.'),out,h('div',{style:{display:'flex',justifyContent:'flex-end',marginTop:'8px'}},copy)]);
  const ua=navigator.userAgent,v=(ua.match(/OS (\d+)_(\d+)/)||[]).slice(1).join('.');
  say(null,'Appareil : '+(IOS?'iPhone/iPad iOS '+(v||'?'):navigator.platform)+(matchMedia('(display-mode: standalone)').matches||navigator.standalone?' — appli installée':' — dans le navigateur'));
  say(null,'Moteur audio : '+ctx.state+', '+ctx.sampleRate+' Hz');
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){say(false,'Ce navigateur ne donne pas accès au micro (page non sécurisée ?)');return}
  let st;try{st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});say(true,'Micro autorisé')}
  catch(e){say(false,'Micro refusé : '+e.name+' — '+e.message);return}
  const tr=st.getAudioTracks()[0],s=tr.getSettings?tr.getSettings():{};say(null,'Micro : '+(tr.label||'?')+' — '+(s.sampleRate||'?')+' Hz, état '+tr.readyState+(tr.muted?' (coupé par le système !)':''));
  try{await ctx.resume()}catch(e){}say(ctx.state==='running',' Moteur audio après relance : '+ctx.state);
  let src;try{src=ctx.createMediaStreamSource(st)}catch(e){say(false,'Brancher le micro au moteur : '+e.name+' — '+e.message);st.getTracks().forEach(t=>t.stop());return}
  const an=ctx.createAnalyser();an.fftSize=2048;src.connect(an);let wk=null,wpk=0;
  try{wk=new AudioWorkletNode(ctx,'rec-proc',{numberOfOutputs:1,outputChannelCount:[1]});const z=ctx.createGain();z.gain.value=0;src.connect(wk);wk.connect(z);z.connect(ctx.destination);
    wk.port.onmessage=e=>{if(e.data.peak!==undefined)wpk=Math.max(wpk,e.data.peak)};say(true,'Module d’enregistrement chargé')}
  catch(e){say(false,'Module d’enregistrement : '+e.name+' — '+e.message)}
  say(null,'Écoute pendant 4 secondes… parle !');const d=new Float32Array(2048);let pk=0,t0=performance.now(),last=ctx.currentTime;
  while(performance.now()-t0<4000){await new Promise(r=>setTimeout(r,100));an.getFloatTimeDomainData(d);for(const x of d)pk=Math.max(pk,Math.abs(x))}
  const db=x=>x>0?Math.round(20*Math.log10(x))+' dB':'silence';
  say(ctx.currentTime>last,'Horloge audio : '+(ctx.currentTime>last?'avance':'bloquée ('+ctx.state+')'));
  say(pk>.001,'Son reçu du micro : '+db(pk));if(wk)say(wpk>.001,'Son reçu par l’enregistrement : '+db(wpk));
  say(null,pk>.001&&(!wk||wpk>.001)?'→ Le micro marche. Si l’enregistrement bloque encore, dis-moi à quel moment.':'→ Envoie-moi ce rapport.');
  try{src.disconnect();wk&&wk.disconnect()}catch(e){}st.getTracks().forEach(t=>t.stop());
  if(E.micStream){E.mic=null;E.micDev=undefined}}
{const o=settingsModal;settingsModal=async function(){const r=await o.apply(this,arguments);const ms=document.querySelectorAll('.modal .box'),b=ms[ms.length-1];
  if(b)b.prepend(h('div',{style:{display:'flex',justifyContent:'flex-end'}},h('button',{onclick:()=>{b.closest('.modal').remove();micTest()}},'🩺 Test du micro')));return r}}
