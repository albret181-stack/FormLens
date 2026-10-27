import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {Writable} from 'node:stream';const require=createRequire(import.meta.url);const {createHandler}=require('../server.cjs');
class Response extends Writable{statusCode=200;headers={};chunks=[];headersSent=false;setHeader(k,v){this.headers[k.toLowerCase()]=v}writeHead(status,headers={}){this.statusCode=status;for(const[k,v]of Object.entries(headers))this.setHeader(k,v);this.headersSent=true;return this}_write(data,_encoding,cb){this.headersSent=true;this.chunks.push(Buffer.from(data));cb()}}
async function request(url,{method='GET',headers={}}={}){const res=new Response();const finished=new Promise((resolve,reject)=>{res.on('finish',resolve);res.on('error',reject)});await createHandler()({url,method,headers:{host:'127.0.0.1:4173',...headers}},res);await finished;return {status:res.statusCode,headers:res.headers,body:Buffer.concat(res.chunks)}}
test('HTTP handler restricts paths and methods and handles byte ranges',async()=>{
 assert.equal((await request('/app/index.html')).status,200);
 assert.equal((await request('/app/%2e%2e%2fmain.cjs')).status,403);
 assert.equal((await request('/package.json')).status,404);
 assert.equal((await request('/app/index.html',{method:'POST'})).status,405);
 assert.equal((await request('/app/index.html',{headers:{host:'evil.example'}})).status,403);
 const range=await request('/app/index.html',{headers:{range:'bytes=0-9'}});assert.equal(range.status,206);assert.equal(range.body.byteLength,10);
 const suffix=await request('/app/index.html',{headers:{range:'bytes=-10'}});assert.equal(suffix.status,206);assert.equal(suffix.body.byteLength,10);
 const invalid=await request('/app/index.html',{headers:{range:'bytes=999999999-'}});assert.equal(invalid.status,416);assert.match(invalid.headers['content-range'],/^bytes \*\//);
 const head=await request('/app/index.html',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body.length,0);
});
