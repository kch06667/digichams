/* Connected-ranch paths painted from the live facility topology.
 * Presentation-only. Canonical walkability, routing, facilities and saves
 * remain entirely in src/farm-core.js and the original farm UI.
 */
(() => {
  'use strict';
  if (window.DCRanchGroundPaths ||
      !matchMedia('(min-width:900px) and (pointer:fine)').matches) return;
  const world=document.querySelector('#farmPanel .farmWorld');
  const core=window.DCFarm;
  if (!world || !core?.HEX_CENTERS) return;
  const coords=core.HEX_CENTERS;
  const [originX,originY]=coords.core;
  const ns='http://www.w3.org/2000/svg';
  const layer=document.createElementNS(ns,'svg');
  layer.setAttribute('id','dc-ranch-ground-paths');
  layer.setAttribute('viewBox','0 0 920 690');
  layer.setAttribute('width','920');
  layer.setAttribute('height','690');
  layer.setAttribute('aria-hidden','true');
  layer.setAttribute('focusable','false');
  layer.setAttribute('preserveAspectRatio','none');
  world.insertBefore(layer,world.firstChild);

  const currentState=()=>typeof state==='undefined'?null:state;
  const validZones=Object.keys(coords).filter(id=>id!=='core');
  let signature='';
  let active=[];

  function enabledZones(){
    const facilities=currentState()?.facilities||{};
    // Facility names/positions are a read-only mirror of canonical data.
    return validZones.filter(id=>facilities[id]===true);
  }
  function makePath(d,stroke,width,opacity){
    const p=document.createElementNS(ns,'path');
    p.setAttribute('d',d);
    p.setAttribute('fill','none');
    p.setAttribute('stroke',stroke);
    p.setAttribute('stroke-width',String(width));
    p.setAttribute('stroke-opacity',String(opacity));
    p.setAttribute('stroke-linecap','round');
    p.setAttribute('stroke-linejoin','round');
    return p;
  }
  function refresh(force=false){
    const zones=enabledZones();
    const key=zones.join('|');
    if(!force&&key===signature)return false;
    signature=key;
    active=zones;
    layer.replaceChildren();
    for(const id of zones){
      const [x,y]=coords[id];
      const group=document.createElementNS(ns,'g');
      group.setAttribute('data-zone',id);
      group.setAttribute('data-from','core');
      group.setAttribute('data-to',id);
      const d=`M${originX} ${originY} L${x} ${y}`;
      // Lines mirror segmentDistance in farm-core: straight path,
      // unlike the old static curves which crossed unwalkable grass.
      group.append(
        makePath(d,'#55764f',41,.62),
        makePath(d,'#b6a071',28,.96),
        makePath(d,'#d7c393',12,.53)
      );
      layer.appendChild(group);
    }
    return true;
  }
  function attach(){
    if(world.firstChild!==layer)world.insertBefore(layer,world.firstChild);
  }
  // The original farm renderer replaces the map's direct children during
  // purchases/import/reset. Reattach the view without touching that renderer.
  const observer=new MutationObserver(()=>{
    if(!world.contains(layer))attach();
    refresh();
  });
  observer.observe(world,{childList:true});
  refresh(true);

  window.DCRanchGroundPaths=Object.freeze({
    refresh:()=>refresh(true),
    get openZones(){return [...active];},
    get layer(){return layer;}
  });
})();
