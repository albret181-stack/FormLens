import {packager} from '@electron/packager';
import path from 'node:path';
import {readdir,readFile} from 'node:fs/promises';
const cacheRoot=path.resolve('../../work/electron-cache');
let electronZipDir;
try {const files=await readdir(cacheRoot,{recursive:true,verbatimSymlinks:true});const zip=files.find(f=>f.endsWith('electron-v45.0.0-darwin-arm64.zip'));if(zip)electronZipDir=path.dirname(path.join(cacheRoot,zip))} catch {}
const publicKey=process.env.FORMLENS_UPDATE_PUBLIC_KEY||(await readFile('config/update-public-key.txt','utf8')).trim();
if(!/^[A-Za-z0-9+/]{43}=$/.test(publicKey||''))throw Error('Настройте бесплатный публичный ключ FORMLENS_UPDATE_PUBLIC_KEY.');
const {preparePoseModel}=await import('./setup-model.mjs');
await preparePoseModel();
const {prepareSparkle}=await import('./setup-sparkle.mjs');
const sparkle=await prepareSparkle();
const outputs=await packager({extendInfo:{SUPublicEDKey:publicKey,SUVerifyUpdateBeforeExtraction:true,SURequireSignedFeed:true,SUEnableAutomaticChecks:false,SUFeedURL:'https://github.com/albret181-stack/FormLens/releases/latest/download/appcast.xml'},dir:process.cwd(),name:'FormLens',platform:'darwin',arch:'arm64',out:'../build',overwrite:true,appBundleId:'local.formlens.studio',appVersion:JSON.parse(await (await import('node:fs/promises')).readFile('package.json','utf8')).version,...(electronZipDir?{electronZipDir}:{download:{cacheRoot}}),ignore:[/^\/models\/pose_landmarker_lite\.task$/,/^\/.git(?:\/|$)/,/^\/tests/,/^\/scripts/,/^\/app\/selftest/,/^\/app\/test-pose.jpg/,/^\/README.md/]});


const {cp}=await import('node:fs/promises');
for(const output of outputs)await cp(sparkle,path.join(output,'FormLens.app','Contents','Resources','updater'),{recursive:true,verbatimSymlinks:true});
