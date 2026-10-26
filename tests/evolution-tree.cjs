'use strict';
const assert=require('node:assert/strict');
const evo=require('../src/evolution-core.js');
const farm=require('../src/farm-core.js');
const roster=require('../assets/species-catalog.json').entries;
const persisted=require('../assets/evolution-routes.json');
const byName=Object.fromEntries(roster.map(s=>[s.name,s]));
const lookup=name=>byName[name];
function mon(name){const s=lookup(name);return {name,stage:s.stage,emoji:s.emoji,hp:s.hp,maxHp:s.hp,atk:s.atk,def:s.def,spd:s.spd,instanceId:'player-1',hunger:0,fatigue:0,training:0,level:1};}
function game(name){const g={team:[mon(name)],day:1,logs:[],points:100};evo.ensure(g);return g;}
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name)}catch(e){failed++;console.error('FAIL',name,e.stack)}}
test('full roster contains exactly 216 species',()=>assert.equal(roster.length,216));
test('all 179 non-mega sources have a mapped route',()=>assert.equal(Object.keys(evo.KNOWN).length,179));
test('477 routes including branching are in source',()=>assert.equal(Object.values(evo.KNOWN).flat().length,477));
test('every route target and source map to existing graphic species',()=>{for(const [n,list] of Object.entries(evo.KNOWN)){assert(lookup(n),n);for(const r of list)assert(lookup(r.to),n+' -> '+r.to)}});
test('no duplicate targets per parent and all edges serialized',()=>{for(const [n,rs] of Object.entries(evo.KNOWN))assert.equal(new Set(rs.map(x=>x.to)).size,rs.length);assert.deepEqual(evo.KNOWN,persisted.data)});
test('Koromon offers FIVE original branches including different AP, battle and time routes',()=>assert.deepEqual(evo.KNOWN['코로몬'].map(x=>x.to),['브이몬','유키아구몬','블랙아구몬','아구몬','토이아구몬']));
test('Agumon has 4 distinct branches including GeoGreymon',()=>assert.deepEqual(evo.KNOWN['아구몬'].map(x=>x.to),['지오그레이몬','그레이몬','스카몬','티라노몬']));
test('Kunemon insect AP 20 evolves to Kabuterimon, not Kuwagamon',()=>{const g=game('쿠네몬');g.team[0].evo.ap.insect=20;assert.equal(evo.maybeEvolve(g,g.team[0],lookup).to,'캅테리몬');});
test('guide-required Greymon and MetalGreymon route remains reachable',()=>{const g=game('그레이몬');g.team[0].evo.battles=10;assert.equal(evo.maybeEvolve(g,g.team[0],lookup).to,'메탈그레이몬');g.team[0].evo.ap.dragon=60;g.team[0].evo.eggReverts=1;g.team[0].evo.battles=14;g.team[0].evo.wins=7;assert.equal(evo.maybeEvolve(g,g.team[0],lookup).to,'워그레이몬');});
test('target selection blocks easier fallback for Agumon',()=>{const g=game('아구몬'),m=g.team[0];assert.equal(evo.chooseTarget(m,'지오그레이몬'),true);m.evo.battles=6;const blocked=evo.maybeEvolve(g,m,lookup);assert.equal(blocked.changed,false);assert.equal(m.name,'아구몬');m.evo.ap.dragon=20;assert.equal(evo.maybeEvolve(g,m,lookup).to,'지오그레이몬');assert.equal(m.evo.target,undefined);});
test('manual target selection rejects nonexistent route',()=>{const g=game('아구몬');assert.equal(evo.chooseTarget(g.team[0],'듀크몬'),false);assert.equal(g.team[0].evo.target,undefined)});
test('AP-heavy branch outranks battle-only branch when both ready',()=>{const g=game('아구몬');g.team[0].evo.battles=6;g.team[0].evo.ap.dragon=20;assert.equal(evo.maybeEvolve(g,g.team[0],lookup).to,'지오그레이몬');});
test('time fallback is selectable with time threshold and goal',()=>{const g=game('아구몬'),m=g.team[0];evo.chooseTarget(m,'티라노몬');evo.advanceDays(g,5,lookup);assert.equal(m.name,'티라노몬');});
test('old save migration preserves stats and newly assigned goal through JSON',()=>{const g=game('아구몬'),m=g.team[0];m.atk=999;evo.chooseTarget(m,'지오그레이몬');const restored=JSON.parse(JSON.stringify(g));evo.ensure(restored);assert.equal(restored.team[0].atk,999);assert.equal(restored.team[0].evo.target,'지오그레이몬');});
test('incoming genealogy to WarGreymon from MetalGreymon',()=>{const inp=evo.incoming('워그레이몬');assert(inp.some(x=>x.from==='메탈그레이몬'&&x.ap.dragon===60));});
test('invalid stale goal automatically removed on loaded evolved species',()=>{const g=game('워그레이몬');g.team[0].evo.target='지오그레이몬';evo.ensure(g);assert.equal(g.team[0].evo.target,undefined);});
test('hatching clears old goal and protects future evolutions',()=>{const g=game('아구몬');g.team[0].evo.target='그레이몬';evo.eggRevert(g,g.team[0]);assert.equal(g.team[0].evo.target,undefined);evo.hatch(g,g.team[0],lookup);assert.equal(g.team[0].name,'코로몬');});
test('all 11 hidden AP attributes are supported',()=>{const ap=evo.EMPTY_AP();assert.equal(Object.keys(ap).length,11);for(const rs of Object.values(evo.KNOWN))for(const r of rs)for(const a of Object.keys(r.ap||{}))assert(Object.hasOwn(ap,a),a);});
console.log(JSON.stringify({passed,failed,total:passed+failed}));if(failed)process.exitCode=1;
