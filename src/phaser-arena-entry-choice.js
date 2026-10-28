/* Opt-in Phaser engine chooser on the ACTUAL legacy live-arena button.
 * Loaded only in the generated full-game index.phaser.html (never in the
 * normal index.html or standalone.html). The existing match remains default.
 */
(() => {
  'use strict';
  if(new URLSearchParams(location.search).get('phaserBattle')!=='1')return;
  const start=document.getElementById('lbStart');
  const mode=document.getElementById('lbMode');
  const team=document.getElementById('lbTeamSize');
  const close=document.getElementById('lbClose');
  const status=document.getElementById('lbStatus');
  if(!start||!mode||!team||!close||!status||
      typeof window.DCDevPhaserLaunch?.launch!=='function')
    return;
  const wrap=document.createElement('label');
  wrap.id='dc-phaser-arena-choice';
  wrap.style.cssText='display:inline-flex;align-items:center;gap:7px;' +
    'font:600 13px sans-serif;color:#ecfff7;flex-wrap:wrap';
  wrap.append('전투 화면 ');
  const select=document.createElement('select');
  select.id='dc-phaser-engine';
  select.style.cssText='min-height:44px;padding:8px;border-radius:8px;' +
    'background:#18384c;color:white;border:1px solid #73b7ce';
  select.add(new Option('기존 전투 (기본)','legacy'));
  select.add(new Option('Phaser 전투 (시험)','phaser'));
  wrap.appendChild(select);
  start.parentNode.insertBefore(wrap,start);
  const note=document.createElement('span');
  note.id='dc-phaser-arena-note';
  note.style.cssText='display:block;width:100%;font-size:12px;color:#bbefdc';
  note.textContent='기본값은 기존 전투. Phaser는 내 디지몬 1대1에만 적용돼.';
  start.parentNode.insertBefore(note,start);

  start.addEventListener('click',event=>{
    if(select.value!=='phaser')return; // do not touch the original onclick
    // Capture before the original in-index battle handler. Never start two
    // engines / record an original owned-battle pending marker in parallel.
    event.preventDefault();
    event.stopImmediatePropagation();
    if(mode.value!=='owned'||team.value!=='1'){
      note.textContent='Phaser는 현재 내 디지몬 출전 1대1만 지원해. '+
        '다른 모드는 기존 전투를 선택해 줘.';
      return;
    }
    try {
      const live=eval('state');
      if(!live||live.pendingBattle)throw Error('이미 진행 중인 전투가 있어.');
      if(!live.team?.some(m=>m.hp>0&&!m.egg&&!m.lost&&
          m.location!=='storage'))
        throw Error('출전 가능한 디지몬이 없어.');
      if(window.DCDevPhaserLaunch.launch()){
        // The legacy arena has NOT started. Close only its pre-battle modal;
        // Phaser runs the same original-autonomous AI on the separate tab.
        close.click();
        note.textContent='Phaser 탭을 열었어. 원래 사육장에서 결과 승인 가능.';
      }else{
        note.textContent='Phaser 창을 열지 못했어. 팝업 차단을 확인해 줘.';
      }
    }catch(error){
      note.textContent='Phaser 출전 불가: '+String(error?.message||error);
      status.textContent=note.textContent;
    }
  },true);
  // Read-only visible inspection for browser QA; no save or battle controls.
  window.DCPhaserArenaChoice=Object.freeze({
    selected:()=>select.value,enabled:()=>true
  });
})();
