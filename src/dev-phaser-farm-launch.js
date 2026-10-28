/* Optional dev-only read-only bridge: farm -> Phaser exhibition.
 * Loaded ONLY by generated index.dev.html, and activated with ?phaserBridge=1.
 * No full save, persistent storage, or individual identifiers leave this tab.
 */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('phaserBridge') !== '1') return;
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
  notice.textContent = '개발용 연습전 · 결과와 보상은 저장되지 않음';

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

  button.addEventListener('click', () => {
    let payload;
    try {
      // The existing playable game defines global lexical `state`.
      // Read it on user click, not at page load (avoids stale roster).
      payload = snapshot(eval('state'));
      if (!globalThis.crypto?.getRandomValues) throw Error('안전한 브라우저 환경이 필요해.');
    } catch (error) {
      notice.textContent = '연습전 연결 불가: ' + error.message;
      return;
    }
    const random = new Uint8Array(16);
    crypto.getRandomValues(random);
    const token = [...random].map(x => x.toString(16).padStart(2,'0')).join('');
    const target = new URL('phaser-lab/',location.href);
    target.searchParams.set('farmHandoff',token); // only random nonce, no game data
    const popup = window.open(target.href,'_blank');
    if (!popup) {
      notice.textContent = '팝업이 차단됐어. 이 사이트의 새 탭 열기를 허용해 줘.';
      return;
    }
    let done = false;
    const onReady = event => {
      if (done || event.source !== popup || event.origin !== origin ||
          event.data?.type !== 'dc-phaser-ready-v1' || event.data.token !== token)
        return;
      done = true;
      window.removeEventListener('message',onReady);
      popup.postMessage({type:'dc-phaser-roster-v1',token,payload},origin);
      notice.textContent = '읽기 전용 명단 전달 완료 · 새 탭에서 1대1 시작';
    };
    window.addEventListener('message',onReady);
    setTimeout(() => {
      if (!done) {
        window.removeEventListener('message',onReady);
        notice.textContent = '연결 시간이 초과됐어. 팝업 탭을 확인해 줘.';
      }
    },15000);
  });
  document.body.append(button,notice);
})();
