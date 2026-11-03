import test from 'node:test';import assert from 'node:assert/strict';
import {buildFrameReview,describeFrame} from '../app/frame-review.mjs';
import {selectRecovery,recoveryCrop,remapPose} from '../app/frame-recovery.mjs';
import {analyze,measure,CONFIG} from '../app/engine.mjs';import {demoSample} from '../app/demo.mjs';
const samples=()=>Array.from({length:97},(_,i)=>demoSample(i/8));
test('phase frames are source samples in chronological order and use elbow peak, not torso peak',()=>{
 const s=samples(),r=analyze(s),groups=buildFrameReview(s,r,12);assert.equal(groups.length,3);
 for(const g of groups){assert.equal(g.frames.length,3);assert.ok(g.frames.every(f=>s.some(v=>v.t===f.t)));assert.ok(g.frames[0].t<=g.frames[1].t&&g.frames[1].t<=g.frames[2].t);const segment=s.filter(v=>v.t>=g.start&&v.t<=g.end);assert.equal(s.find(v=>v.t===g.frames[1].t).elbow,Math.min(...segment.map(v=>v.elbow)))}
 assert.ok(groups[1].event);assert.ok(!groups[0].event);
});
test('missing arm frames remain visible as source evidence and never become phase cycles',()=>{
 const s=samples().map(v=>({...v,valid:false,torsoValid:false,trunk:null,reason:'Кисть перекрыта',torsoReason:'Таз перекрыт'})),r=analyze(s),g=buildFrameReview(s,r,12);
 assert.equal(g.length,1);assert.equal(g[0].number,undefined);assert.equal(g[0].frames.length,6);assert.match(g[0].text,/не подтверждены/);assert.match(describeFrame(s[0]),/Кисть перекрыта/);assert.doesNotMatch(describeFrame(s[0]),/Наклон корпуса/);
});
test('an arm-only cycle has explicit skipped torso check, never a zero-angle pass',()=>{
 const s=samples().map(v=>({...v,torsoValid:false,trunk:null,torsoReason:'Таз перекрыт'})),g=buildFrameReview(s,analyze(s),12);
 assert.ok(g.length);assert.equal(g[0].checks[1].result,'не оценено');assert.match(g[0].text,/пропущена/);
});
test('crop coordinates map back to source pixels without changing visibility',()=>{
 const p=samples()[0].landmarks,c={x:100,y:50,width:400,height:300,sourceWidth:1000,sourceHeight:600};const restored=remapPose(p,c);assert.equal(restored[11].visibility,p[11].visibility);assert.equal(restored[11].x,(100+p[11].x*400)/1000);assert.equal(restored[11].y,(50+p[11].y*300)/600);
});
test('recovery never relaxes confidence or loses an already available measurement',()=>{
 const p=structuredClone(demoSample(0).landmarks);p[13].visibility=.1;p[14].visibility=.1;const m=measure([p],960,540);
 assert.equal(m.valid,false);assert.equal(selectRecovery(p,m,[p],960,540),null);
 const recovered=selectRecovery(p,m,[demoSample(0).landmarks],960,540);assert.ok(recovered?.measurement.valid);assert.ok(recovered.measurement.q>=CONFIG.visibility);
 const bad=structuredClone(demoSample(0).landmarks);bad[23].visibility=.1;bad[24].visibility=.1;assert.equal(selectRecovery(p,m,[bad],960,540),null);
});
test('a different or ambiguous person cannot replace the selected subject during recovery',()=>{
 const p=demoSample(0).landmarks,m={valid:false,torsoValid:false};const other=p.map(v=>({...v,x:v.x+.4}));assert.equal(selectRecovery(p,m,[other],960,540),null);assert.equal(selectRecovery(p,m,[p,p],960,540),null);assert.equal(selectRecovery(null,m,[p],960,540),null);
});
test('crop recovery needs visible core identity anchors',()=>{
 const p=demoSample(0).landmarks.map(v=>({...v,visibility:.1}));assert.equal(recoveryCrop(p,960,540),null);
});
import {makeReport} from '../app/report.mjs';
import {exportProjectFile,importProjectFile} from '../app/project-file.mjs';
test('recovered and unmeasured source frames survive portable export with identical provenance',async()=>{
 const s=samples();s[1]={...s[1],valid:false,torsoValid:false,trunk:null,elbow:null,reason:'Перекрыто',torsoReason:'Перекрыто'};s[2].recovery='image';
 const p={schema:1,title:'Test',filename:'a.mp4',notes:'',duration:12,currentTime:0,compareTimes:[],selectedEvent:-1,config:CONFIG,report:analyze(s),samples:s,video:new Blob(['test'],{type:'video/mp4'})};
 const restored=await importProjectFile(await exportProjectFile(p));assert.deepEqual(restored.samples[1].landmarks,s[1].landmarks);assert.equal(restored.samples[2].recovery,'image');
});
test('phase export embeds actual supplied frames and escapes all explanations',()=>{
 const s=samples(),r=analyze(s),groups=buildFrameReview(s,r,12);groups[0].frames[0].description='<script>bad</script>';groups[0].frames[0].image='data:image/jpeg;base64,AA';
 const html=makeReport({title:'Test',filename:'a.mp4',duration:12,report:r,frames:[],config:CONFIG,frameReview:groups});assert.match(html,/Начало цикла/);assert.match(html,/data:image\/jpeg;base64,AA/);assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(!html.includes('<script>bad'));
});
