'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const farm=require('../src/farm-core.js');
function scene(points){
 const s={day:1,food:5,ropes:2,points:0,logs:[],team:points.map((_,i)=>({instanceId:String(i),name:'코로몬',hp:500,maxHp:500,hunger:0,fatigue:0,training:0,exp:0,atk:7,def:5,spd:7,friendship:0}))};
 farm.ensure(s);points.forEach(([x,y,tx,ty],i)=>Object.assign(s.farm.actors[String(i)],{x,y,mode:'moving',goal:{x:tx,y:ty,kind:'wander'}}));return s;
}
function simulate(s,seconds){
 let closest=Infinity;const arrived=new Set();
 for(let i=0;i<seconds*20;i++){
  const before=Object.values(s.farm.actors).map(a=>({x:a.x,y:a.y}));
  farm.step(s,.05);
  const as=Object.values(s.farm.actors);
  as.forEach((a,j)=>{assert.ok(Math.hypot(a.x-before[j].x,a.y-before[j].y)<=.800001,'speed cap');assert.ok(farm.walkable(s,a.x,a.y),'on ground');if(a.mode==='idle'){arrived.add(j);a.idleTime=-100;}});
  for(let j=0;j<as.length;j++)for(let k=j+1;k<as.length;k++)closest=Math.min(closest,Math.hypot(as[j].x-as[k].x,as[j].y-as[k].y));
 }
 return {closest,arrived};
}
test('head-on walkers pass without overlap or deadlock',()=>{const s=scene([[20,55,80,55],[80,55,20,55]]);const r=simulate(s,12);assert.ok(r.closest>=9.99);assert.equal(r.arrived.size,2);});
test('crossing walkers keep separation and finish',()=>{const s=scene([[20,50,80,50],[50,20,50,80]]);const r=simulate(s,12);assert.ok(r.closest>=9.99);assert.equal(r.arrived.size,2);});
test('stationary training actor is not pushed or rewarded by passing traffic',()=>{
 const s=scene([[20,35,80,35],[50,35,50,35]]);const a=s.farm.actors['1'];Object.assign(a,{mode:'acting',goal:{x:50,y:35,zone:'core',kind:'cage'},station:0,remaining:100});
 const r=simulate(s,12);assert.ok(r.closest>=9.99);assert.ok(r.arrived.has(0));assert.equal(a.x,50);assert.equal(a.y,35);assert.equal(s.team[1].training,0);
});
test('avoidance survives JSON save and reload deterministically',()=>{const s=scene([[20,55,80,55],[80,55,20,55]]);farm.advance(s,1.5);const copy=JSON.parse(JSON.stringify(s));farm.advance(s,10);farm.advance(copy,10);assert.deepEqual(copy,s);});
test('head-on traffic passes through the narrow central-training connector',()=>{const s=scene([[50,20,50,-65],[50,-65,50,20]]);s.facilities={training:true};const r=simulate(s,20);assert.ok(r.closest>=9.99);assert.equal(r.arrived.size,2);});
test('four-way traffic eventually reaches all four distinct destinations',()=>{const s=scene([[20,50,80,50],[80,50,20,50],[50,20,50,80],[50,80,50,20]]);const r=simulate(s,20);assert.ok(r.closest>=9.99);assert.equal(r.arrived.size,4);});
test('an idle actor yields an occupied destination without changing training orders',()=>{const s=scene([[20,55,65,55],[65,55,65,55]]);Object.assign(s.farm.actors['1'],{mode:'idle',goal:null,idleTime:-100});const r=simulate(s,15);assert.ok(r.closest>=9.99);assert.ok(r.arrived.has(0));assert.equal(s.team[1].training,0);});
test('initially overlapping movers separate and complete their orders',()=>{const s=scene([[50,50,20,50],[50,50,80,50],[50,50,50,20]]);const r=simulate(s,15);assert.equal(r.arrived.size,3);const as=Object.values(s.farm.actors);for(let i=0;i<as.length;i++)for(let j=i+1;j<as.length;j++)assert.ok(Math.hypot(as[i].x-as[j].x,as[i].y-as[j].y)>=10);});
