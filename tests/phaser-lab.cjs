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
  assert.match(src,/type==='victory'\?30/);
  assert.match(src,/type==='walk'\?2/);
  assert.doesNotMatch(src,/localStorage|saveVersion|\.nds/i);
  const html=fs.readFileSync(path.join(__dirname,'../phaser-lab/index.html'),'utf8');
  assert.match(html,/phaser@3\.90\.0/);
  assert.match(html,/aria-live="polite"/);
});
