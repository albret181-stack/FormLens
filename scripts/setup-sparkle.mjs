import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,stat,cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
export const SPARKLE_VERSION='2.10.1';
const SHA='1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27';
export async function prepareSparkle(){
 const root=path.resolve('../build/sparkle-'+SPARKLE_VERSION),archive=path.resolve('../build/Sparkle-'+SPARKLE_VERSION+'.tar.xz');
 await mkdir(path.dirname(archive),{recursive:true});
 let bytes;try{bytes=await readFile(archive)}catch{
  const response=await fetch(`https://github.com/sparkle-project/Sparkle/releases/download/${SPARKLE_VERSION}/Sparkle-${SPARKLE_VERSION}.tar.xz`,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('Не удалось скачать Sparkle');
  const chunks=[];let count=0;for await(const chunk of response.body){count+=chunk.length;if(count>150*1024*1024)throw Error('Архив Sparkle слишком большой');chunks.push(Buffer.from(chunk))}bytes=Buffer.concat(chunks);
 }
 if(createHash('sha256').update(bytes).digest('hex')!==SHA)throw Error('Контрольная сумма Sparkle не совпала');
 await writeFile(archive,bytes);await mkdir(root,{recursive:true});
 execFileSync('tar',['-xJf',archive,'-C',root],{stdio:'pipe'});
 for(const file of ['bin/sign_update','bin/generate_keys','Sparkle.framework'])await stat(path.join(root,file));
 // Sparkle distributes its framework/signing tools, but not the optional CLI app.
 const source=path.resolve('../build/sparkle-source'),derived=path.resolve('../build/sparkle-cli-build');
 try{await stat(path.join(source,'.git'))}catch{execFileSync('git',['clone','--no-checkout','https://github.com/sparkle-project/Sparkle.git',source],{stdio:'inherit'})}
 execFileSync('git',['-C',source,'checkout','--detach','ab7d71291238df6e0492143b120c9b696a35f603'],{stdio:'inherit'});
 execFileSync('git',['-C',source,'submodule','update','--init','--recursive'],{stdio:'inherit'});
 execFileSync('xcodebuild',['-project',path.join(source,'Sparkle.xcodeproj'),'-scheme','sparkle-cli','-configuration','Release','-derivedDataPath',derived,'-quiet','build','CODE_SIGNING_ALLOWED=NO','ARCHS=arm64','ONLY_ACTIVE_ARCH=YES'],{stdio:'inherit'});
 await cp(path.join(derived,'Build','Products','Release','sparkle.app'),path.join(root,'sparkle.app'),{recursive:true,verbatimSymlinks:true});
 await stat(path.join(root,'sparkle.app','Contents','MacOS','sparkle'));
 return root;
}
