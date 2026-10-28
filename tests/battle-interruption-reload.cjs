'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Cups = require('../src/championship-core.js');
const Settlement = require('../src/battle-settlement-core.js');

// Execute the existing HTML startup handler itself, never a reimplementation.
// The isolated VM has no real browser storage or access to a live save.
function startup(page, saved){
  const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
  const begin = html.indexOf('if(state.pendingBattle){DCChampionship.interrupted(state,state.pendingBattle)');
  const end = html.indexOf('const $=id=>', begin);
  assert.ok(begin >= 0 && end > begin, `${page}: startup interruption handler missing`);
  const state = JSON.parse(JSON.stringify(saved));
  let persisted = null;
  let writes = 0;
  vm.runInNewContext(html.slice(begin, end), {
    state,
    DCChampionship: Cups,
    localStorage: {setItem(key, value){
      assert.equal(key, 'dc_recreation_save');
      persisted = value;
      writes++;
    }}
  }, {timeout: 1000});
  return {state, writes, persisted: persisted ? JSON.parse(persisted) : null};
}
function mon(i, hp=90, tp=28){return {instanceId:'mon-'+i,name:'아구몬',
  hp,maxHp:140,tp,maxTp:95,level:1,exp:0,friendship:20,atk:50,def:25,spd:48,
  hunger:20,fatigue:10,stage:'성장기',evo:{battles:0,wins:0}};}
function save(size=1){
  return {saveVersion:4,day:1,wins:2,losses:3,points:12,facilityCredits:41,
    team:Array.from({length:size},(_,i)=>mon(i,90-10*i,28-4*i)),logs:['이전 기록'],
    pendingBattle:{id:'battle-reload-1',participants:Array.from({length:size},(_,i)=>'mon-'+i)}};
}
function vitals(state){return state.team.map(m=>[m.instanceId,m.hp,m.tp,m.exp,m.level,m.friendship]);}
function staleResult(){return {battleId:'battle-reload-1',lookup:()=>null,
  initial:[],final:{finished:true,winner:0,elapsed:30,fighters:[]}};}

for(const page of ['index.html','standalone.html']){
  test(`${page}: reload of interrupted owned 3v3 keeps last saved HP/TP, counts loss once`,()=>{
    const old=save(3),original=JSON.stringify(old),beforeVitals=vitals(old);
    const first=startup(page,old);
    assert.equal(JSON.stringify(old),original,'original serialized save must not mutate');
    assert.equal(first.writes,1,'interruption must be saved once');
    assert.ok(first.persisted,'must persist the interruption result');
    assert.equal(first.state.pendingBattle,undefined);
    assert.equal(first.state.losses,old.losses+1);
    assert.equal(first.state.wins,old.wins);
    assert.equal(first.state.points,old.points);
    assert.equal(first.state.facilityCredits,old.facilityCredits);
    assert.deepEqual(vitals(first.state),beforeVitals);
    assert.deepEqual(vitals(first.persisted),beforeVitals);
    assert.match(first.state.logs[0],/중단된 실제 출전을 패배로 정리/);
    const second=startup(page,first.persisted);
    assert.equal(second.writes,0,'reloading a settled interruption must not save again');
    assert.equal(second.state.losses,old.losses+1,'replay cannot add a second loss');
    assert.equal(second.state.logs.length,first.state.logs.length);
    assert.deepEqual(vitals(second.state),beforeVitals);
    assert.throws(()=>Settlement.settleCopy(second.state,staleResult()),
      /No matching active owned battle/,'completed result must not apply after interrupted reload');
  });

  test(`${page}: abandoned championship match is a single elimination, not a prize`,()=>{
    const old=save(1);
    assert.equal(Cups.enter(old,'novice').ok,true);
    const match=Cups.nextMatch(old);
    assert.ok(match);
    assert.equal(Cups.beginMatch(old,match.matchId).ok,true);
    old.pendingBattle.tournamentMatchId=match.matchId;
    const original=JSON.stringify(old),beforeVitals=vitals(old);
    const first=startup(page,old);
    assert.equal(JSON.stringify(old),original);
    assert.equal(first.writes,1);
    assert.equal(first.state.losses,old.losses+1);
    assert.equal(first.state.championship.active,null);
    if(Array.isArray(first.state.championship.matchHistory)){
      assert.equal(first.state.championship.matchHistory.length,1);
      assert.equal(first.state.championship.matchHistory[0].won,false);
    }
    assert.equal(first.state.championship.history.length,1);
    assert.equal(first.state.championship.history[0].won,false);
    assert.equal(first.state.championship.history[0].prize,0);
    assert.equal(first.state.facilityCredits,old.facilityCredits);
    assert.equal(first.state.points,old.points);
    assert.deepEqual(vitals(first.state),beforeVitals);
    const second=startup(page,first.persisted);
    assert.equal(second.writes,0);
    assert.equal(second.state.losses,old.losses+1);
    if(Array.isArray(second.state.championship.matchHistory))
      assert.equal(second.state.championship.matchHistory.length,1);
    assert.equal(second.state.championship.history.length,1);
    assert.equal(second.state.facilityCredits,old.facilityCredits);
    assert.equal(second.state.points,old.points);
    assert.throws(()=>Settlement.settleCopy(second.state,staleResult()),
      /No matching active owned battle/);
  });

  test(`${page}: tournament awaiting without a pending battle clears stale lock without a forfeit`,()=>{
    const old=save(1);
    delete old.pendingBattle;
    assert.equal(Cups.enter(old,'novice').ok,true);
    const match=Cups.nextMatch(old);
    assert.equal(Cups.beginMatch(old,match.matchId).ok,true);
    const first=startup(page,old);
    assert.equal(first.writes,0);
    assert.equal(first.state.losses,old.losses);
    assert.equal(first.state.championship.active.awaiting,null);
    if(Array.isArray(first.state.championship.matchHistory))
      assert.equal(first.state.championship.matchHistory.length,0);
    assert.equal(first.state.championship.history.length,0);
    assert.equal(Cups.nextMatch(first.state).matchId,match.matchId);
  });
}
