# v3.10 : dossiers de pistes
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(viewport={'width':1440,'height':880});await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','99');localStorage.setItem('studio_supa','{\"url\":\"\"}')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)));A.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1500);E=A.evaluate
    await E("""document.querySelectorAll('.modal').forEach(m=>m.remove());
      for(let i=1;i<=3;i++){const t=newTrack('audio','Couplet '+i);t.role='voice';const ab=ctx.createBuffer(1,48000,48000);ab.getChannelData(0).fill(.2);const id=addBuffer(ab);t.regions.push({id:uid('r'),start:i*4,buf:id,offset:0,dur:1,name:'prise '+i});P.tracks.push(t)}
      E.build(P);renderAll()""")
    n0=await E("P.tracks.length");rows0=await E("document.querySelectorAll('#heads .head').length")
    print('pistes',n0,'lignes',rows0)
    # dialogue depuis le bouton 📁
    await E("SEL=P.tracks.find(t=>t.name==='Couplet 1').id;[...document.querySelectorAll('#heads button')].find(b=>b.textContent.includes('Dossier')).click()")
    await A.wait_for_timeout(300)
    print('nom proposé',await E("document.querySelector('.foldm input:not([type=checkbox])').value"))
    await E("document.querySelectorAll('.foldm input[type=checkbox]').forEach(cb=>{const t=findTrack(cb.dataset.t);cb.checked=/Couplet/.test(t.name)})")
    await A.screenshot(path='/home/claude/test/f_dialog.png')
    await E("[...document.querySelectorAll('.foldm button')].find(b=>b.textContent.includes('Créer')).click()");await A.wait_for_timeout(300)
    print('dossiers',await E("P.folders.map(f=>[f.name,foldMembers(f).length])"),'lignes',await E("document.querySelectorAll('#heads .head').length"),'couloirs',await E("document.querySelectorAll('#lanes .lane,#lanes .flane').length"),'aperçus',await E("document.querySelectorAll('.flane .fsum').length"))
    await A.screenshot(path='/home/claude/test/f_ferme.png')
    await E("document.querySelector('.fhead .ftog').click()");await A.wait_for_timeout(200)
    print('ouvert : lignes',await E("document.querySelectorAll('#heads .head').length"),'alignement têtes/couloirs',await E("[...document.querySelectorAll('#heads .head')].map(d=>d.dataset.t||'F'+d.dataset.f).join()===[...document.querySelectorAll('#lanes .lane,#lanes .flane')].map(d=>d.dataset.t||'F'+d.dataset.f).join()"))
    await A.screenshot(path='/home/claude/test/f_ouvert.png')
    # son : volume / muet / solo
    g=lambda: E("foldMembers(P.folders[0]).map(t=>+E.strips[t.id].fader.gain.value.toFixed(3)+'|'+E.strips[t.id].mute.gain.value.toFixed(2))")
    await E("P.folders[0].vol=-6;foldMembers(P.folders[0]).forEach(t=>E.updateStrip(t))");await A.wait_for_timeout(200);print('vol -6 dB',await g())
    await E("[...document.querySelectorAll('.fhead .btnM')][0].click()");await A.wait_for_timeout(200);print('muet',await g())
    await E("[...document.querySelectorAll('.fhead .btnM')][0].click();[...document.querySelectorAll('.fhead .btnS')][0].click()");await A.wait_for_timeout(200)
    print('solo dossier → autres pistes coupées',await E("P.tracks.filter(t=>!t.fold).map(t=>E.strips[t.id].mute.gain.value.toFixed(2))"),await g())
    await E("[...document.querySelectorAll('.fhead .btnS')][0].click()")
    # déplacer une prise : la ligne du dossier n'accepte pas, flèches clavier
    print('rowTrack ligne dossier',await E("rowTrack(rowIndex(P.tracks.find(t=>!t.fold).id))&&1"),await E("ROWS().map(r=>r.t?r.t.name:'📁'+r.f.name)"))
    # sortir / annuler / défaire
    await E("removeFromFolder(findTrack(foldMembers(P.folders[0])[2].id))");print('après sortie',await E("foldMembers(P.folders[0]).length"))
    await E("undo()");await A.wait_for_timeout(200);print('Ctrl+Z',await E("P.folders&&foldMembers(P.folders[0]).length"))
    await E("ungroupFolder(P.folders[0])");print('défait',await E("P.folders.length"),await E("P.tracks.length"),await E("document.querySelectorAll('#heads .head').length"))
    await E("undo()");await A.wait_for_timeout(200)
    # sauvegarde / rechargement
    await E("saveNow&&saveNow()") if await E("typeof saveNow==='function'") else None
    j=await E("JSON.stringify({f:P.folders,t:P.tracks.map(t=>t.fold||null)})");print('projet',j[:160])
    # export pistes séparées garde le son si le dossier est muet
    print('erreurs',errs);await b.close()
asyncio.run(main())
