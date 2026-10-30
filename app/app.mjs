import './simple-layout.mjs';
import {prepareUpdate} from './update-preparation.mjs';
import {eventAt,eventWindow,reviewRate} from './review.mjs';
import {exportProjectFile,importProjectFile} from './project-file.mjs';
import {PoseClient} from './pose-client.mjs';
import {initTheme} from './themes.mjs';
import {saveProject,listProjects,getProject,deleteProject,restorePrevious} from './storage.mjs';
import {measure,analyze,CONFIG,createSubjectTracker} from './engine.mjs';
import {selectRecovery} from './frame-recovery.mjs';
import {EXERCISES,exerciseById} from './exercises.mjs';
import {buildExerciseReview} from './exercise-review.mjs';
import {regionsForFrame,regionPixels,mapFromRegion,chooseClipLayout} from './video-regions.mjs';
import {renderSlideDeck,makeSlideReport} from './slides-ui.mjs';
import {demoSample,drawDemo,demoDuration} from './demo.mjs';
const $=id=>document.getElementById(id),video=$('video'),canvas=$('overlay');
let samples=[],report=null,isDemo=false,loaded=false,busy=false,worker=null,objectURL=null,selection=null,compareTimes=[],demoTime=0,demoPlaying=false,run=0,lastTick=0;
initTheme($('theme-select'));
let clipEnd=null,currentReview=null,slideIndex=0;
let currentFile=null,projectId=null,dirty=false,uiBusy=false,analysisConfig={...CONFIG},imported=false,transferController=null;
function filterExerciseChoices(query){$('exercise-choices').replaceChildren();const found=EXERCISES.filter(e=>e.id!=='generic'&&e.name.toLowerCase().includes(query.toLowerCase().trim()));for(const e of found){const b=document.createElement('button');b.type='button';b.textContent=e.name;b.onclick=()=>chooseExercise(e.id);$('exercise-choices').append(b)}if(!found.length){const p=document.createElement('p');p.textContent='Пока нет в списке. Можно продолжить с доступными наблюдениями.';$('exercise-choices').append(p)}}
function updateExerciseGuide(){$('guide-exercise').value=$('machine').value;const e=exerciseById($('machine').value),body=$('shoot-guide-body');body.replaceChildren();const p=document.createElement('p');p.textContent=e.view;const joints=document.createElement('p');joints.textContent='В кадре: '+e.joints+'.';body.append(p,joints);}
function chooseExercise(id){if(busy||uiBusy)return;$('machine').value=id;analysisConfig.exerciseId=id;updateExerciseGuide();$('exercise-dialog').close();runAnalysis().catch(showError)}
$('guide-exercise').onchange=()=>{if(busy||uiBusy)return;$('machine').value=$('guide-exercise').value;$('machine').dispatchEvent(new Event('change'))};
$('exercise-search').oninput=e=>filterExerciseChoices(e.target.value);$('exercise-skip').onclick=()=>chooseExercise('generic');$('exercise-back').onclick=()=>$('exercise-dialog').close();
$('machine').onchange=async()=>{if(busy||uiBusy)return;analysisConfig.exerciseId=$('machine').value;updateExerciseGuide();markDirty();slideIndex=0;if(report)try{await renderReport()}catch(e){showError(e)}};
$('video-layout').onchange=()=>{if(busy||uiBusy)return;analysisConfig.layout=$('video-layout').value;markDirty();if(loaded)runAnalysis().catch(showError)};
$('source-toggle').onclick=()=>{const open=document.body.classList.toggle('show-source');$('source-toggle').textContent=open?'Скрыть исходное видео':'Открыть исходное видео';if(open)document.querySelector('.viewer').scrollIntoView({block:'start',behavior:'smooth'});else video.pause()};
updateExerciseGuide();
const fmt=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(1).padStart(4,'0')}`;
const current=()=>isDemo?demoTime:video.currentTime;
const duration=()=>isDemo?demoDuration:video.duration||0;
const nearest=t=>samples.length?samples.reduce((a,b)=>Math.abs(b.t-t)<Math.abs(a.t-t)?b:a):null;
function notice(title,text,demo=false){document.body.classList.toggle('has-notice',title!=='Начните с видео');$('mode').textContent=title;$('notice').textContent=' '+text;$('banner').classList.toggle('demo',demo)}
function controls(){document.body.classList.toggle('has-video',loaded);document.body.classList.toggle('has-report',!!report);document.body.classList.toggle('has-comparison',compareTimes.length===2);document.querySelector('.findings').setAttribute('aria-busy',String(busy));const locked=busy||uiBusy,available=loaded&&!locked;$('machine').disabled=locked;$('guide-exercise').disabled=locked;$('video-layout').disabled=locked;$('source-toggle').disabled=!loaded||locked;$('analyze').disabled=!available||isDemo;for(const id of ['play','scrub','pin','save-frame','playback-speed','auto-slow'])$(id).disabled=!available;for(const id of ['new-session','upload','empty-upload','demo','confirm','library-open','project-title','project-notes'])$(id).disabled=locked;$('overlays').disabled=locked;for(const [n,i] of [['A',0],['B',1]])$('jump'+n).disabled=locked||compareTimes[i]===undefined;$('cancel').hidden=!busy||uiBusy;$('export').disabled=!report||locked;$('html-report').disabled=!report||locked;$('save-project').disabled=!available||isDemo||!currentFile;$('project-export').disabled=!available||isDemo||!currentFile;$('project-import').disabled=locked;$('transfer-cancel').hidden=!transferController;$('import-cancel').hidden=!transferController;document.querySelectorAll('.slide-deck button,.frame-review button,.event-actions button,.arm-observation button,.limitation-links button,.rep-list button,.timeline button,.library-card button').forEach(b=>b.disabled=locked||b.dataset.edgeDisabled==='true')}
function markDirty(){if(isDemo)return;dirty=true;$('save-status').textContent=projectId?'Есть изменения':'Не сохранено'}
function canLeave(){return !dirty||!currentFile||window.confirm('В текущем разборе есть несохранённые изменения. Перейти без сохранения?')}
function clearComparisons(){compareTimes=[];for(const n of ['A','B']){$('compare'+n).getContext('2d').clearRect(0,0,$('compare'+n).width,$('compare'+n).height);$('compare'+n).parentElement.classList.remove('has-frame');$('jump'+n).disabled=true;$('jump'+n).textContent='—'}$('comparehint').textContent='Выберите замечание или сохраните два кадра кнопкой «＋ Кадр».'}
function reset(){clipEnd=null;currentReview=null;slideIndex=0;document.body.classList.remove('show-source');video.playbackRate=1;run++;worker?.close();worker=null;video.pause();demoPlaying=false;samples=[];report=null;selection=null;$('stat-reps').textContent='—';$('stat-quality').textContent='—';clearComparisons();$('events').replaceChildren();$('timeline').replaceChildren();$('rep-list').replaceChildren();$('count').textContent='0';$('export').disabled=true;$('progress').textContent='';$('framebadge').hidden=true}
function updateClock(){$('stat-duration').textContent=loaded?duration().toFixed(1)+' с':'—';$('clock').textContent=fmt(current());$('duration').textContent=fmt(duration());$('scrub').max=duration();$('scrub').value=current();$('play').textContent=(isDemo?demoPlaying:!video.paused)?'Ⅱ':'▶'}
function seek(t){if(isDemo){demoTime=t;draw();updateClock();return Promise.resolve()}return new Promise((resolve,reject)=>{if(Math.abs(video.currentTime-t)<.001&&video.readyState>=2){resolve();return}const timer=setTimeout(()=>{cleanup();reject(new Error('Не удалось декодировать кадр. Попробуйте MP4 H.264.'))},7000);const done=()=>{cleanup();resolve()};const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done)};video.addEventListener('seeked',done);video.currentTime=t})}
function overlay(ctx,w,h,s,t,event){
 if(!s?.valid||!s.landmarks||Math.abs(s.t-t)>.22)return;
 const active=event?.type==='swing'?event:eventAt(t,report,duration());
 if(!active)return;
 const bounds=eventWindow(active,report,duration());
 if(t<bounds.start||t>bounds.end)return;
 const ids=s.ids||active.ids||[11,13,15,23,25],p=s.landmarks;
 const shoulder=p[ids[0]],hip=p[ids[3]];if(!shoulder||!hip)return;
 ctx.save();ctx.strokeStyle='#ffb454';ctx.fillStyle='#ffb454';ctx.lineWidth=Math.max(4,w*.006);
 ctx.beginPath();ctx.moveTo(hip.x*w,hip.y*h);ctx.lineTo(shoulder.x*w,shoulder.y*h);ctx.stroke();
 for(const point of [shoulder,hip]){ctx.beginPath();ctx.arc(point.x*w,point.y*h,Math.max(7,w*.01),0,Math.PI*2);ctx.fill()}
 // A dashed line is another measured moment of this repetition, never an ideal pose.
 const reference=nearest(active.reference);
 if(reference?.valid&&reference.landmarks&&reference.side===s.side){
  const a=reference.landmarks[ids[0]],b=reference.landmarks[ids[3]];
  if(a&&b){ctx.setLineDash([10,8]);ctx.strokeStyle='#ffffffb3';ctx.lineWidth=Math.max(3,w*.004);ctx.beginPath();ctx.moveTo(b.x*w,b.y*h);ctx.lineTo(a.x*w,a.y*h);ctx.stroke();ctx.setLineDash([])}
 }
 const font=Math.max(17,w*.026),text='Движение корпуса · проверить';
 ctx.font=`600 ${font}px sans-serif`;const boxW=Math.min(w-24,ctx.measureText(text).width+20);
 ctx.fillStyle='#171717e8';ctx.fillRect(12,h-font*2.3-12,boxW,font*2.3);ctx.fillStyle='#ffb454';ctx.fillText(text,22,h-font*.85-12,boxW-20);ctx.restore();
}
function draw(){const w=isDemo?960:video.videoWidth||960,h=isDemo?540:video.videoHeight||540;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(isDemo)drawDemo(ctx,w,h,demoTime);const sample=nearest(current());if($('overlays').checked&&sample&&Math.abs(sample.t-current())<=.22)drawSlideLandmarks(ctx,w,h,sample);$('framebadge').hidden=!report;$('framebadge').textContent=isDemo?'ДЕМО · искусственное движение':'Линии — распознанные суставы, не оценка всей техники';}
function applyReviewSpeed(){const rate=reviewRate(current(),report,duration(),+$('playback-speed').value,$('auto-slow').checked);if(video.playbackRate!==rate)video.playbackRate=rate;$('speed-status').textContent=loaded?(rate===.5&&$('auto-slow').checked&&eventAt(current(),report,duration())?'Замедление замечания · ×0,5':`×${String(rate).replace('.',',')}`):'';return rate}
async function replayEvent(event,index){if(busy||uiBusy)return;clipEnd=null;await selectEvent(event,index);if(busy||uiBusy)return;uiBusy=true;controls();try{const bounds=eventWindow(event,report,duration());await seek(Math.max(0,bounds.start-.35));clipEnd=Math.min(duration(),bounds.end+.35);applyReviewSpeed();draw();if(isDemo)demoPlaying=true;else await video.play();updateClock()}finally{uiBusy=false;controls()}}


async function capture(target,t){await seek(Math.min(t,duration()-.01));const c=$(target),ctx=c.getContext('2d'),w=isDemo?960:video.videoWidth,h=isDemo?540:video.videoHeight;c.width=720;c.height=Math.round(720*h/w);ctx.clearRect(0,0,c.width,c.height);c.parentElement.classList.add('has-frame');if(isDemo)drawDemo(ctx,c.width,c.height,t);else ctx.drawImage(video,0,0,c.width,c.height);if($('overlays').checked)overlay(ctx,c.width,c.height,nearest(t),t,selection);}
async function compare(a,b){video.pause();demoPlaying=false;const original=current();await capture('compareA',a);await capture('compareB',b);compareTimes=[a,b];markDirty();for(const [n,t] of [['A',a],['B',b]]){$('jump'+n).textContent=fmt(t)+' ↗';$('jump'+n).disabled=false}await seek(original);draw();updateClock()}
async function selectEvent(e,index){if(uiBusy)return;uiBusy=true;controls();try{clipEnd=null;selection=e;markDirty();document.querySelectorAll('.event[data-event-index]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.eventIndex)===index));video.pause();demoPlaying=false;await seek(e.t);draw();applyReviewSpeed();updateClock()}finally{uiBusy=false;controls()}}
function drawObservedPart(ctx,w,h,sample,part='arm'){
 if(!sample?.landmarks||part==='arm'&&!sample.valid||part==='torso'&&sample.torsoValid===false)return;const points=(part==='torso'?[sample.ids[0],sample.ids[3]]:sample.ids.slice(0,3)).map(i=>sample.landmarks[i]);
 ctx.save();ctx.strokeStyle='#61d1bd';ctx.fillStyle='#61d1bd';ctx.lineWidth=Math.max(4,w*.008);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x*w,p.y*h):ctx.moveTo(p.x*w,p.y*h));ctx.stroke();
 for(const p of points){ctx.beginPath();ctx.arc(p.x*w,p.y*h,Math.max(5,w*.011),0,Math.PI*2);ctx.fill()}ctx.restore();
}
async function showObservation(time){if(busy||uiBusy)return;document.body.classList.add('show-source');$('source-toggle').textContent='Скрыть исходное видео';uiBusy=true;controls();try{video.pause();demoPlaying=false;selection=null;await seek(time);draw();updateClock();markDirty();document.querySelector('.viewer').scrollIntoView({block:'start',behavior:'smooth'})}finally{uiBusy=false;controls()}}
async function replayFrames(group){
 if(busy||uiBusy)return;document.body.classList.add('show-source');$('source-toggle').textContent='Скрыть исходное видео';uiBusy=true;controls();
 try{video.pause();demoPlaying=false;selection=null;await seek(group.start);clipEnd=Math.min(duration(),group.end);$('playback-speed').value='0.5';$('auto-slow').checked=false;applyReviewSpeed();draw();updateClock();document.querySelector('.viewer').scrollIntoView({block:'start',behavior:'smooth'});if(isDemo)demoPlaying=true;else await video.play()}
 finally{uiBusy=false;controls()}
}
function drawSlideLandmarks(ctx,w,h,sample,point=null,attention=false){
 const views=sample?.views||[{region:{id:'full'},landmarks:sample?.landmarks}];ctx.save();ctx.lineWidth=Math.max(2,w*.004);
 for(const view of views){if(point?.region&&point.region.id!==view.region.id)continue;const p=view.landmarks;if(!p)continue;
  const valid=i=>p[i]&&p[i].visibility>=CONFIG.visibility&&p[i].x>=0&&p[i].x<=1&&p[i].y>=0&&p[i].y<=1;
  const crop=point?.region;const xy=i=>({x:((p[i].x-(crop?.x||0))/(crop?.width||1))*w,y:((p[i].y-(crop?.y||0))/(crop?.height||1))*h});
  const connections=point?.ids?.length?(point.ids.length===6?[[point.ids[0],point.ids[1]],[point.ids[1],point.ids[2]],[point.ids[3],point.ids[4]],[point.ids[4],point.ids[5]]]:point.ids.slice(1).map((id,i)=>[point.ids[i],id])):[[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,25],[25,27],[24,26],[26,28]];
  ctx.strokeStyle=attention?'#ffb454':'#61d1bd';ctx.fillStyle=ctx.strokeStyle;
  for(const [a,b]of connections){if(!valid(a)||!valid(b))continue;const from=xy(a),to=xy(b);ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();for(const v of [from,to]){ctx.beginPath();ctx.arc(v.x,v.y,Math.max(3,w*.006),0,Math.PI*2);ctx.fill()}}
 }ctx.restore();
}
async function captureSlideFrame(frame,point,attention=false){
 await seek(Math.max(0,Math.min(point.t,duration()-.01)));const w=isDemo?960:video.videoWidth,h=isDemo?540:video.videoHeight,r=point.region||{x:0,y:0,width:1,height:1};frame.width=640;frame.height=Math.max(1,Math.round(640*r.height*h/(r.width*w)));const ctx=frame.getContext('2d');
 if(isDemo){drawDemo(ctx,frame.width,frame.height,point.t)}else ctx.drawImage(video,r.x*w,r.y*h,r.width*w,r.height*h,0,0,frame.width,frame.height);
 const sample=nearest(point.t);if(sample&&Math.abs(sample.t-point.t)<=.2)drawSlideLandmarks(ctx,frame.width,frame.height,sample,point,attention);
}
async function renderReport(){
 const previousBusy=uiBusy;uiBusy=true;controls();video.pause();demoPlaying=false;const original=current(),token=run;
 try{
  const id=analysisConfig.exerciseId||'seated-row';report=analyze(samples);if(id!=='seated-row'){report.reps=[];report.events=report.events.filter(e=>e.type!=='swing')}currentReview=buildExerciseReview(samples,id,isDemo?960:video.videoWidth,isDemo?540:video.videoHeight);report.exerciseReviewVersion=1;
  $('status').textContent=currentReview.attention?'Есть моменты для проверки':currentReview.observed?'Проверены отдельные признаки':'Доступен частичный разбор';$('metrics').textContent=exerciseById(id).name;report.status=$('status').textContent;report.exerciseId=id;
  $('count').textContent=currentReview.attention?'Проверить: '+currentReview.attention:'Разбор';$('count').setAttribute('aria-label',$('count').textContent);$('stat-reps').textContent='—';$('stat-quality').textContent='—';$('timeline').replaceChildren();$('rep-list').replaceChildren();
  await renderSlideDeck($('events'),currentReview,{initialIndex:slideIndex,disabled:()=>busy||uiBusy,onIndex:i=>{slideIndex=i;markDirty()},capture:async(c,p,a)=>{if(token===run)await captureSlideFrame(c,p,a)},showFrame:p=>showObservation(p.t).catch(showError),replay:c=>replayFrames({start:c.start,end:c.end}).catch(showError)});
  const scope=document.querySelector('.scope p');scope.textContent='Проверяются только доступные признаки выбранного упражнения. Отсутствие замечаний не подтверждает правильность всей техники.';
 }finally{if(token===run){await seek(original).catch(()=>{});draw();updateClock()}uiBusy=previousBusy;controls()}
}
function analysisMessage(title,text){const box=document.createElement('div');box.className='placeholder';const heading=document.createElement('h3');heading.textContent=title;const detail=document.createElement('p');detail.textContent=text;box.append(heading,detail);$('events').replaceChildren(box);$('count').textContent='—'}
async function processNewVideo(file){if(await loadFile(file)){if($('machine').value!=='generic')await runAnalysis();else{$('exercise-dialog').showModal();$('exercise-search').value='';filterExerciseChoices('')}}}
function showError(e){notice('Не удалось завершить действие',e.message||String(e));$('progress').textContent='';}
async function loadFile(file,{skipConfirm=false}={}){
 if(!file||busy||uiBusy)return false;
 if(file.size>500*1024*1024){showError(new Error('Максимальный размер — 500 МБ.'));return false}
 if(!skipConfirm&&!canLeave())return false;
 const requestedExercise=skipConfirm?'generic':$('machine').value;reset();analysisConfig={...CONFIG,exerciseId:requestedExercise,layout:'auto'};$('machine').value=requestedExercise;$('video-layout').value='auto';updateExerciseGuide();loaded=false;isDemo=false;imported=false;uiBusy=true;currentFile=null;projectId=null;dirty=false;$('project-title').value=file.name.replace(/\.[^.]+$/,'');$('project-notes').value='';$('save-status').textContent='Не сохранено';notice('Загрузка видео','Открываю локальный файл…');$('status').textContent='Загрузка видео';$('metrics').textContent='Результатов ещё нет';
 if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(file);video.hidden=false;$('empty').hidden=true;$('filename').textContent=file.name;$('confirm').checked=false;controls();
 try{await new Promise((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);video.onloadeddata=null;video.onerror=null};const timer=setTimeout(()=>{cleanup();reject(new Error('Видео не удалось открыть. Используйте MP4 H.264.'))},10000);video.onloadeddata=()=>{cleanup();resolve()};video.onerror=()=>{cleanup();reject(new Error('Этот кодек не поддерживается. Попробуйте MP4 H.264.'))};video.src=objectURL;video.load()});
 if(!Number.isFinite(video.duration)||video.duration>60||video.duration<1)throw new Error('Выберите фрагмент продолжительностью от 1 до 60 секунд.');
 loaded=true;currentFile=file;markDirty();$('status').textContent='Видео загружено';$('metrics').textContent='Результатов ещё нет';notice('Видео открыто','Выберите упражнение — разбор появится в слайдах. Видео обрабатывается на этом устройстве.');draw();updateClock();return true;
 }catch(e){loaded=false;currentFile=null;$('status').textContent='Видео недоступно';showError(e);return false}finally{uiBusy=false;controls()}
}
async function runAnalysis(){
 if(!loaded||!currentFile||isDemo||busy||uiBusy)return;
 const exerciseId=$('machine').value,layout=$('video-layout').value;
 reset();markDirty();busy=true;analysisConfig={...CONFIG,exerciseId,layout,slideReviewVersion:1};
 analysisMessage('Разбираю видео…','Проверяю доступные признаки движения. Результат появится в слайдах.');$('status').textContent='Идёт разбор';controls();const token=run;
 notice(exerciseById(exerciseId).name,'Один файл — одно упражнение. Варианты в разделённом экране рассматриваются отдельно.');$('progress').textContent='Подготавливаю модель…';
 try{
  worker=new PoseClient(new Worker('./pose-worker.js'));const request=(data,transfer=[])=>worker.request(data,transfer);
  const info=await request({type:'init'}),trackers=new Map(),sides=new Map();analysisConfig.poseModel=info.model;
  let resolvedLayout=layout;
  if(layout==='auto'){$('progress').textContent='Определяю расположение вариантов…';const detected=[];for(const fraction of [.2,.55,.8]){await seek(video.duration*fraction);if(token!==run)throw Error('Анализ отменён');const image=await createImageBitmap(video),probe=await request({type:'image',bitmap:image,t:video.duration*fraction},[image]);detected.push(regionsForFrame(probe.poses,'auto'))}resolvedLayout=chooseClipLayout(detected)}
  analysisConfig.resolvedLayout=resolvedLayout;let recentRegions=null,recentRegionTime=-10;
  const total=Math.ceil(video.duration*CONFIG.sampleHz);
  for(let i=0;i<total;i++){
   if(token!==run)throw Error('Анализ отменён');const t=Math.min(i/CONFIG.sampleHz,video.duration-.02);await seek(t);if(token!==run)throw Error('Анализ отменён');
   const bitmap=await createImageBitmap(video),result=await request({type:'frame',bitmap,t},[bitmap]);if(token!==run)throw Error('Анализ отменён');
   let regions=regionsForFrame(result.poses,resolvedLayout);if(resolvedLayout==='auto'){if(regions.length>1){recentRegions=regions;recentRegionTime=t}else if(recentRegions&&t-recentRegionTime<2)regions=recentRegions}const views=[];
   for(const region of regions){
    if(token!==run)throw Error('Анализ отменён');const crop=regionPixels(region,video.videoWidth,video.videoHeight);let poses=result.poses;
    if(region.id!=='full'){const image=await createImageBitmap(video,crop.x,crop.y,crop.width,crop.height);poses=(await request({type:'image',bitmap:image,t},[image])).poses;}
    if(!trackers.has(region.id))trackers.set(region.id,createSubjectTracker());const chosen=trackers.get(region.id).select(poses);let pose=chosen.pose;
    let m=pose?measure([pose],crop.width,crop.height,sides.get(region.id)):{valid:false,torsoValid:false,reason:chosen.reason,torsoReason:chosen.reason},recovery=null;
    if(region.id==='full'&&pose&&(!m.valid||!m.torsoValid)){
     const image=await createImageBitmap(video),retry=await request({type:'image',bitmap:image,t},[image]);if(token!==run)throw Error('Анализ отменён');
     const candidate=selectRecovery(pose,m,retry.poses,crop.width,crop.height,sides.get(region.id));if(candidate){pose=candidate.pose;m=candidate.measurement;recovery='image'}
    }
    if(m.valid)sides.set(region.id,m.side);views.push({region,landmarks:mapFromRegion(pose,region),reason:chosen.reason,...m,recovery});
   }
   const compact=p=>p?.map(v=>({x:+v.x.toFixed(6),y:+v.y.toFixed(6),visibility:+v.visibility.toFixed(6)}))||null;for(const v of views)v.landmarks=compact(v.landmarks);const primary=views[0];samples.push({t,...primary,landmarks:primary?.landmarks||null,views:views.map(({region,landmarks})=>({region,landmarks}))});
   $('progress').textContent=`Разбор ${Math.round((i+1)/total*100)}%`;updateClock();
  }
  report=analyze(samples);if(exerciseId!=='seated-row'){report.reps=[];report.events=report.events.filter(e=>e.type!=='swing')}
  imported=false;markDirty();await renderReport();$('progress').textContent='Разбор готов';document.querySelector('.findings').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});await seek(0);draw();updateClock();
 }catch(e){if(token===run){samples=[];report=null;currentReview=null;$('status').textContent='Разбор не выполнен';analysisMessage('Не удалось разобрать видео',e.message);showError(e)}}
 finally{if(token===run){worker?.close();worker=null;busy=false;controls()}}
}
async function loadDemo(){if(!canLeave())return;reset();currentFile=null;projectId=null;dirty=false;$('save-status').textContent='Демо не сохраняется';$('project-title').value='Учебная схема';$('project-notes').value='';isDemo=true;loaded=true;analysisConfig={...CONFIG,exerciseId:'seated-row',layout:'single'};$('machine').value='seated-row';updateExerciseGuide();demoTime=5.5;video.hidden=true;samples=Array.from({length:97},(_,i)=>demoSample(i/8));report=analyze(samples);$('empty').hidden=true;$('filename').textContent='Учебная иллюстрация · 12 секунд';$('confirm').checked=false;notice('ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ','Иллюстрация и точки заданы программно. Это пример интерфейса, не результат анализа человека.',true);await renderReport();draw();updateClock();const index=report.events.findIndex(e=>e.type==='swing');if(index>=0)selectEvent(report.events[index],index).catch(showError);controls()}
$('upload').onclick=$('empty-upload').onclick=()=>$('file').click();$('file').onchange=e=>{const file=e.target.files[0];e.target.value='';processNewVideo(file).catch(showError)};$('confirm').onchange=()=>{markDirty();controls()};$('analyze').onclick=runAnalysis;$('demo').onclick=()=>loadDemo().catch(showError);
$('cancel').onclick=()=>{run++;worker?.close();worker=null;busy=false;samples=[];report=null;analysisMessage('Разбор отменён','Нажмите «Повторить разбор», чтобы запустить его снова.');notice('Анализ отменён','Частичные результаты удалены. Можно запустить анализ снова.');$('status').textContent='Анализ отменён';$('progress').textContent='';draw();controls()};
$('play').onclick=()=>{clipEnd=null;applyReviewSpeed();if(isDemo){if(demoTime>=demoDuration)demoTime=0;demoPlaying=!demoPlaying}else video.paused?video.play().catch(showError):video.pause();updateClock()};$('scrub').oninput=async e=>{if(busy||uiBusy)return;const target=+e.target.value;clipEnd=null;uiBusy=true;controls();try{video.pause();demoPlaying=false;await seek(target);draw();updateClock()}catch(error){showError(error)}finally{uiBusy=false;controls()}};video.ontimeupdate=()=>{if(!busy){applyReviewSpeed();draw();updateClock()}};
$('playback-speed').onchange=applyReviewSpeed;$('auto-slow').onchange=applyReviewSpeed;video.onended=updateClock;
$('overlays').onchange=async()=>{if(uiBusy||busy)return;uiBusy=true;controls();try{markDirty();draw();if(compareTimes.length===2)await compare(...compareTimes)}catch(error){showError(error)}finally{uiBusy=false;controls()}};
$('pin').onclick=async()=>{if(uiBusy||busy)return;uiBusy=true;controls();try{video.pause();demoPlaying=false;const t=current();if(compareTimes.length!==1){compareTimes=[t];markDirty();await capture('compareA',t);$('compareB').getContext('2d').clearRect(0,0,720,$('compareB').height);$('compareB').parentElement.classList.remove('has-frame');$('jumpA').textContent=fmt(t)+' ↗';$('jumpA').disabled=false;$('jumpB').disabled=true;$('comparehint').textContent='Кадр А сохранён. Выберите другой момент и снова нажмите «＋ Кадр».'}else{await compare(compareTimes[0],t);$('comparehint').textContent='Два выбранных вручную кадра. Это сравнение, не оценка правильности.'}}catch(error){showError(error)}finally{uiBusy=false;controls()}};
for(const [n,i] of [['A',0],['B',1]])$('jump'+n).onclick=async()=>{if(busy||uiBusy)return;uiBusy=true;controls();try{video.pause();demoPlaying=false;await seek(compareTimes[i]);draw();updateClock()}catch(error){showError(error)}finally{uiBusy=false;controls()}};
$('export').onclick=()=>{const payload={app:'FormLens 0.10.0',source:isDemo?'synthetic-demo':imported?'imported-project':'user-video-mediapipe',machine:analysisConfig.exerciseId||'seated-row',experimental:true,config:analysisConfig,report,exerciseReview:currentReview,samples};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=isDemo?'formlens-DEMO.json':'formlens-analysis.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function tick(ts){const rate=loaded?applyReviewSpeed():1;if(isDemo&&demoPlaying){demoTime=Math.min(demoDuration,demoTime+Math.min(.1,(ts-lastTick)/1000)*rate);if(demoTime>=demoDuration)demoPlaying=false}if(clipEnd!==null&&current()>=clipEnd){video.pause();demoPlaying=false;clipEnd=null}if(loaded&&!busy&&!uiBusy&&(isDemo&&demoPlaying||!video.paused)){draw();updateClock()}lastTick=ts;requestAnimationFrame(tick)}requestAnimationFrame(tick);controls();

function setView(view){const compareMode=view==='compare';document.body.classList.toggle('compare-view',compareMode);$('view-video').classList.toggle('selected',!compareMode);$('view-compare').classList.toggle('selected',compareMode);$('view-video').setAttribute('aria-pressed',String(!compareMode));$('view-compare').setAttribute('aria-pressed',String(compareMode))}
$('view-video').onclick=()=>setView('video');$('view-compare').onclick=()=>setView('compare');
$('new-session').onclick=()=>{if(!canLeave())return;reset();currentFile=null;projectId=null;dirty=false;$('project-title').value='';$('project-notes').value='';$('save-status').textContent='Не сохранено';loaded=false;isDemo=false;video.removeAttribute('src');video.load();if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null}video.hidden=false;$('empty').hidden=false;$('confirm').checked=false;$('filename').textContent='MP4, MOV, WebM · до 60 секунд / 500 МБ';$('machine').value='generic';$('video-layout').value='auto';updateExerciseGuide();$('status').textContent='Ожидает видео';$('metrics').textContent='Результатов пока нет';notice('Начните с видео','Выберите файл или перетащите его в область просмотра.');$('stage').style.aspectRatio='16/10';canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);$('events').innerHTML='<div class="placeholder"><div class="finding-icon">⌁</div><h3>Что стоит проверить?</h3><p>Загрузите видео, чтобы увидеть наблюдения с таймкодами и объяснениями.</p></div>';setView('video');updateClock();controls()};
$('save-frame').onclick=()=>{if(!loaded||busy)return;video.pause();demoPlaying=false;draw();updateClock();const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const ctx=c.getContext('2d');if(!isDemo)ctx.drawImage(video,0,0,c.width,c.height);ctx.drawImage(canvas,0,0);c.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`formlens-${isDemo?'DEMO-':''}${current().toFixed(2)}s.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},'image/png')};
for(const event of ['dragenter','dragover'])$('stage').addEventListener(event,e=>{e.preventDefault();if(!busy&&!uiBusy)$('stage').classList.add('dragover')});
for(const event of ['dragleave','drop'])$('stage').addEventListener(event,e=>{e.preventDefault();$('stage').classList.remove('dragover');if(event==='drop'&&!busy&&!uiBusy){const file=e.dataTransfer.files[0];if(file){setView('video');processNewVideo(file).catch(showError)}}});

