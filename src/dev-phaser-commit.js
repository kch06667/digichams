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
  const active=mon=>mon&&typeof mon==='object'&&!mon.egg&&
    !mon.lost&&mon.location!=='storage'&&Number.isFinite(mon.hp)&&mon.hp>0;
  // An immutable lineup is captured inside the ORIGINAL farm tab before
  // opening a new Phaser tab. Its internal per-mon instance IDs stay here.
  function capture(state,{teamSize=1,leadIndex=null}={}){
    if(!state||state.pendingBattle||!Array.isArray(state.team)||
       state.team.length<1||state.team.length>50||
       !Number.isSafeInteger(state.wins)||!Number.isSafeInteger(state.losses)||
       ![1,2,3].includes(teamSize))
      throw Error('Only an idle, valid farm can launch a saved battle');
    const first=leadIndex==null?state.team.findIndex(active):leadIndex;
    if(!Number.isSafeInteger(first)||first<0||
       first>=state.team.length||!active(state.team[first]))
      throw Error('Invalid first fighter');
    const lineupIndices=[first,...state.team.map((_,i)=>i).filter(i=>
      i!==first&&active(state.team[i]))].slice(0,teamSize);
    if(lineupIndices.length!==teamSize)
      throw Error('Not enough healthy Digimon in the farm');
    const ids=lineupIndices.map(i=>state.team[i].instanceId);
    if(ids.some(id=>typeof id!=='string'||!id||id.length>128)||
       new Set(ids).size!==ids.length)
      throw Error('Missing or duplicate Digimon identity');
    return {team:state.team.map(fingerprint),wins:state.wins,
      losses:state.losses,lineupIndices};
  }
  function stage(state,launch,packet,battleId,lookup){
    const size=launch?.lineupIndices?.length;
    if(typeof lookup!=='function'||!state||state.pendingBattle||
       !launch||!Array.isArray(launch.team)||
       ![1,2,3].includes(size)||
       launch.team.length!==state.team?.length||
       new Set(launch.lineupIndices).size!==size||
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
       packet.preview.changes.length!==size||
       packet.initial.length!==size||
       packet.final.fighters.length!==size*2||
       !/^[a-f0-9]{32}$/.test(battleId||''))
      throw Error('Not a valid completed owned Phaser battle');
    const allies=packet.final.fighters.filter(f=>f?.side===0);
    const foes=packet.final.fighters.filter(f=>f?.side===1);
    if(allies.length!==size||foes.length!==size||
       foes.some((f,slot)=>f.slot!==slot||f.id!=='1-'+slot))
      throw Error('Combat roster size mismatch');
    const participants=[],initial=[],finalAllies=[];
    for(let slot=0;slot<size;slot++){
      const change=packet.preview.changes[slot];
      const index=launch.lineupIndices[slot];
      const before=packet.initial[slot];
      const after=allies[slot];
      const mon=state.team[index];
      if(!change||!before||!after||
         !Number.isSafeInteger(index)||index<0||index>=state.team.length||
         change.teamIndex!==index||
         !same(fingerprint(mon),launch.team[index]))
        throw Error('Selected Digimon changed since the battle began');
      if(typeof mon.instanceId!=='string'||!mon.instanceId||
         mon.instanceId.length>128||!active(mon))
        throw Error('Battle participant no longer eligible');
      if(before.id!=='0-'+slot||after.id!=='0-'+slot||
         before.side!==0||after.side!==0||
         before.slot!==slot||after.slot!==slot||
         before.name!==mon.name||after.name!==mon.name||
         change.name!==mon.name||change.fighterId!=='0-'+slot||
         before.hp!==change.hpBefore||after.hp!==change.hpAfter||
         before.tp!==change.tpBefore||after.tp!==change.tpAfter||
         before.max!==mon.maxHp||after.max!==mon.maxHp||
         before.hp!==mon.hp||
         (Number.isFinite(mon.tp)&&mon.tp!==before.tp)||
         (Number.isFinite(mon.maxTp)&&mon.maxTp!==before.maxTp)||
         before.maxTp!==after.maxTp||
         !Number.isFinite(before.maxTp)||before.maxTp<=0||
         !Number.isFinite(before.tp)||!Number.isFinite(after.tp)||
         !Number.isFinite(after.hp)||after.hp<0||after.hp>after.max||
         before.tp<0||before.tp>before.maxTp||
         after.tp<0||after.tp>after.maxTp||
         ['atk','def','spd'].some(key=>
           Number.isFinite(before[key])&&before[key]!==mon[key]))
        throw Error('Verified battle result does not match the farm Digimon');
      participants.push(mon.instanceId);
      initial.push({...before,instanceId:mon.instanceId});
      finalAllies.push({...after,instanceId:mon.instanceId});
    }
    if(new Set(participants).size!==size)
      throw Error('Duplicate participant identity');
    const prepared=JSON.parse(JSON.stringify(state));
    const id='phaser-dev-'+battleId;
    prepared.pendingBattle={id,participants};
    return Commit.stageCopy(prepared,{
      battleId:id,
      initial,
      final:{finished:true,winner:packet.final.winner,
        elapsed:packet.final.elapsed,
        fighters:[...finalAllies,...foes]},
      lookup
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
