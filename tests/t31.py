# 3.11 : 💾 Sauvegarder (ordinateur + téléphone)
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    c=await b.new_context(viewport={'width':1400,'height':860},accept_downloads=True);await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.11.0')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1800);E=A.evaluate
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove());window.showSaveFilePicker=undefined")
    print('PC bouton',await E("!!document.querySelector('#bSave')"),'pastille',await E("getComputedStyle(document.querySelector('#bSave .svdot')).display"))
    await A.keyboard.press('Control+s');await A.wait_for_timeout(400);print('Ctrl+S ouvre',await E("document.querySelector('.modal h2').textContent"))
    await A.screenshot(path='/home/claude/test/sv_pc.png')
    async with A.expect_download() as d:
      await E("document.querySelector('.svbig').click()")
    dl=await d.value;print('fichier',dl.suggested_filename);await A.wait_for_timeout(300)
    print('pastille après',await E("getComputedStyle(document.querySelector('#bSave .svdot')).display"),'état',await E("JSON.stringify(expState())"))
    await E("P.tracks[0].name='modifié';refreshSaveBadges()");print('après modif',await E("getComputedStyle(document.querySelector('#bSave .svdot')).display"))
    await A.click('#bFile');await A.wait_for_timeout(200);print('menu Fichier',await E("[...document.querySelectorAll('.menu div')].slice(0,3).map(x=>x.textContent)"))
    m=await b.new_context(viewport={'width':390,'height':780},device_scale_factor=2,has_touch=True,is_mobile=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')
    await m.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.11.0');localStorage.setItem('studio_mob_tip','1');localStorage.setItem('studio_a2hs','1')")
    B=await m.new_page();B.on('pageerror',lambda e: errs.append(str(e)));await B.goto('http://localhost:8765/');await B.wait_for_timeout(2000)
    print('tel bouton',await B.evaluate("!!document.querySelector('#mob .svm')"));await B.screenshot(path='/home/claude/test/sv_tel0.png')
    await B.tap('#mob .svm');await B.wait_for_timeout(400);await B.screenshot(path='/home/claude/test/sv_tel.png')
    print('feuille',await B.evaluate("document.querySelector('.msheet .mshd b').textContent"))
    await B.evaluate("document.querySelectorAll('.msheet').forEach(x=>x.remove());mobMenuSheet()");print('menu ⋯',await B.evaluate("[...document.querySelectorAll('.msheet .mrowb b')].slice(0,3).map(x=>x.textContent)"))
    print('erreurs',errs);await b.close()
asyncio.run(main())
