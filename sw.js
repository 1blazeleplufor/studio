const V='studio-v3.7';const FILES=['./','./index.html','./worklets.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable.png','./apple-touch-icon.png','./lame.min.js','./ecoute.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 // réseau d'abord (mise à jour immédiate), cache si hors ligne
 e.respondWith(caches.open(V).then(c=>{const fromCache=()=>c.match(e.request,{ignoreSearch:true}).then(hit=>hit||c.match('./index.html'));
  const net=fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok)c.put(e.request,r.clone());return r});
  return Promise.race([net,new Promise((_,rej)=>setTimeout(rej,5000))]).catch(()=>fromCache().then(h=>h||net))}))});
