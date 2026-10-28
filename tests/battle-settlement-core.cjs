'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const S=require('../src/battle-settlement-core.js');
const Arena=require('../src/arena-original-core.js');
const Cups=require('../src/championship-core.js');
const Evo=require('../src/evolution-core.js');

const lookup=()=>null; // never invent a species/evolution in tests
const mon=(id,name,hp)=>({instanceId:id,name,hp,maxHp:140,atk:50,
  def:25,spd:48,tp:85,maxTp:95,level:1,exp:0,friendship:20,
  hunger:20,fatigue:10,stage:'성장기',evo:{battles:0,wins:0}});
function state(){
  return {saveVersion:4,day:1,wins:1,losses:0,points:10,
    facilityCredits:0,logs:[],selected:0,
    team:[mon('id-a','아구몬',130),mon('id-b','아구몬',110)],
    pendingBattle:{id:'battle-01',participants:['id-a','id-b']}};
}
function run(s){
  const sim=Arena.createMatch({allies:s.team,
    opponents:Arena.defaultTeam(1).slice(0,2),teamSize:2,seed:20261028});
  const initial=Arena.snapshot(sim.fighters.filter(f=>f.side===0));
  for(let n=0;n<4200&&!sim.finished;n++)Arena.step(sim,1/30);
  assert.equal(sim.finished,true);
  return {battleId:s.pendingBattle.id,final:Arena.snapshot(sim),initial,lookup};
}
test('atomic 2v2 original battle settles by instance ID, never by name',()=>{
  const original=state(),before=JSON.stringify(original),result=run(original);
  const settled=S.settleCopy(original,result);
  assert.equal(JSON.stringify(original),before,'original save cannot be mutated');
  assert.equal(settled.state.pendingBattle,undefined);
  assert.equal(settled.receipt.battleId,'battle-01');
  assert.deepEqual(settled.receipt.participants.sort(),['id-a','id-b']);
  for(const change of settled.receipt.changes){
    const current=settled.state.team.find(m=>m.instanceId===change.instanceId);
    assert.equal(current.hp,change.hp);
    assert.equal(current.tp,change.tp);
    assert.equal(current.maxTp,change.maxTp);
    assert.ok(change.hp<=140);
    assert.equal(current.evo.battles,1);
    assert.equal(current.evo.wins,result.final.winner===0?1:0);
  }
  if(result.final.winner===0){
    assert.equal(settled.state.wins,2);
    assert.equal(settled.state.points,12);
    assert.equal(settled.state.team[0].friendship,22);
  }else assert.equal(settled.state.losses,1);
  assert.throws(()=>S.settleCopy(settled.state,result),/active owned battle/);
  assert.equal(JSON.stringify(original),before);
});

test('reject unfinished, replayed, stale and swapped fighters before mutation',()=>{
  const s=state(),result=run(s),baseline=JSON.stringify(s);
  const invalid=[
    {...result,battleId:'different'},
    {...result,final:{...result.final,finished:false}},
    {...result,initial:result.initial.map(f=>({...f,hp:f.hp+1}))},
    {...result,final:{...result.final,fighters:result.final.fighters.map(
      (f,i)=>i===0?{...f,instanceId:'id-b'}:f)}},
    {...result,initial:[result.initial[0],result.initial[0]]},
    {...result,lookup:null}
  ];
  for(const bad of invalid){
    assert.throws(()=>S.settleCopy(s,bad));
    assert.equal(JSON.stringify(s),baseline);
  }
  const duplicate=state();
  duplicate.team[1].instanceId='id-a';
  assert.throws(()=>S.settleCopy(duplicate,result),/duplicate/);
  const noPending=state();delete noPending.pendingBattle;
  assert.throws(()=>S.settleCopy(noPending,result),/active owned battle/);
});

test('tournament settlement uses existing bracket core and refuses mismatched match IDs',()=>{
  const s=state();delete s.pendingBattle;
  const entered=Cups.enter(s,'novice');
  assert.equal(entered.ok,true);
  const match=Cups.nextMatch(s);
  assert.equal(Cups.beginMatch(s,match.matchId).ok,true);
  s.pendingBattle={id:'cup-battle-1',participants:['id-a','id-b'],
    tournamentMatchId:match.matchId};
  const result=run(s);
  const old=JSON.stringify(s);
  const done=S.settleCopy(s,result);
  assert.equal(JSON.stringify(s),old);
  assert.equal(done.receipt.tournamentMatchId,match.matchId);
  assert.equal(done.state.pendingBattle,undefined);
  if(result.final.winner===0){
    assert.equal(done.state.championship.active.round,1);
    assert.equal(done.receipt.cup.complete,false);
  }else{
    assert.equal(done.state.championship.active,null);
    assert.equal(done.receipt.cup.complete,true);
  }
  const mismatch=JSON.parse(old);
  mismatch.pendingBattle.tournamentMatchId='cup-bad-round-0';
  assert.throws(()=>S.settleCopy(mismatch,result),/Tournament match identity/);
});

test('legacy experience progression still uses the original quadratic formula',()=>{
  const m={level:1,exp:0,maxHp:100,hp:60,atk:20,def:10};
  assert.equal(S.grantExperience(m,10),0);
  assert.equal(m.exp,10);
  assert.equal(S.grantExperience(m,40),1);
  assert.equal(m.level,2);
  assert.equal(m.maxHp,108);
  assert.equal(m.hp,68);
});

test('settlement module never writes storage and is not yet active in the UI',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../src/battle-settlement-core.js'),'utf8');
  assert.doesNotMatch(code,/localStorage|sessionStorage|setItem\(/);
  assert.match(code,/E\.recordBattle\(next,ids,won,lookup\)/);
  assert.match(code,/C\.finishMatch\(next,pending\.tournamentMatchId,won\)/);
  assert.equal(typeof Evo.recordBattle,'function');
});
