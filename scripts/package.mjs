import {packager} from '@electron/packager';
import path from 'node:path';
import {readdir} from 'node:fs/promises';
const cacheRoot=path.resolve('../../work/electron-cache');
let electronZipDir;
try {const files=await readdir(cacheRoot,{recursive:true});const zip=files.find(f=>f.endsWith('electron-v45.0.0-darwin-arm64.zip'));if(zip)electronZipDir=path.dirname(path.join(cacheRoot,zip))} catch {}
const identity=process.env.FORMLENS_SIGN_IDENTITY;
if(process.env.FORMLENS_REQUIRE_SIGNED_RELEASE==='1'&&!identity?.startsWith('Developer ID Application:'))throw Error('Настройте FORMLENS_SIGN_IDENTITY для подписанного выпуска.');
const signing=identity?{osxSign:{identity,type:'distribution',...(process.env.FORMLENS_SIGN_KEYCHAIN?{keychain:process.env.FORMLENS_SIGN_KEYCHAIN}:{})}}:{};
await packager({...signing,dir:process.cwd(),name:'FormLens',platform:'darwin',arch:'arm64',out:'../build',overwrite:true,appBundleId:'local.formlens.studio',appVersion:JSON.parse(await (await import('node:fs/promises')).readFile('package.json','utf8')).version,...(electronZipDir?{electronZipDir}:{download:{cacheRoot}}),ignore:[/^\/.git(?:\/|$)/,/^\/tests/,/^\/scripts/,/^\/app\/selftest/,/^\/app\/test-pose.jpg/,/^\/README.md/]});

