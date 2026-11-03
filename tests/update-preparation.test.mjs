import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareUpdate} from '../app/update-preparation.mjs';
test('installation preparation waits for storage commit and locks concurrent work',async()=>{
 let resolve,locked=false;const events=[];const saved=new Promise(r=>resolve=r);
 const options={isBusy:()=>locked,pause:()=>events.push('pause'),lock:()=>{locked=true;events.push('lock')},persist:async()=>{await saved;events.push('committed')},unlock:()=>{locked=false;events.push('unlock')}};
 const first=prepareUpdate(options);assert.deepEqual(events,['pause','lock']);await assert.rejects(prepareUpdate(options),/Дождитесь/);assert.equal(locked,true);resolve();await first;assert.deepEqual(events,['pause','lock','committed','unlock']);assert.equal(locked,false);
});
test('storage failure aborts preparation and releases the UI lock',async()=>{
 let locked=false;await assert.rejects(prepareUpdate({isBusy:()=>false,pause:()=>{},lock:()=>locked=true,persist:async()=>{throw Error('quota')},unlock:()=>locked=false}),/Установка не начата/);assert.equal(locked,false);
});
test('active analysis or transfer is refused before pausing, locking or saving',async()=>{
 await assert.rejects(prepareUpdate({isBusy:()=>true,pause:()=>assert.fail(),lock:()=>assert.fail(),persist:()=>assert.fail(),unlock:()=>assert.fail()}),/Дождитесь/);
});
