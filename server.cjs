const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const root=__dirname;
const types={'.html':'text/html;charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.task':'application/octet-stream','.webm':'video/webm','.png':'image/png','.jpg':'image/jpeg'};
function createHandler(){return async(req,res)=>{
  if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||'')){res.writeHead(403).end();return}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.includes('\0'))throw Error()}catch{res.writeHead(400).end();return}
  if(pathname==='/'){res.writeHead(302,{Location:'/app/index.html'}).end();return}
  const mount=['app','models','node_modules/@mediapipe/tasks-vision'].find(name=>pathname.startsWith('/'+name+'/'));
  if(!mount){res.writeHead(404).end();return}
  const allowed=path.resolve(root,mount),file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(allowed+path.sep)){res.writeHead(403).end();return}
  try{
   const real=await fs.promises.realpath(file),realAllowed=await fs.promises.realpath(allowed);
   if(!real.startsWith(realAllowed+path.sep)){res.writeHead(403).end();return}
   const stat=await fs.promises.stat(real);if(!stat.isFile()){res.writeHead(404).end();return}
   res.setHeader('Content-Type',types[path.extname(real)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Accept-Ranges','bytes');
   let from=0,to=stat.size-1;
   if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);const invalid=()=>{res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end()};if(!match||(!match[1]&&!match[2])||!stat.size){invalid();return}
    if(match[1]){from=Number(match[1]);to=match[2]?Math.min(Number(match[2]),to):to}else{const count=Number(match[2]);if(!Number.isSafeInteger(count)||count<1){invalid();return}from=Math.max(0,stat.size-count)}
    if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||from>to){invalid();return}
    res.statusCode=206;res.setHeader('Content-Range',`bytes ${from}-${to}/${stat.size}`);
   }
   res.setHeader('Content-Length',stat.size?to-from+1:0);if(req.method==='HEAD'||!stat.size){res.end();return}
   const stream=fs.createReadStream(real,{start:from,end:to});stream.on('error',()=>{if(!res.headersSent)res.writeHead(500);res.end()});res.on('close',()=>stream.destroy());stream.pipe(res);
  }catch(error){if(!res.headersSent)res.writeHead(error.code==='ENOENT'?404:500);res.end()}
 }}
function start(port=0){return new Promise((resolve,reject)=>{const server=http.createServer(createHandler());server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server))})}
module.exports={start,createHandler};if(require.main===module)start(Number(process.env.PORT||4173)).then(s=>console.log('FormLens: http://127.0.0.1:'+s.address().port)).catch(error=>{console.error('Не удалось запустить локальный сервер:',error.message);process.exitCode=1});
