/* Shared real-game battle judgment engine — extracted verbatim method bodies
 * from index.html at blob a2912472e27bbf7469dcc89b9d60b300b421d1a5.
 * The 10 ORIGINAL FUNCTIONS below are unchanged source text: alive,
 * chooseTarget, emit, hit, projectile, beginMelee, beginSkill,
 * advanceSpecial, think and update. All DOM and persistent-save side effects
 * are replaced only through dependency injection, NOT by changing these
 * battle calculations. Rendering subscribes to events/state snapshots.
 *
 * This preserves the existing web extension's original mechanics, not
 * necessarily Nintendo DS ROM exactness. No art or saves published.
 */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const BC=root?.DCBattleCore||(node?require('./battle-core.js'):null);
 const TECH=root?.DigiArenaTechniques||(node?require('../phaser-lab/arena-techniques.js'):null);
 const api=factory(BC,TECH);
 if(node)module.exports=api;
 if(root)root.DCOriginalArenaCore=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(BC,TECH){
 'use strict';
 if(!BC||!TECH)throw Error('Legacy battle/technique rules are required');
 const FIELD=Object.freeze({left:16,right:584,top:66,bottom:383});
 const WORLD=Object.freeze({w:600,h:405});
 const MARGIN=Object.freeze({left:16,right:16,top:66,bottom:22});
 const clamp=(n,a,b)=>globalThis.Math.max(a,globalThis.Math.min(b,n));
 const defaultNames=[['아구몬','파타몬','팔몬'],['가부몬','텐타몬','피요몬']];
 function defaultTeam(side){
   return defaultNames[side].map((name,i)=>({
     name,hp:125,maxHp:125,atk:46+i*5,def:20+i*3,spd:47+i*6
   }));
 }
 function createMatch({allies,opponents,teamSize=3,tactic='balanced',seed=12345}={}){
   if(!BC.TACTICS[tactic])throw Error('Invalid tactic');
   if(!Number.isInteger(teamSize)||teamSize<1||teamSize>3)throw Error('Invalid team size');
   const ally=allies||defaultTeam(0).slice(0,teamSize);
   const enemy=opponents||defaultTeam(1).slice(0,teamSize);
   if(!Array.isArray(ally)||!Array.isArray(enemy)||
      ally.length<1||ally.length>3||enemy.length<1||enemy.length>3)
      throw Error('Expected 1 to 3 fighters per side');
   let randomSeed=seed>>>0;
   // A local deterministic Math shadows only Math.random. The extracted
   // algorithm otherwise uses native Math functions unchanged.
   const Math=Object.create(globalThis.Math);
   Math.random=()=>{
     randomSeed=(globalThis.Math.imul(randomSeed,1664525)+1013904223)>>>0;
     return randomSeed/4294967296;
   };
   const rand=(a,b)=>a+(b-a)*Math.random();
   const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
   const tacticSelect={value:tactic};
   const SP={idle:0,walk:2,run:3,hit:5,attack1:7,attack4:10,
     shout:4,guard:5,ko:37,happy:28,cheer:30};
   const knockTuning={melee:[145,195],special:[260,325],friction:9.0};
   const TUNING={meleeCD:[1.55,2.35],meleeMotion:.59,skillCost:100,moveRate:.90};
   const skillInfo=f=>TECH.forSpecies(f.name);
   const SKILL_FX={'아구몬':'e003_fireball00','그레이몬':'e003_fireball00',
     '메탈그레이몬':'e003_gigadestroyer00','아르마몬':'e003_H_claw',
     '가부몬':'e003_fireball00','쿠와가몬':'e003_H_claw'};
   const spriteColors=()=>({accent:'#ffcb88'});
   const display={textContent:'',innerHTML:''};
   const el=()=>display;
   const sideLabel=side=>side===0?'아군':'상대';
   const logMessages=[];
   const log=t=>{logMessages.push(String(t));if(logMessages.length>30)logMessages.shift()};
   const syncBattleHP=()=>{}; // never writes to the real save
   const renderTeams=()=>{};  // handled by Phaser
   const settleMatch=()=>{};  // never grants rewards or losses in this lab
   const updateCamera=()=>{}; // camera owned by Phaser
   let fighters=[],bullets=[],fx=[],finished=false,elapsed=0,winningSide=-1,
     lastBattleSave=0,preview=true,skillSequence=null,specialCallout=null,
     popups=[],cameraShake=0;
   const stats={meleeAttempts:0,meleeHits:0,skillHits:0,specials:0,
     meleeSkills:0,rangedSkills:0,dodges:0,retreats:0,hits:0,misses:0,
     distance:0,knockDistance:0};
   const metrics=()=> '근접 '+stats.meleeHits+
     ' · 회피 '+stats.dodges+' · 필살기 '+stats.specials;
   // Rendering text only, not used by the original combat AI.
   function fighter(mon,side,slot,count){
     if(!mon||typeof mon.name!=='string'||!mon.name||mon.name.length>120)
       throw Error('Invalid fighter identity');
     const rawMax=Number(mon.maxHp??mon.max??125);
     const rawHP=Number(mon.hp??rawMax);
     if(!Number.isFinite(rawMax)||rawMax<=0||rawMax>999999||
       !Number.isFinite(rawHP)||rawHP<0||rawHP>rawMax)
       throw Error('Invalid fighter HP');
     const stat=(v,fallback)=>Number.isFinite(v)?clamp(v,0,999999):fallback;
     const spd=stat(mon.spd,45),max=rawMax;
     const vital=BC.fighterVitals({spd,maxTp:mon.maxTp??undefined,
       tp:mon.tp??undefined});
     return {
       id:side+'-'+slot,instanceId:mon.instanceId??null,
       name:mon.name,side,slot,x:side?417+rand(-10,10):185+rand(-10,10),
       y:(count===1?205:119+slot*90)+rand(-10,10),
       dir:side?-1:1,hp:rawHP,max,atk:stat(mon.atk,45),
       def:stat(mon.def,20),spd,
       pace:clamp(33+spd*.85,35,60)*TUNING.moveRate,...vital,
       act:'idle',pose:SP.idle,timer:0,cd:rand(.25,.68),think:0,
       strafe:Math.random()<.5?-1:1,strafeTime:rand(.48,1.2),
       sidestep:0,retreat:0,target:null,knock:0,knockVX:0,
       knockVY:0,flash:0,bob:rand(0,6.28),energy:0,skillCD:0,
       skillReady:false,attackTarget:null,hitDone:false,
       guardCD:rand(1,2),meleeRange:rand(29,35),
       phase:'approach',phaseTime:rand(.4,.9),
       visualDir:side?-1:1,footPhase:rand(0,6.28),lunge:0,turn:0,
       attackAge:0,attackImpactAt:0,dodgeCD:rand(.4,1.4),
       dash:0,orbitSign:Math.random()<.5?-1:1,trail:[],
       approachY:rand(-25,25),meleeStart:0,skillKind:null,
       victoryPose:Math.random()<.6?SP.happy:SP.cheer
     };
   }
   ally.forEach((m,i)=>fighters.push(fighter(m,0,i,ally.length)));
   enemy.forEach((m,i)=>fighters.push(fighter(m,1,i,enemy.length)));
// ORIGINAL verbatim function: alive
function alive(side){return fighters.filter(f=>f.side===side&&f.hp>0)}

// ORIGINAL verbatim function: chooseTarget
function chooseTarget(f){return BC.target(f,alive(1-f.side),f.side===0?tacticSelect.value:'balanced')}

// ORIGINAL verbatim function: emit
function emit(x,y,color,n=7,big=false){for(let i=0;i<n;i++)fx.push({x,y,vx:rand(-46,46)*(big?1.5:1),vy:rand(-75,-12),life:rand(.27,.61),max:.61,color,size:big?rand(2,4):rand(1,3)})}

// ORIGINAL verbatim function: hit
function hit(att,victim,damage,ranged=false){if(victim.hp<=0||att.hp<=0)return;
  let d=clamp(Math.round(damage+rand(-2.5,2.5)-victim.def*.16),2,ranged?27:20);
  if(victim.act==='guard')d=Math.max(1,Math.round(d*.42));
  victim.hp=Math.max(0,victim.hp-d);victim.flash=.22;
  let vx=victim.x-att.x,vy=victim.y-att.y;const overlap=Math.hypot(vx,vy)<0.001;if(overlap){vx=att.dir||1;vy=0;}const vlen=Math.hypot(vx,vy);
  // Impact momentum has a full 2D direction and eases away instead of only sliding horizontally.
  const impact=(ranged?rand(...knockTuning.special):rand(...knockTuning.melee))*(victim.act==='guard'?.60:1);
  const nx=vx/vlen,ny=vy/vlen;
  victim.knockVX=nx*impact;
  victim.knockVY=ny*impact*.78;
  victim.knock=0;
  victim.energy=clamp(victim.energy+(ranged?6:5),0,100);BC.regainTP(victim,ranged?1:2);
  victim.phase='disengage';victim.phaseTime=rand(.40,.77);
  if(victim.hp>0){victim.act='hurt';victim.pose=SP.hit;victim.timer=.34;victim.sidestep=rand(.45,.85);victim.orbitSign*=-1}
  else{victim.act='ko';victim.pose=SP.ko;victim.timer=99;log(`${victim.name} 전투불능`)}
  stats.hits++;if(ranged)stats.skillHits++;else stats.meleeHits++;
  emit(victim.x,victim.y-17,ranged?'#d9f1ff':'#fff0ac',ranged?26:10,ranged);
  popups.push({x:victim.x,y:victim.y-36,text:String(d),life:.90,max:.90,big:ranged});
  cameraShake=Math.max(cameraShake,ranged?.26:.095);
  if(Math.random()<.20||ranged)log(`${att.name} → ${victim.name} ${d} 피해${ranged?' (필살기)':''}`);
  syncBattleHP();renderTeams();
}

// ORIGINAL verbatim function: projectile
function projectile(att,victim,power,type='orb',color){
 bullets.push({x:att.x+att.visualDir*12,y:att.y-25,target:victim,att,damage:power,r:type==='missile'?5:7,life:2.7,color:color||spriteColors(att.name).accent,trail:[],type,age:0});
}

// ORIGINAL verbatim function: beginMelee
function beginMelee(f,foe){
  f.dir=foe.x>=f.x?1:-1;f.visualDir=f.dir;f.act='attack';
  f.pose=SP.attack1+Math.floor(Math.random()*4);f.timer=TUNING.meleeMotion;f.attackAge=0;
  f.hitDone=false;f.attackTarget=foe;f.cd=rand(...TUNING.meleeCD)*(44/(37+f.spd*.16));
  f.meleeStart=dist(f,foe);f.lunge=0;
  f.phase='disengage';f.phaseTime=rand(.86,1.42);f.orbitSign=Math.random()<.5?-1:1;
  f.sidestep=rand(.55,1);stats.meleeAttempts++;stats.retreats++;
}

// ORIGINAL verbatim function: beginSkill
function beginSkill(f,foe){
  if(skillSequence)return;
  const skill=skillInfo(f);if(!BC.spendTP(f,skill,preview))return;const kind=skill.type==='claw'?'melee':'ranged';
  f.dir=foe.x>=f.x?1:-1;f.visualDir=f.dir;f.act='special';f.pose=SP.shout;
  f.timer=2.0;f.attackAge=0;f.hitDone=false;f.attackTarget=foe;f.energy=0;
  f.skillCD=rand(8.5,12.0);f.cd=2.2;f.phase='disengage';f.phaseTime=rand(1.1,1.8);
  stats.specials++;if(kind==='melee')stats.meleeSkills++;else stats.rangedSkills++;
  const fxname=SKILL_FX[f.name]||(kind==='melee'?'e003_H_claw':'e003_fireball00');
  skillSequence={att:f,target:foe,kind,technique:skill,fx:fxname,age:0,duration:2.05,impact:false};
  specialCallout={name:f.name,fx:fxname,kind,technique:skill.name,life:2.05,total:2.05};
  cameraShake=.1;
  log(`${f.name}의 ${skill.name}! · ${kind==='melee'?'근접':'원거리'} 필살기`);
  emit(f.x,f.y-22,skill.color,16,true);
}

// ORIGINAL verbatim function: advanceSpecial
function advanceSpecial(dt){
 const q=skillSequence;if(!q)return;
 q.age+=dt;
 const f=q.att,target=q.target;
 if(f.hp<=0){skillSequence=null;specialCallout=null;return}
 f.visualDir=target.x>=f.x?1:-1;f.dir=f.visualDir;
 // Reference-video pattern: charging pose and skill-name callout, a conspicuous strike, aftermath.
 if(q.age<.65){f.pose=SP.shout;f.act='special';if(Math.random()<dt*25)emit(f.x+rand(-13,13),f.y-22+rand(-9,9),q.technique.color,2)}
 else if(q.age<1.19){f.pose=SP.attack4;f.act='special';
  if(q.kind==='melee'&&target.hp>0){const x=target.x-f.x,y=target.y-f.y,d=Math.max(1,Math.hypot(x,y));
   const step=Math.min(d,165*dt);f.x=clamp(f.x+x/d*step,MARGIN.left,WORLD.w-MARGIN.right);f.y=clamp(f.y+y/d*step,MARGIN.top,WORLD.h-MARGIN.bottom)}
 }
 if(!q.impact&&q.age>=1.03){
  q.impact=true;cameraShake=.40;
  if(q.kind==='melee'){
   if(target.hp>0&&dist(f,target)<66){hit(f,target,rand(22,29)+f.atk*.35,true)}else{stats.misses++;emit(f.x,f.y-20,'#e5e8ff',15,true)}
  }else if(target.hp>0){projectile(f,target,rand(22,29)+f.atk*.32,q.technique.type,q.technique.color)}
  emit(q.kind==='melee'?target.x:f.x,q.kind==='melee'?target.y-20:f.y-22,q.technique.color,34,true);
 }
 if(q.age>=q.duration){f.act='idle';f.pose=SP.idle;f.phase='disengage';f.phaseTime=Math.max(f.phaseTime,1.2);skillSequence=null;specialCallout=null}
}

// ORIGINAL verbatim function: think
function think(f,dt){
  if(f.hp<=0)return;
  f.bob+=dt*(f.act==='run'?7:3.4);
  f.cd=Math.max(0,f.cd-dt);f.skillCD=Math.max(0,f.skillCD-dt);
  f.dodgeCD=Math.max(0,f.dodgeCD-dt);f.guardCD=Math.max(0,f.guardCD-dt);
  f.flash=Math.max(0,f.flash-dt);f.think-=dt;
  f.phaseTime=Math.max(0,f.phaseTime-dt);f.strafeTime-=dt;
  // During a signature move, all combatants pause very briefly as in the reference video.
  if(skillSequence){f.pose=f===skillSequence.att?SP.shout:(f.act==='ko'?SP.ko:SP.idle);return}
  const foe=(f.target&&f.target.hp>0)?f.target:chooseTarget(f);
  if(!foe){f.act='idle';f.pose=SP.idle;return}
  const dx=foe.x-f.x,dy=foe.y-f.y,d=Math.max(1,Math.hypot(dx,dy));
  f.dir=dx>=0?1:-1;
  if(f.act==='attack'){
    f.attackAge+=dt;f.timer-=dt;f.visualDir=f.dir;
    // Wind-up / impact / recoil: the sprite is NOT frozen in place during an ordinary blow.
    if(f.attackAge>.25&&f.attackAge<.44&&f.attackTarget?.hp>0){
      const tgt=f.attackTarget,ex=tgt.x-f.x,ey=tgt.y-f.y,dl=Math.max(1,Math.hypot(ex,ey));
      const step=Math.min(50*dt,5.5);f.x=clamp(f.x+ex/dl*step,MARGIN.left,WORLD.w-MARGIN.right);f.y=clamp(f.y+ey/dl*step,MARGIN.top,WORLD.h-MARGIN.bottom);
    }
    if(!f.hitDone&&f.attackAge>.36){
      f.hitDone=true;let target=f.attackTarget;
      if(target?.hp>0&&dist(f,target)<42){hit(f,target,rand(6,9)+f.atk*.20,false);f.energy=clamp(f.energy+rand(13,19),0,100)}
      else{stats.misses++;emit(f.x+f.visualDir*11,f.y-21,'#ecf2ce',4)}
    }
    if(f.timer>0)return;
    f.act='idle';f.phase='disengage';f.phaseTime=Math.max(f.phaseTime,rand(.9,1.55));
    f.orbitSign=Math.random()<.5?-1:1;
  }
  if(f.act==='hurt'||f.act==='guard'){
    f.timer-=dt;if(f.timer>0)return;f.act='idle';f.phase='disengage';f.phaseTime=Math.max(.46,f.phaseTime)
  }
  if(f.think<=0){f.target=chooseTarget(f);f.think=rand(.42,.75)}
  if(f.strafeTime<=0){f.strafe=Math.random()<.5?-1:1;f.strafeTime=rand(.75,1.5)}
  if(f.phaseTime<=0){f.phase=f.phase==='disengage'?'flank':'approach';f.phaseTime=f.phase==='flank'?rand(.65,1.25):rand(.50,1.10);f.orbitSign=Math.random()<.5?-1:1}
  if(d<70&&f.dodgeCD===0&&foe.act==='attack'&&foe.attackAge<.30&&Math.random()<dt*1.4*BC.tactic(f.side===0?tacticSelect.value:'balanced').retreat){
    f.phase='disengage';f.phaseTime=rand(.75,1.22);f.orbitSign=Math.random()<.5?-1:1;
    f.dodgeCD=rand(2.4,4.2);f.pose=SP.run;f.act='run';stats.dodges++;emit(f.x,f.y-17,'#bfeee5',6)
  }
  if(BC.canUseSkill(f,skillInfo(f),f.side===0?tacticSelect.value:'balanced')){
    const isMelee=skillInfo(f).type==='claw';
    if((isMelee&&d<95)||(!isMelee&&d<180)){beginSkill(f,foe);return}
  }
  if(d<37&&f.cd===0&&f.phase!=='disengage'){
    if(f.guardCD===0&&foe.act==='attack'&&Math.random()<.12*BC.tactic(f.side===0?tacticSelect.value:'balanced').guard){f.act='guard';f.pose=SP.guard;f.timer=.36;f.cd=.65;f.guardCD=rand(2.8,4.8);return}
    beginMelee(f,foe);return
  }
  const nx=dx/d,ny=dy/d,tx=-ny,ty=nx;
  let forward,swirl;
  if(f.phase==='disengage'){
    forward=d<65?-.83:d<90?-.40:.05;swirl=1.16*f.orbitSign;
    if(d>132){f.phase='approach';forward=.87;swirl=.4*f.orbitSign}
  }else if(f.phase==='flank'){
    forward=d>77?.62:d<32?-.25:.12;swirl=1.28*f.orbitSign;
  }else{
    forward=d>43?.88:d<25?-.24:.17;swirl=(d>105?.38:.92)*f.orbitSign;
  }
  const battlePolicy=f.side===0?tacticSelect.value:'balanced';
  if(battlePolicy==='aggressive'){forward+=.25;swirl*=.75}
  else if(battlePolicy==='defensive'){forward-=.15;swirl*=1.05}
  let vx=nx*forward+tx*swirl,vy=ny*forward+ty*swirl;
  vy+=Math.sin(elapsed*1.3+f.slot*1.8+(f.side?2.1:0))*.11;
  for(const other of fighters){if(other===f||other.hp<=0)continue;
    const ox=f.x-other.x,oy=f.y-other.y,od=Math.hypot(ox,oy);
    if(od<29&&od>.1){vx+=ox/od*(29-od)/8;vy+=oy/od*(29-od)/8}
  }
  // Softer recentering encourages use of the enlarged field, while bounds deter wall camping.
  vy+=(WORLD.h*.50-f.y)*.0026;
  vx+=(WORLD.w*.50-f.x)*.00040;
  if(f.y<MARGIN.top+26)vy+=1.35;
  if(f.y>WORLD.h-MARGIN.bottom-26)vy-=1.35;
  if(f.x<MARGIN.left+32)vx+=1.3;
  if(f.x>WORLD.w-MARGIN.right-32)vx-=1.3;
  const norm=Math.max(1,Math.hypot(vx,vy));const pace=f.pace*(f.phase==='disengage'?1.12:d>110?1.15:.87);
  const ox=f.x,oy=f.y;
  f.x=clamp(f.x+vx/norm*pace*dt,MARGIN.left,WORLD.w-MARGIN.right);
  f.y=clamp(f.y+vy/norm*pace*dt,MARGIN.top,WORLD.h-MARGIN.bottom);
  stats.distance+=Math.hypot(f.x-ox,f.y-oy);
  f.act=d>79||f.phase==='disengage'?'run':'walk';f.pose=f.act==='run'?SP.run:SP.walk;
  // These 40 GIFs have left-facing default pixels. When heading right, flip the GIF.
  // Facing is based on travel direction while moving and on the target while attacking.
  if(Math.abs(f.x-ox)>0.12)f.visualDir=(f.x-ox)>0?1:-1;
  f.footPhase+=dt*(f.act==='run'?8.3:4.8);
  if(Math.random()<dt*8){f.trail.push({x:f.x,y:f.y});if(f.trail.length>12)f.trail.shift()}
}

// ORIGINAL verbatim function: update
function update(dt){
  if(finished)return;
 elapsed+=dt;if(elapsed-lastBattleSave>=1){syncBattleHP();lastBattleSave=elapsed;}cameraShake=Math.max(0,cameraShake-dt);
 if(specialCallout){specialCallout.life=Math.max(0,specialCallout.life-dt)}
 if(Math.floor(elapsed*3)!==Math.floor((elapsed-dt)*3))el('lbMetrics').textContent=metrics();
 if(skillSequence){advanceSpecial(dt);for(const f of fighters){if(f!==skillSequence?.att&&f.hp>0)f.bob+=dt*2.3}}
 else for(const f of fighters)think(f,dt);
 for(const f of fighters){
  if(Math.abs(f.knockVX)+Math.abs(f.knockVY)>0.15){
   const ox=f.x,oy=f.y;
   const travel=-Math.expm1(-knockTuning.friction*dt)/knockTuning.friction;
   f.x=clamp(f.x+f.knockVX*travel,MARGIN.left,WORLD.w-MARGIN.right);
   f.y=clamp(f.y+f.knockVY*travel,MARGIN.top,WORLD.h-MARGIN.bottom);
   const moved=Math.hypot(f.x-ox,f.y-oy);stats.knockDistance+=moved;
   const decay=Math.exp(-knockTuning.friction*dt);
   f.knockVX*=decay;f.knockVY*=decay;
  }else{f.knockVX=0;f.knockVY=0}
 }
 for(const b of bullets){b.life-=dt;b.age+=dt;if(b.life<=0||b.target.hp<=0){b.life=0;continue}
  b.trail.push([b.x,b.y]);if(b.trail.length>10)b.trail.shift();
  const tx=b.target.x,ty=b.target.y-19,d=Math.max(.1,Math.hypot(tx-b.x,ty-b.y));const step=115*dt;
  if(d<step+8){hit(b.att,b.target,b.damage,true);b.life=0;emit(b.x,b.y,b.color,35,true)}
  else{b.x+=(tx-b.x)/d*step;b.y+=(ty-b.y)/d*step}
 }bullets=bullets.filter(b=>b.life>0);
 for(const p of fx){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;p.life-=dt}fx=fx.filter(p=>p.life>0);
 for(const p of popups){p.life-=dt;p.y-=11*dt}popups=popups.filter(p=>p.life>0);
 updateCamera(dt);
 if(!alive(0).length||!alive(1).length||elapsed>135){finished=true;skillSequence=null;specialCallout=null;
 winningSide=alive(0).reduce((s,f)=>s+f.hp,0)>=alive(1).reduce((s,f)=>s+f.hp,0)?0:1;winElapsed=0;
 log(`${sideLabel(winningSide)} 승리 · ${elapsed.toFixed(1)}초`);
 el('lbStatus').textContent=`${sideLabel(winningSide)} 승리! 28·30번 감정 GIF 재생 중`;
 settleMatch(winningSide===0);
 }
}
   // Render-only adapter. No original battle formula has been rewritten.
   const scaleX=800/WORLD.w,scaleY=450/WORLD.h;
   const project=({x,y})=>({x:x*scaleX,y:y*scaleY});
   const publicFighter=f=>({
     id:f.id,instanceId:f.instanceId,name:f.name,side:f.side,slot:f.slot,
     x:f.x*scaleX,y:f.y*scaleY,dir:f.dir,visualDir:f.visualDir,
     hp:f.hp,max:f.max,atk:f.atk,def:f.def,spd:f.spd,
     tp:f.tp,maxTp:f.maxTp,energy:f.energy,cd:f.cd,skillCD:f.skillCD,
     phase:f.phase,act:f.act,pose:f.pose,flash:f.flash,
     attackAge:f.attackAge,knockVX:f.knockVX,knockVY:f.knockVY,
     moveDistance:f.moveDistance??0,
     technique:skillInfo(f)
   });
   const model={seed:seed>>>0,elapsed:0,finished:false,winner:null,
     fighters:[],projectiles:[],events:[],eventHistory:[],
     stats:{hits:0,misses:0,specials:0,dodges:0,guards:0,knockback:0,movement:0}};
   function refresh(){
     model.seed=randomSeed;model.elapsed=elapsed;model.finished=finished;
     model.winner=finished?winningSide:null;
     model.fighters=fighters.map(publicFighter);
     model.projectiles=bullets.map(b=>({
       x:b.x*scaleX,y:b.y*scaleY,color:b.color,
       projectileType:b.type,life:b.life
     }));
     Object.assign(model.stats,{hits:stats.hits,misses:stats.misses,
       specials:stats.specials,dodges:stats.dodges,guards:0,
       knockback:stats.knockDistance*scaleX,
       movement:stats.distance*scaleX});
   }
   function step(dt=1/30){
     if(!Number.isFinite(dt)||dt<=0||dt>.051)throw Error('Invalid fixed-step dt');
     model.events=[];
     if(finished)return model;
     const prior=fighters.map(f=>({id:f.id,hp:f.hp}));
     const beforeSpecials=stats.specials, beforeDodge=stats.dodges;
     const beforeFinished=finished;
     const previousPositions=fighters.map(f=>({x:f.x,y:f.y}));
     update(dt);
     fighters.forEach((f,i)=>{
       const moved=dist(previousPositions[i],f);
       f.moveDistance=(f.moveDistance||0)+moved;
       const change=prior[i].hp-f.hp;
       if(change>0){
         // Origin-derived HP delta, not recalculated or estimated in Phaser.
         const attacker=fighters.find(a=>a.side!==f.side&&
           (a.attackTarget===f||skillSequence?.target===f))||null;
         model.events.push({type:'hit',attackerId:attacker?.id||null,
           targetId:f.id,damage:change,guarded:f.act==='guard',
           special:attacker?.act==='special'||false,
           x:f.x*scaleX,y:f.y*scaleY});
       }
     });
     if(stats.specials>beforeSpecials&&skillSequence){
       const f=skillSequence.att;
       model.events.push({type:'skill',attackerId:f.id,
         targetId:skillSequence.target.id,kind:skillSequence.kind==='melee'?
         'melee':'projectile',x:f.x*scaleX,y:f.y*scaleY,
         technique:skillSequence.technique.name,
         color:skillSequence.technique.color});
     }
     if(stats.dodges>beforeDodge){
       const f=fighters.find(a=>a.act==='run'&&a.dodgeCD>1);
       if(f)model.events.push({type:'dodge',fighterId:f.id,
         x:f.x*scaleX,y:f.y*scaleY});
     }
     if(!beforeFinished&&finished){
       model.events.push({type:'finish',winner:winningSide,elapsed});
       for(const f of fighters)if(f.side===winningSide&&f.hp>0){
         f.act='victory';f.pose=SP.cheer;
       }
     }
     model.eventHistory.push(...model.events.map(e=>({
       ...e,at:Math.round(elapsed*100)/100
     })));
     if(model.eventHistory.length>150)
       model.eventHistory.splice(0,model.eventHistory.length-150);
     refresh();
     return model;
   }
   // A testing-only debug view of the true internal state, with all circular
   // target/attacker references replaced with stable IDs.
   function debug(){
     return {fighters:fighters.map(f=>({...publicFighter(f),
       attackTargetId:f.attackTarget?.id||null,targetId:f.target?.id||null,
       timer:f.timer,attackAge:f.attackAge})),
       bullets:bullets.length,skillActive:!!skillSequence,
       elapsed,finished,winner:winningSide,stats:{...stats}};
   }
   refresh();
   Object.defineProperty(model,'_advance',{value:step,enumerable:false});
   Object.defineProperty(model,'_debug',{value:debug,enumerable:false});
   return model;
 }
 function step(model,dt=1/30){return model._advance(dt)}
 function snapshot(model){
   return JSON.parse(JSON.stringify(model));
 }
 const alive=(model,side)=>model.fighters.filter(f=>f.hp>0&&f.side===side);
 return Object.freeze({WORLD,FIELD,createMatch,step,snapshot,alive,
   defaultTeam,source:'original-index-html-v0.23.2-extracted'});
});
