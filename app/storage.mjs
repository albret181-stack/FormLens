/** IndexedDB transactions keep metadata, video and previous revision consistent. */
export function createProjectStore(name='formlens-projects-v1'){
 let database;
 function open(){return database??=new Promise((resolve,reject)=>{let settled=false;const request=indexedDB.open(name,2);
  request.onupgradeneeded=()=>{const db=request.result;for(const store of ['headers','projects','backups'])if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:'id'})};
  request.onsuccess=()=>{const db=request.result;if(settled){db.close();return}settled=true;db.onversionchange=()=>{db.close();database=null};resolve(db)};
  request.onerror=()=>{settled=true;database=null;reject(new Error('Локальное хранилище недоступно. '+request.error?.message))};
  request.onblocked=()=>{settled=true;database=null;reject(new Error('Закройте другие окна FormLens и повторите: обновляется хранилище.'))};
 })}
 async function transaction(stores,mode,work){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(stores,mode);let result,reason;const fail=error=>{reason=error;tx.abort()};tx.oncomplete=()=>resolve(typeof result==='function'?result():result);tx.onerror=tx.onabort=()=>reject(reason||new Error(tx.error?.name==='QuotaExceededError'?'Недостаточно места в локальном хранилище. Предыдущая версия проекта сохранена.':'Операция с хранилищем не завершена: '+(tx.error?.message||'отмена')));try{result=work(tx,fail)}catch(error){fail(error)}})}
 const header=(p,hasBackup)=>({id:p.id,title:p.title,filename:p.filename,updatedAt:p.updatedAt,duration:p.duration,size:p.video.size,reps:p.report?.reps.length??null,status:p.report?.status||'Без анализа',hasBackup});
 async function saveProject(project){if(!(project.video instanceof Blob))throw new Error('Для сохранения нужен исходный видеофайл.');return transaction(['headers','projects','backups'],'readwrite',(tx,fail)=>{const previous=tx.objectStore('projects').get(project.id);previous.onsuccess=()=>{try{if(previous.result)tx.objectStore('backups').put(previous.result);tx.objectStore('projects').put(project);tx.objectStore('headers').put(header(project,!!previous.result))}catch(error){fail(error)}};return ()=>header(project,!!previous.result)})}
 async function listProjects(){return transaction(['headers'],'readonly',tx=>{const request=tx.objectStore('headers').getAll();return ()=>request.result.sort((a,b)=>b.updatedAt-a.updatedAt)})}
 async function getProject(id){return transaction(['projects'],'readonly',tx=>{const request=tx.objectStore('projects').get(id);return ()=>request.result})}
 async function deleteProject(id){return transaction(['headers','projects','backups'],'readwrite',tx=>{for(const store of ['headers','projects','backups'])tx.objectStore(store).delete(id)})}
 async function restorePrevious(id){return transaction(['headers','projects','backups'],'readwrite',(tx,fail)=>{const current=tx.objectStore('projects').get(id),previous=tx.objectStore('backups').get(id);let restored;previous.onsuccess=()=>{try{if(!previous.result||!current.result){fail(new Error('Предыдущая версия этого разбора не найдена.'));return}restored={...previous.result,updatedAt:Date.now()};tx.objectStore('backups').put(current.result);tx.objectStore('projects').put(restored);tx.objectStore('headers').put(header(restored,true))}catch(error){fail(error)}};return ()=>restored})}
 async function close(){if(database){const db=await database;db.close();database=null}}
 return {saveProject,listProjects,getProject,deleteProject,restorePrevious,close};
}
export const {saveProject,listProjects,getProject,deleteProject,restorePrevious}=createProjectStore();
