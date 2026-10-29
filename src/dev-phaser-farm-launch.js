/* Optional dev-only read-only bridge: farm -> Phaser exhibition.
 * Loaded ONLY by generated index.dev.html, and activated with ?phaserBridge=1.
 * No full save or individual instance identifiers leave this tab.
 * Settlement requires a second explicit user click, verified backup and
 * exact live-vs-persisted save comparison; never auto-apply on battle finish.
 */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  // Normal full-game HTTP entry loads this after the original arena.
  // Developer pages retain their existing explicit URL gates.
  const production=document.currentScript?.dataset?.phaserProduction==='1';
  const arenaChoice=production||params.get('phaserBattle')==='1';
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
  notice.textContent = production?
    'Phaser 자동전투 기본 · 결과 검증 후 자동 백업/저장':
    '연습전 기본값: 저장 안 함 · 종료 후 별도 승인 가능';
  const apply=document.createElement('button');
  apply.type='button';
  apply.id='dc-phaser-farm-apply';
  apply.hidden=true;
  apply.textContent='전투 결과 저장 (개발용 · 백업 필수)';
  apply.style.cssText='position:fixed;right:12px;bottom:120px;z-index:10000;' +
    'padding:10px;border:2px solid #f5d68b;background:#62481f;' +
    'color:white;font:600 13px sans-serif;border-radius:9px';
  let pending=null,activeSession=null;
  const PARK_KEY='dc_phaser_park_recovery_v1';
  const TAB_KEY='dc_phaser_tab_recovery_v1';
  // The real PC/mobile game hosts Phaser in a same-page dialog. Developer
  // bridge and optional QA pages retain their old popup + manual approval.
  function openEmbedded(url){
    const layer=document.createElement('section');
    layer.id='dc-phaser-overlay';
    layer.setAttribute('role','dialog');
    layer.setAttribute('aria-modal','true');
    layer.setAttribute('aria-label','실시간 자동 전투');
    layer.style.cssText='position:fixed;inset:0;z-index:2147483000;' +
      'display:flex;flex-direction:column;background:#081724;color:white;' +
      'padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)';
    const bar=document.createElement('div');
    bar.style.cssText='display:flex;align-items:center;gap:12px;' +
      'padding:6px 12px;background:#102d3c;min-height:52px';
    const title=document.createElement('strong');
    title.textContent='⚔ Phaser 실시간 자동 전투';
    title.style.cssText='flex:1;font:600 15px system-ui,sans-serif';
    const exit=document.createElement('button');
    exit.id='dc-phaser-overlay-close';exit.type='button';
    exit.textContent='전투 포기 · 사육장 복귀';
    exit.style.cssText='min-height:44px;padding:8px 12px;border-radius:8px;' +
      'border:1px solid #9db2c6;background:#274457;color:#fff;' +
      'font:600 13px system-ui,sans-serif;cursor:pointer';
    exit.addEventListener('click',()=>cancel.click());
    bar.append(title,exit);
    const frame=document.createElement('iframe');
    frame.id='dc-phaser-arena-frame';
    frame.title='Phaser 자동 전투 화면';
    frame.style.cssText='flex:1;min-height:0;width:100%;border:0;background:#0e1829';
    frame.setAttribute('allow','autoplay');
    layer.append(bar,frame);
    document.body.appendChild(layer);
    frame.src=url;
    return {popup:frame.contentWindow,frame,layer};
  }
  function closeSession(session){
    if(session?.layer)session.layer.remove();
    else try{session?.popup?.close();}catch(_){}
  }
  const KEY='dc_recreation_save';
  // A crash/reload can happen after the *paused* pre-fight save but before
  // any terminal packet arrives. This lease records the exact bytes that
  // may be restored. It cannot authorize battle settlement or rewards.
  function readParkMarker(){
    try {
      const raw=localStorage.getItem(PARK_KEY);
      if(!raw)return null;
      const item=JSON.parse(raw);
      return item?.version===1 && /^[a-f0-9]{32}$/.test(item.token) &&
        typeof item.paused==='boolean' &&
        typeof item.saved==='string' && item.saved.length>0 &&
        Number.isFinite(item.created)?item:null;
    }catch(_){return null;}
  }
  function clearParkMarker(token){
    const record=readParkMarker();
    if(record?.token===token)localStorage.removeItem(PARK_KEY);
    try {
      if(sessionStorage.getItem(TAB_KEY)===token)
        sessionStorage.removeItem(TAB_KEY);
    }catch(_){}
  }
  function rememberPark(token,park){
    const record={version:1,token,paused:park.paused,
      saved:park.saved,created:Date.now()};
    // Never overwrite another tab's in-progress active lease. A failed
    // recovery-store write cancels the fight instead of leaving it paused.
    if(localStorage.getItem(PARK_KEY))throw Error(
      '중단된 이전 전투 기록이 있어. 기존 세이브 복구를 먼저 확인해 줘.');
    localStorage.setItem(PARK_KEY,JSON.stringify(record));
    try{sessionStorage.setItem(TAB_KEY,token);}
    catch(err){clearParkMarker(token);throw err;}
  }
  const restore=document.createElement('button');
  restore.id='dc-phaser-recover-interrupted';
  restore.type='button';restore.hidden=true;
  restore.textContent='중단된 전투 복구 · 사육장 시간 되돌리기';
  restore.style.cssText='position:fixed;right:12px;bottom:120px;' +
    'z-index:10001;min-height:44px;padding:9px;border-radius:9px;' +
    'background:#715525;color:#fff;font:600 13px sans-serif';
  function restoreInterrupted(explicit=false){
    if(!production||activeSession)return false;
    const record=readParkMarker();
    if(!record)return false;
    const sameTab=(()=>{
      try{return sessionStorage.getItem(TAB_KEY)===record.token;}
      catch(_){return false;}
    })();
    // An unrelated tab must never auto-abort a live battle. Its recovery
    // requires an explicit click after longer than the maximum natural
    // autonomous fight's real wall-clock duration.
    if(!sameTab&&(!explicit||Date.now()-record.created<180000)){
      restore.hidden=false;
      notice.textContent='이전 전투 기록이 있어. 다른 탭에서 진행 중일 수 있어. '+
        '진행 중인 전투가 없다면 3분 후 복구할 수 있어.';
      return false;
    }
    const saved=localStorage.getItem(KEY);
    if(saved!==record.saved){
      clearParkMarker(record.token);
      restore.hidden=true;
      notice.textContent='저장 데이터가 전투 시작 시점과 달라 복구하지 않았어. '+
        '더 최신 세이브를 보존했어.';
      return false;
    }
    try{
      const live=eval('state');
      const disk=JSON.parse(saved);
      if(!disk?.world||disk.world.paused!==true||
         live?.world?.paused!==true||live.pendingBattle)
        throw Error('기존 게임 상태와 저장 기록이 달라.');
      live.world.paused=record.paused;
      eval('save(false)');
      clearParkMarker(record.token);
      restore.hidden=true;
      notice.textContent='중단된 Phaser 전투를 정산하지 않고 사육장 시간을 복구했어.';
      return true;
    }catch(err){
      notice.textContent='전투 중단 복구 보류: '+err.message+
        ' · 저장 기록은 덮어쓰지 않았어.';
      return false;
    }
  }
  restore.addEventListener('click',()=>restoreInterrupted(true));
  const cancel=document.createElement('button');
  cancel.type='button';cancel.id='dc-phaser-farm-cancel';cancel.hidden=true;
  cancel.textContent='Phaser 전투 취소 · 기존 화면 복귀';
  cancel.style.cssText='position:fixed;right:12px;bottom:176px;z-index:10000;' +
    'padding:9px;border-radius:9px;background:#314254;color:white';
  // During a production fight, pause the FARM clock (not the real-time
  // Phaser battle) to prevent a stale tab/6s autosave race. Preserve the
  // user's original pause preference and refuse overwriting a newer tab.
  function releasePark(session) {
    if(!session?.park)return;
    const live=eval('state');
    if(localStorage.getItem(KEY)===session.park.saved){
      live.world.paused=session.park.paused;
      eval('save(false)');
    }else{
      notice.textContent='다른 탭에서 저장이 변경됐어. 새로고침 후 확인해 줘.';
    }
    clearParkMarker(session.token);
    session.park=null;
  }
  cancel.addEventListener('click',()=>{
    if(!activeSession)return;
    const session=activeSession;activeSession=null;
    session.cleanup?.();
    closeSession(session);
    releasePark(session);cancel.hidden=true;
    notice.textContent='Phaser 전투 취소 · 기본 게임으로 복귀';
  });
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
      // This source tab still holds its OLD pre-settlement farm state.
      // Farm pagehide/visibilitychange handlers must not overwrite the
      // approved atomic save when location.reload() unloads this tab.
      window.DCDevPhaserApprovedSave=true;
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
    let payload,launchRecord,teamSize,leadIndex,tactic,opponents=null;
    // A second match must not replace a completed, unapproved settlement.
    // Nor may a parallel popup race the same underlying save snapshot.
    if(pending){notice.textContent='이전 전투 결과를 먼저 저장하거나 페이지를 새로고침해 줘.';
      return false;}
    if(activeSession&&(activeSession.frame?.isConnected||
        (!activeSession.frame&&!activeSession.popup.closed))){
      notice.textContent='이미 Phaser 전투가 진행 중이야.';return false;
    }
    if(activeSession?.park)releasePark(activeSession);
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
      launchRecord=DCDevPhaserCommit.capture(live,{teamSize,leadIndex,
        tournament:options.tournament||null});
      if(launchRecord.tournament){
        const cup=launchRecord.tournament;
        opponents=cup.opponentTeam.map(name=>{
          const species=eval('speciesLookup')(name);
          if(!species||!Number.isFinite(species.hp)||
             !Number.isFinite(species.atk)||!Number.isFinite(species.def)||
             !Number.isFinite(species.spd))
            throw Error('대회 상대 종족의 전투 능력치가 없어: '+name);
          const maxHp=Math.round(70+species.hp*.40);
          const vitals=DCBattleCore.fighterVitals(species);
          return {name,hp:maxHp,maxHp,atk:species.atk,def:species.def,
            spd:species.spd,maxTp:vitals.maxTp,tp:vitals.tp};
        });
        cup.opponents=opponents.map(x=>({...x}));
      }
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
    let view;
    if(production){
      // Explicit frame marker: the lab accepts its parent as the trusted
      // peer, auto-starts after a validated roster, and uses compact UI.
      target.searchParams.set('embeddedBattle','1');
      try{view=openEmbedded(target.href);}catch(err){
        notice.textContent='내부 전투 화면을 열 수 없어: '+err.message;
        return false;
      }
    }else{
      const popup=window.open(target.href,'_blank');
      if(!popup){
        notice.textContent='팝업이 차단됐어. 새 탭 열기를 허용해 줘.';
        return false;
      }
      view={popup};
    }
    const {popup}=view;
    let park=null;
    if(production){
      const live=eval('state'),paused=live.world.paused;
      try{
        if(typeof paused!=='boolean')throw Error('게임 시계 상태를 읽을 수 없어.');
        live.world.paused=true;
        // Pre-fight snapshot makes the atomic result authoritative, and
        // records a compare-and-swap base for other-tab race detection.
        eval('save(false)');
        const saved=localStorage.getItem(KEY);
        if(saved!==JSON.stringify(live))
          throw Error('전투 전 세이브 검증 실패');
        park={paused,saved};
        rememberPark(token,park);
      }catch(err){
        live.world.paused=paused;
        // A failed marker write must not strand a persisted paused state.
        try{eval('save(false)');}catch(_){}
        clearParkMarker(token);
        closeSession(view);
        notice.textContent='Phaser 전투 시작 취소: '+err.message;
        return false;
      }
    }
    activeSession={token,...view,park};
    cancel.hidden=!production;
    let done = false;
    const onReady = event => {
      if (done || activeSession?.token!==token ||
          event.source !== popup || event.origin !== origin ||
          event.data?.type !== 'dc-phaser-ready-v1' || event.data.token !== token)
        return;
      done = true;
      window.removeEventListener('message',onReady);
      popup.postMessage({type:'dc-phaser-roster-v1',token,payload,
        handoff:{teamSize,leadIndex,tactic,
          ...(launchRecord.tournament?{tournament:{
            cupId:launchRecord.tournament.cupId,
            matchId:launchRecord.tournament.matchId,
            round:launchRecord.tournament.round,
            trainer:launchRecord.tournament.trainer,
            opponentTeam:launchRecord.tournament.opponentTeam.slice(),
            size:teamSize,opponents:opponents.map(mon=>({...mon}))
          }}:{})}},origin);
      notice.textContent = (launchRecord.tournament?
        '🏆 '+launchRecord.tournament.trainer+' 상대 대회전 · ': '명단 전달 완료 · ')+
        teamSize+'대'+teamSize+(production?' · 완료 후 자동 백업/저장':' · 종료 후 선택적 저장 가능');
    };
    const onFinished=event=>{
      if(event.source!==popup||event.origin!==origin||
          event.data?.type!=='dc-phaser-finished-v1'||
          event.data.token!==token)return;
      window.removeEventListener('message',onFinished);
      if(!done||activeSession?.token!==token)return;
      const session=activeSession;
      activeSession=null;cancel.hidden=true;
      const packet=event.data.packet;
      try{
        // Pure staging performs all participant/HP/TP/identity checks
        // WITHOUT writing or mutating the player's current state.
        const live=eval('state');
        DCDevPhaserCommit.stage(live,launchRecord,packet,token,
          eval('speciesLookup'));
        if(production){
          // Do not silently overwrite a newer save from another tab.
          if(!session.park||localStorage.getItem(KEY)!==session.park.saved)
            throw Error('다른 탭의 저장이 변경되어 자동 정산을 중단했어.');
          live.world.paused=session.park.paused;
          // The original game state was safely paused throughout combat.
          // Restore the previous clock choice before atomic settlement.
          eval('save(false)');
          DCDevPhaserCommit.persist(live,launchRecord,packet,token,
            eval('speciesLookup'),localStorage);
          clearParkMarker(token);
          session.park=null;
          closeSession(session);
          notice.textContent='Phaser 결과 자동 정산·백업 완료';
          window.DCDevPhaserApprovedSave=true;
          location.reload();
        }else{
          pending={packet,token,launch:launchRecord};
          apply.hidden=false;
          notice.textContent='완료된 '+
            (launchRecord.tournament?'🏆 대회 경기 ':'')+
            teamSize+'대'+teamSize+' 결과 검증 완료 · 저장 승인 가능';
        }
      }catch(err){
        if(session.frame)closeSession(session);
        releasePark(session);
        notice.textContent='Phaser 결과 저장 거부: '+err.message+
          ' · 자동 덮어쓰기 없음. 기존 세이브를 확인해 줘.';
      }
    };
    window.addEventListener('message',onReady);
    window.addEventListener('message',onFinished);
    activeSession.cleanup=()=>{
      window.removeEventListener('message',onReady);
      window.removeEventListener('message',onFinished);
      done=true;
    };
    setTimeout(() => {
      if (!done&&activeSession?.token===token) {
        window.removeEventListener('message',onReady);
        window.removeEventListener('message',onFinished);
        if(activeSession?.token===token){
          const session=activeSession;activeSession=null;
          session.cleanup?.();
          closeSession(session);
          releasePark(session);cancel.hidden=true;
          if(production){
            document.getElementById('dc-phaser-engine')?.value &&
              (document.getElementById('dc-phaser-engine').value='legacy');
            const cup=document.getElementById('dc-phaser-cup-engine');
            if(cup)cup.value='legacy';
          }
        }
        notice.textContent = '연결 시간이 초과됐어. 기존 화면으로 돌아왔어.';
      }
    },15000);
    return true;
  }
  button.addEventListener('click',launch);
  // The production-layout opt-in entry calls this from the original arena's
  // real lbStart click. It is inert unless an explicit opt-in URL was used.
  window.DCDevPhaserLaunch=Object.freeze({launch});
  if(arenaChoice)document.body.append(notice,apply,cancel,restore);
  else document.body.append(button,notice,apply,cancel,restore);
  if(production)restoreInterrupted(false);
})();
