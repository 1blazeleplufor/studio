// ===== v3.11 — Interface téléphone (inspirée de BandLab) =====
// Sur un téléphone, l'interface « ordinateur » (#app) est cachée et remplacée par #mob :
// barre du haut (projets, titre, annuler, menu), pistes en grosses lignes (icône colorée à gauche, sons à droite),
// barre d'outils contextuelle, et en bas : ⏮ ▶ ● (gros bouton rouge) ♩ ＋. Les réglages s'ouvrent en feuilles qui montent du bas.
// Même projet (P), même moteur (E), mêmes sessions : seul l'affichage change. localStorage.studio_mob : '1' forcé, '0' version ordinateur.
let MOB=false,MTH=66,MPAD=150,MUSER=false,MPROG=0;const MHW=108,MRH=26;let mobSel=null,mobReq=0,mobLastRec=0;
function mobLand(){return innerWidth>innerHeight&&innerHeight<=520}
function mobWanted(){let f=null;try{f=localStorage.getItem('studio_mob')}catch(e){}if(f==='0')return false;if(f==='1')return true;
  return innerWidth<=540||(IS_TOUCH&&Math.min(screen.width,screen.height)<=540)}
function mobSet(on){try{localStorage.setItem('studio_mob',on?'1':'0')}catch(e){}location.reload()}
const mfmt=b=>{const s=Math.max(0,b)*spb(),m=Math.floor(s/60);return m+':'+String(Math.floor(s%60)).padStart(2,'0')+'.'+Math.floor(s*10%10)};
const mB=(cls,lab,fn,tip)=>h('button',{class:cls,title:tip||'',onclick:e=>{e.stopPropagation();fn(e)}},lab);

// ---------- feuilles (montent du bas) ----------
function mSheet(title,content,cls){document.querySelectorAll('.msheet').forEach(x=>x.remove());
  const s=h('div',{class:'msheet '+(cls||''),onpointerdown:e=>{if(e.target===s)s.remove()}},
    h('div',{class:'mbox'},h('div',{class:'mgrip'}),h('div',{class:'mshd'},h('b',null,title),h('button',{class:'mx',onclick:()=>s.remove()},'✕')),h('div',{class:'mbody'},content)));
  document.body.append(s);return s}
const mRow=(ico,lab,fn,sub)=>h('button',{class:'mrowb',onclick:()=>{document.querySelectorAll('.msheet').forEach(x=>x.remove());fn()}},h('span',{class:'mi'},ico),h('span',{class:'ml'},h('b',null,lab),sub&&h('small',null,sub)));

function mobAddSheet(){mSheet('Ajouter une piste',h('div',{class:'mtiles'},
  mTile('🎤','Voix','Enregistre-toi au micro',()=>{addTrack('audio');mobSched()}),
  mTile('🎵','Instru','Importe ta prod (MP3, WAV)',()=>importInstruDialog()),
  mTile('📂','Importer un son','Un fichier audio',()=>$('#fileAudio').click()),
  mTile('🥁','Batterie','Rythme tout prêt',()=>{addTrack('drums');mobSched()}),
  mTile('🎹','Instrument','Synthé, basse 808…',()=>{addTrack('synth');mobSched()})))}
function mTile(ico,lab,sub,fn){return h('button',{class:'mtile',onclick:()=>{document.querySelectorAll('.msheet').forEach(x=>x.remove());fn()}},h('span',null,ico),h('b',null,lab),h('small',null,sub))}

function mobMenuSheet(){mSheet(P.name||'Projet',h('div',null,
  mRow('📂','Mes projets',projectsModal),
  mRow('✨','Nouveau projet',()=>switchProject(()=>newProject(false)),'Projet vide'),
  mRow('👥','Session à plusieurs',collabModal,'Travailler à plusieurs sur ce projet'),
  mRow('📀','Lien d’écoute',bounceModal,'Envoyer le morceau en MP3 par un lien'),
  mRow('⬇️','Exporter en MP3',()=>exportMix('all','mp3')),
  mRow('⬇️','Exporter en WAV',()=>exportMix('all')),
  mRow('💾','Enregistrer le projet dans Fichiers',saveProject,'Fichier .studio, pour un autre appareil'),
  mRow('📥','Ouvrir un projet .studio',()=>$('#fileProj').click()),
  mRow('⚙️','Réglages',settingsModal),
  mRow('🩺','Test du micro',micTest),
  mRow('🖥','Version ordinateur',()=>{if(confirm('Passer à l’affichage ordinateur (toutes les fonctions, plus petit) ?\nPour revenir : ⚙ Réglages → 📱 Version téléphone.'))mobSet(false)},'Toutes les fonctions avancées')))}

