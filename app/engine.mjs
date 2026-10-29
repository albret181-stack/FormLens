export const CONFIG={visibility:.75,extended:130,flexed:90,swing:18,minDuration:1,maxDuration:10,sampleHz:8};
export function angle(a,b,c){const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y];const n=Math.hypot(...u)*Math.hypot(...v);return n<1e-6?NaN:Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/n)))*180/Math.PI}
const SIDES={left:[11,13,15,23,25],right:[12,14,16,24,26]};
const NAMES={11:'плечо',12:'плечо',13:'локоть',14:'локоть',15:'кисть',16:'кисть',23:'таз',24:'таз'};
const poseOK=p=>Array.isArray(p)&&p.length===33&&p.every(v=>v&&[v.x,v.y,v.visibility].every(Number.isFinite));
const visible=p=>p&&p.visibility>=CONFIG.visibility&&p.x>=.015&&p.x<=.985&&p.y>=.015&&p.y<=.985;
const missing=(p,ids)=>ids.filter(i=>!visible(p[i])).map(i=>NAMES[i]);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// A small secondary detection must not veto the clearly dominant person. Comparable
// detections remain ambiguous; continuity never silently switches between people.
export function createSubjectTracker(){
 let previous=null,misses=0;
 return {select(poses){
  const candidates=(Array.isArray(poses)?poses:[]).filter(poseOK).map(p=>{
   const core=[0,11,12,13,14,15,16,23,24].map(i=>p[i]).filter(visible);
   if(core.length<3||![11,12].some(i=>visible(p[i])))return null;
   const xs=core.map(v=>v.x),ys=core.map(v=>v.y),area=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));
   return {pose:p,area,center:{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2}};
  }).filter(c=>c&&c.area>.001).sort((a,b)=>b.area-a.area);
  let chosen=candidates[0],reason=candidates.length?'Не удалось однозначно выбрать человека для разбора':'Человек не распознан уверенно';
  if(candidates.length>1){
   if(previous){const near=candidates.filter(c=>distance(c.center,previous.center)<.22&&c.area>previous.area*.35);chosen=near.length===1&&candidates.every(c=>c===near[0]||c.area<near[0].area*.45)?near[0]:null;}
   else if(chosen.area<candidates[1].area*2.5)chosen=null;
  }
  if(chosen&&previous&&distance(chosen.center,previous.center)>.35)chosen=null;
  if(!chosen){if(++misses>=CONFIG.sampleHz)previous=null;return {pose:null,reason}}
  previous=chosen;misses=0;return {pose:chosen.pose,reason:null};
 }};
}

