# v3.8 : outils voix
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(viewport={'width':1440,'height':900});await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','9')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)));A.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1500);E=A.evaluate
    # fausse voix : « phrases » (sons harmoniques modulés) + respirations (bruit filtré) + souffle
    await E("""(()=>{document.querySelectorAll('.modal').forEach(m=>m.remove());const sr=48000;
      window.mkVoice=(sec,amp,bright,seed)=>{const b=new AudioBuffer({length:sr*sec,numberOfChannels:1,sampleRate:sr}),d=b.getChannelData(0);let s=seed||1;const rnd=()=>((s=s*16807%2147483647)/2147483647-.5);let lp=0;
        for(let i=0;i<d.length;i++){const t=i/sr,ph=t%2.5;let v=rnd()*.002;
          if(ph<1.8){const env=Math.min(1,ph*20,(1.8-ph)*20)*(.6+.4*Math.sin(t*9)),f=140+20*Math.sin(t*2);let x=0;for(let k=1;k<12;k++)x+=Math.sin(2*Math.PI*f*k*t)/k*(k>4?bright:1);v+=amp*env*x*.3}
          else if(ph>2.0&&ph<2.4){const w=rnd();lp=lp*.6+w*.4;v+=(lp-(window._sl=(window._sl||0)*.97+lp*.03))*.25*amp*Math.sin((ph-2)/.4*Math.PI)}
          d[i]=v}return b};
      const v=P.tracks.find(t=>t.name==='Voix 1');v.regions=[];const b1=mkVoice(12,.5,1,3),b2=mkVoice(12,.15,.3,7);
      v.regions.push({id:'ra',start:0,offset:0,dur:6,buf:addBuffer(b1),name:'Prise 1'});const sp=spb();
      v.regions.push({id:'rb',start:6/sp,offset:0,dur:6,buf:addBuffer(b2),name:'Prise 2'});SEL=v.id;SELR=new Set();E.build(P);renderAll()})()""")
    print('outils visibles',await E("[!!document.querySelector('#insp .vtools'),!!document.querySelector('#insp .mine button.on, #insp .mine button')]"))
    print('fondu auto',await E("JSON.stringify(autoXfades(findTrack(SEL),spb(),P))"))
    # égaliser
    await E("matchTakes(targetRegions(),-1,true,true)");await A.wait_for_timeout(2500)
    print('égalisées',await E("findTrack(SEL).regions.map(r=>[r.name,r.gain,JSON.stringify(r.tone)])"),'| niveaux après',await E("findTrack(SEL).regions.map(r=>(regionLoudness(r)+(r.gain||0)).toFixed(1))"))
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    # nettoyage
    await E("processTakes(targetRegions(),'Nettoyage',b=>{const o=cleanBuffer(b,-12,-20);window.NB=o._breaths;return o})");await A.wait_for_timeout(2500)
    print('respirations trouvées',await E("NB"),'(attendu ≈ 4 par prise)','| bruit avant/après',await E("""(()=>{const r=findTrack(SEL).regions[0],x=BUFS[r.buf].getChannelData(0),sr=48000;let e=0;for(let i=Math.round(2.45*sr);i<Math.round(2.49*sr);i++)e+=x[i]*x[i];return dB(e/(.04*sr)).toFixed(1)})()"""))
    # volume régulier
    await E("processTakes(targetRegions(),'Volume régulier',b=>levelBuffer(b,.7,9))");await A.wait_for_timeout(2000);print('volume régulier ok',await E("findTrack(SEL).regions.every(r=>BUFS[r.buf])"))
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    # assistant
    await E("analyzeVoice()");await A.wait_for_timeout(3000)
    print('assistant',await E("[...document.querySelectorAll('.modal li')].map(l=>l.textContent)"),await E("findTrack(SEL).plugins.map(p=>p.type)"))
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    # EQ visuel
    await E("openTrackEQ()");await A.wait_for_timeout(600);ok=await E("!!document.querySelector('canvas.eqv')");print('EQ visuel',ok)
    bx=await E("(()=>{const r=document.querySelector('canvas.eqv').getBoundingClientRect(),t=findTrack(SEL),p=t.plugins.find(p=>p.type==='eq').params;return [r.left+Math.log(p.m2F/20)/Math.log(1000)*r.width,r.top+r.height/2-p.m2G/20*r.height/2*.85,p.m2G]})()")
    await A.mouse.move(bx[0],bx[1]);await A.mouse.down();await A.mouse.move(bx[0]+40,bx[1]-30,steps=5);await A.mouse.up()
    print('point tiré : médium 2',bx[2],'→',await E("(()=>{const p=findTrack(SEL).plugins.find(p=>p.type==='eq').params;return [Math.round(p.m2F),p.m2G]})()"))
    await A.screenshot(path='/home/claude/test/v38_eq.png');await E("closeAllPlugins()")
    # A/B
    await E("abSwitch(findTrack(SEL),'B');findTrack(SEL).plugins.push(plug('chorus'));abSwitch(findTrack(SEL),'A')")
    print('A/B',await E("[findTrack(SEL).plugins.length,findTrack(SEL).ab.B.plugins.length,findTrack(SEL).ab.cur]"))
    # mastering (mesure)
    await E("applyMaster('Trap',true)");await A.wait_for_timeout(25000)
    print('master',await E("P.master.plugins.map(p=>p.type+(p.type==='limiter'?' +'+p.params.gain:''))"))
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove())");await E("renderAll()");await A.wait_for_timeout(300)
    await A.screenshot(path='/home/claude/test/v38_insp.png')
    print('erreurs',errs);await b.close()
asyncio.run(main())