function mobTempoSheet(){
  const set=v=>{const i=$('#bpm');i.value=clamp(Math.round(v),40,250);i.dispatchEvent(new Event('change'));num.textContent=P.bpm;mobSched()};
  const num=h('b',{class:'mbpm'},P.bpm);
  const key=h('select',{onchange:e=>{$('#keySel').selectedIndex=e.target.selectedIndex;$('#keySel').dispatchEvent(new Event('change'));mobSched()}},NOTE_NAMES.map((n,i)=>h('option',{selected:i===P.key},n)));
  const sc=h('select',{onchange:e=>{$('#scaleSel').selectedIndex=e.target.selectedIndex;$('#scaleSel').dispatchEvent(new Event('change'));mobSched()}},Object.keys(SCALES).map((n,i)=>h('option',{selected:i===P.scaleIdx},n)));
  const tog=(lab,get,fn)=>{const b=h('button',{class:'mtog'+(get()?' on':''),onclick:()=>{fn();b.classList.toggle('on',!!get());mobSched()}},lab);return b};
  mSheet('Tempo et tonalité',h('div',null,
    h('div',{class:'mbpmrow'},h('button',{onclick:()=>set(P.bpm-1)},'−'),h('div',null,num,h('small',null,'BPM')),h('button',{onclick:()=>set(P.bpm+1)},'+')),
    h('div',{class:'mkv'},'Tonalité',h('span',null,key,' ',sc)),
    h('div',{class:'mkv'},'Métronome',tog('♩ Clic',()=>P.settings.metro,()=>$('#bMetro').click())),
    h('div',{class:'mkv'},'Décompte avant d’enregistrer',tog('1 mesure',()=>P.settings.countIn,()=>$('#bCount').click()))))}

function mobTrackSheet(t){if(!t)return;const voice=t.type==='audio'&&!isInstru(t);
  const upd=()=>{E.updateStrip(t);mobSched()};
  const tog=(lab,get,fn,cls)=>{const b=h('button',{class:'mtog '+(cls||'')+(get()?' on':''),onclick:async()=>{await fn();b.classList.toggle('on',!!get());mobSched()}},lab);return b};
  const vl=h('small',null,(t.vol>0?'+':'')+(+t.vol).toFixed(1)+' dB');
  const body=h('div',null,
    h('input',{class:'mname',value:t.name,onchange:e=>{snapshot();t.name=e.target.value||t.name;mobSched()},onkeydown:e=>{e.stopPropagation();if(e.key==='Enter')e.target.blur()}}),
    h('div',{class:'mtogs'},
      tog('M  Muet',()=>t.mute,()=>{snapshot();t.mute=!t.mute;E.updateAll()},'tm'),
      tog('S  Solo',()=>t.solo,()=>{t.solo=!t.solo;E.updateAll()},'ts'),
      voice&&tog('🎧 M’entendre',()=>t.mon,()=>toggleMon(t))),
    h('div',{class:'mkv'},h('span',null,'Volume ',vl),h('input',{type:'range',min:-60,max:6,step:.5,value:t.vol,onpointerdown:()=>snapshot(),oninput:e=>{t.vol=+e.target.value;vl.textContent=(t.vol>0?'+':'')+t.vol.toFixed(1)+' dB';E.updateStrip(t)}})),
    h('div',{class:'mkv'},'Gauche / Droite',h('input',{type:'range',min:-1,max:1,step:.05,value:t.pan||0,onpointerdown:()=>snapshot(),oninput:e=>{t.pan=+e.target.value;E.updateStrip(t)},ondblclick:e=>{t.pan=0;e.target.value=0;upd()}})),
    voice&&mobFxGrid(t),
    !voice&&t.type!=='audio'&&h('p',{class:'muted',style:{fontSize:'12px'}},'Pour modifier les notes de cette piste, passe par la version ordinateur (menu ⋯).'),
    h('div',{class:'mtogs',style:{marginTop:'14px'}},
      h('button',{class:'mtog',onclick:()=>{document.querySelectorAll('.msheet').forEach(x=>x.remove());dupTrack(t)}},'⧉ Dupliquer'),
      h('button',{class:'mtog',onclick:()=>{document.querySelectorAll('.msheet').forEach(x=>x.remove());folderDialog(t)}},'📁 Dossier'),
      h('button',{class:'mtog danger',onclick:()=>{if(!confirm('Supprimer la piste « '+t.name+' » ?'))return;document.querySelectorAll('.msheet').forEach(x=>x.remove());delTrack(t);toast('Piste supprimée — ↶ pour annuler')}},'🗑 Supprimer')));
  mSheet(tIco(t)+' '+t.name,body,'mtrk')}
