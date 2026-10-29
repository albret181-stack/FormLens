import {execFileSync} from 'node:child_process';
import {mkdtemp,symlink,writeFile,readFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {makeSparkleFeed,verifyArchive} from './update-feed.mjs';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const app=path.resolve('../build/FormLens-darwin-arm64/FormLens.app');
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit'});
const publicKey=process.env.FORMLENS_UPDATE_PUBLIC_KEY,privateKey=process.env.FORMLENS_UPDATE_PRIVATE_KEY;
if(!/^[A-Za-z0-9+/]{43}=$/.test(publicKey||'')||!/^[A-Za-z0-9+/]{43}=$/.test(privateKey||''))throw Error('Настройте бесплатную пару ключей FORMLENS_UPDATE_PUBLIC_KEY / FORMLENS_UPDATE_PRIVATE_KEY.');
// Local ad-hoc code signature is free. Authenticity of updates comes from Ed25519.
run('codesign',['--force','--deep','--sign','-',app]);run('codesign',['--verify','--deep','--strict',app]);
const zip=path.resolve(`../FormLens-${version}-arm64.zip`);
run('ditto',['-c','-k','--sequesterRsrc','--keepParent',app,zip]);
const signer=path.join(app,'Contents','Resources','updater','bin','sign_update');
const sign=(file,extra=[])=>{try{return execFileSync(signer,['--ed-key-file','-',...extra,file],{input:privateKey+'\n',encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}catch{throw Error('Sparkle не смог подписать артефакт; приватный ключ не выводится.')}};
const signature=sign(zip,['-p']),bytes=await readFile(zip);
if(!verifyArchive(bytes,signature,publicKey))throw Error('Приватный ключ не соответствует публичному ключу приложения.');
const feedPath=path.resolve(`../FormLens-${version}-arm64-appcast.xml`);
await writeFile(feedPath,makeSparkleFeed({version,size:bytes.length,signature}));sign(feedPath); // Signed feed plus signed ZIP.
await copyFile(feedPath,path.resolve('../appcast.xml'));
const staging=await mkdtemp(path.resolve('../build/dmg-'));
run('ditto',[app,path.join(staging,'FormLens.app')]);await symlink('/Applications',path.join(staging,'Applications'));
await writeFile(path.join(staging,'Установка.txt'),'Перенесите FormLens.app в Applications (Программы).\nПервый переход выполняется вручную один раз. Следующие обновления доступны через колокольчик.\nСборка бесплатная, без нотарификации Apple: macOS может предупредить о неизвестном разработчике.\nРазборы хранятся отдельно в профиле приложения.\n');
const dmg=path.resolve(`../FormLens-${version}-arm64.dmg`);
run('hdiutil',['create','-volname',`FormLens ${version}`,'-srcfolder',staging,'-ov','-format','UDZO',dmg]);run('hdiutil',['verify',dmg]);
const artifacts=[dmg,zip,feedPath,path.resolve('../appcast.xml')];
const sums=await Promise.all(artifacts.map(async file=>`${createHash('sha256').update(await readFile(file)).digest('hex')}  ${path.basename(file)}`));await writeFile(path.resolve('../SHA256SUMS.txt'),sums.join('\n')+'\n');
console.log('Бесплатный выпуск со Sparkle готов:',version);
