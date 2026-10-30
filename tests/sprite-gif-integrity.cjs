'use strict';
/* CI audit of the original Digimon GIF catalog, no ROM extraction/upload. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
const index=require('../assets/sprite-index.json');
const actions=require('../assets/sprite-action-map.json').sprite_actions;
const species=index.catalog_entries.filter(x=>x.category!=='egg');
function fileFor(d,n){
 // The original sprite pack's Unimon pose #5 is named #5_1, not #5.
 const suffix=d.stem==='m357_unimon_main'&&n===5?'5_1':String(n);
 return path.join(root,'assets','sprites',d.folder,d.stem+'_'+suffix+'.gif');
}
test('216 existing original species, mapped poses, unique sprite files',()=>{
 assert.equal(species.length,216);
 assert.equal(index.catalog_entries.length-species.length,8,'eggs are separate');
 assert.equal(new Set(species.map(d=>d.stem)).size,216);
 for(const d of species){
  assert.match(d.stem,/^m\d+_[a-z0-9_]+$/);
  assert.match(d.folder,/^(fresh|in-training|rookie|champion|ultimate|mega)$/);
 }
 for(const [key,pose] of Object.entries({idle:0,walk:2,sleep:13,eat:14,train:32,ko:37})){
  assert.equal(actions[key],pose,key+' must retain canonical pose');
 }
});
test('original 40 frames per species exist and have valid GIF data',()=>{
 let verified=0,aliased=0;
 const problems=[];
 for(const d of species)for(let n=0;n<40;n++){
  const filename=fileFor(d,n);
  if(d.stem==='m357_unimon_main'&&n===5)aliased++;
  let buf;
  try{buf=fs.readFileSync(filename);}
  catch(e){problems.push(d.name+' #'+n+': '+path.relative(root,filename)+' ('+e.code+')');continue;}
  if(buf.length<32 || !['GIF87a','GIF89a'].includes(buf.toString('ascii',0,6))||
     buf.readUInt16LE(6)===0||buf.readUInt16LE(8)===0||buf.at(-1)!==0x3b){
   problems.push(d.name+' #'+n+': malformed or truncated GIF');continue;
  }
  verified++;
 }
 assert.deepEqual(problems,[],'missing/corrupt GIFs:\n'+problems.slice(0,25).join('\n'));
 assert.equal(verified,216*40);
 assert.equal(aliased,1,'known Unimon #5_1 suffix');
 console.log('PASS 216 existing species / 8640 GIF poses / one original Unimon #5-to-#5_1 suffix');
});
