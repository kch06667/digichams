'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const farm=require('../src/farm-core.js');
function state(){return {day:1,food:5,ropes:2,points:0,logs:[],team:[{instanceId:'a',name:'코로몬',hp:50,maxHp:50,hunger:20,fatigue:0,friendship:20,training:0,atk:7,def:5,spd:7,exp:0}]};}
test('off-map and locked-tile food placement preserves inventory',()=>{
 const s=state();
 for(const [x,y] of [[-200,-160],[1000,1000],[50,-76],[154,-18]]){
  assert.equal(farm.placeFood(s,x,y),false,`must reject ${x},${y}`);
 }
 assert.equal(s.food,5);assert.equal(s.farm.foods.length,0);
});
test('central and purchased-tile meals are consumed at requested coordinates',()=>{
 for(const [x,y,facilities] of [[50,65,{}],[50,-76,{training:true}],[154,-18,{track:true}]]){
  const s=state();s.facilities=facilities;
  assert.equal(farm.placeFood(s,x,y),true);
  assert.equal(s.farm.foods[0].x,x);assert.equal(s.farm.foods[0].y,y);
  farm.advance(s,20);assert.equal(s.farm.foods.length,0);assert.equal(s.food,4);
 }
});
test('a free facility makes a queued actor walk, never teleport or reward early',()=>{
 const s=state();farm.ensure(s);
 const a=s.farm.actors.a;
 Object.assign(a,{x:13,y:25,mode:'waiting',waitPosition:{x:13,y:25},goal:{x:25,y:35,kind:'attack',zone:'core'}});
 const before={x:a.x,y:a.y};farm.step(s,.05);
 assert.ok(Math.hypot(a.x-before.x,a.y-before.y)<=farm.CFG.moveSpeed*.05+1e-9);
 assert.equal(a.mode,'moving');assert.equal(s.team[0].training,0);
 farm.advance(s,4);assert.ok(s.team[0].training>0);
});
test('stored actors do not occupy a facility or block active training',()=>{
 const s=state();
 for(const id of ['stored1','stored2'])s.team.push({...s.team[0],instanceId:id,location:'storage'});
 farm.ensure(s);
 for(const id of ['stored1','stored2'])Object.assign(s.farm.actors[id],{mode:'acting',goal:{x:25,y:35,kind:'attack',zone:'core'}});
 farm.command(s,'a','attack');farm.advance(s,6);
 assert.ok(s.team[0].training>0);
});
