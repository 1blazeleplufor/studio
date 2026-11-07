# v3.6 : défilement auto, suivi en lecture, roue de couleurs, préréglages ZZ, marqueurs, notes hors session, messages vocaux, panneau, fenêtres détachées
# Prérequis : python3 -m http.server 8765 (racine) + node tests/mock_supabase.js 8790
import asyncio,json,urllib.request
from playwright.async_api import async_playwright
URL='http://localhost:8765/';MOCK='http://localhost:8790'
INIT="localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','9');localStorage.setItem('studio_supa',JSON.stringify({url:'%s',key:'test'}));localStorage.setItem('studio_user',JSON.stringify({name:'%s',color:'%s'}))"
mock=lambda p: json.loads(urllib.request.urlopen(MOCK+p).read())
async def main():
  mock('/__reset')
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    c=await b.new_context(viewport={'width':1440,'height':880},permissions=['microphone']);await c.add_init_script(INIT%(MOCK,'Alice','#ff453a'));errs=[]
    A=await c.new_page();A.on('pageerror',lambda e: errs.append('A:'+str(e)))
    await A.goto(URL);await A.wait_for_timeout(1500);await A.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    E=lambda s: A.evaluate(s)
    # 1. défilement automatique en glissant une région vers le bord droit
    await E("PPB=26;renderLanes();$('#lanesWrap').scrollLeft=0")
    box=await E("(()=>{const r=document.querySelector('.lane .reg').getBoundingClientRect();return [r.left+30,r.top+20]})()");W=await E("(()=>{const r=$('#lanesWrap').getBoundingClientRect();return [r.right,r.top]})()")
    st0=await E("P.tracks[0].regions[0].start")
    await A.mouse.move(*box);await A.mouse.down();await A.mouse.move(W[0]-10,box[1],steps=8);await A.wait_for_timeout(1500)
    sl=await E("$('#lanesWrap').scrollLeft");st=await E("P.tracks[0].regions[0].start");await A.mouse.up()
    print('glisser au bord : la vue défile',sl>50,round(sl),'| la région suit',st0,'→',st)
    await E("undo()")
    # 2. suivi continu pendant la lecture
    await E("$('#lanesWrap').scrollLeft=0;PPB=120;renderLanes();PH=0;play()");await A.wait_for_timeout(4000)
    r=await E("(()=>{const W=$('#lanesWrap'),x=E.pos()*PPB;return [W.scrollLeft>0,Math.round((x-W.scrollLeft)/W.clientWidth*100)]})()")
    print('lecture : la vue suit',r[0],'| tête de lecture à',r[1],'% de la largeur')
    await A.mouse.wheel(600,0);await A.wait_for_timeout(200);await E("0");s1=await E("$('#lanesWrap').scrollLeft");await A.wait_for_timeout(800);s2=await E("$('#lanesWrap').scrollLeft")
    print('défilement à la main pendant la lecture : on ne force plus',abs(s2-s1)<2);await E("stopBtn();PPB=26;renderLanes()")
    # 3. roue de couleurs
    await E("SEL=P.tracks[0].id;colorPicker({clientX:300,clientY:200,target:document.body},P.tracks[0])");await A.wait_for_timeout(200)
    cv=await E("(()=>{const r=document.querySelector('.cpick canvas').getBoundingClientRect();return [r.left,r.top,r.width]})()")
    await A.screenshot(path='/home/claude/test/v36_wheel.png');await A.mouse.click(cv[0]+cv[2]/2,cv[1]+8)
    print('roue : couleur choisie',await E("P.tracks[0].color"),'| pipette (couleurs du projet) présente',await E("!document.querySelector('.cpick')"))
    # 4. préréglages ZZ
    out=[]
    for n in ['ZZ — mélodie (autotune)','ZZ — drill / trap (kickée)','ZZ — ad-libs / backs']:
      await E(f"applyVocalPreset(P.tracks.find(t=>t.type==='audio'),{json.dumps(n)})");await A.wait_for_timeout(300)
      out.append(await E("(()=>{const t=P.tracks.find(t=>t.type==='audio'),s=E.strips[t.id];return t.plugins.map(p=>p.type).join(',')+' | ok:'+s.plugins.every(Boolean)})()"))
    print('ZZ',out);ins=await E("(()=>{SEL=P.tracks.find(t=>t.type==='audio').id;renderInspector();return [...document.querySelectorAll('#insp .lib b')].map(x=>x.textContent).join('/')})()");print('catégories préréglages',ins)
    mix=await E("(async()=>{const b=await renderMix(P,0,8);let m=0;const d=b.getChannelData(0);for(let i=0;i<d.length;i++)m=Math.max(m,Math.abs(d[i]));return m.toFixed(2)})()");print('rendu avec ZZ : crête',mix)
    # 5. notes + marqueurs sans session
    await E("$('#lanesWrap').scrollLeft=0;drawRuler();cmtAdd(4,'note perso');markAdd(0,'Intro');markAdd(16,'Refrain')");await A.wait_for_timeout(200)
    print('hors session : notes',await E("P.cmts.map(c=>c.x)"),'épingles',await E("document.querySelectorAll('#lanes .cpin').length"),'marqueurs',await E("P.marks.map(m=>m.name+'@'+m.beat)"),'dans la règle',await E("MHITS.length"))
    await E("undo()");print('Ctrl+Z retire le dernier marqueur',await E("P.marks.map(m=>m.name)"));await E("redo()")
    hx=await E("(()=>{const R=$('#ruler').getBoundingClientRect(),k=MHITS.find(k=>k.m.name==='Refrain');return [R.left+k.x0+8,R.top+20]})()")
    await A.mouse.move(*hx);await A.mouse.down();await A.mouse.move(hx[0]+26*4,hx[1],steps=5);await A.mouse.up();print('marqueur glissé',await E("P.marks.find(m=>m.name==='Refrain').beat"))
    await A.mouse.click(hx[0]+26*4+5,hx[1]);await A.wait_for_timeout(100);print('clic sur marqueur → tête de lecture',await E("PH"))
    await A.mouse.click(hx[0]+300,hx[1],button='right');await A.wait_for_timeout(150);print('menu de la règle',await E("[...document.querySelectorAll('#menu > div')].map(d=>d.textContent).slice(0,4)"));await E("closeMenu()")
    await E("openPanel('marks')");await A.wait_for_timeout(200);await A.screenshot(path='/home/claude/test/v36_marks.png')
    # sauvegarde : notes et marqueurs restent dans le projet
    await E("saveLocal(true)");await A.wait_for_timeout(500);print('sauvegardé avec le projet',await E("(async()=>{const r=await IDB.get('projects',P.id);const j=JSON.parse(r.json);return [j.cmts.length,j.marks.length]})()"))
    # 6. panneau : largeur et côté
    g=await E("(()=>{const r=document.querySelector('#cpanel .cgrip').getBoundingClientRect();return [r.left+3,r.top+300]})()")
    await A.mouse.move(*g);await A.mouse.down();await A.mouse.move(g[0]-150,g[1],steps=5);await A.mouse.up()
    print('panneau élargi',await E("[C2.w,document.querySelector('#cpanel').offsetWidth,Math.round($('#app').getBoundingClientRect().width)]"))
    await A.click('#cpanel button[title^="Mettre le panneau"]');await A.wait_for_timeout(100)
    print('panneau à gauche',await E("[C2.side,document.querySelector('#cpanel').getBoundingClientRect().left,Math.round($('#app').getBoundingClientRect().left)]"),'barre sans débordement',await E("$('#bar').scrollWidth-$('#bar').clientWidth"))
    await A.screenshot(path='/home/claude/test/v36_left.png');await A.click('#cpanel button[title^="Mettre le panneau"]')
    # 7. session + message vocal
    await E("collabStart(newRoom(),true)");await A.wait_for_timeout(1500);room=await E("COLLAB.room")
    c2=await b.new_context(viewport={'width':1280,'height':800});await c2.add_init_script(INIT%(MOCK,'Bob','#30d158'));B=await c2.new_page();B.on('pageerror',lambda e: errs.append('B:'+str(e)))
    await B.goto(URL+'#room='+room);await B.wait_for_timeout(3500)
    print('B voit les notes et marqueurs du projet',await B.evaluate("[P.cmts.length,P.marks.length,document.querySelectorAll('#lanes .cpin').length]"))
    await E("openPanel('chat')");await A.wait_for_timeout(200);await A.click('#cpanel button[title^="Message vocal"]');await A.wait_for_timeout(2200)
    await A.screenshot(path='/home/claude/test/v36_rec.png');await A.click('#cpanel .cin.rec .send');await A.wait_for_timeout(2000)
    v=await B.evaluate("(()=>{const m=CHAT().toArray().find(m=>m.voc);return m&&m.voc})()");print('message vocal reçu par B',v)
    au=await B.evaluate("(async()=>{const m=CHAT().toArray().find(m=>m.voc);const r=await fetch(vocURL(m.voc));return [r.status,(await r.arrayBuffer()).byteLength]})()");print('fichier vocal',au)
    n0=await B.evaluate("P.tracks.length");await B.evaluate("(async()=>{const m=CHAT().toArray().find(m=>m.voc);await vocToTrack(m.voc,8,null,m.n)})()");await B.wait_for_timeout(1500)
    print('vocal → nouvelle piste chez B',await B.evaluate("[P.tracks.length,P.tracks.slice(-1)[0].name,P.tracks.slice(-1)[0].regions[0].start,P.tracks.slice(-1)[0].regions[0].dur.toFixed(1)]"),n0,'| A la voit',await E("P.tracks.slice(-1)[0].name"))
    await A.wait_for_timeout(5000);print('son du vocal envoyé à A',await E("(()=>{const r=P.tracks.slice(-1)[0].regions[0];return !!BUFS[r.buf]})()"))
    # glisser le vocal depuis le chat sur une piste (B)
    await B.evaluate("openPanel('chat')");await B.wait_for_timeout(300)
    ok=await B.evaluate("""(()=>{const src=document.querySelector('#cpanel .cvoc');const dt=new DataTransfer();src.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
      const L=$('#lanes').getBoundingClientRect();const t=document.querySelector('#lanes').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:L.left+26*12,clientY:L.top+TH*4+10}));return dt.types.join(',')})()""")
    await B.wait_for_timeout(1500);print('glisser-déposer du vocal',ok,await B.evaluate("P.tracks.map(t=>t.name+':'+t.regions.filter(r=>/🎤/.test(r.name||'')).map(r=>r.start)).filter(s=>!s.endsWith(':')).join(' | ')"))
    # 8. fenêtres détachées
    await E("closePanel();detachOpen('chat')");await A.wait_for_timeout(800);pages=c.pages;pop=[x for x in pages if x!=A]
    print('chat détaché : fenêtre',len(pop)==1,'| panneau dans la fenêtre',await pop[0].evaluate("!!document.getElementById('cpanel')") if pop else None,'| plus dans la principale',await E("!Document.prototype.getElementById.call(document,'cpanel')"),'| appli pleine largeur',await E("Math.round($('#app').getBoundingClientRect().width)"))
    await B.evaluate("chatSend('hello la fenêtre détachée')");await A.wait_for_timeout(800)
    print('message affiché dans la fenêtre détachée',await pop[0].evaluate("[...document.querySelectorAll('.cmsg .ctxt')].some(x=>x.textContent.includes('détachée'))"))
    await pop[0].fill('#cpanel .cin input','écrit depuis le 2e écran');await pop[0].keyboard.press('Enter');await A.wait_for_timeout(600);print('envoi depuis la fenêtre détachée',await B.evaluate("CHAT().toArray().slice(-1)[0].x"))
    await pop[0].screenshot(path='/home/claude/test/v36_detached_chat.png')
    await pop[0].close();await A.wait_for_timeout(2000);print('fermeture → retour dans la principale',await E("!!Document.prototype.getElementById.call(document,'cpanel')"),'| position mémorisée',await E("JSON.stringify(LAY().chat)"))
    await E("closePanel();setTab('mixer');detachOpen('bottom')");await A.wait_for_timeout(800);pop=[x for x in c.pages if x!=A]
    print('mixeur détaché',bool(pop) and await pop[0].evaluate("document.querySelectorAll('.strip').length"),'| vumètres animés',None)
    await E("PH=0;play()");await A.wait_for_timeout(1200);print('vumètres dans la fenêtre détachée',await pop[0].evaluate("[...document.querySelectorAll('.meter i')].some(i=>parseFloat(i.style.height)>1)"));await E("stopBtn()")
    await E("(()=>{const t=P.tracks.find(t=>t.type==='synth');EDIT={t:t.id,r:t.regions[0].id}})()");await pop[0].click('#btabs [data-tab=piano]');await A.wait_for_timeout(300);print('piano roll dans la fenêtre détachée',await pop[0].evaluate("!!document.getElementById('prCanvas')"))
    await pop[0].keyboard.press('Space');await A.wait_for_timeout(300);print('raccourci Espace depuis la fenêtre détachée',await E("E.playing"));await E("stopBtn()")
    await pop[0].screenshot(path='/home/claude/test/v36_detached_mixer.png')
    await pop[0].close();await A.wait_for_timeout(2000);print('panneau du bas revenu',await E("!!Document.prototype.getElementById.call(document,'bottom')&&!!document.querySelector('#app #bottom')"))
    await E("openPlugin(P.tracks.find(t=>t.type==='audio'),0)");await A.wait_for_timeout(200);k=await E("Object.keys(WINS)[0]")
    await E(f"detachOpen('plug:{k}',WINS['{k}'].el)");await A.wait_for_timeout(800);pop=[x for x in c.pages if x!=A];print('effet détaché',bool(pop) and await pop[0].evaluate("!!document.querySelector('.pwin .knob')"))
    if pop:await pop[0].close()
    await A.wait_for_timeout(1500);print('ERR',errs[:5]);await b.close()
asyncio.run(main())
