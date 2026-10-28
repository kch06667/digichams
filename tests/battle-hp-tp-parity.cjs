'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Settlement=require('../src/battle-settlement-core.js');

const root=path.resolve(__dirname,'..');
const lookup=()=>null; // never infer missing evolution data
const player=(i,hp)=>({instanceId:'id-'+i,name:'아구몬',hp,maxHp:140,
  atk:50,def:25,spd:48,tp:85,maxTp:95,level:1,exp:0,friendship:20,
  hunger:20,fatigue:10,stage:'성장기',evo:{battles:0,wins:0}});
function fixture(size,values,winner){
  const team=Array.from({length:size},(_,i)=>player(i,130-i*10));
  const state={saveVersion:4,day:1,wins:0,losses:0,points:0,logs:[],team,
    pendingBattle:{id:'hp-tp-'+size,participants:team.map(m=>m.instanceId)}};
  const initial=team.map((m,i)=>({id:'ally-'+i,side:0,slot:i,instanceId:m.instanceId,
    name:m.name,hp:m.hp,max:m.maxHp,tp:m.tp,maxTp:m.maxTp}));
  const fighters=[...initial.map((f,i)=>({...f,hp:values[i][0],tp:values[i][1]})),
    ...Array.from({length:size},(_,i)=>({id:'foe-'+i,side:1,slot:i,
      name:'상대',hp:winner===0?0:40,max:140,tp:0,maxTp:95}))];
  return {state,initial,final:{finished:true,winner,elapsed:40,fighters}};
}
function legacySync(page,state,fighters){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  const start=html.indexOf('function syncBattleHP(){');
  const end=html.indexOf('\nfunction settleMatch(',start);
  assert.ok(start!==-1&&end>start,page+': original syncBattleHP missing');
  let writes=0;
  const sandbox={state,matchState:state,fighters,ownedMatch:true,settled:false,
    save:()=>{writes++;}};
  vm.runInNewContext(html.slice(start,end)+'\nsyncBattleHP();',sandbox,{timeout:1000});
  assert.equal(writes,1,page+': original sync should save once');
  return state.team.map(m=>({instanceId:m.instanceId,hp:m.hp,tp:m.tp,maxTp:m.maxTp}));
}
function vitals(team){return team.map(m=>({instanceId:m.instanceId,
  hp:m.hp,tp:m.tp,maxTp:m.maxTp}));}

const cases=[
  ['1v1 fractional HP/TP',1,[[31.01,42.99]],0],
  ['2v2 KO and TP boundary',2,[[0,0],[109.2,94.9]],0],
  ['3v3 loss with independently tracked TP',3,[[0,0.001],[0,80.8],[0,48.99]],1]
];
test('completed matches match original HP ceil / TP floor for 1v1–3v3',()=>{
  for(const page of ['index.html','standalone.html']){
    for(const [label,size,values,winner] of cases){
      const f=fixture(size,values,winner);
      const before=JSON.stringify(f.state);
      const legacy=JSON.parse(before);
      const expected=legacySync(page,legacy,f.final.fighters);
      const settled=Settlement.settleCopy(f.state,{battleId:f.state.pendingBattle.id,
        initial:f.initial,final:f.final,lookup});
      assert.deepEqual(vitals(settled.state.team),expected,page+': '+label);
      assert.deepEqual(vitals(settled.state.team),settled.receipt.changes.map(c=>({
        instanceId:c.instanceId,hp:c.hp,tp:c.tp,maxTp:c.maxTp})),
        page+': '+label+' receipt');
      assert.equal(JSON.stringify(f.state),before,page+': original state mutated');
      assert.equal(settled.state.pendingBattle,undefined,page+': pending not cleared');
    }
  }
});
test('invalid final HP/TP values reject without modifying original save',()=>{
  for(const field of ['hp','tp','maxTp']){
    const f=fixture(1,[[31.01,42.99]],1);
    const before=JSON.stringify(f.state);
    f.final.fighters[0][field]=Number.NaN;
    assert.throws(()=>Settlement.settleCopy(f.state,{battleId:f.state.pendingBattle.id,
      initial:f.initial,final:f.final,lookup}),'bad '+field+' accepted');
    assert.equal(JSON.stringify(f.state),before,'bad '+field+' mutated original');
  }
});
