// Faux Supabase pour les tests : Realtime (broadcast, protocole Phoenix vsn 1.0.0), table `salles`, stockage `sons`.
// node tests/mock_supabase.js [port]   — /__stats, /__drop (coupe toutes les connexions), /__reset
const http=require('http'),{WebSocketServer}=require(process.env.WS_MODULE||'ws');
const PORT=+process.argv[2]||8790,rooms={},files={},socks=new Set();let stats={msgs:0,maxPayload:0,joins:0,dbGet:0,dbPost:0,up:0,down:0};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'};
const body=req=>new Promise(r=>{const c=[];req.on('data',d=>c.push(d));req.on('end',()=>r(Buffer.concat(c)))});
const srv=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x');const send=(code,data,type)=>{res.writeHead(code,Object.assign({'Content-Type':type||'application/json'},cors));res.end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data))};
  if(req.method==='OPTIONS')return send(204,'');
  if(u.pathname==='/__stats')return send(200,stats);
  if(u.pathname==='/__drop'){socks.forEach(s=>s.terminate());return send(200,{dropped:true})}
  if(u.pathname==='/__reset'){for(const k in rooms)delete rooms[k];for(const k in files)delete files[k];stats={msgs:0,maxPayload:0,joins:0,dbGet:0,dbPost:0,up:0,down:0};return send(200,{})}
  if(u.pathname.startsWith('/storage/v1/object/public/sons/')){stats.down++;const k=u.pathname.split('/').pop();return files[k]?send(200,files[k],'audio/wav'):send(400,{statusCode:'404',error:'not_found'})}
  if(!req.headers.apikey)return send(401,{message:'No API key found in request'});
  if(u.pathname==='/rest/v1/salles'){
    if(req.method==='GET'){stats.dbGet++;const id=(u.searchParams.get('id')||'').replace(/^eq\./,'');return send(200,rooms[id]?[{doc:rooms[id].doc}]:[])}
    if(req.method==='POST'){stats.dbPost++;const j=JSON.parse(await body(req));rooms[j.id]=j;return send(201,'')}}
  if(u.pathname.startsWith('/storage/v1/object/sons/')&&req.method==='POST'){const k=u.pathname.split('/').pop(),b=await body(req);
    if(b.length>50*1024*1024)return send(413,{error:'Payload too large'});
    if(files[k])return send(400,{statusCode:'409',error:'Duplicate',message:'The resource already exists'});stats.up++;files[k]=b;return send(200,{Key:'sons/'+k})}
  send(404,{error:'?'})});
const wss=new WebSocketServer({noServer:true});
srv.on('upgrade',(req,sock,head)=>{const u=new URL(req.url,'http://x');if(u.pathname!=='/realtime/v1/websocket'||!u.searchParams.get('apikey')){sock.destroy();return}
  wss.handleUpgrade(req,sock,head,ws=>wss.emit('connection',ws))});
wss.on('connection',ws=>{socks.add(ws);ws.topics=new Set();ws.on('close',()=>socks.delete(ws));
  ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch(e){return}
    if(m.event==='heartbeat')return ws.send(JSON.stringify({topic:'phoenix',event:'phx_reply',payload:{status:'ok',response:{}},ref:m.ref}));
    if(m.event==='phx_join'){stats.joins++;ws.topics.add(m.topic);return ws.send(JSON.stringify({topic:m.topic,event:'phx_reply',payload:{status:'ok',response:{postgres_changes:[]}},ref:m.ref}))}
    if(m.event==='broadcast'){const len=raw.length;stats.msgs++;stats.maxPayload=Math.max(stats.maxPayload,len);
      if(len>256*1024){return ws.send(JSON.stringify({topic:m.topic,event:'phx_error',payload:{reason:'payload too large'},ref:m.ref}))}
      const out=JSON.stringify({topic:m.topic,event:'broadcast',payload:m.payload,ref:null});
      for(const o of socks)if(o!==ws&&o.topics.has(m.topic)&&o.readyState===1)o.send(out)}})});
srv.listen(PORT,()=>console.log('faux Supabase sur',PORT));
