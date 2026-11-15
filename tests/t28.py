# v3.10.4 : simule l'iPhone qui refuse le micro en mode « playback » (et, en option, tant que l'audio tourne)
import asyncio,sys
from playwright.async_api import async_playwright
SIM=r"""localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','99');
 navigator.audioSession={type:'auto'};const md=navigator.mediaDevices,g=md.getUserMedia.bind(md);
 md.getUserMedia=c=>{const bad=navigator.audioSession.type==='playback'||(window.STRICT==='running'&&window.ctx&&ctx.state==='running')||window.STRICT==='always';
   return bad?Promise.reject(Object.assign(new Error('AudioSession category is not compatible with audio capture.'),{name:'InvalidStateError'})):g(c)};"""
async def run(b,mode,store=None):
    c=await b.new_context(permissions=['microphone']);await c.add_init_script(SIM+(f"window.STRICT='{mode}';" if mode else "")+(f"localStorage.setItem('studio_ios_rec','{store}');" if store else ""))
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1500)
    t0=await A.evaluate("navigator.audioSession.type")
    await A.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());P.settings.countIn=0;toggleRecord()");await A.wait_for_timeout(2000)
    if await A.evaluate("!!REC"):await A.evaluate("toggleRecord()");await A.wait_for_timeout(300)
    print(mode or 'playback seul','| départ',t0,'| prise',await A.evaluate("P.tracks.flatMap(t=>t.regions).filter(r=>/Prise/.test(r.name)).length"),'| essais',await A.evaluate("MIC_TRY"),'| modales',await A.evaluate("[...document.querySelectorAll('.modal h2')].map(x=>x.textContent)"),'| drapeau',await A.evaluate("localStorage.getItem('studio_ios_rec')"),'| moteur',await A.evaluate("ctx.state"),errs)
    await c.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
    await run(b,None);await run(b,'running');await run(b,'always');await run(b,None,'1')
    await b.close()
asyncio.run(main())
