'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/farm-core.js');
const {createRoaming,pickDestination,activitySnapshot,needsRest}
 =require('../src/pc-ranch-free-roam.js');

function mon(id){
 return {instanceId:id,name:'코로몬',hp:100,maxHp:100,
  fatigue:0,hunger:0,friendship:20,training:0,atk:7,def:5,spd:7,exp:0};
}
function scene(ids=['a']){
 const s={day:4,food:10,ropes:2,points:0,logs:[],team:ids.map(mon),
  facilities:{training:true,rest:true,garden:true,forest:true}};
 core.ensure(s);
 return s;
}
function tick(s,n){for(let i=0;i<n;i++)core.advance(s,.05);}

test('low-energy walkers prefer real unlocked quiet plots, no stat bonus',()=>{
 const s=scene(),a=s.farm.actors.a;
 s.team[0].fatigue=48;a.idleTime=3;
 const target=pickDestination(core,s,s.team[0],a);
 assert.equal(target.zone,'rest','high but noncritical fatigue prefers rest plot');
 assert.equal(target.kind,'wander');
 assert.equal(needsRest(s.team[0]),false);
 const roam=createRoaming(core);
 try{
  roam.set(true);roam.prepare(s,.05);
  assert.equal(a.goal.zone,'rest');
  assert.equal(a.goal.kind,'wander','quiet-zone visit is not forced healing');
  assert.equal(s.team[0].fatigue,48);
  assert.equal(s.team[0].training,0);
  assert.equal(s.points,0);
 }finally{roam.restore();}
});
test('moderate fatigue visits garden if owned; closed quiet plots are excluded',()=>{
 const s=scene(),a=s.farm.actors.a;
 s.team[0].fatigue=31;
 assert.equal(pickDestination(core,s,s.team[0],a).zone,'garden');
 s.facilities.garden=false;
 assert.equal(pickDestination(core,s,s.team[0],a).zone,'rest');
 s.facilities.rest=false;
 const after=pickDestination(core,s,s.team[0],a);
 assert.ok(['training','forest'].includes(after.zone),after.zone);
 assert.ok(core.foodGround(s,after.x,after.y));
});
test('critical fatigue interrupts an AMBIENT walk using original rest command',()=>{
 const s=scene(),a=s.farm.actors.a;
 const roam=createRoaming(core);
 try{
  roam.set(true);a.idleTime=3;
  assert.equal(roam.prepare(s,.05),1);
  assert.equal(a.goal.kind,'wander');assert.ok(a.goal.zone);
  s.team[0].fatigue=70;
  assert.equal(roam.prepare(s,.05),1);
  assert.equal(a.goal.kind,'rest');
  assert.equal(a.goal.zone,'rest','original unlocked rest facility is used');
  assert.equal(a.mode,'moving');
  const before=s.team[0].fatigue;
  tick(s,360);
  assert.ok(s.team[0].fatigue<before,'native rest cycles must heal fatigue');
  assert.equal(s.team[0].training,0);
  assert.equal(s.points,0);
 }finally{roam.restore();}
});
test('critical HP interrupts only extension-origin wander, never manual training',()=>{
 const s=scene(),a=s.farm.actors.a,roam=createRoaming(core);
 try{
  roam.set(true);a.idleTime=3;roam.prepare(s,.05);
  s.team[0].hp=36;
  assert.equal(roam.prepare(s,.05),1);
  assert.equal(a.goal.kind,'rest');
  core.command(s,'a','defense');
  s.team[0].hp=20;
  const g={...a.goal};
  assert.equal(roam.prepare(s,.05),0);
  assert.deepEqual(a.goal,g,'explicit training is not overwritten by extension');
 }finally{roam.restore();}
});
test('existing food reservation AI interrupts a roaming Digimon with no double spend',()=>{
 const s=scene(),a=s.farm.actors.a,roam=createRoaming(core);
 try{
  roam.set(true);a.idleTime=3;roam.prepare(s,.05);
  const oldGoal=a.goal;
  assert.equal(core.placeFood(s,50,62),true);
  const food=s.farm.foods[0],inventory=s.food;
  s.team[0].hunger=22;
  core.advance(s,.05);
  assert.equal(a.goal.kind,'eat');
  assert.equal(a.foodId,food.id);
  assert.equal(food.claim,'a');
  assert.notEqual(a.goal,oldGoal);
  assert.equal(s.food,inventory,'food was charged once on placement');
  assert.equal(s.farm.foods.length,1,'food waits for actual eating');
  tick(s,150);
  assert.equal(s.farm.foods.length,0);
  assert.equal(s.food,inventory,'eating must not charge food again');
  assert.ok(s.team[0].hunger<22);
 }finally{roam.restore();}
});
test('two walkers reserve separate future goals before either moves',()=>{
 const s=scene(['a','b']),roam=createRoaming(core);
 try{
  roam.set(true);
  for(const a of Object.values(s.farm.actors))a.idleTime=3;
  assert.equal(roam.prepare(s,.05),2);
  const [a,b]=['a','b'].map(id=>s.farm.actors[id]);
  assert.equal(a.goal.kind,'wander');assert.equal(b.goal.kind,'wander');
  assert.ok(Math.hypot(a.goal.x-b.goal.x,a.goal.y-b.goal.y)>=18,
   'two moving actors must not reserve the same landing place');
 }finally{roam.restore();}
});
test('UI snapshot reads only existing live activities and never alters state',()=>{
 const s=scene(['a','b','c','d','e']);
 const a=s.farm.actors;
 a.a.goal={kind:'wander',zone:'forest',x:50,y:198};
 a.b.goal={kind:'eat',x:50,y:35};
 a.c.goal={kind:'rest',x:-54,y:118};
 a.d.goal={kind:'attack',zone:'training',x:50,y:-76};
 const old=JSON.stringify(s);
 assert.deepEqual(activitySnapshot(s),{
  roaming:1,eating:1,resting:1,training:1,other:1,zoneCounts:{forest:1}
 });
 assert.equal(JSON.stringify(s),old);
});
test('old core wander is preserved and optional mode OFF cannot redirect',()=>{
 const s=scene(),a=s.farm.actors.a;
 a.goal={kind:'wander',x:25,y:31};
 a.mode='moving';
 s.team[0].fatigue=88;
 const roam=createRoaming(core);
 try{
  roam.set(true);
  assert.equal(roam.prepare(s,.05),0);
  assert.equal(a.goal.kind,'wander');
  assert.equal(a.goal.zone,undefined);
  roam.set(false);
  a.goal=null;a.mode='idle';a.idleTime=3;
  const before=JSON.stringify(s);
  assert.equal(roam.prepare(s,.05),0);
  assert.equal(JSON.stringify(s),before);
 }finally{roam.restore();}
});
test('an already-roaming JSON save resumes deterministically with native needs',()=>{
 const s=scene(),roam=createRoaming(core);
 try{
  roam.set(true);s.farm.actors.a.idleTime=3;roam.prepare(s,.05);
  const old=JSON.parse(JSON.stringify(s));
  old.team[0].fatigue=s.team[0].fatigue=68;
  tick(s,320);tick(old,320);
  assert.deepEqual(old,s);
 }finally{roam.restore();}
});
