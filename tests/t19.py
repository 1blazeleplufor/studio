# v3.7 : chat (champ vidé), notes par piste / position en direct / épingles toujours visibles, paroles (panneau, bas, détacher, fusion à 2),
# inspecteur redimensionnable / fermable / déplaçable / détachable, glisser vers un bord, mode focus, dispositions 1-2-3, raccourcis, menu « ⋯ »,
# prompteur, prises multiples
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
    # barre d'outils : rien de coupé
    print('outils : rien de caché sans le savoir',await E("(()=>{const T=$('#arrtools');return [T.scrollWidth<=T.clientWidth+1,[...T.children].filter(x=>x.dataset.hid).map(x=>x.textContent.trim()||x.title).join(' '),!!$('#bNotes')&&getComputedStyle($('#bNotes')).display!=='none']})()"))
    # inspecteur : redimensionner, fermer, rouvrir (I), côté droit
    g=await E("(()=>{const r=document.querySelector('#main>.pgrip').getBoundingClientRect();return [r.left+3,r.top+200]})()")
    await A.mouse.move(*g);await A.mouse.down();await A.mouse.move(g[0]+120,g[1],steps=5);await A.mouse.up()
    print('inspecteur élargi',await E("[UI.insp.w,Math.round($('#insp').getBoundingClientRect().width)]"))
    await A.click('#insp .phead button[title=Fermer]');await A.wait_for_timeout(100);c1=await E("getComputedStyle($('#insp')).display")
    await A.keyboard.press('i');await A.wait_for_timeout(100);print('fermé puis rouvert avec I',c1,'→',await E("getComputedStyle($('#insp')).display"),'| bouton ⓘ allumé',await E("$('#bInsp').classList.contains('on')"))
    # glisser l'en-tête de l'inspecteur vers la zone de droite
    hd=await E("(()=>{const r=document.querySelector('#insp .phead b').getBoundingClientRect();return [r.left+10,r.top+8]})()")
    await A.mouse.move(*hd);await A.mouse.down();await A.mouse.move(800,400,steps=4);z=await E("!!document.getElementById('dockz')");await A.mouse.move(1400,400,steps=6);hot=await E("document.querySelector('#dockz .dz.right.hot')!==null");await A.mouse.up()
    print('glisser vers la droite : zones affichées',z,'zone bleue',hot,'| inspecteur à droite',await E("[UI.insp.side,Math.round($('#insp').getBoundingClientRect().left)>900]"))
    await A.screenshot(path='/home/claude/test/v37_insp_right.png');await E("UI.insp.side='left';applyLayout()")
    # paroles : L, texte projet, piste, repère de mesure
    await A.keyboard.press('l');await A.wait_for_timeout(200);print('paroles ouvertes (L)',await E("getComputedStyle(document.getElementById('lyr')).display!=='none'&&!!document.querySelector('#lyr .lyrtxt')"))
    await A.click('#lyr .lyrtxt');await A.keyboard.type("Intro calme\nRefrain qui tape");await A.wait_for_timeout(100);print('paroles du projet',repr(await E("P.lyrics")))
    v1=await E("P.tracks.find(t=>t.name==='Voix 1').id");await A.select_option('#lyr .lyrsel',v1);await A.click('#lyr .lyrtxt');await A.keyboard.type('couplet de la voix');await E("PH=16")
    await A.click('#lyr .lyrbar button[title^="Insérer"]');print('paroles de la piste + repère',repr(await E(f"findTrack('{v1}').lyrics")))
    await E("$('#lanesWrap').focus();document.activeElement.blur()");await A.keyboard.press('Control+z');await A.wait_for_timeout(200);print('Ctrl+Z (hors du texte) annule le dernier bloc',repr(await E(f"findTrack('{v1}').lyrics")))
    await A.screenshot(path='/home/claude/test/v37_lyrics.png')
    # paroles en bas puis remises sur le côté
    await A.click('#lyr .phead button[title^="Mettre en bas"]');await A.wait_for_timeout(200)
    print('paroles dans le panneau du bas',await E("[TAB,!!document.querySelector('#bcontent #lyr .lyrtxt'),getComputedStyle(document.querySelector('#btabs [data-tab=lyrics]')).display!=='none']"))
    await A.screenshot(path='/home/claude/test/v37_lyrics_bottom.png')
    await A.click('#lyr .phead button[title^="Remettre sur le côté"]');await A.wait_for_timeout(200);print('remises sur le côté',await E("[UI.lyr.where,document.getElementById('lyr').parentNode.id]"))
    # mode focus, dispositions
    await A.keyboard.press('f');await A.wait_for_timeout(150);f1=await E("[getComputedStyle($('#insp')).display,getComputedStyle(document.getElementById('lyr')).display,getComputedStyle($('#bottom')).display]")
    await A.keyboard.press('Escape');await A.wait_for_timeout(150);print('focus (F) cache tout',f1,'| Échap réaffiche',await E("getComputedStyle($('#insp')).display"))
    await A.keyboard.press('3');await A.wait_for_timeout(300);s3=await E("[TAB,$('#bottom').classList.contains('open'),Math.round($('#bottom').offsetHeight/innerHeight*100),UI.lyr.open]")
    await A.keyboard.press('1');await A.wait_for_timeout(300);s1=await E("[UI.insp.open,UI.lyr.open,C2.open,C2.tab]")
    await A.keyboard.press('2');await A.wait_for_timeout(300);s2=await E("[UI.insp.open,UI.lyr.open,UI.lyr.font,C2.open]")
    print('dispositions : 3 Mix',s3,'| 1 Écriture',s1,'| 2 Enregistrement',s2)
    await E("UI.lyr.w=300;applyLayout();saveScreen(1,'Ma dispo')");await A.keyboard.press('3');await A.keyboard.press('1');await A.wait_for_timeout(200);print('disposition perso',await E("[SCREENS()[1].n,UI.lyr.w]"))
    print('barre du haut sans débordement',await E("$('#bar').scrollWidth-$('#bar').clientWidth"))
    await A.screenshot(path='/home/claude/test/v37_screen1.png')
    # notes : clic droit sur une piste, position en direct, toujours visibles
    await E("$('#lanesWrap').scrollLeft=0;drawRuler()")
    pos=await E("(()=>{PPB=26;renderLanes();const W=$('#lanesWrap');W.scrollLeft=26*19;W.scrollTop=0;drawRuler();const L=$('#lanes').getBoundingClientRect();return [L.left+26*20+5,L.top+TH*2+30]})()");await A.mouse.click(*pos,button='right');await A.wait_for_timeout(150)
    print('menu clic droit piste',await E("[...document.querySelectorAll('#menu > div')].map(d=>d.textContent).slice(0,3)"))
    await A.click('#menu >> text=sur cette piste');await A.wait_for_timeout(200);await A.fill('#cpanel textarea.newc','ad-lib ici');await A.click('#cpanel .cnew button >> text=Ajouter')
    n=await E("P.cmts.slice(-1)[0]");print('note sur la piste',n['tid']==await E("P.tracks[2].id"),n['beat'],'| épingle sur la bonne piste',await E("(()=>{const p=[...document.querySelectorAll('#lanes .cpin')].pop();return Math.round(parseFloat(p.style.top)/TH)})()"))
    await E("$('#lanesWrap').scrollLeft=0;drawRuler();PH=4;updatePlayhead(4)");await A.wait_for_timeout(300);l1=await E("document.querySelector('#cpanel .cposlbl').textContent");await E("PH=20;updatePlayhead(20)");await A.wait_for_timeout(300)
    l2=await E("document.querySelector('#cpanel .cposlbl').textContent");await A.fill('#cpanel textarea.newc','note globale');await A.click('#cpanel .cnew button >> text=Ajouter')
    await E("$('#lanesWrap').scrollLeft=26*18;drawRuler()");print('position en direct',l1,'→',l2,'| note posée à',await E("P.cmts.slice(-1)[0].beat"),'| dans la règle',await E("NHITS.length"))
    await E("cmtSet(P.cmts[0].id,'done',true)");print('note résolue toujours visible',await E("[document.querySelectorAll('#lanes .cpin.done').length+NHITS.filter(k=>k.c.done).length]"))
    rp=await E("(()=>{const R=$('#ruler').getBoundingClientRect(),k=NHITS[0];return [R.left+k.x,R.top+6]})()");await A.mouse.move(*rp);await A.wait_for_timeout(100);print('aperçu au survol',await E("(document.getElementById('ntip')||{}).textContent"))
    await A.screenshot(path='/home/claude/test/v37_notes.png')
    # chat : le champ se vide
    await E("closePanel();collabStart(newRoom(),true)");await A.wait_for_timeout(1200);await E("openPanel('chat')");await A.wait_for_timeout(200)
    await A.fill('#cpanel .cin input','premier message');await A.keyboard.press('Enter');await A.wait_for_timeout(200);e1=await E("document.querySelector('#cpanel .cin input').value")
    await A.fill('#cpanel .cin input','deuxième');await A.click('#cpanel .cin button >> text=➤');await A.wait_for_timeout(200);e2=await E("document.querySelector('#cpanel .cin input').value")
    print('chat : champ vidé après Entrée',repr(e1),'et après ➤',repr(e2),'| messages',await E("CHAT().toArray().map(m=>m.x)"))
    # paroles à deux en même temps (fusion)
    room=await E("COLLAB.room");c2=await b.new_context(viewport={'width':1280,'height':800});await c2.add_init_script(INIT%(MOCK,'Bob','#30d158'));B=await c2.new_page();B.on('pageerror',lambda e: errs.append('B:'+str(e)))
    await B.goto(URL+'#room='+room);await B.wait_for_timeout(3500)
    print('B reçoit les paroles',repr(await B.evaluate("P.lyrics")))
    await asyncio.gather(E("P.lyrics='ALICE '+P.lyrics"),B.evaluate("P.lyrics=P.lyrics+' BOB'"));await A.wait_for_timeout(1200)
    la,lb=await asyncio.gather(E("P.lyrics"),B.evaluate("P.lyrics"));print('écrit en même temps → fusion',la==lb,repr(la))
    await B.evaluate(f"toggleLock('{v1}')");await A.wait_for_timeout(500);await E(f"UI.lyr.tab='{v1}';UI.lyr.open=true;applyLayout();renderLyrics()")
    print('piste verrouillée par Bob → paroles en lecture seule chez Alice',await E("document.querySelector('#lyr .lyrtxt').readOnly"))
    # détacher les paroles et l'inspecteur
    await E("detachOpen('lyr',ensureLyr())");await A.wait_for_timeout(700);pop=[x for x in c.pages if x!=A]
    print('paroles détachées',bool(pop) and await pop[0].evaluate("!!document.querySelector('#lyr .lyrtxt')"),'| plus dans la principale',await E("!Document.prototype.getElementById.call(document,'lyr')"))
    if pop:await pop[0].close()
    await A.wait_for_timeout(1800);print('revenues',await E("!!Document.prototype.getElementById.call(document,'lyr')"))
    await E("detachOpen('insp',Document.prototype.getElementById.call(document,'insp'))");await A.wait_for_timeout(700);pop=[x for x in c.pages if x!=A]
    print('inspecteur détaché',bool(pop) and await pop[0].evaluate("!!document.querySelector('#insp .phead')"),'| colonne de l’inspecteur libérée',await E("getComputedStyle($('#main')).gridTemplateColumns.split(' ').length"))
    if pop:
      await E("SEL=P.tracks[1].id;renderInspector()");await A.wait_for_timeout(200);print('inspecteur détaché suit la piste',await pop[0].evaluate("document.querySelector('#insp h3:not(.fold)')&&document.querySelector('#insp').textContent.includes('Basse')"));await pop[0].close()
    await A.wait_for_timeout(1800);print('inspecteur revenu',await E("[!!document.querySelector('#main>#insp'),getComputedStyle($('#insp')).display]"))
    await E("collabStop(true)")
    # prises multiples + prompteur
    await E(f"P.settings.countIn=0;SEL='{v1}';UI.prompt=true;findTrack('{v1}').lyrics='[1] premier vers\\n[2] deuxième vers';findTrack('{v1}').arm=true;PH=0")
    await E("toggleRecord()");await A.wait_for_timeout(1500);pr=await E("[!!document.getElementById('prompter'),(document.querySelector('#prompter .pl.cur')||{}).textContent]")
    await A.screenshot(path='/home/claude/test/v37_prompter.png');await E("stopRecord()");await A.wait_for_timeout(300)
    print('prompteur à l’enregistrement',pr,'| fermé après',await E("!document.getElementById('prompter')"))
    await E("PH=0;toggleRecord()");await A.wait_for_timeout(1200);await E("stopRecord()");await A.wait_for_timeout(300)
    await E("PH=0;toggleRecord()");await A.wait_for_timeout(1000);await E("stopRecord()");await A.wait_for_timeout(300)
    t=await E(f"(()=>{{const t=findTrack('{v1}');const r=t.regions.filter(r=>r.takes).pop();return r?[t.regions.length,r.takes.length,r.take,r.name,!!document.querySelector('.reg .tk')]:null}})()")
    print('3 prises au même endroit',t)
    await E(f"(()=>{{const t=findTrack('{v1}');const r=t.regions.find(r=>r.takes);window._b=[r.buf];setTake(t,r,0);_b.push(r.buf);SELR=new Set([r.id]);PH=r.start+0.5;splitAtPH()}})()")
    t2=await E(f"(()=>{{const t=findTrack('{v1}');const rs=t.regions.filter(r=>r.takes);const r2=rs[1];setTake(t,r2,2);return [rs.length,rs.map(r=>r.take),_b[0]!==_b[1],rs[0].buf!==rs[1].buf,usedBufs(P).size]}})()")
    print('choisir une prise + couper + autre prise sur le 2e bout',t2)
    await E(f"SELR=new Set([findTrack('{v1}').regions.find(r=>r.takes).id])");await A.keyboard.press('Alt+ArrowDown');print('Alt+↓ prise suivante',await E(f"findTrack('{v1}').regions.find(r=>r.takes).take"))
    pk=await E("(async()=>{const b=await renderMix(P,0,4);let m=0;const d=b.getChannelData(0);for(let i=0;i<d.length;i++)m=Math.max(m,Math.abs(d[i]));return m.toFixed(2)})()");print('rendu avec prises : crête',pk)
    await E("saveLocal(true)");await A.wait_for_timeout(600);print('prises sauvegardées',await E("(async()=>{const r=await IDB.get('projects',P.id);const j=JSON.parse(r.json);const rr=j.tracks.flatMap(t=>t.regions).filter(r=>r.takes);let ok=true;for(const x of rr)for(const k of x.takes)if(!(await IDB.get('buffers',k.buf)))ok=false;return [rr.length,ok]})()"))
    await A.screenshot(path='/home/claude/test/v37_takes.png')
    print('ERR',errs[:6]);await b.close()
asyncio.run(main())
