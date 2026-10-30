'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {analyze}=require('../tools/remake-p0-readiness.cjs');
function withRoot(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'digichams-p0-'));try{return fn(root);}finally{fs.rmSync(root,{recursive:true,force:true});}}
function write(root,p,data){const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}
function fixture(root){
 write(root,'index.html','original game');write(root,'standalone.html','original backup');
 write(root,'PLAY_ON_PC.bat','py -3 tools\\play_local.py');
 write(root,'tools/play_local.py',"PHASER_URL='pinned';html.replace(PHASER_URL,'./vendor/phaser.min.js');# /phaser-lab/");
 write(root,'phaser-lab/index.html','https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js');
 write(root,'tests/pc-complete-phaser-journey-browser.py','original journey');
 write(root,'tests/pc-offline-phaser-soak-browser.py','offline journey');
}
test('read-only diagnostics distinguish browser launcher from absent Windows EXE',()=>withRoot(root=>{
 fixture(root);const before=fs.readFileSync(path.join(root,'index.html'));
 const r=analyze(root);
 assert.equal(r.launch.kind,'windows-batch-local-browser');
 assert.equal(r.launch.electronExeSourcePresent,false);
 assert.equal(r.launch.localServerPhaserRewriteDetected,true);
 assert.equal(r.launch.verifiedPhaserCache,'not-cached');
 assert.ok(r.blockers.includes('windows-electron-exe-source-not-in-repo'));
 assert.deepEqual(fs.readFileSync(path.join(root,'index.html')),before);
}));
test('invalid cached engine is explicitly reported, never silently trusted',()=>withRoot(root=>{
 fixture(root);write(root,'phaser-lab/local-assets/vendor/phaser.min.js','damaged');
 const r=analyze(root);assert.equal(r.launch.verifiedPhaserCache,'invalid-sha256');
 assert.ok(r.blockers.includes('phaser-cache-integrity-failed'));
}));
test('verified engine and Electron source can satisfy static preflight without claiming playable',()=>withRoot(root=>{
 fixture(root);write(root,'desktop/package.json','{}');write(root,'desktop/main.js','main();');
 const engine=Buffer.from('synthetic engine');
 write(root,'phaser-lab/local-assets/vendor/phaser.min.js',engine);
 const r=analyze(root,{engineSha:crypto.createHash('sha256').update(engine).digest('hex')});
 assert.equal(r.status,'preflight-only-passed');assert.equal(r.launch.verifiedPhaserCache,'verified');
 assert.ok(r.limitations.some(s=>s.includes('does not prove')));
}));
test('missing source route is identified without modifying any file',()=>withRoot(root=>{
 fixture(root);fs.rmSync(path.join(root,'phaser-lab/index.html'));
 const r=analyze(root);assert.ok(r.blockers.includes('missing:phaser-lab/index.html'));
}));
