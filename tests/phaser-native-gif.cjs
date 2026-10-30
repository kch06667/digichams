'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const native=require('../phaser-lab/native-gif-layer.js');
const index=require('../assets/sprite-index.json');
const species=require('../assets/species-catalog.json');
const entries=native.parseCatalog(species,index);

test('full Korean original species catalog maps exactly 216 distinct stems',()=>{
 assert.equal(entries.size,216);
 assert.equal(new Set([...entries.values()].map(v=>v.folder+'/'+v.stem)).size,216);
 for(const e of species.entries){
  assert.deepEqual(native.findSpecies(entries,e.name),{
   name:e.name,folder:e.folder,stem:e.stem
  });
 }
 assert.equal(native.findSpecies(entries,'팔몬')?.name,'파르몬');
 assert.equal(native.findSpecies(entries,'임의몬'),null);
});
test('every original 216 species action uses only a local native GIF path',()=>{
 let found=0;
 for(const e of entries.values())for(let action=0;action<40;action++){
  const relative=native.gifPath(e,action);
  assert.match(relative,/^\.\.\/assets\/sprites\/(?:fresh|in-training|rookie|champion|ultimate|mega)\/m\d{3}_[\w]+_(?:\d+|5_1)\.gif$/);
  const file=path.resolve(root,'phaser-lab',relative);
  assert.ok(file.startsWith(path.join(root,'assets','sprites')+path.sep));
  assert.ok(fs.statSync(file).isFile(),e.name+' action '+action);
  found++;
 }
 assert.equal(found,8640);
 const unimon=native.findSpecies(entries,'유니몬');
 assert.match(native.gifPath(unimon,5),/_5_1\.gif$/);
 assert.doesNotMatch(native.gifPath(unimon,5),/_4\.gif$/);
});
test('malformed or external catalog entries cannot inject remote artwork URLs',()=>{
 assert.equal(native.gifPath({...entries.get('아구몬'),stem:'../../outside'},7),null);
 assert.equal(native.gifPath({...entries.get('아구몬'),folder:'../external'},7),null);
 for(const invalid of [-1,40,1.5,NaN,'5'])assert.equal(native.gifPath(entries.get('아구몬'),invalid),null);
 assert.equal(native.parseCatalog({entries:[]},index).size,0);
 assert.equal(native.parseCatalog(species,{catalog_entries:[]}).size,0);
 const polluted=JSON.parse(JSON.stringify(species));
 polluted.entries[0].stem='../../oops';
 assert.equal(native.parseCatalog(polluted,index).size,0);
});
test('optional catalog fetch failure never prevents the original game from launching',async()=>{
 const result=await native.loadCatalog(async()=>{throw Error('offline standalone');});
 assert.equal(result.size,0);
});
