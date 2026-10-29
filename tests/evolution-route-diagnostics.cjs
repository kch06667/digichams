'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const evo=require('../src/evolution-core.js');
const roster=require('../assets/species-catalog.json').entries;
const species=new Set(roster.map(x=>x.name));
const make=name=>({name,stage:roster.find(x=>x.name===name).stage,instanceId:'test-one'});
const find=(rows,to)=>{const row=rows.find(x=>x.to===to);assert.ok(row,to);return row};
test('every one of 477 source routes exposes read-only, deterministic diagnostics',()=>{
 const total=Object.values(evo.KNOWN).reduce((n,r)=>n+r.length,0);
 assert.equal(total,477);assert.equal(roster.length,216);
 let checked=0;
 for(const [name,rules] of Object.entries(evo.KNOWN)){
  const m=make(name),before=JSON.stringify(m);
  const rows=evo.routeProgress(m,to=>species.has(to));
  assert.equal(rows.length,rules.length,name);
  assert.equal(JSON.stringify(m),before,'route scan must never migrate or edit saves');
  for(const row of rows){
   assert.equal(row.available,true,row.to);
   assert.equal(typeof row.ready,'boolean');
   assert.ok(row.conditions.every(c=>c.have>=0&&c.need>=0&&
     c.missing===Math.max(0,c.need-c.have)&&c.met===(c.have>=c.need)));
   assert.deepEqual(row.missing,row.conditions.filter(c=>!c.met));
   checked++;
  }
 }
 assert.equal(checked,477);
});
test('Agumon selected GeoGreymon reports AP and battle shortage exactly',()=>{
 const m=make('아구몬');
 const initial=find(evo.routeProgress(m,()=>true),'지오그레이몬');
 assert.equal(initial.ready,false);
 assert.deepEqual(initial.missing.map(c=>[c.kind,c.key,c.missing]),
   [['battles',null,6],['ap','dragon',20]]);
 assert.equal(evo.chooseTarget(m,'지오그레이몬'),true);
 const saved=JSON.stringify(m);
 const rows=evo.routeProgress(m,()=>true);
 assert.equal(JSON.stringify(m),saved);
 assert.equal(find(rows,'지오그레이몬').selected,true);
 m.evo.battles=6;m.evo.wins=4;m.evo.ap.dragon=14;
 const progress=find(evo.routeProgress(m,()=>true),'지오그레이몬');
 assert.equal(progress.ready,false);
 assert.deepEqual(progress.missing.map(c=>[c.kind,c.key,c.missing]),
  [['ap','dragon',6]]);
 m.evo.ap.dragon=20;
 assert.equal(find(evo.routeProgress(m,()=>true),'지오그레이몬').ready,true);
});
test('win rate, time fallback, penalties and egg reverts use actual runtime thresholds',()=>{
 const base=Object.entries(evo.KNOWN).flatMap(([name,rs])=>
  rs.map(r=>({name,rule:r})));
 for(const kind of ['wins','time','penalties','eggReverts']){
  const x=base.find(x=>x.rule[kind]!==undefined);
  assert.ok(x,kind);
  const m=make(x.name);
  const row=find(evo.routeProgress(m,()=>true),x.rule.to);
  const c=row.conditions.find(c=>c.kind===({
   wins:'winRate',time:'stageDays',penalties:'penalties',eggReverts:'eggReverts'}[kind]));
  assert.ok(c,kind);
  assert.equal(c.met,false);
  evo.ensureMon(m);
  if(kind==='wins'){m.evo.battles=10;m.evo.wins=10;}
  if(kind==='time')m.evo.stageDays=evo.BALANCE.timeEvolutionDays;
  if(kind==='penalties')m.evo.penalties=x.rule.penalties;
  if(kind==='eggReverts')m.evo.eggReverts=x.rule.eggReverts;
  const updated=find(evo.routeProgress(m,()=>true),x.rule.to);
  assert.ok(updated.conditions.find(y=>y.kind===c.kind).met,kind);
 }
});
test('missing target species is not shown as ready even when all conditions are met',()=>{
 const m=make('아구몬');evo.ensureMon(m);m.evo.battles=100;
 m.evo.ap.dragon=100;m.evo.stageDays=100;
 const row=find(evo.routeProgress(m,()=>false),'지오그레이몬');
 assert.equal(row.available,false);
 assert.equal(row.ready,false);
 assert.equal(row.missing.length,0);
});
test('known lineage links original source and target, no nonexistent species',()=>{
 const p=evo.lineage('워그레이몬');
 assert.ok(p.from.includes('메탈그레이몬'));
 assert.deepEqual(p.to,[]);
 assert.ok(evo.lineage('아구몬').to.includes('지오그레이몬'));
 assert.deepEqual(evo.lineage('없는종'),{from:[],to:[]});
 assert.deepEqual(evo.lineage(null),{from:[],to:[]});
});
test('selecting goal still blocks other ready branches, and JSON save persists it',()=>{
 const m=make('아구몬'),g={team:[m],day:1,logs:[],points:1};
 evo.chooseTarget(m,'지오그레이몬');
 evo.ensure(g);
 const cloned=JSON.parse(JSON.stringify(g));
 assert.equal(cloned.team[0].evo.target,'지오그레이몬');
 cloned.team[0].evo.battles=6;
 const lookup=n=>roster.find(x=>x.name===n);
 assert.equal(evo.maybeEvolve(cloned,cloned.team[0],lookup).changed,false);
 cloned.team[0].evo.ap.dragon=20;
 assert.equal(evo.maybeEvolve(cloned,cloned.team[0],lookup).to,'지오그레이몬');
});