// effets voix : grosses cartes, par catégorie
function mobFxGrid(t){const wrap=h('div',{class:'mfx'}),cats=[];for(const n in VOCAL_PRESETS){const c=VOCAL_PRESETS[n].cat;if(!cats.includes(c))cats.push(c)}
  let cur=(VOCAL_PRESETS[t.preset]||{}).cat||cats[0];const tabs=h('div',{class:'mfxt'}),grid=h('div',{class:'mfxg'});
  const draw=()=>{tabs.innerHTML='';grid.innerHTML='';
    for(const c of cats)tabs.append(h('button',{class:c===cur?'on':'',onclick:()=>{cur=c;draw()}},c));
    for(const n in VOCAL_PRESETS)if(VOCAL_PRESETS[n].cat===cur)grid.append(h('button',{class:'mfxc'+(t.preset===n?' on':''),onclick:()=>{applyVocalPreset(t,n);draw()}},h('span',null,/aucun/i.test(n)?'🚫':/autotune/i.test(n+cur)?'🎛':/Créatif/i.test(cur)?'✨':/lib|back/i.test(cur)?'🗣':'🎙'),n))};
  draw();wrap.append(h('div',{class:'mfxh'},'✨ Effets de voix'),tabs,grid);return wrap}
function mobFxSheet(t){mSheet('✨ Effets — '+t.name,mobFxGrid(t),'mtrk')}

