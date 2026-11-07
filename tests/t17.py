import asyncio,json
from playwright.async_api import async_playwright
import os
files=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'logic_files.json')))
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    pg=await b.new_page(viewport={'width':1440,'height':900});errs=[];pg.on('pageerror',lambda e: errs.append(str(e)));pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1500);await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    async def imp(sel):
      return await pg.evaluate("""async(paths)=>{const items=[];for(const p of paths){const r=await fetch('tests/fixtures_logic/'+p.split('/').map(encodeURIComponent).join('/'));const bl=await r.blob();items.push({file:new File([bl],p.split('/').pop()),path:p})}
        const n0=P.tracks.length;await importDropped(items,null,null);await new Promise(r=>setTimeout(r,600));document.querySelectorAll('.modal').forEach(m=>m.remove());
        return {bpm:P.bpm,key:NOTE_NAMES[P.key]+' '+Object.keys(SCALES)[P.scaleIdx],sig:P.sig,newTracks:P.tracks.slice(n0).map(t=>t.type+':'+t.name+' ['+t.regions.map(r=>(r.start.toFixed?r.start.toFixed(2):r.start)+(r.mute?'(m)':'')+(r.dur?' '+r.dur.toFixed(2)+'s':'')+(r.notes?' '+r.notes.length+'n':'')).join(', ')+']')}}""",sel)
    print('LOGIC binaire:',await imp([f for f in files if f.startswith('Mon Son')]))
    print('LOGIC xml:',await imp([f for f in files if f.startswith('xml')]))
    print('MIDI:',await imp(['beat.mid']))
    print('drums pattern hits',await pg.evaluate("(()=>{const t=P.tracks.find(t=>t.type==='drums'&&t.name.startsWith('Drm'));if(!t)return null;const r=t.regions[0].pat.rows;return {kick:r.kick.map((c,i)=>c?i:-1).filter(i=>i>=0),hat:r.hat.map((c,i)=>c?i:-1).filter(i=>i>=0)}})()"))
    # buffers playable: render
    print('render peak',await pg.evaluate("(async()=>{const m=await renderMix(P,0,8);let x=0;for(const v of m.getChannelData(0))x=Math.max(x,Math.abs(v));return x.toFixed(2)})()"))
    await pg.screenshot(path='/home/claude/test/logicimp.png')
    print('ERR',errs[:6]);await b.close()
asyncio.run(main())
