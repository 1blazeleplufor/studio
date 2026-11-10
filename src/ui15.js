// ===== v3.8 : outils voix — fondus enchaînés, égaliser les prises, égaliseur visuel, assistant voix,
// volume régulier, nettoyage respirations/bruit, mastering 1 clic, comparaison A/B =====

// ---------- analyse : FFT, niveaux ----------
function fftTables(n){const c=fftTables.c||(fftTables.c={});if(c[n])return c[n];const rev=new Uint32Array(n),b=Math.log2(n);for(let i=0;i<n;i++){let r=0;for(let j=0;j<b;j++)r=(r<<1)|((i>>j)&1);rev[i]=r}
  const cs=new Float32Array(n/2),sn=new Float32Array(n/2);for(let i=0;i<n/2;i++){cs[i]=Math.cos(2*Math.PI*i/n);sn[i]=-Math.sin(2*Math.PI*i/n)}const win=new Float32Array(n);for(let i=0;i<n;i++)win[i]=.5-.5*Math.cos(2*Math.PI*i/(n-1));return c[n]={rev,cs,sn,win}}
// puissance du spectre d'une trame (fenêtre de Hann), renvoie Float32Array(n/2)
function powerSpec(x,o,n,re,im,out){const {rev,cs,sn,win}=fftTables(n);for(let i=0;i<n;i++){const j=rev[i];re[j]=(x[o+i]||0)*win[i];im[j]=0}
  for(let s=2;s<=n;s<<=1){const h2=s>>1,st=n/s;for(let i=0;i<n;i+=s)for(let k=0;k<h2;k++){const w=k*st,a=i+k,b=a+h2,tr=re[b]*cs[w]-im[b]*sn[w],ti=re[b]*sn[w]+im[b]*cs[w];re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti}}
  for(let k=0;k<n/2;k++)out[k]=re[k]*re[k]+im[k]*im[k];return out}
const dB=v=>10*Math.log10(v+1e-12),dBa=v=>20*Math.log10(Math.abs(v)+1e-9);
function monoOf(buf,from,len){const a=Math.max(0,Math.floor(from)),n=Math.max(0,Math.min(buf.length-a,Math.floor(len))),o=new Float32Array(n),C=buf.numberOfChannels;
  for(let c=0;c<C;c++){const d=buf.getChannelData(c);for(let i=0;i<n;i++)o[i]+=d[a+i]/C}return o}
const pct=(arr,p)=>{if(!arr.length)return -120;const s=Float32Array.from(arr).sort();return s[Math.min(s.length-1,Math.max(0,Math.floor(p*(s.length-1))))]};
// spectre moyen d'une prise (trames actives seulement) dans des bandes données
function regionSpectrum(r,bands,maxFrames=500){const buf=BUFS[r.buf];if(!buf)return null;const sr=buf.sampleRate,n=2048,x=monoOf(buf,r.offset*sr,r.dur*sr);
  const nf=Math.floor((x.length-n)/n);if(nf<1)return null;const step=Math.max(1,Math.floor(nf/maxFrames)),lv=[],frames=[];
  for(let f=0;f<nf;f+=step){let e=0;for(let i=0;i<n;i++){const v=x[f*n+i];e+=v*v}lv.push(dB(e/n));frames.push(f*n)}
  const top=pct(lv,.95),gate=Math.max(-50,top-30),re=new Float32Array(n),im=new Float32Array(n),ps=new Float32Array(n/2),acc=new Float64Array(bands.length);let used=0;
  for(let k=0;k<frames.length;k++){if(lv[k]<gate)continue;powerSpec(x,frames[k],n,re,im,ps);used++;
    bands.forEach(([lo,hi],bi)=>{const a=Math.max(1,Math.round(lo/sr*n)),b=Math.min(n/2-1,Math.round(hi/sr*n));let e=0;for(let i=a;i<=b;i++)e+=ps[i];acc[bi]+=e/(b-a+1)})}
  if(!used)return null;return Array.from(acc,v=>dB(v/used))}
// niveau perçu approximatif (blocs de 400 ms, porte absolue et relative, pondération grossière)
function loudnessOf(x,sr){const B=Math.round(.4*sr),hop=Math.round(.1*sr),bl=[];
  // pondération K simplifiée : passe-haut 1er ordre ~ 60 Hz + petit renfort des aigus
  const k=Math.exp(-2*Math.PI*60/sr);let py=0,px=0;const y=new Float32Array(x.length);for(let i=0;i<x.length;i++){py=k*(py+x[i]-px);px=x[i];y[i]=py}
  for(let s=0;s+B<=y.length;s+=hop){let e=0;for(let i=s;i<s+B;i++)e+=y[i]*y[i];bl.push(e/B)}
  if(!bl.length){let e=0;for(const v of y)e+=v*v;return dB(e/Math.max(1,y.length))}
  let g=bl.filter(v=>dB(v)>-70);if(!g.length)return -70;const m=g.reduce((a,b)=>a+b,0)/g.length;g=g.filter(v=>dB(v)>dB(m)-10);return dB(g.reduce((a,b)=>a+b,0)/g.length)}
function regionLoudness(r){const buf=BUFS[r.buf];if(!buf)return null;const sr=buf.sampleRate;return loudnessOf(monoOf(buf,r.offset*sr,r.dur*sr),sr)}

// ---------- quelles prises ? (sélection, sinon toute la piste) ----------
function targetRegions(t){const sel=[...SELR].map(findRegion).filter(x=>x&&x[0].type==='audio'&&!isInstru(x[0])).map(x=>x[1]);
  if(sel.length)return sel;t=t||findTrack(SEL);return t&&t.type==='audio'?t.regions.filter(r=>BUFS[r.buf]):[]}
const regTrack=r=>P.tracks.find(t=>t.regions.includes(r));
const regLabel=r=>{const t=regTrack(r);return (t?t.name+' · ':'')+(r.name||'prise')+' ('+fmtMin(r.start)+')'};
function fmtMin(beat){const s=Math.max(0,beat*spb());return Math.floor(s/60)+'m'+String(Math.floor(s%60)).padStart(2,'0')}
const busyModal=title=>{const m=modal([h('h2',null,'⏳ '+title),h('p',{class:'busyTxt'},'Analyse en cours…')]);m.set=t=>{const e=m.querySelector('.busyTxt');if(e)e.textContent=t};return m};