// ---------- construction ----------
function mobInit(){if(MOB)return;MOB=true;document.body.classList.add('mob');PPB=Math.min(PPB,18);
  const el=h('div',{id:'mob'},
    h('div',{class:'mtop'},mB('mic','☰',()=>projectsModal(),'Mes projets'),h('div',{class:'mtitle',id:'mTitle',onclick:()=>{const v=prompt('Nom du projet',P.name);if(v){P.name=v;DIRTY=true;mobSched()}}}),
      mB('mic','↶',()=>undo(),'Annuler'),mB('mic','↷',()=>redo(),'Rétablir'),mB('mic','⋯',mobMenuSheet,'Menu')),
    h('div',{class:'minfo'},h('div',{id:'mTime',class:'mtime'},'0:00.0'),h('div',{id:'mMeter',class:'mmeter'},h('i')),
      h('button',{id:'mTempo',class:'mchip',onclick:mobTempoSheet}),
      h('span',{class:'mzoom'},mB('','−',()=>mobZoom(1/1.4)),mB('','+',()=>mobZoom(1.4)))),
    h('div',{class:'mswrap'},h('div',{id:'mScroll'},h('div',{id:'mInner'})),h('div',{id:'mPH'},h('i'))),
    h('div',{id:'mTools',class:'mtools'}),
    h('div',{class:'mtrans'},
      mB('mt','⏮',()=>{setPH(0);mobSyncScroll()},'Début'),
      h('button',{id:'mPlay',class:'mt',onclick:()=>{audioUnlock();play()}},'▶'),
      h('button',{id:'mRec',class:'mrec',title:'Enregistrer',onclick:mobRecord},h('i')),
      h('button',{id:'mMetro',class:'mt',onclick:()=>{$('#bMetro').click();mobSched()}},'♩'),
      mB('mt madd','＋',mobAddSheet,'Ajouter une piste')),
    h('div',{id:'mCount',class:'mcount'}));
  document.body.append(el);
  const S=$('#mScroll');let ut=0;
  S.addEventListener('scroll',()=>{schedMobPaint();if(performance.now()<MPROG)return;if(!E.playing){PH=Math.max(0,S.scrollLeft/PPB);const tm=$('#mTime');if(tm)tm.textContent=mfmt(PH)}},{passive:true});
  const userOn=()=>{MUSER=true;clearTimeout(ut);if(E.playing&&!REC){PH=E.pos();E.stop()}};
  const userOff=()=>{clearTimeout(ut);ut=setTimeout(()=>{MUSER=false},250)};
  S.addEventListener('touchstart',e=>{if(!e.target.closest('.mreg.sel,.mrulb'))userOn()},{passive:true});S.addEventListener('touchend',userOff,{passive:true});S.addEventListener('touchcancel',userOff,{passive:true});
  S.addEventListener('wheel',()=>{userOn();userOff()},{passive:true});
  // pincer pour zoomer
  let pz=null;const dist=e=>Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  S.addEventListener('touchstart',e=>{if(e.touches.length===2)pz={d:dist(e),ppb:PPB}},{passive:true});
  S.addEventListener('touchmove',e=>{if(e.touches.length!==2||!pz)return;e.preventDefault();const cx=(e.touches[0].clientX+e.touches[1].clientX)/2;mobSetPPB(pz.ppb*dist(e)/pz.d,cx)},{passive:false});
  S.addEventListener('touchend',e=>{if(e.touches.length<2)pz=null},{passive:true});
  mobBindLanes();mobRender();requestAnimationFrame(mobTick);
  addEventListener('resize',()=>mobSched());}
function mobSetPPB(v){const ph=PH;PPB=clamp(v,3,160);MPROG=performance.now()+120;mobRender();PH=ph;mobSyncScroll()}
function mobZoom(f){mobSetPPB(PPB*f)}
function mobSched(){if(!MOB||mobReq)return;mobReq=requestAnimationFrame(()=>{mobReq=0;mobRender()})}
function mobLen(){let end=0;for(const t of P.tracks)for(const r of t.regions)end=Math.max(end,r.start+rLen(t,r));return Math.max(end+P.sig*8,P.sig*16,PH+P.sig*4)}

