'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Commit=require('../src/battle-commit-core.js');

function sample(winner=0){
  const mon={instanceId:'owned-1',name:'아구몬',stage:'성장기',
    hp:130,maxHp:140,tp:85,maxTp:95,
    atk:50,def:25,spd:48,level:1,exp:0,friendship:20,
    hunger:20,fatigue:10,evo:{battles:0,wins:0}};
  const state={saveVersion:4,day:4,wins:0,losses:0,points:7,
    facilityCredits:0,logs:['[DAY 4] 출전'],team:[mon],
    pendingBattle:{id:'commit-1',participants:['owned-1']}};
  const initial=[{id:'ally-0',side:0,slot:0,instanceId:mon.instanceId,
    name:mon.name,hp:mon.hp,max:mon.maxHp,tp:mon.tp,maxTp:mon.maxTp}];
  const final={finished:true,winner,elapsed:35,fighters:[
    {...initial[0],hp:62.2,tp:45.9},
    {id:'opponent-0',side:1,slot:0,name:'상대',
      hp:winner===0?0:40,max:140,tp:0,maxTp:95}
  ]};
  return {state,args:{battleId:'commit-1',initial,final,lookup:()=>null}};
}
function fakeStorage(json,{throwOnSet=false,throwOnGet=false}={}){
  let raw=json;
  let writes=0;
  return {getItem(key){assert.equal(key,Commit.SAVE_KEY);
      if(throwOnGet)throw Error('Storage read blocked');
      return raw;
    },setItem(key,value){assert.equal(key,Commit.SAVE_KEY);
      writes++;
      if(throwOnSet)throw Error('QuotaExceededError');
      raw=value;
    },snapshot:()=>raw,count:()=>writes};
}
test('stageCopy reproduces exact legacy battle message without storage access',()=>{
  const {state,args}=sample(0),before=JSON.stringify(state);
  const stage=Commit.stageCopy(state,args);
  assert.equal(JSON.stringify(state),before);
  assert.match(stage.state.logs[0],/^\[DAY 4\] 내 디지몬이 승리했어/);
  assert.deepEqual(stage.state.logs.slice(1),state.logs);
  assert.equal(stage.state.pendingBattle,undefined);
  assert.equal(stage.receipt.won,true);
  const loss=sample(1);
  assert.match(Commit.stageCopy(loss.state,loss.args).state.logs[0],
    /^\[DAY 4\] 내 디지몬이 패배했어/);
});
test('log trimming and FIFO order match legacy say() limit of 60 entries',()=>{
  const {state,args}=sample(0);
  state.logs=Array.from({length:75},(_,i)=>'old '+i);
  const staged=Commit.stageCopy(state,args);
  assert.equal(staged.state.logs.length,60);
  assert.equal(staged.state.logs[1],'old 0');
  assert.equal(staged.state.logs[59],'old 58');
  assert.equal(state.logs.length,75);
});
test('commit writes one complete result, then rejects stale replay across tabs',()=>{
  const {state,args}=sample(0),before=JSON.stringify(state);
  const storage=fakeStorage(before);
  const result=Commit.persistCopy(state,args,storage);
  assert.equal(storage.count(),1,'only one all-or-nothing save write');
  assert.deepEqual(JSON.parse(storage.snapshot()),result.state);
  assert.equal(JSON.stringify(state),before,'caller must still own the old state');
  assert.throws(()=>Commit.persistCopy(state,args,storage),/stale/);
  assert.equal(storage.count(),1,'old tab cannot overwrite newer completed battle');
  const restored=JSON.parse(storage.snapshot());
  assert.throws(()=>Commit.persistCopy(restored,args,storage),/No matching active owned battle/);
  assert.equal(storage.count(),1);
});
test('storage write failure throws before returning adoptable state and leaves save unchanged',()=>{
  const {state,args}=sample(0),before=JSON.stringify(state);
  const storage=fakeStorage(before,{throwOnSet:true});
  assert.throws(()=>Commit.persistCopy(state,args,storage),/QuotaExceededError/);
  assert.equal(storage.snapshot(),before,'disk remains pre-battle snapshot');
  assert.equal(JSON.stringify(state),before,'live state remains unchanged');
  assert.equal(storage.count(),1,'no automatic retry or partial write');
});
test('no lost progress: missing/stale/blocked storage fails closed',()=>{
  const {state,args}=sample(1),before=JSON.stringify(state);
  const stale=fakeStorage('{"newer":"player progress"}');
  assert.throws(()=>Commit.persistCopy(state,args,stale),/stale/);
  assert.equal(stale.count(),0);
  const missing=fakeStorage(null);
  assert.throws(()=>Commit.persistCopy(state,args,missing),/stale/);
  assert.equal(missing.count(),0);
  const unreadable=fakeStorage(before,{throwOnGet:true});
  assert.throws(()=>Commit.persistCopy(state,args,unreadable),/Storage read blocked/);
  assert.equal(unreadable.count(),0);
  assert.throws(()=>Commit.persistCopy(state,args,{setItem(){}}),/storage required/);
  assert.equal(JSON.stringify(state),before);
});
test('callback mutation during stage prevents storage commit',()=>{
  const {state,args}=sample(0),before=JSON.stringify(state);
  const storage=fakeStorage(before);
  // A future species lookup is user-supplied; never commit if it mutates
  // the active save while the detached result is being computed.
  const unsafe={...args,lookup:()=>{state.points=999;return null;}};
  assert.throws(()=>Commit.persistCopy(state,unsafe,storage),/changed during settlement/);
  assert.equal(storage.snapshot(),before);
  assert.equal(storage.count(),0);
});
test('new commit module is not attached to live HTML or implicit browser storage',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../src/battle-commit-core.js'),'utf8');
  const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const standalone=fs.readFileSync(path.join(__dirname,'../standalone.html'),'utf8');
  assert.doesNotMatch(code,/\b(?:localStorage|sessionStorage)\s*(?:\.|\[)/);
  assert.doesNotMatch(index,/\bDCBattleCommit\b/);
  assert.doesNotMatch(standalone,/\bDCBattleCommit\b/);
});
