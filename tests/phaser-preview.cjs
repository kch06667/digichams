'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('deploy archive is allowlisted and never contains extracted game art',()=>{
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'digi-public-'));
  try{
    cp.execFileSync(process.execPath,[path.join(root,'tools/build-phaser-preview.cjs'),d]);
    const files=fs.readdirSync(d).sort();
    assert.deepEqual(files,['build-info.json','farm-model.js','farm.html','farm.js','game.js','index.html','logic.js']);
    const data=JSON.parse(fs.readFileSync(path.join(d,'build-info.json'),'utf8'));
    assert.deepEqual(data.files,['index.html','game.js','logic.js','farm.html','farm.js','farm-model.js']);
    assert.ok(!files.some(name=>/\.(?:nds|gif|png|webp|zip)$/i.test(name)));
  }finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('preview builder rejects source overwrite',()=>{
  assert.throws(()=>cp.execFileSync(process.execPath,[
    path.join(root,'tools/build-phaser-preview.cjs'),path.join(root,'phaser-lab')
  ]));
});
