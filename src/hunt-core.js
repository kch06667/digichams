/* Digimon World Championship inspired hunting simulation (v0.21).
 * No ROM asset or exact physical coefficients are claimed: values below are temporary.
 * Coordinates are normalized 0..1. Pure functions also run in Node tests. */
(function(root,factory){'use strict';const core=factory();if(typeof module==='object'&&module.exports)module.exports=core;root.DCHunt=core;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const B={wildSeconds:75,tiedSeconds:55,lassoAngle:Math.PI*1.78,lassoClose:.17,lassoMinLength:.43,ropeBreak:.50,minPull:.045};
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
 function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;}
 function lasso(points,target){if(!Array.isArray(points)||points.length<9||!target)return {ok:false,reason:'원을 충분히 그려 줘.'};
  let length=0,turn=0,minR=Infinity,maxR=0;const center=target;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],radA=Math.atan2(a.y-center.y,a.x-center.x),radB=Math.atan2(b.y-center.y,b.x-center.x);
   let d=radB-radA;while(d>Math.PI)d-=2*Math.PI;while(d< -Math.PI)d+=2*Math.PI;turn+=d;length+=distance(a,b);
   const r=distance(b,center);minR=Math.min(minR,r);maxR=Math.max(maxR,r);
  }
  if(distance(points[0],points[points.length-1])>B.lassoClose)return {ok:false,reason:'원의 시작점 근처에서 손을 떼 줘.'};
  if(Math.abs(turn)<B.lassoAngle||length<B.lassoMinLength)return {ok:false,reason:'디지몬을 한 바퀴 둘러싸 줘.'};
  if(minR<.035||maxR>.75||!inside(center,points))return {ok:false,reason:'디지몬 주변에 원을 그려 줘.'};
  return {ok:true,turn,length};
 }
 function encounter(species,rand=Math.random){
  const stage=species.stage||'성장기';const strength=stage==='유년기 I'?0:stage==='유년기 II'?1:stage==='성장기'?2:3;
  const maxHp=60+strength*25+Math.max(0,Math.round(species.diff||0))/3;
  return {name:species.name,stage,diff:species.diff||0,mode:'wild',x:.28+rand()*.40,y:.27+rand()*.38,vx:rand()<.5?-.028:.028,vy:rand()<.5?-.018:.018,maxHp,hp:maxHp,time:B.wildSeconds,ropeSpent:false,pulls:0,bait:0};
 }
 function tick(e,dt){if(!e||['captured','escaped','stunned'].includes(e.mode))return e;
  dt=clamp(dt,0,.2);e.time=Math.max(0,e.time-dt);
  if(e.time<=0){e.mode='escaped';return e;}
  if(e.mode==='wild'){
   const speed=e.bait>0?.38:1;e.x+=e.vx*dt*speed;e.y+=e.vy*dt*speed;
   if(e.x<.10||e.x>.90)e.vx=-e.vx;if(e.y<.15||e.y>.84)e.vy=-e.vy;
   e.x=clamp(e.x,.10,.90);e.y=clamp(e.y,.15,.84);e.bait=Math.max(0,e.bait-dt);
  }
  return e;
 }
 function bind(e){if(e.mode!=='wild')return false;e.mode='tied';e.ropeSpent=true;e.time=B.tiedSeconds;return true;}
 function pull(e,start,end){if(!e||e.mode!=='tied')return {ok:false,reason:'로프를 묶은 후 당겨 줘.'};
  const len=distance(start,end);if(len<B.minPull)return {ok:false,reason:'더 길게 당겨 줘.'};
  if(len>B.ropeBreak){e.mode='escaped';return {ok:false,broken:true,reason:'너무 세게 당겨 로프가 끊어졌어!'};}
  const against=-(end.x-start.x)*e.vx-(end.y-start.y)*e.vy;
  const multiplier=against>0?1.36:.85;
  const damage=Math.max(1,Math.round(len*155*multiplier));
  e.hp=Math.max(0,e.hp-damage);e.pulls++;
  if(e.hp===0)e.mode='stunned';
  return {ok:true,damage,stunned:e.mode==='stunned',hp:e.hp};
 }
 // A temporary hunting session can be resumed from a JSON save.
 // Validate instead of trusting imported JSON: only a live/tied/stunned hunt
 // may be resumed. Captured/escaped sessions cannot grant a second Digimon.
 function restoreSession(raw) {
  if (!raw || raw.version!==1 || !raw.encounter || typeof raw.encounter!=='object')return null;
  const e=raw.encounter;
  if (typeof e.name!=='string'||!e.name||e.name.length>90||
      typeof e.stage!=='string'||e.stage.length>40||
      !['wild','tied','stunned'].includes(e.mode))return null;
  const numeric=['x','y','vx','vy','maxHp','hp','time','bait','pulls','diff'];
  if(numeric.some(k=>!Number.isFinite(e[k])))return null;
  if(e.x<0||e.x>1||e.y<0||e.y>1||e.maxHp<=0||e.maxHp>1e5||
     e.hp<0||e.hp>e.maxHp||e.time<0||e.time>300||
     e.bait<0||e.bait>60||e.pulls<0||!Number.isInteger(e.pulls)||e.pulls>1000||
     Math.abs(e.vx)>.3||Math.abs(e.vy)>.3||Math.abs(e.diff)>1e5||
     typeof e.ropeSpent!=='boolean'||
     (e.mode==='wild'&&e.ropeSpent)||
     (e.mode!=='wild'&&!e.ropeSpent)||
     (e.mode==='stunned'&&e.hp!==0)||
     (e.mode!=='stunned'&&e.hp<=0)||
     (e.mode==='wild'&&e.time<=0))return null;
  const copy={name:e.name,stage:e.stage,diff:e.diff,mode:e.mode,
   x:e.x,y:e.y,vx:e.vx,vy:e.vy,maxHp:e.maxHp,hp:e.hp,
   time:e.time,ropeSpent:e.ropeSpent,pulls:e.pulls,bait:e.bait};
  return {version:1,encounter:copy,arm:raw.arm===true&&e.mode==='wild'};
 }
 function capture(e){if(!e||e.mode!=='stunned')return false;e.mode='captured';return true;}
 return Object.freeze({B,clamp,distance,inside,lasso,encounter,tick,bind,pull,capture,restoreSession});
});
