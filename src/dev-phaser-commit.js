/* Explicit DEV-ONLY settlement for the original Phaser arena.
 * Receives no original save data in the battle tab. The farm checks its
 * current own state and saves a cloned result only after player approval.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const Commit=root?.DCBattleCommit||(node?require('./battle-commit-core.js'):null);
  const api=factory(Commit);
  if(node)module.exports=api;
  if(root)root.DCDevPhaserCommit=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(Commit){
  'use strict';
  if(!Commit||typeof Commit.stageCopy!=='function')
    throw Error('Existing battle commit core required');
  const BACKUP_KEY='dc_recreation_save_backup_phaser_dev_v1';
  const FIRST_BACKUP_KEY='dc_recreation_save_backup_phaser_dev_first_v1';
  const fields=['instanceId','name','hp','maxHp','tp','maxTp','atk',
    'def','spd','level','exp','friendship','egg','lost','location'];
  const fingerprint=mon=>Object.fromEntries(fields.map(key=>[key,mon?.[key]??null]));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function capture(state){
    if(!state||state.pendingBattle||!Array.isArray(state.team)||
       !Number.isSafeInteger(state.wins)||!Number.isSafeInteger(state.losses))
      throw Error('Only an idle, valid farm can launch a saved battle');
    return {team:state.team.map(fingerprint),wins:state.wins,losses:state.losses};
  }
  function stage(state,launch,packet,battleId,lookup){
    if(typeof lookup!=='function'||!state||state.pendingBattle||
       !launch||!Array.isArray(launch.team)||
       !Number.isSafeInteger(launch.wins)||!Number.isSafeInteger(launch.losses)||
       state.wins!==launch.wins||state.losses!==launch.losses||
       !packet||!packet.final||!Array.isArray(packet.initial)||
       !Array.isArray(packet.final.fighters)||packet.final.finished!==true||
       ![0,1].includes(packet.final.winner)||
       !Number.isFinite(packet.final.elapsed)||packet.final.elapsed<0||
       packet.final.elapsed>135.1||!packet.preview||
       packet.preview.type!=='read-only-battle-result'||
       packet.preview.saveApplied!==false||
       packet.preview.rewardsApplied!==false||
       packet.preview.winner!==packet.final.winner||
       packet.preview.elapsed!==packet.final.elapsed||
       !Array.isArray(packet.preview.changes)||
       packet.preview.changes.length!==1||packet.initial.length!==1||
       packet.final.fighters.length!==2||
       !/^[a-f0-9]{32}$/.test(battleId||''))
      throw Error('Not a valid completed single-player dev battle');
    const change=packet.preview.changes[0];
    const i=change.teamIndex;
    if(!Number.isSafeInteger(i)||i<0||i>=state.team.length||
       !same(fingerprint(state.team[i]),launch.team[i]))
      throw Error('Selected Digimon changed since the battle began');
    const mon=state.team[i];
    if(typeof mon.instanceId!=='string'||!mon.instanceId||
       mon.egg||mon.lost||mon.location==='storage'||mon.hp<=0)
      throw Error('Battle participant no longer eligible');
    const before=packet.initial[0],after=packet.final.fighters[0],
      foe=packet.final.fighters[1];
    if(before.id!=='0-0'||after.id!=='0-0'||
       before.side!==0||after.side!==0||before.slot!==0||after.slot!==0||
       foe.side!==1||before.name!==mon.name||after.name!==mon.name||
       change.name!==mon.name||change.fighterId!=='0-0'||
       before.hp!==change.hpBefore||after.hp!==change.hpAfter||
       before.tp!==change.tpBefore||after.tp!==change.tpAfter||
       before.max!==mon.maxHp||after.max!==mon.maxHp||
       before.hp!==mon.hp||(Number.isFinite(mon.tp)&&mon.tp!==before.tp)||
       before.maxTp!==after.maxTp)
      throw Error('Verified 1v1 result does not match selected farm Digimon');
    // The pending marker belongs ONLY to this short-lived local clone.
    // It never pauses or modifies the live game's ongoing farm state.
    const prepared=JSON.parse(JSON.stringify(state));
    prepared.pendingBattle={id:'phaser-dev-'+battleId,
      participants:[mon.instanceId]};
    const initial=[{...before,instanceId:mon.instanceId}];
    const final={finished:true,winner:packet.final.winner,
      elapsed:packet.final.elapsed,fighters:[
        {...after,instanceId:mon.instanceId},foe
      ]};
    return Commit.stageCopy(prepared,{
      battleId:prepared.pendingBattle.id,initial,final,lookup
    });
  }
  function persist(state,launch,packet,battleId,lookup,storage){
    if(!storage||typeof storage.getItem!=='function'||
       typeof storage.setItem!=='function')
      throw Error('Readable and writable storage required');
    const baseline=JSON.stringify(state);
    if(storage.getItem(Commit.SAVE_KEY)!==baseline)
      throw Error('Farm state is not saved or another tab changed it');
    const staged=stage(state,launch,packet,battleId,lookup);
    const output=JSON.stringify(staged.state);
    if(JSON.stringify(state)!==baseline||
       storage.getItem(Commit.SAVE_KEY)!==baseline)
      throw Error('Saved farm changed while staging battle');
    // Preserve the first pre-Phaser backup and refresh the latest backup
    // before the ONLY authoritative save write.
    if(storage.getItem(FIRST_BACKUP_KEY)===null){
      storage.setItem(FIRST_BACKUP_KEY,baseline);
      if(storage.getItem(FIRST_BACKUP_KEY)!==baseline)
        throw Error('Original farm backup verification failed');
    }
    storage.setItem(BACKUP_KEY,baseline);
    if(storage.getItem(BACKUP_KEY)!==baseline)
      throw Error('Battle backup verification failed');
    if(storage.getItem(Commit.SAVE_KEY)!==baseline)
      throw Error('Another tab changed the save after backup');
    storage.setItem(Commit.SAVE_KEY,output);
    if(storage.getItem(Commit.SAVE_KEY)!==output)
      throw Error('Battle save readback verification failed');
    return staged;
  }
  return Object.freeze({BACKUP_KEY,FIRST_BACKUP_KEY,capture,stage,persist});
});
