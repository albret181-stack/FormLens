export const LAYOUTS=[['auto','Определить по кадру'],['single','Обычное видео'],['stacked2','Два варианта сверху / снизу'],['side2','Два варианта слева / справа'],['stacked3','Три варианта сверху вниз'],['four','Четыре области']];
const full=[{id:'full',label:'Видео',x:0,y:0,width:1,height:1}];
const templates={single:full,stacked2:[{id:'top',label:'Верхний вариант',x:0,y:0,width:1,height:.5},{id:'bottom',label:'Нижний вариант',x:0,y:.5,width:1,height:.5}],side2:[{id:'left',label:'Левый вариант',x:0,y:0,width:.5,height:1},{id:'right',label:'Правый вариант',x:.5,y:0,width:.5,height:1}],stacked3:[0,1,2].map(i=>({id:'row'+i,label:'Вариант '+(i+1),x:0,y:i/3,width:1,height:1/3})),four:[0,1,2,3].map(i=>({id:'quadrant'+i,label:'Область '+(i+1),x:i%2/2,y:Math.floor(i/2)/2,width:.5,height:.5}))};
const visible=p=>p&&p.visibility>=.75&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
export function regionsForFrame(poses,layout='auto'){
 if(layout!=='auto')return templates[layout]||full;
 const boxes=(poses||[]).map(p=>{
  const core=[11,12,23,24].map(i=>p?.[i]).filter(visible),all=[0,11,12,13,14,15,16,23,24,25,26,27,28].map(i=>p?.[i]).filter(visible);
  if(core.length<3||all.length<5)return null;
  const xs=all.map(p=>p.x),ys=all.map(p=>p.y);return {x:core.reduce((s,p)=>s+p.x,0)/core.length,y:core.reduce((s,p)=>s+p.y,0)/core.length,left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
 }).filter(Boolean);
 // Only infer a panel layout when source poses occupy distinct halves. Actual
 // background people are not ranked as separate exercises or judged together.
 if(boxes.length===2){const [a,b]=boxes;
  if(Math.abs(a.y-b.y)>.26&&Math.abs(a.x-b.x)<.25&&boxes.some(v=>v.bottom<=.53)&&boxes.some(v=>v.top>=.47))return templates.stacked2;
  if(Math.abs(a.x-b.x)>.27&&Math.abs(a.y-b.y)<.23&&boxes.some(v=>v.right<=.53)&&boxes.some(v=>v.left>=.47))return templates.side2;
 }
 if(boxes.length===3&&Math.max(...boxes.map(b=>b.x))-Math.min(...boxes.map(b=>b.x))<.2){const sorted=[...boxes].sort((a,b)=>a.y-b.y);if(sorted[0].bottom<.38&&sorted[1].top>.28&&sorted[1].bottom<.72&&sorted[2].top>.61)return templates.stacked3;}
 if(boxes.length===4&&boxes.every(b=>b.right-b.left<.5&&b.bottom-b.top<.5)&&new Set(boxes.map(b=>Math.floor(b.x*2)+2*Math.floor(b.y*2))).size===4)return templates.four;
 return full;
}
export function regionPixels(region,width,height){const x=Math.floor(region.x*width),y=Math.floor(region.y*height);return {x,y,width:Math.ceil((region.x+region.width)*width)-x,height:Math.ceil((region.y+region.height)*height)-y,sourceWidth:width,sourceHeight:height};}
export function mapFromRegion(pose,region){return pose?.map(p=>({...p,x:region.x+p.x*region.width,y:region.y+p.y*region.height}));}

export function chooseClipLayout(detected){const counts=new Map();for(const regions of detected){const ids=regions.map(r=>r.id).join(',');const match=Object.entries(templates).find(([id,rs])=>id!=='single'&&rs.map(r=>r.id).join(',')===ids);if(match)counts.set(match[0],(counts.get(match[0])||0)+1)}if(counts.size!==1)return 'auto';const [id,count]=[...counts][0];return count>=2?id:'auto';}
