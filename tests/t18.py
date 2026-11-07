# Test du pont : lancer d abord  PYTHONPATH=tests/bridge_mock STUDIO_BRIDGE_DIRS=tests/bridge_mock/plugdir python3 bridge/studio_bridge.py  (+ serveur http 8765 a la racine)
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    for url in ['http://localhost:47123/','http://localhost:8765/']:
      c=await b.new_context(viewport={'width':1440,'height':900});pg=await c.new_page();errs=[]
      pg.on('pageerror',lambda e: errs.append(str(e)));pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'WebSocket' not in m.text else None)
      await pg.goto(url);await pg.wait_for_timeout(1500);await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
      await pg.keyboard.press('y');await pg.wait_for_timeout(1200)
      print(url,'lib:',await pg.evaluate("[BRIDGE.connected,BRIDGE.ok,BRIDGE.plugins.map(p=>p.vendor+'/'+p.name+'/'+p.fmt+'/'+p.kind).join(' | ')]"))
      if url.endswith('8765/'):
        print('  (site public simulé) connecté :',await pg.evaluate("BRIDGE.connected"));await c.close();continue
      await pg.screenshot(path='/home/claude/test/library.png')
      r=await pg.evaluate("""(async()=>{const sr=ctx.sampleRate,oc=new OfflineAudioContext(2,sr*3,sr),o=oc.createOscillator();o.frequency.value=440;const g=oc.createGain();g.gain.value=.5;o.connect(g);g.connect(oc.destination);o.start(.5);o.stop(2.5);
        const buf=await oc.startRendering(),id=addBuffer(buf);P.bpm=120;const v=P.tracks.find(t=>t.name==='Voix 1');P.tracks.forEach(t=>{if(t!==v)t.mute=true});v.regions=[{id:uid('r'),start:0,offset:0,dur:3,buf:id,name:'test'}];E.build(P);
        const A=await renderMix(P,0,6);
        SEL=v.id;LIB_TARGET=v.id;const p=BRIDGE.plugins.find(x=>x.name==='Fake Comp');insertPlugin('bridge',{pid:p.id,name:p.name,fmt:p.fmt,vendor:p.vendor},true);
        await new Promise(r=>setTimeout(r,1500));const inst=bridgeInstFor(v,0);const st0=[inst.loaded,inst.editing];
        const B=await renderMix(P,0,6);
        const a=A.getChannelData(0),bl=B.getChannelData(0),br=B.getChannelData(1);let best=-1,lag=0;
        for(let L=-3000;L<=3000;L+=1){let s=0;for(let i=30000;i<60000;i+=7)s+=a[i]*bl[i+L];if(s>best){best=s;lag=L}}
        let ra=0,rb=0;for(let i=40000;i<80000;i++){ra+=a[i]*a[i];rb+=bl[i+lag]*bl[i+lag]}
        let rc=0;for(let i=40000;i<80000;i++)rc+=bl[i+lag]*br[i+lag];
        await new Promise(r=>setTimeout(r,1500));
        return {loaded_and_editor:st0,lagSamples:lag,gainRatio:Math.sqrt(rb/ra).toFixed(3),rightInverted:rc<0,state:(v.plugins[0].params.state||'').slice(0,20),under:inst.under,slot:document.querySelector('#insp .slot.full span:last-child')&&document.querySelector('#insp .slot.full span:last-child').textContent}})()""")
      print('  test:',r)
      await pg.evaluate("openPlugin(findTrack(SEL),0)");await pg.wait_for_timeout(400);await pg.screenshot(path='/home/claude/test/bridgewin.png')
      # reload project restores plugin state
      print('  reload:',await pg.evaluate("(async()=>{await saveLocal(true);return 1})()"))
      await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
      print('  après rechargement :',await pg.evaluate("(()=>{const v=P.tracks.find(t=>t.name==='Voix 1');const i=bridgeInstFor(v,0);return [v.plugins.map(p=>p.type+':'+p.params.name).join(),BRIDGE.connected,i&&i.loaded]})()"))
      print('  ERR',errs[:5]);await c.close()
    await b.close()
asyncio.run(main())
