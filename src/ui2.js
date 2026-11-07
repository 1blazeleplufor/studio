// ===== Interface : arrangement, inspecteur, mixeur =====
const TYPE_ICO={audio:'🎤',synth:'🎹',drums:'🥁'};const tIco=t=>isInstru(t)?'🎵':TYPE_ICO[t.type];
function renderAll(){renderBar();renderHeads();renderLanes();renderInspector();renderBottom()}
function renderBar(){
  $('#bpm').value=P.bpm;$('#keySel').selectedIndex=P.key;$('#scaleSel').selectedIndex=P.scaleIdx;$('#sigSel').value=P.sig;
  $('#bCycle').classList.toggle('on',P.cycle.on);$('#bMetro').classList.toggle('on',!!P.settings.metro);$('#bCount').classList.toggle('on',P.settings.countIn>0);
  $('#bInsp').classList.toggle('on',!$('#main').classList.contains('noinsp'));$('#bTyping').classList.toggle('on',TYPING);$('#snapSel').value=String(P.settings.snap);
  document.title=P.name+' — Studio';
}
function totalBeats(){let m=0;for(const t of P.tracks)for(const r of t.regions)m=Math.max(m,r.start+rLen(t,r));return Math.max(P.sig*48,Math.ceil((m+P.sig*16)/P.sig)*P.sig)}
function renderHeads(){
  const H=$('#heads');H.innerHTML='';
  P.tracks.forEach((t,i)=>{
    const b=(cls,lab,on,fn,tip)=>h('button',{class:cls+(on?' on':''),title:tip,onclick:e=>{e.stopPropagation();fn()}},lab);
    const vol=h('input',{type:'range',min:-60,max:6,step:.5,value:t.vol,title:'Volume',oninput:e=>{t.vol=+e.target.value;E.updateStrip(t);syncFaders(t.id)},onpointerdown:e=>{e.stopPropagation();snapshot()}});
    const name=h('input',{class:'tname',value:t.name,onchange:e=>{snapshot();t.name=e.target.value;renderInspector();if(TAB==='mixer')renderBottom()},onkeydown:e=>{e.stopPropagation();if(e.key==='Enter')e.target.blur()},onpointerdown:e=>e.stopPropagation()});
    const btns=h('div',{class:'msrow',style:{justifyContent:'flex-start'}},
      b('btnM','M',t.mute,()=>{t.mute=!t.mute;E.updateAll();renderHeads();renderInspector();if(TAB==='mixer')renderBottom()},'Muet'),
      b('btnS','S',t.solo,()=>{t.solo=!t.solo;E.updateAll();renderHeads();renderInspector();if(TAB==='mixer')renderBottom()},'Solo'),
      t.type==='audio'&&!isInstru(t)&&b('btnR','R',t.arm,()=>toggleArm(t),'Armer pour enregistrer'),
      t.type==='audio'&&!isInstru(t)&&b('btnI','I',t.mon,()=>toggleMon(t),'Écouter le micro (casque obligatoire)'));
    const d=h('div',{class:'head'+(t.id===SEL?' sel':''),onpointerdown:()=>selectTrack(t.id),oncontextmenu:e=>{e.preventDefault();trackMenu(e,t)}},
      h('div',{class:'col',title:'Changer la couleur',style:{background:t.color,cursor:'pointer'},onpointerdown:e=>{e.stopPropagation();colorPicker(e,t)}}),h('div',{class:'ico'},tIco(t)),
      h('div',{class:'info'},name,btns,vol,h('div',{class:'colrow'},h('button',{class:'swatch',title:'Couleur de la piste',style:{background:t.color},onpointerdown:e=>e.stopPropagation(),onclick:e=>colorPicker(e,t)}),h('span',null,'Couleur'))));
    H.append(d);
  });
  H.append(h('div',{style:{height:'40px',padding:'8px'}},h('button',{onclick:e=>addTrackMenu(e)},'+ Ajouter une piste')));
}
function selectTrack(id){if(SEL===id)return;SEL=id;document.querySelectorAll('.head').forEach((d,i)=>d.classList.toggle('sel',P.tracks[i]&&P.tracks[i].id===id));document.querySelectorAll('.lane').forEach((d,i)=>d.classList.toggle('sel',P.tracks[i]&&P.tracks[i].id===id));renderInspector()}
function dupTrack(t){if(!t)return;snapshot();const c=deep(t);c.id=uid('t');c.name+=' copie';c.regions.forEach(r=>r.id=uid('r'));c.arm=false;c.mon=false;c.solo=false;P.tracks.splice(P.tracks.indexOf(t)+1,0,c);SEL=c.id;E.build(P);renderAll();toast('Piste dupliquée')}
function delTrack(t){if(!t)return;snapshot();E.setMonitor(t,false);const i=P.tracks.indexOf(t);P.tracks.splice(i,1);SEL=(P.tracks[i]||P.tracks[i-1]||{}).id;SELR.clear();closeAllPlugins();E.build(P);renderAll();toast('Piste « '+t.name+' » supprimée — Ctrl+Z pour annuler')}
function trackMenu(e,t){menu(e,['Piste : '+t.name,['Dupliquer la piste  (Maj+D)',()=>dupTrack(t)],
  ['Monter',()=>moveTrack(t,-1)],['Descendre',()=>moveTrack(t,1)],
  ['Changer la couleur…',()=>colorPicker(e,t)],'-',
  ['Supprimer la piste  (Suppr)',()=>delTrack(t)]])}
