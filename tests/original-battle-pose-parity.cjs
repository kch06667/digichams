'use strict';
/* Native Unimon #5 parity in the actual playable originals.
 * The standard HTML loads a GIF file; standalone stores the identical GIF
 * as base64. Phaser's already-existing exporter uses the same 5_1 suffix.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const real=fs.readFileSync(path.join(root,'assets/sprites/champion/m357_unimon_main_5_1.gif'));
const wrong=fs.readFileSync(path.join(root,'assets/sprites/champion/m357_unimon_main_4.gif'));
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const standalone=fs.readFileSync(path.join(root,'standalone.html'),'utf8');
const atlas=fs.readFileSync(path.join(root,'tools/export-phaser-atlas.py'),'utf8');

test('native pose mapping does not silently show Unimon action 4 on hit',()=>{
 assert.notDeepEqual(real,wrong,'the two original GIF actions must differ');
 assert.match(index, /item\.stem==='m357_unimon_main'&&ix===5\?'5_1':ix/);
 assert.doesNotMatch(index,/item\.stem==='m357_unimon_main'&&ix===5\?4:ix/);
 assert.match(atlas,/suffix = "5_1" if stem == "m357_unimon_main" and action == 5/);
});
test('single-file standalone embeds exact same native Unimon action 5',()=>{
 const matches=[...standalone.matchAll(/"m357_unimon_main":\[(.*?)\]/gs)];
 assert.equal(matches.length,1,'a single native 40-pose array');
 const arr=[...matches[0][1].matchAll(/"(R0lGOD[A-Za-z0-9+/=]+)"/g)];
 assert.equal(arr.length,40);
 const actual=Buffer.from(arr[5][1],'base64');
 assert.deepEqual(actual,real,'standalone action 5 must match original 5_1 GIF');
 assert.notDeepEqual(actual,wrong,'do not play surprise pose on hit');
});
