/* PC-only, read-only game navigation help for the ORIGINAL full game.
 * No ROM assets, save writes, state replacements, or new battle rules.
 * Loaded only by the full game's already-present production Phaser hook.
 */
(() => {
  'use strict';
  if (window.DCPCGuide || !matchMedia('(min-width: 900px) and (pointer: fine)').matches) return;
  const nav=document.querySelector('nav.tabs');
  if(!nav || !document.querySelector('#farmPanel') ||
     !document.querySelector('#huntStage') ||
     !document.querySelector('#championshipPanel'))return;

  // Keep visual presentation independently toggleable from navigation.
  // This link is loaded only on a production PC pointer/viewport; mobile,
  // old developer pages, saved progress and embedded game files are untouched.
  const skin=document.createElement('link');
  skin.id='dc-pc-visual-polish';
  skin.rel='stylesheet';
  skin.href=new URL('pc-visual-polish.css',document.currentScript.src).href;
  document.head.appendChild(skin);

  // First ranch camera slice: desktop mouse drag only. Original farm model,
  // map click handlers, sprites, zoom and saves are not rewritten here.
  const farmPanScript=document.createElement('script');
  farmPanScript.src=new URL('pc-farm-pan.js',document.currentScript.src).href;
  document.head.appendChild(farmPanScript);

  // Separate opt-in terrain paint experiment. No save, AI or ROM changes.
  const continuousScript=document.createElement('script');
  // DOM-dependent view layers must load in declared order.
  continuousScript.async=false;
  continuousScript.src=new URL('pc-continuous-ranch-preview.js',document.currentScript.src).href;
  document.head.appendChild(continuousScript);

  // PR74: diagnostic overlay reads the live farm core's precise walkability.
  // It is opt-in and never writes to the canonical game state.
  const ranchWalkabilityScript=document.createElement('script');
  ranchWalkabilityScript.async=false;
  ranchWalkabilityScript.src=new URL('pc-ranch-walkability.js',document.currentScript.src).href;
  document.head.appendChild(ranchWalkabilityScript);

  // Straight opened paths match DCFarm's existing actual route coordinates;
  // this is a visual layer only, not another movement engine.
  const ranchPathsScript=document.createElement('script');
  ranchPathsScript.async=false;
  ranchPathsScript.src=new URL('pc-ranch-ground-paths.js',document.currentScript.src).href;
  document.head.appendChild(ranchPathsScript);

  // Visual-only Digimon depth order and overlapping-name visibility.
  // The game engine still owns every actor position and animation frame.
  const ranchDepthScript=document.createElement('script');
  ranchDepthScript.async=false;
  ranchDepthScript.src=new URL('pc-ranch-actor-depth.js',document.currentScript.src).href;
  document.head.appendChild(ranchDepthScript);

  // The original atlas facade needs its own world-Y occlusion depth.
  // Runs only in PC connected terrain preview, never on mobile/NDS.
  const ranchFacadeScript=document.createElement('script');
  ranchFacadeScript.async=false;
  ranchFacadeScript.src=new URL('pc-ranch-facade-occlusion.js',document.currentScript.src).href;
  document.head.appendChild(ranchFacadeScript);

  const style=document.createElement('style');
  style.id='dc-pc-guide-styles';
  style.textContent=`
    #dc-pc-guide{margin:8px 0 12px;display:grid;grid-template-columns:auto minmax(160px,1fr) auto;
      align-items:center;gap:8px 13px;padding:9px 12px;border:1px solid #42677d;
      border-radius:10px;background:linear-gradient(110deg,#10293a,#15344a);color:#e5f6f3;
      font:13px/1.4 system-ui,sans-serif}
    #dc-pc-guide .dc-pc-links{display:flex;flex-wrap:wrap;gap:5px}
    #dc-pc-guide button{font:inherit;min-height:35px;border-radius:7px;padding:5px 10px;
      border:1px solid #557e8d;background:#183c51;color:#eafaf3;cursor:pointer}
    #dc-pc-guide button[aria-current="page"]{border-color:#f0d48b;background:#37546a;color:#fff1b2}
    #dc-pc-guide button:focus-visible{outline:2px solid #fff0a3;outline-offset:3px}
    #dc-pc-guide .dc-pc-context{min-width:0;overflow-wrap:anywhere}
    #dc-pc-guide .dc-pc-context strong{color:#ffe9b0}
    #dc-pc-guide .dc-pc-graphics{font-size:12px;color:#fbd6a1}
    #dc-pc-guide details{grid-column:1/-1;border-top:1px solid #476478;padding-top:6px}
    #dc-pc-guide summary{cursor:pointer;color:#c5e7e0;max-width:max-content}
    #dc-pc-guide .dc-pc-help{padding-top:5px;color:#c4d9e5}
    @media(max-width:899px), (pointer:coarse){#dc-pc-guide{display:none!important}}
    @media(min-width:900px) and (max-width:1170px){#dc-pc-guide{grid-template-columns:1fr auto}
      #dc-pc-guide .dc-pc-links{grid-column:1/-1}}
    @media(prefers-reduced-motion:reduce){#dc-pc-guide *{scroll-behavior:auto}}
  `;
  document.head.appendChild(style);

  const host=document.createElement('aside');
  host.id='dc-pc-guide';
  host.setAttribute('aria-label','PC 빠른 이동 및 현재 활동 안내');
  host.innerHTML=`
    <div class="dc-pc-links" aria-label="PC 탭 바로가기">
      <button type="button" data-dc-pc-tab="nursery">🏡 사육장 <small>Alt+1</small></button>
      <button type="button" data-dc-pc-tab="hunt">🪢 포획 <small>Alt+2</small></button>
      <button type="button" data-dc-pc-tab="battle">⚔ 대전 <small>Alt+3</small></button>
      <button type="button" id="dc-pc-guide-wide" hidden>▤ PC 확장 화면</button>
    </div>
    <div class="dc-pc-context" id="dc-pc-guide-context"></div>
    <button type="button" id="dc-pc-guide-jump">현재 화면의 조작으로</button>
    <div class="dc-pc-graphics" id="dc-pc-guide-graphics" hidden></div>
    <details id="dc-pc-guide-help"><summary>조작 도움말</summary>
      <div class="dc-pc-help">Alt+1 사육장 · Alt+2 포획 · Alt+3 대전.
      입력칸, 전투 중에는 단축키를 사용하지 않아.
      사육장에서는 시설·훈련 명령을, 포획에서는 탐색 후 로프 원 그리기→당기기를,
      대전에서는 출전 인원과 다음 대회 경기를 확인해 줘.
      이미지가 실제로 로드되지 못하면 아래에 경고가 표시돼.</div>
    </details>`;
  nav.insertAdjacentElement('afterend',host);
  const context=host.querySelector('#dc-pc-guide-context');
  const jump=host.querySelector('#dc-pc-guide-jump');
  const graphics=host.querySelector('#dc-pc-guide-graphics');
  const tabs=[...host.querySelectorAll('[data-dc-pc-tab]')];
  const expand=host.querySelector('#dc-pc-guide-wide');
  expand.addEventListener('click',()=>{
    if(!document.body.classList.contains('mode-nds'))return;
    document.getElementById('wideMode')?.click();
    refresh();
    requestAnimationFrame(refresh);
  });

  // PC-only contextual control drawer. The original controls stay mounted,
  // preserving their event handlers and the current game/save state.
  const nursery=document.getElementById('nursery');
  const farmPanel=document.getElementById('farmPanel');
  const rail=nursery?.querySelector(':scope > .layout');
  let drawerOpen=false;
  let lastDrawerFocus=null;
  if(nursery && farmPanel && rail){
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.id='dc-pc-drawer-toggle';
    toggle.textContent='☰ 디지몬 · 시설 관리';
    toggle.setAttribute('aria-controls','dc-pc-control-drawer');
    toggle.setAttribute('aria-expanded','false');
    farmPanel.insertBefore(toggle,farmPanel.firstChild);
    rail.id='dc-pc-control-drawer';
    rail.setAttribute('role','region');
    rail.setAttribute('aria-label','디지몬 및 사육장 조작');
    const close=document.createElement('button');
    close.id='dc-pc-drawer-close';
    close.type='button';
    close.textContent='✕ 닫기';
    close.setAttribute('aria-label','조작 패널 닫기');
    rail.insertBefore(close,rail.firstChild);
    // Preserve original controls and event handlers; move only their DOM
    // nodes into the drawer, so the main farm view has no lower control strip.
    const farmNavigation=farmPanel.querySelector('.farmNav');
    const farmDetails=farmPanel.querySelector('#farmDetails');
    const farmTools=document.createElement('section');
    farmTools.id='dc-pc-farm-tools';
    farmTools.setAttribute('aria-label','맵 탐색 및 시설 정보');
    if(farmNavigation)farmTools.appendChild(farmNavigation);
    if(farmDetails)farmTools.appendChild(farmDetails);
    rail.insertBefore(farmTools,close.nextSibling);
    function setDrawer(open,returnFocus=false){
      drawerOpen=!!open;
      nursery.classList.toggle('dc-pc-drawer-open',drawerOpen);
      toggle.setAttribute('aria-expanded',String(drawerOpen));
      if(!drawerOpen && returnFocus) (lastDrawerFocus||toggle).focus({preventScroll:true});
      if(drawerOpen) {lastDrawerFocus=document.activeElement;close.focus({preventScroll:true});}
    }
    toggle.addEventListener('click',()=>setDrawer(!drawerOpen,true));
    close.addEventListener('click',()=>setDrawer(false,true));
    // Selecting an existing actor/facility on the game map reveals controls.
    // Do not intercept or cancel the original click event.
    farmPanel.addEventListener('click',event=>{
      if(event.target.closest('#dc-pc-drawer-toggle'))return;
      if(event.target.closest('.hexActor, [data-facility-id], .farmFacility, .farmRoom')){
        if(!document.body.classList.contains('mode-nds'))setDrawer(true);
      }
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape' && drawerOpen && !inGameModal()){
        setDrawer(false,true);event.preventDefault();
      }
    });
    nav.addEventListener('click',event=>{
      if(event.target.closest('[data-tab]'))setDrawer(false);
    });
    window.DCPCDrawer=Object.freeze({
      open:()=>setDrawer(true),close:()=>setDrawer(false),
      get isOpen(){return drawerOpen;}
    });
  }

  function gameState(){
    try { return eval('state'); } catch(_) {return null;}
  }
  function activeTab(){
    const btn=document.querySelector('nav.tabs button.active[data-tab]');
    return btn?.dataset.tab || 'nursery';
  }
  function inGameModal(){
    return !!document.getElementById('dc-phaser-overlay') ||
      document.getElementById('liveBattle')?.style.display==='block';
  }
  function goTab(id){
    if(inGameModal())return false;
    const original=document.querySelector('nav.tabs button[data-tab="'+id+'"]');
    if(!original)return false;
    original.click();refresh();return true;
  }
  function trim(s,max=115){
    const str=String(s??'').replace(/\s+/g,' ').trim();
    return str.length>max?str.slice(0,max-1)+'…':str;
  }
  function getSummary(id,s){
    if(id==='hunt'){
      const ropes=Number.isFinite(s?.ropes)?s.ropes:'?';
      const hint=trim(document.querySelector('#huntInstructions')?.textContent,96) ||
        '탐색 후 로프를 선택하고 디지몬 주변에 원을 그려 줘.';
      return {title:'포획',detail:'로프 '+ropes+'개 · '+hint,
        label:'포획 필드로',selector:'#huntStage'};
    }
    if(id==='battle'){
      const wins=Number.isFinite(s?.wins)?s.wins:0;
      const losses=Number.isFinite(s?.losses)?s.losses:0;
      const cup=s?.championship?.active;
      const note=cup?(cup.awaiting?'대회 경기 진행 중':'대회 참가 중 · 다음 경기 확인'):
        '대회 선택 또는 자동전투 출전';
      return {title:'대전',detail:wins+'승 '+losses+'패 · '+note,
        label:cup?'다음 대회 경기로':'대회 목록으로',
        selector:cup?'#championshipFight':'#championshipPanel'};
    }
    const mon=document.querySelector('#hexMon');
    const name=trim(mon?.selectedOptions?.[0]?.textContent,24) ||
      trim(s?.team?.[0]?.name,24)||'디지몬 선택';
    const time=trim(document.querySelector('#hexTime')?.textContent,35);
    const action=trim(document.querySelector('#hexTrainingNext')?.textContent,90) ||
      '훈련 또는 휴식을 지정할 수 있어.';
    return {title:'사육장',detail:name+' · '+time+' · '+
      (s?.world?.paused?'일시정지':'진행 중')+' · '+action,
      label:'훈련 설정으로',selector:'#farmPanel .hexControls'};
  }
  function updateGraphicWarning(id){
    const sel=id==='hunt'?'#wildArt':'#farmPanel .hexActor img';
    const bad=[...document.querySelectorAll(sel)].filter(img=>
      img.getAttribute('src') && img.complete && img.naturalWidth===0 &&
      img.getClientRects().length>0);
    graphics.hidden=bad.length===0;
    graphics.textContent=bad.length?'⚠ 디지몬 이미지 '+bad.length+
      '개를 불러오지 못했어. 로컬 그래픽 파일을 확인해 줘.':'';
    return bad.length;
  }
  function refresh(){
    // The source two-screen ↔ expanded-mode switch can reparent the
    // original navigation without moving this optional read-only bar.
    // Follow its currently visible tab row, otherwise the bar could
    // remain inside a hidden old layout after the player expands.
    const liveNav=[...document.querySelectorAll('nav.tabs')].find(
      n=>n.getBoundingClientRect().width>0);
    if(liveNav && (host.previousElementSibling!==liveNav ||
                   host.parentElement!==liveNav.parentElement))
      liveNav.insertAdjacentElement('afterend',host);
    if(!host.isConnected)return null;
    const tab=activeTab(),state=gameState();
    // The original DS two-screen mode deliberately keeps a 560px shell.
    // Never override it silently: offer the EXISTING wide-mode switch.
    expand.hidden=!document.body.classList.contains('mode-nds') ||
      !document.getElementById('wideMode');
    const info=getSummary(tab,state);
    context.replaceChildren();
    const title=document.createElement('strong');
    title.textContent=info.title+' · ';
    const detail=document.createElement('span');
    detail.textContent=info.detail;
    context.append(title,detail);
    jump.textContent=info.label;
    jump.dataset.target=info.selector;
    for(const t of tabs){
      const selected=t.dataset.dcPcTab===tab;
      if(selected)t.setAttribute('aria-current','page');
      else t.removeAttribute('aria-current');
    }
    const missing=updateGraphicWarning(tab);
    return {tab,missing,detail:info.detail,paused:state?.world?.paused};
  }
  for(const btn of tabs){
    btn.addEventListener('click',()=>goTab(btn.dataset.dcPcTab));
  }
  jump.addEventListener('click',()=>{
    const el=document.querySelector(jump.dataset.target) ||
      document.querySelector(activeTab()==='battle'?'#championshipPanel':
        activeTab()==='hunt'?'#huntStage':'#farmPanel');
    el?.scrollIntoView({block:'center',behavior:
      matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    if(el?.matches('button:not(:disabled)'))el.focus({preventScroll:true});
    refresh();
  });
  function onKey(e){
    if(e.defaultPrevented||!e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||
       !['1','2','3'].includes(e.key)||inGameModal()||
       e.target?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
    const id={1:'nursery',2:'hunt',3:'battle'}[e.key];
    if(goTab(id))e.preventDefault();
  }
  document.addEventListener('keydown',onKey);
  nav.addEventListener('click',()=>queueMicrotask(refresh));
  const interval=setInterval(()=>{
    if(!document.hidden)refresh();
  },1600);
  window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
  // PC is the primary target. The legacy HTML initially boots into the
  // narrow NDS layout, otherwise the farm drawer seems to be missing.
  // Use the game's own mode button; users can switch back manually.
  if (document.body.classList.contains('mode-nds')) {
    document.getElementById('wideMode')?.click();
  }
  refresh();
  window.DCPCGuide=Object.freeze({snapshot:()=>refresh()});
})();
