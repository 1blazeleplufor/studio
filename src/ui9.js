// ===== v3.5 : Bibliothèque de plugins + Studio Bridge (plugins AU/VST3 de l'ordinateur) =====
const BRIDGE={ws:null,connected:false,ok:false,err:'',os:'',plugins:[],scanning:false,progress:'',insts:{},num:1,lat:4096,wanted:false,retry:null,listeners:new Set(),version:''};
try{BRIDGE.lat=+localStorage.getItem('studio_bridge_lat')||4096}catch(e){}
const BRIDGE_URL='ws://127.0.0.1:47123/ws',REPO_ZIP='https://github.com/1blazeleplufor/studio/archive/refs/heads/main.zip';
function bridgeEmit(){for(const f of BRIDGE.listeners)try{f()}catch(e){}const b=$('#bLib');if(b){b.classList.toggle('on',!!$('#library')&&$('#library').style.display!=='none');b.title='Bibliothèque de plugins (Y)'+(BRIDGE.connected?' — Studio Bridge connecté':'');const d=b.querySelector('i');if(d)d.style.background=BRIDGE.connected?'#30d158':'transparent'}}
function bridgeRetry(){clearTimeout(BRIDGE.retry);if(BRIDGE.wanted)BRIDGE.retry=setTimeout(bridgeConnect,4000)}
function bridgeSend(o){if(BRIDGE.ws&&BRIDGE.ws.readyState===1)BRIDGE.ws.send(JSON.stringify(o))}
function bridgeConnect(){
  if(BRIDGE.ws&&BRIDGE.ws.readyState<=1)return;let ws;try{ws=new WebSocket(BRIDGE_URL)}catch(e){return bridgeRetry()}
  BRIDGE.ws=ws;ws.binaryType='arraybuffer';
  ws.onopen=()=>{BRIDGE.connected=true;bridgeSend({t:'hello'});for(const k in BRIDGE.insts)bridgeLoad(BRIDGE.insts[k]);bridgeEmit()};
  ws.onclose=()=>{BRIDGE.connected=false;BRIDGE.ws=null;for(const k in BRIDGE.insts){const i=BRIDGE.insts[k];i.loaded=false;i.node.port.postMessage({online:false})}bridgeEmit();bridgeRetry()};
  ws.onerror=()=>{};
  ws.onmessage=e=>{
    if(typeof e.data!=='string'){const hd=new Uint32Array(e.data,0,5),inst=BRIDGE.insts[hd[1]];if(inst){const out=new Float32Array(e.data,20,hd[3]*hd[4]).slice();inst.node.port.postMessage({out,start:hd[2],frames:hd[3]},[out.buffer])}return}
    let m;try{m=JSON.parse(e.data)}catch(err){return}const inst=m.num!=null?BRIDGE.insts[m.num]:null;
    if(m.t==='hello'){BRIDGE.ok=m.ok;BRIDGE.err=m.err||'';BRIDGE.os=m.os;BRIDGE.version=m.v;BRIDGE.plugins=m.plugins||[];BRIDGE.scanning=m.scanning}
    else if(m.t==='plugins'){BRIDGE.plugins=m.plugins||[];BRIDGE.scanning=false;BRIDGE.progress=''}
    else if(m.t==='scanning'){BRIDGE.scanning=true;BRIDGE.progress=m.progress||''}
    else if(m.t==='loaded'&&inst){inst.loaded=true;inst.err='';inst.instrument=m.instrument;inst.node.port.postMessage({online:true});if(inst.autoEdit){inst.autoEdit=false;bridgeSend({t:'edit',num:inst.num})}}
    else if(m.t==='error'){if(inst){inst.err=m.msg;inst.loaded=false}toast('🔌 '+(inst&&inst.params.name?inst.params.name+' : ':'')+m.msg,6000)}
    else if(m.t==='editor_open'&&inst){inst.editing=true}
    else if((m.t==='editor_closed'||m.t==='state')&&inst){if(m.t==='editor_closed')inst.editing=false;if(m.state&&m.state!==inst.params.state){inst.params.state=m.state;DIRTY=true}}
    bridgeEmit()};
}
setInterval(()=>{for(const k in BRIDGE.insts){const i=BRIDGE.insts[k];if(i.editing&&i.loaded)bridgeSend({t:'getstate',num:i.num})}},8000);
function bridgeLoad(inst){if(!inst.params.pid)return;bridgeSend({t:'load',num:inst.num,pid:inst.params.pid,sr:ctx.sampleRate,state:inst.params.state||null})}
PLUGINS.bridge={name:'Plugin de l’ordinateur',cat:'🔌 Ordinateur',hideInMenu:true,latency:sr=>BRIDGE.lat/sr,
  params:[{id:'pid',hidden:1,def:''},{id:'name',hidden:1,def:''},{id:'fmt',hidden:1,def:''},{id:'vendor',hidden:1,def:''},{id:'state',hidden:1,def:null}],
  create(c,P){P=P||{};
    if(c!==ctx){const d=c.createDelay(2);d.delayTime.value=BRIDGE.lat/c.sampleRate;return{input:d,output:d,set(){}}} // rendu hors ligne : son direct (export temps réel ailleurs)
    const node=new AudioWorkletNode(c,'bridge-proc',{numberOfInputs:1,outputChannelCount:[2],processorOptions:{lat:BRIDGE.lat}}),num=BRIDGE.num++;
    const inst={num,node,params:P,loaded:false,err:'',editing:false,autoEdit:false,under:0};BRIDGE.insts[num]=inst;
    node.port.onmessage=ev=>{const d=ev.data;if(d.under){inst.under+=d.under;return}
      if(d.data&&BRIDGE.ws&&BRIDGE.ws.readyState===1&&inst.loaded){const hb=new ArrayBuffer(20+d.data.byteLength),hd=new Uint32Array(hb,0,5);hd[0]=0x31414253;hd[1]=num;hd[2]=d.start>>>0;hd[3]=d.frames;hd[4]=2;new Float32Array(hb,20).set(d.data);BRIDGE.ws.send(hb)}};
    BRIDGE.wanted=true;if(BRIDGE.connected)bridgeLoad(inst);else bridgeConnect();
    return{input:node,output:node,bridge:inst,set(){},dispose(){bridgeSend({t:'unload',num});delete BRIDGE.insts[num]}}}};
