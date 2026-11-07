// ===== Démarrage, raccourcis, boucle d'affichage =====
const TYPE_KEYS={a:0,w:1,s:2,e:3,d:4,f:5,t:6,g:7,y:8,h:9,u:10,j:11,k:12,o:13,l:14,p:15,';':16};const HELD={};let FOCUS='lanes';
const AZERTY_KEYS={q:0,z:1,s:2,e:3,d:4,f:5,t:6,g:7,y:8,h:9,u:10,j:11,k:12,o:13,l:14,p:15,m:16};
function typingMap(){return P.settings.azerty!==false?AZERTY_KEYS:TYPE_KEYS}
function bindUI(){
  const B=(id,fn)=>$(id).addEventListener('click',fn);
  B('#bPlay',play);B('#bStop',stopBtn);B('#bRec',toggleRecord);B('#bStart',()=>setPH(P.cycle.on?P.cycle.start:0));
  B('#bCycle',()=>{P.cycle.on=!P.cycle.on;if(P.cycle.end<=P.cycle.start){P.cycle.start=Math.floor(PH/P.sig)*P.sig;P.cycle.end=P.cycle.start+P.sig*4}renderBar();updateCycleShade();drawRuler()});
  B('#bMetro',()=>{P.settings.metro=!P.settings.metro;P.settings.metroPlay=P.settings.metro;renderBar()});
  B('#bCount',()=>{P.settings.countIn=P.settings.countIn?0:1;renderBar();toast(P.settings.countIn?'Décompte d’1 mesure avant l’enregistrement':'Décompte désactivé')});
  B('#bInsp',()=>{if(isSmall())$('#main').classList.toggle('showinsp');else $('#main').classList.toggle('noinsp');renderBar();setTimeout(drawRuler,20)});
  $('#arr').addEventListener('pointerdown',()=>{if(isSmall())$('#main').classList.remove('showinsp')},true);
  B('#saveState',()=>saveLocal(true).then(()=>{updateSaveState();toast('Projet sauvegardé ✔')}));
  B('#bTyping',()=>{TYPING=!TYPING;renderBar();toast(TYPING?'Clavier musical : touches Q Z S E D F T G Y H U J K (AZERTY) · W/X = octave · Échap pour quitter':'Clavier musical désactivé',5000)});
  B('#bMidi',()=>initMIDI(true));B('#bSettings',settingsModal);B('#bHelp',helpModal);
  B('#bFile',e=>menu(e,['Projet',['📂 Mes projets…',projectsModal],['👥 Session à plusieurs…',collabModal],['📀 Partager un lien d’écoute (MP3)…',bounceModal],['Nouveau projet vide',()=>switchProject(()=>newProject(false))],['Nouveau projet démo (trap)',()=>switchProject(()=>newProject(true))],
    ['Exporter le projet (.studio) pour un autre appareil',saveProject],['Importer un projet (.studio)…',()=>$('#fileProj').click()],'-','Exporter l’audio',
    ['Exporter le morceau en WAV',()=>exportMix('all')],['Exporter la zone de cycle en WAV',()=>exportMix('cycle')],['Exporter chaque piste séparément (stems)',()=>exportMix('stems')],'-',
    ['🎵 Importer une instru…',importInstruDialog],['🍎 Importer depuis Logic Pro…',logicImportDialog],['Importer un son…',()=>$('#fileAudio').click()],['⌨ Raccourcis clavier',shortcutsModal],['Charger un plugin externe (.js)…',()=>$('#filePlug').click()],['Télécharger le modèle de plugin',()=>download(new Blob([PLUGIN_TEMPLATE],{type:'text/javascript'}),'mon-plugin.js')],'-',['📲 Installer l’appli sur cet appareil',installApp]]));
  B('#bAdd',addTrackMenu);B('#zIn',()=>zoom(1.25));B('#zOut',()=>zoom(.8));B('#vIn',()=>zoomV(1.2));B('#vOut',()=>zoomV(1/1.2));B('#zFit',zoomFit);B('#bSplit',splitAtPH);
  $('#snapSel').addEventListener('change',e=>{P.settings.snap=+e.target.value});
  $('#bpm').addEventListener('change',e=>{snapshot();P.bpm=clamp(+e.target.value||120,40,250);e.target.value=P.bpm;const was=E.playing;let pos=PH;if(was){pos=E.pos();E.stop()}E.updateAll();renderLanes();if(was)E.play(pos)});
  $('#bpm').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')e.target.blur()});
  $('#keySel').append(...NOTE_NAMES.map(n=>h('option',null,n)));$('#scaleSel').append(...Object.keys(SCALES).map(n=>h('option',null,n)));
  const keyCh=()=>{snapshot();P.key=$('#keySel').selectedIndex;P.scaleIdx=$('#scaleSel').selectedIndex;let n=0;
    for(const o of [...P.tracks,...P.auxes])o.plugins.forEach(pl=>{if(pl.type==='pitch'||pl.type==='tunepro'){pl.params.key=P.key;pl.params.scale=P.scaleIdx;if(pl.type==='tunepro')pl.params.notes=null;n++}});E.updateAll();if(n)toast('Autotune réglé sur '+NOTE_NAMES[P.key]+' '+Object.keys(SCALES)[P.scaleIdx]+' ('+n+' piste'+(n>1?'s':'')+')')};
  $('#keySel').addEventListener('change',keyCh);$('#scaleSel').addEventListener('change',keyCh);
  $('#sigSel').addEventListener('change',e=>{snapshot();P.sig=+e.target.value;renderLanes()});
  document.querySelectorAll('#btabs [data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  $('#fileAudio').addEventListener('change',e=>{importAudio([...e.target.files],PH,SEL);e.target.value=''});
  $('#fileProj').addEventListener('change',e=>{if(e.target.files[0])openProject(e.target.files[0]);e.target.value=''});
  $('#filePlug').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const id=loadExternalPlugin(await f.text());P.ext[id]=EXT_SRC[id];toast('Plugin « '+PLUGINS[id].name+' » chargé : il est dans la liste « + effet » → Plugins externes',5000);rerenderStrips()}catch(err){alert('Plugin invalide : '+err.message)}});
  const W=$('#lanesWrap');W.addEventListener('scroll',()=>{$('#heads').scrollTop=W.scrollTop;drawRuler();schedulePaint()});
  W.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(e.deltaY<0?1.15:.87,e.clientX)}else if(e.altKey){e.preventDefault();zoomV(e.deltaY<0?1.12:1/1.12)}},{passive:false});
  $('#heads').addEventListener('wheel',e=>{if(e.altKey||e.ctrlKey||e.metaKey){e.preventDefault();zoomV(e.deltaY<0?1.12:1/1.12)}else{W.scrollTop+=e.deltaY}},{passive:false});
  lanesPointer();rulerPointer();playheadDrag();
  // redimensionner le panneau du bas
  let rz=null;$('#resizer').addEventListener('pointerdown',e=>{rz={y:e.clientY,h:$('#bottom').offsetHeight};$('#resizer').setPointerCapture(e.pointerId)});
  $('#resizer').addEventListener('pointermove',e=>{if(!rz)return;const nh=clamp(rz.h+rz.y-e.clientY,120,innerHeight-200);document.documentElement.style.setProperty('--bh',nh+'px');if(!$('#bottom').classList.contains('open'))setTab('mixer')});
  $('#resizer').addEventListener('pointerup',()=>rz=null);
  document.addEventListener('pointerdown',e=>{ctx.resume();FOCUS=e.target.closest('#bcontent')?'bottom':e.target.closest('#lanes')?'lanes':FOCUS},true);
  document.addEventListener('keydown',onKey);document.addEventListener('keyup',onKeyUp);
  // glisser-déposer
  let dc=0;document.addEventListener('dragenter',e=>{e.preventDefault();dc++;$('#drop').style.display='flex'});document.addEventListener('dragleave',()=>{if(--dc<=0){dc=0;$('#drop').style.display='none'}});
  document.addEventListener('dragover',e=>e.preventDefault());
  document.addEventListener('drop',async e=>{e.preventDefault();dc=0;$('#drop').style.display='none';const fs=[...e.dataTransfer.files],ents=dropEntries(e.dataTransfer);
    const Lr=$('#lanes').getBoundingClientRect();let dBeat=null,dTr=null;if(e.clientX>Lr.left&&e.clientY>Lr.top){dBeat=snapB((e.clientX-Lr.left)/PPB,P.sig);const t=P.tracks[Math.floor((e.clientY-Lr.top)/TH)];dTr=t?t.id:null}
    const hasDir=ents.some(x=>x.isDirectory),special=fs.some(f=>MIDI_RE.test(f.name)||/\.(aif|aiff|aifc|caf|logicx)$/i.test(f.name)),nAudio=fs.filter(f=>AUDIO_RE.test(f.name)).length;
    if(hasDir||special||nAudio>1){const items=await walkEntries(ents);return importDropped(items,dBeat,dTr)}
    for(const f of fs){if(/\.studio$/i.test(f.name))return openProject(f);if(/\.js$/i.test(f.name)){try{const id=loadExternalPlugin(await f.text());P.ext[id]=EXT_SRC[id];toast('Plugin chargé : '+PLUGINS[id].name)}catch(err){alert(err.message)}return}}
    const L=$('#lanes').getBoundingClientRect();let beat=PH,tid=SEL;if(e.clientX>L.left&&e.clientY>L.top){beat=snapB((e.clientX-L.left)/PPB,P.sig);const t=P.tracks[Math.floor((e.clientY-L.top)/TH)];tid=t?t.id:null}
    importAudio(fs.filter(f=>/audio|\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(f.type+f.name)),beat,tid)});
  addEventListener('resize',()=>{drawRuler();schedulePaint()});
}
function zoom(f,cx){const W=$('#lanesWrap'),r=W.getBoundingClientRect(),x=(cx||r.left+r.width/2)-r.left,b=(W.scrollLeft+x)/PPB;PPB=clamp(PPB*f,2,4000);renderLanes();W.scrollLeft=b*PPB-x;drawRuler()}
function rulerPointer(){const R=$('#ruler');let d=null;
  const beatAt=e=>(e.clientX-R.getBoundingClientRect().left+$('#lanesWrap').scrollLeft)/PPB;
  R.addEventListener('pointerdown',e=>{R.setPointerCapture(e.pointerId);const b=beatAt(e);
    if(e.offsetY<11){const s=Math.floor(b);d={cyc:true,s};P.cycle.start=s;P.cycle.end=s+1;P.cycle.on=true;renderBar();updateCycleShade();drawRuler()}
    else{d={cyc:false};scrubTo(snapB(b),true)}});
  R.addEventListener('pointermove',e=>{if(!d)return;const b=beatAt(e);if(d.cyc){const x=Math.round(b);P.cycle.start=Math.max(0,Math.min(d.s,x));P.cycle.end=Math.max(d.s+1,x,P.cycle.start+1);updateCycleShade();drawRuler()}else scrubTo(snapB(b))});
  R.addEventListener('pointerup',()=>{if(d&&!d.cyc)scrubEnd();d=null});R.addEventListener('pointercancel',()=>{if(d&&!d.cyc)scrubEnd();d=null})}
