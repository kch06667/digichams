'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const L=require('../phaser-lab/logic.js');
const Art=require('../phaser-lab/private-art-loader.js');
const Tech=require('../phaser-lab/arena-techniques.js');
const RT=require('../phaser-lab/realtime-core.js');

function fake(name,text){
  const size=Buffer.byteLength(text);
  return {name,size,text:async()=>text};
}
const manifest={
  format:'digi-phaser-local-atlas-v1',species:'아구몬',
  actions:{
    '0':{file:'action_0.png',frameWidth:32,frameHeight:32,frames:2,durationsMs:[120,220]},
    '30':{file:'action_30.png',frameWidth:32,frameHeight:32,frames:2,durationsMs:[100,140]}
  }
};
function assets(m=manifest){
  return [fake('manifest.json',JSON.stringify(m)),fake('action_0.png','PNGDATA'),
    fake('action_30.png','PNGDATA')];
}
test('private asset chooser rejects malformed and incomplete packs before creating URLs',async()=>{
  let created=0;
  const options={createObjectURL:()=>{created++;return 'blob:owned-art-'+created}};
  await assert.rejects(()=>Art.fromFiles([fake('manifest.json','not json')],L.validateManifest,options));
  await assert.rejects(()=>Art.fromFiles(assets().slice(0,2),L.validateManifest,options),/누락/);
  const traversal={...manifest,actions:{0:{...manifest.actions[0],file:'../evil.png'}}};
  await assert.rejects(()=>Art.fromFiles(assets(traversal),L.validateManifest,options));
  const invalidSpecies={...manifest,species:''};
  await assert.rejects(()=>Art.fromFiles(assets(invalidSpecies),L.validateManifest,options));
  await assert.rejects(()=>Art.fromFiles([...assets(),fake('action_0.png','DUP')],L.validateManifest,options));
  assert.equal(created,0,'invalid files never become accessible object URLs');
});
test('a valid one-species pack stays in memory, loads correct files, and revokes all URLs',async()=>{
  const created=[],revoked=[];
  const options={createObjectURL:file=>{
    const url='blob:private/'+file.name;created.push(url);return url;
  },revokeObjectURL:url=>revoked.push(url)};
  const p=await Art.fromFiles(assets(),L.validateManifest,options);
  assert.equal(p.species,'아구몬');
  assert.equal(p.lookup('action_30.png'),'blob:private/action_30.png');
  assert.equal(p.lookup('../private.png'),null);
  assert.equal(created.length,2);
  p.dispose();p.dispose();
  assert.deepEqual(revoked,created);
  assert.equal(p.lookup('action_0.png'),null);
});
test('technique identity comes from existing arena metadata with explicit unverified provenance',()=>{
  assert.equal(Tech.forSpecies('아구몬').name,'화염 공격');
  assert.equal(Tech.forSpecies('가부몬').name,'블루 블래스터');
  assert.equal(Tech.forSpecies('메탈가루몬').cost,34);
  assert.equal(Tech.forSpecies('듀크몬').type,'claw');
  assert.equal(Tech.forSpecies('알 수 없음').name,'기본 필살기(임시)');
  assert.equal(Tech.forSpecies('아구몬').verifiedByRom,false);
  assert.equal(Tech.valid(Tech.forSpecies('워그레이몬')),true);
  assert.equal(Tech.valid({name:'bad',type:'orb',cost:-1,color:'#000000'}),false);
  assert.throws(()=>{Tech.forSpecies('아구몬').cost=999});
});
test('real-time sprites/skill costs vary per Digimon and require full energy and TP',()=>{
  const agumon={name:'아구몬',hp:200,maxHp:200,atk:55,def:20,spd:48,maxTp:100,tp:100};
  const patamon={name:'파타몬',hp:200,maxHp:200,atk:35,def:15,spd:45,maxTp:100,tp:100};
  const s=RT.createMatch({allies:[agumon],opponents:[patamon],teamSize:1,seed:55});
  const a=s.fighters[0],b=s.fighters[1];
  assert.equal(a.technique.name,'화염 공격');
  assert.equal(a.technique.cost,24);
  assert.equal(b.technique.cost,20);
  a.x=360;a.y=250;b.x=400;b.y=250;a.cd=0;a.skillCD=0;
  a.energy=99;
  RT.step(s,1/30);
  assert.notEqual(a.act,'cast','cannot cast until energy reaches threshold');
  a.energy=100;a.cd=0;a.skillCD=0;a.act='idle';
  RT.step(s,1/30);
  assert.equal(a.act,'cast');
  assert.equal(a.tp,76,'TP spent according to named technique cost');
  assert.equal(s.events.find(x=>x.type==='skill').technique,'화염 공격');
  assert.equal(s.events.find(x=>x.type==='skill').color,'#ffb451');
  assert.equal(agumon.tp,100,'no original save writes');
});
test('the intended public source references no private PNG and safe pack routes',()=>{
  const pathGame=path.join(__dirname,'../phaser-lab/game.js');
  const src=fs.readFileSync(pathGame,'utf8');
  assert.match(src,/privatePacks=new Map\(\)/);
  assert.match(src,/privatePacks\.set\(pack\.species,pack\)/);
  assert.match(src,/this\.loadedActions\.get\(f\.name\)/);
  assert.match(src,/artSources\(\)/);
  assert.match(src,/convertedPacks=new Map\(\)/);
  assert.match(src,/MAX_CONVERTED_PACKS=6/);
  assert.match(src,/loadLocalMatchArt/);
  assert.match(src,/localSpeciesCatalog\.entries/);
  assert.match(src,/\.\/local-assets\/catalog\.json/);
  assert.match(src,/this\.textures\.remove\(name\)/);

  assert.match(src,/MAX_PRIVATE_PACKS=6,MAX_PRIVATE_BYTES=48\*1024\*1024/);
  assert.match(src,/Art\.fromFiles\(files,L\.validateManifest\)/);
  assert.doesNotMatch(src,/localStorage\.setItem|indexedDB\.open/i);
  const html=fs.readFileSync(path.join(__dirname,'../phaser-lab/index.html'),'utf8');
  assert.match(html,/id="artFiles"/);
  assert.match(html,/private-art-loader\.js/);
});
