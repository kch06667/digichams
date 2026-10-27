'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const farm=require('../src/farm-core.js');
function state(){return {day:1,food:5,ropes:2,points:0,logs:[],team:[{instanceId:'a',name:'코로몬',hp:50,maxHp:50,hunger:20,fatigue:0,friendship:20,training:0,atk:7,def:5,spd:7,exp:0}]};}
test('off-map and locked-tile food placement preserves inventory',()=>{
 const s=state();for(const [x,y] of [[-200,-160],[1000,1000],[50,-76],[154,-18]])assert.equal(farm.placeFood(s,x,y),false);
 assert.equal(s.food,5);assert.equal(s.farm.foods.length,0);
});
test('central and purchased-tile meals are consumed at requested coordinates',()=>{
 for(const [x,y,facilities] of [[50,65,{}],[50,-76,{training:true}],[154,-18,{track:true}]]){
  const s=state();s.facilities=facilities;assert.equal(farm.placeFood(s,x,y),true);assert.equal(s.farm.foods[0].x,x);assert.equal(s.farm.foods[0].y,y);
  farm.advance(s,20);assert.equal(s.farm.foods.length,0);assert.equal(s.food,4);
 }
});
test('a free facility makes a queued actor walk, never teleport or reward early',()=>{
 const s=state();farm.ensure(s);const a=s.farm.actors.a;Object.assign(a,{x:13,y:25,mode:'waiting',waitPosition:{x:13,y:25},goal:{x:25,y:35,kind:'attack',zone:'core'}});
 const before={x:a.x,y:a.y};farm.step(s,.05);assert.ok(Math.hypot(a.x-before.x,a.y-before.y)<=farm.CFG.moveSpeed*.05+1e-9);assert.equal(a.mode,'moving');assert.equal(s.team[0].training,0);
 farm.advance(s,4);assert.ok(s.team[0].training>0);
});
test('stored actors do not occupy a facility or block active training',()=>{
 const s=state();for(const id of ['stored1','stored2'])s.team.push({...s.team[0],instanceId:id,location:'storage'});farm.ensure(s);
 for(const id of ['stored1','stored2'])Object.assign(s.farm.actors[id],{mode:'acting',goal:{x:25,y:35,kind:'attack',zone:'core'}});
 farm.command(s,'a','attack');farm.advance(s,6);assert.ok(s.team[0].training>0);
});
test('two facility users occupy distinct action points and a third waits',()=>{
 const s=state();s.facilities={training:true};s.team.push({...s.team[0],instanceId:'b'},{...s.team[0],instanceId:'c'});
 for(const m of s.team)farm.command(s,m.instanceId,'attack');farm.advance(s,12);
 const acting=Object.values(s.farm.actors).filter(a=>a.mode==='acting');assert.equal(acting.length,2);assert.ok(Math.hypot(acting[0].x-acting[1].x,acting[0].y-acting[1].y)>=30);assert.equal(s.farm.actors.c.mode,'waiting');
 farm.command(s,'a','stop');farm.advance(s,8);assert.ok(s.team[2].training>0);
});
test('travel between outer facilities stays on open ground or connecting paths',()=>{
 const s=state();s.facilities={training:true,rest:true};farm.ensure(s);Object.assign(s.farm.actors.a,{x:-54,y:118});farm.command(s,'a','attack');
 for(let i=0;i<400;i++){farm.step(s,.05);const a=s.farm.actors.a;assert.ok(farm.walkable(s,a.x,a.y));if(a.mode==='acting')break;}
 assert.equal(s.farm.actors.a.mode,'acting');
});
test('save mid-route resumes identically without duplicate rewards',()=>{
 const s=state();s.facilities={training:true};farm.command(s,'a','attack');farm.advance(s,4);const restored=JSON.parse(JSON.stringify(s));farm.advance(s,12);farm.advance(restored,12);assert.deepEqual(restored,s);
});
test('old overlapping acting save moves second user before finishing its cycle',()=>{
 const s=state();s.facilities={training:true};s.team.push({...s.team[0],instanceId:'b'});farm.ensure(s);
 for(const a of Object.values(s.farm.actors))Object.assign(a,{x:50,y:-76,mode:'acting',remaining:.5,goal:{x:50,y:-76,zone:'training',kind:'attack'}});
 farm.step(s,.05);assert.equal(s.farm.actors.b.mode,'moving');assert.equal(s.team[1].training,0);farm.advance(s,1);assert.equal(s.team[1].training,0);farm.advance(s,3);assert.ok(s.team[1].training>0);assert.ok(Math.abs(s.farm.actors.a.x-s.farm.actors.b.x)>=30);
});
test('shared expanded attack/defense queues reserve unique positions',()=>{
 const s=state();s.facilities={training:true};for(let i=0;i<5;i++)s.team.push({...s.team[0],instanceId:'b'+i});
 for(const [i,m] of s.team.entries())farm.command(s,m.instanceId,i%2?'attack':'defense');farm.advance(s,14);
 const active=Object.values(s.farm.actors),waiting=active.filter(a=>a.mode==='waiting');assert.equal(active.filter(a=>a.mode==='acting').length,2);assert.equal(waiting.length,4);assert.equal(new Set(waiting.map(a=>JSON.stringify(a.waitPosition))).size,4);
 for(const a of waiting)assert.ok(farm.foodGround(s,a.waitPosition.x,a.waitPosition.y));
});

test('legacy off-map actor is recovered without losing training order or granting early rewards',()=>{
 const s=state();farm.ensure(s);farm.command(s,'a','attack');
 Object.assign(s.farm.actors.a,{x:9999,y:-9999,mode:'acting',remaining:2,station:0});
 farm.ensure(s);const a=s.farm.actors.a;
 assert.ok(farm.walkable(s,a.x,a.y));assert.equal(a.mode,'moving');
 assert.equal(a.goal.kind,'attack');assert.equal(s.team[0].training,0);
 farm.step(s,.05);assert.equal(s.team[0].training,0);
});
test('legacy off-map idle actor is moved back to an accessible tile',()=>{
 const s=state();farm.ensure(s);Object.assign(s.farm.actors.a,{x:NaN,y:Infinity,mode:'idle'});
 farm.ensure(s);assert.ok(farm.walkable(s,s.farm.actors.a.x,s.farm.actors.a.y));
});
