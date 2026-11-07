# v3.0 : session à plusieurs (2 fenêtres du même navigateur) + cadenas
import asyncio,json
from playwright.async_api import async_playwright
URL='http://localhost:8765/'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(viewport={'width':1440,'height':880});errs=[]
    await c.add_init_script("localStorage.setItem('studio_supa',JSON.stringify({url:'http://localhost:8790',key:'test'}))")
    A=await c.new_page();A.on('pageerror',lambda e: errs.append('A:'+str(e)))
    await A.goto(URL);await A.wait_for_timeout(1500);await A.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    await A.evaluate("ME.name='Alice';ME.color='#ff453a';collabStart('salle1',true);document.querySelectorAll('.modal').forEach(m=>m.remove())")
    B=await c.new_page();B.on('pageerror',lambda e: errs.append('B:'+str(e)))
    await B.goto(URL+'#room=salle1');await B.wait_for_timeout(1500)
    asked=await B.evaluate("!!document.querySelector('.modal input[placeholder]')");print('B demande le nom',asked)
    await B.evaluate("document.querySelectorAll('.modal').forEach(m=>{if(!m.querySelector('input[placeholder]'))m.remove()})")
    await B.fill('.modal input[placeholder]','Bob');await B.keyboard.press('Enter');await B.wait_for_timeout(1500)
    view="JSON.stringify(sharedView(P))"
    eqv=lambda: asyncio.gather(A.evaluate(view),B.evaluate(view))
    a,bb=await eqv();print('synchro initiale',a==bb,'pistes B',await B.evaluate("P.tracks.map(t=>t.name).join(',')"),'synced',await B.evaluate("COLLAB.synced"))
    print('présence A',await A.evaluate("Object.values(COLLAB.peers).map(p=>p.user.name)"),'B',await B.evaluate("Object.values(COLLAB.peers).map(p=>p.user.name)"))
    # modification simple
    await A.evaluate("snapshot();P.tracks[0].vol=-7.5;P.bpm=150");await A.wait_for_timeout(500)
    print('B voit vol/bpm',await B.evaluate("[P.tracks[0].vol,P.bpm,$('#bpm').value]"))
    # cadenas
    t1=await A.evaluate("P.tracks[1].id");await A.evaluate(f"toggleLock('{t1}')");await A.wait_for_timeout(400)
    print('B voit cadenas',await B.evaluate(f"(lockedByOther('{t1}')||{{}}).n"),'head classe',await B.evaluate("document.querySelectorAll('#heads .head')[1].className"),'vol disabled',await B.evaluate("document.querySelectorAll('#heads .head')[1].querySelector('input[type=range]').disabled"))
    await B.evaluate(f"snapshot();findTrack('{t1}').vol=-20;findTrack('{t1}').regions[0].start=8");await B.wait_for_timeout(400)
    print('B modif refusée',await B.evaluate(f"[findTrack('{t1}').vol,findTrack('{t1}').regions[0].start]"),'A intact',await A.evaluate(f"[findTrack('{t1}').vol,findTrack('{t1}').regions[0].start]"),'toast',await B.evaluate("$('#toast').textContent.slice(0,40)"))
    await B.evaluate(f"snapshot();findTrack('{t1}').solo=true");await B.wait_for_timeout(300);print('solo perso autorisé',await B.evaluate(f"findTrack('{t1}').solo"),'A solo',await A.evaluate(f"findTrack('{t1}').solo"))
    await B.evaluate(f"findTrack('{t1}').solo=false")
    # clic réel sur une région verrouillée : rien ne bouge
    reg=await B.evaluate(f"(()=>{{const e=document.querySelector('.lane[data-t=\"{t1}\"] .reg');const r=e.getBoundingClientRect();return [r.left+20,r.top+20]}})()")
    await B.mouse.move(*reg);await B.mouse.down();await B.mouse.move(reg[0]+200,reg[1],steps=5);await B.mouse.up();await B.wait_for_timeout(300)
    print('glisser bloqué',await B.evaluate(f"findTrack('{t1}').regions[0].start"))
    # B verrouille une autre piste, A ne peut pas
    t2=await B.evaluate("P.tracks[2].id");await B.click(f"#heads .head:nth-child(3) .lkb");await B.wait_for_timeout(400)
    print('A voit cadenas de Bob',await A.evaluate(f"(lockedByOther('{t2}')||{{}}).n"),'B le sien',await B.evaluate(f"lockOf('{t2}').n"))
    # modifications simultanées sur des pistes différentes
    await asyncio.gather(A.evaluate("snapshot();P.tracks[3].vol=-3;P.tracks[3].name='Nappe A'"),B.evaluate(f"snapshot();findTrack('{t2}').vol=-9;findTrack('{t2}').regions[0].notes.push({{p:72,s:1,l:1,v:.7}})"))
    await A.wait_for_timeout(700);a,bb=await eqv();print('convergence',a==bb,await A.evaluate(f"[P.tracks[3].name,findTrack('{t2}').vol,findTrack('{t2}').regions[0].notes.length]"))
    # undo par personne
    await B.evaluate("undo()");await B.wait_for_timeout(500)
    print('undo B',await B.evaluate(f"[findTrack('{t2}').vol,findTrack('{t2}').regions[0].notes.length,P.tracks[3].name]"),'A voit',await A.evaluate(f"[findTrack('{t2}').vol,P.tracks[3].name]"))
    await A.evaluate("undo()");await A.wait_for_timeout(500);print('undo A',await A.evaluate("[P.tracks[3].vol,P.tracks[3].name]"),await B.evaluate("P.tracks[3].name"))
    # ajout/suppression de pistes
    await A.evaluate("addTrack('synth')");await A.wait_for_timeout(300);await B.evaluate("delTrack(P.tracks[0])");await A.wait_for_timeout(700)
    a,bb=await eqv();print('pistes après ajout/suppression',a==bb,await A.evaluate("P.tracks.map(t=>t.name).join(',')"))
    # audio : A crée un son, B le reçoit
    await A.evaluate("""(()=>{const sr=ctx.sampleRate,buf=ctx.createBuffer(1,sr,sr),d=buf.getChannelData(0);for(let i=0;i<sr;i++)d[i]=Math.sin(i/10)*.5;const id=addBuffer(buf);const t=P.tracks.find(t=>t.type==='audio');snapshot();t.regions.push({id:uid('r'),start:20,offset:0,dur:1,buf:id,name:'son'});renderLanes();window._bid=id})()""")
    await A.wait_for_timeout(1500);bid=await A.evaluate("_bid");print('B a reçu le son',await B.evaluate(f"!!BUFS['{bid}']&&BUFS['{bid}'].length"))
    # glisser en cours chez B : application différée
    await B.evaluate("POINTER_DOWN=true");await A.evaluate("snapshot();P.bpm=133");await A.wait_for_timeout(400)
    d1=await B.evaluate("P.bpm");await B.evaluate("POINTER_DOWN=false;scheduleApply(10)");await B.wait_for_timeout(300);print('différé pendant glisser',d1,'puis',await B.evaluate("P.bpm"))
    # cadenas tempo
    await A.evaluate("toggleLock('proj')");await A.wait_for_timeout(300);await B.evaluate("snapshot();P.bpm=99");await B.wait_for_timeout(300)
    print('tempo verrouillé',await B.evaluate("P.bpm"),'input disabled',await B.evaluate("$('#bpm').disabled"))
    # expiration (2 min sans nouvelles)
    await B.evaluate(f"COLLAB.lockSeen['{t1}']=Date.now()-130000;decorateLocks()");print('expiré chez B',await B.evaluate(f"lockedByOther('{t1}')"))
    await B.evaluate(f"snapshot();findTrack('{t1}').vol=-11");await B.wait_for_timeout(400);print('modif après expiration',await A.evaluate(f"findTrack('{t1}').vol"))
    # libération manuelle
    await B.click(f"#heads .head:nth-child(2) .lkb") if False else None
    await A.evaluate("toggleLock('proj')");await A.wait_for_timeout(300);await B.evaluate("snapshot();P.bpm=101");await B.wait_for_timeout(400);print('tempo libéré',await A.evaluate("P.bpm"))
    await A.screenshot(path='/home/claude/test/collabA.png');await B.screenshot(path='/home/claude/test/collabB.png')
    print('bar overflow A',await A.evaluate("$('#bar').scrollWidth-$('#bar').clientWidth"))
    # fermeture de B : ses cadenas sont libérés
    await B.close();await A.wait_for_timeout(500);print('après départ de Bob : cadenas',await A.evaluate(f"lockedByOther('{t2}')"),'présents',await A.evaluate("Object.keys(COLLAB.peers).length"))
    a=await A.evaluate("collabStop();[COLLAB.on,location.hash,document.querySelectorAll('.lkb').length]");print('quitter',a)
    print('ERR',errs);await b.close()
asyncio.run(main())
