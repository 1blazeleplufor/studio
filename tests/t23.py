# v3.8.1 : historique lisible, retrait du mastering
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome');c=await b.new_context(viewport={'width':1440,'height':900});await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','9')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)));await A.goto('http://localhost:8765/');await A.wait_for_timeout(1500);E=A.evaluate
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    print('boutons',await E("['bUndo','bRedo','bHist'].map(i=>!!document.getElementById(i))"))
    lim0=await E("JSON.stringify(P.master.plugins)")
    await E("const v=P.tracks.find(t=>t.name==='Voix 1');SEL=v.id;applyVocalPreset(v,Object.keys(VOCAL_PRESETS)[1])")
    await E("snapshot();P.bpm=150")
    await E("applyMaster('Trap',false)")
    await E("snapshot();findTrack(SEL).vol=-3")
    print('↶ dit',await E("document.getElementById('bUndo').title"))
    await A.click('#bHist');await A.wait_for_timeout(300)
    print('historique',await E("[...document.querySelectorAll('.hbody .hrow .hl')].map(x=>x.textContent)"))
    await A.screenshot(path='/home/claude/test/v381_hist.png')
    await A.click(".hmaster button");await A.wait_for_timeout(300)
    print('master après retrait identique à avant',await E("JSON.stringify(P.master.plugins)")==lim0,'| bpm et volume gardés',await E("[P.bpm,findTrack(SEL).vol]"))
    print('historique après',await E("[...document.querySelectorAll('.hbody .hrow .hl')].slice(0,2).map(x=>x.textContent)"),await E("document.querySelector('.hmaster').textContent"))
    # annuler jusqu'à la ligne 3 avec confirmation
    await E("confirmUndo(3)");await A.wait_for_timeout(200);print('confirmation liste',await E("[...document.querySelectorAll('.modal ol li')].map(x=>x.textContent)"))
    await A.click("text=Oui, annuler");await A.wait_for_timeout(300);print('après annulation de 3',await E("[P.bpm,findTrack(SEL).vol,!!masterOn()]"))
    print('à remettre',await E("[...document.querySelectorAll('.hbody .hrow.redo .hl')].map(x=>x.textContent)"))
    print('erreurs',errs);await b.close()
asyncio.run(main())
