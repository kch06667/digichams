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
  note.textContent='기존 전투가 기본값. Phaser는 내 디지몬 1~3대전 · 종료 후 승인 시 백업·저장.';
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
        note.textContent='Phaser '+size+'대'+size+
          ' 실행 · 자동 저장 없음 · 전투 종료 후 사육장에서 승인 가능.';
      }else{
        note.textContent='Phaser 창을 열지 못했어. 팝업 차단을 확인해 줘.';
      }
    }catch(error){
      note.textContent='Phaser 출전 불가: '+String(error?.message||error);
      status.textContent=note.textContent;
    }
  },true);
  // Championship UI calls DCChampionship.beginMatch FIRST, which writes
  // the expected awaiting matchId, then delegates to launchTournament().
  // Intercept ONLY that already-validated original flow. Do not replace
  // championship entry, bracket calculation or its legacy default.
  const championship=document.getElementById('championshipPanel');
  if(championship&&window.DCBattleArena?.launchTournament){
    const choice=document.createElement('label');
    choice.id='dc-phaser-cup-choice';
    choice.style.cssText='display:inline-flex;align-items:center;gap:8px;' +
      'font:600 13px sans-serif;padding:8px;color:#e4f9ee';
    choice.append('🏆 대회 전투 화면 ');
    const cupEngine=document.createElement('select');
    cupEngine.id='dc-phaser-cup-engine';
    cupEngine.style.cssText='padding:8px;min-height:44px;border-radius:8px;' +
      'background:#18384c;color:white;border:1px solid #73b7ce';
    cupEngine.add(new Option('기존 전투 (기본)','legacy'));
    cupEngine.add(new Option('Phaser 대회 전투 (시험)','phaser'));
    choice.appendChild(cupEngine);
    const cupNote=document.createElement('p');
    cupNote.id='dc-phaser-cup-note';
    cupNote.style.cssText='font-size:12px;color:#bbefdc;margin:4px';
    cupNote.textContent='대회 대진표와 상금은 기존 규칙 유지 · '+
      'Phaser 저장은 종료 후 사용자 승인 시에만';
    const bracket=document.getElementById('championshipBracket');
    championship.insertBefore(choice,bracket);
    championship.insertBefore(cupNote,bracket);
    const oldTournament=window.DCBattleArena.launchTournament.bind(window.DCBattleArena);
    window.DCBattleArena.launchTournament=function(match){
      if(cupEngine.value!=='phaser')return oldTournament(match);
      try{
        const live=eval('state'),lead=eval('current()');
        const leadIndex=live.team?.indexOf(lead);
        if(live.pendingBattle||!Number.isSafeInteger(leadIndex)||leadIndex<0)
          throw Error('대회 출전 상태가 올바르지 않아.');
        const healthy=[lead,...live.team.filter(m=>m!==lead)].filter(
          m=>m&&m.hp>0&&!m.egg&&!m.lost&&m.location!=='storage');
        if(!match||!Number.isSafeInteger(match.size)||
           healthy[0]!==lead||healthy.length<match.size)
          throw Error('대회 출전 인원이 부족해.');
        // In the older checked-in v0.23 cup engine, only the first foe
        // is defined; the ORIGINAL arena fills remaining slots using
        // teamMembers(opponent, side=1, size). Reproduce that exact order.
        const names=eval('allNames');
        let foes=match.opponentTeam;
        if(!Array.isArray(foes)||foes.length!==match.size){
          const found=names.indexOf(match.opponent);
          if(found<0)throw Error('원래 대회 상대를 찾을 수 없어.');
          foes=[match.opponent];
          for(let n=1;foes.length<match.size&&n<names.length;n++){
            const name=names[(found+n+2)%names.length];
            if(!foes.includes(name))foes.push(name);
          }
        }
        if(foes.length!==match.size)
          throw Error('기존 대회 상대 팀 구성이 부족해.');
        const preparedMatch={...match,opponentTeam:foes.slice(),
          trainer:match.trainer||'상대 테이머'};
        const ok=window.DCDevPhaserLaunch.launch({
          teamSize:match.size,leadIndex,
          tactic:live.battleTactic||document.getElementById('lbTactic')?.value||
            'balanced',
          tournament:preparedMatch
        });
        cupNote.textContent=ok?
          '🏆 '+match.name+' · '+match.trainer+' 상대 · Phaser 전투 탭 실행 '+
          '· 결과 승인 전까지 미정산':
          '대회 전투창 연결 실패 · 출전 대기 상태 복원';
        return ok; // original championship UI handles rejected launch
      }catch(err){
        cupNote.textContent='대회 Phaser 출전 거부: '+String(err?.message||err);
        return false;
      }
    };
  }

  // Read-only visible inspection for browser QA; no save or battle controls.
  window.DCPhaserArenaChoice=Object.freeze({
    selected:()=>select.value,enabled:()=>true
  });
})();
