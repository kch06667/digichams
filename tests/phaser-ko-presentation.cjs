'use strict';
/* No new combat engine. Motion labels from existing original live battle,
 * presentation state from Phaser's pure rendering-only helper.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../phaser-lab/logic.js');

function fighter(overrides={}){
 return {id:'original-mon',side:0,slot:0,hp:52,max:52,
  act:'idle',pose:0,x:180,y:150,knockVX:0,knockVY:0,flash:0,
  ...overrides};
}
const allActions=new Set([0,2,5,7,8,9,10,30,33,37]);

test('native attacker -> hit -> KO stages use the actual original GIF IDs',()=>{
 const attack=fighter({act:'attack',pose:9});
 const hurt=fighter({act:'hurt',pose:5,hp:9,flash:.22,knockVX:-140});
 const dead=fighter({act:'ko',pose:37,hp:0,flash:.22,knockVX:-140});
 for(const action of [7,8,9,10])
  assert.equal(L.motionAction({...attack,pose:action},allActions),action,
   'original attack pose '+action+' must not be remapped');
 assert.equal(L.motionAction(attack,allActions),9);
 assert.equal(L.motionAction(hurt,allActions),5);
 assert.equal(L.motionAction(dead,allActions),37);
 const a=L.fighterPresentation(attack,true,true,540);
 const h=L.fighterPresentation(hurt,true,true,540);
 const k=L.fighterPresentation(dead,true,true,540);
 assert.equal(a.alpha,1,'normal strike retains actual sprite');
 assert.equal(h.alpha,.65,'living hit flash stays visible');
 assert.ok(h.angle<0,'hit follows actual negative X knockback');
 assert.equal(k.alpha,1,'native KO art must not fade to a ghost');
 assert.equal(k.bob,0,'native KO remains grounded after the impact');
 assert.equal(k.angle,0,'native KO frames must remain upright');
 assert.equal(k.faintFallback,false);
 assert.equal(dead.hp,0,'presentation never heals or mutates game stats');
});
test('native KO presentation is stable over the full post-fight interval',()=>{
 const dead=fighter({hp:0,act:'ko',pose:37,knockVX:170,flash:.8});
 const before=JSON.stringify(dead);
 for(const time of [0,33,100,500,790,1100,2000,4000]){
  assert.deepEqual(L.fighterPresentation(dead,true,true,time),{
   bob:0,faintFallback:false,angle:0,alpha:1
  });
 }
 assert.equal(JSON.stringify(dead),before,'render-only state must not mutate save');
});
test('missing imported KO action keeps previous collapsed-shape fallback',()=>{
 const dead=fighter({side:1,hp:0,act:'ko',pose:37});
 const sparseActions=new Set([0,5,7]);
 assert.equal(L.motionAction(dead,sparseActions),5,
  'no native 37: use actual same-species hit art if available');
 assert.deepEqual(L.fighterPresentation(dead,true,false,790),{
  bob:0,faintFallback:true,angle:78,alpha:.5
 });
 assert.deepEqual(L.fighterPresentation(dead,false,false,790),{
  bob:0,faintFallback:true,angle:78,alpha:.5
 });
});
test('living movement, guard and victory retain existing presentation',()=>{
 const moving=fighter({act:'walk',pose:2});
 const guard=fighter({act:'guard',pose:31});
 const winner=fighter({act:'victory',pose:30,flash:0});
 assert.equal(L.motionAction(winner,allActions),30);
 assert.equal(L.motionAction(guard,new Set([0,31])),31);
 assert.equal(L.motionAction(moving,allActions),2);
 assert.ok(Math.abs(L.fighterPresentation(moving,true,true,100).bob)>0);
 assert.equal(L.fighterPresentation(winner,true,true,0).alpha,1);
});
