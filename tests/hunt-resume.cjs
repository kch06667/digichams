'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('../src/hunt-core.js');
function saved(){
 const s=H.encounter({name:'아구몬',stage:'성장기',diff:5},()=>.5);
 return {version:1,encounter:s,arm:false};
}
test('wild, tied and stunned sessions can resume without copying a mutable save object',()=>{
 const s=saved(),one=H.restoreSession(s);
 assert.equal(one.encounter.name,'아구몬');
 assert.notEqual(one.encounter,s.encounter);
 s.encounter.hp=1;assert.equal(one.encounter.hp,one.encounter.maxHp);
 s.encounter.hp=one.encounter.hp;
 assert.equal(H.bind(s.encounter),true);
 s.arm=true;
 const tied=H.restoreSession(s);
 assert.equal(tied.encounter.mode,'tied');assert.equal(tied.arm,false);
 s.encounter.hp=0;s.encounter.mode='stunned';
 assert.equal(H.restoreSession(s).encounter.mode,'stunned');
});
test('captured or escaped hunt never resumes and never generates an extra Digimon',()=>{
 for(const phase of ['captured','escaped']){
  const s=saved();s.encounter.mode=phase;
  assert.equal(H.restoreSession(s),null);
 }
 const e=saved().encounter;
 H.bind(e);e.hp=0;e.mode='stunned';
 assert.equal(H.capture(e),true);
 assert.equal(H.capture(e),false);
 assert.equal(H.restoreSession({version:1,encounter:e}),null);
});
test('invalid version, impossible vitals and forged data cannot be revived',()=>{
 let s=saved();
 for(const bad of [
  {...s,version:2},
  {...s,encounter:{...s.encounter,hp:Infinity}},
  {...s,encounter:{...s.encounter,hp:-1}},
  {...s,encounter:{...s.encounter,maxHp:0}},
  {...s,encounter:{...s.encounter,time:1e15}},
  {...s,encounter:{...s.encounter,mode:'stunned'}},
  {...s,encounter:{...s.encounter,x:-10}},
  {...s,encounter:{...s.encounter,vx:Infinity}},
  {...s,encounter:{...s.encounter,ropeSpent:true}},
  {...s,encounter:{...s.encounter,name:''}},
  {...s,encounter:{...s.encounter,stage:null}},
  {...s,encounter:{...s.encounter,pulls:-1}},
  {...s,encounter:{...s.encounter,bait:100}}
 ])assert.equal(H.restoreSession(bad),null,JSON.stringify(bad).slice(0,100));
});
test('tied encounter preserves remaining countdown and cost when resuming',()=>{
 const e=saved().encounter;
 H.bind(e);H.tick(e,.15);const before=e.time;
 const savedState=JSON.parse(JSON.stringify({version:1,encounter:e,arm:false}));
 const restored=H.restoreSession(savedState);
 assert.equal(restored.encounter.time,before);
 assert.equal(restored.encounter.ropeSpent,true);
 assert.equal(H.bind(restored.encounter),false);
 assert.equal(H.pull(restored.encounter,{x:.5,y:.5},{x:.3,y:.5}).ok,true);
});
