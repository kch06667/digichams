'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const M=require('../phaser-lab/farm-model.js');
const cmd=(s,type,props={})=>M.transition(s,{type,...props});

test('two short rows, two starting cages, finite expansion',()=>{
  let s=M.initial();
  assert.equal(s.rows,2);assert.equal(Object.keys(s.cages).length,2);
  assert.equal(M.COLUMNS,6);
  const first=cmd(s,'expand');assert.equal(first.changed,true);
  assert.equal(s.rows,2,'transitions do not mutate old state');
  s=first.state;assert.equal(s.rows,3);
  while(s.rows<M.MAX_ROWS) s=cmd(s,'expand').state;
  const blocked=cmd(s,'expand');
  assert.equal(blocked.changed,false);
  assert.equal(blocked.state.rows,M.MAX_ROWS);
});
test('choose an empty hex, buy a cage, respect credits',()=>{
  let s=M.initial();
  s=cmd(s,'select',{row:0,col:1}).state;
  const bought=cmd(s,'buy');
  assert.equal(bought.changed,true);
  assert.equal(bought.state.credits,M.initial().credits-M.CAGE_COST);
  assert.equal(s.cages['0:1'],undefined);
  assert.equal(cmd(bought.state,'buy').changed,false);
  assert.equal(cmd(bought.state,'select',{row:100,col:1}).changed,false);
});
test('multiple bites decrease food and hunger without disappearing on first bite',()=>{
  let s=M.initial();
  const placed=cmd(s,'feed');assert.equal(placed.changed,true);
  s=placed.state;
  assert.equal(s.cages['0:0'].food,M.FOOD_BITES);
  // Selection changes while feeding; timed bites must stay at the initial cage.
  s=cmd(s,'select',{row:1,col:0}).state;
  const oldHunger=s.cages['0:0'].hunger;
  for(let i=1;i<=M.FOOD_BITES;i++){
    const result=cmd(s,'bite',{at:'0:0'});
    assert.equal(result.changed,true);
    s=result.state;
    assert.equal(s.cages['0:0'].food,M.FOOD_BITES-i);
  }
  assert.equal(s.cages['0:0'].hunger,oldHunger-M.FOOD_BITES*6);
  assert.equal(s.cages['1:0'].hunger,45);
  assert.equal(cmd(s,'bite',{at:'0:0'}).changed,false);
});
test('training costs no genuine game saves, JS syntax parses',()=>{
  const before=M.initial();const after=cmd(before,'train');
  assert.equal(before.training,10);assert.equal(after.state.training,11);
  for(const file of ['farm.js','farm-model.js']){
    const src=fs.readFileSync(path.join(__dirname,'..','phaser-lab',file),'utf8');
    assert.doesNotThrow(()=>new vm.Script(src,{filename:file}));
    assert.doesNotMatch(src,/localStorage|saveVersion|\.nds/i);
  }
  const html=fs.readFileSync(path.join(__dirname,'../phaser-lab/farm.html'),'utf8');
  assert.match(html,/id="farm"/);
  assert.match(html,/id="expand"/);
});
