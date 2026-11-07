import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
    for (w,hh) in [(1440,900),(1280,800)]:
      c=await b.new_context(viewport={'width':w,'height':hh},device_scale_factor=2);pg=await c.new_page();errs=[];pg.on('pageerror',lambda e: errs.append(str(e)))
      await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1500);await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
      ov=await pg.evaluate("$('#bar').scrollWidth-$('#bar').clientWidth");print(w,'bar overflow px',ov,'TAB',await pg.evaluate("TAB"))
      await pg.screenshot(path=f'/home/claude/test/bar{w}.png',clip={'x':0,'y':0,'width':w,'height':60})
      if w==1440:
        r=await pg.evaluate("""(async()=>{const sr=44100,oc=new OfflineAudioContext(2,sr*8,sr);const o=oc.createOscillator();o.frequency.value=220;const g=oc.createGain();g.gain.value=.7;o.connect(g);g.connect(oc.destination);o.start();
          const buf=await oc.startRendering();SEL=P.tracks.find(t=>t.name==='Voix 1').id;await importAudio([new File([wavEncode(buf)],'beat.wav')],0,SEL);await new Promise(r=>setTimeout(r,2500));document.querySelectorAll('.modal').forEach(m=>m.remove());
          const v=P.tracks.find(t=>t.name==='Voix 1');const ins=P.tracks.find(isInstru);
          SEL=ins.id;P.settings.countIn=0;await toggleRecord();await new Promise(r=>setTimeout(r,900));stopRecord();
          return {voiceRegions:v.regions.length,instruTrack:ins&&ins.name,instruRegions:ins.regions.length,instruIndex:P.tracks.indexOf(ins)}})()""")
        print(r)
        await pg.evaluate("const ins=P.tracks.find(isInstru);SELR=new Set([ins.regions[0].id]);SEL=ins.id;renderInspector();PPB=3000;renderLanes();$('#lanesWrap').scrollLeft=600")
        await pg.wait_for_timeout(300);await pg.screenshot(path='/home/claude/test/zoomhi.png')
        await pg.evaluate("PPB=120;renderLanes();$('#lanesWrap').scrollLeft=0;SEL=P.tracks.find(t=>t.name==='Mélodie').id;renderInspector()");await pg.wait_for_timeout(300);await pg.screenshot(path='/home/claude/test/zoommid.png')
      print('ERR',errs);await c.close()
    await b.close()
asyncio.run(main())
