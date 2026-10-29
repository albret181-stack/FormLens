import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import native from '../native-updates.cjs';
import service from '../update-service.cjs';
import {makeSparkleFeed,verifyArchive} from '../scripts/update-feed.mjs';
import {generateKeyPairSync,sign} from 'node:crypto';
const {createNativeUpdates}=native;
const repository='https://github.com/albret181-stack/FormLens/releases/download/v0.9.0/';
const asset=name=>({name,browser_download_url:repository+name,state:'uploaded',size:100});
const release=()=>({tag_name:'v0.9.0',assets:['FormLens-0.9.0-arm64.dmg','FormLens-0.9.0-arm64.zip','FormLens-0.9.0-arm64-appcast.xml'].map(asset)});
class Updater extends EventEmitter{checks=0;installs=0;setFeedURL(feed){this.feed=feed}checkForUpdates(){this.checks++}quitAndInstall(){this.installs++}}
const setup=({enabled=true}={})=>{const updater=new Updater(),states=[];const metadata=service.createUpdateService('0.8.0',{fetcher:async()=>new Response(JSON.stringify(release()))});const controller=createNativeUpdates('0.8.0',{updater,metadata,enabled,onState:s=>states.push(s)});return {updater,controller,states}};
test('download stays inside native updater and install is gated by verification',async()=>{
 const {updater,controller,states}=setup();
 assert.throws(()=>controller.install(),/ещё не готово/);
 assert.equal((await controller.check()).status,'available');
 controller.download();assert.equal(updater.checks,1);assert.equal(updater.feed.url,repository+'FormLens-0.9.0-arm64-appcast.xml');
 controller.download();await controller.check();assert.equal(updater.checks,1);
 assert.throws(()=>controller.install(),/ещё не готово/);
 updater.emit('update-downloaded');assert.equal(controller.getState().status,'ready');await controller.check();assert.equal(controller.getState().status,'ready');
 controller.install();assert.equal(updater.installs,1);assert.equal(controller.getState().status,'installing');assert.throws(()=>controller.install());assert(states.some(s=>s.status==='downloading'));controller.dispose();
});
test('unsigned or development builds cannot download or invoke native installation',async()=>{
 const {updater,controller}=setup({enabled:false});await controller.check();assert.equal(controller.getState().installSupported,false);assert.throws(()=>controller.download(),/Sparkle/);updater.emit('update-downloaded');assert.throws(()=>controller.install());assert.equal(updater.checks,0);assert.equal(updater.installs,0);controller.dispose();
});
test('bad/incomplete release assets do not enable native updating',()=>{
 const bad=release();bad.assets[1].browser_download_url='https://evil.example/FormLens-0.9.0-arm64.zip';assert.equal(service.parseRelease(bad,'0.8.0').nativeFeed,null);
 const missing=release();missing.assets=missing.assets.slice(0,2);assert.equal(service.parseRelease(missing,'0.8.0').nativeFeed,null);
});
test('native errors preserve current app and allow a new metadata check',async()=>{
 const {updater,controller}=setup();await controller.check();controller.download();updater.emit('error',new Error('checksum or signature failed'));assert.equal(controller.getState().status,'error');assert.throws(()=>controller.install());assert.equal(updater.installs,0);assert.equal((await controller.check()).status,'available');controller.download();assert.equal(updater.checks,2);controller.dispose();
});
test('synchronous native failures and relaunch failures have usable states',async()=>{
 const {updater,controller}=setup();await controller.check();updater.setFeedURL=()=>{throw Error('signature')};assert.equal(controller.download().status,'error');await controller.check();updater.setFeedURL=()=>{};controller.download();updater.emit('update-downloaded');updater.quitAndInstall=()=>{throw Error('blocked')};assert.throws(()=>controller.install());assert.equal(controller.getState().status,'ready');controller.dispose();
});
test('a slow native download stays single-flight, including after a late completion',async()=>{
 const updater=new Updater();const metadata={getState:()=>({status:'idle'}),check:async()=>({status:'available',nativeFeed:repository+'FormLens-0.9.0-arm64-appcast.xml'})};const controller=createNativeUpdates('0.8.0',{updater,metadata,timeoutMs:5});await controller.check();controller.download();await new Promise(r=>setTimeout(r,15));assert.equal(controller.getState().status,'downloading');controller.download();assert.equal(updater.checks,1);updater.emit('update-downloaded');assert.equal(controller.getState().status,'ready');controller.dispose();
});
test('native no-update response ends download without offering install',async()=>{const {updater,controller}=setup();await controller.check();controller.download();updater.emit('update-not-available');assert.equal(controller.getState().status,'current');assert.throws(()=>controller.install());controller.dispose()});
test('free signed feed fixes the versioned URL; an archive must match the embedded public key',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');const bytes=Buffer.from('archive');const signature=sign(null,bytes,privateKey).toString('base64');const raw=Buffer.from(publicKey.export({format:'jwk'}).x,'base64url').toString('base64');
 assert(verifyArchive(bytes,signature,raw));assert.equal(verifyArchive(Buffer.from('corrupt'),signature,raw),false);assert.equal(verifyArchive(bytes,signature,'invalid'),false);
 const xml=makeSparkleFeed({version:'0.9.0',size:bytes.length,signature});assert(xml.includes(repository+'FormLens-0.9.0-arm64.zip'));assert(xml.includes(signature));assert.throws(()=>makeSparkleFeed({version:'../evil',size:10,signature}));assert.throws(()=>makeSparkleFeed({version:'0.9.0',size:0,signature}));assert.throws(()=>makeSparkleFeed({version:'0.9.0',size:10,signature:'bad'}));
});
