// ===== v3.7.5 : test de latence (mesure le décalage réel casque → voix → micro) =====
// L'appli joue des clics ; on dit « TA » (ou on tape des mains) dans le micro sur chaque clic, ou on colle un écouteur du casque contre le micro.
// On enregistre par le même chemin qu'une vraie prise (micro choisi dans les réglages), on retrouve chaque attaque et on mesure son retard.
// Le résultat n'est appliqué QUE si l'utilisateur clique « Appliquer », et uniquement au projet ouvert. L'ancienne valeur reste affichée pour revenir.
const LAT_TEST={bpm:100,listen:4,count:10};
async function runLatencyTest(onStep){
  await E.openMic(P.settings.inputDev);await ctx.resume();if(E.playing)E.stop();
  const sr=ctx.sampleRate,iv=60/LAT_TEST.bpm,t0=ctx.currentTime+.6,clicks=[];
  E.recChunks=[];E.recLive=[];E.recording=true;E.recNode.port.postMessage({rec:true});
  for(let i=0;i<LAT_TEST.listen+LAT_TEST.count;i++){const t=t0+i*iv;E.click(t,i%4===0);if(i>=LAT_TEST.listen)clicks.push(t)}
  const end=t0+(LAT_TEST.listen+LAT_TEST.count)*iv+.6;
  await new Promise(res=>{const tm=setInterval(()=>{const k=Math.floor((ctx.currentTime-t0)/iv);onStep&&onStep(k);if(ctx.currentTime>=end){clearInterval(tm);res()}},50)});
  E.recNode.port.postMessage({rec:false});E.recording=false;const ch=E.recChunks;E.recChunks=[];
  if(!ch.length)throw new Error('aucun son reçu du micro');
  let n=0;for(const c of ch)n+=c.d.length;const a=new Float32Array(n);let o=0;for(const c of ch){a.set(c.d,o);o+=c.d.length}
  const f0=ch[0].t/sr,B=Math.max(1,Math.round(sr*.002)),env=new Float32Array(Math.ceil(n/B));
  for(let i=0;i<env.length;i++){let m=0;for(let j=i*B,e=Math.min(n,j+B);j<e;j++){const v=Math.abs(a[j]);if(v>m)m=v}env[i]=m}
  const at=t=>Math.round((t-f0)*sr/B),pre=Array.from(env.slice(0,Math.max(1,at(t0-.05)))).sort((x,y)=>x-y),floor=pre[Math.floor(pre.length*.9)]||0;
  let peak=0;for(const v of env)if(v>peak)peak=v;const thr=Math.max(floor*5,peak*.22,.008);
  const ds=[];for(const c of clicks){const s=Math.max(1,at(c-.06)),e=Math.min(env.length,at(c+Math.min(.55,iv-.05)));
    for(let i=s;i<e;i++)if(env[i]>thr&&env[i-1]<=thr){ds.push((i*B)/sr+f0-c);break}}
  if(ds.length<Math.ceil(LAT_TEST.count*.6))throw new Error(peak<.02?'le micro n’a presque rien entendu (vérifiez le micro choisi dans les réglages)':'pas assez de « TA » détectés ('+ds.length+'/'+LAT_TEST.count+')');
  const s=ds.slice().sort((x,y)=>x-y),med=s[Math.floor(s.length/2)],q1=s[Math.floor(s.length*.25)],q3=s[Math.floor(s.length*.75)];
  const auto=(ctx.outputLatency||0)+(ctx.baseLatency||0)+(E.inLatency||0);
  return{total:Math.round(med*1000),auto:Math.round(auto*1000),suggest:Math.round((med-auto)*1000),spread:Math.round((q3-q1)*1000),hits:ds.length,peak}}
