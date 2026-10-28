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
test('imported Digimon are projected into read-only small hex cages',()=>{
  const roster={day:8,facilityCredits:700,team:[
    {name:'아구몬',hp:190,maxHp:240,hunger:72,location:'farm',lost:false},
    {name:'가부몬',hp:65,maxHp:100,hunger:18,location:'farm',lost:false},
    {name:'창고몬',hp:90,maxHp:90,hunger:30,location:'storage',lost:false},
    {name:'실종몬',hp:90,maxHp:90,hunger:30,location:'farm',lost:true}
  ]};
  const before=JSON.stringify(roster);
  const farm=M.fromRoster(roster);
  assert.equal(farm.viewOnly,true);
  assert.equal(farm.rows,2);
  assert.equal(farm.cages['0:0'].name,'아구몬');
  assert.equal(farm.cages['0:0'].hp,190);
  assert.equal(farm.cages['0:1'].name,'가부몬');
  assert.equal(farm.cages['0:2'],undefined);
  assert.equal(farm.sourceDay,8);
  assert.equal(M.transition(farm,{type:'select',row:0,col:1}).changed,true);
  for(const action of ['buy','feed','bite','train','expand']){
    const result=M.transition(farm,{type:action});
    assert.equal(result.changed,false);
    assert.equal(result.state,farm);
  }
  assert.equal(JSON.stringify(roster),before);
});
test('up to 30 mons display, extras counted, strict invalid roster rejected',()=>{
  const team=Array.from({length:37},(_,i)=>({
    name:'몬'+i,hp:100,maxHp:100,hunger:i,location:'farm'
  }));
  const state=M.fromRoster({day:50,team,facilityCredits:555});
  assert.equal(state.rows,5);
  assert.equal(Object.keys(state.cages).length,30);
  assert.equal(state.hiddenCount,7);
  assert.equal(state.cages['4:5'].name,'몬29');
  assert.throws(()=>M.fromRoster({day:1,team:[{name:'bad',hp:NaN,maxHp:20}]}));
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