// ---------- 2 + 3 : égaliser le volume et le son des prises ----------
const TONE_MEAS=[[60,250],[250,1000],[1000,5000],[5000,14000]];
function matchTakesModal(t){const regs=targetRegions(t);if(regs.length<2)return toast('Sélectionnez au moins 2 prises (Maj + clic), ou une piste qui en a plusieurs',5000);
  const refSel=h('select',null,h('option',{value:'-1'},'La moyenne de toutes les prises'),regs.map((r,i)=>h('option',{value:i},regLabel(r))));
  const cV=h('input',{type:'checkbox',checked:true}),cS=h('input',{type:'checkbox',checked:true});
  const m=modal([h('h2',null,'⚖ Égaliser les prises'),h('p',{style:{color:'var(--dim)',fontSize:'12px'}},regs.length+' prises. Studio les mesure et les règle pour qu’elles sonnent pareil, comme si tout avait été posé d’un coup. Rien n’est détruit : chaque prise reçoit juste un réglage de volume et de son (modifiable dans ✂ Région sélectionnée).'),
    h('label',{style:{display:'flex',gap:'6px',margin:'4px 0'}},cV,h('span',null,h('b',null,'Volume'),' : même niveau perçu')),
    h('label',{style:{display:'flex',gap:'6px',margin:'4px 0'}},cS,h('span',null,h('b',null,'Son'),' : même couleur (graves, médiums, aigus) — utile si une prise a été faite un autre jour ou plus loin du micro')),
    h('div',{class:'kv2'},'Prendre comme modèle',refSel),
    h('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'10px'}},h('button',{onclick:()=>m.remove()},'Annuler'),
      h('button',{style:{background:'#2b6fd6'},onclick:async()=>{m.remove();await matchTakes(regs,+refSel.value,cV.checked,cS.checked)}},'⚖ Égaliser'))])}
async function matchTakes(regs,ref,doVol,doTone){const b=busyModal('Égaliser les prises');await pause();
  try{const info=[];for(let i=0;i<regs.length;i++){b.set('Mesure de la prise '+(i+1)+' / '+regs.length+'…');await pause();
      info.push({L:doVol?regionLoudness(regs[i]):0,S:doTone?regionSpectrum(regs[i],TONE_MEAS):null})}
    snapshot();const lines=[];
    if(doVol){const ok=info.map((x,i)=>i).filter(i=>isFinite(info[i].L)&&info[i].L>-65);
      let target;if(ref>=0)target=info[ref].L+(regs[ref].gain||0);else{const v=ok.map(i=>info[i].L+(regs[i].gain||0)).sort((a,b)=>a-b);target=v[Math.floor(v.length/2)]}
      for(const i of ok){if(i===ref)continue;const g=clamp(target-info[i].L,-24,18);const d=g-(regs[i].gain||0);regs[i].gain=Math.round(g*10)/10;if(Math.abs(d)>=.5)lines.push(regLabel(regs[i])+' : '+(d>0?'+':'')+d.toFixed(1)+' dB')}}
    if(doTone){const keys=['low','mid','pres','air'],shape=(S,r)=>{if(!S)return null;const tn=r.tone||{};const v=S.map((x,k)=>x+(tn[keys[k]]||0)*(k===0||k===3?.8:1));const mean=(v[1]+v[2])/2;return v.map(x=>x-mean)};
      const sh=info.map((x,i)=>x.S?shape(x.S,{tone:null}):null);let tgt;
      if(ref>=0)tgt=shape(info[ref].S,regs[ref]);else{const ok=sh.filter(Boolean);tgt=keys.map((k,j)=>ok.reduce((a,s)=>a+s[j],0)/ok.length)}
      if(tgt)for(let i=0;i<regs.length;i++){if(i===ref||!sh[i])continue;const tone={};let any=false;
        keys.forEach((k,j)=>{const v=clamp((tgt[j]-sh[i][j])*.8,-8,8);if(Math.abs(v)>=.7){tone[k]=Math.round(v*10)/10;any=true}});
        regs[i].tone=any?tone:null;if(any)lines.push(regLabel(regs[i])+' : son '+keys.filter(k=>tone[k]).map(k=>({low:'graves',mid:'bas-médiums',pres:'présence',air:'aigus'})[k]+' '+(tone[k]>0?'+':'')+tone[k]).join(', '))}}
    b.remove();renderLanes();renderInspector();
    modal([h('h2',null,'⚖ Prises égalisées ✔'),lines.length?h('ul',{style:{fontSize:'12px',maxHeight:'300px',overflow:'auto'}},lines.map(l=>h('li',null,l))):h('p',null,'Vos prises étaient déjà très proches : rien à corriger.'),h('p',{style:{color:'var(--dim)',fontSize:'11px'}},'Ctrl+Z pour revenir comme avant.')])}
  catch(e){b.remove();console.error(e);alert('Erreur : '+e.message)}}

// réglages « Son de la prise » dans l'outil région
{const o=regionTools;regionTools=function(t,r){const box=o.apply(this,arguments);if(t.type!=='audio')return box;
  const g=h('div',{class:'tools'}),names=[['low','Graves'],['mid','Bas-médiums'],['pres','Présence'],['air','Aigus']];
  g.append(h('div',{style:{fontWeight:600,margin:'8px 0 2px'}},'🎚 Son de cette prise'));
  for(const [k,n] of names){const val=h('span',{class:'qv'}),cur=()=>(r.tone&&r.tone[k])||0,fmt=v=>(v>0?'+':'')+(+v).toFixed(1)+' dB';val.textContent=fmt(cur());
    g.append(h('div',{class:'qrow'},h('span',{class:'qn'},n),h('input',{type:'range',min:-12,max:12,step:.5,value:cur(),onpointerdown:()=>snapshot(),
      oninput:e=>{const v=+e.target.value;r.tone=Object.assign({},r.tone||{});if(v)r.tone[k]=v;else delete r.tone[k];if(!Object.keys(r.tone).length)r.tone=null;val.textContent=fmt(v)},
      ondblclick:()=>{snapshot();if(r.tone){delete r.tone[k];if(!Object.keys(r.tone).length)r.tone=null}renderInspector()}}),val))}
  g.append(h('div',{style:{color:'var(--dim)',fontSize:'10px'}},'Réglé automatiquement par « ⚖ Égaliser les prises ». Double-clic = zéro.'));
  box.append(g);return box}}

