const assert = require('node:assert/strict');
const Battle=require('../src/battle-core.js');
const tests=[];
function test(name,fn){try{fn();tests.push({name,status:'PASS'});}catch(e){tests.push({name,status:'FAIL',error:e.stack||String(e)});}}
const actor={name:'아구몬',x:10,y:20,hp:100,max:100,tp:48,maxTp:60,energy:100,cd:0,skillCD:0};
test('TP is initialized from species and preserved from existing saves',()=>{
 const v=Battle.fighterVitals({spd:20});assert.ok(v.maxTp>0);assert.equal(v.tp,v.maxTp);
 assert.deepEqual(Battle.fighterVitals({maxTp:75,tp:20}),{maxTp:75,tp:20});
 assert.equal(Battle.fighterVitals({maxTp:60,tp:999}).tp,60);
});
test('special blocked with insufficient TP even when charge is full',()=>{
 assert.ok(Battle.canUseSkill(actor,{cost:30},'balanced'));
 assert.equal(Battle.canUseSkill({...actor,tp:29},{cost:30},'balanced'),false);
 assert.equal(Battle.canUseSkill({...actor,hp:0},{cost:30},'balanced'),false);
 assert.equal(Battle.canUseSkill({...actor,energy:70},{cost:30},'balanced'),false);
});
test('conserve tactic keeps TP reserve',()=>{
 assert.equal(Battle.canUseSkill({...actor,tp:40},{cost:30},'conserve'),false);
 assert.equal(Battle.canUseSkill({...actor,tp:50},{cost:30},'conserve'),true);
});
test('TP spend only on actual technique, not preview; clamped gains',()=>{
 const f={...actor};assert.equal(Battle.spendTP(f,{cost:30}),true);assert.equal(f.tp,18);
 assert.equal(Battle.spendTP(f,{cost:30}),false);assert.equal(f.tp,18);
 assert.equal(Battle.spendTP(f,{cost:30},true),true);assert.equal(f.tp,18);
 assert.equal(Battle.regainTP(f,200),60);
});
test('focus tactic selects weakest target rather than nearest',()=>{
 const near={name:'near',x:20,y:20,hp:100,max:100};const weak={name:'weak',x:120,y:20,hp:5,max:100};
 assert.equal(Battle.target(actor,[near,weak],'balanced'),near);
 assert.equal(Battle.target(actor,[near,weak],'focus'),weak);
 assert.equal(Battle.target(actor,[{...near,hp:0},weak],'balanced'),weak);
});
test('unknown tactic is safe default, missing maxTP migrated without losing HP',()=>{
 assert.equal(Battle.tactic('INVALID'),Battle.TACTICS.balanced);
 const m={hp:34,maxHp:90,spd:35};const v=Battle.fighterVitals(m);assert.equal(m.hp,34);assert.ok(v.maxTp>v.tp-1);
});
console.log(JSON.stringify({suite:'battle-core v0.22',tests},null,2));
if(tests.some(t=>t.status==='FAIL'))process.exitCode=1;