function latencyTestModal(){
  const cur=P.settings.latencyMs||0,box=h('div'),m=modal(box);let res=null,running=false;
  const draw=(state,extra)=>{box.innerHTML='';
    box.append(h('h2',null,'🎯 Test de latence'),
      h('p',null,'Le test mesure le vrai retard entre le beat que vous entendez et votre voix enregistrée (casque, Sonar, sans-fil, micro… tout compris).'),
      h('ol',{style:{margin:'4px 0 8px 18px',padding:0,lineHeight:1.5}},h('li',null,'Mettez votre casque, comme pour enregistrer.'),
        h('li',null,'Cliquez « Lancer ». Écoutez 4 clics, puis ',h('b',null,'dites « TA » bien sec (ou tapez des mains) pile sur chacun des 10 clics suivants'),'.'),
        h('li',{style:{color:'var(--dim)'}},'Encore plus précis : collez un écouteur du casque contre le micro et ne dites rien.')),
      h('div',{class:'kv2'},'Réglage actuel de ce projet',h('b',null,cur+' ms')),
      h('div',{class:'kv2'},'Micro utilisé',h('span',null,P.settings.inputDev?'celui choisi dans ⚙ Réglages':'micro par défaut du système')));
    if(state==='run')box.append(h('div',{class:'lt-run'},extra));
    if(state==='err')box.append(h('p',{style:{color:'#ff9f0a'}},'⚠ '+extra+'. Réessayez en parlant plus fort / plus près du micro.'));
    if(state==='ok'){const r=res,bad=r.spread>45;
      box.append(h('div',{class:'lt-res'},h('div',{class:'kv2'},'Retard total mesuré',h('b',null,r.total+' ms')),
        h('div',{class:'kv2'},'Déjà compensé automatiquement',h('span',null,r.auto+' ms')),
        h('div',{class:'kv2'},'➜ Réglage conseillé',h('b',{style:{fontSize:'16px',color:'#30d158'}},r.suggest+' ms')),
        h('p',{style:{color:bad?'#ff9f0a':'var(--dim)',fontSize:'11px'}},(bad?'⚠ Les « TA » étaient assez irréguliers (±'+r.spread+' ms) : refaites le test pour confirmer. ':'Mesure régulière (±'+r.spread+' ms). ')+r.hits+' clics détectés sur '+LAT_TEST.count+'.'),
        h('p',{style:{fontSize:'12px'}},'Rien n’est changé tant que vous ne cliquez pas « Appliquer ». Votre réglage actuel ('+cur+' ms) reste noté ici pour revenir en arrière.')))}
    box.append(h('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'10px'}},
      h('button',{disabled:running||null,style:{padding:'8px 14px'},onclick:go},res?'↻ Refaire le test':'▶ Lancer le test'),
      state==='ok'&&h('button',{style:{padding:'8px 14px',background:'#2b6fd6',color:'#fff'},onclick:()=>{const old=P.settings.latencyMs||0;P.settings.latencyMs=res.suggest;DIRTY=true;saveLocal(true);
        m.remove();toast('Compensation de ce projet : '+old+' ms → '+res.suggest+' ms (ancienne valeur : '+old+' ms, modifiable dans ⚙ Réglages)',7000);const inp=document.querySelector('.modal input[data-lat]');if(inp)inp.value=res.suggest}},'Appliquer '+res.suggest+' ms à ce projet'),
      h('button',{onclick:()=>m.remove()},state==='ok'?'Garder '+cur+' ms':'Fermer')))};
  async function go(){if(running)return;running=true;res=null;
    draw('run','Préparation…');
    try{res=await runLatencyTest(k=>{const n=k-LAT_TEST.listen+1;const msg=k<0?'Préparez-vous…':k<LAT_TEST.listen?'👂 Écoutez… '+(LAT_TEST.listen-k):n<=LAT_TEST.count?'🗣 TA ! ('+n+'/'+LAT_TEST.count+')':'Analyse…';const d=box.querySelector('.lt-run');if(d)d.textContent=msg});running=false;draw('ok')}
    catch(e){running=false;console.warn(e);if(e&&e.name&&/NotAllowed|NotFound|NotReadable/.test(e.name)){m.remove();return micError(e)}draw('err',e.message||String(e))}}
  draw('idle')}
// bouton dans ⚙ Réglages, à côté de « Compensation de latence »
{const o=settingsModal;settingsModal=async function(){const r=await o.apply(this,arguments);const ms=document.querySelectorAll('.modal .box'),b=ms[ms.length-1];if(!b)return r;
  for(const row of b.querySelectorAll('.kv2'))if(/Compensation de latence/.test(row.firstChild&&row.firstChild.textContent||'')){const inp=row.querySelector('input');if(inp)inp.dataset.lat='1';
    row.append(h('button',{style:{marginLeft:'6px'},title:'Mesurer automatiquement le bon réglage',onclick:()=>{latencyTestModal()}},'🎯 Tester'));break}return r}}