// ---------- 1 : poignées de fondu sur les régions audio ----------
{const o=regionEl;regionEl=function(t,r){const e=o.apply(this,arguments);if(t.type!=='audio')return e;
  const px=sec=>sec/spb()*PPB,L=h('div',{class:'fh l',title:'Fondu d’entrée : glissez',style:{left:px(r.fi||0)+'px'}}),R=h('div',{class:'fh r',title:'Fondu de sortie : glissez',style:{right:px(r.fo||0)+'px'}});
  for(const [hd,k] of [[L,'fi'],[R,'fo']])hd.addEventListener('pointerdown',ev=>{ev.stopPropagation();ev.preventDefault();hd.setPointerCapture(ev.pointerId);
    const x0=ev.clientX,v0=r[k]||0;let moved=false;const tip=h('div',{class:'fhtip'});e.append(tip);
    const mv=m=>{if(!moved){snapshot();moved=true}const dx=(m.clientX-x0)*(k==='fi'?1:-1);const max=Math.max(0,r.dur-(k==='fi'?(r.fo||0):(r.fi||0))-.01);
      const v=clamp(Math.round((v0+dx/PPB*spb())*1000)/1000,0,max);r[k]=v||0;hd.style[k==='fi'?'left':'right']=px(v)+'px';tip.textContent=v<1?Math.round(v*1000)+' ms':v.toFixed(2)+' s';tip.style[k==='fi'?'left':'right']=px(v)+12+'px';
      const tl=e.querySelector('.tiles');if(tl){tl.dataset.key='';tl.innerHTML=''}schedulePaint()};
    const up=()=>{hd.removeEventListener('pointermove',mv);hd.removeEventListener('pointerup',up);hd.removeEventListener('pointercancel',up);tip.remove();if(moved){renderLanes();if(SELR.has(r.id))renderInspector()}};
    hd.addEventListener('pointermove',mv);hd.addEventListener('pointerup',up);hd.addEventListener('pointercancel',up)});
  e.append(L,R);return e}}
// dessin des fondus enchaînés automatiques
{const o=drawTile;drawTile=function(g,t,r,xo,cw,ch,dpr){o.apply(this,arguments);if(t.type!=='audio')return;const xf=autoXfades(t,spb(),P),X=xf&&xf[r.id];if(!X)return;
  const H=Math.ceil(ch*dpr),fpx=sec=>Math.max(3*dpr,sec/spb()*PPB*dpr),X0=xo*dpr,totW=rLen(t,r)*PPB*dpr;g.fillStyle='rgba(255,255,255,.35)';
  if(X.in){const w=fpx(X.in);g.beginPath();g.moveTo(-X0,H);g.lineTo(w-X0,0);g.lineTo(-X0,0);g.fill()}
  if(X.ext||X.out){const w=fpx(X.out||X.ext),e=totW-X0;g.beginPath();g.moveTo(e,H);g.lineTo(e-w,0);g.lineTo(e,0);g.fill()}}}

// ---------- 6 : volume régulier (traitement de la prise) ----------
function levelBuffer(buf,amount,maxDb,onP){const sr=buf.sampleRate,x=monoOf(buf,0,buf.length),hop=Math.round(.02*sr),win=Math.round(.3*sr),N=Math.ceil(x.length/hop),lv=new Float32Array(N);
  // niveau glissant (300 ms) par pas de 20 ms
  const cum=new Float64Array(x.length+1);for(let i=0;i<x.length;i++)cum[i+1]=cum[i]+x[i]*x[i];
  for(let k=0;k<N;k++){const c=k*hop,a=Math.max(0,c-win/2|0),b=Math.min(x.length,c+win/2|0);lv[k]=dB((cum[b]-cum[a])/Math.max(1,b-a))}
  const top=pct(lv,.95),floor=pct(lv,.1),gate=Math.max(floor+10,top-28),act=[];for(let k=0;k<N;k++)if(lv[k]>gate)act.push(lv[k]);
  const target=pct(act,.6),gdb=new Float32Array(N);
  for(let k=0;k<N;k++)gdb[k]=lv[k]>gate?clamp((target-lv[k])*amount,-maxDb,maxDb):0;
  // lissage aller-retour (sans décalage) ~ 120 ms
  const a=Math.exp(-1/(.12/.02));for(let k=1;k<N;k++)gdb[k]=a*gdb[k-1]+(1-a)*gdb[k];for(let k=N-2;k>=0;k--)gdb[k]=a*gdb[k+1]+(1-a)*gdb[k];
  return applyEnv(buf,gdb,hop)}
function applyEnv(buf,gdb,hop){const nb=ctx.createBuffer(buf.numberOfChannels,buf.length,buf.sampleRate),N=gdb.length,G=new Float32Array(N);for(let k=0;k<N;k++)G[k]=Math.pow(10,gdb[k]/20);
  for(let c=0;c<buf.numberOfChannels;c++){const s=buf.getChannelData(c),d=nb.getChannelData(c);for(let i=0;i<s.length;i++){const p=i/hop,k=Math.min(N-1,p|0),k2=Math.min(N-1,k+1),f=p-k;d[i]=s[i]*(G[k]+(G[k2]-G[k])*f)}}return nb}
// traite les sons (entiers) des prises choisies ; les prises gardent leur place et leur découpe
async function processTakes(regs,title,fn){if(!regs.length)return toast('Aucune prise : sélectionnez des prises ou une piste voix');const b=busyModal(title);await pause();
  try{const byBuf=new Map();for(const r of regs){if(!BUFS[r.buf])continue;(byBuf.get(r.buf)||byBuf.set(r.buf,[]).get(r.buf)).push(r)}let i=0;const done=[];
    for(const [id,rs] of byBuf){b.set('Prise '+(++i)+' / '+byBuf.size+'…');await pause();done.push([rs,fn(BUFS[id])])}
    snapshot();for(const [rs,nb] of done){const id=addBuffer(nb);for(const r of rs)r.buf=id}b.remove();renderLanes();renderInspector();toast(title+' ✔ ('+regs.length+' prise'+(regs.length>1?'s':'')+') — Ctrl+Z pour annuler',5000)}
  catch(e){b.remove();console.error(e);alert('Erreur : '+e.message)}}
