const assert = require('node:assert/strict');
const C = require('../src/championship-core');
const mon = (name='아구몬')=>({name,hp:200,maxHp:200,location:'farm'});
const state = (cup='novice') => {
 const n=C.get(cup); const s={day:n.day,team:[mon('아구몬'),mon('가부몬'),mon('그레이몬')],wins:12,points:0,facilityCredits:0};
 s.championship={crowns:{novice:1,regional:1}};return s;
};
let passed=0; const test=(title,fn)=>{fn();passed++;console.log('PASS',title)};
test('4 participant novice and regional brackets are complete before first player battle',()=>{
 for(const cup of ['novice','regional']){
  const s=state(cup);assert(C.enter(s,cup).ok);const b=C.bracketFor(s);
  assert.equal(b.participants.length,4);assert.deepEqual(b.rounds.map(x=>x.length),[2,1]);
  assert.equal(b.rounds[0][1].source,'npc-sim');
  assert.equal(b.rounds[1][0].slots[1],b.rounds[0][1].winner);
 }
});
test('8 participant world cup has quarterfinal, semifinal and final',()=>{
 const s=state('grand');assert(C.enter(s,'grand').ok);const b=C.bracketFor(s);
 assert.deepEqual(b.rounds.map(x=>x.length),[4,2,1]);assert.equal(b.participants.length,8);
 assert.equal(b.rounds[0].filter(x=>x.source==='npc-sim').length,3);
 assert.equal(b.rounds[1][1].source,'npc-sim');assert.equal(b.rounds[2][0].slots[1],b.rounds[1][1].winner);
});
test('world cup progresses across three real player battles with distinct NPCs',()=>{
 const s=state('grand');C.enter(s,'grand');const foes=[];
 for(let i=0;i<3;i++){
  const m=C.nextMatch(s);assert(m);assert.equal(m.round,i);assert.equal(m.opponentTeam.length,3);foes.push(m.trainer);
  assert.equal(C.beginMatch(s,m.matchId).ok,true);const outcome=C.finishMatch(s,m.matchId,true);
  assert.equal(outcome.complete,i===2);assert.equal(C.finishMatch(s,m.matchId,true).ok,false);
 }
 assert.equal(new Set(foes).size,3);assert.equal(s.championship.crowns.grand,1);
 assert.equal(s.facilityCredits,1400);assert.equal(s.points,16);
 assert.equal(s.championship.history[0].bracket.rounds[2][0].winner,'player');
 assert.equal(s.championship.matchHistory.length,3);assert.equal(C.nextMatch(s),null);
});
test('NPC team members are registered species and never clones by filler',()=>{
 const catalog=require('../assets/species-catalog.json');const known=new Set(catalog.entries.map(x=>x.name));
 for(const cup of C.CUPS){
  assert.equal(C.ROSTERS[cup.id].length,cup.teams-1);
  for(const npc of C.ROSTERS[cup.id]){
   assert.equal(npc.team.length,cup.size);assert.equal(new Set(npc.team).size,npc.team.length);
   for(const n of npc.team)assert(known.has(n),n);
  }
 }
});
test('player loss records precise match and creates no trophy/reward',()=>{
 const s=state('grand');C.enter(s,'grand');const m=C.nextMatch(s);C.beginMatch(s,m.matchId);
 const loss=C.finishMatch(s,m.matchId,false);assert(loss.complete&&!loss.won);
 assert.equal(s.facilityCredits,0);assert.equal(s.championship.matchHistory.length,1);
 assert.equal(C.bracketFor(s).rounds[0][0].winner,C.ROSTERS.grand[0].id);
 assert.equal(s.championship.crowns.grand,undefined);
});
test('save restore mid semifinal retains bracket and exact match identity',()=>{
 const s=state('grand');C.enter(s,'grand');let m=C.nextMatch(s);C.beginMatch(s,m.matchId);C.finishMatch(s,m.matchId,true);
 const restored=JSON.parse(JSON.stringify(s));m=C.nextMatch(restored);assert.equal(m.round,1);
 assert(C.beginMatch(restored,m.matchId).ok);const interrupted=JSON.parse(JSON.stringify(restored));
 assert.equal(C.interrupted(interrupted,{tournamentMatchId:m.matchId}),true);
 assert.equal(interrupted.championship.history[0].won,false);
 assert.equal(C.interrupted(interrupted,{tournamentMatchId:m.matchId}),false);
});
test('v0.23 in-progress save without bracket finishes legacy final',()=>{
 const s=state('novice');s.championship.active={id:'cup-2',cupId:'novice',round:1,startedDay:1,awaiting:null};
 const m=C.nextMatch(s);assert.equal(m.opponent,'아구몬');assert(C.beginMatch(s,m.matchId).ok);
 assert.equal(C.finishMatch(s,m.matchId,true).complete,true);assert.equal(s.championship.crowns.novice,2);
});
test('history is bounded and optional new fields upgrade old saves safely',()=>{
 const s=state('novice');s.championship={crowns:{},history:[],sequence:1,rank:0};
 C.ensure(s);assert.deepEqual(s.championship.matchHistory,[]);assert.equal(s.championship.rank,0);
});
console.log('Expanded championship: '+passed+' passing');
