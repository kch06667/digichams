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
  note.textContent='기존 전투가 기본값. Phaser는 내 디지몬 1~3대전 선택 가능 · 2/3대전은 저장 안 됨.';
  start.parentNode.insertBefore(note,start);

  start.addEventListener('click',event=>{
    if(select.value!=='phaser')return; // do not touch the original onclick
    // Capture before the original in-index battle handler. Never start two
    // engines / record an original owned-battle pending marker in parallel.
    event.preventDefault();
    event.stopImmediatePropagation();
    const size=Number(team.value);
    if(mode.value!=='owned'||![1,2,3].includes(size)){
      note.textContent='Phaser는 현재 내 디지몬 출전 1~3대전만 지원해. '+
        '자유 시연과 대회는 기존 전투를 사용해 줘.';
      return;
    }
    try {
      const live=eval('state');
      if(!live||live.pendingBattle)throw Error('이미 진행 중인 전투가 있어.');
      const lead=eval('current()');
      const leadIndex=live.team.indexOf(lead);
      const eligible=[lead,...live.team.filter(m=>m!==lead)].filter(m=>
        m&&m.hp>0&&!m.egg&&!m.lost&&m.location!=='storage');
      if(leadIndex<0||eligible[0]!==lead||eligible.length<size)
        throw Error('선봉이 출전 불가능하거나 '+size+'마리의 출전 디지몬이 부족해.');
      if(window.DCDevPhaserLaunch.launch({teamSize:size,leadIndex,
        tactic:document.getElementById('lbTactic')?.value||'balanced'})){
        // The legacy arena has NOT started. Close only its pre-battle modal;
        // Phaser runs the same original-autonomous AI on the separate tab.
        close.click();
        note.textContent=size===1?
          'Phaser 1대1 실행 · 원래 사육장에서 결과 승인 가능.':
          'Phaser '+size+'대'+size+' 실행 · 결과 미리보기만 가능 · 저장 불가.';
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
