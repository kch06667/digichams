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
  assert.match(src,/L\.selectAction\(state\)/);
  assert.doesNotMatch(src,/localStorage|saveVersion|\.nds/i);
  const html=fs.readFileSync(path.join(__dirname,'../phaser-lab/index.html'),'utf8');
  assert.match(html,/phaser@3\.90\.0/);
  assert.match(html,/aria-live="polite"/);
});
