'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fallbackUrlFor}=require('../src/pc-ranch-sprite-guard.js');
test('broken pose can use only the same species idle GIF',()=>{
 assert.equal(fallbackUrlFor('assets/sprites/rookie/m201_agumon_main_32.gif'),
  'assets/sprites/rookie/m201_agumon_main_0.gif');
 assert.equal(fallbackUrlFor('/assets/sprites/champion/m320_graymon_main_13.gif'),
  '/assets/sprites/champion/m320_graymon_main_0.gif');
 assert.equal(fallbackUrlFor('digichamp://game/assets/sprites/rookie/m201_agumon_main_39.gif'),
  'digichamp://game/assets/sprites/rookie/m201_agumon_main_0.gif');
});
test('valid idle frames are not re-requested and unrelated images are untouched',()=>{
 for(const src of [
  'assets/sprites/rookie/m201_agumon_main_0.gif',
  'assets/farm/hex_farm_v0232.webp',
  'https://other.example/monster_14.gif',
  'data:image/gif;base64,AAAA',
  'assets/sprites/rookie/m201_agumon_main_unknown.gif',
  '',
  null
 ])assert.equal(fallbackUrlFor(src),null,String(src));
});
test('a fallback never crosses to another monster or invents pose art',()=>{
 for(const src of [
  'assets/sprites/mega/m601_omegamon_main_12.gif',
  'assets/sprites/champion/m357_unimon_main_5.gif'
 ]){
  const next=fallbackUrlFor(src);
  assert.equal(next,src.replace(/_\d+\.gif$/,'_0.gif'));
  assert.equal(next.includes('koromon'),false);
 }
});