function mobRender(){if(!MOB||!P)return;MTH=mobLand()?54:66;$('#mob').style.setProperty('--mth',MTH+'px');$('#mob').classList.toggle('land',mobLand());
  $('#mTitle').textContent=(typeof COLLAB!=='undefined'&&COLLAB.on?'👥 ':'')+(P.name||'Projet');
  $('#mTempo').textContent=P.bpm+' BPM · '+NOTE_NAMES[P.key]+' '+(Object.keys(SCALES)[P.scaleIdx]||'').slice(0,3).toLowerCase();
  $('#mMetro').classList.toggle('on',!!P.settings.metro);
  const S0=$('#mScroll');MPAD=Math.round(Math.max(60,(S0.clientWidth-MHW)*.4));$('#mPH').style.left=(MHW+MPAD)+'px';
  const I=$('#mInner'),W=mobLen()*PPB+2*MPAD;I.innerHTML='';I.style.width=(MHW+W)+'px';
  // règle
  const rul=h('div',{class:'mrul',id:'mRul'},h('div',{class:'mcorner'}),h('div',{class:'mrulb',style:{width:W+'px'}}));
  const rb=rul.lastChild,barPx=P.sig*PPB,step=barPx>=44?1:barPx>=22?2:barPx>=11?4:barPx>=5.5?8:16;
  for(let b=0;b*P.sig<mobLen();b+=step)rb.append(h('span',{style:{left:MPAD+b*barPx+'px'}},b+1));
  I.append(rul);
  for(const row of ROWS()){
    if(!row.t){const f=row.f,open=FOLD_OPEN.has(f.id),ms=foldMembers(f),bh=(MTH-12)/Math.max(1,ms.length);
      const ln=h('div',{class:'mlane mfl',style:{width:W+'px'}});
      ms.forEach((t,k)=>{for(const r of t.regions)ln.append(h('div',{class:'mfsum',style:{left:MPAD+r.start*PPB+'px',width:Math.max(3,rLen(t,r)*PPB)+'px',top:(6+k*bh)+'px',height:Math.max(2,bh-2)+'px',background:shade(t.color,.8)}}))});
      I.append(h('div',{class:'mrow'},h('div',{class:'mhead mfh',onclick:()=>setFoldOpen(f,!open)},h('div',{class:'mico',style:{background:f.color}},'📁'),h('div',{class:'mhn'},h('b',null,f.name),h('small',null,(open?'▾ ':'▸ ')+ms.length+' piste'+(ms.length>1?'s':'')))),ln));continue}
    const t=row.t,ln=h('div',{class:'mlane'+(t.id===SEL?' sel':''),'data-t':t.id,style:{width:W+'px'}});
    for(const r of t.regions)ln.append(h('div',{class:'mreg'+(SELR.has(r.id)?' sel':''),'data-r':r.id,style:{left:MPAD+r.start*PPB+'px',width:Math.max(8,rLen(t,r)*PPB)+'px',background:shade(t.color,.62),opacity:r.mute||t.mute?.4:1}},
      h('div',{class:'tiles'}),h('div',{class:'mrt'},(r.mute?'🔇 ':'')+(r.name||'')),h('div',{class:'mh l'}),h('div',{class:'mh r'})));
    I.append(h('div',{class:'mrow'},h('div',{class:'mhead'+(t.id===SEL?' sel':'')+(row.f?' inf':''),'data-t':t.id,onclick:()=>{if(SEL===t.id&&!SELR.size)mobTrackSheet(t);else{SEL=t.id;SELR.clear();mobSched()}}},
        h('div',{class:'mico',style:{background:t.color}},tIco(t),t.arm&&h('i',{class:'marm'})),
        h('div',{class:'mhn'},h('b',null,t.name),h('span',{class:'mms'},
          h('button',{class:'m'+(t.mute?' on':''),onclick:e=>{e.stopPropagation();snapshot();t.mute=!t.mute;E.updateAll();mobSched()}},'M'),
          h('button',{class:'s'+(t.solo?' on':''),onclick:e=>{e.stopPropagation();t.solo=!t.solo;E.updateAll();mobSched()}},'S')))),ln))}
  I.append(h('div',{class:'mrow maddrow'},h('div',{class:'mhead',style:{background:'transparent',borderColor:'transparent'}}),h('div',{style:{position:'sticky',left:MHW+'px',padding:'12px 10px'}},h('button',{class:'maddb',onclick:mobAddSheet},'＋  Ajouter une piste'))));
  mobLastRec=0;mobTools();schedMobPaint();mobTick(true)}

// ---------- barre d'outils contextuelle ----------
function mobTools(){const T=$('#mTools');if(!T)return;T.innerHTML='';
  if(SELR.size){const items=[...SELR].map(findRegion).filter(Boolean);if(!items.length){SELR.clear();return mobTools()}
    const muted=items.every(([t,r])=>r.mute);
    T.append(mB('mtl','✂ Couper',()=>{splitAtPH();mobSched()},'Couper à la barre de lecture'),
      mB('mtl','⧉ Dupliquer',()=>{dupRegions();mobSched()}),
      mB('mtl',muted?'🔊 Réactiver':'🔇 Muet',()=>{snapshot();items.forEach(([t,r])=>r.mute=!muted);renderLanes()}),
      mB('mtl danger','🗑 Supprimer',()=>{deleteRegions();toast('Supprimé — ↶ pour annuler')}),
      mB('mtl','✕',()=>{SELR.clear();mobSched()}));return}
  const t=findTrack(SEL);if(!t){T.append(h('span',{class:'muted'},'Touche ＋ pour ajouter une piste'));return}
  const voice=t.type==='audio'&&!isInstru(t);
  T.append(h('button',{class:'mtl mcur',onclick:()=>mobTrackSheet(t)},h('i',{style:{background:t.color}}),h('span',null,t.name)),
    voice&&mB('mtl','✨ Effets',()=>mobFxSheet(t)),
    voice&&h('button',{class:'mtl'+(t.mon?' on':''),onclick:async()=>{audioUnlock();await toggleMon(t);mobSched()}},'🎧 Retour'),
    mB('mtl','🎚 Réglages',()=>mobTrackSheet(t)))}

