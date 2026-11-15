# v3.10.1 : micro d'un autre appareil, prise vide, débloquage
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(permissions=['microphone']);await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','99');localStorage.setItem('studio_supa','{\"url\":\"\"}')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1500);E=A.evaluate
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove());P.settings.inputDev='micro-du-pc-qui-existe-pas';P.settings.countIn=0;const v=P.tracks.find(t=>t.type==='audio'&&!isInstru(t));SEL=v.id;window._v=v")
    await E("toggleRecord()");await A.wait_for_timeout(3000);await E("toggleRecord()");await A.wait_for_timeout(500)
    print('micro inconnu → prise',await E("_v.regions.length"),'inputDev',repr(await E("P.settings.inputDev")),'modale vide',await E("[...document.querySelectorAll('.modal h2')].map(x=>x.textContent)"))
    await E("E.recT=Date.now()-5000;E.recChunks=[];REC={start:0,tracks:[_v.id]};stopRecord()");await A.wait_for_timeout(200)
    print('prise vide → message',await E("[...document.querySelectorAll('.modal h2')].map(x=>x.textContent)"))
    c2=await b.new_context(user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');await c2.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','99')")
    B=await c2.new_page();await B.goto('http://localhost:8765/');await B.wait_for_timeout(1500);print('iPhone : IOS',await B.evaluate("IOS"),'mode retour',await B.evaluate("monMode()"))
    print('IOS',await E("IOS"),'mode retour',await E("monMode()"),'erreurs',errs);await b.close()
asyncio.run(main())