export function measure(poses,width,height,preferredSide){
 if(!Array.isArray(poses)||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return {valid:false,torsoValid:false,reason:'Некорректные данные кадра'};
 if(poses.length!==1)return {valid:false,torsoValid:false,reason:poses.length?'Не удалось однозначно выбрать человека для разбора':'Человек не распознан'};
 const p=poses[0];if(!poseOK(p))return {valid:false,torsoValid:false,reason:'Недостоверные координаты суставов'};
 if(preferredSide&&!SIDES[preferredSide])return {valid:false,torsoValid:false,reason:'Не определена сторона тела'};
 const score=side=>Math.min(...SIDES[side].slice(0,3).map(i=>visible(p[i])?p[i].visibility:0));
 const side=preferredSide&&score(preferredSide)>=CONFIG.visibility?preferredSide:score('left')>=score('right')?'left':'right';
 const ids=SIDES[side],armMissing=missing(p,ids.slice(0,3));
 const pts=p.map(v=>({x:v.x*width,y:v.y*height})),[shoulder,elbow,wrist,hip]=ids;
 const armLength=distance(pts[shoulder],pts[elbow]),forearmLength=distance(pts[elbow],pts[wrist]);
 const elbowAngle=angle(pts[shoulder],pts[elbow],pts[wrist]);
 const armValid=!armMissing.length&&armLength>=height*.03&&forearmLength>=height*.03&&Number.isFinite(elbowAngle);
 const torsoMissing=missing(p,[shoulder,hip]);
 let torsoReason=torsoMissing.length?'Не видны уверенно: '+torsoMissing.join(', '):null;
 const torso=distance(pts[shoulder],pts[hip]);
 const trunk=Math.atan2(pts[shoulder].x-pts[hip].x,pts[hip].y-pts[shoulder].y)*180/Math.PI;
 if(!torsoReason&&torso<height*.12)torsoReason='Корпус слишком мал в кадре для оценки наклона';
 if(!torsoReason&&visible(p[11])&&visible(p[12])&&distance(pts[11],pts[12])/torso>.7)torsoReason='Корпус повёрнут к камере; для наклона нужна съёмка сбоку';
 if(!torsoReason&&Math.abs(trunk)>65)torsoReason='Положение корпуса не подходит для проверки тяги сидя';
 return {valid:armValid,armValid,torsoValid:!torsoReason,side,q:score(side),elbow:armValid?elbowAngle:null,trunk:torsoReason?null:trunk,ids,
  reason:armValid?null:armMissing.length?'Не видны уверенно: '+armMissing.join(', '):'Рука слишком мала или искажена в проекции камеры',torsoReason,missing:armMissing,torsoMissing};
}
const torsoOK=s=>s.torsoValid??(s.valid&&Number.isFinite(s.trunk));
const quantile=(arr,q)=>[...arr].sort((a,b)=>a.trunk-b.trunk)[Math.floor((arr.length-1)*q)];
export function analyze(samples){
 let state='waiting',start=0;const reps=[],events=[];
 const smooth=samples.map((s,i)=>{const n=samples.slice(Math.max(0,i-1),i+2);if(!s.valid||n.some(v=>!v.valid||v.side!==s.side))return s;return {...s,elbow:n.map(x=>x.elbow).sort((a,b)=>a-b)[Math.floor(n.length/2)]}});
 for(let i=0;i<smooth.length;i++){
  const s=smooth[i];if(!s.valid||(i&&(s.t-smooth[i-1].t>.3||s.side!==smooth[i-1].side))){state='waiting';if(!s.valid)continue}
  if(state!=='waiting'&&s.t-smooth[start].t>CONFIG.maxDuration)state='waiting';
  if(state==='waiting'&&s.elbow>=CONFIG.extended){start=i;state='extended'}
  else if(state==='extended'&&s.elbow<=CONFIG.flexed)state='flexed';
  else if(state==='flexed'&&s.elbow>=CONFIG.extended){
   const group=smooth.slice(start,i+1),duration=s.t-smooth[start].t;
   if(duration>=CONFIG.minDuration&&duration<=CONFIG.maxDuration){
    const body=group.filter(torsoOK),continuous=body.every((v,j)=>!j||v.t-body[j-1].t<=.3);
    const torsoEvaluated=body.length>=CONFIG.sampleHz&&body.length/group.length>=.8&&continuous;
    const lo=torsoEvaluated?quantile(body,.2):null,hi=torsoEvaluated?quantile(body,.8):null;
    const peak=group.reduce((a,b)=>a.elbow<b.elbow?a:b),range=torsoEvaluated?hi.trunk-lo.trunk:null;
    const rep={number:reps.length+1,start:group[0].t,end:s.t,range,reference:lo?.t??group[0].t,peak:hi?.t??peak.t,torsoEvaluated,
     elbowMin:Math.min(...group.map(v=>v.elbow)),elbowMax:Math.max(...group.map(v=>v.elbow))};reps.push(rep);
    if(torsoEvaluated&&range>CONFIG.swing)events.push({type:'swing',rep:rep.number,t:hi.t,reference:lo.t,end:s.t,range,title:'Заметное движение корпуса',text:`Размах наклона корпуса ${range.toFixed(1)}° в проекции камеры. Это возможная компенсация движения. Проверьте этот фрагмент; движение камеры также влияет на измерение.`,ids:group[0].ids});
   }start=i;state='extended';
  }
 }
 const valid=samples.filter(s=>s.valid).length,coverage=samples.length?valid/samples.length:0;
 const torsoFrames=samples.filter(torsoOK).length,torsoCoverage=samples.length?torsoFrames/samples.length:0;
 const reasons=new Map();
 const addReason=(scope,reason,t)=>{
  const names=reason.startsWith('Не видны уверенно: ')?reason.slice('Не видны уверенно: '.length).split(', '):null;
  const key=scope+':'+(names?'missing':reason),entry=reasons.get(key)||{scope,reason,frames:0,first:t,...(names?{names:new Set()}: {})};
  entry.frames++;if(names)for(const name of names)entry.names.add(name);reasons.set(key,entry);
 };
 for(const s of samples){
  if(!s.valid&&!torsoOK(s)&&s.reason&&(s.torsoReason||s.reason)===s.reason){addReason('subject',s.reason,s.t);continue}
  if(!s.valid)addReason('arm',s.reason||'Недостоверное распознавание руки',s.t);
  if(!torsoOK(s))addReason('torso',s.torsoReason||s.reason||'Недостоверное распознавание корпуса',s.t);
 }
 let gap=null;
 for(const s of [...samples,{valid:true,torsoValid:true,t:(samples.at(-1)?.t||0)+1/CONFIG.sampleHz}]){
  const missing=!s.valid||!torsoOK(s);
  if(missing&&!gap)gap={t:s.t,reason:s.reason||s.torsoReason||'Недостоверное распознавание'};
  if(!missing&&gap){if(s.t-gap.t>=.375)events.push({type:'unknown',t:gap.t,end:s.t,title:'Ограничение распознавания',text:gap.reason+'. Оценка техники на этом участке ограничена.'});gap=null}
 }
 events.sort((a,b)=>a.t-b.t);
 const visibleArms=samples.filter((s,i)=>{const neighbors=samples.slice(Math.max(0,i-1),i+2);return s.valid&&Number.isFinite(s.elbow)&&neighbors.length===3&&neighbors.every(v=>v.valid&&v.side===s.side&&Math.abs(v.t-s.t)<=.2)});
 const armSide=visibleArms.filter(s=>s.side==='left').length>=visibleArms.filter(s=>s.side==='right').length?'left':'right';
 const arms=visibleArms.filter(s=>s.side===armSide);
 const armMotion=arms.length>=3?{side:armSide,min:Math.min(...arms.map(s=>s.elbow)),max:Math.max(...arms.map(s=>s.elbow)),t:arms.reduce((a,b)=>a.elbow<b.elbow?a:b).t}:null;
 const segments=[];let segment=[];
 for(const s of samples){if(!torsoOK(s)||segment.length&&(s.t-segment.at(-1).t>.3||s.side!==segment.at(-1).side)){if(segment.length)segments.push(segment);segment=[]}if(torsoOK(s))segment.push(s)}if(segment.length)segments.push(segment);
 const longest=segments.filter(g=>g.length>=CONFIG.sampleHz).sort((a,b)=>b.length-a.length)[0];
 const low=longest?quantile(longest,.2):null,high=longest?quantile(longest,.8):null;
 const torsoMotion=longest?{min:low.trunk,max:high.trunk,range:high.trunk-low.trunk,t:high.t,reference:low.t,start:longest[0].t,end:longest.at(-1).t}:null;
 const bodyReps=reps.filter(r=>r.torsoEvaluated).length;
 const status=!reps.length?'Недостаточно данных':events.some(e=>e.type==='swing')?'Есть моменты для проверки':bodyReps<reps.length||coverage<.8?'Частичный разбор движения рук':'Срабатываний правила нет';
 return {reps,events,coverage,torsoCoverage,status,samples:samples.length,valid,torsoFrames,armMotion,torsoMotion,limitations:[...reasons.values()].map(({names,...entry})=>({...entry,...(names?{reason:'В отдельных кадрах не распознаны уверенно: '+[...names].join(', ')}:{})})).sort((a,b)=>b.frames-a.frames),measurementVersion:2};
}
