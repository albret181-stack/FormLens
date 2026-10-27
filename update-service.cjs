const REPOSITORY='albret181-stack/FormLens';
const RELEASES=`https://github.com/${REPOSITORY}/releases`;
function version(value){const match=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);return match?match.slice(1).map(Number):null}
function newer(candidate,current){const a=version(candidate),b=version(current);if(!a||!b)return false;for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i]}return false}
function parseRelease(data,current){
 if(!data||data.draft||data.prerelease||!version(data.tag_name))throw Error('GitHub вернул неподдерживаемую версию.');
 const latest=data.tag_name.replace(/^v/,'');
 const expected=`${RELEASES}/download/v${latest}/FormLens-${latest}-arm64.dmg`;
 const asset=Array.isArray(data.assets)?data.assets.find(a=>a.name===`FormLens-${latest}-arm64.dmg`&&a.browser_download_url===expected&&a.state==='uploaded'&&Number.isSafeInteger(a.size)&&a.size>0):null;
 if(newer(latest,current)&&!asset)throw Error('Новая версия ещё не готова к загрузке. Повторите проверку позже.');
 return {status:newer(latest,current)?'available':'current',current,latest,download:asset?expected:null,release:`${RELEASES}/tag/v${latest}`,message:newer(latest,current)?`Доступна FormLens ${latest}`:'У вас актуальная версия'};
}
function createUpdateService(current,{fetcher=fetch,now=Date.now}={}){
 let state={status:'idle',current,message:'Проверить новую версию'},pending,last=0;
 async function check(){if(pending)return pending;if(last&&now()-last<60000)return state;
  pending=(async()=>{state={status:'checking',current,message:'Проверяю GitHub Releases…'};
   try{const response=await fetcher(`https://api.github.com/repos/${REPOSITORY}/releases/latest`,{headers:{Accept:'application/vnd.github+json','User-Agent':'FormLens/'+current},signal:AbortSignal.timeout(15000),redirect:'error'});
    if(response.status===404){state={status:'unpublished',current,message:'Первый выпуск ещё не опубликован'};return state}
    if(!response.ok)throw Error(response.status===403||response.status===429?'GitHub временно ограничил проверки. Повторите позже.':'Не удалось проверить обновления. Проверьте соединение.');
    const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024)throw Error('Ответ сервера слишком большой.');chunks.push(Buffer.from(value))}}finally{await reader.cancel().catch(()=>{})}
    state=parseRelease(JSON.parse(Buffer.concat(chunks).toString('utf8')),current);
   }catch(error){state={status:'error',current,message:error.name==='TimeoutError'?'Сервер не ответил вовремя. Повторите позже.':error.message}}
   finally{last=now()}return state;
  })();try{return await pending}finally{pending=null}
 }
 return {check,getState:()=>({...state}),downloadURL:()=>state.status==='available'?state.download:null};
}
module.exports={createUpdateService,parseRelease,newer,REPOSITORY};
