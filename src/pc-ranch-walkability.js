/* Read-only terrain truth overlay for the PC continuous-ranch preview.
 * Samples the exact canonical DCFarm.walkable(state, x, y) test. Neither
 * the world's 920x690 coordinates nor any save/training logic are modified.
 */
(() => {
  'use strict';
  if (window.DCRanchWalkability ||
      !matchMedia('(min-width:900px) and (pointer:fine)').matches) return;
  const panel=document.getElementById('farmPanel');
  const world=panel?.querySelector('.farmWorld');
  const bar=document.getElementById('dc-ranch-view-switch');
  const farm=window.DCFarm;
  if (!panel || !world || !bar || typeof farm?.walkable!=='function') return;

  const button=document.createElement('button');
  button.type='button';
  button.id='dc-ranch-walkable-toggle';
  button.setAttribute('aria-pressed','false');
  button.setAttribute('aria-label','실제 디지몬 이동 가능 영역 확인');
  button.textContent='👣 이동 구역 확인';
  button.title='현재 개방한 시설·연결 통로의 실제 이동 가능 영역을 표시합니다. 육성이나 저장값은 바뀌지 않습니다.';
  bar.appendChild(button);

  const mask=document.createElement('canvas');
  mask.id='dc-ranch-walkable-mask';
  mask.width=920; mask.height=690;
  mask.setAttribute('aria-hidden','true');
  mask.setAttribute('role','presentation');
  world.appendChild(mask);
  let visible=false;
  let lastSampleCount=0;
  const STEP=5;
  const currentState=()=>typeof state==='undefined'?null:state;
  const toActorX=x=>(x-369)/1.82;
  const toActorY=y=>(y-262)/1.56;
  const walkableAt=(x,y,s=currentState())=>!!s&&
    farm.walkable(s,toActorX(x),toActorY(y));

  function draw(){
    const ctx=mask.getContext('2d');
    if(!ctx)return false;
    ctx.clearRect(0,0,mask.width,mask.height);
    const s=currentState();
    if(!s)return false;
    ctx.fillStyle='rgba(107,255,167,.33)';
    let count=0;
    for(let y=0;y<mask.height;y+=STEP){
      for(let x=0;x<mask.width;x+=STEP){
        // Sample cell centers in the canonical sprite/world coordinate frame.
        if(!walkableAt(x+STEP/2,y+STEP/2,s))continue;
        ctx.fillRect(x,y,STEP,STEP);
        count++;
      }
    }
    lastSampleCount=count;
    return true;
  }
  function ensureAttached(){
    if(!world.contains(mask))world.appendChild(mask);
  }
  function setVisible(next){
    if(next&&!document.body.classList.contains('dc-ranch-continuous'))return false;
    visible=!!next;
    ensureAttached();
    if(visible && !draw())visible=false;
    panel.classList.toggle('dc-ranch-show-walkable',visible);
    button.setAttribute('aria-pressed',String(visible));
    button.textContent=visible?'✕ 이동 구역 숨기기':'👣 이동 구역 확인';
    return visible;
  }
  button.addEventListener('click',()=>setVisible(!visible));
  // Tiles are regenerated after facilities are purchased; preserve only
  // our read-only canvas without changing the original rendering routine.
  const worldObserver=new MutationObserver(()=>{
    if(!visible)return;
    if(!world.contains(mask)){ensureAttached();draw();}
  });
  worldObserver.observe(world,{childList:true});
  // The base preview's own A/B toggle changes this body class.
  new MutationObserver(()=>{
    if(!document.body.classList.contains('dc-ranch-continuous')&&visible)
      setVisible(false);
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
  panel.addEventListener('click',event=>{
    if(!visible||!event.target.closest('[data-hex-buy]'))return;
    requestAnimationFrame(()=>{ensureAttached();draw();});
  });
  window.DCRanchWalkability=Object.freeze({
    get visible(){return visible;},
    get sampleCount(){return lastSampleCount;},
    setVisible,refresh:draw,walkableAt
  });
})();
