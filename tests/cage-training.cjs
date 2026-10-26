'use strict';
const assert=require('node:assert/strict');
const farm=require('../src/farm-core.js');
const evo=require('../src/evolution-core.js');
const cages=require('../src/cage-training-core.js');
const roster=require('../assets/species-catalog.json').entries;
const lookup=name=>roster.find(x=>x.name===name);
const mon=(name,id='player-1')=>{
 const x=lookup(name);if(!x)throw Error('Missing '+name);
 return {instanceId:id,name:x.name,stage:x.stage,emoji:x.emoji,hp:400,maxHp:400,
  atk:x.atk,def:x.def,spd:x.spd,level:1,exp:0,hunger:0,fatigue:0,training:0,friendship:20};
};
const game=(name='아구몬')=>({day:6,wins:6,food:30,ropes:8,points:0,logs:[],
 team:[mon(name),mon('파타몬','player-2')],facilities:{core:true,training:true},
 facilityCredits:3000});
const checks=[];
function test(name,fn){try{fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:e.stack});}}
const tick=(s,sec)=>farm.advance(s,sec,{evolution:evo,lookup});
test('11 training cages cover all 11 hidden evolution families',()=>{
 const provided=new Set(cages.CAGES.flatMap(c=>Object.keys(c.ap)));
 assert.deepEqual([...provided].sort(),Object.keys(evo.EMPTY_AP()).sort());
 assert.equal(cages.CAGES.length,11);
});
test('all cage IDs and families are valid and independently keyed',()=>{
 assert.equal(Object.keys(cages.MAP).length,11);
 for(const c of cages.CAGES)for(const k of Object.keys(c.ap))assert(k in evo.EMPTY_AP());
});
test('cannot buy or train before special training plot exists',()=>{
 const s=game();s.facilities.training=false;farm.ensure(s);evo.ensure(s);
 const cost=s.facilityCredits;
 assert.equal(cages.buy(s,'miniVolcano'),false);
 s.cageFacilities={miniVolcano:true};
 assert.equal(farm.command(s,'player-1','cage',{cage:'miniVolcano'}),false);
 assert.equal(s.facilityCredits,cost);
});
test('purchasing a cage costs credits exactly once and persists',()=>{
 const s=game();const before=s.facilityCredits;
 assert.equal(cages.buy(s,'miniVolcano'),true);
 assert.equal(s.facilityCredits,before-160);
 assert.equal(cages.buy(s,'miniVolcano'),false);
 assert.equal(s.facilityCredits,before-160);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(cages.owned(restored,'miniVolcano'),true);
});
test('rank prerequisites prevent purchasing unavailable lab',()=>{
 const s=game();s.wins=0;s.day=2;
 assert.equal(cages.buy(s,'laboratory'),false);
 assert(cages.info(s,'laboratory').needs.length>0);
});
test('original defense/core cage earns insect AP not unrelated defense stat alone',()=>{
 const s=game('쿠네몬');s.facilities.training=false;evo.ensure(s);farm.command(s,'player-1','defense');
 tick(s,5.5);
 assert(s.team[0].evo.ap.insect>0);
 assert.equal(s.team[0].evo.ap.dragon,0);
});
test('gym does not secretly grant dragon AP (regression for old provisional adapter)',()=>{
 const s=game('아구몬');evo.ensure(s);farm.command(s,'player-1','attack');
 tick(s,6);
 assert.equal(s.team[0].evo.ap.dragon,0);
});
test('mini volcano moves actor to training plot and increases dragon family only',()=>{
 const s=game('아구몬');evo.ensure(s);cages.buy(s,'miniVolcano');
 assert.equal(farm.command(s,'player-1','cage',{cage:'miniVolcano'}),true);
 assert.equal(s.farm.actors['player-1'].goal.zone,'training');
 const hp=s.team[0].hp;
 tick(s,16);
 assert(s.team[0].evo.ap.dragon>=2,s.team[0].evo.ap.dragon);
 assert.equal(s.team[0].evo.ap.beast,0);
 assert(s.team[0].evo.resist.heat>=1);
 assert(s.team[0].hp<hp);
});
test('hidden species AP and visible heat resistance are two independent counters',()=>{
 const s=game('아구몬');evo.ensure(s);cages.buy(s,'miniVolcano');
 farm.command(s,'player-1','cage',{cage:'miniVolcano'});tick(s,16);
 assert.notEqual(s.team[0].evo.ap.dragon,s.team[0].evo.resist.heat);
 assert(!Object.hasOwn(s.team[0].evo.ap,'heat'));
});
test('forest provides insect and secondary bird AP; selected forest tile is used when owned',()=>{
 const s=game('텐타몬');s.facilities.forest=true;evo.ensure(s);cages.buy(s,'forest');
 farm.command(s,'player-1','cage',{cage:'forest'});
 assert.equal(s.farm.actors['player-1'].goal.zone,'forest');tick(s,18);
 assert(s.team[0].evo.ap.insect>=2);
 assert(s.team[0].evo.ap.bird>=1);
});
test('AP target stops continuous training without mutating evolution state',()=>{
 const s=game('아구몬');evo.ensure(s);cages.buy(s,'miniVolcano');
 farm.command(s,'player-1','cage',{cage:'miniVolcano',apTarget:6});
 tick(s,32);assert.equal(s.team[0].evo.ap.dragon,6);
 assert.equal(s.farm.actors['player-1'].target,null);
});
test('invalid cage AP target preserves active order',()=>{
 const s=game();evo.ensure(s);cages.buy(s,'miniVolcano');
 farm.command(s,'player-1','cage',{cage:'miniVolcano'});
 assert.equal(farm.command(s,'player-1','cage',{cage:'miniVolcano',apTarget:1000}),false);
 assert.equal(s.farm.actors['player-1'].goal.cage,'miniVolcano');
});
test('training AP correctly triggers chosen GeoGreymon evolution after six recorded battles',()=>{
 const s=game('아구몬');evo.ensure(s);cages.buy(s,'miniVolcano');
 s.team[0].evo.battles=6;
 evo.chooseTarget(s.team[0],'지오그레이몬');
 farm.command(s,'player-1','cage',{cage:'miniVolcano'});
 tick(s,70);
 assert.equal(s.team[0].name,'지오그레이몬');
 assert.equal(s.team[0].evo.battles,6);
 assert.equal(s.team[0].evo.ap.dragon,0);
 assert(!s.farm.actors['player-1'].goal||s.farm.actors['player-1'].goal.kind!=='cage');
});
test('saving mid-cage training retains destination, cage order and AP goal',()=>{
 const s=game();evo.ensure(s);cages.buy(s,'miniVolcano');
 farm.command(s,'player-1','cage',{cage:'miniVolcano',apTarget:10});
 tick(s,2);
 const cloned=JSON.parse(JSON.stringify(s));farm.ensure(cloned);evo.ensure(cloned);
 assert.equal(cloned.farm.actors['player-1'].goal.cage,'miniVolcano');
 assert.equal(cloned.farm.actors['player-1'].target.ap,'dragon');
 tick(cloned,20);assert(cloned.team[0].evo.ap.dragon>0);
});
test('storage Digimon cannot receive specialist training',()=>{
 const s=game();evo.ensure(s);cages.buy(s,'miniVolcano');
 s.team[0].location='storage';assert.equal(farm.command(s,'player-1','cage',{cage:'miniVolcano'}),false);
});
test('existing saves without cageFacilities, resistance data migrate without losing stats',()=>{
 const s=game();s.team[0].atk=777;evo.ensure(s);cages.ensure(s);
 assert.equal(s.team[0].atk,777);
 assert.equal(s.team[0].evo.resist.lightning,0);
 assert.deepEqual(s.cageFacilities,{});
});
const passed=checks.filter(x=>x.status==='PASS').length;
console.log(JSON.stringify({passed,total:checks.length,checks},null,2));
if(passed!==checks.length)process.exitCode=1;