// ---------- gestes sur les pistes ----------
function mobBindLanes(){const I=$('#mInner'),S=$('#mScroll');let d=null;
  const beatAt=x=>Math.max(0,(x-S.getBoundingClientRect().left+S.scrollLeft-MHW-MPAD)/PPB),snap=b=>Math.round(b*4)/4;
  // règle : toucher / glisser = déplacer la barre de lecture
  I.addEventListener('pointerdown',e=>{const rb=e.target.closest('.mrulb');if(rb){e.preventDefault();d={mode:'ph'};try{rb.setPointerCapture(e.pointerId)}catch(x){}setPH(snap(beatAt(e.clientX)));return}
    const rg=e.target.closest('.mreg.sel');if(!rg)return;const fr=findRegion(rg.dataset.r);if(!fr)return;const [t,r]=fr;
    const hd=e.target.closest('.mh');d={mode:hd?(hd.classList.contains('l')?'l':'r'):'mv',t,r,el:rg,x0:e.clientX,s0:r.start,o0:r.offset||0,d0:r.dur,l0:r.len,moved:false};
    try{rg.setPointerCapture(e.pointerId)}catch(x){}e.preventDefault()});
  I.addEventListener('pointermove',e=>{if(!d)return;if(d.mode==='ph'){setPH(snap(beatAt(e.clientX)));return}
    const db=(e.clientX-d.x0)/PPB;if(!d.moved){if(Math.abs(e.clientX-d.x0)<5)return;d.moved=true;snapshot()}
    const {t,r}=d,audio=t.type==='audio';
    if(d.mode==='mv')r.start=Math.max(0,snap(d.s0+db));
    else if(d.mode==='r'){if(audio){const max=(BUFS[r.buf]?BUFS[r.buf].duration:1e9)-(r.offset||0);r.dur=clamp(d.d0+db*spb(),.05,max)}else r.len=Math.max(.25,snap(d.l0+db))}
    else if(audio){const ns=clamp(snap(d.s0+db),Math.max(0,d.s0-d.o0/spb()),d.s0+d.d0/spb()-.1),k=(ns-d.s0)*spb();r.start=ns;r.offset=d.o0+k;r.dur=d.d0-k}
    d.el.style.left=MPAD+r.start*PPB+'px';d.el.style.width=Math.max(8,rLen(t,r)*PPB)+'px'});
  const up=()=>{if(d&&d.moved){renderLanes();if(E.playing){const p=E.pos();E.stop();E.play(p)}}d=null};
  I.addEventListener('pointerup',up);I.addEventListener('pointercancel',up);
  I.addEventListener('click',e=>{if(e.target.closest('.mhead,.mrul,button'))return;const rg=e.target.closest('.mreg');
    if(rg){const fr=findRegion(rg.dataset.r);if(!fr)return;if(SELR.has(rg.dataset.r)&&SELR.size===1)return;SELR=new Set([rg.dataset.r]);SEL=fr[0].id;mobSched();return}
    const ln=e.target.closest('.mlane');if(!ln)return;if(SELR.size){SELR.clear();mobSched();return}
    if(ln.dataset.t&&SEL!==ln.dataset.t){SEL=ln.dataset.t;mobSched()}setPH(snap(beatAt(e.clientX)))})}