$('project-title').oninput=$('project-notes').oninput=markDirty;
$('save-project').onclick=async()=>{
 if(!currentFile||isDemo||busy||uiBusy)return;
 video.pause();uiBusy=true;controls();$('save-status').textContent='Сохранение…';
 const id=projectId||crypto.randomUUID();
 try{await saveProject(projectSnapshot(id));projectId=id;dirty=false;$('save-status').textContent='Сохранено на этом Mac';notice('Разбор сохранён','Видео, разметка и заметки доступны в «Мои разборы».')}
 catch(error){$('save-status').textContent='Не сохранено';showError(error)}finally{uiBusy=false;controls()}
};
async function renderLibrary(){
 const list=$('library-list');list.textContent='Открываю хранилище…';
 try{const projects=await listProjects();list.replaceChildren();if(!projects.length){const empty=document.createElement('div');empty.className='library-empty';empty.textContent='Сохранённых разборов пока нет. Загрузите видео и нажмите «Сохранить на Mac».';list.append(empty);return}
 for(const project of projects){const card=document.createElement('div');card.className='library-card';const description=document.createElement('div');description.className='description';const title=document.createElement('h3');title.textContent=project.title;const info=document.createElement('p');info.textContent=`${project.duration.toFixed(1)} с · ${(project.size/1024/1024).toFixed(1)} МБ · ${new Intl.DateTimeFormat('ru',{dateStyle:'medium',timeStyle:'short'}).format(project.updatedAt)}`;const status=document.createElement('p');status.textContent=project.status;description.append(title,info,status);const open=document.createElement('button');open.textContent='Открыть ↗';open.onclick=()=>openSaved(project.id);const remove=document.createElement('button');remove.className='delete-project';remove.textContent='Удалить';remove.onclick=async()=>{if(busy||uiBusy)return;if(!window.confirm(`Удалить сохранённую копию «${project.title}» с этого устройства? Исходный файл останется без изменений.`))return;try{await deleteProject(project.id);if(projectId===project.id){projectId=null;markDirty()}await renderLibrary()}catch(e){showError(e)}};card.append(description,open);if(project.hasBackup){const restore=document.createElement('button');restore.textContent='Предыдущая версия';restore.onclick=async()=>{if(busy||uiBusy)return;if(projectId===project.id&&dirty){showError(new Error('Сначала сохраните текущие изменения или начните новый разбор.'));return}if(!window.confirm('Восстановить предыдущую сохранённую версию? Текущая версия останется резервной.'))return;try{await restorePrevious(project.id);await renderLibrary();if(projectId===project.id)await openSaved(project.id)}catch(error){showError(error)}};card.append(restore)}card.append(remove);list.append(card)}
 }catch(e){list.textContent='Не удалось открыть хранилище: '+e.message}finally{controls()}
}
async function openSaved(id){
 if(busy||uiBusy||!canLeave())return;
 try{uiBusy=true;controls();const saved=await getProject(id);uiBusy=false;if(!saved)throw new Error('Сохранённый разбор не найден.');if(saved.schema!==1)throw new Error('Версия сохранённого разбора не поддерживается.');
 const file=new File([saved.video],saved.filename,{type:saved.type||saved.video.type});if(!await loadFile(file,{skipConfirm:true}))return;
 uiBusy=true;controls();projectId=saved.id;$('project-title').value=saved.title;$('project-notes').value=saved.notes||'';$('confirm').checked=!!saved.confirmed;$('overlays').checked=saved.overlays!==false;samples=saved.samples||[];report=saved.report;imported=!!saved.imported;analysisConfig={...(saved.config||CONFIG)};$('machine').value=analysisConfig.exerciseId||'seated-row';$('video-layout').value=analysisConfig.layout||'single';slideIndex=analysisConfig.slideIndex||0;updateExerciseGuide();selection=report?.events[saved.selectedEvent]||null;
 if(report)await renderReport();await seek(Math.max(0,Math.min(saved.currentTime||0,duration()-.01)));
 if(saved.compareTimes?.length===2){await compare(...saved.compareTimes);$('comparehint').textContent='Восстановлена сохранённая пара кадров. Это сравнение, не эталон техники.';}else if(saved.compareTimes?.length===1){compareTimes=[saved.compareTimes[0]];await capture('compareA',compareTimes[0]);$('jumpA').textContent=fmt(compareTimes[0])+' ↗';$('jumpA').disabled=false}
 dirty=false;$('save-status').textContent='Сохранено на этом Mac';draw();updateClock();setView('video');$('library-dialog').close();notice(imported?'Импортированный разбор':'Разбор открыт',imported?'Результаты прочитаны из файла и повторно не проверялись. Можно запустить новый анализ.':analysisConfig.slideReviewVersion===1?'Показаны сохранённые видео и измерения. Повторное распознавание не запускалось.':'Открыт разбор прежней версии. Нажмите «Повторить разбор», чтобы применить повторную проверку кадров и разбор фаз движения.');
 }catch(e){showError(e)}finally{uiBusy=false;controls()}
}
$('library-open').onclick=()=>{$('library-dialog').showModal();renderLibrary()};$('library-close').onclick=()=>$('library-dialog').close();
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
$('html-report').onclick=async()=>{
 if(!report||!currentReview||busy||uiBusy)return;uiBusy=true;controls();video.pause();demoPlaying=false;const original=current();
 try{const images=[];for(const [i,slide]of currentReview.slides.entries()){const frames=[];for(const point of slide.frames||(slide.frame?[slide.frame]:[])){const c=document.createElement('canvas');await captureSlideFrame(c,point,slide.type==='attention');frames.push({...point,image:c.toDataURL('image/jpeg',.82)})}images.push(frames);$('progress').textContent=`Готовлю слайд ${i+1}/${currentReview.slides.length}`}
 const html=makeSlideReport(currentReview,{title:$('project-title').value.trim()||'Разбор упражнения',filename:currentFile?.name||'Учебная схема',images});downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),'FormLens-slides.html');$('progress').textContent='Слайды сохранены';
 }catch(e){showError(e)}finally{await seek(original).catch(()=>{});uiBusy=false;draw();updateClock();controls()}
};
window.addEventListener('beforeunload',e=>{if(dirty&&currentFile){e.preventDefault();e.returnValue=''}});