const PALETTE=['#ff453a','#ff6b4a','#ff9f0a','#ffcc00','#e6c200','#a3d133','#30d158','#30c48d','#40c8e0','#64d2ff','#4a8cff','#0a84ff','#5e5ce6','#7d6bff','#bf5af2','#ff7ac6','#ff375f','#ac8e68','#8e8e93','#d1d1d6'];
function colorPicker(e,t){closeMenu();const m=h('div',{class:'menu',id:'menu',style:{padding:'10px',minWidth:'0'}});
  const set=c=>{snapshot();t.color=c;renderAll()};
  const grid=h('div',{style:{display:'grid',gridTemplateColumns:'repeat(5,28px)',gap:'6px'}});
  for(const c of PALETTE)grid.append(h('div',{class:'swatch big'+(c.toLowerCase()===String(t.color).toLowerCase()?' cur':''),style:{background:c},onclick:()=>{closeMenu();set(c)}}));
  m.append(h('div',{class:'hd',style:{padding:'0 0 6px'}},'Couleur de « '+t.name+' »'),grid,
    h('label',{style:{display:'flex',alignItems:'center',gap:'8px',marginTop:'8px',cursor:'pointer',padding:'0'}},'Couleur perso :',h('input',{type:'color',value:/^#[0-9a-f]{6}$/i.test(t.color)?t.color:'#4a8cff',onchange:ev=>{closeMenu();set(ev.target.value)}})));
  document.body.append(m);const r=m.getBoundingClientRect();m.style.left=Math.min(e.clientX,innerWidth-r.width-6)+'px';m.style.top=Math.min(e.clientY+6,innerHeight-r.height-6)+'px';
  setTimeout(()=>document.addEventListener('pointerdown',closeMenuOut,true),0)}
function moveTrack(t,d){const i=P.tracks.indexOf(t),j=i+d;if(j<0||j>=P.tracks.length)return;snapshot();P.tracks.splice(i,1);P.tracks.splice(j,0,t);renderAll()}
function addTrackMenu(e){menu(e,['Nouvelle piste',['🎤 Voix (micro)',()=>addTrack('audio')],['🎵 Instru (importer un beat)…',importInstruDialog],['🎹 Instrument (synthé, basse 808…)',()=>addTrack('synth')],['🥁 Batterie (step sequencer)',()=>addTrack('drums')],'-',['🎵 Importer une instru (avec détection BPM/tonalité)…',importInstruDialog],['📂 Importer un son (WAV, MP3)…',()=>$('#fileAudio').click()]])}
function addTrack(type){snapshot();const n=P.tracks.filter(t=>t.type===type).length+1;const t=newTrack(type,{audio:'Voix ',synth:'Instrument ',drums:'Batterie '}[type]+n);
  if(type==='drums')t.regions.push({id:uid('r'),start:snapB(PH,P.sig),len:P.sig*4,pat:emptyPat(16),name:'Rythme'});
  if(type==='synth')t.regions.push({id:uid('r'),start:snapB(PH,P.sig),len:P.sig*4,notes:[],name:'MIDI'});
  if(type==='audio')t.role='voice';P.tracks.push(t);SEL=t.id;E.build(P);renderAll()}
// ---- couloirs + régions ----
function renderLanes(){
  document.documentElement.style.setProperty('--th',TH+'px');
  const L=$('#lanes'),W=totalBeats()*PPB;L.innerHTML='';L.style.width=W+'px';L.style.height=(P.tracks.length*TH+40)+'px';
  L.style.backgroundImage=`linear-gradient(to right,rgba(255,255,255,.10) 1px,transparent 1px),linear-gradient(to right,rgba(255,255,255,.035) 1px,transparent 1px)`;
  L.style.backgroundSize=`${PPB*P.sig}px 100%,${PPB}px 100%`;
  P.tracks.forEach(t=>{const ln=h('div',{class:'lane'+(t.id===SEL?' sel':''),'data-t':t.id});for(const r of t.regions)ln.append(regionEl(t,r));L.append(ln)});
  L.append(h('div',{id:'cycleShade'}),h('div',{id:'playhead'}));updateCycleShade();drawRuler();updatePlayhead(PH);paintRegions();
}
function updateCycleShade(){const c=$('#cycleShade');if(!c)return;c.style.display=P.cycle.on?'block':'none';c.style.left=P.cycle.start*PPB+'px';c.style.width=(P.cycle.end-P.cycle.start)*PPB+'px';c.style.height=$('#lanes').style.height}
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;r=Math.round(r*f);g=Math.round(g*f);b=Math.round(b*f);return`rgb(${Math.min(255,r)},${Math.min(255,g)},${Math.min(255,b)})`}
function regionEl(t,r){
  const len=rLen(t,r),w=Math.max(6,len*PPB);
  const e=h('div',{class:'reg'+(SELR.has(r.id)?' sel':''),'data-r':r.id,style:{left:r.start*PPB+'px',width:w+'px',background:shade(t.color,.62),opacity:r.mute?.35:1}},
    h('div',{class:'tiles'}),h('div',{class:'rt'},(r.mute?'🔇 ':'')+(r.name||'')),h('div',{class:'eh l'}),h('div',{class:'eh r'}));
  return e;
}
// ---- rendu net (haute définition) par tuiles visibles ----
const TILE=1024;let paintReq=0;
function schedulePaint(){if(!paintReq)paintReq=requestAnimationFrame(()=>{paintReq=0;paintRegions()})}
function paintRegions(){
  const W=$('#lanesWrap');if(!W)return;const dpr=Math.min(3,window.devicePixelRatio||1),x0=W.scrollLeft-400,x1=W.scrollLeft+W.clientWidth+400,y0=W.scrollTop-TH,y1=W.scrollTop+W.clientHeight+TH;
  const map={};P.tracks.forEach((t,i)=>{for(const r of t.regions)map[r.id]=[t,r,i]});
  document.querySelectorAll('#lanes .reg[data-r]').forEach(el=>{const m=map[el.dataset.r];if(!m)return;const [t,r,ti]=m,tl=el.querySelector('.tiles');if(!tl)return;
    const left=r.start*PPB,w=Math.max(6,rLen(t,r)*PPB),vis=ti*TH<y1&&ti*TH+TH>y0;
    const a=Math.max(x0,left)-left,b=Math.min(x1,left+w)-left,key=PPB+'|'+TH+'|'+dpr+'|'+P.bpm;
    if(tl.dataset.key!==key){tl.innerHTML='';tl.dataset.key=key}
    const want=new Set();if(vis&&b>a)for(let i=Math.floor(a/TILE);i<=Math.floor((b-1)/TILE);i++)want.add(i);
    for(const c of [...tl.children])if(!want.has(+c.dataset.i))c.remove();
    const have=new Set([...tl.children].map(c=>+c.dataset.i));
    for(const i of want){if(have.has(i))continue;const cw=Math.min(TILE,w-i*TILE),ch=TH-4-16;if(cw<=0)continue;
      const cv=h('canvas',{'data-i':i,width:Math.ceil(cw*dpr),height:Math.ceil(ch*dpr),style:{left:i*TILE+'px',width:cw+'px',height:ch+'px'}});tl.append(cv);drawTile(cv.getContext('2d'),t,r,i*TILE,cw,ch,dpr)}
  });
}
function drawTile(g,t,r,xo,cw,ch,dpr){
  const W=Math.ceil(cw*dpr),H=Math.ceil(ch*dpr),col=shade(t.color,1.4);g.fillStyle=col;g.strokeStyle=col;
  if(t.type==='audio'){const buf=BUFS[r.buf];if(!buf)return;const pk=getPeaks(r.buf),sr=buf.sampleRate,secPx=spb()/PPB/dpr,spp=secPx*sr,mid=H/2,amp=(r.gain!=null?dbToG(r.gain):1)*mid*.96;
    const chs=[];for(let c=0;c<Math.min(2,buf.numberOfChannels);c++)chs.push(buf.getChannelData(c));const N=buf.length;
    const s0=(r.offset+xo/PPB*spb())*sr;
    g.fillStyle='rgba(0,0,0,.18)';g.fillRect(0,Math.round(mid),W,1);g.fillStyle=col;
    if(spp>=1.2){for(let x=0;x<W;x++){const a=s0+x*spp,b=a+spp;let lo=0,hi=0;
        if(spp>=pk.B){for(let i=Math.floor(a/pk.B),e=Math.min(pk.mn.length,Math.ceil(b/pk.B));i<e;i++){if(pk.mn[i]<lo)lo=pk.mn[i];if(pk.mx[i]>hi)hi=pk.mx[i]}}
        else{for(let j=Math.max(0,Math.floor(a)),e=Math.min(N,Math.ceil(b));j<e;j++)for(const d of chs){const v=d[j];if(v<lo)lo=v;if(v>hi)hi=v}}
        const y0=mid-hi*amp,y1=mid-lo*amp;g.fillRect(x,y0,1,Math.max(1,y1-y0))}}
    else{ // zoom extrême : courbe échantillon par échantillon
      g.lineWidth=Math.max(1,dpr);g.beginPath();const smp=j=>{let v=0;for(const d of chs)v+=d[j]||0;return v/chs.length};
      const j0=Math.max(0,Math.floor(s0)-1),j1=Math.min(N-1,Math.ceil(s0+W*spp)+1);
      for(let j=j0;j<=j1;j++){const x=(j-s0)/spp,y=mid-smp(j)*amp;j===j0?g.moveTo(x,y):g.lineTo(x,y)}g.stroke();
      if(spp<.15)for(let j=j0;j<=j1;j++){const x=(j-s0)/spp,y=mid-smp(j)*amp;g.fillRect(x-1.5*dpr,y-1.5*dpr,3*dpr,3*dpr)}}
    g.fillStyle='rgba(0,0,0,.35)';const fpx=sec=>sec/spb()*PPB*dpr,X0=xo*dpr,totW=rLen(t,r)*PPB*dpr;
    if(r.fi>0){const fw=fpx(r.fi);g.beginPath();g.moveTo(-X0,0);g.lineTo(fw-X0,0);g.lineTo(-X0,H);g.fill()}
    if(r.fo>0){const fw=fpx(r.fo),e=totW-X0;g.beginPath();g.moveTo(e,0);g.lineTo(e-fw,0);g.lineTo(e,H);g.fill()}}
  else if(t.type==='synth'){if(!r.notes.length)return;let lo=127,hi=0;for(const n of r.notes){lo=Math.min(lo,n.p);hi=Math.max(hi,n.p)}lo-=2;hi+=2;const rh=Math.max(2*dpr,Math.min(8*dpr,H/(hi-lo+1)));
    for(const n of r.notes){if(n.s>=r.len||n.s<0)continue;const x=(n.s*PPB-xo)*dpr,wd=Math.max(2*dpr,Math.min(n.l,r.len-n.s)*PPB*dpr-dpr);if(x+wd<0||x>W)continue;const y=(hi-n.p)/(hi-lo)*(H-rh);
      g.beginPath();g.roundRect?g.roundRect(x,y,wd,rh,Math.min(2*dpr,rh/2)):g.rect(x,y,wd,rh);g.fill()}}
  else if(t.type==='drums'){const pat=r.pat,N=pat.steps,rh=H/DRUM_ROWS.length,sw=.25*PPB*dpr,k0=Math.max(0,Math.floor(xo/(.25*PPB))-1);
    for(let k=k0;k*.25<r.len;k++){const x=(k*.25*PPB-xo)*dpr;if(x>W)break;const si=(k+(r.phase||0))%N;DRUM_ROWS.forEach(([row],ri)=>{const c=pat.rows[row][si];if(c){g.globalAlpha=.45+.55*(c.v||.8);g.fillRect(x+dpr,ri*rh+dpr,Math.max(dpr,sw-2*dpr),Math.max(dpr,rh-2*dpr))}})}
    g.globalAlpha=1;g.fillStyle='rgba(0,0,0,.3)';const pl=N*.25;for(let b=pl;b<r.len;b+=pl){const x=(b*PPB-xo)*dpr;if(x>=0&&x<=W)g.fillRect(x,0,dpr,H)}}
}
function updatePlayhead(b){const p=$('#playhead');if(p){p.style.left=b*PPB+'px';p.style.height=$('#lanes').style.height}}
function drawRuler(){
  const R=$('#ruler'),cv=$('#rulerCv'),w=R.clientWidth,hh=28,sl=$('#lanesWrap').scrollLeft,dp=window.devicePixelRatio||1;if(cv.width!==Math.round(w*dp)){cv.width=Math.round(w*dp);cv.height=Math.round(hh*dp);cv.style.width=w+'px';cv.style.height=hh+'px'}
  const g=cv.getContext('2d');g.setTransform(dp,0,0,dp,0,0);g.clearRect(0,0,w,hh);
  if(P.cycle.on||P.cycle.end>P.cycle.start){g.fillStyle=P.cycle.on?'rgba(255,214,10,.75)':'rgba(255,214,10,.2)';g.fillRect(P.cycle.start*PPB-sl,0,(P.cycle.end-P.cycle.start)*PPB,10)}
  g.fillStyle='#bbb';g.font='10px sans-serif';const bar=PPB*P.sig,stepBars=bar<14?8:bar<28?4:bar<50?2:1;
  for(let b=Math.floor(sl/bar);b*bar<sl+w;b++){const x=b*bar-sl;g.fillStyle='#666';g.fillRect(x,b%stepBars?20:12,1,hh);if(b%stepBars===0){g.fillStyle='#ccc';g.fillText(b+1,x+3,22)}
    if(bar>60)for(let q=1;q<P.sig;q++){g.fillStyle='#55555a';g.fillRect(x+q*PPB,21,1,7);if(PPB>55){g.fillStyle='#8a8a90';g.fillText((b+1)+'.'+(q+1),x+q*PPB+3,22)}}
    if(PPB>110)for(let q=0;q<P.sig*4;q++){if(q%4===0)continue;g.fillStyle='#3e3e42';g.fillRect(x+q*PPB/4,24,1,4)}}
  const px=(typeof SCRUB!=='undefined'&&SCRUB!=null?SCRUB:E&&E.playing?E.pos():PH)*PPB-sl;g.fillStyle='#fff';g.beginPath();g.moveTo(px-5,12);g.lineTo(px+5,12);g.lineTo(px,20);g.fill();
}
function lanesPointer(){
  const L=$('#lanes');let drag=null;
  let lastTap=null;
  L.addEventListener('pointerdown',e=>{
    if(e.button===2)return;closeMenu();
    if(e.pointerType!=='mouse'){const now=Date.now();if(lastTap&&now-lastTap.t<350&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<30){lastTap=null;laneDbl(e.clientX,e.clientY);return}lastTap={t:now,x:e.clientX,y:e.clientY}}const reg=e.target.closest('.reg'),lane=e.target.closest('.lane');
    if(lane)selectTrack(lane.dataset.t);
    if(!reg){if(!e.shiftKey&&SELR.size){SELR.clear();document.querySelectorAll('.reg.sel').forEach(x=>x.classList.remove('sel'));renderInspector()}
      if(e.pointerType==='mouse'){const rect=L.getBoundingClientRect();drag={mode:'box',x0:e.clientX-rect.left,y0:e.clientY-rect.top,base:e.shiftKey?new Set(SELR):new Set()};L.setPointerCapture(e.pointerId)}else drag={mode:'none'};return}
    const id=reg.dataset.r;if(e.shiftKey){SELR.has(id)?SELR.delete(id):SELR.add(id)}else if(!SELR.has(id)){SELR=new Set([id])}
    document.querySelectorAll('.reg').forEach(x=>x.classList.toggle('sel',SELR.has(x.dataset.r)));
    const [t,r]=findRegion(id);openEditorFor(t,r,false);if(t.type==='audio')renderInspector();
    const mode=e.target.classList.contains('eh')?(e.target.classList.contains('l')?'l':'r'):'move';
    drag={mode,id,x0:e.clientX,y0:e.clientY,moved:false,alt:e.altKey,orig:[...SELR].map(i=>{const [tt,rr]=findRegion(i);return{t:tt,r:rr,o:deep(rr)}}),track:t};
    L.setPointerCapture(e.pointerId);
  });
  L.addEventListener('pointermove',e=>{
    if(!drag||drag.mode==='none')return;
    if(drag.mode==='box'){const rect=L.getBoundingClientRect(),x1=e.clientX-rect.left,y1=e.clientY-rect.top;let bx=$('#marquee');if(!bx){bx=h('div',{id:'marquee'});L.append(bx)}
      const ax=Math.min(drag.x0,x1),ay=Math.min(drag.y0,y1),w=Math.abs(x1-drag.x0),hh=Math.abs(y1-drag.y0);Object.assign(bx.style,{left:ax+'px',top:ay+'px',width:w+'px',height:hh+'px'});
      SELR=new Set(drag.base);P.tracks.forEach((t,i)=>{if(i*TH+TH<ay||i*TH>ay+hh)return;for(const r of t.regions){const rx=r.start*PPB,rw=rLen(t,r)*PPB;if(rx+rw>ax&&rx<ax+w)SELR.add(r.id)}});
      document.querySelectorAll('.reg').forEach(x=>x.classList.toggle('sel',SELR.has(x.dataset.r)));return}
    const dx=(e.clientX-drag.x0)/PPB;
    if(!drag.moved){if(Math.abs(e.clientX-drag.x0)<3&&Math.abs(e.clientY-drag.y0)<3)return;drag.moved=true;snapshot();
      if(drag.alt&&drag.mode==='move'){for(const o of drag.orig){const c=deep(o.o);c.id=uid('r');o.t.regions.push(c);}}}
    const prim=drag.orig.find(o=>o.r.id===drag.id)||drag.orig[0];
    if(drag.mode==='move'){const ns=Math.max(0,snapB(prim.o.start+dx)),d=ns-prim.o.start;
      for(const o of drag.orig){o.r.start=Math.max(0,o.o.start+d);const el=document.querySelector(`.reg[data-r="${o.r.id}"]`);if(el)el.style.left=o.r.start*PPB+'px'}
      if(drag.orig.length===1){const rect=L.getBoundingClientRect(),ti=Math.floor((e.clientY-rect.top)/TH),nt=P.tracks[ti];
        if(nt&&nt!==prim.t&&nt.type===prim.t.type){prim.t.regions.splice(prim.t.regions.indexOf(prim.r),1);nt.regions.push(prim.r);prim.t=nt;selectTrack(nt.id);renderLanes()}}}
    else{const o=prim,r=o.r,t=o.t,sp=spb();
      if(drag.mode==='r'){const end=snapB(o.o.start+rLen(t,o.o)+dx);let nl=Math.max(.25,end-r.start);
        if(t.type==='audio'){r.dur=Math.min(nl*sp,BUFS[r.buf].duration-r.offset)}else r.len=nl}
      else{let ns=snapB(o.o.start+dx);const endB=o.o.start+rLen(t,o.o);ns=Math.min(ns,endB-.25);
        if(t.type==='audio'){ns=Math.max(ns,o.o.start-o.o.offset/sp,0);const d=ns-o.o.start;r.start=ns;r.offset=o.o.offset+d*sp;r.dur=o.o.dur-d*sp}
        else{ns=Math.max(0,ns);const d=ns-o.o.start;r.start=ns;r.len=o.o.len-d;if(t.type==='synth')r.notes=o.o.notes.map(n=>Object.assign({},n,{s:n.s-d}));else r.phase=((o.o.phase||0)+Math.round(d/.25)%r.pat.steps+r.pat.steps*64)%r.pat.steps}}
      const el=document.querySelector(`.reg[data-r="${r.id}"]`);if(el){el.style.left=r.start*PPB+'px';el.style.width=rLen(t,r)*PPB+'px'}}
  });
  L.addEventListener('pointerup',()=>{const mq=$('#marquee');if(mq)mq.remove();if(drag&&drag.mode==='box'){drag=null;renderInspector();return}if(drag&&drag.moved){renderLanes();if(TAB==='piano'||TAB==='steps')renderBottom()}drag=null});
  L.addEventListener('dblclick',e=>laneDbl(e.clientX,e.clientY));
  function laneDbl(cx,cy){
    const tgt=document.elementFromPoint(cx,cy);if(!tgt)return;const reg=tgt.closest('.reg'),lane=tgt.closest('.lane');
    if(reg){const [t,r]=findRegion(reg.dataset.r);if(t.type==='audio')renameRegion(r);else openEditorFor(t,r,true);return}
    if(!lane)return;const t=findTrack(lane.dataset.t);if(t.type==='audio')return;
    const x=cx-L.getBoundingClientRect().left,st=Math.floor(x/PPB/P.sig)*P.sig;snapshot();
    const r=t.type==='synth'?{id:uid('r'),start:st,len:P.sig*4,notes:[],name:'MIDI'}:{id:uid('r'),start:st,len:P.sig*4,pat:emptyPat(16),name:'Rythme'};
    t.regions.push(r);SELR=new Set([r.id]);renderLanes();openEditorFor(t,r,true);
  }
  L.addEventListener('contextmenu',e=>{const reg=e.target.closest('.reg');if(!reg)return;e.preventDefault();const [t,r]=findRegion(reg.dataset.r);if(!SELR.has(r.id)){SELR=new Set([r.id]);renderLanes()}
    menu(e,['Région : '+(r.name||''),['Renommer',()=>renameRegion(r)],['Dupliquer (Ctrl+D)',dupRegions],['Couper à la tête de lecture (Ctrl+T)',splitAtPH],['Rendre muette / réactiver (Ctrl+M)',muteRegions],['Copier (Ctrl+C)',copyRegions],['Couper (Ctrl+X)',()=>{copyRegions();deleteRegions()}],
      t.type==='audio'&&['Gain de la région…',()=>{const v=prompt('Gain en dB (ex : -3 ou 4)',r.gain||0);if(v!==null&&!isNaN(+v)){snapshot();r.gain=clamp(+v,-24,18);renderLanes()}}],
      t.type==='audio'&&['Normaliser',()=>{snapshot();const pk=getPeaks(r.buf);let m=0;for(let i=0;i<pk.mx.length;i++)m=Math.max(m,pk.mx[i],-pk.mn[i]);if(m>0)r.gain=20*Math.log10(.89/m);renderLanes()}],
      t.type==='audio'&&['Inverser (reverse)',()=>{snapshot();const b=BUFS[r.buf],nb=ctx.createBuffer(b.numberOfChannels,b.length,b.sampleRate);for(let c=0;c<b.numberOfChannels;c++){const s=b.getChannelData(c),d=nb.getChannelData(c);for(let i=0;i<s.length;i++)d[i]=s[s.length-1-i]}r.buf=addBuffer(nb);r.offset=Math.max(0,b.duration-r.offset-r.dur);renderLanes()}],
      t.type==='synth'&&['Ouvrir le Piano Roll',()=>openEditorFor(t,r,true)],t.type==='drums'&&['Ouvrir le Step Sequencer',()=>openEditorFor(t,r,true)],
      '-',['Supprimer',deleteRegions]].filter(Boolean))});
}
function renameRegion(r){const n=prompt('Nom de la région',r.name||'');if(n!==null){snapshot();r.name=n;renderLanes()}}
function deleteRegions(){if(!SELR.size)return;snapshot();for(const t of P.tracks)t.regions=t.regions.filter(r=>!SELR.has(r.id));SELR.clear();renderLanes();renderBottom()}
function dupRegions(){if(!SELR.size)return;snapshot();const items=[...SELR].map(findRegion).filter(Boolean);let a=1e9,b=0;for(const [t,r] of items){a=Math.min(a,r.start);b=Math.max(b,r.start+rLen(t,r))}
  const span=Math.ceil((b-a)/P.sig-1e-6)*P.sig||P.sig,ns=new Set();for(const [t,r] of items){const c=deep(r);c.id=uid('r');c.start=r.start+span;t.regions.push(c);ns.add(c.id)}SELR=ns;renderLanes()}
function splitAtPH(){const x=PH;let items=[...SELR].map(findRegion).filter(Boolean);if(!items.length){const t=findTrack(SEL);if(t)items=t.regions.filter(r=>r.start<x&&r.start+rLen(t,r)>x).map(r=>[t,r])}
  items=items.filter(([t,r])=>r.start<x-1e-6&&r.start+rLen(t,r)>x+1e-6);if(!items.length)return toast('Placez la tête de lecture sur une région');snapshot();
  for(const [t,r] of items){const d=x-r.start,c=deep(r);c.id=uid('r');c.start=x;
    if(t.type==='audio'){r.dur=d*spb();c.offset=r.offset+d*spb();c.dur-=d*spb()}
    else if(t.type==='synth'){r.len=d;c.len-=d;r.notes=r.notes.filter(n=>n.s<d);c.notes=c.notes.filter(n=>n.s>=d).map(n=>(n.s-=d,n))}
    else{r.len=d;c.len-=d;c.phase=((r.phase||0)+Math.round(d/.25))%r.pat.steps}
    t.regions.push(c)}renderLanes()}
function carve(t,a,b){ // efface la zone [a,b) des régions audio existantes (ré-enregistrement)
  const out=[],sp=spb();for(const r of t.regions){const s=r.start,e=s+r.dur/sp;if(e<=a||s>=b){out.push(r);continue}
    if(s<a){const c=deep(r);c.dur=(a-s)*sp;out.push(c)}if(e>b){const c=deep(r);c.id=uid('r');c.start=b;c.offset=r.offset+(b-s)*sp;c.dur=(e-b)*sp;out.push(c)}}t.regions=out}
// ---- inspecteur ----
function renderInspector(){
  const I=$('#insp');I.innerHTML='';const t=findTrack(SEL);if(!t){I.append(h('div',{class:'sec'},'Aucune piste'));return}
  I.append(h('h3',{style:{borderTop:'none'}},tIco(t)+' '+t.name));
  const lib=h('div',{class:'lib'});
  if(t.type==='audio'){let cat='';for(const n in VOCAL_PRESETS){const c=VOCAL_PRESETS[n].cat;if(c!==cat){cat=c;lib.append(h('b',{style:{fontSize:'10px',color:'var(--dim)',textTransform:'uppercase',margin:'6px 0 2px'}},c))}lib.append(h('div',{onclick:()=>applyVocalPreset(t,n),style:t.preset===n?{background:'#2b6fd6'}:null},n))}}
  if(t.type==='synth')for(const n in SYNTH_PRESETS)lib.append(h('div',{onclick:()=>{snapshot();t.instr=deep(SYNTH_PRESETS[n]);t.preset=n;renderInspector();refreshInstrWin(t);toast(n)},style:t.preset===n?{background:'#2b6fd6'}:null},n));
  if(t.type==='drums')for(const n in DRUM_KITS)lib.append(h('div',{onclick:()=>{snapshot();t.instr=deep(DRUM_KITS[n]);t.kit=n;renderInspector();refreshInstrWin(t);toast('Kit '+n)},style:t.kit===n?{background:'#2b6fd6'}:null},n));
  const voice=t.type==='audio'&&!isInstru(t);
  const selA=[...SELR].map(findRegion).filter(x=>x&&x[0]===t&&t.type==='audio');
  if(selA.length===1)I.append(...isec('region',isInstru(t)?'🎵 Atelier instru':'✂ Région sélectionnée',regionTools(t,selA[0][1])));
  else if(isInstru(t)&&t.regions.length)I.append(...isec('region','🎵 Atelier instru',h('div',{class:'sec',style:{color:'var(--dim)',fontSize:'11px'}},'Cliquez sur la région de l’instru pour la retravailler : tempo, transposition, karaoké, fondus…')));
  if(voice)I.append(...isec('quick','⚡ Réglages rapides',quickControls(t)));
  if(t.type!=='audio'||voice)I.append(...isec('lib',voice?'🎙 Préréglages voix (1 clic)':t.type==='synth'?'🎹 Sons d’instrument':'🥁 Kits de batterie',h('div',{class:'sec'},lib)));
  I.append(...isec('strip','🎚 Tranche de console',h('div',{class:'strips'},buildStrip(t,true),buildStrip(P.master,true))));
  if(voice)I.append(...isec('rec','🎤 Enregistrement',h('div',{class:'sec'},
    h('div',{class:'kv2'},'Niveau micro',h('div',{class:'meter',style:{width:'120px',height:'10px'}},h('i',{id:'inMeter',style:{height:'100%',width:'0%',right:'auto'}}))),
    h('div',{style:{color:'var(--dim)',fontSize:'11px',lineHeight:1.4}},'R = armer la piste, puis ⏺ (ou touche R). Mettez un casque pour éviter le larsen. Le réglage du micro et de la latence est dans ⚙.'))));
}
let COLLAPSED=new Set();try{COLLAPSED=new Set(JSON.parse(localStorage.getItem('studio_fold')||'[]'))}catch(e){}
function isec(key,title,content){const closed=COLLAPSED.has(key);
  const hd=h('h3',{class:'fold',onclick:()=>{COLLAPSED.has(key)?COLLAPSED.delete(key):COLLAPSED.add(key);try{localStorage.setItem('studio_fold',JSON.stringify([...COLLAPSED]))}catch(e){}renderInspector()}},h('span',{class:'arr'},closed?'▸':'▾'),' '+title);
  return closed?[hd]:[hd,content]}
function buildStrip(o,inInsp){
  const isT=P.tracks.includes(o),isMaster=o.id==='master',col=o.color||'#666';
  const s=h('div',{class:'strip'+(isMaster?' master':'')});
  s.append(h('div',{class:'nm',style:{background:shade(col,.5)},title:o.name},o.name));
  if(isT&&o.type!=='audio')s.append(h('div',{class:'slot full',style:{background:'linear-gradient(#3d8f5a,#2c6b43)'},onclick:()=>openInstr(o)},h('span',null,o.type==='synth'?'🎹 '+(o.preset||'Synthé'):'🥁 '+(o.kit||'Kit'))));
  (o.plugins||[]).forEach((pl,i)=>{const def=PLUGINS[pl.type];
    s.append(h('div',{class:'slot full'+(pl.byp?' byp':''),title:def?def.name:pl.type,onclick:()=>openPlugin(o,i),oncontextmenu:e=>{e.preventDefault();slotMenu(e,o,i)}},
      h('span',{class:'pw',title:'Activer / contourner',onclick:e=>{e.stopPropagation();snapshot();pl.byp=!pl.byp;E.updateStrip(o);rerenderStrips()}}),
      h('span',null,def?(pl.type==='bridge'?'🔌 '+(pl.params.name||'Plugin'):def.name):'⚠ '+pl.type)))});
  s.append(h('div',{class:'slot empty',title:'Ajouter un effet',onclick:e=>pluginMenu(e,o)},'+ effet'));
  if(o.sends&&P.auxes.length){const sd=h('div',{style:{display:'flex',justifyContent:'space-around'}});P.auxes.forEach((a,i)=>sd.append(knob({n:a.name.replace('Bus ',''),min:-60,max:6,def:-60,u:'dB'},()=>o.sends[i]??-60,v=>{o.sends[i]=v;E.updateStrip(o)},{size:28,key:'snd|'+o.id+'|'+i,color:'#9f7bff'})));s.append(sd)}
  if(!isMaster)s.append(h('div',{style:{display:'flex',justifyContent:'center'}},knob({n:'Pan',min:-1,max:1,def:0},()=>o.pan||0,v=>{o.pan=v;E.updateStrip(o)},{size:30,key:'pan|'+o.id})));
  const db=h('div',{class:'db'},o.vol<=-60?'-∞':o.vol.toFixed(1)+' dB');
  const f=h('input',{type:'range',class:'fader','data-id':o.id,min:-60,max:6,step:.1,value:o.vol,oninput:e=>{o.vol=+e.target.value;E.updateStrip(o);syncFaders(o.id)},onpointerdown:()=>snapshot(),ondblclick:()=>{o.vol=0;E.updateStrip(o);syncFaders(o.id)},oncontextmenu:e=>{e.preventDefault();learnMenu(e,'v|'+o.id,s)}});
  s.append(h('div',{class:'fadwrap'},f,h('div',{class:'meter'},h('i',{'data-id':o.id,style:{height:'0%'}}))),db);
  if(!isMaster){const ms=h('div',{class:'msrow'});
    ms.append(h('button',{class:'btnM'+(o.mute?' on':''),onclick:()=>{o.mute=!o.mute;E.updateAll();renderHeads();rerenderStrips()}},'M'));
    if(isT)ms.append(h('button',{class:'btnS'+(o.solo?' on':''),onclick:()=>{o.solo=!o.solo;E.updateAll();renderHeads();rerenderStrips()}},'S'));
    if(isT&&o.type==='audio'&&!isInstru(o))ms.append(h('button',{class:'btnR'+(o.arm?' on':''),onclick:()=>toggleArm(o)},'R'));
    s.append(ms)}
  return s;
}
function rerenderStrips(){renderInspector();if(TAB==='mixer')renderBottom()}
function slotMenu(e,o,i){menu(e,[['Ouvrir',()=>openPlugin(o,i)],['Monter',()=>{if(i>0){snapshot();const p=o.plugins.splice(i,1)[0];o.plugins.splice(i-1,0,p);closeAllPlugins();E.updateStrip(o);rerenderStrips()}}],
  ['Descendre',()=>{if(i<o.plugins.length-1){snapshot();const p=o.plugins.splice(i,1)[0];o.plugins.splice(i+1,0,p);closeAllPlugins();E.updateStrip(o);rerenderStrips()}}],
  ['Remplacer…',()=>pluginMenu(e,o,i)],'-',['Retirer l’effet',()=>{snapshot();closeAllPlugins();o.plugins.splice(i,1);E.updateStrip(o);rerenderStrips()}]])}
function pluginMenu(e,o,replaceIdx){
  const cats={};for(const id in PLUGINS){const p=PLUGINS[id];if(p.hideInMenu)continue;(cats[p.cat]=cats[p.cat]||[]).push([id,p.name])}
  const items=[['🔌 Bibliothèque (plugins de l’ordinateur…)',()=>{LIB_TARGET=o.id;toggleLibrary(true)}],'-'];for(const c in cats){items.push(c);for(const [id,n] of cats[c])items.push([n,()=>{snapshot();const pl=plug(id);if(replaceIdx!=null){closeAllPlugins();o.plugins[replaceIdx]=pl}else o.plugins.push(pl);E.updateStrip(o);rerenderStrips();openPlugin(o,replaceIdx!=null?replaceIdx:o.plugins.length-1)}])}
  items.push('-',['📂 Charger un plugin externe (.js)…',()=>$('#filePlug').click()]);menu(e,items);
}
function renderMixer(C){
  const M=h('div',{id:'mixer'});for(const t of P.tracks)M.append(buildStrip(t));
  M.append(h('div',{style:{width:'8px',flex:'none'}}));for(const a of P.auxes)M.append(buildStrip(a));M.append(buildStrip(P.master));C.append(M);
}
