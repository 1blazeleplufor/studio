// ===== v3.3 : import depuis Logic Pro (projets .logicx, stems, MIDI, AIFF/CAF) =====
const AUDIO_RE=/\.(wav|wave|bwf|aif|aiff|aifc|caf|mp3|m4a|aac|flac|ogg|opus)$/i,MIDI_RE=/\.(mid|midi|smf)$/i;
// --- lecture récursive des dossiers glissés (paquet .logicx = dossier) ---
function dropEntries(dt){const out=[];for(const it of dt.items||[]){if(it.kind!=='file')continue;const en=it.webkitGetAsEntry&&it.webkitGetAsEntry();if(en)out.push(en);else{const f=it.getAsFile();if(f)out.push({file:f,path:f.name})}}return out}
async function walkEntries(list){const files=[];
  const readAll=dir=>new Promise(res=>{const r=dir.createReader(),acc=[];const next=()=>r.readEntries(es=>{if(!es.length)return res(acc);acc.push(...es);next()},()=>res(acc));next()});
  const fileOf=en=>new Promise(res=>en.file(f=>res(f),()=>res(null)));
  async function walk(en,path){if(en.file&&!en.isFile&&!en.isDirectory){files.push(en);return}
    if(en.isFile){const f=await fileOf(en);if(f)files.push({file:f,path:path+en.name})}
    else if(en.isDirectory){if(/^(Undo Data|Freeze Files|\.)/i.test(en.name))return;for(const c of await readAll(en))await walk(c,path+en.name+'/')}}
  for(const en of list)await walk(en,'');return files}
// --- décodeurs de secours (AIFF/AIFC, CAF, WAV) ---
function ext80(dv,o){const e=((dv.getUint8(o)&0x7f)<<8)|dv.getUint8(o+1),hi=dv.getUint32(o+2),lo=dv.getUint32(o+6);if(!e&&!hi&&!lo)return 0;return(hi*4294967296+lo)*Math.pow(2,e-16383-63)}
function pcmToBuffer(dv,off,frames,ch,bits,float,little,sr){
  const b=ctx.createBuffer(ch,Math.max(1,frames),sr),outs=[];for(let c=0;c<ch;c++)outs.push(b.getChannelData(c));const by=bits/8;
  for(let i=0;i<frames;i++)for(let c=0;c<ch;c++){const o=off+(i*ch+c)*by;if(o+by>dv.byteLength)return b;let v;
    if(float)v=bits===64?dv.getFloat64(o,little):dv.getFloat32(o,little);
    else if(bits===8)v=(dv.getInt8(o))/128;else if(bits===16)v=dv.getInt16(o,little)/32768;
    else if(bits===24){const b0=dv.getUint8(o),b1=dv.getUint8(o+1),b2=dv.getUint8(o+2);let x=little?(b2<<16)|(b1<<8)|b0:(b0<<16)|(b1<<8)|b2;if(x&0x800000)x-=0x1000000;v=x/8388608}
    else v=dv.getInt32(o,little)/2147483648;outs[c][i]=v}
  return b}
function parseAIFF(ab){const dv=new DataView(ab),tag=s=>String.fromCharCode(...new Uint8Array(ab,s,4));if(tag(0)!=='FORM')return null;const kind=tag(8);let p=12,ch,frames,bits,sr,comp='NONE',ss=-1;
  while(p+8<=ab.byteLength){const id=tag(p),sz=dv.getUint32(p+4),d=p+8;
    if(id==='COMM'){ch=dv.getUint16(d);frames=dv.getUint32(d+2);bits=dv.getUint16(d+6);sr=ext80(dv,d+8);if(kind==='AIFC'&&sz>=22)comp=tag(d+18)}
    if(id==='SSND')ss=d+8+dv.getUint32(d);p=d+sz+(sz&1)}
  if(ss<0||!ch)return null;const c=comp.toLowerCase();if(!['none','sowt','fl32','fl64','in24','in32','twos'].includes(c))throw new Error('AIFF compressé ('+comp+') non pris en charge');
  const fl=c==='fl32'||c==='fl64';return pcmToBuffer(dv,ss,frames,ch,c==='fl64'?64:c==='fl32'?32:bits,fl,c==='sowt',sr)}