function levelModal(t){const regs=targetRegions(t);if(!regs.length)return toast('Aucune prise à traiter');let am,mx;
  const m=modal([h('h2',null,'📏 Volume régulier'),h('p',{style:{color:'var(--dim)',fontSize:'12px'}},'Remonte les mots trop faibles et baisse les passages criés, pour que la voix reste bien devant l’instru du début à la fin. Les silences et respirations ne sont pas remontés. '+regs.length+' prise(s).'),
    h('div',{class:'kv2'},'Force',am=h('input',{type:'range',min:20,max:100,value:70})),h('div',{class:'kv2'},'Correction max',mx=h('select',null,[6,9,12].map(v=>h('option',{value:v,selected:v===9},'± '+v+' dB')))),
    h('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'10px'}},h('button',{onclick:()=>m.remove()},'Annuler'),h('button',{style:{background:'#2b6fd6'},onclick:()=>{m.remove();processTakes(regs,'Volume régulier',b=>levelBuffer(b,am.value/100,+mx.value))}},'📏 Appliquer'))])}

// ---------- 9 : respirations et bruit entre les phrases ----------
function cleanBuffer(buf,breathDb,noiseDb){const sr=buf.sampleRate,x=monoOf(buf,0,buf.length),hop=Math.round(.01*sr),n=1024,N=Math.ceil(x.length/hop);
  const lv=new Float32Array(N),zc=new Float32Array(N),ce=new Float32Array(N),re=new Float32Array(n),im=new Float32Array(n),ps=new Float32Array(n/2);
  for(let k=0;k<N;k++){const s=k*hop-n/2;let e=0,z=0,p=0;for(let i=0;i<n;i++){const v=x[s+i]||0;e+=v*v;if(i&&((v>=0)!==(p>=0)))z++;p=v}lv[k]=dB(e/n);zc[k]=z/n}
  const top=pct(lv,.95),floor=pct(lv,.08);
  // centroïde spectral seulement là où c'est utile (niveau moyen)
  for(let k=0;k<N;k++){if(lv[k]<top-40||lv[k]>top-8){ce[k]=0;continue}powerSpec(x,k*hop-n/2,n,re,im,ps);let a=0,w=0;for(let i=2;i<n/2;i++){a+=ps[i];w+=ps[i]*i*sr/n}ce[k]=a?w/a:0}
  const voiced=k=>lv[k]>top-14||(lv[k]>top-26&&zc[k]<.1),quiet=k=>lv[k]<Math.max(floor+6,top-42),gdb=new Float32Array(N);
  // bruit entre les phrases : trames calmes, en blocs d'au moins 120 ms
  if(noiseDb<0){let k=0;while(k<N){if(!quiet(k)){k++;continue}let j=k;while(j<N&&!voiced(j)&&lv[j]<top-30)j++;if((j-k)*.01>=.12)for(let i=k;i<j;i++)gdb[i]=noiseDb;k=Math.max(j,k+1)}}
  // respirations : passage bruité (pas de voix), pas trop aigu (≠ « s »), 120 ms à 1,2 s
  let nb=0;if(breathDb<0){let k=0;while(k<N){const isB=i=>!voiced(i)&&!quiet(i)&&zc[i]>.05&&ce[i]>700&&ce[i]<7500;if(!isB(k)){k++;continue}let j=k;while(j<N&&(isB(j)||(!voiced(j)&&!quiet(j)&&j-k<3)))j++;
      const d=(j-k)*.01,before=k===0||!voiced(k-1),after=j>=N||!voiced(j);if(d>=.12&&d<=1.2&&before&&after){nb++;for(let i=k;i<j;i++)gdb[i]=Math.min(gdb[i],breathDb)}k=j}}
  // adoucissement (≈ 15 ms) pour éviter les coupures sèches
  const a=Math.exp(-1/1.5);for(let k=1;k<N;k++)gdb[k]=a*gdb[k-1]+(1-a)*gdb[k];for(let k=N-2;k>=0;k--)gdb[k]=a*gdb[k+1]+(1-a)*gdb[k];
  const out=applyEnv(buf,gdb,hop);out._breaths=nb;return out}
function cleanModal(t){const regs=targetRegions(t);if(!regs.length)return toast('Aucune prise à traiter');let cb,cn,sb,sn;
  const m=modal([h('h2',null,'🧹 Respirations et bruit'),h('p',{style:{color:'var(--dim)',fontSize:'12px'}},'Studio repère les respirations entre les phrases et le souffle du micro dans les silences, et les baisse en douceur. Les mots ne sont pas touchés. '+regs.length+' prise(s).'),
    h('div',{class:'kv2'},h('label',null,cb=h('input',{type:'checkbox',checked:true}),' Baisser les respirations'),sb=h('select',null,[-6,-12,-18,-30].map(v=>h('option',{value:v,selected:v===-12},v+' dB')))),
    h('div',{class:'kv2'},h('label',null,cn=h('input',{type:'checkbox',checked:true}),' Enlever le bruit entre les phrases'),sn=h('select',null,[-10,-20,-40].map(v=>h('option',{value:v,selected:v===-20},v+' dB')))),
    h('p',{style:{color:'var(--dim)',fontSize:'11px'}},'Conseil : gardez −12 dB pour les respirations, ça reste naturel. −30 dB = presque supprimées.'),
    h('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'10px'}},h('button',{onclick:()=>m.remove()},'Annuler'),h('button',{style:{background:'#2b6fd6'},onclick:()=>{m.remove();
      processTakes(regs,'Nettoyage',b=>cleanBuffer(b,cb.checked?+sb.value:0,cn.checked?+sn.value:0))}},'🧹 Nettoyer'))])}

// ---------- 5 : assistant « Analyser ma voix » ----------
const AV_BANDS=[[100,160],[160,250],[250,400],[400,630],[630,1000],[1000,1600],[1600,2500],[2500,4000],[4000,6300],[6300,10000],[10000,14000]],
  AV_TARGET=[1.5,2.5,2,0,-1,-1.5,-3,-5,-8,-12,-17]; // forme d'une voix rap « propre » (dB, référence ≈ 400-1600 Hz)
const AV_CENT=AV_BANDS.map(([a,b])=>Math.sqrt(a*b));
async function analyzeVoice(t){t=t||findTrack(SEL);if(!t||t.type!=='audio')return toast('Sélectionnez une piste voix');const regs=t.regions.filter(r=>BUFS[r.buf]);
  if(!regs.length)return toast('Enregistrez d’abord une prise sur cette piste');const b=busyModal('Analyse de votre voix');await pause();
  try{// spectre moyen (pondéré par la durée)
    let acc=AV_BANDS.map(()=>0),w=0;for(const r of regs.slice(0,30)){const S=regionSpectrum(r,AV_BANDS,300);if(!S)continue;S.forEach((v,i)=>acc[i]+=Math.pow(10,v/10)*r.dur);w+=r.dur;await pause()}
    if(!w)throw new Error('pas assez de voix détectée');const S=acc.map(v=>dB(v/w)),ref=(S[3]+S[4]+S[5])/3,dev=S.map((v,i)=>v-ref-AV_TARGET[i]);
    // dynamique (trames de 50 ms) et sifflantes
    const lv=[],sib=[];for(const r of regs.slice(0,30)){const buf=BUFS[r.buf],sr=buf.sampleRate,x=monoOf(buf,r.offset*sr,r.dur*sr),n=Math.round(.05*sr);
      for(let s=0;s+n<=x.length;s+=n){let e=0;for(let i=s;i<s+n;i++)e+=x[i]*x[i];lv.push(dB(e/n))}}
    const top=pct(lv,.95),floor=pct(lv,.08),act=lv.filter(v=>v>top-25),rms=pct(act,.5),loud=pct(act,.9);
    // sifflantes : niveau de la bande 5-9 kHz sur les trames fortes
    for(const r of regs.slice(0,12)){const buf=BUFS[r.buf],sr=buf.sampleRate,x=monoOf(buf,r.offset*sr,Math.min(r.dur,60)*sr),n=1024,re=new Float32Array(n),im=new Float32Array(n),ps=new Float32Array(n/2);
      for(let s=0;s+n<=x.length;s+=n*2){let e=0;for(let i=s;i<s+n;i++)e+=x[i]*x[i];if(dB(e/n)<top-20)continue;powerSpec(x,s,n,re,im,ps);let hi=0,all=0;for(let i=1;i<n/2;i++){const f=i*sr/n;all+=ps[i];if(f>5000&&f<9500)hi+=ps[i]}sib.push([dB(e/n),hi/(all+1e-12)])}}
    const sibRatio=sib.length?pct(sib.map(x=>x[1]),.9):0;
    snapshot();const notes=[],ens=(type,at)=>{let p=findPlug(t,type);if(!p){p=plug(type);const order=['gate','eq','comp','deess'];let pos=0;for(let i=0;i<t.plugins.length;i++){const k=order.indexOf(t.plugins[i].type);if(k>=0&&k<order.indexOf(type))pos=i+1}t.plugins.splice(Math.min(pos,t.plugins.length),0,p)}p.byp=false;return p};
    // EQ
    const eq=ens('eq');let cum=0,tot=S.reduce((a,v)=>a+Math.pow(10,v/10),0),hp=80;for(let i=0;i<S.length;i++){cum+=Math.pow(10,S[i]/10);if(cum/tot>.02){hp=clamp(Math.round(AV_BANDS[i][0]*.75),60,140);break}}
    eq.params.hp=hp;notes.push('Coupe des grondements sous '+hp+' Hz (bruits de pieds, souffle, vibrations du micro).');
    const lowDev=(dev[0]+dev[1])/2;eq.params.lowF=150;eq.params.lowG=Math.round(clamp(-lowDev*.6,-6,4)*2)/2;
    if(eq.params.lowG<=-1)notes.push('Voix un peu trop grave/boomy → graves −'+(-eq.params.lowG)+' dB.');else if(eq.params.lowG>=1)notes.push('Voix un peu fine → graves +'+eq.params.lowG+' dB pour du corps.');
    let mi=-1,mv=2;for(let i=2;i<=5;i++)if(dev[i]>mv){mv=dev[i];mi=i}
    if(mi>=0){eq.params.m1F=Math.round(AV_CENT[mi]);eq.params.m1G=Math.round(-clamp(mv*.7,1,6)*2)/2;eq.params.m1Q=1.4;notes.push((mi<=3?'Son « boueux / carton »':'Son un peu nasal')+' vers '+eq.params.m1F+' Hz → '+eq.params.m1G+' dB.')}else{eq.params.m1G=0}
    const pres=(dev[6]+dev[7])/2;let hk=6;for(let i=6;i<=8;i++)if(dev[i]>dev[hk])hk=i;
    if(pres<-1.5){eq.params.m2F=3200;eq.params.m2G=Math.round(clamp(-pres*.6,1,5)*2)/2;eq.params.m2Q=.9;notes.push('Voix un peu étouffée → présence +'+eq.params.m2G+' dB vers 3,2 kHz (plus d’articulation).')}
    else if(dev[hk]>3){eq.params.m2F=Math.round(AV_CENT[hk]);eq.params.m2G=-Math.round(clamp(dev[hk]*.6,1,5)*2)/2;eq.params.m2Q=1.6;notes.push('Son agressif vers '+eq.params.m2F+' Hz → '+eq.params.m2G+' dB.')}else eq.params.m2G=0;
    const air=(dev[9]+dev[10])/2;eq.params.hiF=10000;eq.params.hiG=Math.round(clamp(-air*.5,-4,5)*2)/2;if(eq.params.hiG>=1)notes.push('Ajout d’air (aigus +'+eq.params.hiG+' dB) pour une voix plus brillante.');else if(eq.params.hiG<=-1)notes.push('Aigus trop brillants → '+eq.params.hiG+' dB.');
    // compresseur
    const comp=ens('comp'),thr=Math.round(clamp(rms+3,-40,-8));comp.params.thr=thr;comp.params.ratio=3.5;comp.params.att=8;comp.params.rel=120;comp.params.knee=6;
    comp.params.gain=Math.round(clamp((loud-thr)*(1-1/3.5)*.6,1,10));notes.push('Compression : les passages forts sont tenus au-dessus de '+thr+' dB (écart fort/faible de '+Math.round(loud-rms+6)+' dB mesuré).');
    // de-esser
    if(sibRatio>.08){const de=ens('deess');de.params.freq=sibRatio>.2?6000:6800;de.params.thr=Math.round(clamp(loud-14-sibRatio*20,-45,-15));de.params.amt=sibRatio>.2?80:60;notes.push('Sifflantes « s / ch » '+(sibRatio>.2?'fortes':'présentes')+' → de-esser réglé.')}
    // noise gate
    if(floor>-62&&top-floor>20){const g=ens('gate');g.params.thr=Math.round(clamp(floor+8,-70,-30));g.params.rel=150;notes.push('Bruit de fond mesuré à '+Math.round(floor)+' dB → noise gate à '+g.params.thr+' dB.')}
    t.preset=null;closeAllPlugins();E.updateStrip(t);renderAll();b.remove();
    modal([h('h2',null,'🧠 Votre voix est réglée'),h('p',{style:{color:'var(--dim)',fontSize:'12px'}},'Analyse de '+regs.length+' prise(s) de « '+t.name+' ». Voici ce que Studio a trouvé et corrigé :'),h('ul',{style:{fontSize:'12px'}},notes.map(n=>h('li',null,n))),
      h('p',{style:{color:'var(--dim)',fontSize:'11px'}},'Vos autres effets (autotune, réverb…) n’ont pas bougé. Ajustez ensuite à l’oreille, puis 💾 enregistrez dans ⭐ Mes réglages.'),
      h('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end'}},h('button',{onclick:e=>{undo();e.target.closest('.modal').remove();toast('Réglages remis comme avant')}},'↩ Annuler'),
        h('button',{onclick:e=>{e.target.closest('.modal').remove();const i=t.plugins.findIndex(p=>p.type==='eq');if(i>=0)openPlugin(t,i)}},'🎛 Voir l’égaliseur'),h('button',{style:{background:'#2b6fd6'},onclick:e=>e.target.closest('.modal').remove()},'OK'))])}
  catch(e){b.remove();console.error(e);alert('Analyse impossible : '+e.message)}}

