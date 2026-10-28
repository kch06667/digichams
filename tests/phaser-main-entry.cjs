'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {build}=require('../tools/build-phaser-optin-page.cjs');
const modules=['src/battle-settlement-core.js','src/battle-commit-core.js',
  'src/dev-phaser-commit.js','src/dev-phaser-farm-launch.js',
  'src/phaser-arena-entry-choice.js'];
const fixture='<!doctype html><html><body><button id="lbStart"></button>'+
  '<select id="lbMode"></select><select id="lbTeamSize"></select>'+
  '<script id="championship-core-v023">root.DCChampionship=api;</script>'+
  '<script>root.DCEvolution=api;'+
  'function bracketFor(s){};function settleMatch(){};'+
  'window.DCBattleArena={launchTournament(){}};'+
  "el('lbStart').onclick=()=>start(false);"+'</script></body></html>';
function workspace(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'digi-phaser-entry-'));
  try{
    fs.writeFileSync(path.join(root,'index.html'),fixture);
    for(const file of modules){
      const target=path.join(root,file);
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,'/* test-only source */');
    }
    return fn(root);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('full-game feature build preserves original HTML byte-for-byte and adds only script refs',()=>{
  workspace(root=>{
    const original=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const out=build({rootDir:root});
    const generated=fs.readFileSync(out.path,'utf8');
    assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),original);
    assert.ok(generated.startsWith(original.slice(0,-14)));
    assert.equal((generated.match(/id="lbStart"/g)||[]).length,1);
    assert.equal((generated.match(/<script defer src="/g)||[]).length,modules.length);
    let cursor=-1;
    for(const file of modules){
      const at=generated.indexOf('<script defer src="'+file+'"></script>');
      assert.ok(at>cursor,file+' preserves load order');
      cursor=at;
    }
    assert.ok(out.outputBytes-out.originalBytes<900);
  });
});
test('entry builder fails closed if original arena entry changes',()=>{
  workspace(root=>{
    const file=path.join(root,'index.html');
    fs.writeFileSync(file,fixture.replace("el('lbStart').onclick=()=>start(false);",''));
    assert.throws(()=>build({rootDir:root}),/changed/);
    assert.equal(fs.existsSync(path.join(root,'index.phaser.html')),false);
  });
});
test('entry builder refuses missing safety dependency and never overwrites original source',()=>{
  workspace(root=>{
    fs.unlinkSync(path.join(root,'src/dev-phaser-commit.js'));
    assert.throws(()=>build({rootDir:root}),/Missing opt-in source/);
    assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),fixture);
  });
});
test('original game entry intercept is opt-in and never alters regular index and standalone',()=>{
  const chooser=fs.readFileSync(path.join(__dirname,'../src/phaser-arena-entry-choice.js'),'utf8');
  const bridge=fs.readFileSync(path.join(__dirname,'../src/dev-phaser-farm-launch.js'),'utf8');
  assert.match(chooser,/select\.add\(new Option\('기존 전투 \(기본\)','legacy'\)\)/);
  assert.match(chooser,/select\.value!=='phaser'/);
  assert.match(chooser,/event\.stopImmediatePropagation\(\)/);
  assert.match(chooser,/\[1,2,3\]\.includes\(size\)/);
  assert.match(chooser,/eligible\.length<size/);
  assert.match(chooser,/DCDevPhaserLaunch\.launch\(\{teamSize:size,leadIndex,/);
  assert.match(bridge,/DCDevPhaserCommit\.capture\(live,\{teamSize,leadIndex,/);
  assert.match(bridge,/DCDevPhaserCommit\.stage/);
  assert.match(bridge,/dc-phaser-finished-v1/);
  assert.doesNotMatch(bridge,/dc-phaser-multi-finished-v1/);
  assert.match(bridge,/window\.DCDevPhaserLaunch=Object\.freeze/);
  assert.match(bridge,/arenaChoice/);
  assert.doesNotMatch(chooser,/(?:localStorage|sessionStorage)/);
});
