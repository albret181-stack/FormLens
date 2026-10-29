import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export async function makeUpdateFeed({version,zipPath,publishedAt=new Date().toISOString()}){
 if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))throw Error('Invalid release version');
 const zip=await readFile(zipPath);
 if(!zip.length)throw Error('Empty update archive');
 return {currentRelease:version,releases:[{version,updateTo:{version,name:`FormLens ${version}`,notes:'Обновление FormLens',pub_date:publishedAt,url:`https://github.com/albret181-stack/FormLens/releases/download/v${version}/FormLens-${version}-arm64.zip`,size:zip.length,sha256:createHash('sha256').update(zip).digest('hex')}}]};
}
