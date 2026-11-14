// ===== v3.9 — Retour casque sans décalage (comme le « Low Latency Mode » de Logic) =====
// Le retour du micro passe par un 2e moteur audio réglé en « faible latence », séparé du moteur principal
// (qui garde le mode audio choisi par l'utilisateur, ex. « Stable »). Les effets qui retardent le son
// (Pitch Pro, autotune, pitch shifter, plugins de l'ordinateur) sont sautés DANS LE CASQUE seulement.
// Rien ne change dans les prises enregistrées (le micro brut est enregistré comme avant), ni dans la compensation de latence.
const MON={ctx:null,ready:null,src:null,srcStream:null,bus:null,tr:{},aux:{}};
const MON_SLOW=new Set(['tunepro','pitch','shifter','bridge']);
function monMode(){try{return localStorage.getItem('studio_mon')||'direct'}catch(e){return'direct'}}
function monIsSlow(type){const d=PLUGINS[type];return MON_SLOW.has(type)||!!(d&&d.latency)}
async function monCtx(){
  if(MON.ready)return MON.ready;
  MON.ready=(async()=>{const c=new AudioContext({latencyHint:'interactive'});
    try{await Engine.prototype.init.call({ctx:c})}catch(e){console.warn('worklets retour',e)}
    MON.ctx=c;MON.bus=c.createGain();MON.bus.connect(c.destination);return c})();
  return MON.ready;
}
function monSource(){const c=MON.ctx;if(!c||!E.micStream)return null;
  if(MON.src&&MON.srcStream===E.micStream)return MON.src;
  if(MON.src)try{MON.src.disconnect()}catch(e){}
  MON.src=c.createMediaStreamSource(E.micStream);MON.srcStream=E.micStream;
  for(const id in MON.tr)MON.src.connect(MON.tr[id].inp);return MON.src}
function monSig(obj){return(obj.plugins||[]).map(p=>p.type+(p.byp?'b':'')).join(',')}
function monNewChain(){const c=MON.ctx;const s={inp:c.createGain(),fader:c.createGain(),pan:c.createStereoPanner(),mute:c.createGain(),plugins:[],sig:null,sends:[]};
  s.fader.connect(s.pan);s.pan.connect(s.mute);s.mute.connect(MON.bus);return s}
function monRebuild(s,obj){const c=MON.ctx;try{s.inp.disconnect()}catch(e){}
  for(const p of s.plugins){if(!p)continue;try{p.output.disconnect()}catch(e){}try{p.dispose&&p.dispose()}catch(e){}}
  s.plugins=[];let prev=s.inp;
  for(const pl of obj.plugins||[]){const d=PLUGINS[pl.type];
    if(!d||pl.byp||monIsSlow(pl.type)){s.plugins.push(null);continue}
    let inst;try{inst=d.create(c,pl.params,{bpm:()=>P.bpm});inst.set(pl.params)}catch(e){console.warn('retour',pl.type,e);s.plugins.push(null);continue}
    s.plugins.push(inst);prev.connect(inst.input);prev=inst.output}
  prev.connect(s.fader);s.sig=monSig(obj)}
function monApply(obj,s,isTrack){const t=MON.ctx.currentTime;
  if(monSig(obj)!==s.sig)monRebuild(s,obj);
  else(obj.plugins||[]).forEach((pl,i)=>{const inst=s.plugins[i];if(inst)try{inst.set(pl.params)}catch(e){}});
  s.fader.gain.setTargetAtTime(dbToG(obj.vol),t,.01);s.pan.pan.setTargetAtTime(obj.pan||0,t,.01);
  let audible=!obj.mute;if(isTrack&&P.tracks.some(x=>x.solo))audible=audible&&obj.solo;
  s.mute.gain.setTargetAtTime(audible?1:0,t,.005);
  if(isTrack&&obj.sends)P.auxes.forEach((a,i)=>{const db=obj.sends[i]??-60;let g=s.sends[i];
    if(db<=-60&&!g)return;
    if(!g){g=s.sends[i]=MON.ctx.createGain();s.mute.connect(g);g.connect(monAux(a).inp)}
    g.gain.setTargetAtTime(db<=-60?0:dbToG(db),t,.01)});
}
function monAux(a){let s=MON.aux[a.id];if(!s){s=MON.aux[a.id]=monNewChain();monApply(a,s,false)}return s}
function monMaster(){if(MON.bus&&P&&P.master)MON.bus.gain.setTargetAtTime(dbToG(P.master.vol||0),MON.ctx.currentTime,.01)}
async function monOn(tr){await monCtx();try{await MON.ctx.resume()}catch(e){}
  if(MON.tr[tr.id])return;const s=monNewChain();MON.tr[tr.id]=s;monApply(tr,s,true);monMaster();
  const src=monSource();if(src)src.connect(s.inp)}
function monOff(id){const s=MON.tr[id];if(!s)return;delete MON.tr[id];
  try{MON.src&&MON.src.disconnect(s.inp)}catch(e){}try{s.mute.disconnect()}catch(e){}
  for(const p of s.plugins)if(p)try{p.dispose&&p.dispose()}catch(e){}
  for(const g of s.sends)if(g)try{g.disconnect()}catch(e){}}
