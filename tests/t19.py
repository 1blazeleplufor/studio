# Test du pont : lancer d abord  PYTHONPATH=tests/bridge_mock STUDIO_BRIDGE_DIRS=tests/bridge_mock/plugdir python3 bridge/studio_bridge.py  (+ serveur http 8765 a la racine)
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context();pg=await c.new_page()
    await pg.goto('http://localhost:47123/');await pg.wait_for_timeout(1500);await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    r=await pg.evaluate("""(async()=>{const sr=ctx.sampleRate,oc=new OfflineAudioContext(2,sr*3,sr),o=oc.createOscillator();o.frequency.value=440;const g=oc.createGain();g.gain.value=.5;o.connect(g);g.connect(oc.destination);o.start(.5);o.stop(2.5);
        const buf=await oc.startRendering(),id=addBuffer(buf);P.bpm=120;const v=P.tracks.find(t=>t.name==='Voix 1');P.tracks.forEach(t=>{if(t!==v)t.mute=true});v.regions=[{id:uid('r'),start:0,offset:0,dur:3,buf:id,name:'test'}];v.plugins=[];E.build(P);
        const B=await realtimeBounce(P,0,6);BRIDGE.wanted=true;bridgeConnect();await new Promise(r=>setTimeout(r,1200));const p=BRIDGE.plugins.find(x=>x.name==='Fake Comp');v.plugins=[plug('bridge',{pid:p.id,name:p.name,fmt:p.fmt})];E.updateStrip(v);await new Promise(r=>setTimeout(r,1500));const C=await realtimeBounce(P,0,6);
        const on=(d)=>{for(let i=Math.floor(sr*.3);i<d.length;i++)if(Math.abs(d[i])>.05)return i;return -1};
        return {sr,sansPlugin:on(B.getChannelData(0)),avecPluginOrdi:on(C.getChannelData(0)),under:bridgeInstFor(v,0).under,baseLatency:ctx.baseLatency,outputLatency:ctx.outputLatency}})()""")
    print(r);await b.close()
asyncio.run(main())
