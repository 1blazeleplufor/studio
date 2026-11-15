import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(permissions=['microphone']);
    # simule l'API audioSession de Safari : capture refusée tant que type==='playback'
    await c.add_init_script("""localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','99');
      navigator.audioSession={type:'auto'};const md=navigator.mediaDevices,g=md.getUserMedia.bind(md);
      md.getUserMedia=c=>navigator.audioSession.type==='playback'?Promise.reject(Object.assign(new Error('AudioSession category is not compatible with audio capture.'),{name:'InvalidStateError'})):g(c);""")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1500)
    print('type au démarrage',await A.evaluate("navigator.audioSession.type"))
    await A.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());P.settings.countIn=0;toggleRecord()");await A.wait_for_timeout(2000);await A.evaluate("toggleRecord()");await A.wait_for_timeout(300)
    print('type après',await A.evaluate("navigator.audioSession.type"),'prise',await A.evaluate("P.tracks.flatMap(t=>t.regions).filter(r=>/Prise/.test(r.name)).length"),'modales',await A.evaluate("[...document.querySelectorAll('.modal h2')].map(x=>x.textContent)"),errs);await b.close()
asyncio.run(main())
