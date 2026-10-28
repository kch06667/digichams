'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const B=require('../phaser-lab/domain-bridge.js');
const core=require('../src/battle-core.js');
const care=require('../src/care-core.js');
const cups=require('../src/championship-core.js');

test('Phaser uses existing battle target, TP thresholds and skill costs',()=>{
  const state=B.newEncounter('balanced');
  const a=B.plan(state);
  assert.equal(a.side,'ally');
  assert.equal(a.target,'상대');
  assert.equal(a.action,'skill');
  assert.equal(a.cost,core.skillCost(state.ally,{cost:24}));
  assert.equal(a.action,core.canUseSkill(state.ally,{cost:24},state.tactic)?'skill':'normal');
  const after=B.apply(state,a);
  assert.equal(state.ally.tp,75,'never mutate caller or original save');
  assert.equal(state.enemy.hp,100,'no prototype state mutation');
  assert.equal(after.ally.tp,75-24);
  assert.equal(after.enemy.hp,100-a.damage);
  assert.equal(after.turn,1);
  assert.equal(B.plan(after).side,'enemy');
  assert.deepEqual(B.newEncounter('balanced'),state,'prototype deterministic');
});
test('TP conserve tactic differs from balanced at low TP',()=>{
  const a=B.newEncounter('balanced'),b=B.newEncounter('conserve');
  a.ally.tp=30; b.ally.tp=30;
  assert.equal(B.plan(a).action,'skill');
  assert.equal(B.plan(b).action,'normal');
  assert.throws(()=>B.newEncounter('made-up'));
});
test('invalid/stale battle event rejected with no state mutation',()=>{
  const s=B.newEncounter();
  const event=B.plan(s);
  assert.throws(()=>B.apply(s,{...event,damage:900}));
  const next=B.apply(s,event);
  assert.throws(()=>B.apply(next,event));
  assert.equal(s.turn,0);
});
test('training delegates to existing seasonal rules, not hardcoded animation gain',()=>{
  assert.equal(B.train(1,10,2).gained,care.statGain(1,2));
  assert.equal(B.train(31,10,2).season,'여름');
  assert.equal(B.train(31,10,2).gained,care.statGain(31,2));
  assert.equal(B.train(91,10,2).gained,care.statGain(91,2));
  assert.throws(()=>B.train(1,NaN,1));
});
test('tournament preview delegates eligibility with defensive clone',()=>{
  const save=B.previewSample(),before=JSON.stringify(save);
  const status=B.cupPreview(save);
  assert.equal(status.length,cups.CUPS.length);
  assert.equal(status[0].id,'novice');
  assert.equal(status[0].available,cups.requirements(JSON.parse(before),'novice').length===0);
  assert.equal(status[1].available,false);
  assert.equal(JSON.stringify(save),before,'caller state must not be mutated');
});
test('real save export preview is read-only, strips untrusted data and uses real cup rules',()=>{
  const save={
    format:'digicham-save',exportVersion:1,
    state:{day:10,wins:6,points:20,facilityCredits:250,logs:['secret'],
      championship:{crowns:{novice:1,regional:1},active:null},
      team:[{name:'가상 디지몬',hp:80,maxHp:100,atk:33,def:15,spd:42,
        tp:25,maxTp:80,hunger:33,location:'farm'}]}
  };
  const before=JSON.stringify(save);
  const view=B.inspectExport(save);
  assert.equal(view.day,10);
  assert.equal(view.team.length,1);
  assert.equal(view.team[0].name,'가상 디지몬');
  assert.equal(view.team[0].tp,25);
  assert.equal(view.source,'read-only-save-preview');
  assert.equal(view.team[0].hunger,33,'hunger is an explicitly allowed read-only preview field');
  assert.equal(view.team[0].mood,undefined,'unlisted fields must not be retained');
  assert.equal(view.logs,undefined);
  assert.equal(JSON.stringify(save),before,'original save must remain intact');
  assert.equal(B.cupPreview(view).length,cups.CUPS.length);
  assert.equal(JSON.stringify(save),before,'cup checks must not mutate original');
  assert.throws(()=>B.inspectExport({...save,exportVersion:5}));
  assert.throws(()=>B.inspectExport({format:'digicham-save',exportVersion:1,
    state:{...save.state,pendingBattle:{active:true}}}));
  assert.throws(()=>B.inspectExport({format:'digicham-save',exportVersion:1,
    state:{...save.state,team:[{name:'bad',hp:'oops',maxHp:100}]}}));
});

test('choose a real raised Digimon for a read-only AI sparring demonstration',()=>{
  const save=B.inspectExport({format:'digicham-save',exportVersion:1,state:{
    day:17,wins:4,team:[
      {name:'내 디지몬',hp:270,maxHp:300,atk:76,def:42,spd:61,tp:37,maxTp:99,hunger:10},
      {name:'창고 디지몬',hp:100,maxHp:100,atk:50,def:22,spd:40,location:'storage'},
      {name:'부화 중',hp:40,maxHp:40,atk:1,def:1,spd:1,egg:true},
      {name:'기절',hp:0,maxHp:100,atk:1,def:1,spd:1}
    ]
  }});
  const before=JSON.stringify(save);
  const eligible=B.eligibleRoster(save);
  assert.equal(eligible.length,1);
  assert.equal(eligible[0].index,0);
  const s=B.newEncounter('conserve',eligible[0]);
  assert.equal(s.ally.name,'내 디지몬');
  assert.equal(s.ally.hp,270);
  assert.equal(s.ally.max,300);
  assert.equal(s.ally.atk,76);
  assert.equal(s.ally.spd,61);
  assert.equal(s.ally.tp,37);
  assert.equal(s.ally.maxTp,99);
  assert.equal(s.source,'roster-preview');
  const event=B.plan(s);
  assert.equal(event.action,'normal','TP-saving tactics keep low TP');
  const next=B.apply(s,event);
  assert.equal(next.turn,1);
  assert.equal(JSON.stringify(save),before,'never mutate imported save on battle preview');
  assert.throws(()=>B.newEncounter('balanced',save.team[1]),/출전/);
  assert.throws(()=>B.newEncounter('balanced',save.team[2]),/출전/);
  assert.throws(()=>B.newEncounter('balanced',save.team[3]),/출전/);
});
test('roster with absent TP uses legacy TP capacity instead of forced zero',()=>{
  const s=B.newEncounter('balanced',{
    name:'TP 생략',hp:50,maxHp:90,atk:23,def:8,spd:39,tp:null,maxTp:null
  });
  assert.ok(s.ally.tp>0);
  assert.equal(s.ally.tp,s.ally.maxTp);
});

test('browser-side bridge script parses, displays chosen tactic and core linkage',()=>{
  for(const file of ['domain-bridge.js','game.js']){
    const src=fs.readFileSync(path.join(__dirname,'..','phaser-lab',file),'utf8');
    assert.doesNotThrow(()=>new vm.Script(src,{filename:file}));
  }
  const game=fs.readFileSync(path.join(__dirname,'../phaser-lab/game.js'),'utf8');
  assert.match(game,/B\.newEncounter/);
  assert.match(game,/B\.plan/);
  assert.match(game,/B\.apply/);
  assert.match(game,/B\.train/);
  const html=fs.readFileSync(path.join(__dirname,'../phaser-lab/index.html'),'utf8');
  assert.match(html,/\.\.\/src\/battle-core\.js/);
  assert.match(html,/\.\.\/src\/care-core\.js/);
  assert.match(html,/\.\.\/src\/championship-core\.js/);
  assert.match(html,/id="tactic"/);
});
