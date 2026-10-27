/* v0.23.1 Championship bracket engine. NPCs and schedules are EXPANSION PLACEHOLDERS, not ROM verified. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DCChampionship=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 // Seed order is stable so that a saved tournament's matchups never change after reloading.
 // Each non-player participant has one trainer and an explicit team; no repeated-species filler.
 const ROSTERS=Object.freeze({
  novice:[
   {id:'novice-gobu',trainer:'숲의 테이머',team:['고부리몬'],power:10},
   {id:'novice-agu',trainer:'붉은 모자 테이머',team:['아구몬'],power:18},
   {id:'novice-tenta',trainer:'곤충 연구가',team:['텐타몬'],power:12}
  ],
  regional:[
   {id:'regional-gabu',trainer:'설원의 테이머',team:['가부몬','텐타몬'],power:24},
   {id:'regional-grey',trainer:'화염 조련사',team:['그레이몬','가루몬'],power:34},
   {id:'regional-devi',trainer:'어둠 연구가',team:['데블몬','엔젤몬'],power:28}
  ],
  grand:[
   {id:'grand-metalgrey',trainer:'강철 테이머',team:['메탈그레이몬','가루몬','안드로몬'],power:48},
   {id:'grand-wargrey',trainer:'용기의 도전자',team:['워그레이몬','메탈가루몬','엔젤몬'],power:72},
   {id:'grand-dark',trainer:'암흑 전략가',team:['스컬그레이몬','데블몬','레이디데블몬'],power:52},
   {id:'grand-speed',trainer:'질풍 테이머',team:['워가루몬','가부몬','피요몬'],power:53},
   {id:'grand-cyborg',trainer:'기계 연구가',team:['사이버드라몬','안드로몬','메탈그레이몬'],power:57},
   {id:'grand-wild',trainer:'황야의 테이머',team:['다크티라노몬','베지몬','텐타몬'],power:44},
   {id:'grand-legend',trainer:'정상급 도전자',team:['메탈가루몬','워그레이몬','그레이몬'],power:64}
  ]
 });
 const CUPS=Object.freeze([
  {id:'novice',name:'신인 테이머 컵',day:1,period:7,size:1,wins:0,prerequisite:null,prize:260,points:4,teams:4,rounds:2,opponents:['고부리몬','아구몬'],title:'신인 우승자'},
  {id:'regional',name:'지역 챔피언 컵',day:5,period:7,size:2,wins:2,prerequisite:'novice',prize:650,points:9,teams:4,rounds:2,opponents:['가부몬','그레이몬'],title:'지역 챔피언'},
  {id:'grand',name:'월드 챌린지 컵',day:10,period:10,size:3,wins:5,prerequisite:'regional',prize:1400,points:16,teams:8,rounds:3,opponents:['메탈그레이몬','워그레이몬'],title:'그랜드 챔피언'}
 ]);
 const get=id=>CUPS.find(c=>c.id===id)||null;
 const base=()=>({active:null,crowns:{},history:[],matchHistory:[],sequence:0,rank:0,lastResult:null});
 function ensure(s){if(!s.championship||typeof s.championship!=='object')s.championship=base();const c=s.championship;
  if(!c.crowns||typeof c.crowns!=='object')c.crowns={};if(!Array.isArray(c.history))c.history=[];
  if(!Array.isArray(c.matchHistory))c.matchHistory=[];
  c.sequence=Number.isSafeInteger(c.sequence)&&c.sequence>=0?c.sequence:0;
  c.rank=CUPS.reduce((n,cup,i)=>c.crowns[cup.id]?Math.max(n,i+1):n,0);
  if(c.active&&(!get(c.active.cupId)||!Number.isInteger(c.active.round)||c.active.round<0||c.active.round>=(c.active.bracket?get(c.active.cupId).rounds:2)))c.active=null;
  return c;
 }
 function eligible(s){return (s.team||[]).filter(m=>m&&m.hp>0&&!m.egg&&!m.lost&&m.location!=='storage');}
 function nextDay(c,day){const now=Math.max(1,Math.floor(Number(day)||1));return now<=c.day?c.day:c.day+Math.ceil((now-c.day)/c.period)*c.period;}
 function requirements(s,cup){const cupDef=typeof cup==='string'?get(cup):cup;if(!cupDef)return ['존재하지 않는 대회'];
  const ch=ensure(s),out=[];
  if(ch.active)out.push('다른 대회 진행 중');
  if((s.wins||0)<cupDef.wins)out.push('일반·대회 전투 '+cupDef.wins+'승 필요');
  if(cupDef.prerequisite&&!ch.crowns[cupDef.prerequisite])out.push(get(cupDef.prerequisite).name+' 우승 필요');
  const next=nextDay(cupDef,s.day);if(Number(s.day)!==next)out.push('DAY '+next+' 개최');
  if(eligible(s).length<cupDef.size)out.push('출전 가능 '+cupDef.size+'마리 필요');
  return out;
 }
 function participant(bracket,id){return bracket?.participants.find(p=>p.id===id)||null;}
 function winnerOf(bracket,a,b){const aa=participant(bracket,a),bb=participant(bracket,b);if(!aa||!bb||a==='player'||b==='player')return null;return aa.power>=bb.power?a:b;}
 // Only auto-resolve NPC-vs-NPC matches. A player battle is never simulated or rewarded here.
 function propagate(bracket){let changed=true;
  while(changed){changed=false;
   for(let r=0;r<bracket.rounds.length;r++)for(let i=0;i<bracket.rounds[r].length;i++){
    const m=bracket.rounds[r][i];
    if(!m.winner&&m.slots[0]&&m.slots[1]){const npc=winnerOf(bracket,m.slots[0],m.slots[1]);if(npc){m.winner=npc;m.source='npc-sim';changed=true;}}
    if(m.winner&&r+1<bracket.rounds.length){const target=bracket.rounds[r+1][Math.floor(i/2)];const slot=i%2;
     if(!target.slots[slot]){target.slots[slot]=m.winner;changed=true;}
    }
   }
  }
 }
 function makeBracket(def,s,serial){const seeded=ROSTERS[def.id]||[];const playerNames=eligible(s).slice(0,def.size).map(m=>m.name);
  const participants=[{id:'player',trainer:'내 팀',team:playerNames,power:0},...seeded.map(p=>({id:p.id,trainer:p.trainer,team:p.team.slice(),power:p.power}))];
  if(participants.length!==def.teams)throw Error('대회 참가자 수가 맞지 않음: '+def.id);
  const rounds=[];for(let r=0;r<def.rounds;r++){const matches=[];for(let i=0;i<def.teams/(2**(r+1));i++){
   matches.push({id:'cup-'+serial+'-br-'+r+'-'+i,slots:r===0?[participants[2*i].id,participants[2*i+1].id]:[null,null],winner:null,source:null});
  }rounds.push(matches);}
  const bracket={teams:def.teams,participants,rounds,provenance:'temporary_balance'};propagate(bracket);return bracket;
 }
 function enter(s,id){const def=get(id);const missing=requirements(s,def);if(missing.length)return {ok:false,missing};
  const c=ensure(s);const serial=++c.sequence;c.active={id:'cup-'+serial,cupId:id,round:0,startedDay:Number(s.day)||1,awaiting:null,bracket:makeBracket(def,s,serial)};return {ok:true,active:c.active};}
 function nextMatch(s){const a=ensure(s).active;if(!a||a.awaiting)return null;const cup=get(a.cupId);
  const m=a.bracket?.rounds[a.round]?.[0];const foe=m?participant(a.bracket,m.slots.find(id=>id&&id!=='player')):null;
  if(a.bracket&&(!m||m.winner||!m.slots.includes('player')||!foe))return null;
  return {cupId:a.cupId,round:a.round,matchId:a.id+'-round-'+a.round,opponent:foe?.team[0]||cup.opponents[a.round],opponentTeam:foe?.team.slice()||[cup.opponents[a.round]],trainer:foe?.trainer||'상대 테이머',size:cup.size,name:cup.name,rounds:a.bracket?.rounds.length||2};
 }
 function beginMatch(s,matchId){const match=nextMatch(s);if(!match||match.matchId!==matchId)return {ok:false,reason:'대진이 일치하지 않아.'};
  if(eligible(s).length<match.size)return {ok:false,reason:'회복한 디지몬 '+match.size+'마리가 필요해.'};
  ensure(s).active.awaiting=match.matchId;return {ok:true,match};}
 function cancelUnstarted(s,matchId){const a=ensure(s).active;if(a&&a.awaiting===matchId)a.awaiting=null;}
 function finishMatch(s,matchId,won){const c=ensure(s),a=c.active;if(!a||a.awaiting!==matchId)return {ok:false,reason:'이미 정산한 경기 또는 다른 경기야.'};
  const matchIdExpected=a.id+'-round-'+a.round;if(matchId!==matchIdExpected)return {ok:false,reason:'대진 불일치'};
  const def=get(a.cupId),round=a.round,br=a.bracket,m=br?.rounds[round]?.[0];
  const foe=m?participant(br,m.slots.find(id=>id&&id!=='player')):null;
  a.awaiting=null;
  if(m){m.winner=won?'player':foe?.id||null;m.source='battle';propagate(br);}
  c.matchHistory.unshift({matchId,cupId:a.cupId,day:s.day,round,won:!!won,trainer:foe?.trainer||'상대 테이머',opponent:foe?.team.slice()||[def.opponents[round]]});c.matchHistory=c.matchHistory.slice(0,80);
  if(!won){const result={cupId:a.cupId,cup:def.name,day:s.day,won:false,round,prize:0,...(br?{bracket:br}:{})};
   c.history.unshift(result);c.history=c.history.slice(0,24);c.lastResult=result;c.active=null;return {ok:true,complete:true,won:false,result};}
  a.round++;
  if(a.round<(br?def.rounds:2))return {ok:true,complete:false,won:true,round:a.round};
  const result={cupId:a.cupId,cup:def.name,day:s.day,won:true,round,prize:def.prize,...(br?{bracket:br}:{})};
  c.crowns[a.cupId]=(c.crowns[a.cupId]||0)+1;c.rank=CUPS.reduce((n,cup,i)=>c.crowns[cup.id]?Math.max(n,i+1):n,0);
  s.facilityCredits=Math.max(0,Number(s.facilityCredits)||0)+def.prize;
  s.points=Math.max(0,Number(s.points)||0)+def.points;
  c.history.unshift(result);c.history=c.history.slice(0,24);c.lastResult=result;c.active=null;
  return {ok:true,complete:true,won:true,result,prize:def.prize,rank:c.rank};
 }
 function interrupted(s,pendingBattle){const a=ensure(s).active;if(!a||!a.awaiting)return false;
  if(!pendingBattle||pendingBattle.tournamentMatchId!==a.awaiting){a.awaiting=null;return false;}
  return finishMatch(s,a.awaiting,false).ok;
 }
 function bracketFor(s){const c=ensure(s);return c.active?.bracket||c.lastResult?.bracket||null;}
 return Object.freeze({CUPS,ROSTERS,get,ensure,eligible,nextDay,requirements,enter,nextMatch,beginMatch,cancelUnstarted,finishMatch,interrupted,bracketFor});
});