function bridgeInstFor(o,i){const s=E.strips[o.id];return s&&s.plugins[i]&&s.plugins[i].bridge}
function projectUsesBridge(pr){const all=[...pr.tracks.filter(t=>!t.mute),...pr.auxes,pr.master];return all.some(o=>(o.plugins||[]).some(p=>p.type==='bridge'&&!p.byp))}
// ---- export : bounce en temps réel quand des plugins de l'ordinateur sont utilisés ----
const _renderMixOffline=renderMix;
renderMix=async function(project,from,to){
  if(projectUsesBridge(project)){
    if(!BRIDGE.connected){if(!confirm('Ce projet utilise des plugins de l’ordinateur, mais Studio Bridge n’est pas lancé : ils seront ignorés dans l’export. Continuer quand même ?'))throw new Error('Export annulé');return _renderMixOffline(project,from,to)}
    return realtimeBounce(project,from,to)}
  return _renderMixOffline(project,from,to)};
async function realtimeBounce(project,a,b){
  const sp=60/P.bpm,dur=(b-a)*sp+2.5,sr=ctx.sampleRate;let cancel=false;
  const bar=h('div',{style:{height:'8px',background:'#111',borderRadius:'4px',overflow:'hidden',margin:'10px 0'}},h('div',{style:{height:'100%',width:'0%',background:'#30d158'}}));
  const m=modal([h('h2',null,'⏺ Bounce en temps réel'),h('p',null,'Ce projet utilise des plugins de l’ordinateur : l’export se fait en lisant le morceau en temps réel ('+Math.ceil(dur)+' s). Vous allez l’entendre, c’est normal.'),bar,h('button',{onclick:()=>{cancel=true}},'Annuler')]);
  const saved=P.tracks.map(t=>[t,t.mute,t.solo]);for(const t of P.tracks){const x=project.tracks.find(y=>y.id===t.id);if(x){t.mute=x.mute;t.solo=x.solo}}E.updateAll();
  await ctx.resume();const cap=new AudioWorkletNode(ctx,'cap-proc',{numberOfOutputs:1,outputChannelCount:[2]}),z=ctx.createGain();z.gain.value=0;const chunks=[];cap.port.onmessage=e=>chunks.push(e.data);
  E.strips.master.an.connect(cap);cap.connect(z);z.connect(ctx.destination);
  try{E.stop();await new Promise(r=>setTimeout(r,250));E.play(a,{noCycle:true});const c0=E.segs[0].c0;
    while(ctx.currentTime<c0+dur+.15){if(cancel)throw new Error('Export annulé');bar.firstChild.style.width=Math.min(100,(ctx.currentTime-c0)/dur*100)+'%';await new Promise(r=>setTimeout(r,100))}
    E.stop();cap.port.postMessage({on:false});
    const f0=Math.round(c0*sr),n=Math.round(dur*sr),out=ctx.createBuffer(2,n,sr),L=out.getChannelData(0),R=out.getChannelData(1);
    for(const ch of chunks){const o=ch.t-f0;for(let i=0;i<ch.l.length;i++){const k=o+i;if(k>=0&&k<n){L[k]=ch.l[i];R[k]=ch.r[i]}}}
    return out}
  finally{try{E.strips.master.an.disconnect(cap)}catch(e){}cap.disconnect();m.remove();for(const [t,mu,so] of saved){t.mute=mu;t.solo=so}E.updateAll();if(E.playing)E.stop()}
}
// ---- fenêtre d'un plugin de l'ordinateur ----
function openBridgePlugin(o,i){
  const pl=o.plugins[i],body=h('div',{style:{minWidth:'320px'}}),w=makeWin(o.id+':'+i,'🔌 '+(pl.params.name||'Plugin')+' — '+o.name,body);if(!w)return;
  const st=h('div',{class:'kv2'}),info=h('div',{style:{color:'var(--dim)',fontSize:'11px',margin:'4px 0 8px'}},(pl.params.vendor?pl.params.vendor+' · ':'')+(pl.params.fmt||'')+' · latence compensée '+Math.round(BRIDGE.lat/ctx.sampleRate*1000)+' ms');
  const upd=()=>{if(!WINS[o.id+':'+i]){BRIDGE.listeners.delete(upd);return}const inst=bridgeInstFor(o,i);st.innerHTML='';
    st.append(h('span',null,'État'),h('b',{style:{color:!BRIDGE.connected?'#ff9f0a':inst&&inst.loaded?'#30d158':inst&&inst.err?'#ff453a':'#ffd60a'}},
      !BRIDGE.connected?'Studio Bridge non lancé':pl.byp?'Contourné':inst&&inst.loaded?(inst.editing?'Fenêtre ouverte':'Actif'):inst&&inst.err?'Erreur : '+inst.err:'Chargement…'))};
  BRIDGE.listeners.add(upd);upd();
  body.append(info,st,h('div',{class:'row',style:{justifyContent:'flex-start'}},
    h('button',{class:'on',onclick:()=>{const inst=bridgeInstFor(o,i);if(!BRIDGE.connected)return bridgeHelp();if(!inst||!inst.loaded){if(inst)inst.autoEdit=true;return toast('Chargement du plugin…')}bridgeSend({t:'edit',num:inst.num});toast('La fenêtre du plugin s’ouvre sur l’ordinateur (derrière le navigateur si besoin)',4000)}},'🪟 Ouvrir la fenêtre du plugin'),
    h('button',{title:'Enregistre les réglages du plugin dans le projet',onclick:()=>{const inst=bridgeInstFor(o,i);if(inst&&inst.loaded){bridgeSend({t:'getstate',num:inst.num});toast('Réglages mémorisés dans le projet')}}},'💾 Mémoriser'),
    h('button',{class:pl.byp?'':'on',onclick:e=>{snapshot();pl.byp=!pl.byp;e.target.classList.toggle('on',!pl.byp);e.target.textContent=pl.byp?'Contourné':'Actif';E.updateStrip(o);rerenderStrips();upd()}},pl.byp?'Contourné':'Actif')),
    h('p',{style:{color:'var(--dim)',fontSize:'11px',marginTop:'8px',maxWidth:'360px'}},'Les réglages faits dans la fenêtre du plugin sont mémorisés dans le projet quand vous la fermez. Une seule fenêtre de plugin peut être ouverte à la fois.'));
}
// ---- Bibliothèque ----
let LIB_Q='',LIB_TARGET=null;
function libTargets(){return[...P.tracks.map(t=>[t.id,tIco(t)+' '+t.name]),...P.auxes.map(a=>[a.id,'🔁 '+a.name]),['master','🔊 Sortie stéréo']]}
function insertPlugin(type,params,openIt){
  const o=findObj(LIB_TARGET&&findObj(LIB_TARGET)?LIB_TARGET:SEL)||P.tracks[0];if(!o)return toast('Ajoutez d’abord une piste');
  snapshot();const pl=plug(type,params||{});o.plugins.push(pl);closeAllPlugins();E.updateStrip(o);rerenderStrips();const idx=o.plugins.length-1;
  if(type==='bridge'){const inst=bridgeInstFor(o,idx);if(inst){if(inst.loaded)bridgeSend({t:'edit',num:inst.num});else inst.autoEdit=true}}
  if(openIt!==false)openPlugin(o,idx);toast('« '+(params&&params.name||PLUGINS[type].name)+' » ajouté sur '+o.name);
}
function toggleLibrary(force){let L=$('#library');const show=force!=null?force:!L||L.style.display==='none';
  if(!L){L=h('div',{id:'library'});document.body.append(L)}L.style.display=show?'flex':'none';
  if(show){BRIDGE.wanted=true;if(!BRIDGE.connected)bridgeConnect();renderLibrary()}bridgeEmit()}
