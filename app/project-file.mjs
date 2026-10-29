// FLENS001: 48-byte header + JSON manifest + original video bytes.
// SHA-256 checks integrity only; it does not authenticate analysis results.
const MAGIC=new TextEncoder().encode('FLENS001');
export const LIMITS={video:500*1024*1024,manifest:8*1024*1024,chunk:4*1024*1024,header:48};
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const text=(v,max)=>typeof v==='string'&&v.length<=max;
const hash=async data=>new Uint8Array(await crypto.subtle.digest('SHA-256',data));
const hex=data=>Array.from(data,b=>b.toString(16).padStart(2,'0')).join('');
function aborted(signal){if(signal?.aborted)throw new DOMException('Перенос отменён','AbortError')}
function check(condition,message='Файл содержит некорректные данные разбора.'){if(!condition)throw new Error(message)}
export function validateMetadata(p){
 check(p&&p.schema===1,'Эта версия проекта не поддерживается.');
 check(text(p.title,100)&&text(p.filename,255)&&text(p.notes||'',4000));
 check(number(p.duration,1,60)&&number(p.currentTime||0,0,p.duration));
 check(Array.isArray(p.compareTimes)&&p.compareTimes.length<=2&&p.compareTimes.every(t=>number(t,0,p.duration)));
 check(p.config&&number(p.config.sampleHz,1,60)&&number(p.config.swing,0,180)&&number(p.config.visibility,0,1));
 check(Array.isArray(p.samples)&&p.samples.length<=3600);
 let last=-1;
 for(const s of p.samples){check(number(s.t,0,p.duration)&&s.t>last&&typeof s.valid==='boolean');last=s.t;
  if(s.torsoValid!==undefined)check(typeof s.torsoValid==='boolean'&&(s.torsoValid?number(s.trunk,-180,180):s.trunk==null));
  if(s.valid)check(number(s.elbow,0,180)&&number(s.q,0,1)&&(s.torsoValid===false?s.trunk==null:number(s.trunk,-180,180)));
  if(s.valid||s.torsoValid){check(Array.isArray(s.ids)&&s.ids.length===5&&s.ids.every(i=>Number.isInteger(i)&&i>=0&&i<33));check(Array.isArray(s.landmarks)&&s.landmarks.length===33&&s.landmarks.every(v=>v&&number(v.x,-10,10)&&number(v.y,-10,10)&&number(v.visibility,0,1)))}
  if(!s.valid)check(text(s.reason||'',500));if(s.torsoReason!=null)check(text(s.torsoReason,500));
 }
 if(p.report!==null){const r=p.report;check(r&&number(r.coverage,0,1)&&text(r.status,200)&&Array.isArray(r.reps)&&r.reps.length<=120&&Array.isArray(r.events)&&r.events.length<=1000);let lastEnd=-1;
  r.reps.forEach((rep,i)=>{check(rep.number===i+1&&number(rep.start,0,p.duration)&&number(rep.end,rep.start,p.duration+.25)&&rep.start>=lastEnd&&(rep.torsoEvaluated===false?rep.range===null:number(rep.range,0,360))&&number(rep.reference,rep.start,rep.end)&&number(rep.peak,rep.start,rep.end));if(rep.torsoEvaluated!==undefined)check(typeof rep.torsoEvaluated==='boolean');if(rep.elbowMin!==undefined)check(number(rep.elbowMin,0,180)&&number(rep.elbowMax,rep.elbowMin,180));lastEnd=rep.end});
  if(r.measurementVersion!==undefined){check(r.measurementVersion===2&&number(r.torsoCoverage,0,1)&&Number.isInteger(r.samples)&&r.samples===p.samples.length&&number(r.torsoFrames,0,r.samples));check(Array.isArray(r.limitations)&&r.limitations.length<=30);for(const l of r.limitations)check(['arm','torso','subject'].includes(l.scope)&&text(l.reason,500)&&Number.isInteger(l.frames)&&number(l.frames,1,r.samples)&&number(l.first,0,p.duration));if(r.torsoMotion!=null)check(number(r.torsoMotion.min,-180,180)&&number(r.torsoMotion.max,r.torsoMotion.min,180)&&number(r.torsoMotion.range,0,360)&&number(r.torsoMotion.t,0,p.duration)&&number(r.torsoMotion.reference,0,p.duration)&&number(r.torsoMotion.start,0,p.duration)&&number(r.torsoMotion.end,r.torsoMotion.start,p.duration));if(r.armMotion!==null)check(r.armMotion&&number(r.armMotion.min,0,180)&&number(r.armMotion.max,r.armMotion.min,180)&&number(r.armMotion.t,0,p.duration));}
  for(const e of r.events){check(['swing','unknown'].includes(e.type)&&number(e.t,0,p.duration)&&number(e.end,e.t,p.duration+.25)&&text(e.title,300)&&text(e.text,3000));if(e.type==='swing')check(Number.isInteger(e.rep)&&e.rep>=1&&e.rep<=r.reps.length&&number(e.reference,0,p.duration)&&number(e.range,0,360));}
 }
 check(p.report!==null||p.samples.length===0,'В проекте есть точки без завершённого анализа.');
 check(Number.isInteger(p.selectedEvent)&&p.selectedEvent>=-1&&p.selectedEvent<(p.report?.events.length||0));
 return p;
}
function metadata(project){return validateMetadata({schema:1,appVersion:project.appVersion||'unknown',title:project.title,filename:project.filename,type:project.type||project.video?.type||'',duration:project.duration,report:project.report??null,samples:project.samples||[],config:project.config,notes:project.notes||'',compareTimes:project.compareTimes||[],currentTime:project.currentTime||0,selectedEvent:project.selectedEvent??-1,overlays:project.overlays!==false,confirmed:!!project.confirmed})}
export async function exportProjectFile(project,{signal,onProgress=()=>{}}={}){
 aborted(signal);check(project.video instanceof Blob&&project.video.size>0&&project.video.size<=LIMITS.video,'Размер видео должен быть от 1 байта до 500 МБ.');
 const data=metadata(project),hashes=[];const total=Math.ceil(project.video.size/LIMITS.chunk);
 for(let i=0;i<total;i++){aborted(signal);hashes.push(hex(await hash(await project.video.slice(i*LIMITS.chunk,(i+1)*LIMITS.chunk).arrayBuffer())));onProgress((i+1)/total)}
 aborted(signal);const manifest=encoder.encode(JSON.stringify({format:1,videoBytes:project.video.size,chunkSize:LIMITS.chunk,hashes,project:data}));check(manifest.byteLength<=LIMITS.manifest,'Слишком много данных в проекте.');
 const header=new Uint8Array(LIMITS.header);header.set(MAGIC);new DataView(header.buffer).setUint32(8,manifest.length);header.set(await hash(manifest),16);aborted(signal);
 return new Blob([header,manifest,project.video],{type:'application/octet-stream'});
}
export async function importProjectFile(file,{signal,onProgress=()=>{}}={}){
 aborted(signal);check(file instanceof Blob&&file.size>=LIMITS.header&&file.size<=LIMITS.header+LIMITS.manifest+LIMITS.video,'Неверный размер файла проекта.');
 const header=new Uint8Array(await file.slice(0,LIMITS.header).arrayBuffer());check(MAGIC.every((b,i)=>header[i]===b),'Это не поддерживаемый файл .formlens.');check(header.slice(12,16).every(b=>b===0),'Версия заголовка проекта не поддерживается.');const length=new DataView(header.buffer).getUint32(8);check(length>0&&length<=LIMITS.manifest&&file.size>=LIMITS.header+length,'Повреждён заголовок проекта.');
 const bytes=new Uint8Array(await file.slice(LIMITS.header,LIMITS.header+length).arrayBuffer());const digest=await hash(bytes);check(digest.every((b,i)=>b===header[16+i]),'Повреждены данные проекта: контрольная сумма не совпадает.');
 let manifest;try{manifest=JSON.parse(decoder.decode(bytes))}catch{throw new Error('Не удалось прочитать описание проекта.')}
 check(manifest.format===1,'Версия формата проекта не поддерживается.');check(manifest.chunkSize===LIMITS.chunk&&number(manifest.videoBytes,1,LIMITS.video)&&Number.isInteger(manifest.videoBytes));check(file.size===LIMITS.header+length+manifest.videoBytes,'Видео в проекте обрезано или содержит лишние данные.');
 const chunks=Math.ceil(manifest.videoBytes/LIMITS.chunk);check(Array.isArray(manifest.hashes)&&manifest.hashes.length===chunks&&manifest.hashes.every(v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v)));
 const p=validateMetadata(manifest.project);check(text(p.type,100)&&(!p.type||/^video\/[a-z0-9.+-]+$/i.test(p.type)),'Неподдерживаемый тип видео.');const video=file.slice(LIMITS.header+length,file.size,p.type||'video/mp4');
 for(let i=0;i<chunks;i++){aborted(signal);check(hex(await hash(await video.slice(i*LIMITS.chunk,(i+1)*LIMITS.chunk).arrayBuffer()))===manifest.hashes[i],`Повреждён фрагмент видео ${i+1}. Импорт остановлен.`);onProgress((i+1)/chunks)}
 aborted(signal);const filename=p.filename.split(/[\\/]/).at(-1)||'video.mp4';
 return {...p,id:crypto.randomUUID(),title:(p.title+' — импорт').slice(0,100),filename,video,updatedAt:Date.now(),imported:true};
}
