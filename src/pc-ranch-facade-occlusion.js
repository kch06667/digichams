/* Connected-ranch building facade occlusion, presentation only.
 * The old 920x690 atlas already contains the painted facilities.
 * This module duplicates only the central facade into a transparent,
 * pointer-free layer at a stable world-Y depth. It does not affect any
 * pathfinding, selection, training, facilities or save data.
 */
(() => {
  'use strict';
  if (window.DCRanchFacadeOcclusion ||
      !matchMedia('(min-width:900px) and (pointer:fine)').matches) return;

  const world=document.querySelector('#farmPanel .farmWorld');
  const core=window.DCFarm;
  if (!world || !core?.HEX_CENTERS) return;
  const facilities=Object.entries(core.HEX_CENTERS)
    .filter(([id])=>id!=='core');
  const nodes=new Map();
  let scheduled=false;
  let visible=false;

  const enabled=()=>document.body.classList.contains('dc-ranch-continuous') &&
    !document.body.classList.contains('mode-nds');
  const gameState=()=>typeof state==='undefined'?null:state;

  function create(id) {
    const node=document.createElement('span');
    node.className='dc-ranch-facade-front';
    node.dataset.zone=id;
    node.setAttribute('aria-hidden','true');
    node.setAttribute('role','presentation');
    node.style.pointerEvents='none';
    nodes.set(id,node);
    return node;
  }

  function refresh() {
    scheduled=false;
    visible=enabled();
    const s=gameState();
    const active=[];
    for(const [id,[x,y]] of facilities) {
      const tile=world.querySelector('.hexTile[data-hex="'+id+'"]');
      // Original locked plot and real save unlocks are both authoritative.
      // The image layer must not reveal a not-yet-built facade.
      // The legacy WebP atlas facade crop is radial-map-specific. On the
      // 4+3 remaster it would paste the WRONG building fragment in the new
      // cell. Keep the independent render layer/API, but draw no mismatched
      // old atlas fragments until a compatible sprite has been authored.
      const show=visible && !core.PC_HONEYCOMB && !!s?.facilities?.[id] &&
        tile?.classList.contains('unlocked');
      if(!show){
        nodes.get(id)?.remove();
        continue;
      }
      const offset=getComputedStyle(tile)
        .getPropertyValue('--dc-facade-offset').trim();
      if(!/^-[0-9]+px -[0-9]+px$/.test(offset)) {
        nodes.get(id)?.remove();
        continue;
      }
      const node=nodes.get(id)||create(id);
      const left=x+'px',top=y+'px';
      // Actor depth is 100 + rounded world top (from PR76).
      // A building facade around y+32 hides a Digimon standing behind it,
      // but a Digimon standing in front of its doorway renders above it.
      const z=String(100+Math.round(y+32));
      if(node.style.left!==left)node.style.left=left;
      if(node.style.top!==top)node.style.top=top;
      if(node.style.zIndex!==z)node.style.zIndex=z;
      if(node.style.getPropertyValue('--dc-facade-offset')!==offset)
        node.style.setProperty('--dc-facade-offset',offset);
      if(node.parentNode!==world)world.appendChild(node);
      active.push(id);
    }
    // Do not leave removed overlays in a stale Map after a save reset.
    return active;
  }

  function schedule() {
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(refresh);
  }

  // Original drawTiles() rewrites farmWorld children on purchase/import/reset.
  // Only reattach our independent presentation nodes after that operation.
  new MutationObserver(schedule).observe(world,{childList:true});
  new MutationObserver(schedule).observe(document.body,{
    attributes:true,attributeFilter:['class']
  });
  refresh();
  window.DCRanchFacadeOcclusion=Object.freeze({
    refresh,
    get enabled(){return visible;},
    get activeZones(){return facilities.map(([id])=>id).filter(
      id=>nodes.get(id)?.parentNode===world
    );},
    get depthRule(){return '100 + round(facilityY + 32)';}
  });
})();
