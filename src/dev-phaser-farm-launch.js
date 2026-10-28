/* Optional dev-only read-only bridge: farm -> Phaser exhibition.
 * Loaded ONLY by generated index.dev.html, and activated with ?phaserBridge=1.
 * No full save or individual instance identifiers leave this tab.
 * Settlement requires a second explicit user click, verified backup and
 * exact live-vs-persisted save comparison; never auto-apply on battle finish.
 */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  const arenaChoice=params.get('phaserBattle')==='1';
  if(params.get('phaserBridge')!=='1'&&!arenaChoice)return;
  const origin = location.origin;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'dc-phaser-farm-launch';
  button.textContent = '내 디지몬으로 Phaser 연습전';
  button.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;' +
    'padding:12px 16px;max-width:90vw;border-radius:10px;' +
    'background:#176b82;color:white;border:2px solid #bbf1f8;font:600 14px sans-serif';
  const notice = document.createElement('div');
  notice.id = 'dc-phaser-farm-status';
  notice.setAttribute('role','status');
  notice.style.cssText = 'position:fixed;right:12px;bottom:66px;z-index:9999;' +
    'max-width:85vw;padding:5px;background:#102f3f;color:#fff;font:13px sans-serif';
  notice.textContent = '연습전 기본값: 저장 안 함 · 종료 후 별도 승인 가능';
  const apply=document.createElement('button');
  apply.type='button';
  apply.id='dc-phaser-farm-apply';
  apply.hidden=true;
  apply.textContent='전투 결과 저장 (개발용 · 백업 필수)';
  apply.style.cssText='position:fixed;right:12px;bottom:120px;z-index:10000;' +
    'padding:10px;border:2px solid #f5d68b;background:#62481f;' +
    'color:white;font:600 13px sans-serif;border-radius:9px';
  let pending=null,activeSession=null;
  // The two tabs never share the full save. Retain only the launch
  // fingerprint and one validated result packet in the ORIGINAL farm tab.
  apply.addEventListener('click',()=>{
    if(!pending)return;
    apply.disabled=true;
    try {
      const live=eval('state');
      const lookup=eval('speciesLookup');
      const settled=DCDevPhaserCommit.persist(live,pending.launch,
        pending.packet,pending.token,lookup,localStorage);
      pending=null;
      apply.hidden=true;
      notice.textContent='백업 및 전투 정산 저장 완료 · 사육장 새로고침';
      // Existing game state is a lexical binding. Reload to adopt exactly
      // the verified persisted clone; never partially patch live objects.
      location.reload();
      return settled;
    }catch(err){
      pending=null;apply.hidden=true;
      notice.textContent='저장 거부: '+err.message+
        ' · 자동 덮어쓰기 없음. 저장 상태와 백업을 확인해 줘.';
    }
  });

  function snapshot(live) {
    if (!live || typeof live !== 'object' || live.pendingBattle ||
        !Array.isArray(live.team) || live.team.length < 1 ||
        live.team.length > 50 || !Number.isSafeInteger(live.day))
      throw Error('대기 중인 사육장 디지몬이 없거나 현재 전투 중이야.');
    // Explicit whitelist. Do not transmit names of trainers, currency history,
    // inventory, species database, timestamps, or complete game save.
    const team = live.team.map(mon => ({
      name:mon?.name, hp:mon?.hp, maxHp:mon?.maxHp,
      atk:mon?.atk, def:mon?.def, spd:mon?.spd,
      tp:mon?.tp, maxTp:mon?.maxTp, egg:!!mon?.egg,
      lost:!!mon?.lost,
      location:mon?.location === 'storage' ? 'storage' : 'farm'
    }));
    if (!team.some(mon => typeof mon.name === 'string' && mon.name &&
        Number.isFinite(mon.hp) && mon.hp > 0 && !mon.egg && !mon.lost &&
        mon.location !== 'storage'))
      throw Error('전투 가능한 디지몬이 아직 없어.');
    return {format:'digicham-save',exportVersion:1,state:{
      day:live.day,team
    }};
  }

  function launch(options={}){
    let payload,launchRecord,teamSize,leadIndex,tactic;
    // A second match must not replace a completed, unapproved settlement.
    // Nor may a parallel popup race the same underlying save snapshot.
    if(pending){notice.textContent='이전 전투 결과를 먼저 저장하거나 페이지를 새로고침해 줘.';
      return false;}
    if(activeSession&&!activeSession.popup.closed){
      notice.textContent='이미 열린 Phaser 전투 탭이 있어.';return false;
    }
    activeSession=null;
    apply.hidden=true;apply.disabled=false;
    try {
      // The existing playable game defines global lexical `state`.
      // Read it on user click, not at page load (avoids stale roster).
      const live=eval('state');
      teamSize=options.teamSize??1;
      leadIndex=options.leadIndex??live.team.findIndex(m=>
        m.hp>0&&!m.egg&&!m.lost&&m.location!=='storage');
      tactic=options.tactic??'balanced';
      if(![1,2,3].includes(teamSize)||!Number.isSafeInteger(leadIndex)||
         leadIndex<0||leadIndex>=live.team.length||
         !['balanced','aggressive','defensive','focus','conserve'].includes(tactic))
        throw Error('잘못된 Phaser 출전 설정');
      const lead=live.team[leadIndex];
      const eligible=[lead,...live.team.filter((m,i)=>i!==leadIndex)]
        .filter(m=>m&&m.hp>0&&!m.egg&&!m.lost&&m.location!=='storage');
      if(eligible[0]!==lead||eligible.length<teamSize)
        throw Error('선봉이 출전 불가능하거나 출전 마릿수가 부족해.');
      payload = snapshot(live);
      launchRecord=DCDevPhaserCommit.capture(live,{teamSize,leadIndex});
      if (!globalThis.crypto?.getRandomValues) throw Error('안전한 브라우저 환경이 필요해.');
    } catch (error) {
      notice.textContent = '연습전 연결 불가: ' + error.message;
      return false;
    }
    const random = new Uint8Array(16);
    crypto.getRandomValues(random);
    const token = [...random].map(x => x.toString(16).padStart(2,'0')).join('');
    const target = new URL('phaser-lab/',location.href);
    target.searchParams.set('farmHandoff',token); // only random nonce, no game data
    const popup = window.open(target.href,'_blank');
    if (!popup) {
      notice.textContent = '팝업이 차단됐어. 이 사이트의 새 탭 열기를 허용해 줘.';
      return false;
    }
    activeSession={token,popup};
    let done = false;
    const onReady = event => {
      if (done || event.source !== popup || event.origin !== origin ||
          event.data?.type !== 'dc-phaser-ready-v1' || event.data.token !== token)
        return;
      done = true;
      window.removeEventListener('message',onReady);
      popup.postMessage({type:'dc-phaser-roster-v1',token,payload,
        handoff:{teamSize,leadIndex,tactic}},origin);
      notice.textContent = '명단 전달 완료 · '+teamSize+'대'+teamSize+
        ' · 종료 후 결과 검증 및 선택적 저장 가능';
    };
    const onFinished=event=>{
      if(event.source!==popup||event.origin!==origin||
          event.data?.type!=='dc-phaser-finished-v1'||
          event.data.token!==token)return;
      window.removeEventListener('message',onFinished);
      if(!done||activeSession?.token!==token)return;
      activeSession=null;
      const packet=event.data.packet;
      try{
        // Pure staging performs all participant/HP/TP/identity checks
        // WITHOUT writing or mutating the player's current state.
        const live=eval('state');
        DCDevPhaserCommit.stage(live,launchRecord,packet,token,
          eval('speciesLookup'));
        pending={packet,token,launch:launchRecord};
        apply.hidden=false;
        notice.textContent='완료된 '+teamSize+'대'+teamSize+
          ' 결과 검증 완료 · 백업 후 저장은 선택사항이야.';
      }catch(err){
        notice.textContent='결과 저장 불가: '+err.message+
          ' · 원본 세이브 변경 없음';
      }
    };
    window.addEventListener('message',onReady);
    window.addEventListener('message',onFinished);
    setTimeout(() => {
      if (!done) {
        window.removeEventListener('message',onReady);
        window.removeEventListener('message',onFinished);
        if(activeSession?.token===token)activeSession=null;
        notice.textContent = '연결 시간이 초과됐어. 팝업 탭을 확인해 줘.';
      }
    },15000);
    return true;
  }
  button.addEventListener('click',launch);
  // The production-layout opt-in entry calls this from the original arena's
  // real lbStart click. It is inert unless an explicit opt-in URL was used.
  window.DCDevPhaserLaunch=Object.freeze({launch});
  if(arenaChoice)document.body.append(notice,apply);
  else document.body.append(button,notice,apply);
})();
