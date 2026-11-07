import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(viewport={'width':1440,'height':900});pg=await c.new_page();errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)));pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None);pg.on('dialog',lambda d:(errs.append('DIALOG '+d.message),asyncio.ensure_future(d.dismiss())))
    await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1800)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    # make synthetic instru: 142 bpm, F# minor chords, stereo with centered 'voice'
    r=await pg.evaluate("""(async()=>{
      const sr=44100,bpm=142,spbx=60/bpm,dur=24,oc=new OfflineAudioContext(2,sr*dur,sr);
      const kick=t=>{const o=oc.createOscillator(),g=oc.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(45,t+.1);g.gain.setValueAtTime(1,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(oc.destination);o.start(t);o.stop(t+.35)};
      const hat=t=>{const s=oc.createBufferSource();s.buffer=noiseBuf(oc);const f=oc.createBiquadFilter();f.type='highpass';f.frequency.value=7000;const g=oc.createGain();g.gain.setValueAtTime(.3,t);g.gain.exponentialRampToValueAtTime(.001,t+.05);s.connect(f);f.connect(g);g.connect(oc.destination);s.start(t);s.stop(t+.06)};
      const ch=[[66,69,73],[62,66,69],[64,68,71],[61,65,68]];
      for(let bt=0;bt*spbx<dur-1;bt++){const t=bt*spbx+0.5;kick(t);hat(t);hat(t+spbx/2);
        if(bt%4===0){const c=ch[(bt/4)%4];for(const n of c){const o=oc.createOscillator(),g=oc.createGain(),pn=oc.createStereoPanner();o.type='triangle';o.frequency.value=440*Math.pow(2,(n-69)/12);pn.pan.value=n%2?-.6:.6;g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.01,t+4*spbx);o.connect(g);g.connect(pn);pn.connect(oc.destination);o.start(t);o.stop(t+4*spbx)}}}
      const buf=await oc.startRendering();
      const f=new File([wavEncode(buf)],'typebeat.wav',{type:'audio/wav'});INSTRU_MODE=true;await importAudio([f]);await new Promise(r=>setTimeout(r,2500));
      const t=P.tracks[0],rg=t.regions[0];
      const out={track:t.name,bpm:rg.bpm,key:NOTE_NAMES[rg.key]+' '+(rg.scale?'Maj':'Min'),modal:document.querySelector('.modal h2')&&document.querySelector('.modal h2').textContent};
      document.querySelectorAll('.modal').forEach(m=>m.remove());
      const t0=performance.now();await processRegion(t,rg,'tempo',(b,pr)=>wsola(b,142/120,pr));out.stretch=[rg.dur.toFixed(2),Math.round(performance.now()-t0)+'ms'];
      const bb=detectBPM(BUFS[rg.buf],0,rg.dur);out.bpmAfterStretch=bb.bpm;
      await processRegion(t,rg,'tr',async(b,pr)=>{const rt=Math.pow(2,2/12);return await resample(await wsola(b,rt,pr),rt)});
      const kk=detectKey(BUFS[rg.buf],0,rg.dur);out.keyAfterTranspose=NOTE_NAMES[kk.key]+' '+kk.scale;out.durAfterTr=rg.dur.toFixed(2);
      await processRegion(t,rg,'k',async b=>karaoke(b));out.karaoke='ok';
      rg.fi=1;rg.fo=2;renderLanes();
      // presets
      const v=P.tracks.find(x=>x.name==='Voix 1');for(const n in VOCAL_PRESETS){applyVocalPreset(v,n)}
      // quick controls
      SEL=v.id;applyVocalPreset(v,'Aucun effet');renderInspector();
      const sliders=[...document.querySelectorAll('.quick input[type=range]')];
      sliders.forEach((s,i)=>{s.value=s.max*0.7;s.dispatchEvent(new Event('input'));s.dispatchEvent(new Event('change'))});
      out.afterQuick=v.plugins.map(p=>p.type+(p.byp?'(off)':'')).join(',')+' sends '+v.sends.map(x=>x.toFixed(0));
      const mix=await renderMix(P,0,16);let m=0;for(const x of mix.getChannelData(0))m=Math.max(m,Math.abs(x));out.mixPeak=m.toFixed(2);
      return out})()""")
    for k,v in r.items(): print(k,':',v)
    SELR=await pg.evaluate("SELR=new Set([P.tracks[0].regions[0].id]);SEL=P.tracks[0].id;renderInspector();renderLanes();1")
    await pg.screenshot(path='/home/claude/test/v2a.png')
    await pg.evaluate("SEL=P.tracks.find(x=>x.name==='Voix 1').id;SELR.clear();renderInspector()");await pg.screenshot(path='/home/claude/test/v2b.png')
    print('ERR',errs[:10]);await b.close()
asyncio.run(main())
