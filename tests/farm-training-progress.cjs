'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const farm=require('../src/farm-core.js');
const cages=require('../src/cage-training-core.js');
const evo=require('../src/evolution-core.js');
const roster=require('../assets/species-catalog.json').entries;
const entry=roster.find(m=>m.name==='아구몬');
const mon=(id)=>({instanceId:id,name:entry.name,stage:entry.stage,
 hp:400,maxHp:400,atk:entry.atk,def:entry.def,spd:entry.spd,
 level:1,exp:0,hunger:0,fatigue:0,training:0,friendship:20,
 location:'farm',egg:false,lost:false});
const state=()=>({day:6,wins:6,food:20,points:0,logs:[],
 team:[mon('qa-1'),mon('qa-2')],facilities:{core:true,training:true},
 facilityCredits:2000});
const init=()=>{const s=state();farm.ensure(s);evo.ensure(s);
 assert.equal(cages.buy(s,'miniVolcano'),true);return s;};
const step=(s,sec)=>farm.advance(s,sec,{evolution:evo,
 lookup:name=>roster.find(m=>m.name===name)});

test('progress is read-only, scoped to selected individual, and does not modify save',()=>{
 const s=init();const m=s.team[0],id=m.instanceId;
 assert.equal(farm.trainingStatus(s,'unknown'),null);
 assert.equal(farm.command(s,id,'cage',{cage:'miniVolcano',apTarget:8}),true);
 const snapshot=JSON.stringify(s);
 const progress=farm.trainingStatus(s,id);
 assert.equal(JSON.stringify(s),snapshot);
 assert.deepEqual([progress.kind,progress.cageId,progress.facility,progress.measure,
  progress.key,progress.current,progress.goal,progress.remaining,progress.percent],
 ['cage','miniVolcano','미니 화산','ap','dragon',0,8,8,0]);
 assert.equal(farm.trainingStatus(s,'qa-2').goal,null);
 step(s,20);
 const after=farm.trainingStatus(s,id);
 assert.equal(after.goal,8);
 assert.ok(after.current>=2);
 assert.equal(after.remaining,Math.max(0,8-after.current));
 assert.equal(after.percent,Math.round(Math.min(100,100*after.current/8)));
});
test('auto-rest keeps AP target and returns to same original cage after recovery',()=>{
 const s=init(),id='qa-1',m=s.team[0];
 farm.command(s,id,'cage',{cage:'miniVolcano',apTarget:10});
 let a=s.farm.actors[id];
 // Exactly one due training cycle is drained, triggering existing HP guard.
 a.mode='acting';a.remaining=.01;m.hp=40;m.fatigue=80;
 step(s,.1);
 a=s.farm.actors[id];
 assert.equal(a.goal?.kind,'rest');
 assert.equal(a.resume,'cage');
 assert.deepEqual(JSON.parse(JSON.stringify(a.resumeOptions)),{cage:'miniVolcano',apTarget:10});
 let p=farm.trainingStatus(s,id);
 assert.equal(p.restResume,true);
 assert.equal(p.kind,'cage');
 assert.equal(p.cageId,'miniVolcano');
 assert.equal(p.goal,10);
 assert.equal(p.key,'dragon');
 const loaded=JSON.parse(JSON.stringify(s));farm.ensure(loaded);evo.ensure(loaded);
 p=farm.trainingStatus(loaded,id);
 assert.equal(p.restResume,true);
 assert.equal(p.remaining,10);
 let savedA=loaded.farm.actors[id];
 savedA.mode='acting';savedA.remaining=.01;
 loaded.team[0].hp=380;loaded.team[0].fatigue=20;
 step(loaded,.1);
 savedA=loaded.farm.actors[id];
 assert.equal(savedA.goal?.kind,'cage');
 assert.equal(savedA.goal?.cage,'miniVolcano');
 assert.equal(savedA.target?.ap,'dragon');
 assert.equal(savedA.target?.value,10);
 assert.equal(farm.trainingStatus(loaded,id).restResume,false);
});
test('already reached AP or stat target never cancels a running training order',()=>{
 const s=init(),id='qa-1',m=s.team[0];
 farm.command(s,id,'cage',{cage:'miniVolcano',apTarget:20});
 const existing=JSON.stringify(s.farm.actors[id]);
 m.evo.ap.dragon=6;
 assert.equal(farm.command(s,id,'cage',{cage:'miniVolcano',apTarget:6}),false);
 assert.equal(JSON.stringify(s.farm.actors[id]),existing);
 assert.equal(farm.command(s,id,'attack',{target:m.atk}),false);
 assert.equal(JSON.stringify(s.farm.actors[id]),existing);
 assert.equal(farm.command(s,id,'cage',{cage:'miniVolcano',apTarget:0}),false);
 assert.equal(JSON.stringify(s.farm.actors[id]),existing);
});
test('physical stat targets are separate from AP; completing cage goal ends order',()=>{
 const s=init(),id='qa-1';
 const current=s.team[0].atk;
 assert.equal(farm.command(s,id,'attack',{target:current+2}),true);
 const p=farm.trainingStatus(s,id);
 assert.equal(p.measure,'stat');
 assert.equal(p.key,'atk');
 assert.equal(p.goal,current+2);
 assert.equal(p.remaining,2);
 farm.command(s,id,'cage',{cage:'miniVolcano',apTarget:2});
 step(s,18);
 assert.equal(s.team[0].evo.ap.dragon,2);
 assert.equal(s.farm.actors[id].target,null);
 assert.notEqual(s.farm.actors[id].goal?.kind,'cage');
 assert.equal(farm.trainingStatus(s,id).goal,null);
});
test('stored or lost members cannot start special training, status remains non-mutating',()=>{
 const s=init();s.team[0].lost=true;
 assert.equal(farm.command(s,'qa-1','cage',{cage:'miniVolcano',apTarget:9}),false);
 const before=JSON.stringify(s);
 farm.trainingStatus(s,'qa-1');
 assert.equal(JSON.stringify(s),before);
 s.team[1].location='storage';
 assert.equal(farm.command(s,'qa-2','cage',{cage:'miniVolcano'}),false);
});
