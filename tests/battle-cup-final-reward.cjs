'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Settlement=require('../src/battle-settlement-core.js');
const Cups=require('../src/championship-core.js');

const lookup=()=>null; // do not invent ROM-confirmed evolution routes
function newMon(){
  return {instanceId:'raised-001',name:'아구몬',stage:'성장기',hp:130,
    maxHp:140,tp:85,maxTp:95,atk:50,def:25,spd:48,level:1,exp:6,
    friendship:20,hunger:20,fatigue:10,evo:{battles:0,wins:0}};
}
function fresh(){
  return {saveVersion:4,day:1,wins:0,losses:0,points:3,
    facilityCredits:7,logs:[],team:[newMon()]};
}
function completeRound(state,sequence,winner,hp,tp){
  const match=Cups.nextMatch(state);
  assert.ok(match,'expected a remaining original-core cup match');
  assert.equal(Cups.beginMatch(state,match.matchId).ok,true);
  const id='owned-final-parity-'+sequence;
  state.pendingBattle={id,participants:['raised-001'],tournamentMatchId:match.matchId};
  const mon=state.team[0];
  const before=JSON.stringify(state);
  const initial=[{id:'fighter-ally',side:0,slot:0,instanceId:mon.instanceId,
    name:mon.name,max:mon.maxHp,hp:mon.hp,maxTp:mon.maxTp,tp:mon.tp}];
  const final={finished:true,winner,elapsed:34,fighters:[
    {...initial[0],hp,tp},
    {id:'fighter-opponent',side:1,slot:0,name:'고부리몬',
      hp:winner===0?0:60,max:140,tp:0,maxTp:95}
  ]};
  const args={battleId:id,initial,final,lookup};
  const result=Settlement.settleCopy(state,args);
  assert.equal(JSON.stringify(state),before,'a valid match cannot mutate the original save');
  assert.equal(result.state.pendingBattle,undefined,'only the cloned state is settled');
  assert.equal(result.receipt.tournamentMatchId,match.matchId);
  assert.equal(result.receipt.won,winner===0);
  assert.deepEqual(result.receipt.participants,['raised-001']);
  return {state:result.state,receipt:result.receipt,args};
}

test('semi-final then final grants exactly one cup prize and preserves XP/evolution order',()=>{
  const original=fresh(),starting=JSON.stringify(original);
  assert.equal(Cups.enter(original,'novice').ok,true);
  const first=completeRound(original,1,0,96.5,62.8);
  const semi=first.state;
  assert.equal(semi.championship.active.round,1);
  assert.equal(semi.wins,1);
  assert.equal(semi.points,5,'a semi-final only grants ordinary battle points');
  assert.equal(semi.facilityCredits,7,'no trophy prize before the final');
  assert.equal(semi.team[0].exp,16);
  assert.equal(semi.team[0].evo.battles,1);
  assert.equal(semi.team[0].evo.wins,1);
  assert.equal(semi.team[0].friendship,22);
  assert.equal(semi.team[0].hp,97);
  assert.equal(semi.team[0].tp,62);
  assert.equal(first.receipt.cup.complete,false);
  assert.throws(()=>Settlement.settleCopy(semi,first.args),/No matching active owned battle/);

  const final=completeRound(semi,2,0,45.4,31.7);
  const won=final.state;
  assert.equal(won.championship.active,null);
  assert.equal(final.receipt.cup.complete,true);
  assert.equal(final.receipt.cup.won,true);
  assert.equal(final.receipt.cup.prize,260);
  assert.equal(won.facilityCredits,267,'one 260-Bit championship prize');
  assert.equal(won.points,11,'two +2 battle awards and one +4 cup award');
  assert.equal(won.wins,2);
  assert.equal(won.losses,0);
  assert.equal(won.championship.crowns.novice,1);
  assert.equal(won.championship.history.length,1);
  assert.equal(won.championship.rank,1);
  assert.equal(won.team[0].evo.battles,2);
  assert.equal(won.team[0].evo.wins,2);
  assert.equal(won.team[0].friendship,24);
  assert.equal(won.team[0].level,2,'second fight crosses the actual XP threshold');
  assert.equal(won.team[0].exp,1);
  assert.equal(won.team[0].maxHp,148);
  assert.equal(won.team[0].hp,54,'HP award is applied before XP level-up +8 HP');
  assert.equal(won.team[0].tp,31);
  assert.equal(won.team[0].atk,52);
  assert.equal(won.team[0].def,26);
  const finalCopy=JSON.stringify(won);
  assert.throws(()=>Settlement.settleCopy(won,final.args),/No matching active owned battle/);
  assert.equal(JSON.stringify(won),finalCopy,'replay cannot add an extra crown or prize');
  assert.equal(original.championship.active.round,0,'source tournament remains in semi-final');
  assert.equal(original.wins,0);
  assert.equal(original.facilityCredits,7);
});

test('final loss records one elimination without XP or championship prize',()=>{
  const game=fresh();
  assert.equal(Cups.enter(game,'novice').ok,true);
  const semi=completeRound(game,1,0,80,65).state;
  const loss=completeRound(semi,2,1,0,0);
  assert.equal(loss.state.championship.active,null);
  assert.equal(loss.state.championship.history.length,1);
  assert.equal(loss.state.championship.history[0].won,false);
  assert.equal(loss.state.championship.history[0].prize,0);
  assert.equal(loss.state.facilityCredits,7);
  assert.equal(loss.state.points,5);
  assert.equal(loss.state.wins,1);
  assert.equal(loss.state.losses,1);
  assert.equal(loss.state.team[0].exp,16);
  assert.equal(loss.state.team[0].evo.battles,2);
  assert.equal(loss.state.team[0].evo.wins,1);
  assert.equal(loss.state.team[0].friendship,22);
  assert.equal(loss.state.championship.crowns.novice||0,0);
  assert.equal(loss.receipt.cup.won,false);
  assert.throws(()=>Settlement.settleCopy(loss.state,loss.args),/No matching active owned battle/);
});
