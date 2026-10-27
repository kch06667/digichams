/* user_design topology/time; numeric balance provisional, not ROM-verified. */
(function(root){
'use strict';
const SLOTS={attack:{x:25,y:35},defense:{x:50,y:22},speed:{x:75,y:35},rest:{x:73,y:68},cage:{x:50,y:35}};
// Peripheral hex coordinates use the existing actor coordinate frame, mapped to world pixels by hex-farm-ui.js.
// These are expansion UX positions, NOT coordinates extracted from the NDS ROM.
const PLOTS={training:{x:50,y:-76,zone:'training'},track:{x:154,y:-18,zone:'track'},rest:{x:-54,y:118,zone:'rest'},forest:{x:50,y:198,zone:'forest'}};
// Same pixel-space hex geometry as the UI; placement must stay on open ground.
const HEX_CENTERS={core:[460,340],training:[460,128],garden:[270,234],track:[650,234],rest:[270,446],clinic:[650,446],forest:[460,552]};
function foodGround(s,x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 const px=369+x*1.82,py=262+y*1.56;
 return Object.entries(HEX_CENTERS).some(([id,[cx,cy]])=>{
  if(id!=='core'&&!s.facilities?.[id])return false;
  const dx=Math.abs(px-cx),dy=Math.abs(py-cy);
  // A small inset keeps the meal inside the clipped hex border.
  return dx<=102&&dy<=105-dx*113/220;
 });
}
function center(id){const [x,y]=HEX_CENTERS[id];return {x:(x-369)/1.82,y:(y-262)/1.56};}
function openZones(s){return Object.keys(HEX_CENTERS).filter(id=>id==='core'||s.facilities?.[id]);}
function zoneAt(s,p){return openZones(s).sort((a,b)=>Math.hypot(p.x-center(a).x,p.y-center(a).y)-Math.hypot(p.x-center(b).x,p.y-center(b).y))[0];}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function walkable(s,x,y){
 if(foodGround(s,x,y))return true;
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 return openZones(s).some(id=>id!=='core'&&segmentDistance({x,y},center('core'),center(id))<=9);
}
// Expansion topology, not recovered NDS movement: outer plots connect through core.
function routeTo(s,a,target){
 const from=zoneAt(s,a),to=zoneAt(s,target),points=[];
 if(from!==to){if(from!=='core')points.push(center(from));points.push(center('core'));if(to!=='core')points.push(center(to));}
 points.push({x:target.x,y:target.y});return points;
}
// Small ground footprints, not sprite bounding boxes. Numbers are expansion UX.
const PERSONAL_SPACE=10;
function safeStride(s,a,p,peers){
 if(!walkable(s,p.x,p.y))return false;
 return peers.every(b=>{
  const before=Math.hypot(a.x-b.x,a.y-b.y),after=Math.hypot(p.x-b.x,p.y-b.y);
  // Old saves/spawn positions may overlap. Permit only movement that separates them.
  if(before<PERSONAL_SPACE-1e-6)return after>before+1e-6;
  return segmentDistance(b,a,p)>=PERSONAL_SPACE-1e-6;
 });
}
function yieldIdle(s,a,target){
 const actors=activeActors(s);
 for(const b of actors){
  if(b===a||b.mode!=='idle'||b.goal||Math.hypot(a.x-b.x,a.y-b.y)>PERSONAL_SPACE*2||Math.hypot(target.x-b.x,target.y-b.y)>PERSONAL_SPACE)continue;
  const angle=Math.atan2(b.y-a.y,b.x-a.x);
  for(const turn of [Math.PI/2,-Math.PI/2,Math.PI,0]){
   const p={x:b.x+Math.cos(angle+turn)*18,y:b.y+Math.sin(angle+turn)*18};
   if(!foodGround(s,p.x,p.y)||actors.some(c=>c!==b&&Math.hypot(c.x-p.x,c.y-p.y)<PERSONAL_SPACE))continue;
   // Only idle actors yield: explicit training, rest and reserved meals are untouched.
   b.goal={...p,kind:'wander',yielding:true};b.mode='moving';b.route=null;b.routeKey=null;b.pose=2;break;
  }
 }
}
function stride(s,a,p,amount){
 const dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy),length=Math.min(d,amount);
 if(d<1e-9)return true;
 if(a.route.length===1)yieldIdle(s,a,p);
 const peers=activeActors(s).filter(b=>b!==a&&Math.hypot(a.x-b.x,a.y-b.y)<PERSONAL_SPACE+amount+1);
 // Consistent right-hand preference avoids symmetric head-on stand-offs.
 const angles=[0,Math.PI/6,Math.PI/3,Math.PI/2,2*Math.PI/3,5*Math.PI/6,Math.PI,-Math.PI/6,-Math.PI/3,-Math.PI/2,-2*Math.PI/3];
 for(const angle of angles){
  const ux=dx/d*Math.cos(angle)-dy/d*Math.sin(angle),uy=dx/d*Math.sin(angle)+dy/d*Math.cos(angle);
  const next={x:a.x+ux*length,y:a.y+uy*length};
  if(!safeStride(s,a,next,peers))continue;
  a.x=next.x;a.y=next.y;if(Math.abs(ux)>1e-9)a.face=ux<0?1:-1;a.pose=2;
  a.trafficWait=0;return angle===0&&length>=d-1e-9;
 }
 a.pose=0;a.trafficWait=(a.trafficWait||0)+amount/CFG.moveSpeed;
 return false;
}
function walk(s,a,target,dt){
 const key=target.x+','+target.y;
 if(a.routeKey!==key||!Array.isArray(a.route)||!a.route.length){a.routeKey=key;a.route=routeTo(s,a,target);}
 let travel=CFG.moveSpeed*dt;
 while(a.route.length){
  const p=a.route[0],d=Math.hypot(p.x-a.x,p.y-a.y);
  if(d<1e-9){a.route.shift();continue;}
  // A transit marker is not an action destination: walk around an occupied marker.
  if(a.route.length>1&&d<PERSONAL_SPACE*2&&activeActors(s).some(b=>b!==a&&Math.hypot(p.x-b.x,p.y-b.y)<PERSONAL_SPACE)){
   const next=a.route[1];
   if([.25,.5,.75].every(t=>walkable(s,a.x+(next.x-a.x)*t,a.y+(next.y-a.y)*t))){a.route.shift();continue;}
  }
  if(!stride(s,a,p,travel))return false;
  travel-=d;a.route.shift();
  if(travel<1e-9&&a.route.length)return false;
 }
 a.routeKey=null;return true;
}
function facilityKey(a){return a.goal&&SLOTS[a.goal.kind]?(a.goal.zone||'core')+':'+((a.goal.zone||'core')==='core'?a.goal.kind:'shared'):null;}
function activeActors(s){return s.team.filter(m=>!m.egg&&m.location!=='storage').map(m=>actor(s,m.instanceId));}
function stationPoint(a){const g=a.goal;return {x:g.x+(a.station===1?(g.zone==='core'&&g.x>50?-32:32):0),y:g.y};}
function reserveStation(s,a){
 const key=facilityKey(a);if(!key)return true;
 const peers=activeActors(s).filter(b=>b!==a&&facilityKey(b)===key);
 // Existing acting users get first claim when migrating saves without reservations.
 const reserved=new Set(peers.filter(b=>Number.isInteger(b.station)).map(b=>b.station));
 if(!Number.isInteger(a.station)||a.station<0||a.station>1||peers.some(b=>b.station===a.station&&b.mode==='acting')){
  a.station=[0,1].find(n=>!reserved.has(n));
 }
 if(a.station!==undefined){a.waitPosition=null;return true;}
 if(!a.waitPosition){
  const c=center(a.goal.zone||'core');
  // Bounded waiting positions; never grow queue rings outside the purchased hex.
  const occupied=activeActors(s).filter(b=>b!==a).map(b=>b.waitPosition||((Number.isInteger(b.station)&&b.goal)?stationPoint(b):b));
  outer:for(const dy of [30,12,-12,-30])for(const dx of [-32,0,32]){
   const p={x:c.x+dx,y:c.y+dy};
   if(foodGround(s,p.x,p.y)&&occupied.every(b=>Math.hypot(p.x-b.x,p.y-b.y)>=18)){a.waitPosition=p;break outer;}
  }
 }
 return false;
}
function migrateStations(s){
 const used=new Map();
 for(const a of activeActors(s).filter(a=>a.mode==='acting'&&facilityKey(a))){
  const key=facilityKey(a),taken=used.get(key)||new Set();used.set(key,taken);
  if(!Number.isInteger(a.station)||a.station<0||a.station>1||taken.has(a.station))a.station=[0,1].find(n=>!taken.has(n));
  if(a.station===undefined){a.mode='waiting';a.repositioning=true;continue;}
  taken.add(a.station);
  const p=stationPoint(a);
  if(Math.hypot(a.x-p.x,a.y-p.y)>1e-6){a.mode='moving';a.repositioning=true;a.route=null;}
 }
}
const CARE=root.DCCare||(typeof require==='function'?require('./care-core.js'):null);
const CFG={moveSpeed:16,hatchSeconds:12,restCycle:2,restHeal:8,trainHP:4,foodSeconds:1.5,foodRot:120,daySeconds:240,hungerRate:.06,hungerSeek:0,provenance:'temporary_balance'};
function ensure(s){
 s.world||={seconds:0,speed:1,paused:false,seed:12345,accumulator:0};
 s.farm||={actors:{},foods:[],nextFood:1,completed:0};
 s.world.accumulator??=0;s.farm.actors||={};s.farm.foods||=[];
 // Guard against malformed/older saves before the simulation begins.
 if(!Number.isFinite(s.world.seed))s.world.seed=12345;
 if(!Number.isFinite(s.world.accumulator)||s.world.accumulator<0)s.world.accumulator=0;
 if(!Number.isFinite(s.farm.completed)||s.farm.completed<0)s.farm.completed=0;
 if(!Number.isFinite(s.farm.nextFood)||s.farm.nextFood<1)s.farm.nextFood=1;
 s.farm.nextFood??=1;s.farm.completed??=0;
 // Saved meals may contain stale claims after older saves or roster changes.
 const activeIds=new Set(s.team.filter(m=>!m.egg&&m.location!=='storage').map(m=>m.instanceId));
 for(const f of s.farm.foods)if(f.claim&&(!activeIds.has(f.claim)||s.farm.actors[f.claim]?.foodId!==f.id||s.farm.actors[f.claim]?.goal?.kind!=='eat'))delete f.claim;
 s.world.seconds=Math.max(0,Number(s.world.seconds)||0);
 if(![1,2,4].includes(s.world.speed))s.world.speed=1;
 for(const m of s.team){if(!m.instanceId)throw Error('Missing instanceId');s.farm.actors[m.instanceId]||={x:50,y:62,mode:'idle',pose:0,remaining:0,idleTime:0,autoRest:true};}
 for(const id of Object.keys(s.farm.actors))if(!s.team.some(m=>m.instanceId===id))delete s.farm.actors[id];
 s.saveVersion=Math.max(3,s.saveVersion||0);return s;
}
function rnd(s){s.world.seed=(Math.imul(s.world.seed,1664525)+1013904223)>>>0;return s.world.seed/4294967296;}
function log(s,text){s.logs.unshift('[사육장] '+text);s.logs=s.logs.slice(0,60);}
function actor(s,id){return s.farm.actors[id];}
function clear(s,a){for(const f of s.farm.foods)if(f.claim===a.id)delete f.claim;a.goal=null;a.mode='idle';a.pose=0;a.remaining=0;a.resume=null;a.resumeTarget=null;a.resumeOptions=null;a.target=null;a.foodId=null;a.waitPosition=null;a.station=undefined;a.route=null;a.routeKey=null;a.repositioning=false;a.trafficWait=0;a.idleTime=0;}
function destination(s,kind,options={}){
 if(kind==='cage'){
  const cage=options.cage;
  const forest=cage==='forest'&&s.facilities?.forest;
  return {...(forest?PLOTS.forest:PLOTS.training),kind:'cage',cage};
 }
 if(kind==='rest'&&s.facilities?.rest)return {...PLOTS.rest,kind};
 if(kind==='speed'&&s.facilities?.track)return {...PLOTS.track,kind};
 if((kind==='attack'||kind==='defense'||kind==='speed')&&s.facilities?.training)return {...PLOTS.training,kind};
 return {...SLOTS[kind],zone:'core',kind};
}
function command(s,id,kind,options={}){ensure(s);const m=s.team.find(m=>m.instanceId===id);if(!m||m.egg||m.location==='storage'||s.pendingBattle)return false;if(kind!=='stop'&&!SLOTS[kind])return false;const stat={attack:'atk',defense:'def',speed:'spd'}[kind];
 const cages=root.DCCages||(typeof require==='function'?require('./cage-training-core.js'):null);
 if(kind==='cage'&&!cages?.owned(s,options.cage))return false;
 const proposed=stat&&options?.target!==undefined?Number(options.target):null;
 const proposedAp=kind==='cage'&&options?.apTarget!==undefined?Number(options.apTarget):null;
 if(proposedAp!==null&&(!Number.isInteger(proposedAp)||proposedAp<1||proposedAp>999))return false;
 if(proposed!==null&&(!Number.isInteger(proposed)||proposed<1||proposed>999))return false;
 const a=actor(s,id);a.id=id;clear(s,a);if(kind==='stop')return true;
 if(proposed!==null){const value=proposed;
  if(m[stat]>=value){log(s,m.name+'의 '+stat+' 목표 '+value+' 이미 달성.');return true;}
  a.target={stat,value};
 }
 if(proposedAp!==null){
   const family=Object.keys(cages.MAP[options.cage].ap)[0],value=proposedAp;
   const current=Number(m.evo?.ap?.[family])||0;
   if(current>=value){log(s,m.name+'의 '+family+' AP '+value+' 이미 달성.');return true;}
   a.target={ap:family,value};
 }
 a.goal=destination(s,kind,options);a.mode='moving';a.pose=2;return true;}
function placeFood(s,x=50,y=65){
 ensure(s);
 if(s.food<=0||s.pendingBattle||s.farm.foods.length>=12||!foodGround(s,x,y))return false;
 s.food--;
 s.farm.foods.push({id:s.farm.nextFood++,x,y,age:0});
 return true;
}
// Each food item can be reserved by only one hungry active Digimon.
// Prioritize the hungriest first, then choose their closest free food item.
// Explicit training/rest orders are not interrupted by automatic foraging.
function assignFood(s){
 const candidates=s.team.filter(m=>!m.egg&&m.location!=='storage'&&m.hunger>=CFG.hungerSeek&&
  ((actor(s,m.instanceId)?.mode==='idle')||(actor(s,m.instanceId)?.goal?.kind==='wander')));
 candidates.sort((a,b)=>b.hunger-a.hunger||a.instanceId.localeCompare(b.instanceId));
 for(const m of candidates){
  const a=actor(s,m.instanceId);
  const free=s.farm.foods.filter(f=>!f.claim).sort((f,g)=>
   Math.hypot(f.x-a.x,f.y-a.y)-Math.hypot(g.x-a.x,g.y-a.y)||f.id-g.id);
  const food=free[0];if(!food)continue;
  food.claim=m.instanceId;a.id=m.instanceId;a.foodId=food.id;
  a.goal={x:food.x,y:food.y,kind:'eat'};a.mode='moving';a.pose=2;a.idleTime=0;
 }
}
function trainDuration(m,periods,facilities){const base=Math.max(.1,periods?.[m.name]||2);return base*(facilities?.training ? .85 : 1)*(m.care?.sick?1.5:m.care?.injured?1.25:1);}
function step(s,dt,hooks={}){
 ensure(s);if(s.world.paused||s.pendingBattle)return;
 const previousDay=Math.floor(s.world.seconds/CFG.daySeconds);s.world.seconds+=dt;const nextDay=Math.floor(s.world.seconds/CFG.daySeconds);
 if(nextDay>previousDay){const n=nextDay-previousDay;s.day+=n;s.food+=2*n;s.ropes=Math.min(9,s.ropes+n);if(hooks.evolution?.advanceDays)hooks.evolution.advanceDays(s,n,hooks.lookup);CARE?.advanceDays(s,n);log(s,'하루가 지나 먹이와 로프가 보충됐어.');}
 for(const f of s.farm.foods)f.age+=dt;
 // Spoiled food is removed rather than eaten in this first slice; disease rules pending.
 s.farm.foods=s.farm.foods.filter(f=>f.age<CFG.foodRot);
 // Reserve food once per step across the whole roster, independent of roster order.
 // Do this after hunger advancement so every eligible Digimon can compete fairly.
 for(const m of s.team)if(m.location!=='storage'&&!m.egg)
  m.hunger=Math.min(100,(Number(m.hunger)||0)+dt*CFG.hungerRate);
 assignFood(s);
 migrateStations(s);
 for(const m of s.team){
  const id=m.instanceId,a=actor(s,id);a.id=id;if(m.location==='storage')continue;
  if(m.egg){m.hatchRemaining=(m.hatchRemaining??CFG.hatchSeconds)-dt;a.pose=0;if(m.hatchRemaining<=0){if(hooks.evolution?.hatch)hooks.evolution.hatch(s,m,hooks.lookup);else {delete m.egg;delete m.hatchRemaining;}log(s,'디지타마 부화 완료.');}continue;}
  // Hunger rises even while training, but stored Digimon remain frozen.
  if(a.mode==='idle'){
   a.idleTime+=dt;
   // When no specific order is active, fatigued or injured Digimon rest by themselves.
   if(m.fatigue>=65||m.hp<m.maxHp*.4){a.goal=destination(s,'rest');a.mode='moving';a.pose=2;}
   else if(a.idleTime>3){a.idleTime=0;a.goal={x:23+rnd(s)*54,y:27+rnd(s)*49,kind:'wander'};a.mode='moving';a.pose=2;}
  }
  if(a.mode==='moving'||a.mode==='waiting'){
   if(!a.goal){clear(s,a);continue;}
   if(a.goal.kind==='eat'&&!s.farm.foods.some(f=>f.id===a.foodId)){clear(s,a);continue;}
   const kind=a.goal.kind;
   const available=reserveStation(s,a);
   if(!available){
    a.mode='waiting';
    if(a.waitPosition){if(walk(s,a,a.waitPosition,dt))a.pose=0;}else a.pose=0;
    continue;
   }
   const target=facilityKey(a)?stationPoint(a):a.goal;
   a.mode='moving';
   if(!walk(s,a,target,dt))continue;
   if(kind==='wander'){a.goal=null;a.mode='idle';a.pose=0;continue;}
   if(a.repositioning){a.repositioning=false;a.mode='acting';a.pose=kind==='rest'?13:32;continue;}
   a.mode='acting';a.remaining=kind==='rest'?CFG.restCycle:kind==='eat'?CFG.foodSeconds:trainDuration(m,hooks.periods,s.facilities);a.pose=kind==='rest'?13:kind==='eat'?14:32;continue;
  }
  if(a.mode!=='acting')continue;
  a.remaining-=dt;if(a.remaining>1e-8)continue;const kind=a.goal?.kind;
  if(kind==='eat'){
   const i=s.farm.foods.findIndex(f=>f.id===a.foodId&&f.claim===id);
   if(i>=0){s.farm.foods.splice(i,1);m.hunger=Math.max(0,m.hunger-30);m.hp=Math.min(m.maxHp,m.hp+5);m.friendship=Math.min(100,m.friendship+3);log(s,m.name+'이 바닥의 먹이를 먹었어.');}
   clear(s,a);
   if(i>=0){a.emote='💚';a.emoteUntil=s.world.seconds+1.8;}
  }else if(kind==='rest'){
   // Expanded rest/flower plots make rest more effective; temporary expansion balance.
   const heal=CFG.restHeal+(s.facilities?.rest?3:0)+(s.facilities?.garden?2:0);
   m.hp=Math.min(m.maxHp,m.hp+heal);
   // TP is a battle resource and recharges during farm rest (v0.22 extension balance).
   if(Number.isFinite(m.maxTp)&&m.maxTp>0)m.tp=Math.min(m.maxTp,Math.max(0,Number.isFinite(m.tp)?m.tp:m.maxTp)+Math.max(3,Math.ceil(m.maxTp*.12)));
   m.fatigue=Math.max(0,m.fatigue-12-(s.facilities?.rest?4:0));
   if(a.resume&&m.hp>=m.maxHp*.8&&m.fatigue<=30){const k=a.resume,opts=a.resumeOptions||(Number.isFinite(a.resumeTarget)?{target:a.resumeTarget}:{});command(s,id,k,opts);}
   else if(m.hp>=m.maxHp&&m.fatigue===0)clear(s,a);else a.remaining=CFG.restCycle;
  }else if(SLOTS[kind]){
   const healthCost=CFG.trainHP+(m.care?.injured?1:0)+(m.care?.sick?2:0);
   if(m.hp-healthCost<Math.max(1,m.maxHp*.2)||m.fatigue>=80){
    const resume=kind,oldGoal={...a.goal},oldTarget=a.target?{...a.target}:null;
    if(a.autoRest){command(s,id,'rest');a.resume=resume;a.resumeTarget=oldTarget?.value??null;a.resumeOptions=resume==='cage'?{cage:oldGoal.cage,...(oldTarget?.ap?{apTarget:oldTarget.value}:{})}:oldTarget?.stat?{target:oldTarget.value}:{};}else{clear(s,a);log(s,m.name+'의 훈련을 체력/피로 때문에 중단했어.');}continue;
   }
   const isCage=kind==='cage',cages=root.DCCages||(typeof require==='function'?require('./cage-training-core.js'):null);
   const effect=isCage?cages?.effect(s,kind,a.goal?.zone,a.goal?.cage):null;
   if(isCage&&!effect){clear(s,a);continue;}
   const gain=isCage?({atk:'atk',def:'def',spd:'spd',wis:'atk'}[effect.stat]||'atk'):{attack:'atk',defense:'def',speed:'spd'}[kind];
   const loss={atk:'def',def:'spd',spd:'atk'}[gain]||'def';
   m.hp-=healthCost;
   // Secondary numeric effects are provisional. Facility affinities come from NDS guides.
   if(isCage){if(effect.stat==='wis')m.wis=Math.max(1,Number(m.wis)||1)+(CARE?.statGain(s.day,1)||1);else if(effect.stat)m[gain]+=(CARE?.statGain(s.day,1)||1);}
   else{const baseGain=1+(kind==='speed'&&s.facilities?.track?1:0);
    m[gain]+=(CARE?.statGain(s.day,baseGain)||baseGain);
    m[loss]=Math.max(1,m[loss]-(CARE?.statLoss(s.day,1)??1));}
   m.training++;m.fatigue=Math.min(100,m.fatigue+8);s.points++;s.farm.completed++;
   CARE?.afterTraining(s,m);
   if(hooks.evolution?.train)hooks.evolution.train(s,m,kind,a.goal?.zone,hooks.lookup,{cageId:a.goal?.cage});
   // Evolution can cancel the actor's goal; don't restart training after transforming.
   if(a.mode!=='acting'||!a.goal)continue;
   if(hooks.xp)hooks.xp(m,5);else m.exp+=5;
   if(a.target){const value=a.target.ap?m.evo?.ap?.[a.target.ap]:m[a.target.stat];
    if(value>=a.target.value){const goal=a.target.value,targetLabel=a.target.ap||gain;clear(s,a);log(s,m.name+' 목표 '+targetLabel+' '+goal+' 달성! 자동 훈련 종료.');continue;}}
   a.remaining=trainDuration(m,hooks.periods,s.facilities);
   if(isCage)log(s,m.name+' '+effect.label+' 훈련 완료: 종족 AP 축적 / HP -4 (증가량 임시)');
   else log(s,m.name+' 훈련 완료: '+gain+' +'+(kind==='speed'&&s.facilities?.track?2:1)+' / '+loss+' -1 / HP -4 (임시)');
  }
 }
}
function advance(s,realSeconds,hooks={}){ensure(s);if(s.world.paused||s.pendingBattle)return;s.world.accumulator+=Math.max(0,realSeconds)*s.world.speed;while(s.world.accumulator>=.05-1e-9){s.world.accumulator-=.05;if(s.world.accumulator<0)s.world.accumulator=0;step(s,.05,hooks);}}
const api={ensure,command,placeFood,step,advance,SLOTS,PLOTS,destination,CFG,HEX_CENTERS,foodGround,walkable};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.DCFarm=api;
})(typeof globalThis!=='undefined'?globalThis:this);