// ---------- 4 : égaliseur visuel (points à tirer + spectre en direct) ----------
{const o=openPlugin;openPlugin=function(ob,i){const r=o.apply(this,arguments);const pl=ob.plugins&&ob.plugins[i];if(pl&&pl.type==='eq')try{eqVisual(ob,i)}catch(e){console.warn(e)}return r}}
function eqVisual(o,i){const key=o.id+':'+i,win=WINS[key];if(!win)return;const root=win.el||win.body||win,old=(root.querySelector?root:document).querySelector('canvas.disp');if(!old)return;
  const pl=o.plugins[i],W=1040,H=380,cv=h('canvas',{class:'disp eqv',width:W,height:H,style:{width:'520px',height:'190px',cursor:'crosshair',touchAction:'none'}});old.replaceWith(cv);
  const g=cv.getContext('2d'),fx=f=>Math.log(f/20)/Math.log(1000)*W,xf=x=>20*Math.pow(1000,x/W),gy=db=>H/2-db/20*H/2*.85,yg=y=>(H/2-y)/(H/2*.85)*20,lim=id=>PLUGINS.eq.params.find(p=>p.id===id);
  const PTS=[{id:'hp',f:'hp',c:'#8e8e93',n:'Coupe-bas'},{id:'low',f:'lowF',g:'lowG',c:'#ff9f0a',n:'Graves'},{id:'m1',f:'m1F',g:'m1G',q:'m1Q',c:'#30d158',n:'Médium 1'},{id:'m2',f:'m2F',g:'m2G',q:'m2Q',c:'#64d2ff',n:'Médium 2'},{id:'hi',f:'hiF',g:'hiG',c:'#bf5af2',n:'Aigus'},{id:'lp',f:'lp',c:'#8e8e93',n:'Coupe-haut'}];
  const pos=p=>[fx(pl.params[p.f]),p.g?gy(pl.params[p.g]):H/2];
  // spectre en direct (sortie de la tranche)
  let an=null,src=null;const S=()=>E.strips[o.id];try{const s=S();if(s&&ctx){an=ctx.createAnalyser();an.fftSize=8192;an.smoothingTimeConstant=.82;src=s.fader||s.mute;src.connect(an)}}catch(e){an=null}
  const spec=an?new Float32Array(an.frequencyBinCount):null;let drag=null,hover=null;
  const inst=()=>{const s=S();return s&&s.plugins[i]};
  const draw=()=>{if(!cv.isConnected||!WINS[key]){try{an&&src.disconnect(an)}catch(e){}return}
    g.clearRect(0,0,W,H);g.fillStyle='#0b1118';g.fillRect(0,0,W,H);g.strokeStyle='#1d2a36';g.lineWidth=1;g.font='18px sans-serif';
    for(const f of [50,100,200,500,1000,2000,5000,10000]){const x=fx(f);g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();g.fillStyle='#4a6075';g.fillText(f>=1000?f/1000+'k':f,x+3,H-6)}
    for(const d of [-12,-6,0,6,12]){const y=gy(d);g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();g.fillStyle='#4a6075';g.fillText((d>0?'+':'')+d,4,y-3)}
    if(an){an.getFloatFrequencyData(spec);const sr=ctx.sampleRate,nb=spec.length;g.beginPath();let st=false;
      for(let x=0;x<W;x+=3){const f=xf(x),b=Math.min(nb-1,Math.round(f/(sr/2)*nb)),b2=Math.min(nb-1,Math.round(xf(x+3)/(sr/2)*nb));let m=-200;for(let k=b;k<=Math.max(b,b2);k++)m=Math.max(m,spec[k]);
        const y=H-(m+100)/80*H;st?g.lineTo(x,y):(g.moveTo(x,y),st=true)}g.lineTo(W,H);g.lineTo(0,H);g.fillStyle='rgba(120,140,170,.22)';g.fill()}
    const ins=inst();if(ins&&ins.filters){const N=260,fr=new Float32Array(N),mag=new Float32Array(N),ph=new Float32Array(N),tot=new Float32Array(N).fill(1);
      for(let k=0;k<N;k++)fr[k]=xf(k/(N-1)*W);for(const f of ins.filters){f.getFrequencyResponse(fr,mag,ph);for(let k=0;k<N;k++)tot[k]*=mag[k]}
      g.beginPath();for(let k=0;k<N;k++){const y=gy(20*Math.log10(tot[k]+1e-9)+pl.params.out),x=k/(N-1)*W;k?g.lineTo(x,y):g.moveTo(x,y)}
      g.strokeStyle=pl.byp?'#555':'#4fa3ff';g.lineWidth=4;g.stroke();g.lineTo(W,gy(0));g.lineTo(0,gy(0));g.fillStyle='rgba(79,163,255,.13)';g.fill()}
    for(const p of PTS){const [x,y]=pos(p),on=drag===p||hover===p;g.beginPath();g.arc(x,y,on?13:10,0,7);g.fillStyle=p.c;g.globalAlpha=on?1:.85;g.fill();g.globalAlpha=1;g.strokeStyle='#000';g.lineWidth=2;g.stroke();
      if(on){const t=p.n+' · '+Math.round(pl.params[p.f])+' Hz'+(p.g?' · '+(pl.params[p.g]>0?'+':'')+(+pl.params[p.g]).toFixed(1)+' dB':'')+(p.q?' · Q '+(+pl.params[p.q]).toFixed(1):'');g.font='bold 20px sans-serif';const tw=g.measureText(t).width;const tx=clamp(x-tw/2,4,W-tw-4),ty=y<50?y+40:y-22;g.fillStyle='rgba(0,0,0,.75)';g.fillRect(tx-6,ty-20,tw+12,28);g.fillStyle='#fff';g.fillText(t,tx,ty)}}
    requestAnimationFrame(draw)};
  const at=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H]},near=e=>{const [x,y]=at(e);let best=null,bd=900;for(const p of PTS){const [px,py]=pos(p),d=(px-x)**2+(py-y)**2;if(d<bd){bd=d;best=p}}return best};
  const setP=(id,v)=>{const d=lim(id);pl.params[id]=clamp(v,d.min,d.max);const k='p|'+o.id+'|'+i+'|'+id;if(KNOBS[k])KNOBS[k]()};
  cv.addEventListener('pointerdown',e=>{const p=near(e);if(!p)return;e.preventDefault();cv.setPointerCapture(e.pointerId);snapshot();drag=p});
  cv.addEventListener('pointermove',e=>{if(!drag){hover=near(e);cv.style.cursor=hover?'grab':'crosshair';return}const [x,y]=at(e);setP(drag.f,Math.round(xf(clamp(x,0,W))));if(drag.g)setP(drag.g,Math.round(yg(y)*2)/2);E.updateStrip(o)});
  const end=()=>{drag=null};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);cv.addEventListener('pointerleave',()=>{if(!drag)hover=null});
  cv.addEventListener('wheel',e=>{const p=hover||near(e);if(!p||!p.q)return;e.preventDefault();setP(p.q,Math.round(pl.params[p.q]*(e.deltaY<0?1.12:1/1.12)*100)/100);E.updateStrip(o)},{passive:false});
  cv.addEventListener('dblclick',e=>{const p=near(e);if(!p)return;snapshot();if(p.g)setP(p.g,0);else setP(p.f,lim(p.f).def);E.updateStrip(o)});
  cv.after(h('div',{style:{color:'var(--dim)',fontSize:'11px',textAlign:'center',margin:'2px 0 6px'}},'Tirez les points (gauche-droite = fréquence, haut-bas = volume) · molette = largeur · double-clic = remise à zéro · gris = le son de la piste en direct'));
  requestAnimationFrame(draw)}
