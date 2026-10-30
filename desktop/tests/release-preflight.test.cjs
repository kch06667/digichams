'use strict';
/* Windows release-candidate asset preflight.
 * Runs against the original checked-out game or a packaged Electron game.
 * Reads only local resources; no ROM, emulator, remote URL, or distribution.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const projectRoot=path.resolve(__dirname,'..','..');
const root=process.env.DC_TEST_PACKAGE_ROOT
  ?path.resolve(process.env.DC_TEST_PACKAGE_ROOT):projectRoot;
const isPackaged=Boolean(process.env.DC_TEST_PACKAGE_ROOT);
const file=(...parts)=>path.join(root,...parts);
const important=[
 'index.html','src/farm-core.js','src/hex-farm-ui.js',
 'src/evolution-core.js','src/battle-core.js','src/championship-core.js',
 'src/pc-playability-guide.js','src/pc-ranch-free-roam.js',
 'src/pc-ranch-sprite-guard.js','src/pc-ranch-evolution-fx.js',
 'src/pc-continuous-ranch.css','src/pc-visual-polish.css',
 'assets/sprite-index.json','assets/species-catalog.json','assets/sprite-action-map.json',
 'assets/farm/hex_farm_v0232.webp','assets/farm/continuous_ranch_preview.svg',
 'phaser-lab/index.html','phaser-lab/native-gif-layer.js'
];
test('the real original game, farm, battle, evolution and PC shells are bundled',()=>{
 for(const relative of important){
  const full=file(...relative.split('/'));
  const st=fs.statSync(full,{throwIfNoEntry:false});
  assert.ok(st?.isFile()&&st.size>0,'required game resource missing: '+relative);
 }
 const page=fs.readFileSync(file('index.html'),'utf8');
 for(const marker of [
  'farm-core-v0143','hex-farm-v0143','Digimon',
  'id="farmPanel"','id="huntStage"','id="championshipPanel"'
 ])assert.ok(page.includes(marker),'not the actual playable original game: '+marker);
});
test('216 existing original Digimon have all 40 real animation GIF destinations',()=>{
 const index=JSON.parse(fs.readFileSync(file('assets','sprite-index.json'),'utf8'));
 const species=index.catalog_entries.filter(x=>x.category!=='egg');
 assert.equal(species.length,216,'existing 216 species inventory changed');
 const visited=new Set();
 let seen=0;
 for(const s of species){
  assert.ok(s.folder&&s.stem,'incomplete species: '+s.name);
  assert.ok(!visited.has(s.stem),'duplicate sprite stem: '+s.stem);
  visited.add(s.stem);
  for(let i=0;i<40;i++){
   // Original Unimon action 5 has a distinct filename suffix, 5_1.
   const pose=s.stem==='m357_unimon_main'&&i===5?'5_1':String(i);
   const full=file('assets','sprites',s.folder,s.stem+'_'+pose+'.gif');
   const st=fs.statSync(full,{throwIfNoEntry:false});
   assert.ok(st?.isFile()&&st.size>=32,s.name+' GIF '+i+' missing');
   const fd=fs.openSync(full,'r');
   try{
    const header=Buffer.alloc(10);
    assert.equal(fs.readSync(fd,header,0,10,0),10,'truncated GIF');
    assert.ok(header.toString('ascii',0,6)==='GIF89a' ||
      header.toString('ascii',0,6)==='GIF87a','invalid GIF header');
    assert.ok(header.readUInt16LE(6)>0&&header.readUInt16LE(8)>0,
      'invalid GIF dimensions');
   }finally{fs.closeSync(fd);}
   seen++;
  }
 }
 assert.equal(seen,8640);
 console.log('PASS',isPackaged?'packaged':'source','216 Digimon / 8640 original GIF poses');
});
test('packaged Windows game includes the pinned offline Phaser renderer',()=>{
 if(!isPackaged)return;
 const vendor=file('phaser-lab','vendor','phaser.min.js');
 const st=fs.statSync(vendor,{throwIfNoEntry:false});
 assert.ok(st?.isFile()&&st.size>200000&&st.size<2*1024*1024,
   'offline Phaser 3.90.0 engine must be bundled inside Windows EXE');
 const crypto=require('node:crypto');
 const digest=crypto.createHash('sha256').update(fs.readFileSync(vendor))
   .digest('hex');
 assert.equal(digest,
   'e92ddef111ba42e92d316979c732311757093688ea1810591cb7aa2858eba7a7',
   'packaged Phaser engine must match the verified pinned 3.90.0 bytes');
});
test('the packaged game has no .nds ROM and does not depend on private lab files',()=>{
 if(!isPackaged)return;
 const banned=/\.(?:nds|srl|sav|srm)$/i;
 const stack=[root];let checked=0;
 while(stack.length){
  const dir=stack.pop();
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const full=path.join(dir,entry.name);
   if(entry.isDirectory()){
    assert.notEqual(entry.name,'local-assets','private Phaser conversion must not ship');
    assert.notEqual(entry.name,'node_modules','nested developer dependencies must not ship');
    stack.push(full);
   }else if(entry.isFile()){
    assert.equal(banned.test(entry.name),false,'NDS or save file in package: '+full);
    checked++;
   }
  }
 }
 assert.ok(checked>8640,'packaged game is unexpectedly empty');
});
