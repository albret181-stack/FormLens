// Conservative visual discontinuity check. A reset only removes eligibility;
// it never invents an exercise error or repairs unseen movement.
export function isSceneCut(previous,current){
 if(!previous||previous.length!==current.length||current.length<64)return false;
 let sum=0,changed=0,pixels=0;
 for(let i=0;i<current.length;i+=4){const delta=(Math.abs(current[i]-previous[i])+Math.abs(current[i+1]-previous[i+1])+Math.abs(current[i+2]-previous[i+2]))/3;sum+=delta;if(delta>48)changed++;pixels++;}
 return sum/pixels>25&&changed/pixels>.35;
}
export class SceneTracker{
 constructor(){this.previous=null;this.scene=0;}
 update(pixels){if(isSceneCut(this.previous,pixels))this.scene++;this.previous=new Uint8ClampedArray(pixels);return this.scene;}
}
