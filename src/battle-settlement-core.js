/* Atomic adapter for the existing web game's owned-match settlement.
 * Builds a fully validated NEW state; it never persists to browser storage.
 * Mirrors the legacy owned-battle ordering for HP/TP, XP, evolution and cups.
 * Caller must persist the returned state only after round-trip QA.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const E=root?.DCEvolution||(node?require('./evolution-core.js'):null);
  const C=root?.DCChampionship||(node?require('./championship-core.js'):null);
  const api=factory(E,C);
  if(node)module.exports=api;
  if(root)root.DCBattleSettlement=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(E,C){
  'use strict';
  if(!E||!C)throw Error('Existing evolution/championship rules required');
  const clone=value=>JSON.parse(JSON.stringify(value));
  const finite=(n,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
  const validId=id=>typeof id==='string'&&id.length>0&&id.length<=128;
  function grantExperience(mon,amount=10){
    // Deliberately matches the current index.html legacy progression formula.
    if(!Number.isFinite(mon.level)||mon.level<1)mon.level=1;
    mon.level=Math.floor(mon.level);
    if(!Number.isFinite(mon.exp)||mon.exp<0)mon.exp=0;
    mon.exp+=Math.max(0,amount);
    const n=Math.max(0,Math.floor((-(2*mon.level-1)+
      Math.sqrt((2*mon.level-1)**2+8*mon.exp/25))/2));
    if(n){
      mon.exp-=25*n*(2*mon.level+n-1)/2;
      mon.level+=n;mon.maxHp+=8*n;
      mon.hp=Math.min(mon.maxHp,mon.hp+8*n);
      mon.atk+=2*n;mon.def+=n;
    }
    return n;
  }
  function settleCopy(state,{battleId,final,initial,lookup}={}){
    const pending=state?.pendingBattle;
    if(!state||typeof state!=='object'||Array.isArray(state)||
       !Array.isArray(state.team)||!pending||!validId(pending.id)||
       battleId!==pending.id||typeof lookup!=='function')
      throw Error('No matching active owned battle');
    const ids=pending.participants;
    if(!Array.isArray(ids)||ids.length<1||ids.length>3||
       ids.some(id=>!validId(id))||new Set(ids).size!==ids.length)
      throw Error('Invalid pending battle participants');
    if(!final||final.finished!==true||![0,1].includes(final.winner)||
       !finite(final.elapsed,135.1)||!Array.isArray(final.fighters)||
       !Array.isArray(initial))
      throw Error('Only completed original arena matches may settle');
    const allies=final.fighters.filter(f=>f.side===0);
    const foes=final.fighters.filter(f=>f.side===1);
    if(allies.length!==ids.length||initial.length!==ids.length||
       foes.length<1||foes.length>3||
       final.fighters.length!==allies.length+foes.length)
      throw Error('Combat roster size mismatch');
    const teamById=new Map();
    for(const mon of state.team){
      if(!mon||!validId(mon.instanceId)||teamById.has(mon.instanceId))
        throw Error('Missing or duplicate saved instance identity');
      teamById.set(mon.instanceId,mon);
    }
    const idsSet=new Set(ids),observed=new Set();
    const changes=allies.map(after=>{
      const before=initial.find(f=>f&&f.id===after.id&&f.side===0);
      const instanceId=after.instanceId;
      if(!before||!validId(instanceId)||!idsSet.has(instanceId)||
         observed.has(instanceId)||before.instanceId!==instanceId||
         before.slot!==after.slot||before.name!==after.name)
        throw Error('Combat participant identity mismatch');
      observed.add(instanceId);
      const mon=teamById.get(instanceId);
      if(!mon||mon.name!==before.name||mon.egg||mon.lost||
         mon.location==='storage'||!finite(mon.hp,mon.maxHp)||
         mon.hp<=0||!finite(before.max,999999)||before.max!==mon.maxHp||
         !finite(before.hp,before.max)||before.hp!==mon.hp||
         after.max!==before.max||!finite(after.hp,after.max)||
         !finite(before.maxTp,999999)||before.maxTp<=0||
         after.maxTp!==before.maxTp||!finite(before.tp,before.maxTp)||
         !finite(after.tp,after.maxTp))
        throw Error('Saved and simulated participant vitals differ');
      if(Number.isFinite(mon.tp)&&mon.tp!==before.tp)
        throw Error('Starting TP no longer matches saved Digimon');
      if(Number.isFinite(mon.maxTp)&&mon.maxTp!==before.maxTp)
        throw Error('Starting max TP no longer matches saved Digimon');
      return {instanceId,name:mon.name,fromHP:mon.hp,
        hp:Math.max(0,Math.min(mon.maxHp,Math.ceil(after.hp))),
        fromTP:before.tp,tp:Math.max(0,Math.min(after.maxTp,Math.floor(after.tp))),
        maxTp:after.maxTp};
    });
    if(observed.size!==idsSet.size||initial.some(f=>!f||f.side!==0||
      !observed.has(f.instanceId)||initial.filter(x=>x.id===f.id).length!==1))
      throw Error('Combat initial roster does not match pending participants');
    if(pending.tournamentMatchId){
      const active=state.championship?.active;
      if(!active||active.awaiting!==pending.tournamentMatchId||
         active.id+'-round-'+active.round!==pending.tournamentMatchId)
        throw Error('Tournament match identity mismatch');
    }
    // All checks precede mutation; even a downstream rule error affects only
    // this local copy. No localStorage or original-state mutation here.
    const next=clone(state),won=final.winner===0;
    const nextById=new Map(next.team.map(mon=>[mon.instanceId,mon]));
    for(const change of changes){
      const mon=nextById.get(change.instanceId);
      mon.hp=change.hp;mon.tp=change.tp;mon.maxTp=change.maxTp;
    }
    if(won){
      next.wins=(Number(next.wins)||0)+1;
      next.points=(Number(next.points)||0)+2;
      for(const change of changes){
        const mon=nextById.get(change.instanceId);
        grantExperience(mon,10);
        mon.friendship=Math.min(100,(Number(mon.friendship)||0)+2);
      }
    }else next.losses=(Number(next.losses)||0)+1;
    E.recordBattle(next,ids,won,lookup);
    let cup=null;
    if(pending.tournamentMatchId){
      cup=C.finishMatch(next,pending.tournamentMatchId,won);
      if(!cup.ok)throw Error('Tournament settlement rejected: '+cup.reason);
    }
    delete next.pendingBattle;
    const receipt={battleId,winner:final.winner,won,
      elapsed:final.elapsed,participants:changes.map(c=>c.instanceId),
      tournamentMatchId:pending.tournamentMatchId||null,
      changes:changes.map(c=>({...c})),cup:cup?clone(cup):null};
    return {state:next,receipt};
  }
  return Object.freeze({settleCopy,grantExperience});
});
