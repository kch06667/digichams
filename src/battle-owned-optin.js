/* Optional battle save adapter for an isolated test build; not wired to main HTML.
 * Saving the real browser's game data is never enabled without a UI opt-in.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const commit=root?.DCBattleCommit||(node?require('./battle-commit-core.js'):null);
  const api=factory(commit);
  if(node)module.exports=api;
  if(root)root.DCBattleOwnedOptin=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(Commit){
  'use strict';
  if(!Commit||typeof Commit.persistCopy!=='function')throw Error('Battle commit core required');
  const BACKUP_KEY='dc_recreation_save_backup_owned_optin_v1';
  const FIRST_BACKUP_KEY='dc_recreation_save_backup_owned_optin_first_v1';
  function checkpoint(state,storage){
    if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')
      throw Error('Readable and writable storage required');
    const json=JSON.stringify(state);
    if(storage.getItem(Commit.SAVE_KEY)!==json)
      throw Error('Current save is not synchronized; back up or reload before opting in');
    // Always protect the current checkpoint before the first experimental write;
    // preserve the very first backup across multiple completed battles.
    if(storage.getItem(FIRST_BACKUP_KEY)===null){
      storage.setItem(FIRST_BACKUP_KEY,json);
      if(storage.getItem(FIRST_BACKUP_KEY)!==json)
        throw Error('First backup could not be verified');
    }
    storage.setItem(BACKUP_KEY,json);
    if(storage.getItem(BACKUP_KEY)!==json)
      throw Error('Battle backup could not be verified');
    return json;
  }
  function commitFinished(state,{won,elapsed,fighters,lookup},storage){
    if(!state?.pendingBattle||!Array.isArray(state.team))
      throw Error('No active owned battle to settle');
    if(typeof lookup!=='function'||!Array.isArray(fighters)||
       !Number.isFinite(elapsed)||elapsed<0||elapsed>135.1)
      throw Error('Invalid finished arena match');
    const allies=fighters.filter(f=>f.side===0);
    const initial=allies.map(f=>{
      const mon=state.team.find(m=>m.instanceId===f.instanceId);
      if(!mon)throw Error('Missing original roster participant');
      return {id:'owned-'+f.slot,side:0,slot:f.slot,
        instanceId:f.instanceId,name:mon.name,hp:mon.hp,max:mon.maxHp,
        tp:Number.isFinite(mon.tp)?mon.tp:f.tp,maxTp:f.maxTp};
    });
    const final={finished:true,winner:won?0:1,elapsed,
      fighters:fighters.map(f=>({
        id:(f.side===0?'owned-':'enemy-')+f.slot,
        side:f.side,slot:f.slot,instanceId:f.instanceId||null,name:f.name,
        hp:f.hp,max:f.max,tp:f.tp,maxTp:f.maxTp
      }))};
    // Backup is an explicit prerequisite; do not change a live player save
    // if the backup/readback fails.
    checkpoint(state,storage);
    return Commit.persistCopy(state,{
      battleId:state.pendingBattle.id,initial,final,lookup
    },storage);
  }
  return Object.freeze({BACKUP_KEY,FIRST_BACKUP_KEY,checkpoint,commitFinished});
});
