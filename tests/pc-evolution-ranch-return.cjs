'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const farm=require('../src/farm-core.js');
const evo=require('../src/evolution-core.js');
const {isSpeciesChange}=require('../src/pc-ranch-evolution-fx.js');
const specs={
 '코로몬':{name:'코로몬',stage:'유년기 II',hp:50,atk:7,def:5,spd:7,emoji:'🟠'},
 '아구몬':{name:'아구몬',stage:'성장기',hp:72,atk:13,def:9,spd:10,emoji:'🦖'},
 '그레이몬':{name:'그레이몬',stage:'성숙기',hp:110,atk:20,def:15,spd:12,emoji:'🐲'}
};
const lookup=n=>specs[n];
function game(){
 const mon={...specs['코로몬'],instanceId:'evolution-a',maxHp:50,
  level:1,exp:0,hunger:0,fatigue:0,training:0,friendship:20};
 const s={day:1,food:4,ropes:2,points:0,logs:[],team:[mon],
  facilities:{training:true}};
 farm.ensure(s);evo.ensure(s);
 return s;
}
test('real Koromon evolution keeps farm instance and position, resets old orders',()=>{
 const s=game(),m=s.team[0],a=s.farm.actors[m.instanceId];
 Object.assign(a,{x:50,y:-76,mode:'acting',pose:32,remaining:1.2,
  goal:{kind:'attack',zone:'training',x:50,y:-76},station:1,
  waitPosition:{x:64,y:-70},route:[{x:50,y:35}],
  routeKey:'50,35',foodId:23,trafficWait:1.5,repositioning:true,
  resume:'defense',resumeOptions:{target:30},resumeTarget:30,
  idleTime:6,target:{stat:'atk',value:40}});
 s.farm.foods=[{id:23,x:50,y:-50,age:0,claim:'evolution-a'}];
 const snapshot={x:a.x,y:a.y,id:m.instanceId};
 for(let i=0;i<3;i++)evo.recordBattle(s,[m.instanceId],true,lookup);
 assert.equal(m.name,'아구몬');
 assert.equal(s.farm.actors[m.instanceId],a,'same original actor is reused');
 assert.deepEqual({x:a.x,y:a.y,id:m.instanceId},snapshot,'never teleport');
 assert.equal(a.mode,'idle');assert.equal(a.pose,0);
 for(const prop of ['goal','resume','resumeOptions','resumeTarget','route',
  'routeKey','foodId','waitPosition','target'])
  assert.equal(a[prop],null,prop+' must be cleared');
 assert.equal(a.station,undefined);
 assert.equal(a.repositioning,false);
 assert.equal(a.idleTime,0);
 assert.equal(s.farm.foods[0].claim,undefined,'food reservation released');
 assert.equal(m.evo.history[0].from,'코로몬');
 assert.equal(m.evo.history[0].to,'아구몬');
 // Existing farm simulation still works on that actor after the real evolution.
 farm.advance(s,.05,{evolution:evo,lookup});
 assert.ok(farm.walkable(s,a.x,a.y));
 assert.equal(s.team[0].name,'아구몬');
});
test('post-evolution save round-trip preserves ID, current location and history',()=>{
 const s=game();const m=s.team[0];
 const a=s.farm.actors[m.instanceId];
 a.x=50;a.y=35;
 for(let i=0;i<3;i++)evo.recordBattle(s,[m.instanceId],true,lookup);
 const clone=JSON.parse(JSON.stringify(s));
 evo.ensure(clone);farm.ensure(clone);
 assert.equal(clone.team[0].name,'아구몬');
 assert.deepEqual(clone.team[0].evo.history,s.team[0].evo.history);
 assert.equal(clone.team[0].instanceId,'evolution-a');
 assert.deepEqual({x:clone.farm.actors['evolution-a'].x,y:clone.farm.actors['evolution-a'].y},{x:50,y:35});
 farm.advance(s,2,{evolution:evo,lookup});
 farm.advance(clone,2,{evolution:evo,lookup});
 assert.deepEqual(clone,s,'same serialized game must replay the same actions');
});
test('evolution FX ignores initial paint, same-species pose and missing labels',()=>{
 for(const [from,to,wanted] of [
  ['코로몬','아구몬',true],['아구몬','아구몬',false],
  [undefined,'아구몬',false],['코로몬','',false],
  ['', '그레이몬',false]
 ])assert.equal(isSpeciesChange(from,to),wanted);
});
