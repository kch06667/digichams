'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../phaser-lab/logic.js');

test('user-confirmed action mapping never confuses victory and training', () => {
  assert.equal(L.ACTION.victory, 30);
  assert.equal(L.ACTION.training, 32);
  assert.equal(L.selectAction('victory'), 30);
  assert.equal(L.selectAction('training'), 32);
  assert.equal(L.selectAction('moving'), 2);
  assert.equal(L.selectAction('hit'), 5);
  assert.equal(L.selectAction('unknown'), 0);
});
test('sparse species atlas chooses nearest original motion instead of idle',()=>{
  const f=(act,pose,hp=50)=>({act,pose,hp});
  assert.equal(L.motionAction(f('attack',9),new Set([0,7])),7);
  assert.equal(L.motionAction(f('attack',9),new Set([0,9])),9,
    'actual original attack pose takes priority when available');
  assert.equal(L.motionAction(f('special',10),new Set([0,33])),33,
    'missing impact pose uses charge animation before idle');
  assert.equal(L.motionAction(f('hurt',5),new Set([0,5])),5);
  assert.equal(L.motionAction(f('hurt',5),new Set([0,31])),31);
  assert.equal(L.motionAction(f('walk',2),new Set([0,3])),3);
  assert.equal(L.motionAction(f('victory',28),new Set([0,28])),28);
  assert.equal(L.motionAction(f('victory',28),new Set([0,30])),30);
  assert.equal(L.motionAction(f('attack',8,0),new Set([0,5])),5,
    'a KO must ignore the attack pose and use the hit fallback');
  assert.equal(L.motionAction(f('attack',8,0),new Set([0,37])),37);
  assert.equal(L.motionAction(f('attack',8,0),new Set([0,7])),0,
    'dead actor must not display an attack when idle is available');
  assert.equal(L.motionAction(f('attack',8),new Set([14])),14,
    'an unusual sparse atlas still keeps the correct Digimon species texture');
  assert.equal(L.motionAction(f('attack',8),new Set()),null);
  assert.equal(L.motionAction(f('attack',8),null),null);
});
test('Phaser GIF frame timings equal exported source delays, not source + 83ms',()=>{
  const source=[20,40,100,250,30000];
  const before=[...source];
  const result=L.gifFrameTiming(source);
  assert.equal(result.frameRate,50);
  assert.deepEqual(result.extraMs,[0,20,80,230,29980]);
  assert.deepEqual(result.extraMs.map(ms=>ms+1000/result.frameRate),source);
  assert.deepEqual(source,before,'source manifest must remain unchanged');
  assert.throws(()=>L.gifFrameTiming([19]),/Invalid GIF/);
  assert.throws(()=>L.gifFrameTiming([Infinity]),/Invalid GIF/);
  assert.throws(()=>L.gifFrameTiming([]),/Invalid GIF/);
});
test('original special pose 33→10 drives visual cues, not fake hits',()=>{
  const f={act:'special',pose:33,hp:100,knockVX:0};
  assert.equal(L.specialPhase(f),'charge');
  f.pose=10;
  assert.equal(L.specialPhase(f),'release');
  f.pose=0;
  assert.equal(L.specialPhase(f),null);
  f.act='idle';f.pose=33;
  assert.equal(L.specialPhase(f),null,
    'a stale shout pose outside an active skill must not show a charge');
  f.act='special';f.hp=0;
  assert.equal(L.specialPhase(f),null,'KO cannot keep charging');
  assert.equal(L.specialPhase(null),null);
});
test('visible knockback tilt follows original impulse direction with safe bounds',()=>{
  const f={hp:75,act:'hurt',knockVX:120};
  assert.equal(L.knockbackTilt(f),9);
  f.knockVX=-120;
  assert.equal(L.knockbackTilt(f),-9);
  f.knockVX=9999;
  assert.equal(L.knockbackTilt(f),14);
  f.knockVX=-9999;
  assert.equal(L.knockbackTilt(f),-14);
  f.knockVX=11.99;
  assert.equal(L.knockbackTilt(f),0);
  f.knockVX=Infinity;
  assert.equal(L.knockbackTilt(f),0);
  f.knockVX=100;f.hp=0;
  assert.equal(L.knockbackTilt(f),0,'real KO pose is never tilted by recoil');
  assert.equal(L.knockbackTilt(null),0);
});
test('stat and knockback functions bounded and side-effect free', () => {
  assert.equal(L.gainTrainingStat(10, 1), 11);
  assert.equal(L.gainTrainingStat(9999, 1), 9999);
  assert.throws(() => L.gainTrainingStat(NaN, 1));
  assert.equal(L.knockbackForDamage(0), 55);
  assert.ok(L.knockbackForDamage(36) > L.knockbackForDamage(0));
  assert.ok(L.knockbackForDamage(999) <= 140);
});
test('manifest validation rejects unsafe path / impossible frames', () => {
  const m = {actions: {'30': {file:'action_30.png',frameWidth:32,frameHeight:24,frames:2,durationsMs:[160,610]}}};
  assert.equal(L.validateManifest(m), true);
  assert.equal(L.playableAction(m,30).frames,2);
  assert.equal(L.playableAction(m,32),null);
  assert.equal(L.validateManifest({actions:{30:{...m.actions['30'],file:'../private.png'}}}),false);
  assert.equal(L.validateManifest({actions:{30:{...m.actions['30'],durationsMs:[100]}}}),false);
  assert.equal(L.validateManifest({actions:{30:{...m.actions['30'],frameWidth:0}}}),false);
});
test('JS parser accepts browser-side game and test lab stays isolated', () => {
  const src = fs.readFileSync(path.join(__dirname,'../phaser-lab/game.js'),'utf8');
  assert.doesNotThrow(() => new vm.Script(src,{filename:'phaser-lab/game.js'}));
  assert.match(src,/Phaser\.Game/);
  assert.match(src,/RT\.createMatch/);
  assert.match(src,/RT\.step/);
  assert.match(src,/L.gifFrameTiming\(cfg.durationsMs\)/);
  assert.match(src,/duration:timing.extraMs\[i\]/);
  assert.match(src,/frameRate:timing.frameRate/);
  assert.match(src,/if\(v\.useArt&&v\.sprite\.anims\)v\.sprite\.anims\.timeScale=simSpeed/,
    'speed button must update already playing original sprite animations');
  assert.match(src,/v\.sprite\.play\([\s\S]*?v\.sprite\.anims\.timeScale=simSpeed/,
    'each new attack/skill/KO pose must inherit the active simulation speed');
  assert.match(src,/v\.sprite\?\.anims\?\.timeScale\?\?null/,
    'read-only art probe must tolerate disposed sprites during scene restart');
  assert.match(src,/animationTimeScale:/,
    'browser QA should be able to inspect the per-sprite animation speed');
  assert.match(src,/L\.motionAction\(/,
    'Phaser must use the rendering-only original action/fallback resolver');
  assert.equal(L.motionAction({act:'victory',hp:50},new Set([0,30])),30);
  assert.equal(L.motionAction({act:'walk',hp:50},new Set([0,2])),2);
  assert.doesNotMatch(src,/localStorage|saveVersion|\.nds/i);
  const html=fs.readFileSync(path.join(__dirname,'../phaser-lab/index.html'),'utf8');
  assert.match(html,/phaser@3\.90\.0/);
  assert.match(html,/aria-live="polite"/);
});
