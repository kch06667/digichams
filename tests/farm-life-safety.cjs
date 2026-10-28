'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const farm=require('../src/farm-core.js');

const mon=(id='living',props={})=>({
  instanceId:id,name:'아구몬',hp:100,maxHp:100,atk:25,def:20,spd:20,
  hunger:0,fatigue:0,training:0,level:1,exp:0,friendship:15,
  location:'farm',...props
});
const game=(team=[mon()])=>({
  day:1,team,food:10,ropes:3,points:0,logs:[],
  farm:{actors:{},foods:[],nextFood:1,completed:0}
});
const actor=(s,id)=>s.farm.actors[id];

test('lost fighter cannot train, take an order or gain daily hunger/care',()=>{
  const s=game([mon('living'),mon('lost',{hunger:80,hp:100})]);
  farm.ensure(s);
  assert.equal(farm.command(s,'lost','attack'),true);
  // In mid-training the fighter is marked lost; no ghost training reward.
  s.team[1].lost=true;
  const before=JSON.stringify(s.team[1]);
  assert.equal(farm.command(s,'lost','rest'),false);
  assert.equal(farm.command(s,'lost','stop'),false);
  farm.advance(s,241);
  assert.equal(JSON.stringify(s.team[1]),before,'historical lost actor is immutable');
  assert.equal(actor(s,'lost').goal,null);
  assert.equal(actor(s,'lost').mode,'idle');
  assert.equal(s.farm.completed,0);
  assert.equal(s.day,2);
});
test('lost food claimant is released and a living hungry fighter may eat',()=>{
  const s=game([mon('lost',{hunger:90}),mon('hungry',{hunger:70})]);
  farm.ensure(s);
  assert.equal(farm.placeFood(s),true);
  s.farm.foods[0].claim='lost';
  const a=actor(s,'lost');
  a.id='lost';a.foodId=s.farm.foods[0].id;
  a.goal={kind:'eat',x:s.farm.foods[0].x,y:s.farm.foods[0].y};
  a.mode='moving';s.team[0].lost=true;
  farm.ensure(s);
  assert.equal(s.farm.foods[0].claim,undefined);
  farm.advance(s,10);
  assert.equal(s.farm.foods.length,0,'another living mon reclaims and eats food');
  assert.equal(s.team[0].hunger,90,'lost fighter remains unchanged');
  assert.ok(s.team[1].hunger<70);
});
test('not hungry: does not waste food, then eats after threshold is reached',()=>{
  const s=game([mon('one',{hunger:0})]);
  assert.equal(farm.CFG.hungerSeek,15);
  assert.equal(farm.placeFood(s),true);
  farm.advance(s,20);
  assert.equal(s.farm.foods.length,1);
  assert.equal(actor(s,'one').foodId??null,null);
  s.team[0].hunger=40;
  farm.advance(s,7);
  assert.equal(s.farm.foods.length,0);
  assert.ok(s.team[0].hunger<40);
});
test('critical HP or fatigue takes emergency rest instead of a placed meal',()=>{
  for(const props of [{hp:15,hunger:90},{fatigue:90,hunger:90}]){
    const s=game([mon('one',props)]);
    farm.placeFood(s);
    farm.advance(s,.1);
    assert.equal(actor(s,'one').goal?.kind,'rest');
    assert.equal(s.farm.foods[0].claim,undefined,'emergency care wins over idle meal');
  }
});
test('saved finite pending fraction preserved; huge/corrupt backlog is not replayed',()=>{
  const s=game();
  farm.ensure(s);
  s.world.accumulator=.03;
  farm.ensure(s);
  assert.equal(s.world.accumulator,.03);
  s.world.accumulator=1e14;
  farm.ensure(s);
  assert.equal(s.world.accumulator,0);
  assert.equal(s.day,1);
  for(const dt of [Infinity,-Infinity,NaN,-5,0]){
    const previous=s.world.seconds;
    farm.advance(s,dt);
    assert.equal(s.world.seconds,previous);
    assert.ok(Number.isFinite(s.world.accumulator));
  }
  // No offline fast-forward, but still allow existing deterministic test
  // catchups and day boundaries under 300 real seconds.
  farm.advance(s,1e10);
  assert.equal(s.world.seconds,300);
  assert.equal(s.day,2);
});
test('simultaneous live and archived roster stable across save JSON roundtrip',()=>{
  const s=game([
    mon('one',{hunger:35}),
    mon('lost',{lost:true,hunger:75,care:{sick:true,sickDays:4}}),
    mon('archive',{location:'storage',hunger:80}),
    mon('egg',{egg:true,hunger:60})
  ]);
  farm.ensure(s);
  farm.placeFood(s);
  const before=s.team.slice(1).map(x=>JSON.stringify(x));
  farm.advance(s,12);
  const saved=JSON.parse(JSON.stringify(s));
  farm.ensure(saved);
  assert.deepEqual(saved.team.slice(1).map(x=>JSON.stringify(x)),before);
  assert.equal(saved.team[0].instanceId,'one');
  assert.equal(saved.team[0].location,'farm');
  assert.equal(saved.farm.foods.length,0);
});
