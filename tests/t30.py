import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    c=await b.new_context(viewport={'width':844,'height':390},screen={'width':844,'height':390},device_scale_factor=2,has_touch=True,is_mobile=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')
    await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.14.0');localStorage.setItem('studio_mob_tip','1');localStorage.setItem('studio_a2hs','1')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(2000)
    print('MOB',await A.evaluate("MOB"),'paysage',await A.evaluate("mobLand()"),'zone pistes',await A.evaluate("document.querySelector('#mScroll').clientHeight"),errs)
    await A.screenshot(path='/home/claude/test/land.png')
    await A.set_viewport_size({'width':390,'height':844});await A.wait_for_timeout(500);print('portrait : paysage?',await A.evaluate("mobLand()"),'zone',await A.evaluate("document.querySelector('#mScroll').clientHeight"))
    await b.close()
asyncio.run(main())
