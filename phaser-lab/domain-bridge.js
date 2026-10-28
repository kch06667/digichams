/* Adapter to existing gameplay rule modules — NEVER writes to the live save.
 * Battle targeting/TP, seasonal training and cup eligibility come from src/*.
 * Damage values and the visual battle turn scheduler remain demo-only.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const battle=root?.DCBattleCore||(node?require('../src/battle-core.js'):null);
  const care=root?.DCCare||(node?require('../src/care-core.js'):null);
  const cups=root?.DCChampionship||(node?require('../src/championship-core.js'):null);
  const api=factory(battle,care,cups);
  if(node)module.exports=api;
  if(root)root.DigiDomainBridge=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(B,C,T){
  'use strict';
  if(!B||!C||!T)throw Error('Existing battle, care and championship modules must load first');
  const clone=x=>JSON.parse(JSON.stringify(x));
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const skill=Object.freeze({cost:24});
  const tactics=Object.freeze(Object.entries(B.TACTICS).map(([id,v])=>
    Object.freeze({id,name:v.name})));
  function fighter(name,side,sp=35){
    const base={name,side,x:side==='ally'?0:80,y:0,atk:35,def:20,spd:sp,
      hp:100,max:100,energy:100,skillCD:0,cd:0};
    return {...base,...B.fighterVitals({...base,maxTp:75,tp:75})};
  }
  function newEncounter(tacticId='balanced'){
    if(!B.TACTICS[tacticId])throw Error('Unknown tactic');
    return {turn:0,tactic:tacticId,ally:fighter('테이머','ally'),
      enemy:fighter('상대','enemy'),winner:null,log:[]};
  }
  // Every event is planned by existing target(), canUseSkill() and skillCost().
  function plan(state){
    if(!state||state.winner||!Number.isSafeInteger(state.turn)||state.turn<0)return null;
    const side=state.turn%2===0?'ally':'enemy',other=side==='ally'?'enemy':'ally';
    const actor=state[side],target=B.target(actor,[state[other]],
      side==='ally'?state.tactic:'balanced');
    if(!target||actor.hp<=0)return null;
    const tacticId=side==='ally'?state.tactic:'balanced';
    const special=B.canUseSkill(actor,skill,tacticId);
    const action=special?'skill':'normal';
    // PROTOTYPE numbers only. Full original damage comes from embedded legacy arena,
    // not src/battle-core.js; never pretend these values are ROM verified.
    const damage=special?36:18;
    return Object.freeze({turn:state.turn,side,other,target:target.name,
      action,damage,cost:special?B.skillCost(actor,skill):0});
  }
  function apply(state,event){
    const expected=plan(state);
    if(!expected||!event||Object.keys(expected).some(k=>event[k]!==expected[k]))
      throw Error('Stale/invalid combat event');
    const s=clone(state);
    const actor=s[expected.side],target=s[expected.other];
    if(expected.action==='skill'&&!B.spendTP(actor,skill))throw Error('TP underflow');
    target.hp=clamp(target.hp-expected.damage,0,target.max);
    B.regainTP(target,6); // illustrative feedback; not original battle formula
    s.turn+=1;
    if(target.hp===0)s.winner=expected.side;
    s.log=[{...expected,remainingHp:target.hp,remainingTp:target.tp},...s.log].slice(0,20);
    return s;
  }
  function train(day,current=10,base=1){
    if(!Number.isFinite(current)||!Number.isFinite(base)||base<=0)throw Error('Invalid gain input');
    const gained=C.statGain(day,base);
    return Object.freeze({season:C.season(day),day,gained,
      next:clamp(Math.floor(current+gained),0,9999),
      provenance:'existing-care-core (season coefficients provisional)'});
  }
  function cupPreview(input){
    // Existing requirements() calls ensure(), which mutates; never mutate caller's save.
    const s=clone(input);
    return T.CUPS.map(cup=>({
      id:cup.id,name:cup.name,needed:cup.size,
      missing:T.requirements(s,cup),available:T.requirements(s,cup).length===0
    }));
  }
  function previewSample(){
    return {day:1,wins:0,points:0,facilityCredits:100,team:[{
      name:'테이머',hp:100,maxHp:100,egg:false,lost:false,location:'farm'}]};
  }
  function inspectExport(input){
    if(!input||typeof input!=='object'||Array.isArray(input))
      throw Error('세이브 JSON 객체가 아니야.');
    if(input.format!=null&&(input.format!=='digicham-save'||input.exportVersion!==1))
      throw Error('지원하지 않는 세이브 형식이야.');
    const raw=input.format==='digicham-save'?input.state:input;
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.pendingBattle||
       !Number.isSafeInteger(raw.day)||raw.day<1||raw.day>100000||
       !Array.isArray(raw.team)||raw.team.length<1||raw.team.length>50)
      throw Error('잘못된 세이브이거나 전투 중인 데이터야.');
    // Strictly pick a small allowlist of values; no references or mutations.
    const safeNumber=(v,fallback=0)=>Number.isFinite(v)?clamp(v,0,999999):fallback;
    const team=raw.team.map(m=>{
      if(!m||typeof m!=='object'||typeof m.name!=='string'||!m.name||
         m.name.length>120||!Number.isFinite(m.hp)||!Number.isFinite(m.maxHp)||
         m.maxHp<=0)throw Error('디지몬 기록이 올바르지 않아.');
      return {name:m.name,hp:clamp(m.hp,0,m.maxHp),maxHp:m.maxHp,
        atk:safeNumber(m.atk),def:safeNumber(m.def),spd:safeNumber(m.spd),
        tp:safeNumber(m.tp),maxTp:safeNumber(m.maxTp),
        egg:!!m.egg,lost:!!m.lost,
        location:m.location==='storage'?'storage':'farm'};
    });
    const crowns={};
    for(const id of T.CUPS.map(cup=>cup.id)){
      const count=raw.championship?.crowns?.[id];
      if(Number.isSafeInteger(count)&&count>=0)crowns[id]=count;
    }
    return {day:raw.day,wins:safeNumber(raw.wins),points:safeNumber(raw.points),
      facilityCredits:safeNumber(raw.facilityCredits),team,
      championship:{active:null,crowns,history:[],sequence:0,rank:0,lastResult:null},
      source:'read-only-save-preview'};
  }
  return Object.freeze({tactics,newEncounter,plan,apply,train,cupPreview,
    previewSample,inspectExport});
});
