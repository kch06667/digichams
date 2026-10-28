'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Commit=require('../src/battle-commit-core.js');
const Evolution=require('../src/evolution-core.js');

const copy=v=>JSON.parse(JSON.stringify(v));
function state(version=1){
  const member={instanceId:'legacy-id-1',name:'아구몬',stage:'성장기',
    hp:100,maxHp:120,tp:36,maxTp:55,atk:27,def:17,spd:18,
    level:2,exp:8,friendship:34,legacyNote:'keep legacy roster metadata'};
  const s={saveVersion:version,day:12,logs:['[DAY 12] 오래된 세이브'],
    wins:2,losses:1,points:14,facilityCredits:98,
    farm:{actors:{'legacy-id-1':{mode:'idle',goal:null}}},
    inventory:{unrecognizedOldSaveField:17},team:[member],
    pendingBattle:{id:'legacy-battle-1',participants:['legacy-id-1']}};
  return s;
}
function result(s){
  const m=s.team[0];
  const before={id:'ally-1',side:0,slot:0,instanceId:m.instanceId,name:m.name,
    hp:m.hp,max:m.maxHp,tp:m.tp,maxTp:m.maxTp};
  return {battleId:s.pendingBattle.id,initial:[before],lookup:()=>null,
    final:{finished:true,winner:0,elapsed:19,fighters:[
      {...before,hp:77.2,tp:18.9},
      {id:'enemy',side:1,slot:0,name:'상대',hp:0,max:80,tp:0,maxTp:60}
    ]}};
}
function disk(value,mode='normal'){
  let raw=value,writes=0,reads=0;
  return {getItem(key){
    assert.equal(key,Commit.SAVE_KEY);reads++;
    if(mode==='throw-on-verify' && reads===3)throw Error('Readback denied');
    return raw;
  },setItem(key,value){
    assert.equal(key,Commit.SAVE_KEY);writes++;
    if(mode==='quota')throw new Error('QuotaExceededError');
    if(mode!=='silent-drop')raw=value;
  },snapshot:()=>raw,writes:()=>writes,reads:()=>reads};
}
test('legacy save v1 retains unknown fields through cloned settlement only after an explicit checkpoint',()=>{
  const s=state(),baseline=JSON.stringify(s),args=result(s),storage=disk(baseline);
  const settled=Commit.persistCopy(s,args,storage);
  assert.equal(storage.writes(),1);
  assert.equal(storage.reads(),3,'save must be verified after write');
  assert.equal(JSON.stringify(s),baseline,'old in-memory save must stay intact');
  assert.deepEqual(JSON.parse(storage.snapshot()),settled.state);
  assert.equal(settled.state.saveVersion,4,'evolution-core upgrades the staged copy');
  assert.equal(settled.state.inventory.unrecognizedOldSaveField,17);
  assert.equal(settled.state.team[0].legacyNote,'keep legacy roster metadata');
  assert.equal(settled.state.team[0].instanceId,'legacy-id-1');
  assert.equal(settled.state.team[0].level,2);
  assert.equal(settled.state.pendingBattle,undefined);
  assert.equal(s.saveVersion,1);
  assert.equal(s.team[0].evo,undefined);
  assert.throws(()=>Commit.persistCopy(s,args,storage),/stale/);
});
test('old v1 save without instance ID is never rewritten by an inferred new ID',()=>{
  const s=state();
  delete s.team[0].instanceId;
  s.pendingBattle.participants=['missing-old-id'];
  const raw=JSON.stringify(s),storage=disk(raw);
  assert.throws(()=>Commit.persistCopy(s,result(s),storage),/identity/);
  assert.equal(storage.snapshot(),raw);
  assert.equal(storage.writes(),0);
});
test('old raw disk + migrated memory must not silently overwrite pre-migration backup',()=>{
  const raw=state();
  delete raw.pendingBattle;delete raw.team[0].instanceId;
  const diskBytes=JSON.stringify(raw);
  const migrated=copy(raw);
  migrated.team[0].instanceId='new-stable-id';
  Evolution.ensure(migrated);
  migrated.pendingBattle={id:'checkpoint-needed',participants:['new-stable-id']};
  const args=result(migrated);
  const storage=disk(diskBytes),before=JSON.stringify(migrated);
  assert.throws(()=>Commit.persistCopy(migrated,args,storage),/stale/);
  assert.equal(storage.snapshot(),diskBytes,'original old save still on disk');
  assert.equal(storage.writes(),0);
  assert.equal(JSON.stringify(migrated),before);
  // The future caller must separately back up and persist the *exact* migrated
  // checkpoint before beginning a battle. The helper never auto-migrates disk.
  const upgradedStorage=disk(before);
  const done=Commit.persistCopy(migrated,args,upgradedStorage);
  assert.equal(done.state.pendingBattle,undefined);
  assert.equal(done.state.team[0].instanceId,'new-stable-id');
  assert.equal(upgradedStorage.writes(),1);
});
test('a no-op Web Storage adapter cannot falsely report commit success',()=>{
  const s=state(),before=JSON.stringify(s),storage=disk(before,'silent-drop');
  assert.throws(()=>Commit.persistCopy(s,result(s),storage),/verification failed/);
  assert.equal(storage.snapshot(),before);
  assert.equal(JSON.stringify(s),before);
  assert.equal(storage.writes(),1);
});
test('readback denial after an ambiguous write refuses state adoption and never rolls back new data',()=>{
  const s=state(),before=JSON.stringify(s),storage=disk(before,'throw-on-verify');
  assert.throws(()=>Commit.persistCopy(s,result(s),storage),/Readback denied/);
  assert.equal(storage.writes(),1);
  assert.equal(JSON.stringify(s),before);
  assert.notEqual(storage.snapshot(),before,'a write might already have committed');
  // Do NOT attempt rollback: it might overwrite newer data from another tab.
  assert.throws(()=>Commit.persistCopy(s,result(s),storage),/stale/);
});
test('quota errors preserve old raw save with no mutation',()=>{
  const s=state(),before=JSON.stringify(s),storage=disk(before,'quota');
  assert.throws(()=>Commit.persistCopy(s,result(s),storage),/QuotaExceededError/);
  assert.equal(JSON.stringify(s),before);
  assert.equal(storage.snapshot(),before);
  assert.equal(storage.writes(),1);
});