function projectSnapshot(id=projectId||crypto.randomUUID()){return {id,schema:1,appVersion:'0.10.0',title:($('project-title').value.trim()||currentFile.name).slice(0,100),filename:currentFile.name,video:currentFile,type:currentFile.type,duration:duration(),updatedAt:Date.now(),report:structuredClone(report),samples:structuredClone(samples),config:{...analysisConfig,slideIndex},notes:$('project-notes').value,compareTimes:[...compareTimes],currentTime:current(),selectedEvent:selection?report?.events.indexOf(selection):-1,overlays:$('overlays').checked,confirmed:$('confirm').checked,imported}}
$('transfer-cancel').onclick=$('import-cancel').onclick=()=>transferController?.abort();
$('project-export').onclick=async()=>{if(!currentFile||isDemo||busy||uiBusy)return;video.pause();uiBusy=true;transferController=new AbortController();controls();try{const project=projectSnapshot();const file=await exportProjectFile(project,{signal:transferController.signal,onProgress:p=>$('progress').textContent=`Подготовка файла проекта: ${Math.round(p*100)}%`});downloadBlob(file,'FormLens-'+project.id.slice(0,8)+'.formlens');$('progress').textContent='Файл проекта подготовлен для сохранения';notice('Переносимый проект','Файл содержит видео и заметки. Сохраните его отдельно для резервной копии.')}catch(error){if(error.name==='AbortError')$('progress').textContent='Экспорт отменён';else showError(error)}finally{transferController=null;uiBusy=false;controls()}};
$('project-import').onclick=()=>$('project-input').click();
$('project-input').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file||busy||uiBusy)return;uiBusy=true;transferController=new AbortController();controls();$('import-status').textContent='Проверяю файл…';try{const project=await importProjectFile(file,{signal:transferController.signal,onProgress:p=>$('import-status').textContent=`Проверка целостности: ${Math.round(p*100)}%`});if(transferController.signal.aborted)throw new DOMException('Отменено','AbortError');await saveProject(project);$('import-status').textContent='Импортирована отдельная копия. Откройте её из списка; результаты анализа повторно не проверялись.';await renderLibrary()}catch(error){$('import-status').textContent=error.name==='AbortError'?'Импорт отменён. Текущие проекты не изменены.':error.message}finally{transferController=null;uiBusy=false;controls()}};


// Installation is offered only after analysis/transfers finish and IndexedDB commits.
window.formlensPrepareUpdate=()=>prepareUpdate({
 isBusy:()=>busy||uiBusy||!!transferController,
 pause:()=>{video.pause();demoPlaying=false},
 lock:()=>{uiBusy=true;controls()},
 persist:async()=>{if(currentFile&&!isDemo&&dirty){const id=projectId||crypto.randomUUID();await saveProject(projectSnapshot(id));projectId=id;dirty=false;$('save-status').textContent='Сохранено перед обновлением'}},
 unlock:()=>{uiBusy=false;controls()}
});

