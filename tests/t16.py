# v3.2 : session entre « appareils » différents (contextes séparés, pas de BroadcastChannel commun) via le faux Supabase
# Prérequis : python3 -m http.server 8765 (racine) + node tests/mock_supabase.js 8790
import asyncio,json,urllib.request
from playwright.async_api import async_playwright
URL='http://localhost:8765/';MOCK='http://localhost:8790'
INIT="localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.2');localStorage.setItem('studio_supa',JSON.stringify({url:'%s',key:'test'}));localStorage.setItem('studio_user',JSON.stringify({name:'%s',color:'%s'}))"
mock=lambda p: json.loads(urllib.request.urlopen(MOCK+p).read())
async def device(b,name,col,errs):
  c=await b.new_context(viewport={'width':1280,'height':800});await c.add_init_script(INIT%(MOCK,name,col))
  pg=await c.new_page();pg.on('pageerror',lambda e: errs.append(name+':'+str(e)));return c,pg
async def main():
  mock('/__reset')
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required']);errs=[]
    ca,A=await device(b,'Alice','#ff453a',errs);cb,B=await device(b,'Bob','#30d158',errs)
    await A.goto(URL);await A.wait_for_timeout(1500);await A.evaluate("collabStart(newRoom(),true)");await A.wait_for_timeout(800)
    room=await A.evaluate("COLLAB.room");print('salle',room,'longueur',len(room),'connexion A',await A.evaluate("NET.state"),'salle en base',mock('/__stats')['dbPost']>0)
    await B.goto(URL+'#room='+room);await B.wait_for_timeout(3500)
    view="JSON.stringify(sharedView(P))";same=lambda: asyncio.gather(A.evaluate(view),B.evaluate(view))
    a,bb=await same();print('B a rejoint via le serveur',a==bb,await B.evaluate("[COLLAB.synced,NET.state,!!COLLAB.ch]"),'présence',await A.evaluate("Object.values(COLLAB.peers).map(p=>p.user.name)"),await B.evaluate("Object.values(COLLAB.peers).map(p=>p.user.name)"))
    await A.evaluate("snapshot();P.tracks[0].vol=-6;P.bpm=145");await A.wait_for_timeout(600);print('A→B',await B.evaluate("[P.tracks[0].vol,P.bpm]"))
    t1=await B.evaluate("P.tracks[1].id");await B.evaluate(f"toggleLock('{t1}')");await B.wait_for_timeout(600)
    await A.evaluate(f"snapshot();findTrack('{t1}').vol=-30");await A.wait_for_timeout(500)
    print('cadenas de Bob respecté chez Alice',await A.evaluate(f"[(lockedByOther('{t1}')||{{}}).n,findTrack('{t1}').vol]"))
    # son : Alice ajoute un son, il passe par le stockage
    await A.evaluate("""(()=>{const sr=ctx.sampleRate,buf=ctx.createBuffer(2,sr*2,sr);for(let c=0;c<2;c++){const d=buf.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=Math.sin(i/(8+c))*.4}
      const id=addBuffer(buf);const t=P.tracks.find(t=>t.type==='audio');snapshot();t.regions.push({id:uid('r'),start:20,offset:0,dur:2,buf:id,name:'prise'});renderLanes();window._bid=id})()""")
    bid=await A.evaluate("_bid");await A.evaluate("uploadBufs()");await B.wait_for_timeout(5500)
    print('son reçu par B',await B.evaluate(f"BUFS['{bid}']?[BUFS['{bid}'].numberOfChannels,BUFS['{bid}'].duration.toFixed(2)]:null"),'envois/téléchargements',mock('/__stats')['up'],mock('/__stats')['down'])
    # gros projet : message découpé en morceaux
    await A.evaluate("const t=P.tracks.find(t=>t.type==='synth');snapshot();for(let i=0;i<6000;i++)t.regions[0].notes.push({p:40+i%40,s:(i%64)/4,l:.25,v:.7})");await A.wait_for_timeout(1500)
    a,bb=await same();print('6000 notes d’un coup → identique',a==bb,'taille max message',mock('/__stats')['maxPayload'])
    await A.evaluate("snapshot();P.tracks[0].regions[0].name=Array.from({length:300000},()=>String.fromCharCode(65+Math.random()*26|0)).join('')");await A.wait_for_timeout(1500)
    a,bb=await same();print('message de 300 Ko découpé → identique',a==bb,'taille max envoyée',mock('/__stats')['maxPayload'])
    await A.evaluate("snapshot();P.tracks[0].regions[0].name='Rythme'");await A.wait_for_timeout(500)
    # coupure réseau : chacun travaille, puis retour
    mock('/__drop');await A.wait_for_timeout(300);print('après coupure',await A.evaluate("NET.state"),await B.evaluate("NET.state"))
    await A.evaluate("snapshot();P.tracks[2].name='Hors-ligne A'");await B.evaluate("snapshot();P.tracks[3].vol=-14;addTrack('drums')")
    await A.wait_for_timeout(4000);a,bb=await same()
    print('reconnexion',await A.evaluate("NET.state"),await B.evaluate("NET.state"),'→ modifs fusionnées',a==bb,await A.evaluate("[P.tracks[2].name,P.tracks[3].vol,P.tracks.length]"))
    # tout le monde part, puis Chloé arrive plus tard : le projet vient de la base
    await A.evaluate("collabStop(true)");await B.close();await cb.close();await A.wait_for_timeout(800)
    final=a;cc,C=await device(b,'Chloé','#0a84ff',errs);await C.goto(URL+'#room='+room);await C.wait_for_timeout(4000)
    cv=await C.evaluate(view);print('Chloé seule, plus tard : projet retrouvé',json.loads(cv)==json.loads(final),'cadenas fantômes',await C.evaluate("COLLAB.locks.size"),'son',await C.evaluate(f"!!BUFS['{bid}']"))
    print('stats',mock('/__stats'));print('ERR',errs);await b.close()
asyncio.run(main())
