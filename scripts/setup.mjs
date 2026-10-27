import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const url='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
await mkdir('models',{recursive:true});
try {await readFile('models/pose_landmarker_lite.task')} catch {const r=await fetch(url);if(!r.ok)throw new Error('Model download failed: '+r.status);await writeFile('models/pose_landmarker_lite.task',Buffer.from(await r.arrayBuffer()))}
const bytes=await readFile('models/pose_landmarker_lite.task');const digest=createHash('sha256').update(bytes).digest('hex');if(digest!=='59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a')throw new Error('Unexpected model checksum: '+digest);console.log('Model checksum verified:',digest);