function openTrackEQ(t){t=t||findTrack(SEL);if(!t)return;let i=t.plugins.findIndex(p=>p.type==='eq');
  if(i<0){snapshot();const p=plug('eq');const j=t.plugins.findIndex(p=>['comp','pitch','tunepro','chorus','delay','reverb','verbpro'].includes(p.type));i=j<0?t.plugins.length:j;t.plugins.splice(i,0,p);E.updateStrip(t);renderAll()}
  openPlugin(t,i)}

// ---------- 8 : comparer A / B ----------
function abSwitch(t,to){t.ab=t.ab||{cur:'A'};if(t.ab.cur===to)return;t.ab[t.ab.cur]=grabVoice(t);if(!t.ab[to])t.ab[to]=grabVoice(t);
  putVoice(t,t.ab[to],true);t.ab.cur=to;closeAllPlugins();E.updateStrip(t);if(typeof syncFaders==='function')syncFaders(t.id);renderAll();toast('Réglage '+to+(t.ab[to]&&to==='B'&&!t.ab._bTouched?' (copie de A : modifiez-le pour comparer)':''),2500)}
function abRow(t){const cur=(t.ab&&t.ab.cur)||'A',B=k=>h('button',{class:cur===k?'on':'',style:{minWidth:'34px',fontWeight:700,background:cur===k?(k==='A'?'#2b6fd6':'#d6672b'):''},title:'Écouter le réglage '+k,onclick:()=>abSwitch(t,k)},k);
  return h('div',{style:{display:'flex',gap:'4px',alignItems:'center',margin:'6px 0'}},h('span',{style:{fontSize:'11px',color:'var(--dim)',marginRight:'2px'}},'Comparer'),B('A'),B('B'),
    h('button',{title:'Copie le réglage écouté dans l’autre case',style:{fontSize:'11px'},onclick:()=>{t.ab=t.ab||{cur:'A'};const other=cur==='A'?'B':'A';t.ab[other]=grabVoice(t);toast('Réglage '+cur+' copié dans '+other)}},'Copier '+cur+' → '+(cur==='A'?'B':'A')),
    h('span',{style:{fontSize:'10px',color:'var(--dim)'}},'(touche ',h('kbd',null,'⇧B'),')'))}