function parseCAF(ab){const dv=new DataView(ab),tag=s=>String.fromCharCode(...new Uint8Array(ab,s,4));if(tag(0)!=='caff')return null;let p=8,desc=null,data=-1,dlen=0;
  while(p+12<=ab.byteLength){const id=tag(p),hi=dv.getInt32(p+4),lo=dv.getUint32(p+8),sz=hi<0?ab.byteLength-p-12:hi*4294967296+lo,d=p+12;
    if(id==='desc')desc={sr:dv.getFloat64(d),fmt:tag(d+8),flags:dv.getUint32(d+12),bpp:dv.getUint32(d+16),ch:dv.getUint32(d+24),bits:dv.getUint32(d+28)};
    if(id==='data'){data=d+4;dlen=sz-4}p=d+sz}
  if(!desc||data<0)return null;if(desc.fmt!=='lpcm')throw new Error('CAF compressé ('+desc.fmt+') non pris en charge');
  const fl=!!(desc.flags&1),little=!!(desc.flags&2),frames=Math.floor(dlen/(desc.ch*desc.bits/8));return pcmToBuffer(dv,data,frames,desc.ch,desc.bits,fl,little,desc.sr)}
function parseWAV(ab){const dv=new DataView(ab),tag=s=>String.fromCharCode(...new Uint8Array(ab,s,4));if(tag(0)!=='RIFF'&&tag(0)!=='RF64')return null;let p=12,fmt=null,data=-1,dlen=0;
  while(p+8<=ab.byteLength){const id=tag(p),sz=dv.getUint32(p+4,true),d=p+8;if(id==='fmt '){let f=dv.getUint16(d,true);if(f===0xFFFE)f=dv.getUint16(d+24,true);fmt={f,ch:dv.getUint16(d+2,true),sr:dv.getUint32(d+4,true),bits:dv.getUint16(d+14,true)}}
    if(id==='data'){data=d;dlen=sz===0xffffffff?ab.byteLength-d:Math.min(sz,ab.byteLength-d)}p=d+sz+(sz&1)}
  if(!fmt||data<0)return null;return pcmToBuffer(dv,data,Math.floor(dlen/(fmt.ch*fmt.bits/8)),fmt.ch,fmt.bits,fmt.f===3,true,fmt.sr)}
function wavTimeRef(ab){try{const dv=new DataView(ab),tag=s=>String.fromCharCode(...new Uint8Array(ab,s,4));if(tag(0)!=='RIFF')return null;let p=12,sr=0,tr=null;
  while(p+8<=ab.byteLength){const id=tag(p),sz=dv.getUint32(p+4,true),d=p+8;if(id==='fmt ')sr=dv.getUint32(d+4,true);if(id==='bext'&&sz>=346)tr=dv.getUint32(d+338,true)+dv.getUint32(d+342,true)*4294967296;if(id==='data')break;p=d+sz+(sz&1)}
  return tr!=null&&sr?tr/sr:null}catch(e){return null}}
async function decodeAny(file){const ab=await file.arrayBuffer();let b=null;
  try{b=await ctx.decodeAudioData(ab.slice(0))}catch(e){}
  if(!b){b=parseAIFF(ab)||parseCAF(ab)||parseWAV(ab)}
  if(!b)throw new Error('format non reconnu');return{buf:b,tref:wavTimeRef(ab)}}
// --- plist (XML ou binaire) pour MetaData.plist de Logic ---
function parsePlist(ab){const u=new Uint8Array(ab);if(String.fromCharCode(...u.slice(0,6))==='bplist')return parseBplist(ab);
  const doc=new DOMParser().parseFromString(new TextDecoder().decode(u),'application/xml');const conv=n=>{if(!n)return null;switch(n.tagName){
    case'dict':{const o={},ks=[...n.children];for(let i=0;i<ks.length;i+=2)o[ks[i].textContent]=conv(ks[i+1]);return o}
    case'array':return[...n.children].map(conv);case'integer':case'real':return+n.textContent;case'true':return true;case'false':return false;default:return n.textContent}};
  return conv(doc.querySelector('plist>*'))}
function parseBplist(ab){const dv=new DataView(ab),n=ab.byteLength,offSz=dv.getUint8(n-26),refSz=dv.getUint8(n-25),num=Number(dv.getBigUint64(n-24)),top=Number(dv.getBigUint64(n-16)),tbl=Number(dv.getBigUint64(n-8));
  const rd=(o,s)=>{let v=0;for(let i=0;i<s;i++)v=v*256+dv.getUint8(o+i);return v},offs=[];for(let i=0;i<num;i++)offs.push(rd(tbl+i*offSz,offSz));
  const obj=i=>{const o=offs[i],m=dv.getUint8(o),t=m>>4;let c=m&15,p=o+1;const len=()=>{if(c===15){const k=dv.getUint8(p)&15,s=1<<k;c=rd(p+1,s);p+=1+s}return c};
    if(t===0)return m===8?false:m===9?true:null;if(t===1)return rd(p,1<<c);if(t===2)return c===2?dv.getFloat32(p):dv.getFloat64(p);
    if(t===5){const l=len();return String.fromCharCode(...new Uint8Array(ab,p,l))}if(t===6){const l=len(),a=[];for(let k=0;k<l;k++)a.push(dv.getUint16(p+2*k));return String.fromCharCode(...a)}
    if(t===10){const l=len(),a=[];for(let k=0;k<l;k++)a.push(obj(rd(p+k*refSz,refSz)));return a}
    if(t===13){const l=len(),r={};for(let k=0;k<l;k++)r[obj(rd(p+k*refSz,refSz))]=obj(rd(p+(l+k)*refSz,refSz));return r}return null};
  return obj(top)}
