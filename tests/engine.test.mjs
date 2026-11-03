import test from 'node:test';import assert from 'node:assert/strict';
import {measure,analyze,angle} from '../app/engine.mjs';import {demoSample} from '../app/demo.mjs';
const demo=()=>Array.from({length:97},(_,i)=>demoSample(i/8));
test('three full cycles, one swing in second repetition',()=>{const r=analyze(demo());assert.equal(r.reps.length,3);assert.equal(r.events.filter(x=>x.type==='swing').length,1);assert.equal(r.events[0].rep,2);assert.ok(r.events[0].range>18)});
test('occlusion yields unknown, never a technique verdict',()=>{const r=analyze(demo().map(s=>({...s,valid:false,reason:'Occluded'})));assert.equal(r.status,'Недостаточно данных');assert.equal(r.reps.length,0);assert.equal(r.events[0].type,'unknown')});
test('gap prevents bridging two partial repetitions',()=>{const s=demo().slice(0,33);s[16]={...s[16],valid:false,reason:'Occluded'};const r=analyze(s);assert.equal(r.reps.length,0)});
test('a single landmark spike does not create a swing',()=>{const s=demo().slice(0,33);s[15].trunk=60;assert.equal(analyze(s).events.length,0)});
test('static arm angle cannot confirm a repetition or technique',()=>{const s=demo().map(s=>({...s,elbow:150}));const r=analyze(s);assert.equal(r.reps.length,0);assert.equal(r.events.filter(e=>e.type==='swing').length,0);assert.match(r.status,/Частичный/) });
test('no people, multiple people, invisible joints are rejected',()=>{assert.equal(measure([],960,540).valid,false);assert.equal(measure([[],[]],960,540).valid,false);const p=demoSample(0).landmarks;p[13].visibility=.1;p[14].visibility=.1;assert.equal(measure([p],960,540).valid,false)});
test('angles use pixels and reject zero-length segments',()=>{assert.equal(angle({x:1,y:0},{x:0,y:0},{x:0,y:1}),90);assert.ok(Number.isNaN(angle({x:0,y:0},{x:0,y:0},{x:1,y:0})))});
test('all empty input insufficient',()=>assert.equal(analyze([]).status,'Недостаточно данных'));

