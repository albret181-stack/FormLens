import test from 'node:test';
import assert from 'node:assert/strict';
import {eventAt,eventWindow,reviewRate} from '../app/review.mjs';

const swing={type:'swing',rep:1,t:3,reference:1,end:4};
const report={reps:[{number:1,start:1,end:4}],events:[swing,{type:'unknown',t:5,end:6}]};
test('highlight includes the repetition before its peak, and ends at its boundary',()=>{
 assert.equal(eventAt(1.5,report,10),swing);
 assert.equal(eventAt(.9,report,10),null);
 assert.equal(eventAt(4,report,10),null);
 assert.deepEqual(eventWindow(swing,report,10),{start:1,end:4});
});
test('unknown intervals are never highlighted or slowed as technique errors',()=>{
 assert.equal(eventAt(5.5,report,10),null);
 assert.equal(reviewRate(5.5,report,10,1,true),1);
});
test('automatic slow motion restores chosen speed outside a remark',()=>{
 assert.equal(reviewRate(2,report,10,1,true),.5);
 assert.equal(reviewRate(4.5,report,10,1,true),1);
 assert.equal(reviewRate(2,report,10,1,false),1);
 assert.equal(reviewRate(2,report,10,.25,true),.25);
});
test('missing reports and imported events without a repetition remain usable',()=>{
 assert.equal(eventAt(2,null,10),null);
 assert.deepEqual(eventWindow(swing,{reps:[]},2.5),{start:2.5,end:2.5});
});
