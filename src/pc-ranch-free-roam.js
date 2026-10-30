/* PC opt-in free-roaming extension for the existing real farm engine.
 * Never replaces the original routes, collisions, training, food AI, or saves.
 * Ambient destination changes are gameplay state and only occur when enabled.
 * Biome stat/evolution effects are deliberately NOT implemented here.
 */
(function(root){
'use strict';
const OFFSETS=[[-12,-10],[13,9],[-16,9],[15,-11],[0,17],[0,-17]];
function hash(value){
 let h=2166136261;
 for(const c of String(value)){h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;}
 return h>>>0;
}
function pickDestination(core,s,m,a){
 const centers=core.HEX_CENTERS;
 if(!centers||typeof core.foodGround!=='function')return null;
 // Never advertise unbuilt zones as inhabitable.
 const open=Object.keys(centers).filter(id=>id!=='core'&&s.facilities?.[id]);
 if(!open.length)return null;
 const stamp=Math.floor(Math.max(0,Number(s.world?.seconds)||0)/7);
 const base=(hash(m.instanceId)+stamp)>>>0;
 const occupied=Object.entries(s.farm.actors||{}).filter(([id])=>id!==m.instanceId)
  .map(([,other])=>other).filter(other=>Number.isFinite(other.x)&&Number.isFinite(other.y));
 for(let n=0;n<open.length;n++){
  const zone=open[(base+n)%open.length],point=centers[zone];
  if(!point)continue;
  for(let k=0;k<OFFSETS.length;k++){
   const off=OFFSETS[(base+k+n)%OFFSETS.length];
   const target={x:(point[0]-369)/1.82+off[0],y:(point[1]-262)/1.56+off[1],
    kind:'wander',zone};
   if(!core.foodGround(s,target.x,target.y))continue;
   if(occupied.some(b=>Math.hypot(b.x-target.x,b.y-target.y)<18))continue;
   return target;
  }
 }
 return null;
}
function createRoaming(core){
 if(!core||typeof core.advance!=='function')throw Error('DCFarm.advance missing');
 const original=core.advance;
 let active=false;
 function prepare(s,delta){
  if(!active||!Number.isFinite(delta)||delta<=0||!s?.farm?.actors||
     !s?.world||s.world.paused||s.pendingBattle)return 0;
  let changed=0;
  for(const m of s.team||[]){
   if(m.egg||m.lost||m.location==='storage')continue;
   const a=s.farm.actors[m.instanceId];
   // Keep the original automatic rest/food and every manual instruction.
   if(!a||a.mode!=='idle'||a.goal||(a.idleTime||0)<2.9||
     m.fatigue>=65||(Number.isFinite(m.hp)&&Number.isFinite(m.maxHp)&&m.hp<m.maxHp*.4)||
     (m.hunger>=core.CFG.hungerSeek&&s.farm.foods?.some(f=>!f.claim)))continue;
   const target=pickDestination(core,s,m,a);
   if(!target)continue;
   a.goal=target;a.mode='moving';a.pose=2;a.idleTime=0;
   changed++;
  }
  return changed;
 }
 // The farm UI calls core.advance by reference; swapping just that public
 // entry preserves all original private simulation functions in farm-core.js.
 function patched(s,delta,hooks){
  prepare(s,delta);
  return original.call(this,s,delta,hooks);
 }
 core.advance=patched;
 return Object.freeze({
  set(value){active=!!value;return active;},
  get enabled(){return active;},
  prepare,
  get isInstalled(){return core.advance===patched;},
  restore(){if(core.advance===patched)core.advance=original;active=false;}
 });
}
if(typeof module!=='undefined'&&module.exports)
 module.exports={createRoaming,pickDestination};
// No mobile injection, no mutation of ROM/HTML or render engine.
if(!root?.document||!root.DCFarm||root.DCRanchFreeRoam||
 !root.matchMedia?.('(min-width:900px) and (pointer:fine)').matches)return;
const host=root.document.querySelector('#dc-ranch-view-switch');
if(!host)return;
const roam=createRoaming(root.DCFarm);
const button=root.document.createElement('button');
button.id='dc-ranch-free-roam-toggle';button.type='button';
button.setAttribute('aria-pressed','false');
button.setAttribute('aria-label','확장형 사육장 자유 산책');
button.textContent='🌿 자유 산책 켜기';
button.title='명령이 없는 디지몬만 해금된 주변 구역으로 자율 산책해요. 능력치·진화 추가 효과는 없습니다.';
button.addEventListener('click',()=>{
 const on=roam.set(!roam.enabled);
 button.setAttribute('aria-pressed',String(on));
 button.textContent=on?'🌿 자유 산책 켜짐':'🌿 자유 산책 켜기';
});
host.appendChild(button);
root.DCRanchFreeRoam=roam;
})(typeof window!=='undefined'?window:globalThis);
