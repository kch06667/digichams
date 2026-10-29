/* 5th ranch polish: depth-order Digimon and de-clutter overlapping names.
 * PC connected preview only. Reads existing DOM world coordinates, never
 * changes Digimon objects, AI, sprites, saves or collision.
 */
(() => {
  'use strict';
  if (window.DCRanchActorDepth ||
      !matchMedia('(min-width:900px) and (pointer:fine)').matches) return;
  const world=document.querySelector('#farmPanel .farmWorld');
  if (!world) return;

  const managed=new Set();
  let lastUpdate=0;
  let wasEnabled=false;
  let overlapCount=0;
  const MIN_INTERVAL=100; // at most 10 visual passes per second
  const isEnabled=()=>document.body.classList.contains('dc-ranch-continuous')
    && !document.body.classList.contains('mode-nds');
  const getActors=()=>Array.from(world.querySelectorAll('.hexActor')).filter(el=>
    el.parentElement===world && Number.isFinite(parseFloat(el.style.left))
    && Number.isFinite(parseFloat(el.style.top)));

  function restore(){
    for(const actor of managed){
      actor.style.removeProperty('z-index');
      actor.removeAttribute('data-dc-label-collapsed');
    }
    managed.clear();
    overlapCount=0;
  }

  function refresh(){
    if(!isEnabled()){
      if(wasEnabled || managed.size)restore();
      wasEnabled=false;
      return false;
    }
    wasEnabled=true;
    const actors=getActors().map((el,index)=>({
      el,index,x:parseFloat(el.style.left),y:parseFloat(el.style.top),
      priority:el.classList.contains('active')?1:0,
      labelWidth:Math.max(48,Math.min(120,
        12 + (el.querySelector('span')?.textContent?.length||4)*12))
    }));
    // Drop stale DOM references after the original renderer replaces nodes.
    const current=new Set(actors.map(a=>a.el));
    for(const el of managed){
      if(!current.has(el)){
        el.style.removeProperty('z-index');
        el.removeAttribute('data-dc-label-collapsed');
        managed.delete(el);
      }
    }
    // A lower screen location is visually in front. Equal-Y ties stay
    // deterministic even if source DOM order or roster changes.
    for(const a of actors){
      const z=100+Math.round(Math.max(0,Math.min(690,a.y)));
      const value=String(z);
      if(a.el.style.zIndex!==value)a.el.style.zIndex=value;
      managed.add(a.el);
    }

    // Preserve one useful name when Digimon cluster. The selected Digimon
    // always has priority; other names reappear on hover or keyboard focus.
    const labels=[...actors].sort((a,b)=>b.priority-a.priority
      ||b.y-a.y||a.x-b.x||a.index-b.index);
    const accepted=[];
    let hidden=0;
    for(const a of labels){
      const covered=accepted.some(b=>
        Math.abs(a.x-b.x)<(a.labelWidth+b.labelWidth)/2+4 &&
        Math.abs(a.y-b.y)<27);
      if(a.el.dataset.dcLabelCollapsed!==String(covered))
        a.el.dataset.dcLabelCollapsed=String(covered);
      if(covered)hidden++;
      else accepted.push(a);
    }
    overlapCount=hidden;
    return true;
  }

  function frame(time){
    if(time-lastUpdate>=MIN_INTERVAL){
      lastUpdate=time;
      refresh();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.DCRanchActorDepth=Object.freeze({
    refresh,
    get enabled(){return wasEnabled;},
    get overlapCount(){return overlapCount;}
  });
})();
