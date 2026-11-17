# 3.14 : chat emojis + GIF, échos coupés à l'arrêt
# Prérequis : python3 -m http.server 8765 (racine) + node tests/mock_supabase.js 8790
import asyncio,json,urllib.request,base64
from playwright.async_api import async_playwright
URL='http://localhost:8765/';MOCK='http://localhost:8790'
INIT="localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.15.0');localStorage.setItem('studio_supa',JSON.stringify({url:'%s',key:'test'}));localStorage.setItem('studio_user',JSON.stringify({name:'%s',color:'%s'}))"
GIF=base64.b64decode('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==')
async def main():
  urllib.request.urlopen(MOCK+'/__reset').read()
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required']);errs=[]
    async def dev(n,col):
      c=await b.new_context(viewport={'width':1280,'height':800});await c.add_init_script(INIT%(MOCK,n,col));pg=await c.new_page();pg.on('pageerror',lambda e: errs.append(n+':'+str(e)));return pg
    A=await dev('Alice','#ff453a');B=await dev('Bob','#30d158')
    await A.goto(URL);await A.wait_for_timeout(1500);await A.evaluate("collabStart(newRoom(),true)");await A.wait_for_timeout(800)
    room=await A.evaluate("COLLAB.room");await B.goto(URL+'#room='+room);await B.wait_for_timeout(3500)
    await A.evaluate("openPanel('chat')");await B.evaluate("openPanel('chat')");await A.wait_for_timeout(300)
    await A.click('#cpanel .cin button[title=Emojis]');await A.wait_for_timeout(200)
    print('emojis',await A.evaluate("document.querySelectorAll('#cpanel .cpgrid button').length"),'texte parasite',await A.evaluate("/null|false/.test([...document.querySelector('#cpanel').childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(''))"))
    await A.fill('#cpanel .cin input','yo ');await A.evaluate("document.querySelectorAll('#cpanel .cpgrid button')[3].click();document.querySelectorAll('#cpanel .cpgrid button')[5].click()")
    print('champ',await A.evaluate("document.querySelector('#cpanel .cin input').value"));await A.press('#cpanel .cin input','Enter')
    await A.fill('#cpanel .cin input','🔥🔥');await A.press('#cpanel .cin input','Enter')
    await A.click('#cpanel .cgifb');await A.wait_for_timeout(200)
    await A.set_input_files('#cpanel .cpick input[type=file]',{'name':'x.gif','mimeType':'image/gif','buffer':GIF});await A.wait_for_timeout(1200)
    await A.click('#cpanel .cgifb');await A.fill('#cpanel .cplink input','https://giphy.com/gifs/cat-funny-JIX9t2j0ZTN9S');await A.press('#cpanel .cplink input','Enter');await A.wait_for_timeout(300)
    await A.click('#cpanel .cgifb');await A.fill('#cpanel .cplink input','https://evil.example/x.gif');await A.press('#cpanel .cplink input','Enter');await A.wait_for_timeout(200)
    print('lien refusé',await A.evaluate("document.querySelector('#cpanel .cpst').textContent.slice(0,18)"))
    await B.wait_for_timeout(800)
    print('chez Bob',await B.evaluate("[...document.querySelectorAll('#cpanel .cmsg .ctxt')].map(e=>e.className+'|'+(e.querySelector('img')?'IMG '+e.querySelector('img').src.replace(/.*\\//,'').replace(/^[a-z0-9]{12}/,'<id>'):e.textContent))"))
    print('gif chargé chez Bob',await B.evaluate("document.querySelector('#cpanel .cgif').naturalWidth"))
    await A.screenshot(path='/home/claude/test/chat.png')
    # --- échos : après Stop, plus de son ---
    r=await A.evaluate("""(async()=>{const bf=ctx.createBuffer(1,48000,48000);const d=bf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=.5*Math.sin(i/12);const id=addBuffer(bf);
      const t=newTrack('audio','V');t.plugins=[plug('delay',{mix:60,fb:80,sync:0,ms:300})];t.sends=[-3,-3];t.regions.push({id:uid('r'),start:0,offset:0,dur:1,buf:id,name:'x'});P.tracks=[t];P.cycle.on=false;P.settings.metroPlay=false;E.build(P);
      const lv=()=>meterLevel(E.strips.master.an);E.play(0);await new Promise(r=>setTimeout(r,1300));const playing=lv();E.stop();await new Promise(r=>setTimeout(r,350));const a=lv();await new Promise(r=>setTimeout(r,600));const b2=lv();
      E.play(0);await new Promise(r=>setTimeout(r,500));const again=lv();E.stop();return [playing,a,b2,again].map(x=>+x.toFixed(4))})()""")
    print('niveau [lecture, 0.35 s après stop, 1 s après, relecture]',r)
    print('erreurs',errs);await b.close()
asyncio.run(main())
