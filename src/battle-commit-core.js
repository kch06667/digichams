/* Staged owned-battle result for future integration.
 * Never called by production HTML/Phaser yet. A caller must adopt the returned
 * state ONLY after persistCopy succeeds; failed writes leave the input intact.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const S=root?.DCBattleSettlement||(node?require('./battle-settlement-core.js'):null);
  const api=factory(S);
  if(node)module.exports=api;
  if(root)root.DCBattleCommit=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(S){
  'use strict';
  if(!S||typeof S.settleCopy!=='function')throw Error('Battle settlement core required');
  const SAVE_KEY='dc_recreation_save';
  function say(next,message){
    // Exact existing HTML say() behavior, including newest-first order and cap.
    next.logs.unshift('[DAY '+next.day+'] '+message);
    next.logs=next.logs.slice(0,60);
  }
  function stageCopy(state,options){
    const staged=S.settleCopy(state,options);
    const next=staged.state;
    if(!Array.isArray(next.logs))throw Error('Invalid saved battle log');
    const cup=staged.receipt.cup;
    // This is intentionally the same order as the existing settleMatch:
    // evolution-core has already logged any evolution on the cloned state,
    // then tournament result, then general fight result.
    if(cup?.ok){
      if(cup.complete&&cup.won)
        say(next,'🏆 '+cup.result.cup+' 우승! 상금 '+cup.prize+' 시설 Bit를 받았어.');
      else if(cup.complete)
        say(next,'대회 탈락. 다음 일정에 재도전할 수 있어.');
      else
        say(next,'준결승 승리! 결승 진출. 체력과 TP를 회복하고 다음 경기에 출전해.');
    }
    say(next,staged.receipt.won
      ?'내 디지몬이 승리했어. 출전 개체에게 경험치를 지급했어.'
      :'내 디지몬이 패배했어. 휴식으로 회복해 줘.');
    return staged;
  }
  function persistCopy(state,options,storage){
    if(!storage||typeof storage.getItem!=='function'||
       typeof storage.setItem!=='function')
      throw Error('Readable and writable save storage required');
    // Strict compare-and-write guard: the disk snapshot must be exactly the
    // state being settled. It rejects a stale tab or replayed result instead
    // of silently overwriting newer player progress.
    const baseline=JSON.stringify(state);
    if(storage.getItem(SAVE_KEY)!==baseline)
      throw Error('Saved battle state is stale; refusing overwrite');
    const staged=stageCopy(state,options);
    const serialized=JSON.stringify(staged.state);
    if(JSON.stringify(state)!==baseline||
       storage.getItem(SAVE_KEY)!==baseline)
      throw Error('Saved battle state changed during settlement');
    // Single synchronous write: never mutate input, emit UI success, or return
    // an adoptable state if the browser storage write rejects.
    storage.setItem(SAVE_KEY,serialized);
    // Web Storage is synchronous. A storage adapter that reports success
    // without retaining the complete payload must not yield an adoptable
    // result. The caller handles this error; this helper never overwrites
    // or rolls back an unrelated/newer saved snapshot.
    if(storage.getItem(SAVE_KEY)!==serialized)
      throw Error('Battle save verification failed after write');
    return staged;
  }
  return Object.freeze({SAVE_KEY,stageCopy,persistCopy});
});
