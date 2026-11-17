# 3.15 : préréglages voix — chaque chaîne marche, pas de saturation, même niveau que la prise soit forte ou faible
import asyncio,json
from playwright.async_api import async_playwright
VOICE="""window.mkVoice=(db)=>{const SR=48000,N=SR*4,b=ctx.createBuffer(1,N,SR),y=b.getChannelData(0);const F=[[700,80,1],[1220,90,.5],[2600,120,.25],[3300,200,.1]],env=f=>F.reduce((a,[c,w,g])=>a+g/(1+((f-c)/w)**2),0)+.02;
 let ph=0;const notes=[[57,.8,30],[60,.7,-35],[64,.8,25],[62,.7,-30]];let i=0,prev=57;
 for(const [m,d,c] of notes){const n=Math.round(d*SR);for(let k=0;k<n;k++,i++){const t=k/SR,mm=prev+(m-prev)*Math.min(1,t/.06)+c/100+.25*Math.sin(2*Math.PI*5.5*i/SR)*Math.min(1,t/.3),f=440*Math.pow(2,(mm-69)/12);ph+=2*Math.PI*f/SR;
   let s=0;for(let h=1;h*f<8000;h++)s+=Math.sin(h*ph)*env(h*f)/Math.sqrt(h);y[i]=.12*s*Math.min(1,t/.02)*Math.min(1,(d-t)/.04)}prev=m;i+=Math.round(.15*SR)}
 // un « s » appuyé
 let l=0;for(let k=0;k<SR*.15;k++){const x=Math.random()*2-1;y[i+k]=(x-l)*.35*Math.sin(Math.PI*k/(SR*.15));l=x}
 let e=0,c=0;for(const v of y)if(Math.abs(v)>1e-3){e+=v*v;c++}const g=Math.pow(10,db/20)/Math.sqrt(e/c);for(let k=0;k<N;k++)y[k]*=g;return addBuffer(b)};
 window.meas=async(name,db,sends)=>{const bid=mkVoice(db),t=newTrack('audio','V');t.regions.push({id:uid('r'),start:0,offset:0,dur:4,buf:bid,name:'v'});P.tracks=[t];P.bpm=120;P.cycle.on=false;P.master.plugins=[];
  if(name)applyVocalPreset(t,name);if(!sends)t.sends=t.sends.map(()=>-60);E.build(P);const out=await renderMix(deep(P),0,8),d=out.getChannelData(0),SR=out.sampleRate;
  let e=0,c=0,pk=0,nan=0;for(let i=0;i<SR*3.3;i++){const v=d[i];if(!isFinite(v))nan++;const a=Math.abs(v);if(a>pk)pk=a;if(a>1e-3){e+=v*v;c++}}
  let es=0;for(let i=Math.round(SR*3.5);i<SR*3.7;i++)es+=d[i]*d[i];
  return {rms:+(10*Math.log10(e/Math.max(1,c))).toFixed(1),pk:+(20*Math.log10(pk)).toFixed(1),s:+(10*Math.log10(es/(SR*.2)+1e-12)).toFixed(1),nan}}"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome');c=await b.new_context();await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','3.15.0')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)));A.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1800);await A.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())");await A.evaluate(VOICE)
    ref=await A.evaluate("Promise.all([meas(null,-14),meas(null,-28)])");print('sans effet           prise forte',ref[0],'| prise faible',ref[1])
    names=await A.evaluate("Object.keys(VOCAL_PRESETS).filter(n=>n!=='Aucun effet')")
    bad=[]
    for n in names:
      r=await A.evaluate(f"(async()=>[await meas({json.dumps(n)},-14),await meas({json.dumps(n)},-28),await meas({json.dumps(n)},-20,true)])()")
      flag='' if r[0]['pk']<=-0.5 and r[0]['nan']==0 and abs(r[0]['rms']-r[1]['rms'])<4 else '  ⚠'
      if flag:bad.append(n)
      print(n.ljust(30),'forte',str(r[0]['rms']).rjust(6),'dB crête',str(r[0]['pk']).rjust(5),'| faible',str(r[1]['rms']).rjust(6),'| « s »',str(r[0]['s']).rjust(6),'| avec réverb/écho crête',str(r[2]['pk']).rjust(5),flag)
    print('à revoir',bad);print('erreurs',errs[:5]);await b.close()
asyncio.run(main())
