/* Desktop-only opt-in continuous-ranch terrain preview.
 * Changes *only* the presentation class. Not a biome/AI/evolution feature,
 * does not persist to saves, and retains all original click/actor coordinates.
 */
(() => {
  'use strict';
  if (window.DCContinuousRanchPreview ||
      !matchMedia('(min-width:900px) and (pointer:fine)').matches) return;
  const panel=document.querySelector('#farmPanel');
  const world=panel?.querySelector('.farmWorld');
  if (!panel || !world) return;

  const script=document.currentScript;
  const css=document.createElement('link');
  css.id='dc-continuous-ranch-css';
  css.rel='stylesheet';
  css.href=new URL('pc-continuous-ranch.css',script.src).href;
  document.head.appendChild(css);

  const bar=document.createElement('section');
  bar.id='dc-ranch-view-switch';
  bar.setAttribute('aria-label','사육장 지형 비교');
  const message=document.createElement('span');
  message.textContent='원래 사육장 / 연결형 초원 지형 비교 · 육성 판정 변화 없음';
  const button=document.createElement('button');
  button.id='dc-ranch-preview-toggle';
  button.type='button';
  button.setAttribute('aria-pressed','false');
  button.textContent='🏞 연결형 지형 시험 보기';
  bar.append(message,button);
  const drawerToggle=panel.querySelector('#dc-pc-drawer-toggle');
  if(drawerToggle)drawerToggle.insertAdjacentElement('afterend',bar);
  else panel.insertBefore(bar,panel.firstChild);

  const setPreview=enabled=>{
    const active=!!enabled;
    document.body.classList.toggle('dc-ranch-continuous',active);
    button.setAttribute('aria-pressed',String(active));
    button.textContent=active?'↩ 원래 지형으로':'🏞 연결형 지형 시험 보기';
    message.textContent=active
      ?'연결형 지형 그래픽 시험 · 환경 육성·진화 조건은 아직 원작 그대로'
      :'원래 사육장 / 연결형 초원 지형 비교 · 육성 판정 변화 없음';
  };
  button.addEventListener('click',()=>setPreview(button.getAttribute('aria-pressed')!=='true'));
  window.DCContinuousRanchPreview=Object.freeze({
    set:setPreview,
    get enabled(){return document.body.classList.contains('dc-ranch-continuous');}
  });
})();
