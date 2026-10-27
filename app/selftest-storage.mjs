import {createProjectStore} from './storage.mjs';
const name='formlens-test-'+crypto.randomUUID(),out=document.getElementById('result');let store;const passed=[];
const check=(ok,label)=>{if(!ok)throw Error(label);passed.push('PASS '+label)};
try{
 await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('projects',{keyPath:'id'});r.result.createObjectStore('headers',{keyPath:'id'})};r.onerror=()=>reject(r.error);r.onsuccess=()=>{r.result.close();resolve()}});
 store=createProjectStore(name);const original={id:'a',title:'Original',filename:'test.mp4',updatedAt:1,duration:2,video:new Blob(['video']),report:null};
 await store.saveProject(original);check((await store.getProject('a')).title==='Original','v1 → v2 migration and save');
 await store.saveProject({...original,title:'Updated',updatedAt:2});check((await store.listProjects())[0].hasBackup,'previous version recorded');
 await store.restorePrevious('a');check((await store.getProject('a')).title==='Original','restore previous version');
 await store.restorePrevious('a');check((await store.getProject('a')).title==='Updated','restoration itself can be undone');
 let rejected=false;try{await store.saveProject({...original,title:'Invalid',cannotClone:()=>{}})}catch{rejected=true}check(rejected&&(await store.getProject('a')).title==='Updated','failed write leaves current project intact');
 await store.restorePrevious('a');check((await store.getProject('a')).title==='Original','failed write also leaves backup intact');
 await store.close();store=createProjectStore(name);check((await store.getProject('a')).title==='Original','reopen preserves video and metadata');
 check(await (await store.getProject('a')).video.text()==='video','video bytes preserved');
 await store.deleteProject('a');check((await store.listProjects()).length===0&&!await store.getProject('a'),'delete removes project and header');
 rejected=false;try{await store.restorePrevious('a')}catch{rejected=true}check(rejected,'delete removes backup');
 out.textContent=passed.join('\n')+'\nALL 10 STORAGE CHECKS PASSED';document.title='PASS — FormLens storage';
}catch(error){out.textContent=passed.join('\n')+'\nFAIL '+error.stack;document.title='FAIL — FormLens storage'}finally{await store?.close();indexedDB.deleteDatabase(name)}
