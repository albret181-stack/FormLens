import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
// Official model version 1, pinned rather than the mutable /latest download.
const URL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
export const POSE_MODEL_SHA='5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function preparePoseModel(){
 const file=path.resolve('models/pose_landmarker_full.task');let existing;
 try{existing=await readFile(file)}catch(error){if(error.code!=='ENOENT')throw error}
 if(existing){if(digest(existing)!==POSE_MODEL_SHA)throw Error('MediaPipe Full checksum mismatch');return file}
 const response=await fetch(URL,{signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error('Could not retrieve the pinned MediaPipe Full model');
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>16*1024*1024)throw Error('Unexpected model size');chunks.push(Buffer.from(chunk))}
 const bytes=Buffer.concat(chunks);if(digest(bytes)!==POSE_MODEL_SHA)throw Error('MediaPipe Full checksum mismatch');
 await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',bytes);await rename(file+'.tmp',file);return file;
}
