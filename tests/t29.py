# v3.11 : interface téléphone
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(viewport={'width':390,'height':780},device_scale_factor=2,has_touch=True,is_mobile=True,permissions=['microphone'],user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')
    await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.11.0');localStorage.setItem('studio_mob_tip','1')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)));A.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(2000);E=A.evaluate
    print('MOB',await E("MOB"),'lignes',await E("document.querySelectorAll('#mob .mrow').length"),'régions',await E("document.querySelectorAll('#mob .mreg').length"),'tuiles',await E("document.querySelectorAll('#mob .mreg canvas').length"),'app caché',await E("getComputedStyle(document.querySelector('#app')).display"))
    await A.screenshot(path='/home/claude/test/m1.png')
    # ajouter une voix
    await A.tap('.madd');await A.wait_for_timeout(300);await A.screenshot(path='/home/claude/test/m2.png')
    await A.tap('.mtile');await A.wait_for_timeout(400)
    print('piste voix ajoutée',await E("findTrack(SEL).name"))
    # enregistrer 2 s
    await E("P.settings.countIn=0");await A.tap('#mRec');await A.wait_for_timeout(2500);await A.screenshot(path='/home/claude/test/m3.png')
    print('en cours',await E("!!REC"),'live',await E("document.querySelectorAll('.mlive').length"))
    await A.tap('#mRec');await A.wait_for_timeout(600)
    print('prise',await E("findTrack(SEL).regions.length"),'affichée',await E("document.querySelectorAll('.mlane.sel .mreg').length"))
    # effets
    await A.tap('.mtools .mtl:nth-child(2)');await A.wait_for_timeout(300);await A.screenshot(path='/home/claude/test/m4.png')
    await E("[...document.querySelectorAll('.mfxc')][1].click()");await A.wait_for_timeout(300)
    print('préréglage',await E("findTrack(SEL).preset"),'effets',await E("findTrack(SEL).plugins.length"))
    await E("document.querySelectorAll('.msheet').forEach(x=>x.remove())")
    # sélectionner la prise, couper, dupliquer, supprimer
    await E("document.querySelector('.mlane.sel .mreg').scrollIntoView({inline:'center'})");await A.wait_for_timeout(200)
    bb=await A.locator('.mlane.sel .mreg').first.bounding_box();await A.touchscreen.tap(bb['x']+bb['width']/2,bb['y']+30);await A.wait_for_timeout(300)
    print('sélection',await E("SELR.size"),'outils',await E("[...document.querySelectorAll('.mtools .mtl')].map(b=>b.textContent)"))
    await A.screenshot(path='/home/claude/test/m5.png')
    await E("const r=findRegion([...SELR][0])[1];setPH(r.start+rLen(findTrack(SEL),r)/2)");await A.tap('.mtools .mtl:nth-child(1)');await A.wait_for_timeout(300)
    print('après couper',await E("findTrack(SEL).regions.length"))
    # lecture
    await A.tap('.mtrans .mt');await A.tap('#mPlay');await A.wait_for_timeout(800);print('lecture',await E("E.playing"),await E("document.querySelector('#mTime').textContent"));await A.tap('#mPlay')
    # feuille piste + menu + tempo
    await E("SELR.clear();mobTrackSheet(findTrack(SEL))");await A.wait_for_timeout(300);await A.screenshot(path='/home/claude/test/m6.png');await E("document.querySelectorAll('.msheet').forEach(x=>x.remove())")
    await A.tap('.mtop .mic:last-child');await A.wait_for_timeout(300);await A.screenshot(path='/home/claude/test/m7.png');await E("document.querySelectorAll('.msheet').forEach(x=>x.remove())")
    await A.tap('#mTempo');await A.wait_for_timeout(200);await E("document.querySelectorAll('.mbpmrow button')[1].click()");print('bpm',await E("P.bpm"));await E("document.querySelectorAll('.msheet').forEach(x=>x.remove())")
    await E("mobZoom(2)");await A.wait_for_timeout(300);print('zoom PPB',await E("PPB"))
    # glisser une prise sélectionnée + rogner
    r=await E("""(()=>{const t=P.tracks.find(t=>t.type==='audio'&&t.regions.length),r=t.regions[0];SELR=new Set([r.id]);SEL=t.id;mobRender();
      const el=document.querySelector('.mreg.sel'),bb=el.getBoundingClientRect(),s0=r.start,d0=r.dur;const ev=(ty,tg,x)=>tg.dispatchEvent(new PointerEvent(ty,{bubbles:true,clientX:x,clientY:bb.top+30,pointerId:1}));
      ev('pointerdown',el.querySelector('.mrt'),bb.left+bb.width/2);ev('pointermove',el,bb.left+bb.width/2+PPB*2);ev('pointerup',el,0);const s1=r.start;
      const e2=document.querySelector('.mreg.sel'),b2=e2.getBoundingClientRect(),hr=e2.querySelector('.mh.r');ev('pointerdown',hr,b2.right-5);ev('pointermove',e2,b2.right-5-PPB*.5);ev('pointerup',e2,0);
      return [s0,s1,+d0.toFixed(2),+r.dur.toFixed(2)]})()""");print('glisser +2 temps / rogner',r)
    await E("undo()");await A.wait_for_timeout(300);print('annuler ok, lignes',await E("document.querySelectorAll('#mob .mrow').length"))
    print('erreurs',errs);await b.close()
asyncio.run(main())
