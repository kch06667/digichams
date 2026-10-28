'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Engine=require('../src/arena-original-core.js');
const original=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const extracted=fs.readFileSync(path.join(__dirname,'../src/arena-original-core.js'),'utf8');
const funcs=['alive','chooseTarget','emit','hit','projectile','beginMelee',
  'beginSkill','advanceSpecial','think','update'];
function originalFunction(name) {
  const at=original.indexOf('function '+name+'(',1750000);
  assert.ok(at>0,'Original original HTML function exists: '+name);
  const next=original.slice(at).match(/\n\s*function\s+[A-Za-z]+\(/);
  assert.ok(next);
  return original.slice(at,at+next.index).trimEnd();
}
function newFunction(name) {
  const anchor='// ORIGINAL verbatim function: '+name+'\n';
  const at=extracted.indexOf(anchor);
  assert.ok(at>0,'Extracted function exists: '+name);
  const start=at+anchor.length;
  const end=name==='update'?
    extracted.indexOf('\n   // Render-only adapter.',start):
    extracted.indexOf('\n\n',start);
  assert.ok(end>start);
  return extracted.slice(start,end).trimEnd();
}
const tick=(s,n)=>{for(let i=0;i<n&&!s.finished;i++)Engine.step(s,1/30);return s;};

test('original battle calculations were mechanically extracted unmodified, all ten',()=>{
  for(const name of funcs)assert.equal(newFunction(name),originalFunction(name),
    name+' must retain the full existing arena implementation without a rewrite');
  assert.doesNotThrow(()=>new vm.Script(extracted));
});
test('actual original HTML simulation uses autonomous teams and no turn scheduler',()=>{
  const s=Engine.createMatch({teamSize:3,seed:567});
  assert.equal(s.fighters.length,6);
  assert.equal(s.turn,undefined);
  const at=s.fighters.map(f=>({x:f.x,y:f.y}));
  tick(s,75);
  assert.ok(s.stats.movement>0);
  assert.ok(s.fighters.some((f,i)=>Math.hypot(f.x-at[i].x,f.y-at[i].y)>1));
  assert.ok(s.fighters.some((f,i)=>Math.abs(f.y-at[i].y)>1));
  assert.equal(s.fighters.every(f=>Number.isFinite(f.hp)),true);
});
test('extracted original simulation is deterministic under seeded local RNG',()=>{
  const a=Engine.createMatch({seed:103,teamSize:2,tactic:'aggressive'});
  const b=Engine.createMatch({seed:103,teamSize:2,tactic:'aggressive'});
  tick(a,850);tick(b,850);
  assert.deepEqual(Engine.snapshot(a),Engine.snapshot(b));
  assert.ok(a.elapsed>0);
  assert.ok(a.stats.hits>0);
});
test('real combat follows its original match finish, HP loss and skill rules',()=>{
  const s=Engine.createMatch({seed:83201,teamSize:3});
  tick(s,4200);
  assert.equal(s.finished,true);
  assert.ok([0,1].includes(s.winner));
  assert.ok(s.stats.hits>0);
  assert.ok(s.stats.movement>0);
  assert.ok(s.eventHistory.some(e=>e.type==='finish'));
  for(const f of s.fighters){
    assert.ok(f.hp>=0&&f.hp<=f.max);
    assert.ok(f.tp>=0&&f.tp<=f.maxTp);
    assert.ok(Number.isFinite(f.x)&&Number.isFinite(f.y));
  }
});
test('source Digimon records and their saved HP/TP are not changed',()=>{
  const allies=[
    {name:'아구몬',hp:170,maxHp:200,atk:50,def:24,spd:54,tp:65,maxTp:90},
    {name:'파타몬',hp:85,maxHp:110,atk:39,def:20,spd:46,tp:20,maxTp:85}
  ];
  const before=JSON.stringify(allies);
  const s=Engine.createMatch({seed:10,allies,opponents:Engine.defaultTeam(1).slice(0,2)});
  assert.equal(s.fighters[0].name,'아구몬');
  assert.equal(s.fighters[0].hp,170);
  assert.equal(s.fighters[0].maxTp,90);
  tick(s,600);
  assert.equal(JSON.stringify(allies),before);
  assert.ok(s.fighters[0].hp<=170);
  assert.throws(()=>Engine.step(s,-1));
  assert.throws(()=>Engine.step(s,.3));
});
test('no original persistence, rendering or copyrighted artwork is exposed in extracted engine',()=>{
  // Original function snippets may contain DOM updates; dependency injection
  // overrides these to no-ops. The facade itself never writes saved state.
  assert.match(extracted,/const syncBattleHP=\(\)=>\{\}/);
  assert.match(extracted,/const settleMatch=\(\)=>\{\}/);
  assert.match(extracted,/preview=false,skillSequence=null/);
  assert.match(extracted,/shout:33,guard:31,ko:37,happy:28,cheer:30/);
  assert.doesNotMatch(extracted,/localStorage\.setItem|\.nds|data:image\/png;base64/);
  const html=fs.readFileSync(path.join(__dirname,'../phaser-lab/index.html'),'utf8');
  const game=fs.readFileSync(path.join(__dirname,'../phaser-lab/game.js'),'utf8');
  assert.match(html,/src\/arena-original-core\.js/);
  assert.match(game,/RT=window\.DCOriginalArenaCore/);
  assert.match(game,/Number\.isInteger\(f\.pose\)/);
  assert.match(game,/motionKey=type\+':'\+id/);
  assert.match(game,/type==='victory'\?30/);
  assert.doesNotMatch(game,/RT=window\.DigiRealTimeCore/);
});