function monDelayMs(){const c=MON.ctx;if(!c)return null;return Math.round(((c.baseLatency||0)+(c.outputLatency||0)+(E.inLatency||0))*1000)}
function mainDelayMs(tr){const c=E.ctx,s=tr&&E.strips[tr.id];return Math.round(((c.baseLatency||0)+(c.outputLatency||0)+(E.inLatency||0)+(s&&s.latency||0))*1000)}

// --- branchement sur le moteur ---
{const o=Engine.prototype.setMonitor;Engine.prototype.setMonitor=function(tr,on){
  if(this!==E)return o.apply(this,arguments);
  if(!on){monOff(tr.id);return o.call(this,tr,false)}
  if(monMode()==='full'){monOff(tr.id);return o.call(this,tr,true)}
  o.call(this,tr,false);monOn(tr)}}
{const o=Engine.prototype.updateStrip;Engine.prototype.updateStrip=function(obj,s){const r=o.apply(this,arguments);
  if(this===E&&MON.ctx&&obj){try{if(MON.tr[obj.id])monApply(obj,MON.tr[obj.id],true);else if(MON.aux[obj.id])monApply(obj,MON.aux[obj.id],false);else if(obj===P.master)monMaster()}catch(e){console.warn(e)}}
  return r}}
{const o=Engine.prototype.openMic;Engine.prototype.openMic=async function(){const r=await o.apply(this,arguments);if(this===E&&MON.ctx)monSource();return r}}
{const o=Engine.prototype.build;Engine.prototype.build=function(project){const r=o.apply(this,arguments);
  if(this===E&&MON.ctx){for(const id in MON.tr)if(!project.tracks.some(t=>t.id===id&&t.mon))monOff(id);
    for(const id in MON.aux)if(!project.auxes.some(a=>a.id===id)){try{MON.aux[id].mute.disconnect()}catch(e){}delete MON.aux[id]}}
  return r}}
// remet le retour des pistes déjà écoutées dans le nouveau mode
function monSetMode(m){try{localStorage.setItem('studio_mon',m)}catch(e){}
  for(const t of P.tracks)if(t.mon){E.setMonitor(t,false);E.setMonitor(t,true)}}

// message au moment d'activer le retour
{const o=toggleMon;toggleMon=async function(t){const r=await o.apply(this,arguments);
  if(t.mon&&monMode()==='direct'){setTimeout(()=>{const s=MON.tr[t.id];if(!s)return;
    const sk=(t.plugins||[]).filter(p=>!p.byp&&monIsSlow(p.type)).map(p=>(PLUGINS[p.type]||{}).name||p.type);
    const d=monDelayMs();toast('🎧 Retour sans décalage'+(d?' (≈ '+d+' ms)':'')+(sk.length?' — dans le casque seulement, sans : '+sk.join(', '):''),4500)},400)}
  return r}}

// --- ligne dans ⚙ Réglages ---
function monRow(){const info=h('div',{class:'muted',style:'font-size:12px;line-height:1.45;margin-top:4px'});
  const upd=()=>{const tr=P.tracks.find(t=>t.mon)||P.tracks.find(t=>t.arm)||P.tracks.find(t=>t.id===SEL);
    const a=monDelayMs(),b=mainDelayMs(tr);
    info.innerHTML=(monMode()==='direct'
      ?'Ta voix revient dans le casque par un circuit rapide. Les effets qui retardent (Pitch Pro, autotune, pitch shifter) sont coupés <b>dans le casque seulement</b> : ils restent sur ta piste et dans l’export.'
      :'Ta voix revient avec tous ses effets, mais avec un léger retard.')
     +'<br>Retard du retour : '+(monMode()==='direct'?(a!=null?'≈ '+a+' ms':'mesuré quand tu actives le I'):'≈ '+b+' ms')
     +' (+ celui du casque s’il est sans fil).'
     +'<br>💡 Zéro décalage : active le <b>retour micro du casque</b> (« sidetone » dans SteelSeries GG / Sonar) et laisse le I éteint ici.'};
  const sel=h('select',{onchange:e=>{monSetMode(e.target.value);setTimeout(upd,500)}},
    [['direct','Sans décalage (conseillé)'],['full','Avec tous les effets (léger décalage)']].map(([v,n])=>h('option',{value:v,selected:monMode()===v},n)));
  upd();return h('div',{},h('div',{class:'kv2'},'Retour casque (I)',sel),info)}
{const o=settingsModal;settingsModal=async function(){const r=await o.apply(this,arguments);const ms=document.querySelectorAll('.modal .box'),b=ms[ms.length-1];if(!b)return r;
  const rows=[...b.querySelectorAll('.kv2')],ref=rows.find(x=>/Mode audio/.test(x.textContent));const row=monRow();
  if(ref){const n=ref.nextElementSibling;(n&&!n.classList.contains('kv2')?n:ref).after(row)}else b.append(row);return r}}
