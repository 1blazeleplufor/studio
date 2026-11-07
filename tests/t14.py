# v3.0 : arrivées simultanées, rechargement, modifications aléatoires des deux côtés → même projet partout
import asyncio,random
from playwright.async_api import async_playwright
URL='http://localhost:8765/'
OPS=["snapshot();const t=P.tracks[R(P.tracks.length)];if(t&&!lockedByOther(t.id))t.vol=-R(30)",
 "snapshot();const t=P.tracks[R(P.tracks.length)];if(t&&!lockedByOther(t.id)&&t.regions[0])t.regions[0].start=R(16)",
 "const t=P.tracks.filter(t=>t.type==='synth'&&!lockedByOther(t.id))[0];if(t&&t.regions[0]){snapshot();t.regions[0].notes.push({p:48+R(24),s:R(16),l:.5,v:.8})}",
 "if(P.tracks.length<9)addTrack(['audio','synth','drums'][R(3)])",
 "const t=P.tracks[R(P.tracks.length)];if(t&&P.tracks.length>3&&!lockedByOther(t.id))delTrack(t)",
 "const t=P.tracks[R(P.tracks.length)];if(t&&!lockedByOther(t.id)){snapshot();t.plugins.push(plug(['eq','comp','delay'][R(3)]));E.updateStrip(t)}",
 "const t=P.tracks[R(P.tracks.length)];if(t&&!lockedByOther(t.id)&&t.plugins[0]){snapshot();t.plugins[0].params[Object.keys(t.plugins[0].params)[0]]=R(100)}",
 "const t=P.tracks[R(P.tracks.length)];if(t)toggleLock(t.id)",
 "undo()","redo()",
 "const t=P.tracks[R(P.tracks.length)];if(t&&!lockedByOther(t.id)){snapshot();t.name='N'+R(99)}",
 "const t=P.tracks[R(P.tracks.length)];if(t)moveTrack(t,R(2)?1:-1)"]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(viewport={'width':1280,'height':800});errs=[]
    await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.0');localStorage.setItem('studio_user',JSON.stringify({name:'X',color:'#30d158'}));localStorage.setItem('studio_supa',JSON.stringify({url:'http://localhost:8790',key:'test'}))")
    pages=[]
    for i in range(3):
      pg=await c.new_page();pg.on('pageerror',lambda e,i=i: errs.append(f'{i}:{e}'));pages.append(pg)
    # 3 arrivées quasi simultanées dans une salle vide
    await asyncio.gather(*[pg.goto(URL+'#room=course1') for pg in pages]);await pages[0].wait_for_timeout(7000)
    st=await asyncio.gather(*[pg.evaluate("[COLLAB.synced,P.tracks.map(t=>t.id).join(','),Object.keys(COLLAB.peers).length]") for pg in pages])
    print('arrivées simultanées : tous synchro',all(s[0] for s in st),'même projet',len(set(s[1] for s in st))==1,'pairs',[s[2] for s in st])
    for k,pg in enumerate(pages):await pg.evaluate(f"ME.name='P{k}';window.R=n=>Math.floor(Math.random()*n)")
    random.seed(4)
    for step in range(120):
      pg=random.choice(pages);op=random.choice(OPS)
      try:await pg.evaluate("(()=>{"+op+"})()")
      except Exception as e:errs.append('op:'+str(e)[:200])
      if random.random()<.3:await pg.wait_for_timeout(random.randint(0,120))
    await pages[0].wait_for_timeout(1500)
    vs=await asyncio.gather(*[pg.evaluate("collabFlush();JSON.stringify(sharedView(P))") for pg in pages])
    docs=await asyncio.gather(*[pg.evaluate("JSON.stringify(COLLAB.root.toJSON())") for pg in pages])
    import json
    same=lambda a,b: json.loads(a)==json.loads(b)
    print('après 120 actions aléatoires : P identique partout',same(vs[0],vs[1]) and same(vs[1],vs[2]),'| P = document',all(same(vs[i],docs[i]) for i in range(3)),'| pistes',await pages[0].evaluate("P.tracks.length"))
    # rechargement d'une fenêtre : elle retrouve la session
    await pages[1].evaluate("toggleLock(P.tracks[0].id)") ;await pages[0].wait_for_timeout(300)
    await pages[1].reload();await pages[1].wait_for_timeout(4000)
    v0,v1=await asyncio.gather(pages[0].evaluate("JSON.stringify(sharedView(P))"),pages[1].evaluate("JSON.stringify(sharedView(P))"))
    print('rechargement : resynchro',same(v0,v1),'cadenas libérés au départ',await pages[0].evaluate("[...COLLAB.locks.values()].filter(L=>L.n==='P1').length"))
    print('ERR',errs[:6],len(errs));await b.close()
asyncio.run(main())
