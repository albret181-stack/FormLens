// Runs only on a disposable macOS CI runner with a test copy of the old application.
import {execFileSync,spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const version=JSON.parse(await readFile('config/prepared-release.json','utf8')).version;
const bell=process.argv.includes('--bell');
const root=path.join(process.env.RUNNER_TEMP,'formlens-native-check'+(bell?'-bell':'')),mount=path.join(root,'volume'),bundle=path.join(root,'installed','FormLens.app');
const run=(command,args,options={})=>execFileSync(command,args,{stdio:'inherit',timeout:180000,...options});
const text=(command,args)=>execFileSync(command,args,{encoding:'utf8',timeout:30000}).trim();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await mkdir(mount,{recursive:true});await mkdir(path.dirname(bundle),{recursive:true});
run('gh',['run','download','40850515890','--repo','albret181-stack/FormLens','--name','FormLens-0.9.0-arm64-installer','--dir',path.join(root,'old')]);
run('hdiutil',['attach',path.join(root,'old','FormLens-0.9.0-arm64.dmg'),'-readonly','-nobrowse','-mountpoint',mount]);
run('ditto',[path.join(mount,'FormLens.app'),bundle]);run('hdiutil',['detach',mount]);
const plist=path.join(bundle,'Contents','Info.plist'),binary=path.join(bundle,'Contents','MacOS','FormLens');
const installedVersion=()=>text('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',plist]);
if(installedVersion()!=='0.9.0')throw Error('Wrong baseline app');
const start=()=>spawn(binary,['--remote-debugging-port=9333'],{stdio:'ignore',detached:true}).unref();
async function until(check,label,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){try{const result=await check();if(result)return result}catch{}await delay(1000)}throw Error('Timed out: '+label)}
async function target(){return until(async()=>{const response=await fetch('http://127.0.0.1:9333/json/list',{signal:AbortSignal.timeout(2000)});return (await response.json()).find(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:4175/'))},'application DevTools')}
async function evaluate(expression){const page=await target();return new Promise((resolve,reject)=>{const ws=new WebSocket(page.webSocketDebuggerUrl);const timer=setTimeout(()=>{ws.close();reject(Error('DevTools timeout'))},20000);ws.onopen=()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));ws.onmessage=event=>{const data=JSON.parse(event.data);if(data.id!==1)return;clearTimeout(timer);ws.close();if(data.error||data.result?.exceptionDetails)reject(Error('Application evaluation failed'));else resolve(data.result.result.value)};ws.onerror=()=>{clearTimeout(timer);reject(Error('DevTools connection failed'))}})}
start();
await until(async()=>await evaluate('typeof window.formlensPrepareUpdate')==='function','loaded application');
await evaluate(`(async()=>{const {saveProject}=await import('/app/storage.mjs');localStorage.setItem('formlens-native-update-check','preserved');await saveProject({id:'native-update-check',schema:1,title:'CI update retention check',filename:'sentinel.bin',video:new Blob(['formlens-test-video-bytes']),duration:1,updatedAt:Date.now(),notes:'preserved',report:null,samples:[]});return true})()`);
const cli=path.join(bundle,'Contents','Resources','updater','sparkle.app','Contents','MacOS','sparkle');
const feed=`https://github.com/albret181-stack/FormLens/releases/download/v${version}/FormLens-${version}-arm64-appcast.xml`;
if(bell){
 await evaluate("document.querySelector('.app-options').open=true;document.getElementById('updates-open').click();document.getElementById('updates-check').click();true");
 await until(async()=>{const s=await evaluate('window.formlensUpdates.state()');return s.status==='available'&&s.latest===version},'bell offers the published release');
 const enabled=await evaluate("!document.getElementById('updates-download').disabled&&!document.getElementById('updates-download').hidden");
 if(!enabled)throw Error('Bell does not enable native download');
 await evaluate("document.getElementById('updates-download').click();true");
 await until(async()=>(await evaluate('window.formlensUpdates.state()')).status==='ready','bell download and signature verification',180000);
 if(installedVersion()!=='0.9.0')throw Error('App was replaced before explicit installation');
 await evaluate("document.getElementById('updates-install').click();true");
}else{
 run(cli,[bundle,'--feed-url',feed,'--check-immediately','--defer-install','--user-agent-name','FormLens-CI']);
 if(installedVersion()!=='0.9.0')throw Error('App was replaced before explicit installation');
 await evaluate('window.formlensPrepareUpdate().then(()=>true)');
 run(cli,[bundle,'--feed-url',feed,'--check-immediately','--interactive','--user-agent-name','FormLens-CI']);
}
await until(()=>installedVersion()===version,'native application replacement');
await until(async()=>{const response=await fetch('http://127.0.0.1:4175/app/index.html',{signal:AbortSignal.timeout(2000)});return (await response.text()).includes(`FormLens Studio <b>${version}</b>`)},'automatic relaunch of the new application');
// Sparkle relaunch does not promise to preserve debugging flags. Reopen only to inspect storage.
run('osascript',['-e','tell application id "local.formlens.studio" to quit']);
await until(async()=>{try{await fetch('http://127.0.0.1:4175/',{signal:AbortSignal.timeout(1000)});return false}catch{return true}},'test application exit');
start();
await until(async()=>await evaluate('typeof window.formlensPrepareUpdate')==='function','reopened application');
const retained=await evaluate(`(async()=>{const {getProject}=await import('/app/storage.mjs');const p=await getProject('native-update-check');return localStorage.getItem('formlens-native-update-check')==='preserved'&&p?.notes==='preserved'&&await p.video.text()==='formlens-test-video-bytes'})()`);
if(!retained)throw Error('Application storage was not retained');
run('codesign',['--verify','--deep','--strict',bundle]);
run('osascript',['-e','tell application id "local.formlens.studio" to quit']);
await mkdir('evidence',{recursive:true});
await writeFile('evidence/native-update'+(bell?'-bell':'-cli')+'.json',JSON.stringify({from:'0.9.0',to:version,throughBell:bell,archiveAndFeedVerifiedBySparkle:true,deferredUntilInstall:true,applicationReplaced:true,automaticallyRelaunched:true,localStoragePreserved:true,savedProjectAndVideoBlobPreserved:true,gatekeeperQuarantineTested:false},null,2)+'\n');
console.log('Native update, relaunch and stored project retention verified');
