// First installer embeds the stable public key; it does not sign or publish updates.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdtemp,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const app=path.resolve('../build/FormLens-darwin-arm64/FormLens.app');
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit'});
run('codesign',['--force','--deep','--sign','-',app]);
run('codesign',['--verify','--deep','--strict',app]);
const staging=await mkdtemp(path.resolve('../build/initial-dmg-'));
run('ditto',[app,path.join(staging,'FormLens.app')]);
await symlink('/Applications',path.join(staging,'Applications'));
await writeFile(path.join(staging,'Установка.txt'),'Перенесите FormLens.app в Программы, заменив прежнюю версию.\nСохранённые разборы хранятся отдельно от приложения.\nВстроен бесплатный Sparkle для следующих обновлений через GitHub.\nСборка без нотарификации Apple; macOS может предупредить о разработчике.\n');
const file=path.resolve(`../FormLens-${version}-arm64.dmg`);
run('hdiutil',['create','-volname',`FormLens ${version}`,'-srcfolder',staging,'-ov','-format','UDZO',file]);
run('hdiutil',['verify',file]);
await writeFile(path.resolve('../SHA256SUMS.txt'),createHash('sha256').update(await readFile(file)).digest('hex')+'  '+path.basename(file)+'\n');
console.log('First installer built with the production public key, no private key required.');
