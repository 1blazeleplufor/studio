import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    pg=await b.new_page(viewport={'width':1440,'height':880});errs=[];pg.on('pageerror',lambda e: errs.append(str(e)))
    await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1500)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())");await pg.mouse.click(900,700)
    E=lambda s: pg.evaluate(s)
    print('defaults plugins',await E("P.tracks.map(t=>t.name+':'+t.plugins.length+'/'+t.sends.join(',')).join(' | ')+' master:'+P.master.plugins.map(p=>p.type)"))
    await E("SEL=P.tracks[1].id;SELR.clear()");n0=await E("P.tracks.length")
    await pg.keyboard.press('Shift+D');n1=await E("P.tracks.length")
    await pg.keyboard.press('Delete');n2=await E("P.tracks.length")
    await pg.keyboard.press('Control+z');n3=await E("P.tracks.length")
    print('tracks dup/del/undo',n0,n1,n2,n3)
    th=await E("TH");await pg.keyboard.press('Control+ArrowUp');print('TH',th,'->',await E("TH"))
    ppb=await E("PPB");await pg.keyboard.press('Control+ArrowRight');print('PPB',ppb,'->',await E("PPB"))
    await pg.keyboard.press('z');print('fit PPB',await E("PPB.toFixed(1)"),'TH',await E("TH"))
    # marquee
    L=await E("(()=>{const r=$('#lanes').getBoundingClientRect();return [r.left,r.top]})()")
    await pg.mouse.move(L[0]+985,L[1]+20);await pg.mouse.down();await pg.mouse.move(L[0]+500,L[1]+200,steps=6);await pg.mouse.up()
    print('marquee selected',await E("SELR.size"))
    await E("PH=4");await pg.keyboard.press('Control+t');print('regions after split',await E("P.tracks.reduce((a,t)=>a+t.regions.length,0)"))
    await E("SELR=new Set([P.tracks[0].regions[0].id])");await pg.keyboard.press('Control+c');await E("PH=32");await pg.keyboard.press('Control+v');print('after paste',await E("P.tracks[0].regions.map(r=>r.start)"))
    await pg.keyboard.press('Control+m');print('muted',await E("[...SELR].map(id=>findRegion(id)[1].mute)"))
    await pg.keyboard.press('Alt+ArrowRight');print('nudged',await E("[...SELR].map(id=>findRegion(id)[1].start)"))
    await pg.screenshot(path='/home/claude/test/v22.png')
    print(errs);await b.close()
asyncio.run(main())