// ---------- dessin des sons (tuiles visibles) ----------
let mobPaintReq=0;function schedMobPaint(){if(!mobPaintReq)mobPaintReq=requestAnimationFrame(()=>{mobPaintReq=0;mobPaint()})}
function mobPaint(){const S=$('#mScroll');if(!S||!MOB)return;const dpr=Math.min(2,devicePixelRatio||1),x0=S.scrollLeft-300,x1=S.scrollLeft+S.clientWidth+300,ch=MTH-8-14,key=PPB+'|'+dpr+'|'+P.bpm+'|'+MTH;
  S.querySelectorAll('.mreg[data-r]').forEach(el=>{const fr=findRegion(el.dataset.r);if(!fr)return;const [t,r]=fr,tl=el.firstChild,left=MPAD+r.start*PPB,w=Math.max(8,rLen(t,r)*PPB);
    if(tl.dataset.key!==key){tl.innerHTML='';tl.dataset.key=key}
    const a=Math.max(x0,left)-left,b=Math.min(x1,left+w)-left,want=new Set();if(b>a)for(let i=Math.floor(a/TILE);i<=Math.floor((b-1)/TILE);i++)want.add(i);
    for(const c of [...tl.children])if(!want.has(+c.dataset.i))c.remove();const have=new Set([...tl.children].map(c=>+c.dataset.i));
    for(const i of want){if(have.has(i))continue;const cw=Math.min(TILE,w-i*TILE);if(cw<=0)continue;
      const cv=h('canvas',{'data-i':i,width:Math.ceil(cw*dpr),height:Math.ceil(ch*dpr),style:{left:i*TILE+'px',width:cw+'px',height:ch+'px'}});tl.append(cv);
      const th=TH;try{TH=ch+20;drawTile(cv.getContext('2d'),t,r,i*TILE,cw,ch,dpr)}catch(e){}finally{TH=th}}})}

// ---------- enregistrement ----------
async function mobRecord(){audioUnlock();
  if(!REC){let seen=null;try{seen=localStorage.getItem('studio_mob_tip')}catch(e){}
    if(!seen){try{localStorage.setItem('studio_mob_tip','1')}catch(e){}toast('🎧 Mets des écouteurs : sinon le micro enregistre aussi l’instru.',4500)}
    const t=findTrack(SEL);if(t&&t.type==='audio'&&!isInstru(t)){P.tracks.forEach(x=>x.arm=false);t.arm=true}}
  await toggleRecord();mobSched()}

// ---------- boucle d'affichage ----------
function mobTick(once){if(!MOB)return;const S=$('#mScroll'),pos=E.playing?E.pos():PH,ph=$('#mPH');
  const tm=$('#mTime');if(tm){tm.textContent=mfmt(pos);tm.classList.toggle('rec',!!REC)}
  $('#mPlay').textContent=E.playing&&!REC?'⏸':'▶';$('#mRec').classList.toggle('on',!!REC);
  const pk=E.inPeak||0,db=pk>0?20*Math.log10(pk):-80,mm=$('#mMeter');mm.style.visibility=E.mic?'visible':'hidden';mm.firstChild.style.width=clamp((db+60)/60*100,0,100)+'%';mm.firstChild.style.background=db>-3?'#ff3b30':db>-12?'#ffd60a':'#30d158';
  const mc=$('#mCount');if(REC&&E.playing&&pos<REC.start){mc.textContent=Math.max(1,Math.ceil(REC.start-pos));mc.style.display='flex'}else mc.style.display='none';
  if(S&&!MUSER&&(E.playing||Math.abs(S.scrollLeft-Math.max(0,pos)*PPB)>1.5))mobSyncScroll(pos);
  if(REC&&E.recording&&pos>=REC.start){for(const tid of REC.tracks){const ln=S.querySelector('.mlane[data-t="'+tid+'"]');if(!ln)continue;let dv=ln.querySelector('.mlive');
      if(!dv){dv=h('div',{class:'mreg mlive',style:{left:MPAD+REC.start*PPB+'px'}},h('div',{class:'mrt'},'● Enregistrement…'));ln.append(dv)}dv.style.width=Math.max(4,(pos-REC.start)*PPB)+'px'}}
  else if(S)S.querySelectorAll('.mlive').forEach(x=>x.remove());
  if(once!==true)requestAnimationFrame(mobTick)}

// ---------- branchements ----------
{const o=renderHeads;renderHeads=function(){const r=o.apply(this,arguments);mobSched();return r}}
{const o=renderLanes;renderLanes=function(){const r=o.apply(this,arguments);mobSched();return r}}
{const o=renderBar;renderBar=function(){const r=o.apply(this,arguments);mobSched();return r}}
{const o=settingsModal;settingsModal=async function(){const r=await o.apply(this,arguments);const ms=document.querySelectorAll('.modal .box'),b=ms[ms.length-1];
  if(b&&(MOB||IS_TOUCH||isSmall()))b.prepend(h('div',{style:{display:'flex',justifyContent:'flex-end',marginBottom:'6px'}},h('button',{onclick:()=>mobSet(!MOB)},MOB?'🖥 Version ordinateur':'📱 Version téléphone')));return r}}
