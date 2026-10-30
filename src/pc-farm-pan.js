/* PC-only farm camera drag. Presentation-only: never mutates Digimon state. */
(() => {
  'use strict';
  if (window.DCPCFarmPan || !matchMedia('(min-width: 900px) and (pointer: fine)').matches) return;
  const viewport = document.querySelector('#farmPanel .farmViewport');
  if (!viewport) return;

  let drag = null;
  let suppressedClick = null;
  // Capture map clicks made after a drag, before the original map handlers.
  // Ordinary tile/food clicks and actor selection remain unchanged.
  viewport.addEventListener('click', event => {
    if (!suppressedClick) return;
    const s=suppressedClick;
    suppressedClick=null;
    if (performance.now() > s.until ||
        Math.hypot(event.clientX-s.x,event.clientY-s.y) > 14) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 ||
        document.body.classList.contains('mode-nds') ||
        event.target.closest('.hexActor, input, select, textarea, a')) return;
    drag = {id:event.pointerId, x:event.clientX, y:event.clientY,
      left:viewport.scrollLeft, top:viewport.scrollTop, moved:false};
  });

  window.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy) < 7) return;
    drag.moved=true;
    viewport.classList.add('dc-pc-panning');
    viewport.scrollLeft=drag.left-dx;
    viewport.scrollTop=drag.top-dy;
    event.preventDefault();
  }, {passive:false});

  function finish(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) suppressedClick={until:performance.now()+450, x:event.clientX, y:event.clientY};
    drag=null;
    viewport.classList.remove('dc-pc-panning');
  }
  window.addEventListener('pointerup',finish);
  window.addEventListener('pointercancel',finish);
  window.addEventListener('blur',()=>{
    drag=null;
    suppressedClick=null;
    viewport.classList.remove('dc-pc-panning');
  });
  window.DCPCFarmPan=Object.freeze({enabled:true});
})();
