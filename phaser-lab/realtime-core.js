/* Concurrent autonomous 2D combat prototype, modeled after the existing
 * index.html arena's approach/flank/disengage/dodge/cast behavior.
 * This is NOT yet a byte-for-byte extraction of the original simulation.
 * No turns, no scripted attack alternation, no persistent game-save writes.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const battle=root?.DCBattleCore||(node?require('../src/battle-core.js'):null);
  const techniques=root?.DigiArenaTechniques||(node?require('./arena-techniques.js'):null);
  const api=factory(battle,techniques);
  if(node)module.exports=api;
  if(root)root.DigiRealTimeCore=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(BC,TECH){
  'use strict';
  if(!BC||!TECH)throw Error('DCBattleCore and DigiArenaTechniques required');
  const FIELD=Object.freeze({left:55,right:745,top:155,bottom:355});
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const alive=(s,side)=>s.fighters.filter(f=>f.side===side&&f.hp>0);
  function rand(s){
    s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;
    return s.seed/4294967296;
  }
  function range(s,min,max){return min+(max-min)*rand(s);}
  // Public graphics are still original procedural placeholders. Species
  // identity and move metadata, however, now match existing arena records.
  const rosterNames=[
    ['아구몬','파타몬','팔몬'],
    ['가부몬','텐타몬','피요몬']
  ];
  const startingTeam=side=>rosterNames[side].map((name,i)=>({
    name,hp:125,maxHp:125,atk:46+i*5,def:20+i*3,spd:47+i*6
  }));
  function makeFighter(s,source,side,slot,count){
    if(!source||typeof source.name!=='string'||!source.name||
       source.name.length>120)throw Error('Invalid fighter');
    const max=clamp(Math.round(Number(source.maxHp??source.max??130)),1,999999);
    const hp=clamp(Math.round(Number(source.hp??max)),0,max);
    if(!Number.isFinite(hp)||!Number.isFinite(max))throw Error('Invalid HP');
    const stat=(v,fallback)=>Number.isFinite(v)?clamp(Math.round(v),0,999999):fallback;
    const spd=stat(source.spd,45);
    const tpInput={maxTp:source.maxTp??undefined,tp:source.tp??undefined,spd};
    const v=BC.fighterVitals(tpInput);
    const technique=TECH.forFighter(source);
    if(!TECH.valid(technique))throw Error('Invalid technique record');
    return {
      id:side+'-'+slot,side,slot,name:source.name,
      x:side===0?126+slot*11:674-slot*11,
      y:count===1?258:187+slot*71,
      dir:side===0?1:-1,hp,max,atk:stat(source.atk,45),
      def:stat(source.def,22),spd,...v,technique,
      energy:0,skillCD:0,cd:range(s,.1,.6),dodgeCD:range(s,.3,.9),
      guardCD:range(s,.7,1.8),think:0,targetId:null,act:'idle',
      actTime:0,attackTargetId:null,hitDone:false,
      phase:'approach',phaseTime:range(s,.65,1.1),
      orbit:rand(s)<.5?-1:1,knockVX:0,knockVY:0,flash:0,
      moveDistance:0,attacks:0,specials:0,dodges:0,
      kind:technique.type==='claw'?'melee':'projectile'
    };
  }
  function createMatch({allies,opponents,teamSize=3,tactic='balanced',seed=12345}={}){
    if(!BC.TACTICS[tactic])throw Error('Unknown tactic');
    if(!Number.isInteger(teamSize)||teamSize<1||teamSize>3)throw Error('Invalid team size');
    const left=allies??startingTeam(0).slice(0,teamSize);
    const right=opponents??startingTeam(1).slice(0,teamSize);
    if(!Array.isArray(left)||!Array.isArray(right)||
       left.length<1||left.length>3||right.length<1||right.length>3)
      throw Error('Each side needs 1-3 fighters');
    const s={seed:seed>>>0,elapsed:0,frame:0,tactic,finished:false,winner:null,
      fighters:[],projectiles:[],events:[],eventHistory:[],stats:{
        hits:0,misses:0,specials:0,dodges:0,guards:0,knockback:0,movement:0
      }};
    // Source objects are copied by construction. Never retain a reference to a save.
    left.forEach((m,i)=>s.fighters.push(makeFighter(s,m,0,i,left.length)));
    right.forEach((m,i)=>s.fighters.push(makeFighter(s,m,1,i,right.length)));
    return s;
  }
  const find=(s,id)=>s.fighters.find(f=>f.id===id);
  function event(s,payload){
    s.events.push(payload);
    s.eventHistory.push({...payload,at:Math.round(s.elapsed*100)/100});
    if(s.eventHistory.length>120)s.eventHistory.shift();
  }
  function nearestTarget(s,f){
    const foes=alive(s,1-f.side);
    return BC.target(f,foes,f.side===0?s.tactic:'balanced');
  }
  function impact(s,att,target,special){
    if(!att||!target||att.hp<=0||target.hp<=0)return;
    // Matches the pre-existing HTML extension's damage factors more closely,
    // while remaining a standalone lab formula, not proven ROM constants.
    const raw=(special?range(s,22,29)+att.atk*
      (att.kind==='melee'?.35:.32):range(s,6,9)+att.atk*.20)-
      target.def*.16+range(s,-2.5,2.5);
    let damage=clamp(Math.round(raw),2,special?95:70);
    const defended=target.act==='guard';
    if(defended)damage=Math.max(1,Math.round(damage*.42));
    target.hp=Math.max(0,target.hp-damage);
    target.flash=.2;
    const vx=target.x-att.x,vy=target.y-att.y,d=Math.max(1,Math.hypot(vx,vy));
    const momentum=(special?range(s,260,325):range(s,145,195))*
      (defended?.60:1);
    target.knockVX=vx/d*momentum;
    target.knockVY=vy/d*momentum*.8;
    BC.regainTP(target,special?1:2);
    target.energy=clamp(target.energy+(special?7:9),0,100);
    if(target.hp>0){
      target.act='hurt';target.actTime=0;
      target.phase='disengage';target.phaseTime=range(s,.48,.9);
    }else{
      target.act='ko';target.actTime=0;
      event(s,{type:'ko',targetId:target.id,x:target.x,y:target.y});
    }
    s.stats.hits++;
    event(s,{type:'hit',attackerId:att.id,targetId:target.id,x:target.x,y:target.y,
      damage,special,guarded:defended,
      technique:special?att.technique.name:null,
      color:special?att.technique.color:null});
  }
  function setAction(f,act){
    if(f.act===act)return;
    f.act=act;f.actTime=0;
  }
  function beginMelee(s,f,foe){
    f.dir=foe.x>=f.x?1:-1;
    f.attackTargetId=foe.id;f.hitDone=false;
    setAction(f,'attack');
    f.cd=range(s,1.55,2.35)*44/(37+f.spd*.16);
    f.attacks++;
    f.phase='disengage';f.phaseTime=range(s,.8,1.5);
  }
  function beginSkill(s,f,foe){
    if(!BC.canUseSkill(f,f.technique,f.side===0?s.tactic:'balanced')||
       !BC.spendTP(f,f.technique))return false;
    f.attackTargetId=foe.id;f.hitDone=false;f.energy=0;
    f.cd=2.2;f.skillCD=range(s,8.5,12);f.specials++;
    setAction(f,'cast');
    f.phase='disengage';f.phaseTime=range(s,.95,1.6);
    s.stats.specials++;
    event(s,{type:'skill',attackerId:f.id,targetId:foe.id,kind:f.kind,
      technique:f.technique.name,color:f.technique.color,cost:f.technique.cost,
      x:f.x,y:f.y});
    return true;
  }
  function walk(s,f,foe,dt){
    const dx=foe.x-f.x,dy=foe.y-f.y,d=Math.max(.01,Math.hypot(dx,dy));
    const nx=dx/d,ny=dy/d,tx=-ny,ty=nx;
    if(f.phaseTime<=0){
      f.phase=f.phase==='approach'?'flank':f.phase==='flank'?'disengage':'approach';
      f.phaseTime=range(s,.58,1.12);
      if(rand(s)<.42)f.orbit*=-1;
    }
    let forward,swirl;
    if(f.phase==='disengage'){
      forward=d<78?-.76:d<115?-.2:.76;
      swirl=1.09*f.orbit;
    }else if(f.phase==='flank'){
      forward=d>88?.62:d<35?-.21:.10;
      swirl=1.31*f.orbit;
    }else{
      forward=d>49?.91:d<28?-.16:.13;
      swirl=(d>124?.35:.90)*f.orbit;
    }
    const policy=BC.tactic(f.side===0?s.tactic:'balanced');
    if(policy===BC.TACTICS.aggressive){forward+=.28;swirl*=.73}
    if(policy===BC.TACTICS.defensive){forward-=.17;swirl*=1.14}
    let vx=nx*forward+tx*swirl,vy=ny*forward+ty*swirl;
    for(const other of s.fighters){
      if(other===f||other.hp<=0)continue;
      const sx=f.x-other.x,sy=f.y-other.y,dist=Math.hypot(sx,sy);
      if(dist<36&&dist>.01){vx+=sx/dist*(36-dist)/12;vy+=sy/dist*(36-dist)/12}
    }
    vx+=(400-f.x)*.00025;
    vy+=(258-f.y)*.00065;
    if(f.x<FIELD.left+32)vx+=1.25;
    if(f.x>FIELD.right-32)vx-=1.25;
    if(f.y<FIELD.top+22)vy+=1.25;
    if(f.y>FIELD.bottom-22)vy-=1.25;
    const length=Math.max(1,Math.hypot(vx,vy));
    const pace=(52+Math.min(f.spd,120)*.45)*(f.phase==='disengage'?1.1:1);
    const x=f.x,y=f.y;
    f.x=clamp(x+vx/length*pace*dt,FIELD.left,FIELD.right);
    f.y=clamp(y+vy/length*pace*dt,FIELD.top,FIELD.bottom);
    const travel=Math.hypot(f.x-x,f.y-y);
    f.moveDistance+=travel;s.stats.movement+=travel;
    if(Math.abs(f.x-x)>.1)f.dir=f.x>x?1:-1;
    setAction(f,travel>0.15?'walk':'idle');
  }
  function tickActor(s,f,dt){
    if(f.hp<=0)return;
    f.cd=Math.max(0,f.cd-dt);
    f.skillCD=Math.max(0,f.skillCD-dt);
    f.dodgeCD=Math.max(0,f.dodgeCD-dt);
    f.guardCD=Math.max(0,f.guardCD-dt);
    f.flash=Math.max(0,f.flash-dt);
    f.phaseTime=Math.max(0,f.phaseTime-dt);
    f.think-=dt;
    f.actTime+=dt;
    if(f.act==='attack'){
      const target=find(s,f.attackTargetId);
      if(!f.hitDone&&f.actTime>=.36){
        f.hitDone=true;
        if(target&&target.hp>0&&distance(f,target)<56){
          impact(s,f,target,false);
          f.energy=clamp(f.energy+range(s,17,24),0,100);
        }else{
          s.stats.misses++;
          event(s,{type:'miss',attackerId:f.id,x:f.x,y:f.y});
        }
      }
      if(f.actTime<.59)return;
      setAction(f,'idle');
    }
    if(f.act==='cast'){
      const target=find(s,f.attackTargetId);
      if(!f.hitDone&&f.actTime>=1.03){
        f.hitDone=true;
        if(target&&target.hp>0){
          if(f.kind==='melee'){
            if(distance(f,target)<96)impact(s,f,target,true);
            else{event(s,{type:'miss',attackerId:f.id});s.stats.misses++}
          }else{
            s.projectiles.push({id:s.frame+'-'+f.id,attackerId:f.id,targetId:target.id,
              x:f.x+f.dir*18,y:f.y-14,speed:158,life:3.0,
              color:f.technique.color,technique:f.technique.name,
              projectileType:f.technique.type});
          }
        }
      }
      if(f.actTime<2.05)return;
      setAction(f,'idle');
    }
    if(f.act==='hurt'||f.act==='guard'||f.act==='evade'){
      if(f.actTime<.30)return;
      setAction(f,'idle');
    }
    const target=f.think>0?find(s,f.targetId):nearestTarget(s,f);
    if(!target||target.hp<=0){
      f.targetId=null;setAction(f,'idle');return;
    }
    f.targetId=target.id;
    if(f.think<=0)f.think=range(s,.19,.55);
    const d=distance(f,target);
    const tactic=f.side===0?s.tactic:'balanced';
    if(d<85&&target.act==='attack'&&target.actTime<.28&&
       f.dodgeCD===0&&rand(s)<dt*1.4*BC.tactic(tactic).retreat){
      setAction(f,'evade');f.dodgeCD=range(s,2.1,3.7);
      f.phase='disengage';f.phaseTime=.82;f.orbit*=-1;
      f.dodges++;s.stats.dodges++;
      event(s,{type:'dodge',fighterId:f.id,x:f.x,y:f.y});
      return;
    }
    if(d<55&&target.act==='attack'&&f.guardCD===0&&rand(s)<dt*1.4*BC.tactic(tactic).guard){
      setAction(f,'guard');f.guardCD=range(s,2,4);s.stats.guards++;
      event(s,{type:'guard',fighterId:f.id,x:f.x,y:f.y});
      return;
    }
    if(f.cd===0&&f.skillCD===0&&
       BC.canUseSkill(f,f.technique,tactic)&&d<(f.kind==='projectile'?235:96)){
      if(beginSkill(s,f,target))return;
    }
    if(f.cd===0&&d<52&&f.phase!=='disengage'){
      beginMelee(s,f,target);return;
    }
    walk(s,f,target,dt);
  }
  function tickProjectile(s,p,dt){
    const target=find(s,p.targetId),att=find(s,p.attackerId);
    p.life-=dt;
    if(!target||target.hp<=0||!att||att.hp<=0){p.life=0;return}
    const tx=target.x,ty=target.y-12,d=Math.max(.01,Math.hypot(tx-p.x,ty-p.y));
    const step=p.speed*dt;
    if(d<step+12){impact(s,att,target,true);p.life=0;return}
    p.x+=(tx-p.x)/d*step;p.y+=(ty-p.y)/d*step;
  }
  function step(s,dt=1/30){
    if(!Number.isFinite(dt)||dt<0||dt>.051)throw Error('Simulation requires fixed <=51ms steps');
    if(s.finished){s.events=[];return s}
    s.events=[];
    s.elapsed+=dt;s.frame++;
    // Every fighter evaluates its OWN AI on every fixed tick; no alternating turns.
    for(const f of s.fighters)tickActor(s,f,dt);
    for(const p of s.projectiles)tickProjectile(s,p,dt);
    s.projectiles=s.projectiles.filter(p=>p.life>0);
    for(const f of s.fighters){
      if(Math.hypot(f.knockVX,f.knockVY)<.12){f.knockVX=0;f.knockVY=0;continue;}
      const before={x:f.x,y:f.y},travel=-Math.expm1(-8.5*dt)/8.5;
      f.x=clamp(f.x+f.knockVX*travel,FIELD.left,FIELD.right);
      f.y=clamp(f.y+f.knockVY*travel,FIELD.top,FIELD.bottom);
      s.stats.knockback+=distance(f,before);
      const fade=Math.exp(-8.5*dt);
      f.knockVX*=fade;f.knockVY*=fade;
    }
    if(alive(s,0).length===0||alive(s,1).length===0||s.elapsed>=75){
      const score=side=>alive(s,side).reduce((sum,f)=>sum+f.hp/Math.max(1,f.max),0);
      s.winner=score(0)>=score(1)?0:1;
      s.finished=true;
      for(const f of alive(s,s.winner))setAction(f,'victory');
      event(s,{type:'finish',winner:s.winner,elapsed:s.elapsed});
    }
    return s;
  }
  function snapshot(s){
    return JSON.parse(JSON.stringify(s));
  }
  return Object.freeze({FIELD,createMatch,step,snapshot,alive,defaultTeam:startingTeam});
});
