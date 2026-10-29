const {createUpdateService}=require('./update-service.cjs');

/** Native Squirrel owns download verification, application replacement and relaunch. */
function createNativeUpdates(current,{updater,metadata=createUpdateService(current),enabled=true,onState=()=>{},timeoutMs=15*60*1000}={}){
 let state={...metadata.getState(),installSupported:enabled},timer=null,pending=null;
 const emit=next=>{state={...next,installSupported:enabled};onState({...state});return {...state}};
 const stopTimer=()=>{clearTimeout(timer);timer=null};
 const fail=()=>{if(state.status!=='downloading')return {...state};stopTimer();return emit({...state,status:'error',message:'Обновление не удалось подготовить. Проверьте соединение и повторите проверку. Установленная версия не заменена.'})};
 updater.on('error',fail);
 updater.on('update-available',()=>{if(state.status==='downloading')emit({...state,message:'Скачиваю и проверяю обновление…'})});
 updater.on('update-not-available',()=>{if(state.status!=='downloading')return;stopTimer();emit({...state,status:'current',message:'У вас актуальная версия'})});
 updater.on('update-downloaded',()=>{if(state.status!=='downloading')return;stopTimer();emit({...state,status:'ready',message:'Обновление готово. Разбор будет сохранён перед перезапуском.'})});
 async function check(){
  if(['downloading','ready','installing'].includes(state.status))return {...state};
  if(pending)return pending;
  emit({...state,status:'checking',message:'Проверяю обновления…'});
  pending=(async()=>{const result=await metadata.check();
   return emit({...result,...(!enabled?{message:'Установка из приложения доступна в подписанной сборке для macOS. Эта сборка её не поддерживает.'}:result.status==='available'&&!result.nativeFeed?{message:'Этот выпуск не содержит пакета автообновления. Он появится после подготовки подписанной сборки.'}:{} )});
  })();try{return await pending}finally{pending=null}
 }
 function download(){
  if(state.status==='downloading'||state.status==='ready')return {...state};
  if(!enabled)throw Error('Для автообновления нужна подписанная сборка FormLens для macOS.');
  if(state.status!=='available'||!state.nativeFeed)throw Error('Сначала проверьте наличие выпуска с пакетом автообновления.');
  emit({...state,status:'downloading',message:'Скачиваю и проверяю обновление…'});
  // Do not allow a retry in this process after timeout: a native download may still finish.
  timer=setTimeout(()=>{if(state.status==='downloading')emit({...state,message:'Загрузка занимает больше времени. Можно продолжать работу; статус обновится после проверки.'})},timeoutMs);timer.unref?.();
  try{updater.setFeedURL({url:state.nativeFeed,serverType:'json'});updater.checkForUpdates()}catch{fail()}
  return {...state};
 }
 function install(){
  if(!enabled||state.status!=='ready')throw Error('Обновление ещё не готово к установке.');
  emit({...state,status:'installing',message:'Перезапускаю FormLens для установки…'});
  try{updater.quitAndInstall()}catch(error){emit({...state,status:'ready',message:'Не удалось перезапустить приложение. Попробуйте ещё раз.'});throw error}
  return {...state};
 }
 return {check,download,install,getState:()=>({...state}),dispose:stopTimer};
}
module.exports={createNativeUpdates};
