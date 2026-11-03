// Every explanation refers to an observed frame. No ideal pose or missing joint
// is generated. Review is derived on opening, including for saved older projects.
const bodyOK=s=>s.torsoValid??(s.valid&&Number.isFinite(s.trunk));
const supported=(samples,i)=>samples[i].valid&&samples.slice(Math.max(0,i-1),i+2).filter(s=>s.valid&&s.side===samples[i].side&&Math.abs(s.t-samples[i].t)<=.2).length>=3;
export function describeFrame(sample){
 if(!sample)return 'Измерений этого кадра нет.';
 const parts=[];
 parts.push(sample.valid?`Локоть ${Math.round(sample.elbow)}°.`:`Рука не оценена: ${sample.reason||'суставы не распознаны уверенно'}.`);
 parts.push(bodyOK(sample)?`Наклон корпуса ${sample.trunk.toFixed(1)}° в проекции кадра.`:`Корпус не оценён: ${sample.torsoReason||sample.reason||'недостаточно данных'}.`);
 if(sample.recovery)parts.push('Суставы повторно проверены по отдельному изображению.');
 return parts.join(' ');
}
export function buildFrameReview(samples,report,duration){
 const groups=[];
 for(const rep of report.reps.slice(0,8)){
  const segment=samples.filter(s=>s.t>=rep.start&&s.t<=rep.end&&s.valid);
  if(segment.length<3)continue;
  const bent=segment.reduce((a,b)=>a.elbow<b.elbow?a:b);
  const frames=[{t:segment[0].t,label:'Начало цикла'},{t:bent.t,label:'Максимальное сгибание'},{t:segment.at(-1).t,label:'Возврат'}];
  const evaluated=rep.torsoEvaluated??Number.isFinite(rep.range),event=report.events.find(e=>e.type==='swing'&&e.rep===rep.number);
  groups.push({number:rep.number,start:rep.start,end:rep.end,frames,event,
   title:`Цикл руки ${rep.number}`,
   text:evaluated?`Размах наклона корпуса ${rep.range.toFixed(1)}°. ${event?'Превышен экспериментальный порог: проверьте движение корпуса на этом фрагменте.':'Экспериментальный порог движения корпуса не превышен.'}`:'Цикл руки виден. Проверка движения корпуса пропущена: недостаточно непрерывных измерений плеча и таза.',
   checks:[{label:'Сгибание и возврат руки',result:'видны в проекции камеры'},{label:'Изменение наклона корпуса',result:evaluated?`${rep.range.toFixed(1)}° · ${event?'есть момент для проверки':'порог не превышен'}`:'не оценено'},{label:'Положение позвоночника, нагрузка и работа тренажёра',result:'не оцениваются этой моделью'}]});
 }
 if(!groups.length&&samples.length){
  const frames=[];
  // Keep chronological context, including frames the pose model cannot measure.
  // Prefer neighbor-supported measurements within each time bin, never copy a
  // different moment to cover an occlusion or interpolate a missing joint.
  const count=Math.min(6,samples.length);
  for(let bin=0;bin<count;bin++){
   const start=bin*samples.length/count,end=(bin+1)*samples.length/count;
   const indexes=Array.from({length:Math.ceil(end)-Math.ceil(start)},(_,j)=>Math.ceil(start)+j);
   const middle=(start+end-1)/2;
   indexes.sort((a,b)=>{
    const score=i=>(supported(samples,i)?4:0)+(bodyOK(samples[i])?2:0);
    return score(b)-score(a)||Math.abs(a-middle)-Math.abs(b-middle);
   });
   const s=samples[indexes[0]];if(s)frames.push({t:s.t,label:`Момент ${bin+1}`});
  }
  groups.push({title:'Движение по кадрам',start:0,end:duration,frames,text:'Полный цикл сгибания и возврата руки не выделен. Кадры ниже показывают фактическое движение и доступные измерения; технические ошибки по ним не подтверждены.',checks:[]});
 }
 return groups;
}
