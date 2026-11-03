// Disposable CI keys: never publish artifacts from this job as a real update.
import {generateKeyPairSync} from 'node:crypto';
import {appendFile} from 'node:fs/promises';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const seed=Buffer.from(privateKey.export({format:'jwk'}).d,'base64url').toString('base64');
const pub=Buffer.from(publicKey.export({format:'jwk'}).x,'base64url').toString('base64');
if(!process.env.GITHUB_ENV)throw Error('CI environment required');
console.log('::add-mask::'+seed);
await appendFile(process.env.GITHUB_ENV,`FORMLENS_UPDATE_PRIVATE_KEY=${seed}\nFORMLENS_UPDATE_PUBLIC_KEY=${pub}\n`);
