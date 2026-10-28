'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const R=require('../phaser-lab/realtime-core.js');

const tick=(s,n)=>{for(let i=0;i<n&&!s.finished;i++)R.step(s,1/30);return s;};

test('three independent fighters on EACH side move simultaneously on a 2D field',()=>{
  const s=R.createMatch({seed:2468});
  assert.equal(s.fighters.length,6);
  assert.deepEqual(s.fighters.map(f=>f.id),['0-0','0-1','0-2','1-0','1-1','1-2']);
  assert.equal(s.turn,undefined,'no global turn counter');
  const start=s.fighters.map(f=>({x:f.x,y:f.y}));
  tick(s,45);
  for(let i=0;i<6;i++){
    assert.ok(s.fighters[i].moveDistance>0,'all 6 autonomous actors should move');
    assert.ok(Math.hypot(s.fighters[i].x-start[i].x,
      s.fighters[i].y-start[i].y)>1,'independent actor movement');
  }
  assert.ok(s.fighters.some((f,i)=>Math.abs(f.y-start[i].y)>1),
    'actors strafe in two dimensions, not just horizontal slides');
  assert.ok(s.stats.movement>150);
});
test('one-to-three team modes and pure caller-owned Digimon records',()=>{
  for(const size of [1,2,3]){
    const s=R.createMatch({teamSize:size});
    assert.equal(s.fighters.filter(f=>f.side===0).length,size);
    assert.equal(s.fighters.filter(f=>f.side===1).length,size);
  }
  assert.throws(()=>R.createMatch({teamSize:5}));
  const mon={name:'내 디지몬',hp:99,maxHp:125,atk:88,def:20,spd:53,tp:42,maxTp:65};
  const before=JSON.stringify(mon);
  const s=R.createMatch({allies:[mon],opponents:R.defaultTeam(1).slice(0,1)});
  assert.equal(s.fighters[0].name,'내 디지몬');
  assert.equal(s.fighters[0].tp,42);
  assert.equal(s.fighters[0].maxTp,65);
  tick(s,180);
  assert.equal(JSON.stringify(mon),before,'simulation NEVER modifies source save');
});
test('concurrent AI recognizes two simultaneous windups, not ordered alternating turns',()=>{
  const s=R.createMatch({teamSize:1,seed:999});
  const a=s.fighters[0],b=s.fighters[1];
  a.x=370;a.y=250;b.x=410;b.y=251;
  a.cd=0;b.cd=0;a.phase='approach';b.phase='approach';
  R.step(s,1/30);
  assert.equal(a.act,'attack');
  assert.equal(b.act,'attack','both may attack on the same simulation frame');
  assert.equal(a.attackTargetId,b.id);
  assert.equal(b.attackTargetId,a.id);
  assert.equal(s.turn,undefined);
});
test('skill energy and TP gates use old battle-core policy; projectile can launch',()=>{
  const s=R.createMatch({teamSize:2,seed:447,tactic:'balanced'});
  const shooter=s.fighters.find(f=>f.side===0&&f.slot===1);
  const foe=s.fighters.find(f=>f.side===1&&f.slot===1);
  shooter.x=foe.x-140;shooter.y=foe.y;
  shooter.energy=100;shooter.tp=100;shooter.cd=0;shooter.skillCD=0;
  R.step(s,1/30);
  assert.equal(shooter.act,'cast');
  assert.equal(s.stats.specials,1);
  assert.ok(shooter.tp<100);
  assert.ok(s.events.some(e=>e.type==='skill'));
  tick(s,31);
  assert.ok(s.eventHistory.some(e=>e.type==='hit'&&e.special) ||
    s.projectiles.some(p=>p.attackerId===shooter.id),
    'signature ranged attack must create travel/impact event');
});
test('full auto combat ends without UI input and tracks hits, movement and win',()=>{
  const s=R.createMatch({teamSize:3,seed:998877});
  tick(s,75*30+1);
  assert.equal(s.finished,true);
  assert.ok([0,1].includes(s.winner));
  assert.ok(s.stats.hits>0,'actual independent attacks must occur');
  assert.ok(s.stats.movement>0);
  assert.ok(s.eventHistory.some(e=>e.type==='finish'));
  for(const f of s.fighters){
    assert.ok(f.hp>=0&&f.hp<=f.max);
    assert.ok(f.tp>=0&&f.tp<=f.maxTp);
    assert.ok(f.x>=R.FIELD.left&&f.x<=R.FIELD.right);
    assert.ok(f.y>=R.FIELD.top&&f.y<=R.FIELD.bottom);
  }
});
test('fixed seed/ticks provide reproducible AI behavior for regression QA',()=>{
  const a=R.createMatch({teamSize:2,seed:20261028,tactic:'aggressive'});
  const b=R.createMatch({teamSize:2,seed:20261028,tactic:'aggressive'});
  tick(a,900);tick(b,900);
  assert.deepEqual(R.snapshot(a),R.snapshot(b));
  assert.throws(()=>R.step(a,-1));
  assert.throws(()=>R.step(a,.12));
});
test('browser simulation scripts parse, no save writes or forced turn loop',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../phaser-lab/realtime-core.js'),'utf8');
  assert.doesNotThrow(()=>new vm.Script(js));
  assert.doesNotMatch(js,/localStorage|IndexedDB|sessionStorage|document\.cookie|\.nds/i);
  assert.doesNotMatch(js,/turn\s*%\s*2|turn\s*\+\+/);
  const game=fs.readFileSync(path.join(__dirname,'../phaser-lab/game.js'),'utf8');
  assert.match(game,/RT\.step\(this\.sim/);
  assert.doesNotMatch(game,/this\.turn\s*%\s*2/);
});
