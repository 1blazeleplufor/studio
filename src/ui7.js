// ===== v2.5 : fenêtres pro (Réverb « Ères », Pitch Pro) =====
function proKnob(o,i,pl,id,opt){const d=PLUGINS[pl.type].params.find(x=>x.id===id);return knob(d,()=>pl.params[id],v=>{pl.params[id]=v;E.updateStrip(o);if(opt&&opt.after)opt.after()},Object.assign({key:'p|'+o.id+'|'+i+'|'+id},opt||{}))}
function presetSelect(o,i,pl,re){const def=PLUGINS[pl.type];return h('select',{class:'pro-sel',onchange:e=>{if(!e.target.value)return;snapshot();pl.params=Object.assign(defaultParams(pl.type),pl.type==='tunepro'?{key:pl.params.key,scale:pl.params.scale,notes:pl.params.notes}:{},def.presets[e.target.value]);if(o.type==='aux'||P.auxes.includes(o))pl.params.mix=pl.type==='verbpro'?100:pl.params.mix;E.updateStrip(o);re()}},
  h('option',{value:''},'Préréglages…'),Object.keys(def.presets).map(n=>h('option',{value:n},n)))}
function reopen(o,i){const k=o.id+':'+i,w=WINS[k];let pos=null;if(w){pos=[w.el.style.left,w.el.style.top];w.el.remove();delete WINS[k]}openPlugin(o,i);if(pos&&WINS[k]){WINS[k].el.style.left=pos[0];WINS[k].el.style.top=pos[1]}}
function openVerbPro(o,i){
  const pl=o.plugins[i],body=h('div',{class:'pro verb'}),w=makeWin(o.id+':'+i,'Réverb Pro « Ères » — '+o.name,body);if(!w)return;w.el.classList.add('pro-win','verb-win');
  const re=()=>reopen(o,i),K=(id,sz,col)=>proKnob(o,i,pl,id,{size:sz||44,color:col||'#e8b04b',w:(sz||44)+30});
  const modeSel=h('select',{class:'pro-sel big',onchange:e=>{snapshot();pl.params.mode=+e.target.value;E.updateStrip(o);desc.textContent=VERB_MODE_TXT[pl.params.mode]}},VERB_MODES.map((m,j)=>h('option',{value:j,selected:(pl.params.mode|0)===j},m)));
  const colors=h('div',{class:'seg'},['Années 70','Années 80','Moderne'].map((c,j)=>h('button',{class:(pl.params.color|0)===j?'on':'',onclick:()=>{snapshot();pl.params.color=j;E.updateStrip(o);colors.querySelectorAll('button').forEach((b,k)=>b.classList.toggle('on',k===j))}},c)));
  const desc=h('div',{class:'pro-desc'},VERB_MODE_TXT[pl.params.mode|0]);
  body.append(h('div',{class:'pro-top'},h('div',{class:'pro-brand'},'ÈRES',h('small',null,'réverb vintage')),h('label',null,'Mode',modeSel),h('label',null,'Couleur',colors),presetSelect(o,i,pl,re),
      h('button',{class:pl.byp?'':'on',onclick:e=>{snapshot();pl.byp=!pl.byp;e.target.classList.toggle('on',!pl.byp);e.target.textContent=pl.byp?'Contourné':'Actif';E.updateStrip(o);rerenderStrips()}},pl.byp?'Contourné':'Actif')),desc,
    h('div',{class:'pro-groups'},
      h('div',{class:'pro-g'},h('h5',null,'Principal'),h('div',{class:'pro-row'},K('mix',56,'#ffd27a'),K('pre'),K('decay',56,'#ffd27a'),K('size'),K('attack'))),
      h('div',{class:'pro-g'},h('h5',null,'Diffusion'),h('div',{class:'pro-row'},K('ed'),K('ld'))),
      h('div',{class:'pro-g'},h('h5',null,'Modulation'),h('div',{class:'pro-row'},K('mrate'),K('mdepth'))),
      h('div',{class:'pro-g'},h('h5',null,'Égaliseur'),h('div',{class:'pro-row'},K('hicut',44,'#7fc8ff'),K('locut',44,'#7fc8ff'))),
      h('div',{class:'pro-g'},h('h5',null,'Decay par fréquence'),h('div',{class:'pro-row'},K('bmult',44,'#a6e3a1'),K('bx',44,'#a6e3a1'),K('hshelf',44,'#a6e3a1'),K('hfreq',44,'#a6e3a1')))),
    h('div',{class:'pro-foot'},P.auxes.includes(o)?'Sur un bus : laissez Mix à 100 % et réglez la quantité avec les envois des pistes.':'Sur une piste : réglez la quantité avec Mix (15-35 % pour une voix).','  ·  Double-clic = valeur par défaut · clic droit = MIDI Learn'));
}
function openTunePro(o,i){
  const pl=o.plugins[i],body=h('div',{class:'pro tune'}),w=makeWin(o.id+':'+i,'Pitch Pro — '+o.name,body);if(!w)return;w.el.classList.add('pro-win','tune-win');
  const re=()=>reopen(o,i),K=(id,sz,col,lab)=>proKnob(o,i,pl,id,{size:sz||40,color:col||'#5ee0c6',w:(sz||40)+30});
  const notes=()=>Array.isArray(pl.params.notes)?pl.params.notes:scaleNotes(pl.params.key|0,pl.params.scale|0);
  const setKS=()=>{pl.params.notes=null;E.updateStrip(o);drawNotes()};
  const sel=(id,opts,fn)=>h('select',{class:'pro-sel',onchange:e=>{snapshot();pl.params[id]=+e.target.value;if(fn)fn();E.updateStrip(o)}},opts.map((t,j)=>h('option',{value:j,selected:(pl.params[id]|0)===j},t)));
  const tog=(id,lab)=>h('button',{class:'tog'+(pl.params[id]?' on':''),onclick:e=>{snapshot();pl.params[id]=pl.params[id]?0:1;e.target.classList.toggle('on',!!pl.params[id]);E.updateStrip(o)}},lab);
  const nrow=h('div',{class:'notes-ed'});
  function drawNotes(){nrow.innerHTML='';const a=notes();for(let pc=0;pc<12;pc++){const st=a[pc]|0,blk=[1,3,6,8,10].includes(pc);
    nrow.append(h('button',{class:'nt'+(blk?' blk':'')+(st===0?' on':st===1?' byp':' off'),title:['Corrigée','Ignorée (pas de correction près de cette note)','Retirée (jamais visée)'][st]+' — cliquer pour changer',
      onclick:()=>{snapshot();const b=notes().slice();b[pc]=(b[pc]+1)%3;pl.params.notes=b;E.updateStrip(o);drawNotes()}},h('b',null,NOTE_NAMES[pc]),h('i',null,['✓','~','✕'][st])))}}
  drawNotes();
  const cv=h('canvas',{class:'tune-graph'}),W=640,H=210,dp=window.devicePixelRatio||1;cv.width=W*dp;cv.height=H*dp;cv.style.width=W+'px';cv.style.height=H+'px';
  body.append(
    h('div',{class:'pro-top'},h('div',{class:'pro-brand t'},'PITCH',h('b',null,'PRO')),
      h('label',null,'Type de voix',sel('input',TUNE_INPUTS)),h('label',null,'Tonalité',sel('key',NOTE_NAMES,setKS)),h('label',null,'Gamme',sel('scale',Object.keys(SCALES),setKS)),
      h('button',{title:'Prendre la tonalité du projet',onclick:()=>{snapshot();pl.params.key=P.key;pl.params.scale=P.scaleIdx;pl.params.notes=null;E.updateStrip(o);re()}},'↺ Projet ('+NOTE_NAMES[P.key]+' '+Object.keys(SCALES)[P.scaleIdx]+')'),
      presetSelect(o,i,pl,re),
      h('button',{class:pl.byp?'':'on',onclick:e=>{snapshot();pl.byp=!pl.byp;e.target.classList.toggle('on',!pl.byp);e.target.textContent=pl.byp?'Contourné':'Actif';E.updateStrip(o);rerenderStrips()}},pl.byp?'Contourné':'Actif')),
    h('div',{class:'tune-mid'},
      h('div',{class:'tune-side'},K('tracking',34,'#9aa7ff'),K('transpose',34,'#9aa7ff'),K('detune',34,'#9aa7ff'),K('mix',34,'#9aa7ff')),
      h('div',{class:'tune-center'},nrow,cv,h('div',{class:'legend'},h('span',{style:{color:'#ff8a65'}},'━ voix d’origine'),h('span',{style:{color:'#5ee0c6'}},'━ voix corrigée'))),
      h('div',{class:'tune-side'},tog('classic','Mode classique'),tog('formant','Formants'),K('throat',34,'#f6c177'))),
    h('div',{class:'tune-bottom'},
      h('div',{class:'big'},K('retune',92,'#5ee0c6'),h('div',{class:'hint'},'0 ms = effet robot · 20-50 ms = moderne · 80+ ms = naturel')),
      K('humanize',58,'#5ee0c6'),K('flex',58,'#5ee0c6'),K('vibrato',58,'#5ee0c6')),
    h('div',{class:'pro-foot'},'Notes : ✓ corrigée · ~ ignorée · ✕ retirée. Humanize laisse respirer les notes tenues, Flex-Tune ne corrige que près des notes, Vibrato naturel garde/renforce le vibrato. Latence compensée automatiquement à la lecture.'));
  // graphique de hauteur en direct
  const g=cv.getContext('2d');let ctr=60;
  const tick=()=>{if(!WINS[o.id+':'+i])return;const inst=E.strips[o.id]&&E.strips[o.id].plugins[i];const data=inst&&inst.graph?inst.graph.slice(-560):[];
    g.setTransform(dp,0,0,dp,0,0);g.fillStyle='#0b1216';g.fillRect(0,0,W,H);
    const vals=data.filter(d=>d[0]>0).map(d=>d[0]);if(vals.length){const sorted=vals.slice().sort((a,b)=>a-b),med=sorted[sorted.length>>1];ctr+=(med-ctr)*.08}
    const span=14,y=m=>H/2-(m-ctr)/span*H,a=notes();
    for(let m=Math.floor(ctr-span/2)-1;m<=ctr+span/2+1;m++){const pc=((m%12)+12)%12,st=a[pc]|0,yy=y(m);g.fillStyle=st===2?'rgba(255,255,255,.03)':st===1?'rgba(255,214,10,.08)':'rgba(94,224,198,.10)';g.fillRect(0,yy-H/span/2,W,H/span-1);
      g.fillStyle=st===2?'#3a4a50':'#8fb9b0';g.font='10px sans-serif';g.fillText(NOTE_NAMES[pc]+(Math.floor(m/12)-1),4,yy+3)}
    const plot=(k,col)=>{g.strokeStyle=col;g.lineWidth=2;g.beginPath();let pen=false;data.forEach((d,j)=>{const x=40+j/(560)*(W-44),v=d[k];if(v>0){const yy=y(v);pen?g.lineTo(x,yy):g.moveTo(x,yy);pen=true}else pen=false});g.stroke()};
    plot(0,'#ff8a65');plot(1,'#5ee0c6');if(!data.length){g.fillStyle='#5b6b70';g.font='12px sans-serif';g.fillText('Chantez ou lancez la lecture : la courbe de hauteur s’affiche ici.',60,H/2)}
    requestAnimationFrame(tick)};tick();
}