if(mobWanted()){const go=()=>{if(typeof P==='undefined'||!P||!E||!document.querySelector('#bRec'))return setTimeout(go,50);mobInit()};if(document.readyState==='complete')setTimeout(go,0);else addEventListener('load',()=>setTimeout(go,0))}
{const o=toast;toast=function(m,ms){if(MOB||mobWanted()){if(/tournez l.appareil/i.test(m))return;m=String(m).replace(/Ctrl\+Z pour l.annuler\.?/,'↶ pour annuler.').replace(/Ctrl\+Z/g,'↶')}return o.call(this,m,ms)}}
// ---------- petit tuto « mettre Studio sur l’écran d’accueil » (iPhone, dans Safari) ----------
function mobInstalled(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
function mobInstallTuto(force){
  if(!force){let f=null;try{f=localStorage.getItem('studio_a2hs')}catch(e){}if(f||mobInstalled()||!IOS||location.protocol==='file:')return}
  const off=()=>{try{localStorage.setItem('studio_a2hs','1')}catch(e){}};
  const ios=IOS,and=/Android/.test(navigator.userAgent);
  const st=(n,txt,sub)=>h('div',{class:'mstep'},h('span',{class:'mnum'},n),h('div',null,h('b',{html:txt}),sub&&h('small',{html:sub})));
  const s=mSheet('📲 Sur l’écran d’accueil',h('div',null,
    h('p',{class:'muted',style:{marginTop:0,fontSize:'13px'}},'Studio s’ouvre alors comme une vraie appli : plein écran, plus rapide, et tes projets restent bien rangés.'),
    ios?h('div',null,
      st(1,'Touche le bouton <span class="mk">≡</span> ou <span class="mk">•••</span> dans la barre d’adresse en bas','(sur les anciens iPhone : le bouton Partager <span class="mk">⬆︎</span>)'),
      st(2,'Touche <span class="mk">⬆︎ Partager</span>'),
      st(3,'Fais défiler vers le bas et touche <span class="mk">⊞ Sur l’écran d’accueil</span>','Si tu ne le vois pas : « En voir plus »'),
      st(4,'Touche <span class="mk">Ajouter</span> en haut à droite','Ensuite, ouvre Studio depuis son icône 🎵 sur l’écran d’accueil'))
    :and?h('div',null,st(1,'Touche le menu <span class="mk">⋮</span> de Chrome'),st(2,'Touche <span class="mk">Installer l’application</span>','ou « Ajouter à l’écran d’accueil »'))
    :h('p',null,'Ouvre Studio dans Safari (iPhone) ou Chrome (Android) pour l’installer.'),
    h('div',{class:'mtogs',style:{marginTop:'16px'}},
      h('button',{class:'mtog on',onclick:()=>s.remove()},'OK, compris'))));
  s.querySelector('.mx').addEventListener('click',off);s.addEventListener('pointerdown',e=>{if(e.target===s)off()});off()}
{const o=mobMenuSheet;mobMenuSheet=function(){const r=o.apply(this,arguments);const b=document.querySelector('.msheet .mbody>div');
  if(b&&!mobInstalled())b.prepend(mRow('📲','Mettre sur l’écran d’accueil',()=>mobInstallTuto(true),'Pour l’ouvrir comme une vraie appli'));return r}}
{const o=mobInit;mobInit=function(){const r=o.apply(this,arguments);setTimeout(()=>{if(!document.querySelector('.modal,.msheet'))mobInstallTuto()},1500);return r}}
function mobSyncScroll(pos){const S=$('#mScroll');if(!S)return;const x=Math.max(0,(pos==null?PH:pos))*PPB;if(Math.abs(S.scrollLeft-x)>.5){MPROG=performance.now()+60;S.scrollLeft=x}}
