'use strict';
const assert=require('node:assert/strict');
const farm=require('../src/farm-core.js');
const mon=(id='mon-1')=>({instanceId:id,name:'코로몬',hp:50,maxHp:50,atk:7,def:5,spd:7,hunger:20,fatigue:0,training:0,exp:0,friendship:20,level:1});
const initial=()=>({day:1,food:5,ropes:2,points:0,logs:[],team:[mon()]});
const results=[];
function test(name,cb){try{cb();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',message:e.message});}}
test('first migration and unique actor',()=>{const s=initial();farm.ensure(s);assert.equal(s.saveVersion,3);assert.ok(s.farm.actors['mon-1']);farm.ensure(s);assert.equal(Object.keys(s.farm.actors).length,1);});
test('no training reward before walking + animation',()=>{const s=initial();farm.ensure(s);assert.equal(farm.command(s,'mon-1','attack'),true);farm.advance(s,2);assert.equal(s.team[0].training,0);farm.advance(s,4);assert.ok(s.team[0].training>=1);assert.equal(s.farm.completed,s.team[0].training);assert.ok(s.team[0].atk>7);});
test('stop cancels reward',()=>{const s=initial();farm.command(s,'mon-1','attack');farm.advance(s,.5);farm.command(s,'mon-1','stop');farm.advance(s,20);assert.equal(s.team[0].training,0);});
test('pause and 1x/2x/4x time',()=>{for(const speed of [1,2,4]){const s=initial();farm.ensure(s);s.world.speed=speed;farm.advance(s,1);assert.ok(Math.abs(s.world.seconds-speed)<1e-7,s.world.seconds+' vs '+speed);s.world.paused=true;farm.advance(s,10);assert.ok(Math.abs(s.world.seconds-speed)<1e-7);}});
test('food costs once, consumed after walking',()=>{const s=initial();farm.ensure(s);assert.equal(farm.placeFood(s),true);assert.equal(s.food,4);assert.equal(s.team[0].hunger,20);farm.advance(s,4);assert.equal(s.farm.foods.length,0);assert.ok(s.team[0].hunger<20);assert.equal(s.food,4);});
test('rest recovers then stops at max HP',()=>{const s=initial();s.team[0].hp=15;s.team[0].fatigue=60;farm.command(s,'mon-1','rest');farm.advance(s,17);assert.ok(s.team[0].hp>15);assert.ok(s.team[0].fatigue<60);});
test('auto rest below 20%, then resume training',()=>{const s=initial();s.team[0].hp=13;farm.command(s,'mon-1','attack');farm.advance(s,14);assert.ok(s.team[0].hp>13);const a=s.farm.actors['mon-1'];assert.ok(a.mode==='moving'||a.mode==='acting'||a.mode==='waiting');});
test('day earns food & rope only on crossing boundary',()=>{const s=initial();farm.ensure(s);farm.advance(s,239);assert.equal(s.day,1);farm.advance(s,2);assert.equal(s.day,2);assert.equal(s.food,7);assert.equal(s.ropes,3);farm.advance(s,1);assert.equal(s.day,2);});
test('instance id preserved through save roundtrip',()=>{const s=initial();farm.command(s,'mon-1','speed');farm.advance(s,7);const restored=JSON.parse(JSON.stringify(s));farm.ensure(restored);assert.equal(restored.team[0].instanceId,'mon-1');assert.equal(restored.farm.actors['mon-1'].goal.kind,'speed');farm.advance(restored,2);assert.ok(restored.team[0].training>0);});
test('in storage cannot start command',()=>{const s=initial();s.team[0].location='storage';assert.equal(farm.command(s,'mon-1','attack'),false);});
test('trained stats preserve minimum one and HP costs only on completion',()=>{const s=initial();s.team[0].def=1;farm.command(s,'mon-1','attack');farm.advance(s,1);assert.equal(s.team[0].hp,50);farm.advance(s,6);assert.ok(s.team[0].training>0);assert.ok(s.team[0].def>=1);assert.ok(s.team[0].hp<50);});
test('expanded gym shortens training cycles (temporary extension)',()=>{const s=initial();farm.command(s,'mon-1','attack');farm.advance(s,2.4);const b=s.farm.actors['mon-1'].remaining;const t=initial();t.facilities={training:true};farm.command(t,'mon-1','attack');assert.equal(t.farm.actors['mon-1'].goal.zone,'training');farm.advance(t,8.8);const a=t.farm.actors['mon-1'].remaining;assert.ok(b>0&&a>0&&a<b,JSON.stringify({a,b}));});
test('expanded rest area improves healing without extra resource use',()=>{const base=initial();base.team[0].hp=10;base.team[0].maxHp=1000;farm.command(base,'mon-1','rest');farm.advance(base,45);const improved=initial();improved.team[0].hp=10;improved.team[0].maxHp=1000;improved.facilities={rest:true,garden:true};farm.command(improved,'mon-1','rest');assert.equal(improved.farm.actors['mon-1'].goal.zone,'rest');farm.advance(improved,45);assert.ok(improved.team[0].hp>base.team[0].hp,JSON.stringify({normal:base.team[0].hp,expanded:improved.team[0].hp}));});
test('expanded track increases speed gain after a completed cycle',()=>{const normal=initial();farm.command(normal,'mon-1','speed');farm.advance(normal,6);const enhanced=initial();enhanced.facilities={track:true};farm.command(enhanced,'mon-1','speed');farm.advance(enhanced,22);assert.equal(enhanced.farm.actors['mon-1'].goal.zone,'track');assert.ok(enhanced.team[0].training>=1);assert.equal(enhanced.team[0].spd-7,enhanced.team[0].training*2);assert.equal(normal.team[0].spd-7,normal.team[0].training);});
test('disable auto-rest stops low-HP training',()=>{const s=initial();s.team[0].hp=10;farm.command(s,'mon-1','attack');s.farm.actors['mon-1'].autoRest=false;farm.advance(s,9);assert.equal(s.team[0].training,0);assert.notEqual(s.farm.actors['mon-1'].goal?.kind,'attack');});
test('storage mon remains frozen as active farm advances',()=>{const s=initial();const other=mon('mon-2');other.location='storage';s.team.push(other);const before=JSON.stringify(other);farm.advance(s,30);assert.equal(JSON.stringify(other),before);});
test('peripheral command targets are conditional on purchased plots',()=>{const s=initial();farm.ensure(s);assert.equal(farm.destination(s,'attack').zone,'core');s.facilities={training:true,track:true,rest:true};assert.equal(farm.destination(s,'attack').zone,'training');assert.equal(farm.destination(s,'defense').zone,'training');assert.equal(farm.destination(s,'speed').zone,'track');assert.equal(farm.destination(s,'rest').zone,'rest');});
test('target-stat automation stops at requested attack value',()=>{const s=initial();assert.equal(farm.command(s,'mon-1','attack',{target:10}),true);assert.deepEqual(s.farm.actors['mon-1'].target,{stat:'atk',value:10});farm.advance(s,25);assert.equal(s.team[0].atk,10);assert.equal(s.team[0].training,3);assert.ok(!s.farm.actors['mon-1'].target);const count=s.farm.completed;farm.advance(s,10);assert.equal(s.farm.completed,count);});
test('target-stat automation survives automatic rest and resume',()=>{const s=initial();s.team[0].hp=13;s.team[0].fatigue=50;farm.command(s,'mon-1','attack',{target:8});farm.advance(s,5);assert.equal(s.farm.actors['mon-1'].resume,'attack');assert.equal(s.farm.actors['mon-1'].resumeTarget,8);farm.advance(s,65);assert.equal(s.team[0].atk,8);assert.ok(!s.farm.actors['mon-1'].target);});
test('already satisfied target does not consume resources',()=>{const s=initial();farm.command(s,'mon-1','attack',{target:7});farm.advance(s,12);assert.equal(s.team[0].training,0);assert.ok(s.logs.some(x=>x.includes('이미 달성')));});
test('invalid target does not cancel valid ongoing training',()=>{const s=initial();farm.command(s,'mon-1','attack',{target:13});const before=s.farm.actors['mon-1'].goal;assert.equal(farm.command(s,'mon-1','speed',{target:1000}),false);assert.deepEqual(s.farm.actors['mon-1'].goal,before);});
test('target persists through a JSON state copy and continues',()=>{const s=initial();farm.command(s,'mon-1','speed',{target:9});farm.advance(s,3);const clone=JSON.parse(JSON.stringify(s));farm.ensure(clone);assert.deepEqual(clone.farm.actors['mon-1'].target,{stat:'spd',value:9});farm.advance(clone,18);assert.equal(clone.team[0].spd,9);});

test('hungriness wins food contest regardless of team roster order',()=>{
 const s=initial();s.team[0].hunger=25;const hungry=mon('mon-hungry');hungry.hunger=80;s.team.push(hungry);
 farm.ensure(s);farm.placeFood(s,50,65);farm.advance(s,.05);
 assert.equal(s.farm.foods.length,1);
 assert.equal(s.farm.foods[0].claim,'mon-hungry');
 assert.equal(s.farm.actors['mon-hungry'].goal.kind,'eat');
 assert.notEqual(s.farm.actors['mon-1'].goal?.kind,'eat');
 farm.advance(s,5);
 assert.equal(s.farm.foods.length,0);
 assert.ok(hungry.hunger<80);
 assert.ok(s.team[0].hunger>=25);
});
test('two foods go to two different Digimon',()=>{
 const s=initial();s.team.push(mon('second'));farm.ensure(s);
 assert.ok(farm.placeFood(s,38,58));assert.ok(farm.placeFood(s,64,66));
 farm.advance(s,.05);
 const foodOwners=s.farm.foods.map(f=>f.claim);
 assert.equal(new Set(foodOwners).size,2);
 farm.advance(s,8);assert.equal(s.farm.foods.length,0);
 assert.ok(s.team.every(m=>m.hunger<20));
});
test('wandering hungry Digimon is interrupted for food',()=>{
 const s=initial();s.team[0].hunger=0;farm.ensure(s);farm.advance(s,3.1);
 assert.equal(s.farm.actors['mon-1'].goal?.kind,'wander');
 s.team[0].hunger=45;farm.placeFood(s,65,45);farm.advance(s,.05);
 assert.equal(s.farm.actors['mon-1'].goal?.kind,'eat');
});
test('feeding does not cancel requested training',()=>{
 const s=initial();farm.command(s,'mon-1','attack');farm.placeFood(s,25,35);farm.advance(s,.1);
 assert.equal(s.farm.actors['mon-1'].goal.kind,'attack');
 assert.equal(s.farm.foods[0].claim,undefined);
});
test('idle tired Digimon automatically walks to rest, no training reward',()=>{
 const s=initial();s.team[0].fatigue=83;farm.advance(s,.05);
 assert.equal(s.farm.actors['mon-1'].goal.kind,'rest');
 const before=s.team[0].training;farm.advance(s,10);
 assert.equal(s.team[0].training,before);assert.ok(s.team[0].fatigue<83);
});
test('feeding creates emote and save keeps the food reservation',()=>{
 const s=initial();farm.placeFood(s,50,65);farm.advance(s,.05);
 const restored=JSON.parse(JSON.stringify(s));farm.ensure(restored);
 assert.equal(restored.farm.foods[0].claim,'mon-1');
 farm.advance(restored,4);assert.equal(restored.farm.foods.length,0);
 assert.equal(restored.farm.actors['mon-1'].emote,'💚');
});
test('stale food reservation from missing Digimon is released',()=>{
 const s=initial();farm.ensure(s);farm.placeFood(s);
 s.farm.foods[0].claim='deleted-mon';farm.ensure(s);
 assert.equal(s.farm.foods[0].claim,undefined);
 farm.advance(s,.05);assert.equal(s.farm.foods[0].claim,'mon-1');
});
test('invalid coordinates do not spend food',()=>{
 const s=initial();assert.equal(farm.placeFood(s,NaN,55),false);assert.equal(s.food,5);
 assert.equal(farm.placeFood(s,Infinity,55),false);assert.equal(s.food,5);
});
console.log(JSON.stringify({results},null,2));require('node:fs').writeFileSync(require('node:path').join(__dirname,'farm-core-results.json'),JSON.stringify(results,null,2));if(results.some(x=>x.status==='FAIL'))process.exitCode=1;
