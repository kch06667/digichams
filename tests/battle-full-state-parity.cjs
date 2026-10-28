'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Settlement=require('../src/battle-settlement-core.js');
const Cups=require('../src/championship-core.js');
const Evo=require('../src/evolution-core.js');

// Read the real browser functions. Do not build a second imitation settlement.
function originalFunctions(page){
  const html=fs.readFileSync(path.resolve(__dirname,'..',page),'utf8');
  const xpStart=html.indexOf('function grantExperience(');
  const xpEnd=html.indexOf('function migrateProgression(',xpStart);
  const syncStart=html.indexOf('function syncBattleHP(){');
  const nextStart=html.indexOf('function start(asPreview=',syncStart);
  assert.ok(xpStart>=0&&xpEnd>xpStart,page+': original XP function moved');
  assert.ok(syncStart>=0&&nextStart>syncStart,page+': original arena settlement moved');
  const arena=html.slice(syncStart,nextStart);
  assert.match(arena,/function settleMatch\(won,aborted=false\)/);
  return html.slice(xpStart,xpEnd)+'\n'+arena;
}
function mon(i){
  return {instanceId:'instance-'+i,name:'아구몬',stage:'성장기',
    hp:130-10*i,maxHp:140,tp:85,maxTp:95,
    atk:50,def:25,spd:48,exp:i===0?20:0,level:1,friendship:20,
    hunger:20,fatigue:10,evo:{battles:0,wins:0}};
}
function fresh(size){
  return {saveVersion:4,day:1,wins:0,losses:0,points:3,facilityCredits:7,
    logs:['[DAY 1] 시작'],team:Array.from({length:size},(_,i)=>mon(i))};
}
function begin(state,roundTag,tournament=false){
  const tournamentMatch=tournament?Cups.nextMatch(state):null;
  if(tournament)assert.equal(Cups.beginMatch(state,tournamentMatch.matchId).ok,true);
  const id='match-'+roundTag;
  state.pendingBattle={id,participants:state.team.map(m=>m.instanceId),
    ...(tournament?{tournamentMatchId:tournamentMatch.matchId}:{})};
  return {id,tournamentMatch};
}
function encounter(state,winner,roundTag,tournament=false){
  const {id,tournamentMatch}=begin(state,roundTag,tournament);
  const initial=state.team.map((m,i)=>({
    id:'ally-'+i,side:0,slot:i,instanceId:m.instanceId,name:m.name,
    hp:m.hp,max:m.maxHp,tp:m.tp,maxTp:m.maxTp}));
  const fighters=[
    ...initial.map((f,i)=>({...f,hp:Math.max(0,f.hp-20.4-7*i),
      tp:Math.max(0,f.tp-10.7-3*i)})),
    ...Array.from({length:state.team.length},(_,i)=>({
      id:'foe-'+i,side:1,slot:i,name:'상대',hp:winner===0?0:40,
      max:140,tp:10,maxTp:95}))
  ];
  return {id,initial,final:{finished:true,winner,elapsed:42,fighters},
    tournamentMatch};
}
function legacyRun(page,source,state,result){
  const game=JSON.parse(JSON.stringify(state));
  let saves=0;
  const messages=[];
  const sandbox={
    state:game,matchState:game,ownedMatch:true,settled:false,
    fighters:result.final.fighters.map(f=>({...f})),
    tournamentMatch:result.tournamentMatch?{...result.tournamentMatch}:null,
    DCEvolution:Evo,DCChampionship:Cups,speciesLookup:()=>null,
    controlsLocked:()=>{},render:()=>{},save:()=>{saves++;},
    say:s=>{
      messages.push(s);
      game.logs.unshift('[DAY '+game.day+'] '+s);
      game.logs=game.logs.slice(0,60);
    }
  };
  vm.runInNewContext(source+'\nsettleMatch('+JSON.stringify(result.final.winner===0)+',false);',
    sandbox,{timeout:2000,filename:page+' original settleMatch'});
  assert.equal(saves,2,page+': original settlement must sync and save');
  assert.equal(sandbox.settled,true);
  return {state:game,messages};
}
function persistentGameplay(state){
  const copy=JSON.parse(JSON.stringify(state));
  // Legacy settleMatch writes player-facing 'say' logs; the isolated settlement
  // intentionally returns a receipt instead of changing UI logs. This is the
  // one intentional difference and must be bridged before live integration.
  delete copy.logs;
  return copy;
}
function compare(page,source,state,result,label){
  const baseline=JSON.stringify(state);
  const old=legacyRun(page,source,state,result);
  const modern=Settlement.settleCopy(state,{
    battleId:result.id,initial:result.initial,final:result.final,lookup:()=>null});
  assert.deepEqual(persistentGameplay(modern.state),persistentGameplay(old.state),
    page+' / '+label+': persisted gameplay fields differ from original HTML');
  assert.equal(JSON.stringify(state),baseline,page+' / '+label+': input was mutated');
  assert.deepEqual(modern.state.logs,state.logs,
    page+' / '+label+': settlement copy should leave source UI logs alone');
  assert.ok(old.messages.length>=1,'original game emits a result log');
  assert.equal(modern.receipt.won,result.final.winner===0);
  assert.equal(modern.state.pendingBattle,undefined);
  assert.throws(()=>Settlement.settleCopy(modern.state,{
    battleId:result.id,initial:result.initial,final:result.final,lookup:()=>null
  }),/No matching active owned battle/,'must reject duplicate settlement');
  return {old:old.state,modern:modern.state};
}
for(const page of ['index.html','standalone.html']){
  test(page+': 1v1, 2v2 and 3v3 owned battle state matches original HTML',()=>{
    const source=originalFunctions(page);
    for(const size of [1,2,3]){
      for(const winner of [0,1]){
        const state=fresh(size);
        const match=encounter(state,winner,'normal-'+size+'-'+winner);
        compare(page,source,state,match,size+'v'+size+' winner='+winner);
      }
    }
  });
  test(page+': championship semi-final and final clone matches original game',()=>{
    const source=originalFunctions(page);
    for(const finalWinner of [0,1]){
      const state=fresh(1);
      assert.equal(Cups.enter(state,'novice').ok,true);
      const semi=encounter(state,0,'cup-semi-'+finalWinner,true);
      const first=compare(page,source,state,semi,'semi-final');
      assert.equal(first.modern.championship.active.round,1);
      const final=encounter(first.modern,finalWinner,'cup-final-'+finalWinner,true);
      const second=compare(page,source,first.modern,final,'final '+finalWinner);
      assert.equal(second.modern.championship.active,null);
      assert.equal(second.modern.championship.history.length,1);
      assert.equal(second.modern.championship.history[0].won,finalWinner===0);
    }
  });
}
