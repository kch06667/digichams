'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const evo=require('../src/evolution-core.js');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'assets/species-catalog.json'),'utf8')).entries;
const idx=fs.readFileSync(path.join(root,'index.html'),'utf8');
const solo=fs.readFileSync(path.join(root,'standalone.html'),'utf8');
const tests=[];function check(label,fn){try{fn();tests.push({label,status:'PASS'})}catch(e){tests.push({label,status:'FAIL',error:String(e.stack||e)})}}
check('216 species have unique keys and valid stages',()=>{
 assert.equal(catalog.length,216);assert.equal(new Set(catalog.map(x=>x.name)).size,216);
 assert.equal(new Set(catalog.map(x=>x.stem)).size,216);
 assert.equal(catalog.filter(x=>x.stageKey==='mega').length,37);
 for(const x of catalog)assert.ok(['fresh','in-training','rookie','champion','ultimate','mega'].includes(x.stageKey));
});
check('all 216 species can resolve source GIF frames',()=>{
 for(const x of catalog){
  for(let i=0;i<40;i++){
   const actual=(x.stem==='m357_unimon_main'&&i===5)?4:i;
   assert.ok(fs.existsSync(path.join(root,'assets/sprites',x.folder,`${x.stem}_${actual}.gif`)),`${x.stem} ${i}`)
  }
 }
});
check('main HTML registers source assets and sprite catalog UI',()=>{
 assert.ok(idx.includes('const SPRITE_CATALOG='));assert.ok(idx.includes('const ASSET_SPECIES='));
 assert.ok(idx.includes('speciesCatalogPanel'));assert.ok(idx.includes('catalogStage'));
 assert.ok(idx.includes('catalogSearch'));assert.ok(idx.includes('catalogPreviewImg'));
 assert.ok(idx.includes('if(item)return `assets/sprites/'));
});
check('standalone HTML embeds 203 extra sets with 40 action GIFs',()=>{
 const start=solo.indexOf('const EXTRA_SPRITE_FRAMES=');assert.ok(start>=0);
 const end=solo.indexOf(';\nfunction spriteUrl',start);assert.ok(end>start);
 const obj=JSON.parse(solo.slice(start+'const EXTRA_SPRITE_FRAMES='.length,end));
 assert.equal(Object.keys(obj).length,203);
 for(const vals of Object.values(obj))assert.equal(vals.length,40);
 for(const x of ['m503_warglaymon_main','m529_metalgarurumon_va_main','m518_blackwargreymon_main'])assert.ok(obj[x]?.[7]?.length>50);
});
check('WAR / BLACKWAR / METALGARURUMON cataloged',()=>{
 for(const name of ['워그레이몬','블랙워그레이몬','메탈가루몬','황제드라몬 파이터 모드','듀크몬'])assert.ok(catalog.some(x=>x.name===name),name);
});
check('hunt pool starts with rookie-only 38 species',()=>{
 assert.equal(catalog.filter(s=>s.stage==='성장기').length,38);
 assert.ok(idx.includes("s.stage==='성장기'&&!state.team.some"));
});
check('WarGreymon evolves from MetalGreymon with guide-based conditions',()=>{
 const m={name:'메탈그레이몬',stage:'완전체',instanceId:'w',hp:160,maxHp:160,atk:30,def:30,spd:20,evo:{battles:14,wins:10,eggReverts:1,ap:{dragon:60}}};
 const g={day:1,team:[m],logs:[]};const lookup=n=>catalog.find(s=>s.name===n);
 assert.equal(evo.maybeEvolve(g,m,lookup).to,'워그레이몬');
 assert.equal(m.evo.battles,14);assert.equal(m.evo.ap.dragon,0);
});
check('WarGreymon evolution is blocked without prior egg revert',()=>{
 const m={name:'메탈그레이몬',stage:'완전체',instanceId:'w',hp:150,maxHp:150,atk:30,def:30,spd:20,evo:{battles:14,wins:10,eggReverts:0,ap:{dragon:60}}};
 const g={team:[m],day:1};
 assert.equal(evo.maybeEvolve(g,m,n=>catalog.find(s=>s.name===n)).changed,false);
 assert.equal(m.name,'메탈그레이몬');
});
check('Garurumon line evolves via documented battle+Data AP',()=>{
 const m={name:'가루몬',stage:'성숙기',instanceId:'g',hp:100,maxHp:100,atk:20,def:15,spd:20,evo:{battles:8,wins:8}};
 const g={team:[m],day:1};const lookup=n=>catalog.find(s=>s.name===n);
 assert.equal(evo.maybeEvolve(g,m,lookup).to,'워가루몬');
 m.evo.battles=20;m.evo.ap.data=40;
 assert.equal(evo.maybeEvolve(g,m,lookup).to,'메탈가루몬');
});
console.log(JSON.stringify({passed:tests.filter(t=>t.status==='PASS').length,total:tests.length,tests},null,2));
if(tests.some(t=>t.status==='FAIL'))process.exitCode=1;
