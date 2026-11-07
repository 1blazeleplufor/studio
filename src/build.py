import os,shutil,json
# Build : python3 src/build.py  (depuis n'importe où) -> génère l'appli à la racine du dépôt
HERE=os.path.dirname(os.path.abspath(__file__));os.chdir(HERE)
from PIL import Image,ImageDraw
t=open('template.html').read()
js='\n'.join(open(f).read() for f in ['dsp.js','engine.js','ui1.js','ui2.js','ui3.js','ui4.js','ui5.js','ui6.js'])
wk=open('worklets.js').read()
t=t.replace('/*CSS*/',open('style.css').read()).replace('/*WORKLET*/',wk).replace('/*JS*/',js)
open('../Studio-fichier-unique.html','w').write(t.replace('<!--PWA-->',''))
D='..'
pwa='<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon-192.png"><link rel="apple-touch-icon" href="apple-touch-icon.png">'
open(D+'/index.html','w').write(t.replace('<!--PWA-->',pwa))
open(D+'/worklets.js','w').write(wk)
VER='studio-v2.4'
open(D+'/sw.js','w').write("""const V='%s';const FILES=['./','./index.html','./worklets.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 // réseau d'abord (mise à jour immédiate), cache si hors ligne
 e.respondWith(caches.open(V).then(c=>{const fromCache=()=>c.match(e.request,{ignoreSearch:true}).then(hit=>hit||c.match('./index.html'));
  const net=fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok)c.put(e.request,r.clone());return r});
  return Promise.race([net,new Promise((_,rej)=>setTimeout(rej,5000))]).catch(()=>fromCache().then(h=>h||net))}))});
"""%VER)
json.dump({"name":"Studio — home studio","short_name":"Studio","description":"Enregistrez votre voix, faites vos prods et mixez, même hors ligne.","lang":"fr","start_url":"./","scope":"./","display":"standalone","orientation":"any","background_color":"#1b1b1d","theme_color":"#2c2c2f",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png"},{"src":"icon-maskable.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]},open(D+'/manifest.webmanifest','w'),ensure_ascii=False,indent=1)
def icon(size,pad,round_):
    S=size*4;im=Image.new('RGBA',(S,S),(0,0,0,0));d=ImageDraw.Draw(im)
    bg=Image.new('RGBA',(S,S));g=ImageDraw.Draw(bg)
    for y in range(S):
        k=y/S;g.line([(0,y),(S,y)],fill=(int(40+30*k),int(30+10*k),int(70+60*(1-k)),255))
    mask=Image.new('L',(S,S),0);ImageDraw.Draw(mask).rounded_rectangle([0,0,S-1,S-1],radius=int(S*round_),fill=255)
    im.paste(bg,(0,0),mask);d=ImageDraw.Draw(im)
    p=int(S*pad);w=S-2*p;n=7;bw=w/(n*1.6)
    hs=[.35,.6,.9,.55,.8,.45,.3];cols=[(79,163,255),(94,92,230),(191,90,242),(255,107,74),(255,159,10),(48,209,88),(100,210,255)]
    for i,hh in enumerate(hs):
        x=p+i*w/n+(w/n-bw)/2;bh=w*hh;y0=S/2-bh/2
        d.rounded_rectangle([x,y0,x+bw,y0+bh],radius=bw/2,fill=cols[i]+(255,))
    return im.resize((size,size),Image.LANCZOS)
icon(192,.18,.22).save(D+'/icon-192.png');icon(512,.18,.22).save(D+'/icon-512.png');icon(512,.26,0).save(D+'/icon-maskable.png');icon(180,.16,0).convert('RGB').save(D+'/apple-touch-icon.png')
print('built')
