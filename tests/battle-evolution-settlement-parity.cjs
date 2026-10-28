'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Evolution = require('../src/evolution-core.js');
const Championship = require('../src/championship-core.js');
const Settlement = require('../src/battle-settlement-core.js');
const Commit = require('../src/battle-commit-core.js');
const catalog = require('../assets/species-catalog.json').entries;

const species = new Map(catalog.map(entry => [entry.name, entry]));
const lookup = name => species.get(name) || null;
const copy = value => JSON.parse(JSON.stringify(value));

// Pull the actual original functions out of *both* HTML builds. Their match
// rules are the oracle; this test must never substitute its own settlement.
function legacyFunctions(file){
  const text = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const xpStart = text.indexOf('function grantExperience(');
  const xpEnd = text.indexOf('function migrateProgression(', xpStart);
  const battleStart = text.indexOf('function syncBattleHP(){');
  const battleEnd = text.indexOf('function start(asPreview=', battleStart);
  assert.ok(xpStart >= 0 && xpEnd > xpStart, file + ': XP source missing');
  assert.ok(battleStart >= 0 && battleEnd > battleStart, file + ': battle source missing');
  const arena = text.slice(battleStart, battleEnd);
  assert.match(arena, /function settleMatch\(won,aborted=false\)/);
  return text.slice(xpStart, xpEnd) + '\n' + arena;
}
function mon(name, id, battles, wins){
  const base = lookup(name);
  assert.ok(base, 'catalog species missing: ' + name);
  return {
    instanceId:id, name, stage:base.stage, emoji:base.emoji,
    hp:base.hp-5, maxHp:base.hp, tp:48, maxTp:95,
    atk:base.atk, def:base.def, spd:base.spd,
    level:1, exp:20, friendship:20,
    hunger:20, fatigue:10,
    evo:{battles,wins,stageDays:3,penalties:1,
      ap:{dragon:5,water:3},history:[],target:name==='코로몬'?'아구몬':undefined}
  };
}
function game(roster){
  const team = roster.map(([name,id,battles,wins])=>mon(name,id,battles,wins));
  const actors = {};
  for(const m of team)actors[m.instanceId]={
    mode:'travel',goal:'training',pose:2,remaining:25,resume:{mode:'training'},target:'core'
  };
  return {saveVersion:4,day:1,wins:1,losses:1,points:5,facilityCredits:15,
    logs:['[DAY 1] 준비'],team,farm:{actors}};
}
function matchup(state, winner, label, tournament=false){
  let cup=null;
  if(tournament){
    assert.equal(Championship.enter(state,'novice').ok,true);
    cup=Championship.nextMatch(state);
    assert.equal(Championship.beginMatch(state,cup.matchId).ok,true);
  }
  const battleId='evolution-'+label;
  state.pendingBattle={id:battleId,participants:state.team.map(m=>m.instanceId),
    ...(cup?{tournamentMatchId:cup.matchId}:{})};
  const initial=state.team.map((m,i)=>({
    id:'ally-'+i,side:0,slot:i,instanceId:m.instanceId,name:m.name,
    hp:m.hp,max:m.maxHp,tp:m.tp,maxTp:m.maxTp
  }));
  const fighters=[
    ...initial.map((f,i)=>({...f,hp:Math.max(1,f.hp-7.2-i),tp:35.8-i})),
    ...initial.map((f,i)=>({
      id:'foe-'+i,side:1,slot:i,name:'상대',
      hp:winner===0?0:40,max:120,tp:0,maxTp:95
    }))
  ];
  return {battleId,initial,final:{finished:true,winner,elapsed:27,fighters},cup};
}
function originalSettle(file,source,input,args){
  const state=copy(input);
  let saves=0;
  const messages=[];
  const ctx={
    state,matchState:state,ownedMatch:true,settled:false,
    fighters:copy(args.final.fighters),
    tournamentMatch:args.cup?copy(args.cup):null,
    DCEvolution:Evolution,DCChampionship:Championship,speciesLookup:lookup,
    controlsLocked:()=>{},render:()=>{},save:()=>{saves++;},
    say:message=>{
      messages.push(message);
      state.logs.unshift('[DAY '+state.day+'] '+message);
      state.logs=state.logs.slice(0,60);
    }
  };
  vm.runInNewContext(source+'\nsettleMatch('+(args.final.winner===0)+',false);',
    ctx,{filename:file+' settleMatch',timeout:2500});
  assert.equal(saves,2,file+' should save synced vitals and final result');
  assert.equal(ctx.settled,true);
  return {state,messages};
}
function runScenario(file,source,roster,winner,label,{tournament=false,evolvingIds=[]}={}){
  const initialState=game(roster);
  const result=matchup(initialState,winner,label,tournament);
  const baseline=JSON.stringify(initialState);
  const legacy=originalSettle(file,source,initialState,result);
  const modern=Commit.stageCopy(initialState,{
    battleId:result.battleId,initial:result.initial,
    final:result.final,lookup});
  assert.deepEqual(modern.state,legacy.state,
    file+' / '+label+': evolution, logs and all gameplay data must match legacy');
  assert.equal(JSON.stringify(initialState),baseline,'settlement must not change the input save');
  assert.equal(modern.state.pendingBattle,undefined);
  for(const id of evolvingIds){
    const old=initialState.team.find(m=>m.instanceId===id);
    const evolved=modern.state.team.find(m=>m.instanceId===id);
    const previousCount=old.evo.battles;
    assert.notEqual(evolved.name,old.name,label+': expected actual species transformation');
    assert.equal(evolved.evo.history.at(-1).from,old.name);
    assert.equal(evolved.evo.history.at(-1).to,evolved.name);
    assert.equal(evolved.evo.history.at(-1).battles,previousCount+1);
    assert.equal(evolved.evo.battles,previousCount+1);
    assert.equal(evolved.evo.wins,old.evo.wins+(winner===0?1:0));
    assert.equal(evolved.evo.stageDays,0);
    assert.equal(evolved.evo.penalties,0);
    assert.equal(evolved.evo.ap.dragon,0);
    assert.equal(modern.state.farm.actors[id].mode,'idle');
    assert.equal(modern.state.farm.actors[id].goal,null);
    assert.equal(modern.state.farm.actors[id].remaining,0);
    assert.ok(modern.state.logs.some(line=>line.includes(old.name+' → '+evolved.name+' 진화!')),
      'new settlement must preserve evolution notification');
    assert.ok(legacy.state.logs.some(line=>line.includes(old.name+' → '+evolved.name+' 진화!')),
      'original settlement must preserve evolution notification');
  }
  assert.ok(legacy.messages.some(m=>m.includes('승리')||m.includes('패배')||m.includes('라운드')));
  assert.equal(modern.receipt.battleId,result.battleId);
  assert.throws(()=>Settlement.settleCopy(modern.state,{
    battleId:result.battleId,initial:result.initial,final:result.final,lookup
  }),/No matching active owned battle/);
  return modern.state;
}
for(const file of ['index.html','standalone.html']){
  test(file+': victory evolves Koromon into Agumon and matches original saved state',()=>{
    const source=legacyFunctions(file);
    const s=runScenario(file,source,[['코로몬','k-01',2,1]],0,
      'koromon-victory',{evolvingIds:['k-01']});
    assert.equal(s.team[0].name,'아구몬');
    assert.equal(s.team[0].evo.battles,3);
    assert.equal(s.team[0].evo.wins,2);
  });
  test(file+': loss still triggers Patamon battle-count evolution',()=>{
    const source=legacyFunctions(file);
    const s=runScenario(file,source,[['파타몬','p-01',5,0]],1,
      'patamon-loss',{evolvingIds:['p-01']});
    assert.equal(s.team[0].name,'엔젤몬');
    assert.equal(s.team[0].evo.battles,6);
    assert.equal(s.team[0].evo.wins,0);
  });
  test(file+': only eligible instance evolves in duplicate-species 2v2',()=>{
    const source=legacyFunctions(file);
    const s=runScenario(file,source,
      [['코로몬','k-01',2,2],['코로몬','k-02',0,0]],0,
      'same-species-2v2',{evolvingIds:['k-01']});
    assert.equal(s.team.find(m=>m.instanceId==='k-01').name,'아구몬');
    assert.equal(s.team.find(m=>m.instanceId==='k-02').name,'코로몬');
    assert.equal(s.team.find(m=>m.instanceId==='k-02').evo.history.length,0);
  });
  test(file+': championship match can evolve before advancing its bracket',()=>{
    const source=legacyFunctions(file);
    const s=runScenario(file,source,[['코로몬','k-cup',2,1]],0,
      'cup-semi',{tournament:true,evolvingIds:['k-cup']});
    assert.equal(s.team[0].name,'아구몬');
    assert.equal(s.championship.active.round,1);
    assert.equal(s.championship.active.awaiting,null);
  });
}
