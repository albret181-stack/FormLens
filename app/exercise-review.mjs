import {angle,CONFIG} from './engine.mjs';
import {exerciseById} from './exercises.mjs';
const IDS={left:[11,13,15,23,25,27],right:[12,14,16,24,26,28]};
export const CHECK_LIMITS={knee:15,trunk:18,symmetry:20,'elbow-height':.15}; // Experimental display thresholds, not validated clinical cutoffs.
const good=p=>p&&[p.x,p.y,p.visibility].every(Number.isFinite)&&p.visibility>=CONFIG.visibility&&p.x>=.01&&p.x<=.99&&p.y>=.01&&p.y<=.99;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const q=(values,p)=>Math.min(...values.map(i=>good(p[i])?p[i].visibility:0));
export function exerciseMeasurements(p,width,height){
 if(!Array.isArray(p)||p.length!==33||p.some(v=>!v||![v.x,v.y,v.visibility].every(Number.isFinite)))return null;
 const pts=p.map(v=>({x:v.x*width,y:v.y*height}));const result={};
 for(const [side,ids]of Object.entries(IDS)){
  const [shoulder,elbow,wrist,hip,knee,ankle]=ids;
  const read=(key,joints,fn)=>{if(q(joints,p)>=CONFIG.visibility){const value=fn();if(Number.isFinite(value))result[side+key]={value,q:q(joints,p),ids:joints,side}}};
  read('Knee',[hip,knee,ankle],()=>angle(pts[hip],pts[knee],pts[ankle]));
  read('Hip',[shoulder,hip,knee],()=>angle(pts[shoulder],pts[hip],pts[knee]));
  read('Elbow',[shoulder,elbow,wrist],()=>angle(pts[shoulder],pts[elbow],pts[wrist]));
  read('ElbowHeight',[shoulder,elbow,hip],()=>dist(pts[shoulder],pts[hip])>=height*.055?(pts[shoulder].y-pts[elbow].y)/dist(pts[shoulder],pts[hip]):NaN);
  read('Trunk',[shoulder,hip],()=>dist(pts[shoulder],pts[hip])>=height*.055?Math.atan2(pts[shoulder].x-pts[hip].x,pts[hip].y-pts[shoulder].y)*180/Math.PI:NaN);
 }
 const torso=['left','right'].map(s=>result[s+'Trunk']?dist(pts[IDS[s][0]],pts[IDS[s][3]]):0).reduce((a,b)=>Math.max(a,b),0);
 result.projection=good(p[11])&&good(p[12])&&torso>0?dist(pts[11],pts[12])/torso:null;
 return result;
}
const percentile=(arr,f)=>[...arr].sort((a,b)=>a.value-b.value)[Math.floor((arr.length-1)*f)];
function continuousSegments(rows){const groups=[];let segment=[];for(const row of rows){if(!row||segment.length&&(row.t-segment.at(-1).t>.3||row.side!==segment.at(-1).side||row.scene!==segment.at(-1).scene)){if(segment.length)groups.push(segment);segment=[]}if(row)segment.push(row)}if(segment.length)groups.push(segment);return groups;}
function stableRows(rows){return rows.filter((r,i)=>r&&i>0&&i<rows.length-1&&rows[i-1]&&rows[i+1]&&rows[i-1].side===r.side&&rows[i+1].side===r.side&&r.t-rows[i-1].t<=.2&&rows[i+1].t-r.t<=.2);}
function makeCheck(rows,kind,label,exercise){
 const key=kind==='knee'?'Knee':kind==='trunk'?'Trunk':kind==='elbow-height'?'ElbowHeight':'Elbow';
 const motionKey=kind==='knee'||exercise.id==='cable-kickback'?'Hip':'Elbow';
 const sideScore=side=>{const values=rows.filter(r=>r.m?.[side+key]&&r.m?.[side+motionKey]).map(r=>({value:r.m[side+motionKey].value}));return (values.length>=16?percentile(values,.8).value-percentile(values,.2).value:0)+values.length/1000};
 const side=sideScore('left')>=sideScore('right')?'left':'right';
 const observed=rows.map(row=>{
  const m=row.m;if(!m)return null;
  // Reject an explicitly frontal view for the side-plane checks. Remaining
  // results describe image projections, never validated 3D technique. Bilateral
  // symmetry requires an observable frontal projection and both arms.
  if(kind!=='symmetry'&&kind!=='elbow-height'&&m.projection!=null&&m.projection>.7)return null;
  if(kind==='symmetry'){
   if(m.projection==null||m.projection<.55||!m.leftElbow||!m.rightElbow)return null;
   return {t:row.t,value:Math.abs(m.leftElbow.value-m.rightElbow.value),motion:(m.leftElbow.value+m.rightElbow.value)/2,scene:row.scene,side:'both',ids:[11,13,15,12,14,16],region:row.region};
  }
  const v=m[side+key],motion=kind==='knee'?m[side+'Hip']:exercise.id==='cable-kickback'?m[side+'Hip']:m[side+'Elbow'];
  return v&&motion?{...v,t:row.t,scene:row.scene,motion:motion.value,region:row.region}:null;
 });
 const segments=continuousSegments(observed).map(stableRows);
 const base={kind,label,viewId:rows[0]?.region.id||'full',viewLabel:rows[0]?.region.label||'Видео',status:'unknown',t:rows.find(r=>r.m)?.t??rows[0]?.t??0,ids:[],value:null,threshold:CHECK_LIMITS[kind],coverage:0};
 const long=segments.filter(s=>s.length>=16&&s.at(-1).t-s[0].t>=1.8);
 if(!long.length)return {...base,text:'Не хватает непрерывного участка с видимыми суставами и подходящим ракурсом. Этот признак не оценён.'};
 const eligible=long.filter(stable=>percentile(stable.map(s=>({...s,value:s.motion})),.8).value-percentile(stable.map(s=>({...s,value:s.motion})),.2).value>=15);
 if(!eligible.length)return {...base,text:'Устойчиво распознанного движения недостаточно для проверки. Статичная поза не считается правильным выполнением.'};
 const evaluated=eligible.map(stable=>{const lo=percentile(stable,.2),hi=percentile(stable,.8),value=kind==='symmetry'||kind==='elbow-height'?hi.value:hi.value-lo.value;return {stable,lo,hi,value}});
 // Inspect every eligible interval. A longer clean interval must not hide an
 // independently observed attention interval later in the same view.
 const {stable,lo,hi,value}=evaluated.sort((a,b)=>b.value-a.value)[0],flag=value>CHECK_LIMITS[kind];
 const evidence=kind==='symmetry'||kind==='elbow-height'?hi:stable.reduce((a,b)=>Math.abs(b.value-lo.value)>Math.abs(a.value-lo.value)?b:a);
 base.coverage=eligible.reduce((sum,s)=>sum+s.length,0)/rows.length;
 const titles={knee:['Заметно меняется сгибание колена','Заметного изменения сгибания колена не найдено'],trunk:['Корпус заметно меняет наклон','Заметного изменения наклона корпуса не найдено'],symmetry:['Углы локтей заметно различаются','Заметного различия углов локтей не найдено'],'elbow-height':['Локоть поднимается выше плеча в проекции кадра','Заметного подъёма видимого локтя выше плеча не найдено']};
 const descriptions={'elbow-height':'На доступном движении проверено положение видимого локтя относительно плеча. Наклон камеры и перспектива влияют на это наблюдение; положение второй руки и настройка тренажёра могут остаться неоценёнными.',knee:`Разница устойчивых измерений колена ${value.toFixed(1)}° в проекции камеры. Проверка касается изменения в движении; исходный угол и разные варианты между собой не сравниваются.`,trunk:`Размах наклона корпуса ${value.toFixed(1)}° в проекции камеры. Изменение ракурса и движение камеры могут повлиять на результат.`,symmetry:`Различие углов локтей достигает ${value.toFixed(1)}° на устойчивом участке. Перспектива камеры может создавать такое различие.`};
 return {...base,status:flag?'attention':'observed',title:titles[kind][flag?0:1],text:descriptions[kind]+(flag?' Это возможный момент для проверки, не подтверждённая ошибка.':' Вывод относится только к этому признаку на доступном участке.'),t:evidence.t,reference:lo.t,start:stable[0].t,end:stable.at(-1).t,ids:evidence.ids,region:evidence.region,value,intervals:eligible.map(s=>({start:s[0].t,end:s.at(-1).t}))};
}
export function buildExerciseReview(samples,exerciseId,width,height){
 const exercise=exerciseById(exerciseId),views=new Map();
 for(const sample of samples){const source=sample.views||[{region:{id:'full',label:'Видео',x:0,y:0,width:1,height:1},landmarks:sample.landmarks}];
  for(const v of source){const id=v.region.id;if(!views.has(id))views.set(id,[]);views.get(id).push({t:sample.t,scene:v.scene||0,region:v.region,m:exerciseMeasurements(v.landmarks,width,height),landmarks:v.landmarks})}
 }
 const checks=[];for(const rows of views.values())for(const kind of exercise.checks){const labels={knee:'Сохранение сгибания колена',trunk:'Изменение наклона корпуса',symmetry:'Различие движений рук','elbow-height':'Высота видимого локтя относительно плеча'};checks.push(makeCheck(rows,kind,labels[kind],exercise));}
 const frames=[];for(const [id,rows]of views){const candidates=rows.filter(r=>r.landmarks);if(!candidates.length)continue;for(const f of [.15,.5,.85]){const row=candidates[Math.min(candidates.length-1,Math.floor(candidates.length*f))];frames.push({t:row.t,region:row.region,viewId:id,ids:[],label:row.region.label})}}
 const attention=checks.filter(c=>c.status==='attention'),observed=checks.filter(c=>c.status==='observed'),unknown=checks.filter(c=>c.status==='unknown');
 const partial=checks.filter(c=>c.status!=='unknown'&&c.coverage<.8);
 const slides=[{type:'summary',title:attention.length?'Есть моменты для проверки':observed.length?'Проверены отдельные признаки':checks.length?'Часть движения не удалось оценить':'Кадры упражнения и подсказки по съёмке',text:exercise.name+'. '+(checks.length?`Моментов для проверки: ${attention.length}. Без срабатывания: ${observed.length}. Не оценено: ${unknown.length}.${partial.length?' Часть видео осталась вне проверки.':''}`:'Для этого упражнения пока доступны кадры движения и рекомендации по съёмке.'),frame:frames[0]||{t:0,ids:[]},items:['Отсутствие замечаний не подтверждает правильность всей техники.',views.size>1?'Варианты в разделённом экране относятся к одному упражнению и проверяются отдельно.':'Каждое замечание относится к конкретному видимому участку.']},
  ...checks.filter(c=>c.status!=='unknown').map(c=>({type:c.status,title:c.title,text:c.text,frame:{t:c.t,region:c.region,ids:c.ids,label:c.viewLabel},items:[c.label,c.viewLabel],check:c})),
  ...[...views.values()].filter(rows=>rows.some(r=>r.landmarks)).slice(0,4).map(rows=>({type:'movement',title:rows[0].region.id==='full'?'Ваше движение по кадрам':rows[0].region.label,text:'Изображения взяты из вашего видео. Различия вариантов сами по себе не объявляются ошибками. Процент работы мышц по изображению не измеряется.',frames:frames.filter(f=>f.viewId===rows[0].region.id),items:[]})),
  {type:'limits',title:'Что пока не оценено',text:exercise.limits,items:[...unknown.map(c=>c.viewLabel+': '+c.label+' — '+c.text),...partial.map(c=>c.viewLabel+': '+c.label+' — проверены только отдельные непрерывные участки; остальное движение не оценено.')]},
  {type:'guide',title:'Как снять для более точного разбора',text:exercise.view,items:['В кадре: '+exercise.joints+'.','Закрепите камеру и запишите 3–5 повторений без монтажа.','Если сравниваете варианты, сохраните один тип упражнения для всего файла.']}];
 return {version:1,exerciseId:exercise.id,checks,slides,viewCount:views.size,attention:attention.length,observed:observed.length,unknown:unknown.length,coverage:checks.length?checks.reduce((s,c)=>s+c.coverage,0)/checks.length:0};
}
