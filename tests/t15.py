import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(viewport={'width':1440,'height':900},device_scale_factor=2);pg=await c.new_page();errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)));pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1800);await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    r=await pg.evaluate("""(async()=>{const out={};const sr=44100;
      // voix test : glissando 225 Hz légèrement faux
      const oc=new OfflineAudioContext(1,sr*3,sr);const o=oc.createOscillator();o.type='sawtooth';o.frequency.value=225.1;const lp=oc.createBiquadFilter();lp.frequency.value=2500;const g=oc.createGain();g.gain.value=.3;o.connect(lp);lp.connect(g);g.connect(oc.destination);o.start(.5);o.stop(2.5);
      const buf=await oc.startRendering();const id=addBuffer(buf);const v=P.tracks.find(t=>t.name==='Voix 1');P.tracks.forEach(t=>{if(t!==v)t.mute=true});
      v.regions=[{id:uid('r'),start:0,offset:0,dur:3,buf:id,name:'test'}];P.bpm=120;E.build(P);
      const peakT=async()=>{const m=await renderMix(P,0,6);const d=m.getChannelData(0);let first=-1;for(let i=Math.floor(sr*.4);i<d.length;i++){if(Math.abs(d[i])>.08){first=i;break}}return [first/sr,m]};
      v.plugins=[];E.updateStrip(v);const [t0]=await peakT();
      v.plugins=[plug('tunepro',{key:0,scale:5,retune:0})];v.plugins[0].params.notes=null;E.updateStrip(v);const [t1,m1]=await peakT();
      out.onsetNoPlugin=t0.toFixed(4);out.onsetWithPitchPro=t1.toFixed(4);
      const d=m1.getChannelData(0);let run=0,bl=0;const st=sr*1.5,len=1500,dd=[1];for(let lag=1;lag<600;lag++){let s=0;for(let i=0;i<len;i++){const x=d[st+i]-d[st+i+lag];s+=x*x}run+=s;dd[lag]=s*lag/run}for(let lag=40;lag<599;lag++){if(dd[lag]<.2&&dd[lag]<=dd[lag+1]){bl=lag;break}}
      out.correctedHz=(sr/bl).toFixed(1);
      v.plugins.push(plug('verbpro',VERB_PRESETS['Voix rap – plaque courte']));E.updateStrip(v);const [t2,m2]=await peakT();let tail=0;const dd2=m2.getChannelData(0);for(let i=Math.floor(sr*2.7);i<sr*3.2;i++)tail=Math.max(tail,Math.abs(dd2[i]));out.reverbTail=tail.toFixed(3);
      out.latency=E.strips[v.id].latency;return out})()""")
    print(r)
    await pg.evaluate("SEL=P.tracks.find(t=>t.name==='Voix 1').id;renderAll();const v=findTrack(SEL);openPlugin(v,0)");await pg.wait_for_timeout(300)
    await pg.evaluate("const v=findTrack(SEL);E.play(0)");await pg.wait_for_timeout(2500);await pg.screenshot(path='/home/claude/test/tune.png');await pg.evaluate("E.stop();closeAllPlugins();const v=findTrack(SEL);openPlugin(v,1)")
    await pg.wait_for_timeout(300);await pg.screenshot(path='/home/claude/test/verb.png')
    print('ERR',errs[:8]);await b.close()
asyncio.run(main())
