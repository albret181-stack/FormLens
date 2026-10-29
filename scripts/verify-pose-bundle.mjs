import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {POSE_MODEL_SHA} from './setup-model.mjs';
const file=path.resolve('../build/FormLens-darwin-arm64/FormLens.app/Contents/Resources/app/models/pose_landmarker_full.task');
if(createHash('sha256').update(await readFile(file)).digest('hex')!==POSE_MODEL_SHA)throw Error('Packaged pose model is missing or differs from the pinned model');
console.log('Pinned MediaPipe Full model is included for offline analysis');
