# 3.12 : importer des pistes d'un autre projet
import asyncio
from playwright.async_api import async_playwright
SETUP="""(async()=>{
 const b=ctx.createBuffer(1,48000,48000);b.getChannelData(0).fill(.25);const bid=addBuffer(b);
 const v=newTrack('audio','Couplet 1');v.regions.push({id:uid('r'),start:8,offset:0,dur:1,buf:bid,name:'prise'});v.sends=[-12,-60];v.plugins=[plug('comp',{thr:-30})];v.vol=-4;
 const v2=newTrack('audio','Couplet 2');v2.regions.push({id:uid('r'),start:12,offset:0,dur:1,buf:bid,name:'prise2'});
 P.tracks=[v,v2,newTrack('drums','Batterie')];P.folders=[{id:'fA',name:'Couplet',color:'#f00',vol:0,mute:false}];v.fold='fA';v2.fold='fA';
 P.auxes[0].name='Ma réverb perso';P.name='Source';P.bpm=150;E.build(P);await saveLocal(true);
 await switchProject(()=>newProject(false));P.name='Cible';await saveLocal(true);return P.tracks.length})()"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    c=await b.new_context(viewport={'width':1400,'height':860},accept_downloads=True);await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.14.0')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1800);E=A.evaluate
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    print('cible pistes avant',await E(SETUP))
    await A.click('#bFile');await A.wait_for_timeout(200);await E("[...document.querySelectorAll('.menu div')].find(x=>/Importer des pistes/.test(x.textContent)).click()");await A.wait_for_timeout(500)
    await A.screenshot(path='/home/claude/test/im1.png')
    await E("[...document.querySelectorAll('.imrow')].find(x=>/Source/.test(x.textContent)).click()");await A.wait_for_timeout(600)
    await A.screenshot(path='/home/claude/test/im2.png')
    print('lignes',await E("[...document.querySelectorAll('.imlist label')].map(x=>x.textContent)"))
    await E("document.querySelector('.imf input').click()")
    print('bouton',await E("document.querySelector('.imgo').textContent"))
    await E("document.querySelector('.imbpm input').click();document.querySelector('.imgo').click()");await A.wait_for_timeout(800)
    await A.screenshot(path='/home/claude/test/im3.png')
    print('résultat',await E("JSON.stringify({bpm:P.bpm,tracks:P.tracks.map(t=>[t.name,t.fold?FOLD(t.fold).name:null,t.sends,t.vol,t.plugins.map(x=>x.type),t.regions.map(r=>r.start+':'+!!BUFS[r.buf])]),aux:P.auxes.map(a=>a.name)})"))
    await E("undo()");print('après annuler',await E("P.tracks.length+' pistes, '+P.auxes.length+' bus'"))
    # depuis un fichier .studio
    await E("redo()");
    async with A.expect_download() as d:
      await E("window.showSaveFilePicker=undefined;saveProject()")
    path=await (await d.value).path()
    await E("switchProject(()=>newProject(false))");await A.wait_for_timeout(400)
    await E("importTracksDialog()");await A.wait_for_timeout(400)
    await A.set_input_files('.imptr input[type=file]',path);await A.wait_for_timeout(800)
    await E("document.querySelectorAll('.imt input').forEach(x=>x.click());document.querySelector('.imptr select').value='ph';PH=32;document.querySelector('.imgo').click()");await A.wait_for_timeout(800)
    print('depuis fichier',await E("JSON.stringify(P.tracks.map(t=>[t.name,t.regions.map(r=>r.start+':'+!!BUFS[r.buf])]))"))
    m=await b.new_context(viewport={'width':390,'height':780},device_scale_factor=2,has_touch=True,is_mobile=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')
    await m.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.14.0');localStorage.setItem('studio_mob_tip','1');localStorage.setItem('studio_a2hs','1')")
    B=await m.new_page();B.on('pageerror',lambda e: errs.append(str(e)));await B.goto('http://localhost:8765/');await B.wait_for_timeout(2000)
    await B.evaluate(SETUP);await B.evaluate("mobMenuSheet()");print('menu ⋯',await B.evaluate("[...document.querySelectorAll('.msheet .mrowb b')].slice(0,4).map(x=>x.textContent)"))
    await B.evaluate("document.querySelectorAll('.msheet').forEach(x=>x.remove());mobAddSheet()");await B.wait_for_timeout(300);await B.screenshot(path='/home/claude/test/im_tel0.png')
    await B.evaluate("[...document.querySelectorAll('.mtile')].find(x=>/autre projet/.test(x.textContent)).click()");await B.wait_for_timeout(500)
    await B.evaluate("[...document.querySelectorAll('.imrow')].find(x=>/Source/.test(x.textContent)).click()");await B.wait_for_timeout(600)
    await B.screenshot(path='/home/claude/test/im_tel1.png')
    await B.evaluate("document.querySelectorAll('.imt input')[0].click();document.querySelector('.imgo').click()");await B.wait_for_timeout(800)
    await B.screenshot(path='/home/claude/test/im_tel2.png');print('tel pistes',await B.evaluate("P.tracks.map(t=>t.name)"))
    print('erreurs',errs);await b.close()
asyncio.run(main())
