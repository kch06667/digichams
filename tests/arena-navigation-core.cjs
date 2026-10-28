'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const N=require('../src/arena-navigation-core.js');
const RT=require('../phaser-lab/realtime-core.js');
const ctx=(tactic='balanced')=>({
  elapsed:3,tactic,bounds:RT.FIELD,
  range:(a,b)=>(a+b)/2,random:()=>.25
});
const f=(side=0)=>({
  id:'0-0',name:'아구몬',side,slot:0,x:255,y:250,dir:1,spd:50,
  orbit:1,visualDir:1,phase:'approach',phaseTime:1,hp:100
});

test('extracted pace and margins retain original HTML equation and constants',()=>{
  assert.deepEqual(N.WORLD,{w:600,h:405});
  assert.deepEqual(N.MARGIN,{left:16,right:16,top:66,bottom:22});
  assert.equal(N.originalPace(0),35*.9);
  assert.equal(N.originalPace(10),(33+10*.85)*.9);
  assert.equal(N.originalPace(50),54);
  assert.equal(N.originalPace(100),54);
});
test('approach/flank/disengage respond independently to distance and tactic',()=>{
  const target={x:620,y:270,hp:100};
  const a=f(),b=f(),c=f();
  const balanced=N.advance(a,target,[a,target],ctx('balanced'),1/30);
  const aggressive=N.advance(b,target,[b,target],ctx('aggressive'),1/30);
  const defensive=N.advance(c,target,[c,target],ctx('defensive'),1/30);
  assert.ok(balanced.travel>0);
  assert.equal(balanced.action,'run');
  assert.ok(aggressive.forward>balanced.forward);
  assert.ok(defensive.forward<balanced.forward);
  assert.notEqual(a.y,250,'original side-vector and vertical sine affect Y');
  assert.ok(a.x>255,'chases enemy');
  assert.equal(b.visualDir,1);
});
test('legacy flank and disengage phases can move sideways or backward',()=>{
  const target={x:275,y:250,hp:100};
  const a=f(),b=f();
  a.phase='flank';b.phase='disengage';a.phaseTime=1;b.phaseTime=1;
  const p=N.advance(a,target,[a,target],ctx(),1/30);
  const q=N.advance(b,target,[b,target],ctx(),1/30);
  assert.equal(p.action,'walk');
  assert.equal(q.action,'run');
  assert.ok(Math.abs(p.swirl)>1);
  assert.ok(q.forward<0);
  assert.ok(b.x<255,'disengages from close enemy');
  assert.ok(Math.abs(a.y-250)>.1,'flank arc moves on 2D field');
});
test('original phase transition is deterministic and safe at field edges',()=>{
  const a=f(),foe={x:800,y:450,hp:100};
  a.phase='disengage';a.phaseTime=0;a.x=740;a.y=350;
  const r=N.advance(a,foe,[a,foe],ctx(),1/30);
  assert.equal(a.phase,'flank');
  assert.ok(a.phaseTime>=.65&&a.phaseTime<=1.25);
  assert.ok(a.x>=RT.FIELD.left&&a.x<=RT.FIELD.right);
  assert.ok(a.y>=RT.FIELD.top&&a.y<=RT.FIELD.bottom);
  assert.ok(r.travel>=0);
  assert.throws(()=>N.advance(a,foe,[a,foe],ctx(),-.1));
  assert.throws(()=>N.advance(a,foe,[a,foe],{},1/30));
});
test('Phaser scene calls original movement kernel, not shadow navigation equations',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../phaser-lab/realtime-core.js'),'utf8');
  const nav=fs.readFileSync(path.join(__dirname,'../src/arena-navigation-core.js'),'utf8');
  assert.doesNotThrow(()=>new vm.Script(src));
  assert.doesNotThrow(()=>new vm.Script(nav));
  assert.match(src,/NAV\.advance\(f,foe,s\.fighters/);
  assert.doesNotMatch(nav,/document\.|localStorage|window\.location|fetch\(/);
  const arena=RT.createMatch({teamSize:3,seed:77});
  for(let i=0;i<90;i++)RT.step(arena,1/30);
  assert.equal(arena.fighters.length,6);
  assert.ok(arena.fighters.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)));
  assert.ok(arena.stats.movement>0);
});
