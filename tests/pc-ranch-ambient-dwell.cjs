'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/farm-core.js');
const {createRoaming,activitySnapshot}=require('../src/pc-ranch-free-roam.js');

function newSave(){
 const s={day:3,food:6,ropes:2,points:0,logs:[],
  facilities:{training:true,rest:true,garden:true},
  team:[{instanceId:'pause-a',name:'코로몬',hp:100,maxHp:100,
   hunger:0,fatigue:0,training:0,atk:7,def:5,spd:7,exp:0,friendship:20}]};
 core.ensure(s);
 return s;
}
function arrive(s){
 const a=s.farm.actors['pause-a'];
 a.idleTime=3;
 for(let i=0;i<1200;i++){
  core.advance(s,.05);
  if(a.mode==='idle'&&a.idleTime<0)return a;
 }
 assert.fail('ambient walker did not arrive and start a dwell');
}
test('native idle GIF plays while visiting unlocked area; no fake training',()=>{
 const s=newSave(),roam=createRoaming(core);
 try{
  roam.set(true);
  const a=arrive(s);
  assert.equal(a.pose,0,'original idle GIF pose must be used');
  assert.equal(a.goal,null,'no ghost goal while lingering');
  assert.ok(a.idleTime<=-3 && a.idleTime>=-6,'bounded arrival dwell');
  const snap=activitySnapshot(s);
  assert.equal(snap.dwelling,1);
  assert.equal(snap.roaming,0);
  assert.equal(s.team[0].training,0);
  assert.equal(s.points,0);
  assert.equal(s.team[0].atk,7);
  assert.equal(s.team[0].def,5);
 }finally{roam.restore();}
});
test('one glance flips the original mirrored idle sprite exactly once',()=>{
 const s=newSave(),roam=createRoaming(core);
 try{
  roam.set(true);
  const a=arrive(s);
  let turns=0,last=a.face;
  for(let i=0;i<150;i++){
   core.advance(s,.05);
   if(a.face!==last){turns++;last=a.face;}
   if(a.mode!=='idle'||a.idleTime>=0)break;
  }
  assert.equal(turns,1,'the native idle animation should glance only once');
 }finally{roam.restore();}
});
test('food and original rest supersede peaceful lingering immediately',()=>{
 const s=newSave(),roam=createRoaming(core);
 try{
  roam.set(true);let a=arrive(s);
  s.team[0].hunger=32;
  assert.ok(core.placeFood(s,50,62));
  core.advance(s,.05);
  assert.equal(a.goal?.kind,'eat','hungry Digimon must receive original food claim');
  assert.equal(s.farm.foods[0].claim,'pause-a');
  core.command(s,'pause-a','stop');
  // Same original idle state, but urgent health must preempt ambience.
  a.idleTime=-4;s.team[0].fatigue=73;
  core.advance(s,.05);
  assert.equal(a.goal?.kind,'rest','existing care has priority over lingering');
 }finally{roam.restore();}
});
test('manual commands replace dwell and old center wander gets no added pause',()=>{
 const s=newSave(),roam=createRoaming(core);
 try{
  roam.set(true);const a=arrive(s);
  assert.ok(core.command(s,'pause-a','attack'));
  assert.equal(a.goal.kind,'attack');
  assert.equal(a.mode,'moving');
  core.command(s,'pause-a','stop');
  a.goal={x:25,y:31,kind:'wander'};a.mode='moving';a.x=25;a.y=31;
  core.advance(s,.05);
  assert.equal(a.mode,'idle');
  assert.ok(a.idleTime>=0,'legacy roam should never receive new dwelling time');
 }finally{roam.restore();}
});
test('a JSON backup made mid-pause produces deterministic future gaze',()=>{
 const s=newSave(),roam=createRoaming(core);
 try{
  roam.set(true);const a=arrive(s);
  const copy=JSON.parse(JSON.stringify(s));
  assert.equal(copy.farm.actors['pause-a'].idleTime,a.idleTime);
  const initial=copy.farm.actors['pause-a'].face;
  let glanced=false;
  for(let i=0;i<120;i++){
   core.advance(s,.05);core.advance(copy,.05);
   if(s.farm.actors['pause-a'].mode==='idle' &&
      s.farm.actors['pause-a'].idleTime>-1.95){
    glanced=true;break;
   }
  }
  assert.ok(glanced,'the saved pause must reach its glance frame');
  assert.deepEqual(copy,s,'saved idleTime and face must resume identically');
  assert.notEqual(s.farm.actors['pause-a'].face,initial);
 }finally{roam.restore();}
});
test('free roam disabled never inserts pause, and game pause freezes dwell',()=>{
 const s=newSave(),roam=createRoaming(core);
 try{
  roam.set(true);const a=arrive(s);
  const before=a.idleTime;
  s.world.paused=true;
  core.advance(s,.15);
  assert.equal(a.idleTime,before);
  s.world.paused=false;
  roam.set(false);
  core.advance(s,.05);
  assert.ok(a.idleTime>before,'legacy counter continues after opt-out');
  assert.equal(roam.prepare(s,.05),0);
 }finally{roam.restore();}
});
