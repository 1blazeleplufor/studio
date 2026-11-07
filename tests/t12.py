import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    pg=await b.new_page(viewport={'width':1440,'height':900});errs=[];pg.on('pageerror',lambda e: errs.append(str(e)))
    await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1500);await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    await pg.evaluate("P.cycle.on=false");await pg.keyboard.press(' ');await pg.wait_for_timeout(600)
    R=await pg.evaluate("(()=>{const r=$('#ruler').getBoundingClientRect();return [r.left,r.top]})()")
    await pg.mouse.move(R[0]+100,R[1]+20);await pg.mouse.down();await pg.mouse.move(R[0]+300,R[1]+20,steps=8);await pg.mouse.move(R[0]+420,R[1]+20,steps=4)
    print('during drag pos',await pg.evaluate("[SCRUB,E.playing]"))
    await pg.mouse.up();await pg.wait_for_timeout(500)
    print('after release playing',await pg.evaluate("[E.playing,+E.pos().toFixed(2),+(420/PPB).toFixed(2)]"))
    # drag playhead line in lanes
    x=await pg.evaluate("(()=>{const r=$('#playhead').getBoundingClientRect();return [r.left+5,r.top+150]})()")
    await pg.mouse.move(x[0],x[1]);await pg.mouse.down();await pg.mouse.move(x[0]-200,x[1],steps=6);await pg.mouse.up();await pg.wait_for_timeout(300)
    print('after line drag',await pg.evaluate("[E.playing,+E.pos().toFixed(2)]"))
    # click on region still works (not under playhead)
    print(errs);await b.close()
asyncio.run(main())
