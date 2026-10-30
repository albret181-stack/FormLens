const {EventEmitter}=require('node:events');
const {spawn}=require('node:child_process');
const path=require('node:path');
const BASE='https://github.com/albret181-stack/FormLens/releases/download/';
/** Uses Sparkle's official CLI. No shell, privilege bypass or custom file replacement. */
class SparkleUpdater extends EventEmitter {
 constructor({bundle,resources,spawnProcess=spawn}){super();this.bundle=bundle;this.binary=path.join(resources,'updater','sparkle.app','Contents','MacOS','sparkle');this.spawnProcess=spawnProcess;this.child=null;this.feed=null;}
 setFeedURL({url}){
  const match=/^https:\/\/github\.com\/albret181-stack\/FormLens\/releases\/download\/v(\d+\.\d+\.\d+)\/FormLens-\1-arm64-appcast\.xml$/.exec(url||'');
  if(!match||!url.startsWith(BASE))throw Error('Недопустимый источник обновления');
  this.feed=url;
 }
 run(install){
  if(this.child)throw Error('Обновление уже выполняется');
  if(!this.feed)throw Error('Источник обновления не задан');
  const args=[this.bundle,'--check-immediately','--feed-url',this.feed,'--user-agent-name','FormLens',...(install?['--interactive']:['--defer-install'])];
  const child=this.spawnProcess(this.binary,args,{stdio:['ignore','ignore','pipe'],shell:false});this.child=child;
  // Never render downloaded release notes or native diagnostics as commands/HTML.
  child.stderr?.resume();let finished=false;
  const finish=error=>{if(finished)return;finished=true;this.child=null;if(error)this.emit('error',error)};
  child.once('error',()=>finish(Error('Не удалось запустить Sparkle')));
  child.once('close',code=>{if(finished)return;finish();if(code===0){if(!install)this.emit('update-downloaded')}else if(code===4)this.emit('update-not-available');else this.emit('error',Error('Sparkle не смог подготовить или установить обновление'))});
 }
 checkForUpdates(){this.run(false)}
 quitAndInstall(){this.run(true)}
}
module.exports={SparkleUpdater};
