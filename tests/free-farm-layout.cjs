'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const f=require('../src/free-farm-layout.js');
test('initial free placement has valid non-overlapping facilities',()=>{assert.equal(f.validate(f.initial()),true);});
test('map blueprint roundtrip preserves positions',()=>{const before=f.initial();assert.deepEqual(f.fromJSON(JSON.stringify(f.serialize(before))),before);});
test('rejects overlapping, outside map, unsupported facility and duplicate ids',()=>{
 const a=f.initial();assert.equal(f.validate([...a,{id:20,kind:'food',x:a[0].x,y:a[0].y}]),false);
 assert.equal(f.validate([...a,{id:20,kind:'food',x:5,y:5}]),false);
 assert.equal(f.validate([...a,{id:20,kind:'unknown',x:1800,y:1000}]),false);
 assert.equal(f.validate([...a,{id:1,kind:'food',x:1800,y:1000}]),false);
});
test('read-only roster projection does not mutate original game save',()=>{
 const s={team:[{instanceId:'a',name:'아구몬'},{instanceId:'b',name:'가부몬',location:'storage'}]};
 const snapshot=JSON.stringify(s);assert.deepEqual(f.rosterFromSave(s),[{id:'a',name:'아구몬'}]);assert.equal(JSON.stringify(s),snapshot);
});
