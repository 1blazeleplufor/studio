# 3.13 : effets par bloc
import asyncio
from playwright.async_api import async_playwright
SETUP="""(()=>{const b=ctx.createBuffer(1,48000*4,48000);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=.1*Math.sin(i/10);const bid=addBuffer(b);
 const t=newTrack('audio','Prod');P.tracks=[t];P.bpm=120;
 t.regions.push({id:'rA',start:0,offset:0,dur:2,buf:bid,name:'partie A'},{id:'rB',start:4,offset:2,dur:2,buf:bid,name:'partie B'});
 E.build(P);renderAll();SEL=t.id;SELR=new Set(['rB']);renderAll();return 1})()"""
PEAK="""(async()=>{const buf=await renderMix(deep(P),0,8);const d=buf.getChannelData(0),sr=buf.sampleRate,pk=(a,b)=>{let m=0;for(let i=Math.floor(a*sr);i<b*sr;i++)m=Math.max(m,Math.abs(d[i]));return +m.toFixed(3)};return [pk(.2,1.8),pk(2.2,3.8)]})()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    c=await b.new_context(viewport={'width':1400,'height':860});await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.15.0')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1800);E=A.evaluate
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove())");await E(SETUP);await A.wait_for_timeout(300)
    print('panneau',await E("!!document.querySelector('.rfx')"))
    print('pics sans effet [A,B]',await E(PEAK))
    await E("document.querySelector('.rfx .slot.empty').click()");await A.wait_for_timeout(200)
    print('menu',await E("document.querySelectorAll('#menu div').length"))
    await E("[...document.querySelectorAll('#menu div')].find(x=>x.textContent==='Gain'||/Compresseur/.test(x.textContent)).click()");await A.wait_for_timeout(300)
    t=await E("findRegion('rB')[1].plugins.map(p=>p.type)");print('effets bloc B',t)
    await E("findRegion('rB')[1].plugins[0].params.gain=12;findRegion('rB')[1].plugins[0].params.thr=0");
    print('pics avec compresseur +12 sur B',await E(PEAK))
    await A.screenshot(path='/home/claude/test/rfx1.png')
    # lecture en direct, sans erreur
    await E("E.play(0)");await A.wait_for_timeout(2500);await E("E.stop()")
    print('chaîne live',await E("!!(E.strips.rB&&E.strips.rB.isR)"))
    # coupe : les deux moitiés gardent l'effet
    await E("PH=5;SELR=new Set(['rB']);splitAtPH()");print('après coupe',await E("P.tracks[0].regions.map(r=>r.name+':'+(r.plugins||[]).length)"))
    await E("undo();undo()");print('annuler',await E("P.tracks[0].regions.map(r=>(r.plugins||[]).length)"))
    # préréglage + export .studio round trip ok
    await E("SELR=new Set(['rA']);rfxPreset(findRegion('rA')[1],'Lo-fi / radio vintage')");print('preset A',await E("findRegion('rA')[1].plugins.map(p=>p.type)"))
    print('pics avec lofi sur A',await E(PEAK))
    m=await b.new_context(viewport={'width':390,'height':780},device_scale_factor=2,has_touch=True,is_mobile=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')
    await m.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.15.0');localStorage.setItem('studio_mob_tip','1');localStorage.setItem('studio_a2hs','1')")
    B=await m.new_page();B.on('pageerror',lambda e: errs.append(str(e)));await B.goto('http://localhost:8765/');await B.wait_for_timeout(2000)
    await B.evaluate(SETUP);await B.evaluate("mobSched()");await B.wait_for_timeout(300)
    print('tel outils',await B.evaluate("[...document.querySelectorAll('#mTools button')].map(x=>x.textContent)"))
    await B.evaluate("[...document.querySelectorAll('#mTools button')].find(x=>/Effets/.test(x.textContent)).click()");await B.wait_for_timeout(300)
    await B.evaluate("document.querySelectorAll('.msheet .mfxc')[1].click()");await B.wait_for_timeout(300)
    await B.screenshot(path='/home/claude/test/rfx_tel.png')
    await B.evaluate("document.querySelectorAll('.msheet').forEach(x=>x.remove())");await B.wait_for_timeout(200);await B.screenshot(path='/home/claude/test/rfx_tel2.png')
    print('tel bloc',await B.evaluate("[findRegion('rB')[1].fxPreset,document.querySelector('.mreg[data-r=rB] .mrt').textContent]"))
    print('erreurs',errs);await b.close()
asyncio.run(main())
