'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/farm-core.js');
const {createRoaming,pickDestination}=require('../src/pc-ranch-free-roam.js');
function mon(id){return {instanceId:id,name:'코로몬',hp:300,maxHp:300,hunger:0,
 fatigue:0,friendship:20,training:0,atk:7,def:5,spd:7,exp:0};}
function scene(){const s={day:3,food:8,ropes:2,points:0,logs:[],team:[mon('a')]};core.ensure(s);return s;}
function simulate(s,n){for(let i=0;i<n;i++)core.advance(s,.05);}
test('disabled mode preserves the exact existing farm simulation',()=>{
 const s=scene();s.facilities={training:true};
 const unchanged=JSON.parse(JSON.stringify(s));
 const ext=createRoaming(core);
 try{simulate(s,100);ext.restore();simulate(unchanged,100);
  assert.deepEqual(s,unchanged);
 }finally{ext.restore();}
});
test('only unlocked peripheral areas receive ambient strolls',()=>{
 const s=scene(),a=s.farm.actors.a;a.idleTime=3;
 const ext=createRoaming(core);try{
  ext.set(true);assert.equal(ext.prepare(s,.05),0,'no unlocked zone');
  s.facilities={training:true};assert.equal(ext.prepare(s,.05),1);
  assert.equal(a.goal.zone,'training');assert.equal(a.goal.kind,'wander');
  assert.ok(core.foodGround(s,a.goal.x,a.goal.y));
  assert.equal(s.team[0].training,0);assert.equal(s.points,0);
 }finally{ext.restore();}
});
test('living stroll follows existing route without any bonus',()=>{
 const s=scene();s.facilities={training:true};
 const ext=createRoaming(core);try{
  ext.set(true);s.farm.actors.a.idleTime=3;
  const dest=pickDestination(core,s,s.team[0],s.farm.actors.a);
  assert.equal(dest.zone,'training');
  let reached=false;
  for(let i=0;i<850;i++){
   core.advance(s,.05);
   const a=s.farm.actors.a;
   assert.ok(core.walkable(s,a.x,a.y),'must stay on existing walkable tiles/routes');
   if(Math.hypot(a.x-dest.x,a.y-dest.y)<.8){reached=true;break;}
  }
  assert.equal(reached,true,'ambient target was not reached');
  assert.equal(s.team[0].training,0);assert.equal(s.points,0);
  assert.equal(s.team[0].atk,7);assert.equal(s.team[0].def,5);
 }finally{ext.restore();}
});
test('manual orders, rest and food priority cannot be overridden',()=>{
 const s=scene();s.facilities={training:true};
 const ext=createRoaming(core);try{
  ext.set(true);core.command(s,'a','attack');
  assert.equal(ext.prepare(s,.05),0);
  assert.equal(s.farm.actors.a.goal.kind,'attack');
  core.command(s,'a','stop');s.farm.actors.a.idleTime=3;s.team[0].fatigue=85;
  assert.equal(ext.prepare(s,.05),0,'fatigue rest has priority');
  s.team[0].fatigue=0;s.team[0].hunger=50;
  core.placeFood(s,50,65);
  assert.equal(ext.prepare(s,.05),0,'available meal has priority');
 }finally{ext.restore();}
});
test('stored, lost and egg actors cannot roam; pause/failed delta are unchanged',()=>{
 const s=scene();s.facilities={training:true};s.farm.actors.a.idleTime=3;
 const ext=createRoaming(core);try{
  ext.set(true);
  for(const field of ['egg','lost','location']){
   s.team[0][field]=field==='location'?'storage':true;
   assert.equal(ext.prepare(s,.05),0,field);
   delete s.team[0][field];
  }
  s.world.paused=true;assert.equal(ext.prepare(s,.05),0);
  s.world.paused=false;assert.equal(ext.prepare(s,-1),0);
  assert.equal(s.farm.actors.a.goal??null,null);
 }finally{ext.restore();}
});
test('roaming remains deterministic across JSON save/reload and mode disable',()=>{
 const s=scene();s.facilities={training:true,rest:true,garden:true};
 const ext=createRoaming(core);try{
  ext.set(true);s.farm.actors.a.idleTime=3;
  simulate(s,60);const copy=JSON.parse(JSON.stringify(s));
  simulate(s,250);simulate(copy,250);
  assert.deepEqual(s,copy,'same save must replay to identical result');
  ext.set(false);const before=JSON.stringify(s);
  assert.equal(ext.prepare(s,.05),0);
  assert.equal(JSON.stringify(s),before);
 }finally{ext.restore();}
});
