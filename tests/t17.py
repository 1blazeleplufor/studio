# v3.3 : sons en FLAC découpés + progression, écouter ensemble, chat, commentaires, versions, Mes sessions, lien écoute seule, bounce MP3
# Prérequis : python3 -m http.server 8765 (racine) + LIMIT=400000 node tests/mock_supabase.js 8790
import asyncio,json,urllib.request,subprocess
from playwright.async_api import async_playwright
URL='http://localhost:8765/';MOCK='http://localhost:8790'
INIT="localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.3');localStorage.setItem('studio_part','300000');localStorage.setItem('studio_supa',JSON.stringify({url:'%s',key:'test'}));localStorage.setItem('studio_user',JSON.stringify({name:'%s',color:'%s'}))"
mock=lambda p: json.loads(urllib.request.urlopen(MOCK+p).read())
async def device(b,name,col,errs):
  c=await b.new_context(viewport={'width':1280,'height':800});await c.add_init_script(INIT%(MOCK,name,col))
  pg=await c.new_page();pg.on('pageerror',lambda e: errs.append(name+':'+str(e)));return c,pg
async def main():
  mock('/__reset')
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required']);errs=[]
    ca,A=await device(b,'Alice','#ff453a',errs);cb,B=await device(b,'Bob','#30d158',errs)
    await A.goto(URL);await A.wait_for_timeout(1500);await A.evaluate("collabStart(newRoom(),true)");await A.wait_for_timeout(800);room=await A.evaluate("COLLAB.room")
    await B.goto(URL+'#room='+room);await B.wait_for_timeout(3500)
    view="JSON.stringify(sharedView(P))"
    print('B a rejoint',await A.evaluate(view)==await B.evaluate(view),'barre sans débordement',await A.evaluate("$('#bar').scrollWidth-$('#bar').clientWidth"))
    # 1. son : FLAC découpé en morceaux de 300 Ko, progression, réception identique
    await A.evaluate("""(()=>{const sr=48000,buf=ctx.createBuffer(2,sr*6,sr);let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;
      for(let c=0;c<2;c++){const d=buf.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=.4*Math.sin(i*2*Math.PI*(110+c*55)/sr)+.15*(r()-.5)}
      window._id=addBuffer(buf);const t=P.tracks.find(t=>t.type==='audio');snapshot();t.regions.push({id:uid('r'),start:20,offset:0,dur:6,buf:_id,name:'prod'});renderLanes()})()""")
    bid=await A.evaluate("_id");seen=False
    for i in range(30):
      await A.wait_for_timeout(300);seen=seen or await A.evaluate("!!document.querySelector('#xfers .xf')")
      if await B.evaluate(f"!!BUFS['{bid}']"):break
    files={k:v for k,v in mock('/__files').items() if k.startswith(bid)}
    same=await B.evaluate(f"""(()=>{{const a=BUFS['{bid}'];return [a.numberOfChannels,a.length,a.sampleRate]}})()""")
    diff=await A.evaluate(f"""(async()=>{{const r=await fetch('{MOCK}/storage/v1/object/public/sons/{bid}.0.flac');return r.status}})()""")
    q=await B.evaluate(f"""(async()=>{{const m=MEDIA().get('{bid}'),parts=[];for(let i=0;i<m.n;i++)parts.push(new Uint8Array(await (await fetch(SUPA.url+'/storage/v1/object/public/sons/{bid}.'+i+'.flac')).arrayBuffer()));
      const all=new Uint8Array(parts.reduce((a,p)=>a+p.length,0));let o=0;for(const p of parts){{all.set(p,o);o+=p.length}}
      const ab=await new OfflineAudioContext(2,1,48000).decodeAudioData(all.buffer);return Array.from(ab.getChannelData(1).subarray(48000,48010)).map(v=>Math.round(v*32767))}})()""")
    q0=await A.evaluate(f"""(()=>{{const a=BUFS['{bid}'].getChannelData(1);return Array.from(a.subarray(48000,48010)).map(v=>Math.round(v*32767))}})()""")
    print('son FLAC : morceaux',sorted(files.items()),'| panneau de progression vu',seen,'| reçu par B',same,'| échantillons identiques (16 bits)',q==q0,'| doc media',await B.evaluate(f"JSON.stringify(MEDIA().get('{bid}'))"))
    # 2. trop gros pour le serveur : message clair
    print('erreur taille',await A.evaluate(f"xhrUpload(SUPA.url+'/storage/v1/object/sons/gros.flac',new Uint8Array(500000),'audio/flac').then(()=>'ok',e=>e.message)"))
    # 3. écouter ensemble
    await A.evaluate("PH=4;play()");await A.wait_for_timeout(1200);pa,pb=await asyncio.gather(A.evaluate("E.pos()"),B.evaluate("E.playing?E.pos():null"))
    print('écouter ensemble : B joue',pb is not None,'écart (temps)',round(abs(pa-pb),3) if pb else None)
    await A.evaluate("stopBtn()");await A.wait_for_timeout(500);print('stop partagé',not await B.evaluate("E.playing"))
    await B.evaluate("toggleFollow()");await A.evaluate("play()");await A.wait_for_timeout(600);print('B en solo ne suit pas',not await B.evaluate("E.playing"));await A.evaluate("stopBtn()");await B.evaluate("toggleFollow()")
    # 4. chat
    await A.evaluate("chatSend('salut Bob 🔥')");await B.wait_for_timeout(500)
    print('chat',await B.evaluate("CHAT().toArray().map(m=>m.n+':'+m.x)"),'badge B',await B.evaluate("$('#collabBar .chatb').dataset.n"))
    await B.evaluate("openPanel('chat')");await B.wait_for_timeout(200);await B.fill('#cpanel .cin input','yo');await B.keyboard.press('Enter');await A.wait_for_timeout(500)
    print('réponse tapée par B',await A.evaluate("CHAT().toArray().map(m=>m.x)"),'badge B remis à zéro',await B.evaluate("$('#collabBar .chatb').dataset.n"))
    await B.screenshot(path='/home/claude/test/v33_chat.png')
    # 5. commentaires
    await B.evaluate("cmtAdd(8,'refais ce couplet ici')");await A.wait_for_timeout(500)
    print('commentaire vu par A',await A.evaluate("cmtList().map(c=>c.n+'@'+c.beat+':'+c.x)"),'épingle',await A.evaluate("document.querySelectorAll('#lanes .cpin').length"))
    cid=await A.evaluate("cmtList()[0].id");await A.evaluate(f"cmtReply('{cid}','ok je m’en occupe');cmtSet('{cid}','done',true)");await B.wait_for_timeout(500)
    print('réponse + résolu chez B',await B.evaluate("[cmtList()[0].rep.length,cmtList()[0].done,document.querySelectorAll('#lanes .cpin').length]"))
    await A.evaluate("openPanel('cmts')");await A.wait_for_timeout(200);await A.screenshot(path='/home/claude/test/v33_cmts.png')
    # 6. versions
    await A.evaluate("versionSave('avant le mix',false)");await A.wait_for_timeout(500);bpm0=await A.evaluate("P.bpm")
    await A.evaluate("snapshot();P.bpm=99;P.tracks[0].name='Changé'");await A.wait_for_timeout(500)
    await A.evaluate("versionsLoad()");await A.wait_for_timeout(300);v=await A.evaluate("C2.vers.find(v=>v.nom==='avant le mix')")
    await A.evaluate(f"versionRestore({json.dumps(v)})");await A.wait_for_timeout(1200)
    print('version rétablie',await A.evaluate("[P.bpm,P.tracks[0].name]"),'chez B',await B.evaluate("[P.bpm,P.tracks[0].name]"),'liste',await A.evaluate("C2.vers.map(v=>v.nom)"))
    await A.evaluate("undo()");await A.wait_for_timeout(600);print('Ctrl+Z après retour',await B.evaluate("P.bpm"))
    await A.evaluate("openPanel('vers')");await A.wait_for_timeout(300);await A.screenshot(path='/home/claude/test/v33_vers.png')
    # 7. lien écoute seule
    tok=await A.evaluate("COLLAB.doc.getMap('meta').get('listen')");cv,V=await device(b,'Vic','#bf5af2',errs)
    await V.goto(URL+'#ecoute='+tok);await V.wait_for_timeout(5000)
    print('auditeur synchro',await V.evaluate("COLLAB.synced"),'même projet',await V.evaluate("JSON.stringify(Object.assign(sharedView(P),{id:0}))")==await A.evaluate("JSON.stringify(Object.assign(sharedView(P),{id:0}))"),'ne connaît pas la salle',room not in await V.evaluate("location.href+JSON.stringify(COLLAB.doc.toJSON())+localStorage.getItem('studio_rooms')"))
    await V.evaluate("snapshot();P.bpm=60;P.tracks[0].vol=-30");await V.wait_for_timeout(600)
    print('auditeur ne peut pas modifier',await V.evaluate("[P.bpm,P.tracks[0].vol]"),'A inchangé',await A.evaluate("[P.bpm,P.tracks[0].vol]"),'toast',await V.evaluate("$('#toast').textContent.slice(0,30)"))
    await V.evaluate("chatSend('trop lourd 🔥');cmtAdd(12,'le drop ici !')");await A.wait_for_timeout(1200)
    print('chat/comm. de l’auditeur relayés',await A.evaluate("CHAT().toArray().slice(-1)[0].n+' : '+CHAT().toArray().slice(-1)[0].x"),await B.evaluate("cmtList().map(c=>c.n+':'+c.x)"),'→ auditeur les voit',await V.evaluate("CHAT().toArray().length"))
    await A.evaluate("snapshot();P.tracks[1].name='Basse modifiée'");await V.wait_for_timeout(800);print('modif éditeur → auditeur',await V.evaluate("P.tracks[1].name"))
    await V.wait_for_timeout(2500);print('son reçu par l’auditeur',await V.evaluate(f"!!BUFS['{bid}']"))
    await A.evaluate("play()");await V.wait_for_timeout(800);print('auditeur suit la lecture',await V.evaluate("E.playing"));await A.evaluate("stopBtn()")
    print('présence côté A',await A.evaluate("Object.values(COLLAB.peers).map(p=>p.user.name+':'+p.user.role)"))
    await V.screenshot(path='/home/claude/test/v33_viewer.png')
    # relais qui part : un autre éditeur prend le relais
    await A.evaluate("collabStop(true)");await A.wait_for_timeout(5000)
    await B.evaluate("snapshot();P.tracks[2].name='Après départ A'");await V.wait_for_timeout(1500);print('B devient relais',await B.evaluate("isRelay()"),'auditeur reçoit',await V.evaluate("P.tracks[2].name"))
    # 8. Mes sessions
    print('Mes sessions (A)',await A.evaluate("myRooms().map(r=>(r.v?'👁':'👥')+r.n)"),'(V)',await V.evaluate("myRooms().map(r=>(r.v?'👁':'👥')+r.n)"))
    await A.evaluate("collabModal()");await A.wait_for_timeout(200);await A.screenshot(path='/home/claude/test/v33_sessions.png');await A.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    # 9. bounce MP3
    r=await B.evaluate("""(async()=>{const buf=await renderMix(P,0,8);const mp3=await encodeMP3(buf,192);const f=newRoom();await xhrUpload(SUPA.url+'/storage/v1/object/sons/bounces/'+f+'.mp3',mp3,'audio/mpeg');return [f,mp3.size,buf.duration]})()""")
    data=urllib.request.urlopen(MOCK+'/storage/v1/object/public/sons/bounces/'+r[0]+'.mp3').read();open('/tmp/b.mp3','wb').write(data)
    pr=subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_name,sample_rate,channels,bit_rate:format=duration','-of','compact','/tmp/b.mp3'],capture_output=True,text=True).stdout.strip()
    print('bounce MP3',r[1],'octets |',pr)
    E2=await cb.new_page();await E2.goto(URL+'ecoute.html#f='+r[0]+'&t=Mon%20son');await E2.wait_for_timeout(800)
    print('page d’écoute',await E2.evaluate("[document.title,document.getElementById('a').src.endsWith('"+r[0]+".mp3')]"))
    print('stats',{k:v for k,v in mock('/__stats').items() if v});print('ERR',errs);await b.close()
asyncio.run(main())
