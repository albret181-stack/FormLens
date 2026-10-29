importScripts('/node_modules/@mediapipe/tasks-vision/vision_bundle.js');
const {FilesetResolver,PoseLandmarker}=Vision;
let model;
self.onmessage=async({data})=>{try{
 if(data.type==='init'){
 const vision=await FilesetResolver.forVisionTasks('/node_modules/@mediapipe/tasks-vision/wasm');
 model=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'/models/pose_landmarker_full.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.65,minPosePresenceConfidence:.65,minTrackingConfidence:.65});
 self.postMessage({type:'ready',model:'MediaPipe Pose Full v1'});
 }else{try{const result=model.detectForVideo(data.bitmap,data.t*1000);self.postMessage({type:'result',poses:result.landmarks,t:data.t});}finally{data.bitmap.close()}}
 }catch(e){self.postMessage({type:'error',message:String(e.message||e)})}};
