/* Movement kernel transcribed from the original playable HTML arena's
 * DCBattleArena.think() motion segment, v0.23.2.
 * Original world: 600x405, 16/66/16/22 margin, motion pace and 2D vectors.
 *
 * The Phaser renderer is 800x450; this adapter calculates motion in the
 * ORIGINAL world coordinate space then projects it back to the render field.
 *
 * This is a movement-only extraction. Attack/AI decisions, ROM mechanics and
 * save settlement still live in the original index.html code.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DCArenaNavigation=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const WORLD=Object.freeze({w:600,h:405});
  const MARGIN=Object.freeze({left:16,right:16,top:66,bottom:22});
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const originalPace=spd=>clamp(33+Math.max(0,spd)*.85,35,60)*.90;
  function requireContext(context){
    if(!context||!Number.isFinite(context.elapsed)||
      typeof context.range!=='function'||typeof context.random!=='function'||
      !['balanced','aggressive','defensive','focus','conserve'].includes(context.tactic))
      throw Error('Invalid original-arena motion context');
  }
  function advance(f,foe,others,context,dt){
    requireContext(context);
    if(!f||!foe||!Array.isArray(others)||!Number.isFinite(dt)||
       dt<0||dt>.051)throw Error('Invalid navigation step');
    const bounds=context.bounds||{left:0,right:800,top:0,bottom:450};
    const sx=Number.isFinite(context.scaleX)?context.scaleX:800/600;
    const sy=Number.isFinite(context.scaleY)?context.scaleY:450/405;
    if(sx<=0||sy<=0)throw Error('Invalid renderer scale');
    const x=f.x/sx,y=f.y/sy,targetX=foe.x/sx,targetY=foe.y/sy;
    const dx=targetX-x,dy=targetY-y,d=Math.max(1,Math.hypot(dx,dy));
    if(f.phaseTime<=0){
      f.phase=f.phase==='disengage'?'flank':'approach';
      f.phaseTime=f.phase==='flank'?context.range(.65,1.25):context.range(.50,1.10);
      f.orbit=context.random()<.5?-1:1;
    }
    const nx=dx/d,ny=dy/d,tx=-ny,ty=nx;
    let forward,swirl;
    if(f.phase==='disengage'){
      forward=d<65?-.83:d<90?-.40:.05;swirl=1.16*f.orbit;
      if(d>132){f.phase='approach';forward=.87;swirl=.4*f.orbit}
    }else if(f.phase==='flank'){
      forward=d>77?.62:d<32?-.25:.12;swirl=1.28*f.orbit;
    }else{
      forward=d>43?.88:d<25?-.24:.17;
      swirl=(d>105?.38:.92)*f.orbit;
    }
    if(context.tactic==='aggressive'){forward+=.25;swirl*=.75}
    else if(context.tactic==='defensive'){forward-=.15;swirl*=1.05}
    let vx=nx*forward+tx*swirl,vy=ny*forward+ty*swirl;
    vy+=Math.sin(context.elapsed*1.3+f.slot*1.8+(f.side?2.1:0))*.11;
    for(const other of others){
      if(other===f||other.hp<=0)continue;
      const ox=x-other.x/sx,oy=y-other.y/sy,od=Math.hypot(ox,oy);
      if(od<29&&od>.1){vx+=ox/od*(29-od)/8;vy+=oy/od*(29-od)/8}
    }
    // These factors are copied directly from the original arena.
    vy+=(WORLD.h*.50-y)*.0026;
    vx+=(WORLD.w*.50-x)*.00040;
    if(y<MARGIN.top+26)vy+=1.35;
    if(y>WORLD.h-MARGIN.bottom-26)vy-=1.35;
    if(x<MARGIN.left+32)vx+=1.3;
    if(x>WORLD.w-MARGIN.right-32)vx-=1.3;
    const norm=Math.max(1,Math.hypot(vx,vy));
    const pace=originalPace(f.spd)*
      (f.phase==='disengage'?1.12:d>110?1.15:.87);
    const nxp=clamp(x+vx/norm*pace*dt,MARGIN.left,WORLD.w-MARGIN.right);
    const nyp=clamp(y+vy/norm*pace*dt,MARGIN.top,WORLD.h-MARGIN.bottom);
    const previousX=f.x,previousY=f.y;
    f.x=clamp(nxp*sx,bounds.left,bounds.right);
    f.y=clamp(nyp*sy,bounds.top,bounds.bottom);
    const travel=Math.hypot(f.x-previousX,f.y-previousY);
    const action=d>79||f.phase==='disengage'?'run':'walk';
    const vxActual=f.x-previousX;
    if(Math.abs(vxActual)>.12*sx)f.visualDir=vxActual>0?1:-1;
    else if(!Number.isFinite(f.visualDir))f.visualDir=f.dir||1;
    return {action,travel,forward,swirl,phase:f.phase,
      visualDir:f.visualDir,distance:d};
  }
  return Object.freeze({WORLD,MARGIN,originalPace,advance});
});