// --- MIDI (.mid) ---
function parseMIDI(ab){const dv=new DataView(ab),u=new Uint8Array(ab),tag=p=>String.fromCharCode(...u.slice(p,p+4));if(tag(0)!=='MThd')throw new Error('pas un fichier MIDI');
  const ntr=dv.getUint16(10),div=dv.getUint16(12);if(div&0x8000)throw new Error('MIDI en temps SMPTE non pris en charge');let p=14,tempo=null,sig=null;const tracks=[];
  for(let t=0;t<ntr&&p+8<=u.length;t++){if(tag(p)!=='MTrk')break;const len=dv.getUint32(p+4),end=p+8+len;let q=p+8,tick=0,rs=0,name='';const on={},notes=[],prog={};
    const vlq=()=>{let v=0,b;do{b=u[q++];v=(v<<7)|(b&127)}while(b&128);return v};
    while(q<end){tick+=vlq();let st=u[q];if(st&128){q++;if(st<0xF0)rs=st}else st=rs;
      if(st===0xFF){const ty=u[q++],l=vlq();if(ty===0x51&&tempo==null)tempo=60000000/((u[q]<<16)|(u[q+1]<<8)|u[q+2]);if(ty===0x58&&!sig)sig=u[q];if(ty===0x03&&!name)name=new TextDecoder().decode(u.slice(q,q+l));q+=l;continue}
      if(st===0xF0||st===0xF7){q+=vlq();continue}
      const c=st&15,ty=st>>4,a=u[q++],b=(ty===0xC||ty===0xD)?0:u[q++];
      if(ty===0x9&&b>0){(on[c+':'+a]=on[c+':'+a]||[]).push([tick,b])}
      else if(ty===0x8||(ty===0x9&&b===0)){const s=on[c+':'+a]&&on[c+':'+a].shift();if(s)notes.push({c,p:a,s:s[0]/div,l:Math.max(.01,(tick-s[0])/div),v:s[1]/127})}
      else if(ty===0xC)prog[c]=a}
    tracks.push({name,notes,prog});p=end}
  return{tempo,sig,tracks}}
const GM_DRUM={35:'kick',36:'kick',38:'snare',40:'snare',39:'clap',42:'hat',44:'hat',46:'ohat',37:'rim',56:'rim',75:'rim'};
function importMIDIData(m,base){
  let made=0;const startIdx=P.tracks.length;
  m.tracks.forEach((tr,ti)=>{const byCh={};for(const n of tr.notes)(byCh[n.c]=byCh[n.c]||[]).push(n);
    for(const c in byCh){const ns=byCh[c],last=Math.max(...ns.map(n=>n.s+n.l)),len=Math.max(P.sig,Math.ceil(last/P.sig)*P.sig),nm=(tr.name||base||'MIDI').slice(0,22)+(Object.keys(byCh).length>1?' ch'+(+c+1):'');
      if(+c===9){const t=newTrack('drums',nm);for(let b0=0;b0<len;b0+=16){const pat=emptyPat(64);for(const n of ns){if(n.s<b0||n.s>=b0+16)continue;const row=GM_DRUM[n.p]||'perc',k=Math.round((n.s-b0)*4);if(k<64){const cur=pat.rows[row][k];pat.rows[row][k]=cur?{v:Math.max(cur.v,n.v),r:Math.min(4,(cur.r||1)+1)}:{v:Math.max(.3,n.v),r:1}}}
          t.regions.push({id:uid('r'),start:b0,len:Math.min(16,len-b0),pat,name:'Rythme '+(b0/16+1)})}P.tracks.push(t);made++}
      else{const t=newTrack('synth',nm),pg=tr.prog[c];const preset=pg>=32&&pg<=39?'Basse 808':pg>=88&&pg<=95?'Pad nuage':pg>=80&&pg<=87?'Lead':pg>=8&&pg<=15?'Cloche':pg>=72&&pg<=79?'Flûte':'Piano doux';
        t.instr=deep(SYNTH_PRESETS[preset]);t.preset=preset;t.regions.push({id:uid('r'),start:0,len,notes:ns.map(n=>({p:n.p,s:n.s,l:n.l,v:+n.v.toFixed(2)})),name:nm});P.tracks.push(t);made++}}});
  P.tracks.slice(startIdx).forEach((t,i)=>t.color=PALETTE[(i*3+4)%PALETTE.length]);return made}
