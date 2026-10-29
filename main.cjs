const {app,BrowserWindow,session,dialog,ipcMain,autoUpdater}=require('electron');
const path=require('node:path');
const {createNativeUpdates}=require('./native-updates.cjs');
const {execFileSync}=require('node:child_process');
let updates;
function supportsNativeUpdates(){
 if(!app.isPackaged||process.platform!=='darwin'||process.arch!=='arm64')return false;
 const bundle=path.dirname(path.dirname(process.resourcesPath));
 try{execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{stdio:'pipe'});}catch{return false}
 const result=require('node:child_process').spawnSync('/usr/bin/codesign',['-dv','--verbose=4',bundle],{encoding:'utf8'});
 return result.status===0&&/^TeamIdentifier=[A-Z0-9]{10}$/m.test(result.stderr||'');
}
const {start}=require('./server.cjs');let server,win;
if(!app.requestSingleInstanceLock()){app.quit()}else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus()}});
 app.whenReady().then(async()=>{
  // Stable origin keeps IndexedDB projects accessible across application restarts.
  server=await start(4175);const origin='http://127.0.0.1:4175';
  session.defaultSession.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(origin+'/')&&!d.url.startsWith('blob:'+origin)&&!d.url.startsWith('data:')}));
  win=new BrowserWindow({width:1440,height:980,minWidth:1000,minHeight:720,title:'FormLens',backgroundColor:'#11191f',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,'preload.cjs')}});
  win.webContents.on('will-prevent-unload',event=>{const answer=dialog.showMessageBoxSync(win,{type:'question',buttons:['Остаться','Закрыть без сохранения'],defaultId:0,cancelId:0,title:'Несохранённый разбор',message:'В текущем разборе есть несохранённые изменения.'});if(answer===1)event.preventDefault()});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(origin+'/'))e.preventDefault()});const trusted=event=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('Недопустимый запрос')};
  updates=createNativeUpdates(app.getVersion(),{updater:autoUpdater,enabled:supportsNativeUpdates(),onState:state=>{if(win&&!win.isDestroyed())win.webContents.send('updates:state',state)}});
  ipcMain.handle('updates:state',event=>{trusted(event);return updates.getState()});
  ipcMain.handle('updates:check',async event=>{trusted(event);const state=await updates.check();if(!win.isDestroyed())win.webContents.send('updates:state',state);return state});
  ipcMain.handle('updates:download',async event=>{trusted(event);return updates.download()});
  ipcMain.handle('updates:install',event=>{trusted(event);return updates.install()});
  await win.loadURL(origin);
  const checkUpdates=async()=>{const state=await updates.check();if(!win.isDestroyed())win.webContents.send('updates:state',state)};
  if(app.isPackaged){setTimeout(checkUpdates,5000).unref();setInterval(checkUpdates,6*60*60*1000).unref()}
 }).catch(error=>{dialog.showErrorBox('FormLens не удалось открыть',error.code==='EADDRINUSE'?'Локальный порт 4175 занят другим приложением. Закройте его и снова запустите FormLens. Сохранённые разборы не изменены.':String(error.message));app.quit()});
 app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>{updates?.dispose();server?.close()});
}

