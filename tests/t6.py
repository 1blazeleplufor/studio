import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
    # ---- desktop: SW, offline, autosave
    c=await b.new_context(viewport={'width':1440,'height':880});pg=await c.new_page();errs=[]
    pg.on('pageerror',lambda e: errs.append('D:'+str(e)));pg.on('console',lambda m: errs.append('D:'+m.text) if m.type=='error' else None)
    await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(2000)
    print('worklet url',await pg.evaluate("WORKLET_URL"),'sw',await pg.evaluate("navigator.serviceWorker.controller?'ctrl':'none'"))
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    await pg.evaluate("P.name='Mon test';SEL=P.tracks[4].id;P.settings.countIn=0");await pg.evaluate("toggleRecord()");await pg.wait_for_timeout(1500);await pg.evaluate("stopRecord()")
    await pg.evaluate("saveLocal(true)");await pg.wait_for_timeout(800)
    await pg.reload();await pg.wait_for_timeout(2000)
    print('after reload',await pg.evaluate("[P.name,P.tracks[4].regions.length,!!BUFS[P.tracks[4].regions[0]&&P.tracks[4].regions[0].buf]]"),'sw',await pg.evaluate("navigator.serviceWorker.controller?'ctrl':'none'"))
    await c.set_offline(True);await pg.reload();await pg.wait_for_timeout(2000)
    print('offline load',await pg.evaluate("[document.title,typeof P,P&&P.name]"))
    await c.set_offline(False)
    await pg.evaluate("projectsModal()");await pg.wait_for_timeout(400);await pg.screenshot(path='/home/claude/test/proj.png')
    # ---- phone
    for name,vp in [('phone',{'width':390,'height':844}),('phoneL',{'width':844,'height':390}),('tablet',{'width':1024,'height':768})]:
      ctxm=await b.new_context(viewport=vp,has_touch=True,is_mobile=name!='tablet',device_scale_factor=2,user_agent='Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36')
      m=await ctxm.new_page();m.on('pageerror',lambda e: errs.append(name+':'+str(e)))
      await m.goto('http://localhost:8765/');await m.wait_for_timeout(1800)
      await m.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
      await m.screenshot(path=f'/home/claude/test/{name}.png')
      if name=='phoneL':
        r=await m.evaluate("(()=>{const r=document.querySelectorAll('.reg')[0].getBoundingClientRect();return [r.left+20,r.top+25]})()")
        await m.touchscreen.tap(r[0],r[1]);await m.wait_for_timeout(120);await m.touchscreen.tap(r[0],r[1]);await m.wait_for_timeout(400)
        print('dbltap opened tab',await m.evaluate("TAB"))
        await m.screenshot(path=f'/home/claude/test/{name}_steps.png')
        await m.evaluate("$('#bInsp').click()");await m.wait_for_timeout(300);await m.screenshot(path=f'/home/claude/test/{name}_insp.png')
        await m.evaluate("openPlugin(P.tracks[4],1)");await m.wait_for_timeout(300);await m.screenshot(path=f'/home/claude/test/{name}_plug.png')
      await ctxm.close()
    print('ERR',errs[:20])
    await b.close()
asyncio.run(main())