document.addEventListener('keydown',e=>{if(e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.code==='KeyB'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement&&document.activeElement.tagName||'')&&!(document.activeElement&&document.activeElement.isContentEditable)){
  const t=findTrack(SEL);if(t&&t.type==='audio'&&!isInstru(t)){e.preventDefault();abSwitch(t,((t.ab&&t.ab.cur)||'A')==='A'?'B':'A')}}},true);

// ---------- 7 : mastering 1 clic ----------
const MASTER_STYLES={
  'Trap':{tip:'Basses lourdes, aigus nets, fort',eq:{hp:28,lowF:70,lowG:1.5,m1F:320,m1G:-1,m1Q:.8,m2F:3500,m2G:.5,m2Q:.7,hiF:11000,hiG:1.5,lp:20000,out:0},comp:{thr:-16,ratio:2,att:30,rel:180,knee:10,gain:2,mix:100},sat:{drive:12,type:0,tone:16000,mix:35,out:-1},lufs:-8.5},
  'Drill':{tip:'Punch, médiums présents, très fort',eq:{hp:30,lowF:60,lowG:1,m1F:250,m1G:-1.5,m1Q:.9,m2F:2500,m2G:1,m2Q:.8,hiF:9000,hiG:1,lp:20000,out:0},comp:{thr:-15,ratio:2.5,att:20,rel:120,knee:8,gain:2,mix:100},sat:{drive:18,type:1,tone:14000,mix:40,out:-1.5},lufs:-8},
  'Mélodique':{tip:'Doux, aéré, voix en avant',eq:{hp:25,lowF:90,lowG:.5,m1F:350,m1G:-1,m1Q:.8,m2F:4000,m2G:.5,m2Q:.6,hiF:12000,hiG:2,lp:20000,out:0},comp:{thr:-18,ratio:1.8,att:40,rel:250,knee:12,gain:1.5,mix:100},sat:{drive:8,type:0,tone:18000,mix:25,out:-.5},lufs:-10},
  'Naturel':{tip:'Juste plus fort et propre, sans couleur',eq:{hp:25,lowF:100,lowG:0,m1F:350,m1G:0,m1Q:1,m2F:3000,m2G:0,m2Q:1,hiF:10000,hiG:0,lp:20000,out:0},comp:{thr:-18,ratio:1.5,att:40,rel:250,knee:12,gain:1,mix:100},sat:null,lufs:-11}};
function masterModal(){let style='Trap',meas;const ex=P.master.plugins.some(p=>p._master);
  const cards=h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',margin:'8px 0'}});
  const draw=()=>{cards.innerHTML='';for(const n in MASTER_STYLES)cards.append(h('div',{onclick:()=>{style=n;draw()},style:{padding:'8px',borderRadius:'8px',cursor:'pointer',border:'2px solid '+(style===n?'#2b6fd6':'#333'),background:style===n?'#16263a':'#1a1a1a'}},h('b',null,n),h('div',{style:{fontSize:'11px',color:'var(--dim)'}},MASTER_STYLES[n].tip)))};draw();
  const m=modal([h('h2',null,'🎚 Mastering 1 clic'),h('p',{style:{color:'var(--dim)',fontSize:'12px'}},'Le mastering, c’est la dernière couche sur tout le morceau : il le rend plus fort, plus équilibré et plus « pro », comme les sons sur Spotify. Choisissez un style :'),cards,
    h('label',{style:{display:'flex',gap:'6px',margin:'6px 0',fontSize:'12px'}},meas=h('input',{type:'checkbox',checked:true}),'Mesurer le morceau pour régler le volume final exactement (calcule le son 2 fois, ~1 min)'),
    ex&&h('p',{style:{fontSize:'11px',color:'#ff9f0a'}},'Un mastering est déjà en place : il sera remplacé.'),
    h('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'8px'}},ex&&h('button',{onclick:()=>{snapshot();P.master.plugins=P.master.plugins.filter(p=>!p._master);if(!P.master.plugins.some(p=>p.type==='limiter'))P.master.plugins.push(plug('limiter',{gain:0,ceil:-1}));E.updateStrip(P.master);renderAll();m.remove();toast('Mastering retiré')}},'Retirer le mastering'),
      h('button',{onclick:()=>m.remove()},'Annuler'),h('button',{style:{background:'#2b6fd6'},onclick:()=>{m.remove();applyMaster(style,meas.checked)}},'🎚 Masteriser'))])}
