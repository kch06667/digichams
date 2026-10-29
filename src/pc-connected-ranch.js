/* A/B visual preview of one continuous PC ranch.
 * Does not modify the 7-zone simulation, save, unlocks or actor coordinates.
 * Keep the original hex map one click away until the user accepts artwork.
 */
(() => {
  'use strict';
  if (window.DCConnectedRanch ||
      !matchMedia('(min-width:900px) and (pointer:fine)').matches) return;
  const script=document.currentScript;
  const panel=document.getElementById('farmPanel');
  const world=panel?.querySelector('.farmWorld');
  if (!script?.src || !panel || !world) return;

  const link=document.createElement('link');
  link.rel='stylesheet';
  link.id='dc-connected-ranch-style';
  link.href=new URL('pc-connected-ranch.css',script.src).href;
  document.head.appendChild(link);

  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.id='dc-pc-ranch-toggle';
  toggle.textContent='🌿 연결형 사육장 미리보기';
  toggle.title='화면만 바꿔 비교합니다. 육성 상태와 세이브는 변경되지 않습니다.';
  toggle.setAttribute('aria-label','사육장 지형 표시 전환');
  toggle.setAttribute('aria-pressed','false');
  toggle.hidden=true;
  const drawer=panel.querySelector('#dc-pc-drawer-toggle');
  panel.insertBefore(toggle,drawer||panel.firstChild);

  let ready=false,enabled=false;
  const setEnabled=next=>{
    if(!ready)return false;
    enabled=!!next;
    panel.classList.toggle('dc-connected-ranch',enabled);
    toggle.textContent=enabled?'⬡ 원래 육각형 배경':'🌿 연결형 사육장 보기';
    toggle.setAttribute('aria-pressed',String(enabled));
    return true;
  };
  toggle.addEventListener('click',()=>setEnabled(!enabled));
  // On a missing/offline field asset, retain the original source map.
  const image=new Image();
  image.onload=()=>{
    if(!image.naturalWidth || !image.naturalHeight)return;
    ready=true;
    toggle.hidden=false;
    setEnabled(true);
  };
  image.onerror=()=>{
    link.remove();
    toggle.remove();
    console.warn('Connected ranch artwork unavailable; using original farm map.');
  };
  image.src=new URL('../assets/farm/connected_ranch_field.svg',script.src).href;
  window.DCConnectedRanch=Object.freeze({
    get ready(){return ready;},
    get enabled(){return enabled;},
    setEnabled
  });
})();
