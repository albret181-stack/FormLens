export const CONFIG={visibility:.75,extended:130,flexed:90,swing:18,minDuration:1,maxDuration:10,sampleHz:8};
export function angle(a,b,c){const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y];const n=Math.hypot(...u)*Math.hypot(...v);return n<1e-6?NaN:Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/n)))*180/Math.PI}
export function measure(poses,width,height,side){
 if(!Array.isArray(poses)||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return {valid:false,reason:'Некорректные данные кадра'};
 if(poses.length!==1)return {valid:false,reason:poses.length?'В кадре несколько людей':'Человек не распознан'};
 const p=poses[0];if(!Array.isArray(p)||p.length!==33||p.some(v=>!v||![v.x,v.y,v.visibility].every(Number.isFinite)))return {valid:false,reason:'Недостоверные координаты суставов'};
 if(side&&!['left','right'].includes(side))return {valid:false,reason:'Не определена сторона тела'};
 const sides={left:[11,13,15,23,25],right:[12,14,16,24,26]};
 const score=ids=>Math.min(...ids.map(i=>p[i]?.visibility??0));
 side=side|| (score(sides.left)>=score(sides.right)?'left':'right');const ids=sides[side];
 const q=score(ids);if(q<CONFIG.visibility||ids.some(i=>!p[i]||p[i].x<.015||p[i].x>.985||p[i].y<.015||p[i].y>.985))return {valid:false,reason:'Суставы перекрыты или вне кадра',side};
 const pts=p.map(v=>({x:v.x*width,y:v.y*height}));const [shoulder,elbow,wrist,hip]=ids;
 const torso=Math.hypot(pts[shoulder].x-pts[hip].x,pts[shoulder].y-pts[hip].y);
 if(torso<height*.12)return {valid:false,reason:'Человек слишком далеко от камеры',side};
 if(p[11].visibility>.75&&p[12].visibility>.75&&Math.hypot(pts[11].x-pts[12].x,pts[11].y-pts[12].y)/torso>.7)return {valid:false,reason:'Нужна съёмка сбоку',side};
 const trunk=Math.atan2(pts[shoulder].x-pts[hip].x,pts[hip].y-pts[shoulder].y)*180/Math.PI;
 const elbowAngle=angle(pts[shoulder],pts[elbow],pts[wrist]);
 if(!Number.isFinite(elbowAngle)||Math.abs(trunk)>65)return {valid:false,reason:'Поза не подходит для анализа тяги сидя',side};
 return {valid:true,side,q,elbow:elbowAngle,trunk,ids};
}
const quantile=(arr,q)=>[...arr].sort((a,b)=>a.trunk-b.trunk)[Math.floor((arr.length-1)*q)];
export function analyze(samples){
 let state='waiting',start=0,reps=[],events=[];
 // Median removes isolated landmark jumps; no smoothing across recognition gaps.
 const smooth=samples.map((s,i)=>{const n=samples.slice(Math.max(0,i-1),i+2);if(!s.valid||n.some(v=>!v.valid))return s;return {...s,elbow:n.map(x=>x.elbow).sort((a,b)=>a-b)[Math.floor(n.length/2)]}});
 for(let i=0;i<smooth.length;i++){
  const s=smooth[i];if(!s.valid||(i&&s.t-smooth[i-1].t>.3)){state='waiting';continue}
  if(state!=='waiting'&&s.t-smooth[start].t>CONFIG.maxDuration)state='waiting';
  if(state==='waiting'&&s.elbow>=CONFIG.extended){start=i;state='extended'}
  else if(state==='extended'&&s.elbow<=CONFIG.flexed)state='flexed';
  else if(state==='flexed'&&s.elbow>=CONFIG.extended){
   const group=smooth.slice(start,i+1),duration=s.t-smooth[start].t;
   if(duration>=CONFIG.minDuration&&duration<=CONFIG.maxDuration){
    const lo=quantile(group,.2),hi=quantile(group,.8),range=hi.trunk-lo.trunk;
    const rep={number:reps.length+1,start:group[0].t,end:s.t,range,reference:lo.t,peak:hi.t};reps.push(rep);
    if(range>CONFIG.swing)events.push({type:'swing',rep:rep.number,t:hi.t,reference:lo.t,end:s.t,range,title:'Заметное движение корпуса',text:`Размах наклона корпуса ${range.toFixed(1)}° в проекции камеры. Это возможная компенсация движения. Попробуйте снизить вес и повторить тягу с более стабильным корпусом.`,ids:group[0].ids});
   }start=i;state='extended';
  }
 }
 const valid=samples.filter(s=>s.valid).length,coverage=samples.length?valid/samples.length:0;
 // Persist missing-data intervals; do not label these repetitions as correct.
 let gap=null;
 for(const s of [...samples,{valid:true,t:(samples.at(-1)?.t||0)+.125}]){
  if(!s.valid&&!gap)gap={t:s.t,reason:s.reason};
  if(s.valid&&gap){if(s.t-gap.t>=.375)events.push({type:'unknown',t:gap.t,end:s.t,title:'Недостаточно данных',text:gap.reason+'. Снимите сбоку, закрепите камеру и оставьте суставы открытыми.'});gap=null}
 }
 events.sort((a,b)=>a.t-b.t);
 return {reps,events,coverage,status:coverage<.8||!reps.length?'Недостаточно данных':events.some(e=>e.type==='swing')?'Есть моменты для проверки':'Срабатываний правила нет',samples: samples.length,valid};
}
