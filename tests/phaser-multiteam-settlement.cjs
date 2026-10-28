'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../src/dev-phaser-commit.js');
const Commit=require('../src/battle-commit-core.js');
const TOKEN='a'.repeat(32);
const names=['아구몬','파타몬','팔몬','가부몬'];
const copy=x=>structuredClone(x);
function make(size,winner=0,leadIndex=0){
  const team=names.map((name,i)=>({instanceId:'owned-'+i,name,
    stage:'성장기',hp:130+i*10,maxHp:140+i*10,
    tp:60+i*5,maxTp:90+i*5,atk:48+i*9,def:20+i*4,spd:45+i*7,
    level:1,exp:0,friendship:20,hunger:0,fatigue:0,
    egg:false,lost:false,location:'farm',evo:{battles:0,wins:0}}));
  const state={saveVersion:4,day:4,wins:0,losses:0,points:7,
    logs:[],facilityCredits:0,team};
  const launch=D.capture(state,{teamSize:size,leadIndex});
  const initial=launch.lineupIndices.map((index,slot)=>{
    const m=team[index];return {id:'0-'+slot,side:0,slot,name:m.name,
      hp:m.hp,max:m.maxHp,tp:m.tp,maxTp:m.maxTp,
      atk:m.atk,def:m.def,spd:m.spd};
  });
  const allies=initial.map((m,slot)=>({...m,hp:37.3+slot,tp:22.8+slot}));
  const foes=initial.map((m,slot)=>({id:'1-'+slot,side:1,slot,
    name:'상대'+slot,hp:winner===0?0:80,max:150,tp:50,maxTp:90}));
  const preview={type:'read-only-battle-result',winner,elapsed:29,
    saveApplied:false,rewardsApplied:false,
    changes:initial.map((m,slot)=>({
      teamIndex:launch.lineupIndices[slot],fighterId:m.id,name:m.name,
      hpBefore:m.hp,hpAfter:allies[slot].hp,
      tpBefore:m.tp,tpAfter:allies[slot].tp}))};
  return {state,launch,packet:{initial,final:{
    finished:true,winner,elapsed:29,fighters:[...allies,...foes]},
    preview},lookup:()=>null};
}
function storage(raw,blocked=null){
  const map=new Map([[Commit.SAVE_KEY,raw]]);
  const writes=[];
  return {getItem:k=>map.has(k)?map.get(k):null,
    setItem(k,v){writes.push(k);if(k===blocked)throw Error('blocked backup');
      map.set(k,v);
    },writes,get:k=>map.get(k)};
}
for(const size of [2,3])for(const winner of [0,1]){
  test(size+'v'+size+' '+(winner===0?'win':'loss')+
    ' grants exact per-slot HP/TP, one team result and every evolution record',()=>{
    // In 3v3, leader is intentionally NOT first in the original farm list.
    const a=make(size,winner,size===3?1:0);
    const input=JSON.stringify(a.state);
    const result=D.stage(a.state,a.launch,a.packet,TOKEN,a.lookup);
    assert.equal(JSON.stringify(a.state),input);
    assert.equal(result.state.pendingBattle,undefined);
    assert.equal(result.state.wins,winner===0?1:0);
    assert.equal(result.state.losses,winner===1?1:0);
    assert.equal(result.state.points,7+(winner===0?2:0));
    assert.deepEqual(result.receipt.participants,
      a.launch.lineupIndices.map(i=>a.state.team[i].instanceId));
    for(let slot=0;slot<size;slot++){
      const i=a.launch.lineupIndices[slot],mon=result.state.team[i];
      assert.equal(mon.hp,Math.ceil(37.3+slot));
      assert.equal(mon.tp,Math.floor(22.8+slot));
      assert.equal(mon.evo.battles,1);
      assert.equal(mon.evo.wins,winner===0?1:0);
      assert.equal(mon.exp,winner===0?10:0);
    }
    for(let i=0;i<a.state.team.length;i++){
      if(!a.launch.lineupIndices.includes(i))
        assert.deepEqual(result.state.team[i],a.state.team[i]);
    }
  });
}
test('3v3 saved exactly once after first + latest backup; second packet rejected',()=>{
  const a=make(3,0,1),input=JSON.stringify(a.state),db=storage(input);
  const staged=D.persist(a.state,a.launch,a.packet,TOKEN,a.lookup,db);
  assert.deepEqual(JSON.parse(db.get(Commit.SAVE_KEY)),staged.state);
  assert.equal(db.get(D.BACKUP_KEY),input);
  assert.equal(db.get(D.FIRST_BACKUP_KEY),input);
  assert.deepEqual(db.writes,[D.FIRST_BACKUP_KEY,D.BACKUP_KEY,Commit.SAVE_KEY]);
  assert.throws(()=>D.persist(a.state,a.launch,a.packet,TOKEN,a.lookup,db),
    /not saved|changed/);
});
test('multi-team slot swap, duplicate index, replaced actor and stale stats are denied',()=>{
  const a=make(3);
  const wrong=copy(a.packet);
  [wrong.preview.changes[0],wrong.preview.changes[1]]=
    [wrong.preview.changes[1],wrong.preview.changes[0]];
  assert.throws(()=>D.stage(a.state,a.launch,wrong,TOKEN,a.lookup),/changed/);
  const duplicate=copy(a.packet);
  duplicate.preview.changes[1].teamIndex=duplicate.preview.changes[0].teamIndex;
  assert.throws(()=>D.stage(a.state,a.launch,duplicate,TOKEN,a.lookup),/changed/);
  const forged=copy(a.packet);
  forged.preview.changes[2].tpAfter=999;
  assert.throws(()=>D.stage(a.state,a.launch,forged,TOKEN,a.lookup),/does not match/);
  const renamed=copy(a.state);
  renamed.team[1].instanceId='new-owned-instance';
  assert.throws(()=>D.stage(renamed,a.launch,a.packet,TOKEN,a.lookup),/changed/);
  const training=copy(a.state);
  training.team[2].atk+=1;
  assert.throws(()=>D.stage(training,a.launch,a.packet,TOKEN,a.lookup),/changed/);
  const duplicateIdentity=copy(a.state);
  duplicateIdentity.team[1].instanceId=duplicateIdentity.team[0].instanceId;
  assert.throws(()=>D.stage(duplicateIdentity,a.launch,a.packet,TOKEN,a.lookup),
    /changed|Duplicate/);
});
test('unfinished battle, missing combat actor, wrong winner and pending match denied',()=>{
  const a=make(2);
  const missing=copy(a.packet);
  missing.final.fighters.pop();
  assert.throws(()=>D.stage(a.state,a.launch,missing,TOKEN,a.lookup),/completed/);
  const unfinished=copy(a.packet);
  unfinished.final.finished=false;
  assert.throws(()=>D.stage(a.state,a.launch,unfinished,TOKEN,a.lookup),/completed/);
  const fakeWinner=copy(a.packet);
  fakeWinner.final.winner=1;
  assert.throws(()=>D.stage(a.state,a.launch,fakeWinner,TOKEN,a.lookup),/completed/);
  const busy=copy(a.state);
  busy.pendingBattle={id:'other',participants:['owned-0']};
  assert.throws(()=>D.stage(busy,a.launch,a.packet,TOKEN,a.lookup),/completed/);
  assert.throws(()=>D.stage(a.state,a.launch,a.packet,'bad',a.lookup),/completed/);
});
test('stale stored snapshot and blocked backup never change authoritative save',()=>{
  const a=make(3),input=JSON.stringify(a.state);
  const stale=storage('{"newer":"farm"}');
  assert.throws(()=>D.persist(a.state,a.launch,a.packet,TOKEN,a.lookup,stale),
    /another tab/);
  assert.equal(stale.writes.length,0);
  const blocked=storage(input,D.BACKUP_KEY);
  assert.throws(()=>D.persist(a.state,a.launch,a.packet,TOKEN,a.lookup,blocked),
    /blocked backup/);
  assert.equal(blocked.get(Commit.SAVE_KEY),input);
  assert.deepEqual(blocked.writes,[D.FIRST_BACKUP_KEY,D.BACKUP_KEY]);
  assert.equal(JSON.stringify(a.state),input);
});
