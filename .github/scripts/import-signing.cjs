const {execFileSync}=require('node:child_process');
const {writeFileSync,appendFileSync,rmSync}=require('node:fs');
const {randomBytes}=require('node:crypto');
const path=require('node:path');
for(const name of ['RUNNER_TEMP','GITHUB_ENV','FORMLENS_CERTIFICATE_P12','FORMLENS_CERTIFICATE_PASSWORD'])if(!process.env[name])throw Error(`Настройте ${name}`);
const certificate=path.join(process.env.RUNNER_TEMP,'formlens-signing.p12');
const keychain=path.join(process.env.RUNNER_TEMP,'formlens-signing.keychain-db');
const password=randomBytes(32).toString('hex');
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'ignore'});
try{
 writeFileSync(certificate,Buffer.from(process.env.FORMLENS_CERTIFICATE_P12,'base64'),{mode:0o600});
 run('security',['create-keychain','-p',password,keychain]);
 run('security',['set-keychain-settings','-lut','21600',keychain]);
 run('security',['unlock-keychain','-p',password,keychain]);
 run('security',['import',certificate,'-P',process.env.FORMLENS_CERTIFICATE_PASSWORD,'-k',keychain,'-T','/usr/bin/codesign','-T','/usr/bin/security']);
 run('security',['set-key-partition-list','-S','apple-tool:,apple:','-s','-k',password,keychain]);
 // A hosted runner is disposable; keep login accessible while adding this keychain.
 run('security',['list-keychains','-d','user','-s',keychain,path.join(process.env.HOME,'Library/Keychains/login.keychain-db')]);
 appendFileSync(process.env.GITHUB_ENV,`FORMLENS_SIGN_KEYCHAIN=${keychain}\n`);
}catch{try{run('security',['delete-keychain',keychain])}catch{}throw Error('Не удалось импортировать сертификат подписи. Проверьте P12 и пароль в GitHub Secrets.');}
finally{rmSync(certificate,{force:true});}
