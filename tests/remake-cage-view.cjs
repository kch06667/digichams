'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const view=fs.readFileSync(path.join(root,'src/remake-cage-view.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/remake-cage-view.css'),'utf8');
const host=fs.readFileSync(path.join(root,'src/pc-playability-guide.js'),'utf8');

test('new cage view parses and preserves existing game APIs',()=>{
  assert.doesNotThrow(()=>new vm.Script(view,{filename:'remake-cage-view.js'}));
  assert.match(view,/window\.DCHexFarm/);
  assert.match(view,/window\.DCCages/);
  assert.match(view,/cages\.CAGES\.map/);
  assert.match(view,/cages\.info\(/);
  assert.match(view,/cages\.owned\(/);
  assert.match(view,/farm\.choose\(/);
  assert.match(view,/hexCageSelect/);
  assert.match(view,/hexCageBuy/);
  assert.match(view,/hexCageTrain/);
});
test('two-row PC-only view loads only in existing production PC guide',()=>{
  assert.match(css,/grid-template-rows:repeat\(2/);
  assert.match(css,/grid-template-columns:repeat\(6/);
  assert.match(view,/min-width:900px/);
  assert.match(view,/pointer:fine/);
  assert.match(host,/new URL\('remake-cage-view\.js',document\.currentScript\.src\)/);
  assert.match(view,/new URL\('remake-cage-view\.css',source\)/);
});
test('first-pass view has no independent save or gameplay rules',()=>{
  assert.doesNotMatch(view,/\b(?:localStorage|sessionStorage|indexedDB)\b/);
  assert.doesNotMatch(view,/\bsave\s*\(/);
  assert.doesNotMatch(view,/\b(?:buy|command|advance|tick)\s*\(/);
  assert.match(view,/wideMode/);
  assert.match(view,/dc-cage-back/);
});
