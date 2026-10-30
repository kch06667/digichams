/* PC opt-in free-roaming extension for the existing real farm engine.
 * PR81: use unlocked areas for ambient walks and defer immediately to the
 * original food, rest, training, route and collision systems. No new stat
 * effects, save schema, ROM logic or autonomous training.
 */
(function(root){
'use strict';
const OFFSETS=[[-12,-10],[13,9],[-16,9],[15,-11],[0,17],[0,-17]];
const ZONE_LABELS=Object.freeze({
 core:'중앙',training:'훈련장',garden:'정원',track:'주행장',
 rest:'휴식 구역',clinic:'치료 구역',forest:'숲'
});
function hash(value){
 let h=2166136261;
 for(const c of String(value)){h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;}
 return h>>>0;
}
function needsRest(m){
 return Number(m?.fatigue)>=65 ||
   (Number.isFinite(m?.hp)&&Number.isFinite(m?.maxHp)&&
    m.maxHp>0&&m.hp<m.maxHp*.4);
}
function isAmbient(a){
 return a?.goal?.kind==='wander' &&
   Object.hasOwn(ZONE_LABELS,a.goal.zone) && a.goal.zone!=='core';
}
function activePeers(s,id){
 const ids=new Set((s.team||[]).filter(m=>m.instanceId!==id &&
   !m.egg&&!m.lost&&m.location!=='storage').map(m=>m.instanceId));
 const result=[];
 for(const [key,a] of Object.entries(s.farm?.actors||{})){
  if(!ids.has(key))continue;
  if(Number.isFinite(a.x)&&Number.isFinite(a.y))result.push({x:a.x,y:a.y});
  // A destination reserved by another actor cannot be chosen again,
  // even if its owner is still en route from the center.
  const g=a.goal;
  if(g&&Number.isFinite(g.x)&&Number.isFinite(g.y))
   result.push({x:g.x,y:g.y});
 }
 return result;
}
function pickDestination(core,s,m,a){
 const centers=core.HEX_CENTERS;
 if(!centers||!s?.farm?.actors||typeof core.foodGround!=='function')return null;
 const open=Object.keys(centers).filter(id=>id!=='core'&&s.facilities?.[id]);
 if(!open.length)return null;
 const stamp=Math.floor(Math.max(0,Number(s.world?.seconds)||0)/7);
 const base=(hash(m.instanceId)+stamp)>>>0;
 const occupied=activePeers(s,m.instanceId);
 // A somewhat tired Digimon prefers to *visit* a quiet unlocked zone.
 // The visit itself does not restore HP, change fatigue or earn AP.
 const quiet=Number(m.fatigue)>=30||
   (Number.isFinite(m.hp)&&Number.isFinite(m.maxHp)&&m.maxHp>0&&m.hp<m.maxHp*.72);
 const calm=Number(m.fatigue)>=45?['rest','garden']:['garden','rest'];
 const ordered=quiet
  ? [...calm.filter(id=>open.includes(id)),
     ...open.filter(id=>!calm.includes(id)).sort((x,y)=>
       ((open.indexOf(x)-base%open.length+open.length)%open.length)-
       ((open.indexOf(y)-base%open.length+open.length)%open.length))]
  : open.map((_,i)=>open[(base+i)%open.length]);
 for(let n=0;n<ordered.length;n++){
  const zone=ordered[n],point=centers[zone];
  if(!point)continue;
  for(let k=0;k<OFFSETS.length;k++){
   const off=OFFSETS[(base+k+n)%OFFSETS.length];
   const target={x:(point[0]-369)/1.82+off[0],
    y:(point[1]-262)/1.56+off[1],kind:'wander',zone};
   if(!core.foodGround(s,target.x,target.y))continue;
   if(occupied.some(b=>Math.hypot(b.x-target.x,b.y-target.y)<18))continue;
   return target;
  }
 }
 return null;
}
// The base engine keeps idleTime as the canonical, saved idle counter.
 // Negative seconds reserve a short ambient pause without changing the schema.
function dwellSeconds(id,zone,seconds){
 const phase=Math.floor(Math.max(0,Number(seconds)||0)/7);
 return 3+(hash(id+':'+zone+':'+phase)%4); // 3-6 seconds
}
function activitySnapshot(s){
 const result={roaming:0,dwelling:0,eating:0,resting:0,training:0,other:0,zoneCounts:{}};
 for(const m of s?.team||[]){
  if(m.egg||m.lost||m.location==='storage')continue;
  const a=s.farm?.actors?.[m.instanceId];
  if(!a)continue;
  const kind=a.goal?.kind;
  if(isAmbient(a)){
   result.roaming++;
   result.zoneCounts[a.goal.zone]=(result.zoneCounts[a.goal.zone]||0)+1;
  }else if(a.mode==='idle'&&a.idleTime<0&&!a.goal)result.dwelling++;
  else if(kind==='eat')result.eating++;
  else if(kind==='rest')result.resting++;
  else if(['attack','defense','speed','cage'].includes(kind))result.training++;
  else result.other++;
 }
 return result;
}
function createRoaming(core){
 if(!core||typeof core.advance!=='function'||typeof core.command!=='function')
  throw Error('DCFarm.advance/command missing');
 const original=core.advance;
 let active=false;
 function prepare(s,delta){
  if(!active||!Number.isFinite(delta)||delta<=0||!s?.farm?.actors||
     !s?.world||s.world.paused||s.pendingBattle)return 0;
  let changed=0;
  for(const m of s.team||[]){
   if(m.egg||m.lost||m.location==='storage')continue;
   const a=s.farm.actors[m.instanceId];
   if(!a)continue;
   // Base DCFarm only automatically starts resting from idle. A long
   // optional ambient trip must not delay treatment/rest. Reuse its own
   // command handler; never interrupt explicit trainer orders.
   if(isAmbient(a) && (a.mode==='moving'||a.mode==='waiting') && needsRest(m)){
    if(core.command(s,m.instanceId,'rest'))changed++;
    continue;
   }
   if(a.mode!=='idle'||a.goal||(a.idleTime||0)<2.9||
     needsRest(m)||
     // DCFarm.assignFood owns meal choice/claims and will interrupt any
     // ambient wander in the upcoming original simulation step.
     (m.hunger>=core.CFG.hungerSeek&&s.farm.foods?.some(f=>!f.claim)))continue;
   const target=pickDestination(core,s,m,a);
   if(!target)continue;
   a.goal=target;a.mode='moving';a.pose=2;a.idleTime=0;
   changed++;
  }
  return changed;
 }
 function patched(s,delta,hooks){
  // Observe ONLY 8th-pass ambient goals. Never pause training, feeding,
  // facility rest, legacy center wandering or the evolution pipeline.
  const eligible=active&&Number.isFinite(delta)&&delta>0&&s?.farm?.actors&&
    !s.world?.paused&&!s.pendingBattle;
  const arrivals=eligible
    ? (s.team||[]).filter(m=>!m.egg&&!m.lost&&m.location!=='storage')
      .map(m=>({id:m.instanceId,goal:s.farm.actors[m.instanceId]?.goal}))
      .filter(o=>o.goal?.kind==='wander'&&o.goal.zone&&
        o.goal.zone!=='core'&&Object.hasOwn(ZONE_LABELS,o.goal.zone))
    : [];
  const glances=eligible
    ? (s.team||[]).filter(m=>!m.egg&&!m.lost&&m.location!=='storage')
      .map(m=>({id:m.instanceId,a:s.farm.actors[m.instanceId]}))
      .filter(o=>o.a?.mode==='idle'&&!o.a.goal&&o.a.idleTime<=-2)
      .map(o=>o.id)
    : [];
  prepare(s,delta);
  const result=original.call(this,s,delta,hooks);
  if(!eligible||s.world?.paused||s.pendingBattle)return result;
  // Crossing -2 happens only once per pause, including across JSON reload.
  // The existing mirrored idle GIF (pose 0) becomes a quick glance.
  for(const id of glances){
   const a=s.farm.actors?.[id];
   if(a?.mode==='idle'&&!a.goal&&a.idleTime>-2&&a.idleTime<2){
    a.face=a.face===1?-1:1;
   }
  }
  for(const {id,goal} of arrivals){
   const a=s.farm.actors?.[id];
   if(!a||a.mode!=='idle'||a.goal)continue;
   a.idleTime=-dwellSeconds(id,goal.zone,s.world?.seconds);
   a.pose=0; // canonical species-specific idle animation
  }
  return result;
 }
 core.advance=patched;
 return Object.freeze({
  set(value){active=!!value;return active;},
  get enabled(){return active;},
  prepare,
  snapshot:activitySnapshot,
  get isInstalled(){return core.advance===patched;},
  restore(){if(core.advance===patched)core.advance=original;active=false;}
 });
}
if(typeof module!=='undefined'&&module.exports)
 module.exports={createRoaming,pickDestination,activitySnapshot,needsRest};
// No mobile injection, no independent simulation engine, no ROM loading.
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
button.title='유휴 디지몬이 해금된 구역을 산책하며, 배고프면 기존 먹이 AI를, 지치면 기존 휴식 시설을 사용합니다.';
const status=root.document.createElement('span');
status.id='dc-ranch-life-status';status.setAttribute('role','status');
status.setAttribute('aria-live','off');
status.textContent='자유 산책 꺼짐 · 기존 생활 AI 유지';
function refreshStatus(){
 if(!roam.enabled){status.textContent='자유 산책 꺼짐 · 기존 생활 AI 유지';return;}
 const gameState=root.DCHexFarm?.state;
 if(!gameState){status.textContent='자유 산책 켜짐';return;}
 const q=roam.snapshot(gameState);
 const zones=Object.keys(q.zoneCounts).map(zone=>
  (ZONE_LABELS[zone]||zone)+' '+q.zoneCounts[zone]).join(', ');
 status.textContent='산책 '+q.roaming+' · 구경 '+q.dwelling+' · 식사 '+q.eating+
  ' · 휴식 '+q.resting+' · 훈련 '+q.training+
  (zones?' | 방문: '+zones:'');
}
button.addEventListener('click',()=>{
 const on=roam.set(!roam.enabled);
 button.setAttribute('aria-pressed',String(on));
 button.textContent=on?'🌿 자유 산책 켜짐':'🌿 자유 산책 켜기';
 refreshStatus();
});
host.append(button,status);
const interval=root.setInterval(()=>{
 if(!root.document.hidden)refreshStatus();
},1600);
root.addEventListener('pagehide',()=>root.clearInterval(interval),{once:true});
root.DCRanchFreeRoam=roam;
})(typeof window!=='undefined'?window:globalThis);
