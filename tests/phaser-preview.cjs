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
    assert.deepEqual(files,['arena-techniques.js','build-info.json','domain-bridge.js','engine-core','farm-model.js','farm.html','farm.js','game.js','icon.svg','index.html','logic.js','manifest.webmanifest','pwa.js','realtime-core.js','sw.js',... (fs.existsSync(path.join(root,'node_modules/phaser/dist/phaser.min.js'))?['vendor']:[])]);
    const data=JSON.parse(fs.readFileSync(path.join(d,'build-info.json'),'utf8'));
    assert.deepEqual(data.files,['index.html','game.js','logic.js','domain-bridge.js','arena-techniques.js','realtime-core.js','farm.html','farm.js','farm-model.js','manifest.webmanifest','icon.svg','pwa.js','sw.js','engine-core/battle-core.js','engine-core/care-core.js','engine-core/championship-core.js',...(fs.existsSync(path.join(root,'node_modules/phaser/dist/phaser.min.js'))?['vendor/phaser.min.js','vendor/PHASER_LICENSE.txt']:[])]);
    assert.ok(!files.some(name=>/\.(?:nds|gif|png|webp|zip)$/i.test(name)));
    const core=fs.readdirSync(path.join(d,'engine-core')).sort();
    assert.deepEqual(core,['battle-core.js','care-core.js','championship-core.js']);
    const html=fs.readFileSync(path.join(d,'index.html'),'utf8');
    assert.match(html,/engine-core\/battle-core\.js/);
    assert.match(html,/realtime-core\.js/);
    assert.match(html,/arena-techniques\.js/);
    assert.ok(fs.existsSync(path.join(d,'realtime-core.js')));
    assert.doesNotMatch(html,/\.\.\/src\//);
    const farmHtml=fs.readFileSync(path.join(d,'farm.html'),'utf8');
    assert.match(farmHtml,/engine-core\/battle-core\.js/);
    assert.match(farmHtml,/domain-bridge\.js/);
    assert.match(farmHtml,/id="farmSaveFile"/);
    assert.doesNotMatch(farmHtml,/\.\.\/src\//);
    const sw=fs.readFileSync(path.join(d,'sw.js'),'utf8');
    assert.doesNotMatch(sw,/__BUILD_ID__/);
    assert.match(sw,/digichams-safe-pwa-/);
    assert.doesNotMatch(sw,/assets\/rom|local-assets|\.nds/);
    if(fs.existsSync(path.join(d,'vendor/phaser.min.js'))){
      assert.match(html,/vendor\/phaser\.min\.js/);
      assert.ok(fs.statSync(path.join(d,'vendor/PHASER_LICENSE.txt')).size>50);
    }
    for(const name of core){
      const body=fs.readFileSync(path.join(d,'engine-core',name),'utf8');
      assert.doesNotMatch(body,/\.nds|data:image\/|\.gif/i);
    }
  }finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('preview builder rejects source overwrite',()=>{
  assert.throws(()=>cp.execFileSync(process.execPath,[
    path.join(root,'tools/build-phaser-preview.cjs'),path.join(root,'phaser-lab')
  ]));
});
