# v3.7.6 : export rapide identique (avec chorus), MP3, stems, dossier d'enregistrement dans les réglages
import asyncio
from playwright.async_api import async_playwright
URL='http://localhost:8765/'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    c=await b.new_context(viewport={'width':1440,'height':880},accept_downloads=True);await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','9')");errs=[]
    A=await c.new_page();A.on('pageerror',lambda e: errs.append(str(e)))
    await A.goto(URL);await A.wait_for_timeout(1500);await A.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    E=lambda s: A.evaluate(s)
    r=await E("""(async()=>{const sr=44100,mk=(sec,f)=>{const b=new AudioBuffer({length:sr*sec,numberOfChannels:2,sampleRate:sr});for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=.3*Math.sin(2*Math.PI*f*i/sr)}return b};
      const au=P.tracks.filter(t=>t.type==='audio');P.tracks.forEach(t=>t.regions=[]);const t1=au[0],t2=au[1]||au[0];t1.regions=[{id:'ra',start:4,offset:0,dur:3,buf:addBuffer(mk(3,220)),name:'a'}];t2.regions.push({id:'rb',start:20,offset:0,dur:2,buf:addBuffer(mk(2,330)),name:'b'});
      t1.plugins=(t1.plugins||[]).concat([{id:'pc',type:'chorus',byp:false,params:Object.fromEntries(PLUGINS.chorus.params.map(q=>[q.id,q.def]))}]);E.build(P);
      const to=Math.max(...P.tracks.flatMap(t=>t.regions.map(r=>r.start+rLen(t,r))));
      RENDER_GATING=false;let t0=performance.now();const A0=await renderMix(P,0,to);const ta=performance.now()-t0;
      RENDER_GATING=true;t0=performance.now();const B0=await renderMix(P,0,to);const tb=performance.now()-t0;
      let m=0;for(let c=0;c<2;c++){const x=A0.getChannelData(c),y=B0.getChannelData(c);for(let i=0;i<x.length;i++)m=Math.max(m,Math.abs(x[i]-y[i]))}
      return ['écart max',m,'avant ms',Math.round(ta),'après ms',Math.round(tb)]})()""")
    print('rendu identique avec chorus',r)
    async with A.expect_download(timeout=120000) as d: await E("exportMix('all','mp3')")
    dl=await d.value;path=await dl.path();data=open(path,'rb').read()
    print('MP3',dl.suggested_filename,len(data),'octets, en-tête',data[:3]==b'ID3' or data[0]==0xFF)
    n=await E("P.tracks.filter(t=>t.regions.length).length");names=[]
    A.on('download',lambda d: names.append(d.suggested_filename))
    await E("exportMix('stems')");await A.wait_for_timeout(1500);print('stems',n,'pistes →',names)
    await E("settingsModal()");await A.wait_for_timeout(500)
    print('réglages : dossier',await E("[...document.querySelectorAll('.modal .kv2')].map(x=>x.textContent).filter(t=>/Dossier|Compensation/.test(t))"),
      await E("[...document.querySelectorAll('.modal button')].map(b=>b.textContent).filter(t=>/dossier/i.test(t))"),'latence',await E("P.settings.latencyMs"))
    await A.screenshot(path='/home/claude/test/v376_reglages.png')
    print('erreurs',errs);await b.close()
asyncio.run(main())
