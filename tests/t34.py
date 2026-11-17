# 3.13 : Ctrl+J fusionner
import asyncio
from playwright.async_api import async_playwright
SETUP="""(()=>{const mk=(v)=>{const b=ctx.createBuffer(1,48000*2,48000);b.getChannelData(0).fill(v);return addBuffer(b)};
 const a=newTrack('audio','Couplet 1'),b=newTrack('audio','Couplet 2'),c=newTrack('audio','Couplet 3');P.bpm=120;
 a.regions.push({id:'r1',start:0,offset:0,dur:2,buf:mk(.1),name:'l1'});b.regions.push({id:'r2',start:4,offset:0,dur:2,buf:mk(.2),name:'l2'});c.regions.push({id:'r3',start:8,offset:0,dur:2,buf:mk(.3),name:'l3'});
 b.plugins=[plug('comp',{gain:6})];b.vol=-3;P.tracks=[a,b,c];E.build(P);renderAll();return 1})()"""
PK="""(async()=>{const buf=await renderMix(deep(P),0,12);const d=buf.getChannelData(0),sr=buf.sampleRate,pk=(x,y)=>{let m=0;for(let i=Math.floor(x*sr);i<y*sr;i++)m=Math.max(m,Math.abs(d[i]));return +m.toFixed(3)};return [pk(.3,.9),pk(2.3,2.9),pk(4.3,4.9)]})()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    c=await b.new_context(viewport={'width':1400,'height':860});await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.15.0')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1800);E=A.evaluate
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove())");await E(SETUP)
    avant=await E(PK);print('avant',avant)
    await E("SELR=new Set(['r1','r2','r3']);renderLanes()");await A.mouse.click(700,500);await E("SELR=new Set(['r1','r2','r3'])");await A.keyboard.press('Control+j');await A.wait_for_timeout(500)
    print('pistes',await E("JSON.stringify(P.tracks.map(t=>[t.name,t.regions.map(r=>r.name+(r.plugins?'+fx':'')+(r.gain?' '+r.gain+'dB':'')+(r.fxVol?' post'+r.fxVol:'')+(r.own?' own':''))]))"))
    apres=await E(PK);print('après',apres,'même son',all(abs(x-y)<.01 for x,y in zip(avant,apres)))
    await E("undo()");print('annuler',await E("P.tracks.length"))
    await E("redo()")
    # coller en un bloc
    await E("SELR=new Set(P.tracks[0].regions.map(r=>r.id))");await A.keyboard.press('Control+j');await A.wait_for_timeout(1500)
    print('un bloc',await E("JSON.stringify(P.tracks[0].regions.map(r=>[r.name,r.start,+r.dur.toFixed(2),BUFS[r.buf].numberOfChannels]))"))
    joint=await E(PK);print('après collage',joint,'même son',all(abs(x-y)<.01 for x,y in zip(avant,joint)))
    # dossier
    await E(SETUP);await E("createFolder(P.tracks.map(t=>t.id),'Couplet');SELR=new Set();SEL=P.tracks[1].id");await A.keyboard.press('Control+j');await A.wait_for_timeout(400)
    print('dossier',await E("P.tracks.map(t=>t.name+':'+t.regions.length)"))
    await A.screenshot(path='/home/claude/test/join.png')
    print('erreurs',errs);await b.close()
asyncio.run(main())