async function applyMaster(style,measure){const S=MASTER_STYLES[style];if(E.playing)E.stop();snapshot();
  const keep=P.master.plugins.filter(p=>!p._master&&p.type!=='limiter'),mk=(ty,pr)=>Object.assign(plug(ty,pr),{_master:style});
  const lim=mk('limiter',{gain:3,ceil:-1,rel:80});P.master.plugins=[...keep,mk('eq',S.eq),mk('comp',S.comp),...(S.sat?[mk('sat',S.sat)]:[]),lim];E.updateStrip(P.master);renderAll();
  if(!measure){toast('Mastering « '+style+' » appliqué ✔ (Ctrl+Z pour annuler)',5000);return}
  const ends=P.tracks.flatMap(t=>t.regions.map(r=>r.start+rLen(t,r)));if(!ends.length){toast('Mastering appliqué (rien à mesurer : morceau vide)');return}
  const b=busyModal('Mastering « '+style+' »');let a=0,z=Math.max(...ends);
  try{for(let pass=1;pass<=2;pass++){b.set('Mesure du volume ('+pass+'/2)… le son est calculé, patience');await pause();const buf=await renderMix(P,a,z);
      const x=monoOf(buf,0,buf.length),L=loudnessOf(x,buf.sampleRate)+0.7;const d=S.lufs-L;lim.params.gain=Math.round(clamp(lim.params.gain+d*(pass===1?1:.85),-6,18)*2)/2;if(Math.abs(d)<.6)break}
    E.updateStrip(P.master);renderAll();b.remove();
    modal([h('h2',null,'🎚 Mastering « '+style+' » ✔'),h('p',null,'Chaîne ajoutée sur la Sortie stéréo : égaliseur, compression douce'+(S.sat?', saturation légère':'')+', limiteur (plafond −1 dB, montée de '+lim.params.gain+' dB).'),
      h('p',{style:{color:'var(--dim)',fontSize:'12px'}},'Écoutez avec et sans : cliquez sur le bouton vert du limiteur dans la Sortie stéréo pour le couper. Ctrl+Z pour annuler.'),h('div',{style:{textAlign:'right'}},h('button',{onclick:e=>e.target.closest('.modal').remove()},'OK'))])}
  catch(e){b.remove();console.error(e);alert('Erreur : '+e.message)}}

// ---------- panneau « 🪄 Outils voix » dans l'inspecteur ----------
function voiceTools(t){const box=h('div',{class:'sec vtools'}),B=(lab,fn,tip)=>h('button',{title:tip,style:{textAlign:'left'},onclick:fn},lab);
  const nSel=[...SELR].map(findRegion).filter(x=>x&&x[0].type==='audio'&&!isInstru(x[0])).length;
  box.append(h('div',{style:{fontSize:'11px',color:'var(--dim)',marginBottom:'4px'}},nSel?'Agit sur les '+nSel+' prise(s) sélectionnée(s).':'Agit sur toutes les prises de « '+t.name+' » (ou sélectionnez des prises avec Maj + clic).'),
    h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px'}},
      B('🧠 Analyser ma voix',()=>analyzeVoice(t),'Studio écoute vos prises et règle l’EQ, la compression, le de-esser et le noise gate'),
      B('🎛 Égaliseur visuel',()=>openTrackEQ(t),'Courbe à tirer avec le spectre de la voix en direct'),
      B('⚖ Égaliser les prises',()=>matchTakesModal(t),'Même volume et même son pour toutes les prises'),
      B('📏 Volume régulier',()=>levelModal(t),'Remonte les mots faibles, baisse les cris'),
      B('🧹 Respirations & bruit',()=>cleanModal(t),'Baisse les respirations et le souffle entre les phrases'),
      B('🎚 Mastering 1 clic',()=>masterModal(),'Rend tout le morceau plus fort et plus pro')));
  const xv=()=>P.settings.xfade!=null?+P.settings.xfade:30,val=h('span',{class:'qv'},xv()?xv()+' ms':'coupé');
  box.append(h('div',{class:'qrow',title:'Quand une prise commence juste où une autre finit (vous avez reposé une phrase), Studio les fond l’une dans l’autre pour éviter les clics et les coupures'},
    h('span',{class:'qn'},'🔀 Fondu entre prises'),h('input',{type:'range',min:0,max:120,step:5,value:xv(),onpointerdown:()=>snapshot(),oninput:e=>{P.settings.xfade=+e.target.value;val.textContent=+e.target.value?e.target.value+' ms':'coupé'},onchange:()=>schedulePaintAll()}),val),
    h('div',{style:{fontSize:'10px',color:'var(--dim)'}},'Automatique quand vous reposez une phrase. Fondus à la main : tirez les ronds blancs en haut des régions.'));
  return box}
function schedulePaintAll(){document.querySelectorAll('#lanes .reg .tiles').forEach(tl=>{tl.dataset.key='';tl.innerHTML=''});schedulePaint()}
{const o=renderInspector;renderInspector=function(){const r=o.apply(this,arguments);try{const t=findTrack(SEL);
  if(t&&t.type==='audio'&&!isInstru(t)){const I=document.getElementById('insp');if(I&&!I.querySelector('.vtools')){
    const mine=I.querySelector('.sec.mine');if(mine)mine.prepend(abRow(t));
    const anchor=[...I.querySelectorAll('h3.fold')].find(x=>/Réglages rapides/.test(x.textContent));const parts=isec('vtools','🪄 Outils voix',voiceTools(t));
    if(anchor)anchor.before(...parts);else I.append(...parts)}}}catch(e){console.warn(e)}return r}}
// menu clic droit d'une région : raccourcis vers les outils
{const o=menu;menu=function(e,items){if(Array.isArray(items)&&typeof items[0]==='string'&&/^Région : /.test(items[0])){const reg=e.target&&e.target.closest&&e.target.closest('.reg');const fr=reg&&findRegion(reg.dataset.r);
  if(fr&&fr[0].type==='audio'&&!isInstru(fr[0])){const t=fr[0],k=items.lastIndexOf('-');const add=['-',['⚖ Égaliser les prises sélectionnées…',()=>matchTakesModal(t)],['📏 Volume régulier…',()=>levelModal(t)],['🧹 Respirations & bruit…',()=>cleanModal(t)]];
    items=k>0?[...items.slice(0,k),...add,...items.slice(k)]:[...items,...add]}}return o.call(this,e,items)}}
