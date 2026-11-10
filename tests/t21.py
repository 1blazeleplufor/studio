# v3.7.7 : ⭐ Mes réglages voix
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome');c=await b.new_context(viewport={'width':1440,'height':880});await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','9')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)));A.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1500);E=A.evaluate
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove());for(let i=0;i<2;i++){const t=newTrack('audio','Voix '+(i+2));t.plugins=[];t.sends=P.auxes.map(()=>-60);P.tracks.push(t)}E.build(P);const v=P.tracks.find(t=>t.name==='Voix 1');SEL=v.id;renderAll()")
    print('section visible',await E("!!document.querySelector('#insp .mine')"))
    # modifie la voix : réglage rapide + effet
    await E("const v=findTrack(SEL);applyVocalPreset(v,Object.keys(VOCAL_PRESETS)[0]);v.plugins[0].params[Object.keys(v.plugins[0].params)[0]]=123;v.sends[1]=-7;v.vol=-4;renderInspector()")
    await A.click("#insp .mine button:has-text('Enregistrer ce réglage')");await A.wait_for_timeout(200)
    await A.click(".modal button:has-text('💾 Enregistrer')");await A.wait_for_timeout(200)
    print('enregistré',await E("myPresets().map(p=>[p.name,p.plugins.length,p.sends[1],p.vol])"))
    await A.click("#insp .mine button:has-text('→ toutes')");await A.wait_for_timeout(200)
    print('appliqué à toutes',await E("voiceTracks().map(t=>[t.name,t.plugins.length,t.sends[1],t.vol,t.mine])"))
    await E("Object.values(findTrack(SEL)).length;P.tracks.find(t=>t.name==='Voix 2').plugins.pop()");await E("undo&&undo()")
    await A.screenshot(path='/home/claude/test/v377_mine.png')
    await A.reload();await A.wait_for_timeout(1500);print('gardé après rechargement',await E("myPresets().map(p=>p.name)"))
    print('erreurs',errs);await b.close()
asyncio.run(main())
