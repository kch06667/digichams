/* CI-only deterministic clock driver. NOT bundled in standard opt-in output.
 * Created only with --qa for a local, isolated browser context. Uses the real
 * original arena's update() battle simulation (movement/AI/damage/KO/timeout)
 * and its real settleMatch callback. Does not force a winner or change HP.
 */
window.__dcOwnedBattleQa=Object.freeze({
  snapshot(){
    return {
      started:ownedMatch&&!settled,
      settled:!!settled,finished:!!finished,running:!!running,
      elapsed,winningSide,stats:{...stats},
      fighters:fighters.map(f=>({side:f.side,slot:f.slot,name:f.name,
        instanceId:f.instanceId||null,hp:f.hp,tp:f.tp,max:f.max,
        x:f.x,y:f.y})),
      pendingId:state.pendingBattle?.id||null,
      wins:state.wins,losses:state.losses,
      points:state.points,
      inMemoryLog:state.logs?.[0]||null,
      saved:localStorage.getItem('dc_recreation_save')
    };
  },
  fastForward(maxSteps=3000){
    if(!ownedMatch||settled||!running||finished)
      throw Error('Begin an actual owned arena match before QA clock');
    if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>3200)
      throw Error('Invalid maximum steps');
    // Simulate the same 48-ms frame updates as the live arena, but skip
    // rendering to avoid waiting for ~135 real-world seconds in CI.
    // Do not directly modify combat stats or force a result.
    for(let i=0;i<maxSteps&&!finished;i++)update(.048);
    return this.snapshot();
  }
});