// --- import global (glisser-déposer, sélecteur de dossier ou de fichiers) ---
async function importDropped(items,dropBeat,dropTrack){
  const files=items.filter(x=>x&&x.file),isLogic=files.some(x=>/\.logicx\//i.test(x.path)||/(^|\/)Alternatives\/\d+\//.test(x.path)||/ProjectData$/.test(x.path));
  const busy=modal([h('h2',null,isLogic?'🍎 Import du projet Logic…':'📥 Import…'),h('p',{id:'impTxt'},'Lecture des fichiers…')]);const say=t=>{const e=document.getElementById('impTxt');if(e)e.textContent=t};
  try{
    let meta=null;const mp=files.filter(x=>/Alternatives\/(\d+)\/MetaData\.plist$/.test(x.path)).sort((a,b)=>a.path.localeCompare(b.path))[0];
    if(mp)try{meta=parsePlist(await mp.file.arrayBuffer())}catch(e){console.warn('MetaData.plist',e)}
    let audio=files.filter(x=>AUDIO_RE.test(x.file.name)&&!/(^|\/)(Bounces|Undo Data|Freeze Files|Samples?\/|Sampler Files|Impulse Responses)\//i.test(x.path));
    if(meta&&Array.isArray(meta.AudioFiles)&&meta.AudioFiles.length){const used=new Set(meta.AudioFiles.map(s=>String(s).split('/').pop()));const f2=audio.filter(x=>used.has(x.file.name));if(f2.length)audio=f2}
    const midi=files.filter(x=>MIDI_RE.test(x.file.name));
    if(!audio.length&&!midi.length){busy.remove();return toast(isLogic?'Aucun fichier audio trouvé dans ce projet Logic (voir ☰ Fichier → Importer depuis Logic Pro)':'Aucun fichier audio ou MIDI reconnu',6000)}
    snapshot();
    if(meta){const bpm=+meta.BeatsPerMinute;if(bpm>=40&&bpm<=250)P.bpm=Math.round(bpm*100)/100;
      const k=String(meta.SongKey||'').replace('♯','#').replace('♭','b').trim(),EN=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],FL={Db:1,Eb:3,Gb:6,Ab:8,Bb:10};
      const ki=EN.indexOf(k)>=0?EN.indexOf(k):FL[k];if(ki!=null){P.key=ki;P.scaleIdx=/minor|mineur/i.test(meta.SongGenderKey||'')?0:1}
      const num=+meta.SongSignatureNumerator;if([3,4,6].includes(num))P.sig=num}
    let made=0;
    for(const x of midi){say('MIDI : '+x.file.name);try{const m=parseMIDI(await x.file.arrayBuffer());if(m.tempo&&!meta)P.bpm=Math.round(m.tempo*100)/100;if(m.sig&&[3,4,6].includes(m.sig)&&!meta)P.sig=m.sig;made+=importMIDIData(m,x.file.name.replace(MIDI_RE,''))}catch(e){toast(x.file.name+' : '+e.message,5000)}}
    // audio : une piste par nom (prises « Nom#03 » regroupées), position d'origine si horodatage BWF
    const dec=[];let i=0;for(const x of audio){say('Audio '+(++i)+'/'+audio.length+' : '+x.file.name);try{const d=await decodeAny(x.file);dec.push(Object.assign(d,{name:x.file.name}))}catch(e){console.warn(e);toast(x.file.name+' : '+e.message,4000)}await pause()}
    const trs=dec.filter(d=>d.tref!=null).map(d=>d.tref);let base=null;
    if(trs.length){const mn=Math.min(...trs);base=trs.every(t=>t>=3600&&t<7200)?3600:mn}
    const placeSingle=dec.length===1&&!isLogic&&dropBeat!=null;
    const groups={};for(const d of dec){const key=d.name.replace(AUDIO_RE,'').replace(/#\d+$/,'').trim()||'Audio';(groups[key]=groups[key]||[]).push(d)}
    let ci=0;
    for(const g in groups){let t=placeSingle&&dropTrack&&findTrack(dropTrack);if(t&&!isInstru(t))t=null;
      if(!t){t=newTrack('audio',g.slice(0,24));t.role='instru';t.plugins=[];t.sends=P.auxes.map(()=>-60);t.vol=-3;t.color=PALETTE[(ci++*3+1)%PALETTE.length];P.tracks.push(t)}
      const regs=groups[g].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).map(d=>{const secs=base!=null&&d.tref!=null?Math.max(0,d.tref-base):0;const id=addBuffer(d.buf);
        return{id:uid('r'),start:placeSingle?dropBeat:+(secs/spb()).toFixed(4),offset:0,dur:d.buf.duration,buf:id,name:d.name}});
      regs.forEach((r,k)=>{const ov=regs.slice(k+1).some(o=>o.start<r.start+r.dur/spb()&&r.start<o.start+o.dur/spb());if(ov)r.mute=true;t.regions.push(r)});made++}
    busy.remove();E.build(P);renderAll();zoomFit();
    toast((isLogic?'Projet Logic importé : ':'Importé : ')+made+' piste'+(made>1?'s':'')+(meta?' · '+P.bpm+' BPM · '+NOTE_NAMES[P.key]+' '+Object.keys(SCALES)[P.scaleIdx]:'')+' — Ctrl+Z pour annuler',7000);
    if(isLogic)setTimeout(()=>modal([h('h2',null,'🍎 Projet Logic importé'),h('p',null,'Studio a récupéré '+dec.length+' fichier'+(dec.length>1?'s':'')+' audio'+(meta?', le tempo, la tonalité et la mesure':'')+'.'),
      h('p',{style:{color:'var(--dim)'}},'Le montage interne de Logic (découpes, plugins, automation, instruments Logic) est dans un format fermé d’Apple qu’aucun autre logiciel ne peut relire. Pour retrouver exactement votre arrangement : dans Logic, Fichier → Exporter → « Toutes les pistes en fichiers audio » (et « Sélection en fichier MIDI » pour les instruments), puis glissez ces fichiers ici.'),
      h('p',{style:{color:'var(--dim)'}},'Les prises qui se chevauchent sur une même piste sont gardées, seule la dernière est active (les autres sont muettes : Ctrl+M pour en changer).')]),400);
  }catch(e){busy.remove();console.error(e);alert('Import impossible : '+e.message)}
}
function logicImportDialog(){
  const pick=(dir)=>{const inp=h('input',{type:'file',multiple:true,style:{display:'none'}});if(dir){inp.webkitdirectory=true;inp.setAttribute('webkitdirectory','')}else inp.accept='audio/*,.wav,.aif,.aiff,.caf,.mp3,.m4a,.mid,.midi';
    inp.onchange=()=>{const items=[...inp.files].map(f=>({file:f,path:f.webkitRelativePath||f.name}));inp.remove();if(items.length)importDropped(items,null,null)};document.body.append(inp);inp.click()};
  const m=modal([h('h2',null,'🍎 Importer depuis Logic Pro'),
    h('h4',null,'1. Le projet Logic entier'),h('p',null,'Glissez le fichier ',h('b',null,'.logicx'),' directement dans la fenêtre de Studio. Studio récupère tous les sons, le tempo, la tonalité et la mesure, et replace les prises à leur position quand c’est possible.'),
    h('button',{onclick:()=>{m.remove();pick(true)}},'📁 Choisir le dossier du projet…'),h('p',{style:{color:'var(--dim)',fontSize:'11px'}},'Si le sélecteur n’accepte pas le .logicx : clic droit dessus dans le Finder → « Afficher le contenu du paquet », puis choisissez ce dossier — ou glissez simplement le .logicx dans Studio.'),
    h('h4',null,'2. Le plus fidèle : les pistes exportées'),h('p',null,'Dans Logic : ',h('b',null,'Fichier → Exporter → Toutes les pistes en fichiers audio…'),' Puis glissez tous les fichiers ici : chaque piste arrive sur sa propre piste, calée au début.'),
    h('h4',null,'3. Les instruments en MIDI'),h('p',null,'Dans Logic : sélectionnez les régions MIDI → ',h('b',null,'Fichier → Exporter → Sélection en fichier MIDI…'),' Studio crée des pistes 🎹 avec les notes (et 🥁 pour la batterie), au bon tempo.'),
    h('button',{onclick:()=>{m.remove();pick(false)}},'🎵 Choisir des fichiers audio / MIDI…'),
    h('p',{style:{color:'var(--dim)',fontSize:'11px',marginTop:'8px'}},'Formats lus : WAV/BWF, AIFF, CAF, MP3, M4A, FLAC, MIDI. Les plugins et l’automation de Logic ne peuvent pas être repris (format fermé d’Apple).')]);
}
