'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Settlement=require('../src/battle-settlement-core.js');

// Execute only the original XP function, not the whole browser game.
function legacyExperience(page){
  const html=fs.readFileSync(path.join(__dirname,'..',page),'utf8');
  const start=html.indexOf('function grantExperience(');
  const end=html.indexOf('function migrateProgression(',start);
  assert.ok(start!==-1&&end>start,page+': original XP function missing');
  return vm.runInNewContext(html.slice(start,end)+'\ngrantExperience;');
}

const base={level:1,exp:0,maxHp:140,hp:83,atk:50,def:25};
const fixtures=[
  ['implicit default (no reward)',base,undefined],
  ['ordinary victory +10 XP',base,10],
  ['level-up threshold',{...base,exp:20},10],
  ['multi-level XP',{...base,level:4,exp:180},200],
  ['negative award',base,-10],
  ['NaN award',base,NaN],
  ['infinite award',base,Infinity],
  ['negative infinity award',base,-Infinity],
  ['old save with bad level',{...base,level:0,exp:-5},0]
];

test('settlement XP and level-up match the embedded original HTML implementation',()=>{
  for(const page of ['index.html','standalone.html']){
    const legacy=legacyExperience(page);
    for(const [label,starting,amount] of fixtures){
      const expected={...starting},actual={...starting};
      const legacyLevels=amount===undefined?legacy(expected):legacy(expected,amount);
      const newLevels=amount===undefined?Settlement.grantExperience(actual):Settlement.grantExperience(actual,amount);
      assert.equal(newLevels,legacyLevels,page+': '+label+' level delta');
      assert.deepEqual(actual,expected,page+': '+label+' result state');
    }
  }
});
