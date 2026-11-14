# v3.9 : retour casque sans décalage
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(viewport={'width':1440,'height':880},permissions=['microphone']);await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','9');localStorage.setItem('studio_lat','playback')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)));A.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1500);E=A.evaluate
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove());const v=P.tracks.find(t=>t.type==='audio'&&!isInstru(t));SEL=v.id;v.plugins=[{type:'eq',params:Object.fromEntries(PLUGINS.eq.params.map(q=>[q.id,q.def])),byp:false},{type:'tunepro',params:Object.fromEntries(PLUGINS.tunepro.params.map(q=>[q.id,q.def])),byp:false},{type:'comp',params:Object.fromEntries(PLUGINS.comp.params.map(q=>[q.id,q.def])),byp:false}];v.sends[0]=-6;E.build(P);renderAll();window._v=v")
    lat0=await E("P.settings.latencyMs");print('latence projet avant',lat0)
    await E("toggleMon(_v)");await A.wait_for_timeout(1200)
    print('mode',await E("monMode()"),'| circuit rapide',await E("!!MON.tr[_v.id]"),'| ancien circuit',await E("Object.keys(E.monGains||{}).length"))
    print('effets dans le casque',await E("MON.tr[_v.id].plugins.map(x=>!!x)"),'(eq,tunepro coupé,comp)')
    print('réverb dans le casque',await E("Object.keys(MON.aux)"))
    # le son sort-il ? analyser sur le bus du retour
    lvl=await E("new Promise(r=>{const an=MON.ctx.createAnalyser();MON.bus.connect(an);const d=new Float32Array(2048);setTimeout(()=>{an.getFloatTimeDomainData(d);r(Math.max(...d.map(Math.abs)))},600)})")
    print('niveau en sortie du retour',round(lvl,3),'| contexte principal',await E("E.ctx.baseLatency"),'| retour',await E("MON.ctx.baseLatency"))
    # volume suivi
    await E("_v.vol=-12;E.updateStrip(_v)");await A.wait_for_timeout(200);print('volume suivi',round(await E("MON.tr[_v.id].fader.gain.value"),3))
    # contournement d'un effet -> reconstruit
    await E("_v.plugins[2].byp=true;E.updateStrip(_v)");print('comp contourné',await E("MON.tr[_v.id].plugins.map(x=>!!x)"))
    # réglages
    await E("settingsModal()");await A.wait_for_timeout(500);print('ligne réglages',await E("[...document.querySelectorAll('.modal .kv2')].some(x=>/Retour casque/.test(x.textContent))"))
    await A.screenshot(path='/home/claude/test/v39_reglages.png')
    await E("monSetMode('full')");await A.wait_for_timeout(300)
    print('mode complet -> ancien circuit',await E("Object.keys(E.monGains||{}).length"),'circuit rapide',await E("!!MON.tr[_v.id]"))
    await E("monSetMode('direct')");await A.wait_for_timeout(300)
    print('retour direct',await E("!!MON.tr[_v.id]"),await E("Object.keys(E.monGains||{}).length"))
    await E("document.querySelectorAll('.modal').forEach(m=>m.remove());toggleMon(_v)");await A.wait_for_timeout(200)
    print('éteint',await E("!!MON.tr[_v.id]"),await E("Object.keys(E.monGains||{}).length"))
    # enregistrement toujours ok
    await E("P.settings.countIn=0;P.tracks.forEach(t=>t.arm=false);_v.arm=true;SEL=_v.id;renderAll();toggleMon(_v)");await A.wait_for_timeout(500)
    n0=await E("_v.regions.length");await E("PH=0;toggleRecord()");await A.wait_for_timeout(1500);await E("stopRecord()");await A.wait_for_timeout(800);print('régions avant',n0)
    print('prise enregistrée',await E("_v.regions.length"),'| latence projet après',await E("P.settings.latencyMs"),'| mode audio',await E("localStorage.getItem('studio_lat')"))
    print('erreurs',errs);await b.close()
asyncio.run(main())