// Déplacement de la tête de lecture, aussi pendant la lecture (la lecture suit en direct)
let SCRUB=null,scrubT=0;
function scrubTo(b,now){b=Math.max(0,b);SCRUB=b;PH=b;updatePlayhead(b);lcd(b);drawRuler();
  if(E.playing&&!REC){const t=performance.now();if(now||t-scrubT>140){scrubT=t;E.stop();E.play(b)}}}
function scrubEnd(){if(SCRUB==null)return;const b=SCRUB;SCRUB=null;if(E.playing&&!REC){E.stop();E.play(b)}PH=b;updatePlayhead(b);drawRuler()}
function playheadDrag(){const ph=()=>$('#playhead');let on=false;
  document.addEventListener('pointerdown',e=>{if(e.target.id!=='playhead'||e.button)return;e.stopPropagation();e.preventDefault();on=true;e.target.setPointerCapture(e.pointerId)},true);
  document.addEventListener('pointermove',e=>{if(!on)return;const L=$('#lanes').getBoundingClientRect();scrubTo(snapB((e.clientX-L.left)/PPB))},true);
  const up=()=>{if(on){on=false;scrubEnd()}};document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true)}
function onKey(e){
  const tg=e.target.tagName;if((tg==='INPUT'&&e.target.type!=='range')||tg==='SELECT'||tg==='TEXTAREA')return;
  const k=e.key.toLowerCase(),c=e.ctrlKey||e.metaKey;
  if(TYPING&&!c){const m=typingMap();
    if(k==='escape'){TYPING=false;renderBar();return}
    if(k==='w'&&m===AZERTY_KEYS||k==='z'&&m===TYPE_KEYS){OCT=Math.max(1,OCT-1);toast('Octave '+OCT);return}
    if(k==='x'){OCT=Math.min(8,OCT+1);toast('Octave '+OCT);return}
    if(k in m){e.preventDefault();if(e.repeat||HELD[k])return;const t=findTrack(SEL);if(!t||t.type==='audio')return toast('Sélectionnez une piste instrument ou batterie');const n=(t.type==='drums'?60:OCT*12+12)+m[k];HELD[k]=n;E.noteOn(t,n,.85);return}
    if(/^[a-z]$/.test(k))return;
  }
  if(c&&e.altKey&&(k==='a'||e.code==='KeyA')){e.preventDefault();addTrack('audio');return}
  if(c&&e.altKey&&(k==='s'||e.code==='KeyS')){e.preventDefault();addTrack('synth');return}
  if(c&&e.altKey&&(k==='d'||e.code==='KeyD')){e.preventDefault();addTrack('drums');return}
  if(c&&k==='arrowright'){e.preventDefault();zoom(1.25);return}if(c&&k==='arrowleft'){e.preventDefault();zoom(.8);return}
  if(c&&k==='arrowup'){e.preventDefault();zoomV(1.2);return}if(c&&k==='arrowdown'){e.preventDefault();zoomV(1/1.2);return}
  if(c&&(k==='backspace'||k==='delete')){e.preventDefault();delTrack(findTrack(SEL));return}
  if(c&&k==='c'){e.preventDefault();copyRegions();return}if(c&&k==='x'){e.preventDefault();copyRegions();deleteRegions();return}if(c&&k==='v'){e.preventDefault();pasteRegions();return}
  if(c&&k==='m'){e.preventDefault();muteRegions();return}
  if(c&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  if(c&&k==='y'){e.preventDefault();redo();return}
  if(c&&k==='s'){e.preventDefault();if(e.shiftKey)saveProject();else saveLocal(true).then(()=>toast('Projet sauvegardé ✔'));return}
  if(c&&k==='o'){e.preventDefault();$('#fileProj').click();return}
  if(c&&k==='d'){e.preventDefault();dupRegions();return}
  if(c&&k==='t'){e.preventDefault();splitAtPH();return}
  if(c&&k==='k'){e.preventDefault();$('#bTyping').click();return}
  if(c&&k==='a'){e.preventDefault();SELR=new Set(P.tracks.flatMap(t=>t.regions.map(r=>r.id)));renderLanes();return}
  if(c&&k==='e'){e.preventDefault();exportMix('all');return}
  if(c)return;
  if(e.shiftKey&&k==='d'){e.preventDefault();dupTrack(findTrack(SEL));return}
  if(e.altKey&&k==='arrowleft'){e.preventDefault();nudge(-1);return}if(e.altKey&&k==='arrowright'){e.preventDefault();nudge(1);return}
  if(k==='z'){zoomFit();return}if(k==='u'){cycleToSel();return}
  if(k==='home'){setPH(0);return}if(k==='end'){let b=0;for(const t of P.tracks)for(const r of t.regions)b=Math.max(b,r.start+rLen(t,r));setPH(b);return}
  if(k===','){setPH(Math.max(0,(Math.ceil(PH/P.sig)-1)*P.sig));return}if(k==='.'){setPH((Math.floor(PH/P.sig)+1)*P.sig);return}
  if(k===' '){e.preventDefault();play();return}
  if(k==='enter'){setPH(0);return}
  if(k==='r'){toggleRecord();return}
  if(k==='c'){$('#bCycle').click();return}
  if(k==='k'){$('#bMetro').click();return}
  if(k==='x'){setTab('mixer');return}
  if(k==='p'){setTab('piano');return}
  if(k==='e'){const t=findTrack(SEL);setTab(t&&t.type==='drums'?'steps':'piano');return}
  if(k==='i'){$('#bInsp').click();return}
  if(k==='m'){const t=findTrack(SEL);if(t){t.mute=!t.mute;E.updateAll();renderHeads();rerenderStrips()}return}
  if(k==='s'){const t=findTrack(SEL);if(t){t.solo=!t.solo;E.updateAll();renderHeads();rerenderStrips()}return}
  if(k==='delete'||k==='backspace'){e.preventDefault();
    if(FOCUS==='bottom'&&TAB==='piano'&&PR.sel.size){const fr=findRegion(PR.region);if(fr){snapshot();fr[1].notes=fr[1].notes.filter((n,i)=>!PR.sel.has(i));PR.sel.clear();renderBottom();renderLanes()}return}
    if(SELR.size)deleteRegions();else delTrack(findTrack(SEL));return}
  if(k==='arrowleft'){e.preventDefault();setPH(Math.max(0,(Math.ceil(PH/P.sig)-1)*P.sig));return}
  if(k==='arrowright'){e.preventDefault();setPH((Math.floor(PH/P.sig)+1)*P.sig);return}
  if(k==='arrowup'||k==='arrowdown'){e.preventDefault();const i=P.tracks.findIndex(t=>t.id===SEL)+(k==='arrowup'?-1:1);if(P.tracks[i])selectTrack(P.tracks[i].id);return}
  if(k==='+'||k==='='){zoom(1.25);return}if(k==='-'){zoom(.8);return}
}
function onKeyUp(e){const k=e.key.toLowerCase();if(HELD[k]!==undefined){const t=findTrack(SEL);if(t)E.noteOff(t,HELD[k]);delete HELD[k]}}
function lcd(pos){const b=Math.max(0,pos);const bar=Math.floor(b/P.sig)+1,beat=Math.floor(b%P.sig)+1,six=Math.floor((b%1)*4)+1,s=b*spb();
  $('#lcdPos').textContent=`${String(bar).padStart(3,' ')} ${beat} ${six}`;$('#lcdTime').textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${(s%60).toFixed(1).padStart(4,'0')}`}
let lastRecDraw=0;
function loop(){
  const pos=SCRUB!=null?SCRUB:E.playing?E.pos():PH;updatePlayhead(pos);lcd(pos);
  if(E.playing&&SCRUB==null){drawRuler();const W=$('#lanesWrap'),x=pos*PPB;if(x>W.scrollLeft+W.clientWidth-40||x<W.scrollLeft)W.scrollLeft=Math.max(0,x-60)}
  document.querySelectorAll('.meter i[data-id]').forEach(i=>{const s=E.strips[i.dataset.id];if(!s)return;const l=meterLevel(s.an),db=l>0?20*Math.log10(l):-80;let v=clamp((db+60)/66*100,0,100);const pv=+i.dataset.v||0;v=Math.max(v,pv-2.5);i.dataset.v=v;i.style.height=v+'%'});
  const im=$('#inMeter');if(im){const p=E.inPeak||0,db=p>0?20*Math.log10(p):-80;im.style.width=clamp((db+60)/60*100,0,100)+'%';im.style.background=db>-3?'#ff3b30':db>-12?'#ffd60a':'#30d158'}
  if(TAB==='steps'&&EDIT){const fr=findRegion(EDIT.r);document.querySelectorAll('.step.cur').forEach(x=>x.classList.remove('cur'));
    if(fr&&E.playing){const [t,r]=fr;if(pos>=r.start&&pos<r.start+r.len){const k=Math.floor((pos-r.start)/.25),si=(k+(r.phase||0))%r.pat.steps;document.querySelectorAll(`.step[data-i="${si}"]`).forEach(x=>x.classList.add('cur'))}}}
  if(REC&&E.recording&&pos>=REC.start){for(const tid of REC.tracks){const ln=document.querySelector(`.lane[data-t="${tid}"]`);if(!ln)continue;let d=ln.querySelector('.recLive');
      if(!d){d=h('div',{class:'reg recLive',style:{left:REC.start*PPB+'px',background:'#a3201a'}},h('div',{class:'rt'},'● Enregistrement…'),h('canvas',{width:4000,height:TH-20}));ln.append(d)}
      d.style.width=(pos-REC.start)*PPB+'px';
      const cv=d.querySelector('canvas'),g=cv.getContext('2d'),pk=E.recLive,per=128/ctx.sampleRate/spb()*PPB,mid=(TH-20)/2;
      const skip=Math.max(0,Math.round(((ctx.outputLatency||0)+(ctx.baseLatency||0)+(P.settings.countIn|0)*P.sig*spb())*ctx.sampleRate/128));
      g.fillStyle='#ffb3ad';for(let j=Math.max(lastRecDraw,skip);j<pk.length;j++){const x=(j-skip)*per;if(x>4000)break;g.fillRect(x,mid-pk[j]*mid,Math.max(1,per),Math.max(1,pk[j]*mid*2))}lastRecDraw=pk.length}}
  else lastRecDraw=0;
  requestAnimationFrame(loop);
}
async function settingsModal(){
  let devs=[];try{devs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput')}catch(e){}
  const sel=h('select',{onchange:async e=>{P.settings.inputDev=e.target.value;try{await E.openMic(P.settings.inputDev);toast('Entrée : '+e.target.selectedOptions[0].text)}catch(err){micError(err)}}},h('option',{value:''},'Micro par défaut du système'),devs.map(d=>h('option',{value:d.deviceId,selected:d.deviceId===P.settings.inputDev},d.label||'Micro '+d.deviceId.slice(0,6))));
  const lat=Math.round(((ctx.outputLatency||0)+(ctx.baseLatency||0))*1000);
  modal([h('h2',null,'⚙ Réglages'),h('div',{class:'kv2'},'Version',h('span',null,'Studio v'+APP_VERSION+' ',h('button',{onclick:()=>showChangelog(true)},'Nouveautés'))),
    h('div',{class:'kv2'},'Nom du projet',h('input',{type:'text',value:P.name,onchange:e=>{P.name=e.target.value;renderBar()}})),
    h('div',{class:'kv2'},'Entrée micro',sel),
    !devs.some(d=>d.label)&&h('div',{style:{color:'var(--dim)',fontSize:'11px'}},'Les noms des micros apparaissent après avoir autorisé le micro (armez une piste avec R).'),
    h('div',{class:'kv2'},'Décompte avant enregistrement',h('select',{onchange:e=>{P.settings.countIn=+e.target.value;renderBar()}},[0,1,2].map(n=>h('option',{value:n,selected:n===(P.settings.countIn|0)},n?n+' mesure'+(n>1?'s':''):'Aucun')))),
    h('div',{class:'kv2'},'Métronome pendant la lecture',h('input',{type:'checkbox',checked:!!P.settings.metroPlay,onchange:e=>P.settings.metroPlay=e.target.checked})),
    h('div',{class:'kv2'},'Clavier musical AZERTY',h('input',{type:'checkbox',checked:P.settings.azerty!==false,onchange:e=>P.settings.azerty=e.target.checked})),
    h('div',{class:'kv2'},'Compensation de latence (ms)',h('input',{type:'number',value:P.settings.latencyMs||0,min:-300,max:300,style:{width:'70px'},onchange:e=>P.settings.latencyMs=+e.target.value})),
    h('div',{style:{color:'var(--dim)',fontSize:'11px'}},'Latence de sortie mesurée : ~'+lat+' ms (déjà compensée). Si vos prises sont en retard sur le beat, mettez une valeur positive (ex : 20) ; en avance : négative.'),
    h('div',{class:'kv2'},'Mode audio',h('select',{onchange:async e=>{try{localStorage.setItem('studio_lat',e.target.value)}catch(err){}await saveLocal(true);location.reload()}},[['interactive','Réactif (faible latence)'],['balanced','Équilibré (conseillé)'],['playback','Stable (anti-grésillement)']].map(([v,n])=>h('option',{value:v,selected:(localStorage.getItem('studio_lat')||'balanced')===v},n)))),
    h('div',{style:{color:'var(--dim)',fontSize:'11px'}},'Si le son grésille ou coupe pendant la lecture, choisissez « Stable ». L’appli redémarre (projet sauvegardé).'),
    h('div',{class:'kv2'},'Contrôleur MIDI',h('button',{onclick:()=>initMIDI(true)},MIDI?'MIDI actif ('+MIDI.inputs.size+')':'Activer le MIDI')),
    h('div',{class:'kv2'},'Assignations MIDI',h('button',{onclick:()=>{P.midiMap={};toast('Assignations effacées')}},'Tout effacer ('+Object.keys(P.midiMap).length+')'))]);
}
function helpModal(){modal(h('div',{html:`<h2>Aide rapide</h2>
<h4>Faire un son en 5 étapes</h4><ul>
<li><b>Instru :</b> faites glisser un MP3/WAV dans la fenêtre (ou Fichier → Importer), puis réglez le <b>BPM</b> et la <b>tonalité</b> en haut. Vous pouvez aussi composer avec les pistes 🥁 Batterie et 🎹 Instrument.</li>
<li><b>Voix :</b> sélectionnez la piste 🎤, choisissez un préréglage à gauche (ex : « Voix autotune trap »), cliquez <b>R</b> sur la piste puis ⏺ (touche R). Mettez un <b>casque</b>.</li>
<li><b>Refaire une partie :</b> placez la tête de lecture et réenregistrez : la nouvelle prise remplace l’ancienne à cet endroit. Ctrl+Z pour annuler.</li>
<li><b>Mixer :</b> touche X. Volume, pan, effets, envois vers les bus Réverb et Délai.</li>
<li><b>Exporter :</b> Fichier → Exporter le morceau en WAV. <b>Enregistrez le projet</b> (Ctrl+S) pour le rouvrir plus tard.</li></ul>
<h4>Raccourcis</h4><p><a href="#" onclick="event.preventDefault();this.closest('.modal').remove();shortcutsModal()">→ Voir tous les raccourcis</a><br><kbd>Espace</kbd> lecture/stop · <kbd>R</kbd> enregistrer · <kbd>C</kbd> cycle (boucle) · <kbd>K</kbd> métronome · <kbd>Entrée</kbd> début · <kbd>←</kbd><kbd>→</kbd> mesure précédente/suivante · <kbd>X</kbd> mixeur · <kbd>E</kbd> éditeur · <kbd>P</kbd> piano roll · <kbd>I</kbd> inspecteur · <kbd>M</kbd>/<kbd>S</kbd> muet/solo · <kbd>Suppr</kbd> effacer · <kbd>Ctrl+Z</kbd> annuler · <kbd>Ctrl+D</kbd> dupliquer · <kbd>Ctrl+T</kbd> couper · <kbd>Ctrl+K</kbd> clavier musical · <kbd>Ctrl+S</kbd> sauvegarder · <kbd>Ctrl+Maj+S</kbd> exporter le projet · <kbd>Ctrl+molette</kbd> zoom · <kbd>Alt+glisser</kbd> copier une région</p>
<h4>Régions</h4><p>Glisser = déplacer · bords = raccourcir/allonger · double-clic sur une piste instrument/batterie = nouvelle région · clic droit = menu (gain, normaliser, reverse…). Dans la règle : cliquer = placer la tête de lecture ; glisser dans la bande du haut = zone de cycle.</p>
<h4>Réglages rapides & instru</h4><p>Sélectionnez une piste voix : l’inspecteur (ⓘ) affiche des curseurs simples (Écho, Réverb, Autotune…). Bouton 🎵 Instru : importez un beat, Studio détecte BPM et tonalité ; sélectionnez la région pour changer le tempo, transposer, enlever la voix, faire des fondus.</p><h4>Plugins</h4><p>17 effets intégrés : Channel EQ, Compresseur, Pitch Correction (autotune), Pitch Shifter, De-Esser, Noise Gate, Saturation, Lo-Fi, Filtre/Téléphone, Chorus/Doubleur, Robot, Phaser, Trémolo, Délai, Réverb, Stéréo, Limiteur. <b>Plugins externes</b> : Fichier → Télécharger le modèle de plugin, modifiez-le, puis chargez-le avec « + effet → Charger un plugin externe ». Les VST/AU ne peuvent pas fonctionner dans un navigateur.</p>
<h4>Contrôleur MIDI</h4><p>Bouton 🎛 MIDI pour l’activer. Les notes jouent la piste sélectionnée. <b>Clic droit sur un bouton ou un fader → MIDI Learn</b>, puis bougez un potard.</p>
<h4>Appli et appareils</h4><p>Installez l’appli (Fichier → Installer) : elle marche ensuite sans internet. Projets sauvegardés automatiquement dans l’appareil. Pour changer d’appareil : Fichier → Exporter le projet (.studio), puis Importer sur l’autre.</p><h4>Sur écran tactile</h4><p>Appui long = clic droit (menus, roulements, MIDI Learn) · double-tap = double-clic · dans le Piano Roll, basculez ✋ Défiler / ✏️ Écrire.</p>`}))}
async function main(){
  let lh='balanced';try{lh=localStorage.getItem('studio_lat')||'balanced'}catch(e){}ctx=new AudioContext({latencyHint:lh});E=new Engine(ctx,true);
  try{await E.init()}catch(e){alert('Votre navigateur ne gère pas AudioWorklet. Utilisez Chrome, Edge ou Firefox récent.');throw e}
  let last=null;try{last=localStorage.getItem('studio_last')}catch(e){}
  newProject(true);P.id=uid('p');E.build(P);SEL=P.tracks[0].id;bindUI();renderAll();requestAnimationFrame(loop);
  if(last)try{await loadLocal(last)}catch(e){console.warn(e)}
  initApp();showChangelog();collabBoot();if(!isSmall()&&!TAB)setTab('mixer');if(isSmall()&&innerHeight>innerWidth)toast('Astuce : tournez l’appareil à l’horizontale pour plus de place',4500);
  let seen=false;try{seen=localStorage.getItem('studio_seen')}catch(e){}
  if(!seen){try{localStorage.setItem('studio_seen','1')}catch(e){}modal(h('div',{html:`<h2>Bienvenue dans Studio 🎧</h2><p>Un projet démo trap est chargé : appuyez sur ▶ (ou <kbd>Espace</kbd>) pour l’écouter. Vos projets sont <b>sauvegardés automatiquement</b> dans l’appareil (bouton 📂).</p><ul><li>La piste <b>🎤 Voix 1</b> est prête avec un préréglage autotune : cliquez <b>R</b> puis ⏺ pour enregistrer (avec un casque).</li><li>Double-cliquez (ou double-touchez) sur la région « Rythme » pour éditer la batterie, ou sur « 808 » / « Arpège » pour le piano roll.</li><li>Fichier → Nouveau projet vide pour partir de zéro. Le bouton <b>?</b> ouvre l’aide.</li></ul>`}))}
}
window.addEventListener('load',main);
