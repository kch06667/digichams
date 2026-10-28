'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const TOKEN='a'.repeat(32);
// Exercise EXACT checked-in original HTML championship rules, rather than
// assuming a locally enhanced bracket or a separate historical module.
function realGame(){
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const match=html.match(/<script id="championship-core-v023">([\s\S]*?)<\/script>/);
  assert.ok(match,'Original embedded championship code missing');
  const root={};root.globalThis=root;vm.createContext(root);
  vm.runInContext(match[1],root);
  root.DCEvolution=require('../src/evolution-core.js');
  for(const file of ['battle-settlement-core.js','battle-commit-core.js',
    'dev-phaser-commit.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),root);
  return {C:root.DCChampionship,D:root.DCDevPhaserCommit};
}
const clone=x=>JSON.parse(JSON.stringify(x));
function mon(i=0){return {instanceId:'qa-'+i,name:'아구몬',stage:'성장기',
  hp:130,maxHp:140,tp:85,maxTp:95,atk:50,def:25,spd:48,
  level:1,exp:0,friendship:20,evo:{battles:0,wins:0},
  egg:false,lost:false,location:'farm'};}
function game(){
  return {saveVersion:4,day:1,wins:0,losses:0,points:3,
    facilityCredits:7,logs:[],team:[mon()],championship:null};
}
function normalize(match){
  const team=match.opponentTeam||Array.from({length:match.size},(_,i)=>
    i===0?match.opponent:'대회상대'+i);
  return {...match,opponentTeam:team,trainer:match.trainer||'상대 테이머'};
}
function packet(state,launch,match,won=true){
  const initial=launch.lineupIndices.map((idx,slot)=>{
    const m=state.team[idx];return {id:'0-'+slot,slot,side:0,
      name:m.name,hp:m.hp,max:m.maxHp,tp:m.tp,maxTp:m.maxTp,
      atk:m.atk,def:m.def,spd:m.spd};
  });
  const allies=initial.map(f=>({...f,hp:won?60:0,tp:20}));
  const foes=match.opponentTeam.map((name,slot)=>{
    const foe={name,hp:100,maxHp:100,atk:15,def:9,spd:11,
      maxTp:70,tp:70};
    return {...foe,id:'1-'+slot,side:1,slot,max:foe.maxHp};
  });
  launch.tournament.opponents=foes.map(f=>({
    name:f.name,hp:f.hp,maxHp:f.maxHp,atk:f.atk,def:f.def,
    spd:f.spd,maxTp:f.maxTp,tp:f.tp
  }));
  const finals=foes.map(f=>({...f,hp:won?0:80}));
  return {preview:{type:'read-only-battle-result',winner:won?0:1,elapsed:20,
    saveApplied:false,rewardsApplied:false,
    changes:initial.map((f,slot)=>({teamIndex:launch.lineupIndices[slot],
      fighterId:f.id,name:f.name,hpBefore:f.hp,
      hpAfter:allies[slot].hp,tpBefore:f.tp,tpAfter:allies[slot].tp}))},
    initial,opponentsInitial:foes,
    final:{finished:true,winner:won?0:1,elapsed:20,
      fighters:[...allies,...finals]},
    tournament:{cupId:match.cupId,matchId:match.matchId,
      round:match.round,trainer:match.trainer,
      opponentTeam:match.opponentTeam.slice(),size:match.size}
  };
}
test('checked-in original novice cup: semi then final awards only one prize',()=>{
  const {C,D}=realGame();let state=game();assert.equal(C.enter(state,'novice').ok,true);
  if(state.championship.active.bracket)
    assert.equal(state.championship.active.bracket.rounds.length,2);
  for(let round=0;round<2;round++){
    const match=normalize(C.nextMatch(state));
    assert.equal(match.round,round);
    assert.equal(C.beginMatch(state,match.matchId).ok,true);
    const launch=D.capture(state,{teamSize:match.size,leadIndex:0,
      tournament:match});
    const result=D.stage(state,launch,packet(state,launch,match,true),TOKEN,()=>null);
    assert.equal(result.receipt.tournamentMatchId,match.matchId);
    assert.equal(result.receipt.cup.complete,round===1);
    assert.equal(result.receipt.winner,0);
    state=clone(result.state);
  }
  assert.equal(state.wins,2);
  assert.equal(state.points,11);
  assert.equal(state.facilityCredits,267);
  assert.equal(state.championship.crowns.novice,1);
  if(state.championship.matchHistory)
    if(C.ROSTERS&&state.championship.matchHistory)
    assert.equal(state.championship.matchHistory.length,2);
  assert.equal(state.championship.active,null);
  if(state.championship.lastResult.bracket)
    assert.equal(state.championship.lastResult.bracket.rounds[1][0].winner,'player');
});
test('checked-in original novice cup: final loss eliminates without crown or prize',()=>{
  const {C,D}=realGame();let state=game();C.enter(state,'novice');
  for(let round=0;round<2;round++){
    const match=normalize(C.nextMatch(state));C.beginMatch(state,match.matchId);
    const launch=D.capture(state,{teamSize:1,tournament:match});
    state=clone(D.stage(state,launch,packet(state,launch,match,round===0),
      TOKEN,()=>null).state);
  }
  assert.equal(state.wins,1);assert.equal(state.losses,1);
  assert.equal(state.championship.crowns.novice||0,0);
  assert.equal(state.championship.lastResult.won,false);
  if(C.ROSTERS&&state.championship.matchHistory)
    assert.equal(state.championship.matchHistory.length,2);
  assert.equal(state.facilityCredits,7);
});
test('checked-in original grand cup: all source-defined rounds grant one trophy',()=>{
  const {C,D}=realGame();let state=game();state.day=10;state.wins=5;
  state.team=[mon(0),mon(1),mon(2)];
  state.championship={active:null,crowns:{novice:1,regional:1},history:[],
    matchHistory:[],sequence:2,rank:2,lastResult:null};
  assert.equal(C.enter(state,'grand').ok,true);
  const rounds=state.championship.active.bracket?.rounds.length||2;
  for(let round=0;round<rounds;round++){
    const match=normalize(C.nextMatch(state));
    assert.equal(match.size,3);
    if(state.championship.active.bracket)
      assert.deepEqual(clone(match.opponentTeam),
        clone(state.championship.active.bracket.participants.find(
          p=>p.trainer===match.trainer).team));
    C.beginMatch(state,match.matchId);
    const launch=D.capture(state,{teamSize:3,tournament:match});
    state=clone(D.stage(state,launch,packet(state,launch,match,true),
      TOKEN,()=>null).state);
  }
  assert.equal(state.championship.crowns.grand,1);
  if(C.ROSTERS&&state.championship.matchHistory)
    assert.equal(state.championship.matchHistory.length,rounds);
  assert.equal(state.facilityCredits,1407);
  assert.equal(state.championship.active,null);
});
test('tournament match forgery, active match mutation, missing opponent and replay refused',()=>{
  const {C,D}=realGame();const state=game();C.enter(state,'novice');
  const match=normalize(C.nextMatch(state));C.beginMatch(state,match.matchId);
  const launch=D.capture(state,{tournament:match});
  const p=packet(state,launch,match);
  const modified=clone(p);modified.tournament.matchId='cup-evil-round-0';
  assert.throws(()=>D.stage(state,launch,modified,TOKEN,()=>null),
    /Tournament bracket/);
  const foe=clone(p);foe.opponentsInitial[0].name='가짜몬';
  assert.throws(()=>D.stage(state,launch,foe,TOKEN,()=>null),
    /opponents/);
  const change=clone(state);change.championship.active.round=1;
  assert.throws(()=>D.stage(change,launch,p,TOKEN,()=>null),
    /Tournament bracket/);
  const settled=D.stage(state,launch,p,TOKEN,()=>null);
  assert.throws(()=>D.stage(settled.state,launch,p,TOKEN,()=>null),
    /Tournament bracket|completed|match/);
  const falseMatch={...match,opponent:'가짜몬',opponentTeam:['가짜몬']};
  assert.throws(()=>D.capture(state,{tournament:falseMatch}),/championship definition|Opponent roster/);
});
