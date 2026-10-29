import {generateKeyPairSync,createPrivateKey,createPublicKey} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root=path.join(os.homedir(),'.formlens-update-keys'),file=path.join(root,'ed25519.private');
await mkdir(root,{recursive:true,mode:0o700});
let seed;
try{seed=(await readFile(file,'utf8')).trim()}catch(error){if(error.code!=='ENOENT')throw error;const {privateKey}=generateKeyPairSync('ed25519');seed=Buffer.from(privateKey.export({format:'jwk'}).d,'base64url').toString('base64');await writeFile(file,seed+'\n',{mode:0o600,flag:'wx'})}
if(!/^[A-Za-z0-9+/]{43}=$/.test(seed))throw Error('Сохранённый ключ повреждён; не перезаписывайте ключ существующих выпусков.');
const key=createPrivateKey({format:'der',type:'pkcs8',key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(seed,'base64')])});
const publicKey=Buffer.from(createPublicKey(key).export({format:'jwk'}).x,'base64url').toString('base64');
console.log('FORMLENS_UPDATE_PUBLIC_KEY='+publicKey);console.log('Приватный ключ сохранён локально: '+file);console.log('Его содержимое добавьте в GitHub Actions Secret FORMLENS_UPDATE_PRIVATE_KEY. Не отправляйте его в чат и не коммитьте.');
