/* v0.23 Championship calendar & brackets — playable extension, not decoded ROM tournament rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DCChampionship=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const CUPS=Object.freeze([
  {id:'novice',name:'신인 테이머 컵',day:1,period:7,size:1,wins:0,prerequisite:null,prize:260,points:4,opponents:['고부리몬','아구몬'],title:'신인 우승자'},
  {id:'regional',name:'지역 챔피언 컵',day:5,period:7,size:2,wins:2,prerequisite:'novice',prize:650,points:9,opponents:['가부몬','그레이몬'],title:'지역 챔피언'},
  {id:'grand',name:'월드 챌린지 컵',day:10,period:10,size:3,wins:5,prerequisite:'regional',prize:1400,points:16,opponents:['메탈그레이몬','워그레이몬'],title:'그랜드 챔피언'}
 ]);
 const get=id=>CUPS.find(c=>c.id===id)||null;
 const base=()=>({active:null,crowns:{},history:[],sequence:0,rank:0,lastResult:null});
 function ensure(s){if(!s.championship||typeof s.championship!=='object')s.championship=base();const c=s.championship;
  if(!c.crowns||typeof c.crowns!=='object')c.crowns={};if(!Array.isArray(c.history))c.history=[];
  c.sequence=Number.isSafeInteger(c.sequence)&&c.sequence>=0?c.sequence:0;
  c.rank=CUPS.reduce((n,cup,i)=>c.crowns[cup.id]?Math.max(n,i+1):n,0);
  if(c.active&&(!get(c.active.cupId)||!Number.isInteger(c.active.round)||c.active.round<0||c.active.round>1))c.active=null;
  return c;
 }
 const stageRank={'유년기 I':0,'유년기 II':0,'성장기':1,'성숙기':2,'완전체':3,'궁극체':4};
 function eligible(s){return (s.team||[]).filter(m=>m&&m.hp>0&&!m.egg&&!m.lost&&m.location!=='storage');}
 function nextDay(c,day){const now=Math.max(1,Math.floor(Number(day)||1));return now<=c.day?c.day:c.day+Math.ceil((now-c.day)/c.period)*c.period;}
 function requirements(s,cup){const cupDef=typeof cup==='string'?get(cup):cup;if(!cupDef)return ['존재하지 않는 대회'];
  const ch=ensure(s),out=[];
  if(ch.active)out.push('다른 대회 진행 중');
  if((s.wins||0)<cupDef.wins)out.push('일반·대회 전투 '+cupDef.wins+'승 필요');
  if(cupDef.prerequisite&&!ch.crowns[cupDef.prerequisite])out.push(get(cupDef.prerequisite).name+' 우승 필요');
  const next=nextDay(cupDef,s.day);if(Number(s.day)!==next)out.push('DAY '+next+' 개최');
  const roster=eligible(s);if(roster.length<cupDef.size)out.push('출전 가능 '+cupDef.size+'마리 필요');
  return out;
 }
 function enter(s,id){const def=get(id);const missing=requirements(s,def);if(missing.length)return {ok:false,missing};
  const c=ensure(s);const serial=++c.sequence;c.active={id:'cup-'+serial,cupId:id,round:0,startedDay:Number(s.day)||1,awaiting:null};return {ok:true,active:c.active};}
 function nextMatch(s){const a=ensure(s).active;if(!a||a.awaiting)return null;const cup=get(a.cupId);return {cupId:a.cupId,round:a.round,matchId:a.id+'-round-'+a.round,opponent:cup.opponents[a.round],size:cup.size,name:cup.name};}
 function beginMatch(s,matchId){const match=nextMatch(s);if(!match||match.matchId!==matchId)return {ok:false,reason:'대진이 일치하지 않아.'};
  if(eligible(s).length<match.size)return {ok:false,reason:'회복한 디지몬 '+match.size+'마리가 필요해.'};
  ensure(s).active.awaiting=match.matchId;return {ok:true,match};}
 function cancelUnstarted(s,matchId){const a=ensure(s).active;if(a&&a.awaiting===matchId)a.awaiting=null;}
 function finishMatch(s,matchId,won){const c=ensure(s),a=c.active;if(!a||a.awaiting!==matchId)return {ok:false,reason:'이미 정산한 경기 또는 다른 경기야.'};
  const matchIdExpected=a.id+'-round-'+a.round;if(matchId!==matchIdExpected)return {ok:false,reason:'대진 불일치'};
  const def=get(a.cupId);a.awaiting=null;
  if(!won){const result={cupId:a.cupId,cup:def.name,day:s.day,won:false,round:a.round,prize:0};c.history.unshift(result);c.history=c.history.slice(0,24);c.lastResult=result;c.active=null;return {ok:true,complete:true,won:false,result};}
  a.round++;
  if(a.round<2)return {ok:true,complete:false,won:true,round:a.round};
  const result={cupId:a.cupId,cup:def.name,day:s.day,won:true,round:1,prize:def.prize};
  c.crowns[a.cupId]=(c.crowns[a.cupId]||0)+1;c.rank=CUPS.reduce((n,cup,i)=>c.crowns[cup.id]?Math.max(n,i+1):n,0);
  s.facilityCredits=Math.max(0,Number(s.facilityCredits)||0)+def.prize;
  s.points=Math.max(0,Number(s.points)||0)+def.points;
  c.history.unshift(result);c.history=c.history.slice(0,24);c.lastResult=result;c.active=null;
  return {ok:true,complete:true,won:true,result,prize:def.prize,rank:c.rank};
 }
 function interrupted(s,pendingBattle){const a=ensure(s).active;if(!a||!a.awaiting)return false;
  // Only a truly started tournament fight should forfeit after a reload/crash.
  if(!pendingBattle||pendingBattle.tournamentMatchId!==a.awaiting){a.awaiting=null;return false;}
  return finishMatch(s,a.awaiting,false).ok;
 }
 return Object.freeze({CUPS,get,ensure,eligible,nextDay,requirements,enter,nextMatch,beginMatch,cancelUnstarted,finishMatch,interrupted});
});
