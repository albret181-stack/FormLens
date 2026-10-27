import {packager} from '@electron/packager';
import path from 'node:path';
import {readdir} from 'node:fs/promises';
const cacheRoot=path.resolve('../../work/electron-cache');
let electronZipDir;
try {const files=await readdir(cacheRoot,{recursive:true});const zip=files.find(f=>f.endsWith('electron-v45.0.0-darwin-arm64.zip'));if(zip)electronZipDir=path.dirname(path.join(cacheRoot,zip))} catch {}
await packager({dir:process.cwd(),name:'FormLens',platform:'darwin',arch:'arm64',out:'../build',overwrite:true,appBundleId:'local.formlens.studio',appVersion:JSON.parse(await (await import('node:fs/promises')).readFile('package.json','utf8')).version,...(electronZipDir?{electronZipDir}:{download:{cacheRoot}}),ignore:[/^\/.git(?:\/|$)/,/^\/tests/,/^\/scripts/,/^\/app\/selftest/,/^\/app\/test-pose.jpg/,/^\/README.md/]});
