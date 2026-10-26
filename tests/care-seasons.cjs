'use strict';
const assert=require('node:assert/strict');
const care=require('../src/care-core');
const farm=require('../src/farm-core');
const evo=require('../src/evolution-core');
const cages=require('../src/cage-training-core');
const species=require('../assets/species-catalog.json').entries;
const lookup=n=>species.find(x=>x.name===n);
const makeMon=(name='아구몬',id='m1')=>{const t=lookup(name);return {instanceId:id,name,stage:t.stage,emoji:t.emoji,maxHp:300,hp:300,atk:20,def:20,spd:20,hunger:0,fatigue:0,training:0,friendship:20,level:1,exp:0};};
const game=(day=1)=>({day,team:[makeMon()],world:{seconds:(day-1)*240,seed:1111,careSeed:123,paused:false,speed:1,accumulator:0},facilities:{core:true,training:true},cageFacilities:{miniVolcano:true},facilityCredits:500,food:5,ropes:3,wins:6,points:0,logs:[]});
const T=[];
function test(name,fn){try{fn();T.push({name,status:'PASS'});}catch(e){T.push({name,status:'FAIL',error:e.stack});}}
test('seasons roll forward deterministically at 30-day boundaries',()=>{
 assert.equal(care.season(1),'봄');assert.equal(care.season(30),'봄');assert.equal(care.season(31),'여름');assert.equal(care.season(61),'가을');assert.equal(care.season(91),'겨울');assert.equal(care.season(121),'봄');
});
test('summer gains more while losing less; winter reverses',()=>{
 assert.equal(care.statGain(31,2),3);assert.equal(care.statGain(91,2),1);
 assert.equal(care.statLoss(31,1),0);assert.equal(care.statLoss(91,1),2);assert.equal(care.statLoss(91,2),3);
});
test('training yields seasonal hidden dragon AP and resistances remain separate',()=>{
 const s=game(31),m=s.team[0];evo.ensure(s);cages.ensure(s);
 const summer=evo.train(s,m,'cage','training',lookup,{cageId:'miniVolcano'});
 assert.equal(summer.dragon,3);assert.equal(m.evo.resist.heat,1);
 s.day=91;const winter=evo.train(s,m,'cage','training',lookup,{cageId:'miniVolcano'});
 assert.equal(winter.dragon,1);assert.equal(m.evo.ap.dragon,4);
});
test('injury increments penalties once and treatment retains that penalty',()=>{
 const s=game(),m=s.team[0];evo.ensure(s);assert(care.suffer(s,m,'injury'));
 assert.equal(m.evo.penalties,1);assert.equal(care.suffer(s,m,'injury'),false);
 const credits=s.facilityCredits;
 const r=care.treat(s,m,'injury');assert(r.ok);assert.equal(s.facilityCredits,credits-30);
 assert.equal(m.care.injured,false);assert.equal(m.evo.penalties,1);
});
test('an untreated injury can progress to sickness (+2) after two days',()=>{
 const s=game(),m=s.team[0];evo.ensure(s);care.suffer(s,m,'injury');care.advanceDays(s,2);
 assert.equal(m.care.sick,true);assert.equal(m.evo.penalties,3);
 assert(care.treat(s,m,'sickness').ok);assert.equal(m.evo.penalties,3);
});
test('sick Digimon stays ill across JSON save, can be fully cured at clinic',()=>{
 const s=game(),m=s.team[0];evo.ensure(s);care.suffer(s,m,'sickness');m.hp=1;
 const restored=JSON.parse(JSON.stringify(s)),r=care.treat(restored,restored.team[0],'clinic');
 assert.equal(r.ok,true);assert.equal(restored.team[0].hp,300);assert.equal(restored.team[0].care.sick,false);
 assert.equal(restored.team[0].evo.penalties,2);
});
test('unwell or archived Digimon cannot be treated incorrectly',()=>{
 const s=game(),m=s.team[0];assert.equal(care.treat(s,m,'sickness').ok,false);
 care.suffer(s,m,'injury');m.location='storage';assert.equal(care.treat(s,m,'injury').ok,false);
});
test('legacy saves migrate health record without changing combat stats',()=>{
 const s=game(),m=s.team[0];const old={...m};care.ensureMon(m);assert.equal(m.atk,old.atk);assert.equal(m.care.injured,false);
});
test('egg revert clears current disease but preserves egg revert count',()=>{
 const s=game();evo.ensure(s);const m=s.team[0];care.suffer(s,m,'injury');care.suffer(s,m,'sickness');evo.eggRevert(s,m);
 assert(m.egg);assert.equal(m.care.sick,false);assert.equal(m.care.injured,false);assert.equal(m.evo.penalties,0);
 assert.equal(m.evo.eggReverts,1);
});
test('winter high fatigue training injury can occur with deterministic random seed',()=>{
 const s=game(91),m=s.team[0];evo.ensure(s);m.fatigue=76;
 let happened=false;for(let i=0;i<20;i++){care.afterTraining(s,m);if(m.care.injured){happened=true;break;}}
 assert(happened);assert.equal(m.evo.penalties,1);
});
test('archived Digimon remains byte-for-byte unchanged on advancing world simulation',()=>{
 const s=game();s.team[0].location='storage';evo.ensure(s);care.ensureMon(s.team[0]);const before=JSON.stringify(s.team[0]);
 farm.advance(s,250,{evolution:evo,lookup});assert.equal(JSON.stringify(s.team[0]),before);
});
const passed=T.filter(t=>t.status==='PASS').length;
console.log(JSON.stringify({passed,total:T.length,tests:T},null,2));
if(passed!==T.length)process.exitCode=1;
