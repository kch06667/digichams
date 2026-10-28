'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../src/dev-phaser-commit.js');
const Commit=require('../src/battle-commit-core.js');
const TOKEN='8'.repeat(32);

function sample(){
  const mon={instanceId:'owned-a',name:'아구몬',hp:130,maxHp:140,
    tp:85,maxTp:95,atk:50,def:25,spd:48,level:1,exp:0,
    friendship:20,evo:{battles:0,wins:0},location:'farm',
    egg:false,lost:false,hunger:12,fatigue:0};
  const state={saveVersion:4,day:4,wins:0,losses:0,points:7,
    facilityCredits:0,logs:[],team:[mon]};
  const before={id:'0-0',side:0,slot:0,name:mon.name,
    hp:mon.hp,max:mon.maxHp,tp:mon.tp,maxTp:mon.maxTp};
  const after={...before,hp:62.2,tp:45.9};
  const packet={initial:[before],final:{
    finished:true,winner:0,elapsed:35,
    fighters:[after,{id:'1-0',side:1,slot:0,name:'상대',
      hp:0,max:140,tp:0,maxTp:95}]},
    preview:{type:'read-only-battle-result',winner:0,elapsed:35,
      saveApplied:false,rewardsApplied:false,changes:[{
        teamIndex:0,name:'아구몬',fighterId:'0-0',
        hpBefore:130,hpAfter:62.2,tpBefore:85,tpAfter:45.9}]}};
  return {state,launch:D.capture(state),packet,lookup:()=>null};
}
function fakeStorage(json,blocked=null){
  const map=new Map([[Commit.SAVE_KEY,json]]);
  const writes=[];
  return {getItem:key=>map.has(key)?map.get(key):null,
    setItem(key,value){writes.push(key);if(key===blocked)throw Error('Blocked write');
      map.set(key,value);
    },get:key=>map.get(key),writes};
}

test('dev-only 1v1 stages exact existing HP/TP, XP and log without mutating source',()=>{
  const a=sample(),old=JSON.stringify(a.state);
  const result=D.stage(a.state,a.launch,a.packet,TOKEN,a.lookup);
  assert.equal(JSON.stringify(a.state),old);
  assert.equal(result.state.team[0].hp,63);
  assert.equal(result.state.team[0].tp,45);
  assert.equal(result.state.wins,1);
  assert.equal(result.state.points,9);
  assert.equal(result.state.team[0].evo.battles,1);
  assert.equal(result.state.pendingBattle,undefined);
  assert.equal(result.state.team[0].exp,10);
});
test('dev-only save requires a verified backup, commits once and rejects replay',()=>{
  const a=sample(),old=JSON.stringify(a.state),storage=fakeStorage(old);
  const result=D.persist(a.state,a.launch,a.packet,TOKEN,a.lookup,storage);
  assert.deepEqual(JSON.parse(storage.get(Commit.SAVE_KEY)),result.state);
  assert.equal(storage.get(D.BACKUP_KEY),old);
  assert.equal(storage.get(D.FIRST_BACKUP_KEY),old);
  assert.deepEqual(storage.writes,
    [D.FIRST_BACKUP_KEY,D.BACKUP_KEY,Commit.SAVE_KEY]);
  assert.equal(JSON.stringify(a.state),old);
  assert.throws(()=>D.persist(a.state,a.launch,a.packet,TOKEN,a.lookup,storage),
    /not saved|changed/);
});
test('dev-only save rejects stale battles, altered actor, fabricated result and blocked storage',()=>{
  const a=sample(),original=JSON.stringify(a.state);
  const stale=fakeStorage('{"newer":"progress"}');
  assert.throws(()=>D.persist(a.state,a.launch,a.packet,TOKEN,a.lookup,stale),
    /another tab/);
  assert.equal(stale.writes.length,0);
  const changed=JSON.parse(original);
  changed.team[0].atk++;
  assert.throws(()=>D.stage(changed,a.launch,a.packet,TOKEN,a.lookup),/changed/);
  const forged=structuredClone(a.packet);
  forged.preview.changes[0].hpAfter=900;
  assert.throws(()=>D.stage(a.state,a.launch,forged,TOKEN,a.lookup),/does not match/);
  const missing=structuredClone(a.packet);
  missing.final.finished=false;
  assert.throws(()=>D.stage(a.state,a.launch,missing,TOKEN,a.lookup),/completed/);
  const blocked=fakeStorage(original,D.BACKUP_KEY);
  assert.throws(()=>D.persist(a.state,a.launch,a.packet,TOKEN,a.lookup,blocked),
    /Blocked/);
  assert.equal(blocked.get(Commit.SAVE_KEY),original);
  assert.equal(JSON.stringify(a.state),original);
});
