'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const farm=require('../src/farm-core.js');

function state(actors,facilities={}){
 return {
  day:1,food:5,ropes:3,points:0,logs:[],facilities,
  team:[{instanceId:'a',name:'코로몬',hp:400,maxHp:400,hunger:0,fatigue:0,friendship:0,training:0,atk:8,def:7,spd:7,exp:0}],
  farm:{actors:{a:{...actors}},foods:[],nextFood:1,completed:0}
 };
}
test('off-map old save recovers without changing stats or resources',()=>{
 const s=state({x:9999,y:9999,mode:'moving',pose:2,remaining:3,
  goal:{x:50,y:-76,zone:'training',kind:'attack'},routeKey:'stale',route:[{x:999,y:999}]},{training:true});
 const before={hp:s.team[0].hp,training:s.team[0].training,points:s.points,food:s.food};
 farm.ensure(s);
 const a=s.farm.actors.a;
 assert.ok(farm.walkable(s,a.x,a.y),'recovered actor on unlocked ground');
 assert.equal(a.mode,'moving');
 assert.equal(a.route,null);assert.equal(a.routeKey,null);
 assert.deepEqual({hp:s.team[0].hp,training:s.team[0].training,points:s.points,food:s.food},before);
 farm.advance(s,12);
 assert.ok(s.team[0].training>0,'preserved order should continue after repositioning');
});
test('in-progress training keeps its cycle and cannot pay for teleport recovery',()=>{
 const s=state({x:-1000,y:1000,mode:'acting',pose:32,remaining:5,station:0,
  goal:{x:50,y:-76,zone:'training',kind:'attack'}},{training:true});
 farm.ensure(s);const a=s.farm.actors.a;
 assert.equal(a.mode,'moving');assert.equal(a.repositioning,true);
 assert.equal(a.remaining,5);assert.equal(s.farm.completed,0);
 for(let i=0;i<600&&a.mode!=='acting';i++)farm.step(s,.05);
 assert.equal(a.mode,'acting','old action reaches a valid station');
 assert.equal(a.remaining,5,'unfinished cycle resumes, never completes early');
 assert.equal(s.farm.completed,0);
 farm.step(s,.05);assert.equal(s.farm.completed,0);
});
test('non-finite and missing coordinates recover to real ground',()=>{
 for(const [x,y] of [[Infinity,25],[NaN,NaN],[null,90],[undefined,undefined],[-900,-900]]){
  const s=state({x,y,mode:'idle',pose:0});
  farm.ensure(s);const a=s.farm.actors.a;
  assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
  assert.ok(farm.walkable(s,a.x,a.y));
  assert.equal(a.mode,'idle');
 }
});
test('valid actors remain byte-for-byte unaffected by the migration',()=>{
 const orig={x:50,y:-76,mode:'acting',pose:32,remaining:.85,station:0,
  goal:{x:50,y:-76,zone:'training',kind:'attack'},idleTime:.1,autoRest:true};
 const s=state(orig,{training:true});farm.ensure(s);
 assert.deepEqual(s.farm.actors.a,orig);
 farm.ensure(s);assert.deepEqual(s.farm.actors.a,orig,'ensure repeated is a no-op');
});
test('unreachable old command is safely cancelled instead of becoming stuck',()=>{
 const s=state({x:999,y:999,mode:'moving',remaining:0,goal:{x:9999,y:9999,kind:'attack'},route:[{x:9999,y:9999}]});
 farm.ensure(s);const a=s.farm.actors.a;
 assert.equal(a.mode,'idle');assert.equal(a.goal,null);
 assert.ok(farm.walkable(s,a.x,a.y));assert.equal(s.points,0);
});
test('recovered JSON states simulate deterministically',()=>{
 const s=state({x:2000,y:-3000,mode:'moving',goal:{x:25,y:35,zone:'core',kind:'attack'}});
 const restored=JSON.parse(JSON.stringify(s));
 farm.advance(s,7);farm.advance(restored,7);
 assert.deepEqual(restored,s);
});
