# v3.9.1 : décodeur FLAC maison (sons de session sur téléphone)
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome');c=await b.new_context();await c.add_init_script("localStorage.setItem('studio_seen','1');localStorage.setItem('studio_ver','9');localStorage.setItem('studio_supa','{\"url\":\"\"}')")
    A=await c.new_page();errs=[];A.on('pageerror',lambda e: errs.append(str(e)))
    await A.goto('http://localhost:8765/');await A.wait_for_timeout(1500);E=A.evaluate
    # 1) nos FLAC : encode → décode = identique
    r=await E("""(async()=>{const out=[];for(const [sr,ch,sec] of [[96000,2,6.3],[48000,1,3.1],[44100,2,2.7]]){
      const len=Math.round(sr*sec),ab=ctx.createBuffer(ch,len,sr);for(let c=0;c<ch;c++){const d=ab.getChannelData(c);for(let i=0;i<len;i++)d[i]=(i>len*.3&&i<len*.4)?0:Math.max(-1.2,Math.min(1.2,.6*Math.sin(i*(c+1)*.013)+.3*(Math.random()*2-1)+(i%9000<20?.9:0)))}
      const t0=performance.now();const fl=await encodeFLAC(ab);const t1=performance.now();
      const dec=await decodeFLAC(fl,(c,l,s)=>ctx.createBuffer(c,l,s));const t2=performance.now();
      const nat=await ctx.decodeAudioData(fl.slice().buffer);let mx=0,mq=0;
      for(let c=0;c<ch;c++){const a=dec.getChannelData(c),n2=nat.getChannelData(c),o=ab.getChannelData(c);for(let i=0;i<len;i++){mx=Math.max(mx,Math.abs(a[i]-n2[i]));const q=Math.max(-32768,Math.min(32767,Math.round(Math.max(-1,Math.min(1,o[i]))*32767)))/32768;mq=Math.max(mq,Math.abs(a[i]-q))}}
      out.push({sr,ch,len,dec:[dec.numberOfChannels,dec.length,dec.sampleRate],vsChrome:mx,vsOrig:mq,encMs:Math.round(t1-t0),decMs:Math.round(t2-t1),Mo:(fl.length/1e6).toFixed(2)})}return out})()""")
    for x in r:print('notre FLAC',x)
    # 2) FLAC de ffmpeg (LPC, 24 bits, mono…)
    for f in ['a96.flac','b44mono.flac','c48_24.flac']:
      r=await E("""(async f=>{const by=new Uint8Array(await (await fetch('tests/'+f)).arrayBuffer());const t=performance.now();const d=await decodeFLAC(by,(c,l,s)=>ctx.createBuffer(c,l,s));const ms=performance.now()-t;
        const n=await ctx.decodeAudioData(by.slice().buffer);let mx=0;for(let c=0;c<d.numberOfChannels;c++){const a=d.getChannelData(c),b=n.getChannelData(c);for(let i=0;i<a.length;i++)mx=Math.max(mx,Math.abs(a[i]-b[i]))}
        return [f,d.numberOfChannels,d.length,d.sampleRate,'écart',mx,Math.round(ms)+' ms']})(arguments[0])""".replace('arguments[0]',repr(f)))
      print('ffmpeg',r)
    # 3) secours : fichier abîmé → décodeur du navigateur, puis erreur claire
    print('secours',await E("(async()=>{const ab=ctx.createBuffer(1,48000,48000);const fl=await encodeFLAC(ab);const ok=await decodeSon(fl,'flac');let e2='';try{await decodeSon(new Uint8Array([1,2,3,4,5]),'flac')}catch(e){e2=e.name}return [ok.length,e2]})()"))
    print('erreurs',errs);await b.close()
asyncio.run(main())