BRIDGE.listeners.add(()=>{const L=$('#library');if(L&&L.style.display!=='none'&&!L.contains(document.activeElement))renderLibrary()});
function renderLibrary(){
  const L=$('#library');if(!L)return;const q=LIB_Q.trim().toLowerCase(),match=s=>!q||String(s).toLowerCase().includes(q);L.innerHTML='';
  if(!LIB_TARGET||!findObj(LIB_TARGET))LIB_TARGET=SEL;
  const search=h('input',{type:'text',placeholder:'🔍 Rechercher un plugin…',value:LIB_Q,oninput:e=>{LIB_Q=e.target.value;renderLibrary();const s=$('#library input[type=text]');if(s){s.focus();s.setSelectionRange(s.value.length,s.value.length)}},onkeydown:e=>e.stopPropagation()});
  L.append(h('div',{class:'lib-hd'},h('b',null,'🔌 Bibliothèque'),h('button',{onclick:()=>toggleLibrary(false)},'✕')),search,
    h('label',{class:'lib-tg'},'Insérer sur ',h('select',{onchange:e=>{LIB_TARGET=e.target.value}},libTargets().map(([id,n])=>h('option',{value:id,selected:id===LIB_TARGET},n)))));
  const body=h('div',{class:'lib-body'});L.append(body);
  // -- ordinateur
  const sec=(title,extra)=>{const s=h('div',{class:'lib-sec'},h('div',{class:'lib-st'},h('span',null,title),extra||null));body.append(s);return s};
  const pc=sec('💻 Sur cet ordinateur',BRIDGE.connected&&BRIDGE.ok?h('button',{title:'Rescanner les plugins',onclick:()=>{bridgeSend({t:'scan',force:true});BRIDGE.scanning=true;renderLibrary()}},'🔄'):null);
  if(!BRIDGE.connected){pc.append(h('div',{class:'lib-info'},'Pour ouvrir vos plugins AU / VST3 (Waves, FabFilter, Antares…), lancez ',h('b',null,'Studio Bridge'),' sur cet ordinateur.'),
      h('div',{class:'row',style:{justifyContent:'flex-start',gap:'6px'}},h('button',{class:'on',onclick:bridgeHelp},'Installer / lancer Studio Bridge'),h('button',{onclick:()=>{BRIDGE.wanted=true;bridgeConnect();toast('Recherche de Studio Bridge…')}},'Réessayer')))}
  else if(!BRIDGE.ok)pc.append(h('div',{class:'lib-info',style:{color:'#ff9f0a'}},'Studio Bridge est lancé mais « pedalboard » manque : '+BRIDGE.err+'. Relancez le fichier « Lancer Studio Bridge » (il l’installe).'));
  else{if(BRIDGE.scanning)pc.append(h('div',{class:'lib-info'},'⏳ Scan des plugins… '+BRIDGE.progress));
    const list=BRIDGE.plugins.filter(p=>match(p.name+' '+p.vendor+' '+p.fmt));const byV={};for(const p of list)(byV[p.vendor]=byV[p.vendor]||[]).push(p);
    if(!list.length&&!BRIDGE.scanning)pc.append(h('div',{class:'lib-info'},q?'Aucun plugin ne correspond.':'Aucun plugin AU/VST3 trouvé dans les dossiers habituels.'));
    for(const v of Object.keys(byV).sort((x,y)=>x.localeCompare(y))){pc.append(h('div',{class:'lib-v'},v));
      for(const p of byV[v]){const instr=p.kind==='instrument';
        pc.append(h('div',{class:'lib-it'+(instr?' dis':''),title:instr?'Instrument : bientôt pris en charge':'Cliquer pour ajouter sur la piste et ouvrir sa fenêtre',onclick:()=>{if(instr)return toast('Les instruments de l’ordinateur arrivent bientôt : pour l’instant, seuls les effets sont pris en charge.',5000);insertPlugin('bridge',{pid:p.id,name:p.name,fmt:p.fmt,vendor:p.vendor},true)}},
          h('span',null,p.name),h('i',null,instr?'instrument':p.fmt)))}}}
  // -- Studio
  const st=sec('🎛 Effets de Studio');const cats={};for(const id in PLUGINS){const d=PLUGINS[id];if(d.hideInMenu||id.startsWith('ext:'))continue;if(!match(d.name+' '+d.cat))continue;(cats[d.cat]=cats[d.cat]||[]).push([id,d])}
  for(const c in cats){st.append(h('div',{class:'lib-v'},c));for(const [id,d] of cats[c])st.append(h('div',{class:'lib-it',onclick:()=>insertPlugin(id,{},true)},h('span',null,d.name),h('i',null,'Studio')))}
  // -- .js
  const ex=sec('📦 Mes plugins .js',h('button',{title:'Charger un plugin .js',onclick:()=>$('#filePlug').click()},'+'));const exts=Object.keys(PLUGINS).filter(id=>id.startsWith('ext:')&&match(PLUGINS[id].name));
  if(!exts.length)ex.append(h('div',{class:'lib-info'},'Aucun. Modèle : ☰ Fichier → Télécharger le modèle de plugin.'));for(const id of exts)ex.append(h('div',{class:'lib-it',onclick:()=>insertPlugin(id,{},true)},h('span',null,PLUGINS[id].name),h('i',null,'.js')));
  L.append(h('div',{class:'lib-ft'},'Latence du pont ',h('select',{onchange:async e=>{BRIDGE.lat=+e.target.value;try{localStorage.setItem('studio_bridge_lat',BRIDGE.lat)}catch(er){}for(const k in E.strips)E.strips[k].sig='#';E.updateAll();toast('Latence du pont : '+BRIDGE.lat+' échantillons')}},
    [[2048,'Faible (2048)'],[4096,'Normale (4096)'],[8192,'Sûre (8192)']].map(([v,n])=>h('option',{value:v,selected:BRIDGE.lat===v},n))),h('span',{style:{color:'var(--dim)'}},' · touche Y')));
}
function bridgeHelp(){const mac=/Mac/.test(navigator.userAgent),win=/Windows/.test(navigator.userAgent);
  modal(h('div',{html:`<h2>🔌 Studio Bridge</h2><p>Petit programme qui tourne sur votre ordinateur : il trouve vos plugins <b>AU / VST3</b>, ouvre leurs fenêtres d’origine et traite le son des pistes pour Studio. Il fonctionne uniquement en local (rien ne part sur internet).</p>
  <h4>Installation (une seule fois)</h4><ol>
  <li>Installez <b>Python 3</b> depuis <a href="https://www.python.org/downloads/" target="_blank">python.org</a> (bouton jaune).${win?' Cochez « Add python.exe to PATH ».':''}</li>
  <li>Téléchargez Studio : <a href="${REPO_ZIP}" target="_blank">studio-main.zip</a>, puis décompressez-le.</li>
  <li>Ouvrez le dossier <b>bridge</b> et double-cliquez sur <b>${win?'Lancer Studio Bridge (Windows).bat':'Lancer Studio Bridge.command'}</b>.${mac?'<br><span style="color:var(--dim)">Si le Mac refuse : clic droit sur le fichier → Ouvrir → Ouvrir. La 1re fois, il installe ce qu’il faut (1-2 min).</span>':''}</li>
  <li>Laissez la fenêtre noire ouverte pendant que vous utilisez Studio. Le scan de vos plugins se fait tout seul.</li></ol>
  <h4>Dans Studio</h4><p>Touche <kbd>Y</kbd> ou bouton 🔌 → la Bibliothèque liste vos plugins. Cliquez sur un plugin : il s’ajoute sur la piste choisie et sa fenêtre s’ouvre.</p>
  <h4>Si ça ne se connecte pas</h4><ul><li>Chrome peut demander d’autoriser l’accès aux appareils du réseau local : cliquez <b>Autoriser</b>.</li>
  <li>Sur <b>Safari</b>, ouvrez plutôt <a href="http://localhost:47123" target="_blank">http://localhost:47123</a> : Studio Bridge sert aussi l’appli Studio directement (vos projets de cette adresse sont séparés de ceux du site : passez par Exporter / Importer le projet).</li>
  <li>Les effets fonctionnent ; les <b>instruments</b> de l’ordinateur arriveront dans une prochaine version.</li></ul>`}))}
