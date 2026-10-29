import {measure,CONFIG} from './engine.mjs';
const core=[11,12,23,24];
const visible=p=>p&&p.visibility>=CONFIG.visibility&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
// Cropping is a second attempt at the same source pixels, not enhancement or
// hallucination. Require a known subject and include context around all joints.
export function recoveryCrop(pose,width,height){
 if(!pose||core.filter(i=>visible(pose[i])).length<2)return null;
 const points=[0,11,12,13,14,15,16,23,24,25,26].map(i=>pose[i]).filter(p=>p&&p.visibility>=.4&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 let x=Math.max(0,Math.min(...xs)-.16),y=Math.max(0,Math.min(...ys)-.12),right=Math.min(1,Math.max(...xs)+.16),bottom=Math.min(1,Math.max(...ys)+.12);
 if((right-x)*(bottom-y)>.85||right-x<.2||bottom-y<.25)return null;
 const left=Math.floor(x*width),top=Math.floor(y*height);
 return {x:left,y:top,width:Math.ceil(right*width)-left,height:Math.ceil(bottom*height)-top,sourceWidth:width,sourceHeight:height};
}
export function remapPose(pose,crop){return crop?pose.map(p=>({...p,x:(crop.x+p.x*crop.width)/crop.sourceWidth,y:(crop.y+p.y*crop.height)/crop.sourceHeight})):pose;}
export function selectRecovery(original,measurement,poses,width,height,side){
 if(!original)return null;
 const matches=poses.filter(p=>{
  if(!Array.isArray(p)||p.length!==33)return false;
  const common=core.filter(i=>visible(original[i])&&visible(p[i]));
  return common.length>=2&&Math.sqrt(common.reduce((sum,i)=>sum+(original[i].x-p[i].x)**2+(original[i].y-p[i].y)**2,0)/common.length)<.10;
 });
 // Comparable candidates are not resolved by inventing an identity.
 if(matches.length!==1)return null;
 const pose=matches[0],m=measure([pose],width,height,side);
 if(measurement.valid&&!m.valid||measurement.torsoValid&&!m.torsoValid)return null;
 if(Number(m.valid)+Number(m.torsoValid)<=Number(measurement.valid)+Number(measurement.torsoValid))return null;
 return {pose,measurement:m};
}
