"""Idempotent (guarded) bundling of v0.23.1 tournament-only changes.

The guarded edits avoid touching the farm module and can be reapplied to a
new base when Codex's movement branch is available.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
CORE=(ROOT/'src/championship-core.js').read_text()
STYLE='''
/* v0.23.1 — bracket cards scroll horizontally on narrow devices */
.championshipBracketGrid{display:flex;gap:10px;overflow-x:auto;overscroll-behavior-x:contain;padding:8px 0 12px;scrollbar-width:thin}
.championshipBracketRound{flex:0 0 min(205px,72vw);display:flex;flex-direction:column;gap:8px}
.championshipBracketRound h4{font-size:12px;color:#a8d6e6;margin:0 0 4px}
.championshipFixture{padding:9px;border:1px solid #526c7d;border-radius:8px;background:#152536;font-size:12px;min-height:65px}
.championshipFixture .championshipSlot{display:block;overflow-wrap:anywhere;margin:2px 0}
.championshipFixture .winner{color:#83efc7;font-weight:bold}
.championshipFixture .waiting{color:#f5c48a}
.championshipFixture .npcResult{color:#a2bfd0}
#championshipHistory .championshipRecent{border-top:1px solid #3d566d;padding-top:8px;margin-top:8px}
#championshipTrophies{margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;font-size:12px}
#championshipTrophies span{border:1px solid #526c7d;border-radius:7px;padding:6px}
'''
UI=r'''<script id="championship-ui-v023">
(()=>{
 'use strict';const C=DCChampionship,$=id=>document.getElementById(id);
 const label=['도전자','신인 챔피언','지역 챔피언','그랜드 챔피언'];
 const names=['8강','4강','결승'];
 function bracketHtml(br){if(!br)return '';
  return `<div class="championshipBracketGrid" role="group" aria-label="전체 대진표">${br.rounds.map((matches,r)=>{
   const title=br.rounds.length===3?(r===0?'8강':r===1?'4강':'결승'):(r===0?'4강':'결승');
   return `<div class="championshipBracketRound"><h4>${title}</h4>${matches.map(m=>{
    const participants=m.slots.map(id=>br.participants.find(p=>p.id===id));
    return `<div class="championshipFixture" aria-label="${title} 대진">${participants.map((p,i)=>{
     const value=p?esc(p.trainer)+' · '+p.team.map(esc).join(' / '):'대기 중';
     return `<span class="championshipSlot ${p?.id===m.winner?'winner':''} ${p?'':'waiting'}">${m.winner===p?.id&&p?'🏅 ':''}${value}</span>`;
    }).join('')}<span class="${m.source==='npc-sim'?'npcResult':'waiting'}">${m.source==='npc-sim'?'NPC 경기 결과':m.winner?'경기 종료':'진행 대기'}</span></div>`;
   }).join('')}</div>`;
  }).join('')}</div>`;
 }
 function renderChampionship(){const s=state,c=C.ensure(s);$('championshipRank').textContent=label[c.rank]||label[0];
  $('championshipCalendar').innerHTML=C.CUPS.map(def=>{
   const blocks=C.requirements(s,def),next=C.nextDay(def,s.day),crowned=c.crowns[def.id]||0;
   return `<div class="championshipCup"><h3>${esc(def.name)}</h3><p>DAY ${next} · ${def.period}일 주기 · ${def.size} vs ${def.size}</p><p>${def.teams}팀 · ${def.rounds}라운드 · 우승 상금 ${def.prize} 시설 Bit · 포인트 +${def.points}</p><p class="champ-win">🏅 우승 ${crowned}회</p>${blocks.length?`<p class="champ-lock">🔒 ${blocks.map(esc).join(' · ')}</p>`:`<p class="champ-win">✓ 참가 가능</p>`}<button data-cup="${def.id}" ${blocks.length?'disabled':''}>${blocks.length?'참가 조건 미달':'🏆 대회 참가'}</button></div>`;
  }).join('');
  $('championshipTrophies').innerHTML=C.CUPS.map(def=>`<span>🏆 ${esc(def.name)} × ${c.crowns[def.id]||0}</span>`).join('');
  const a=c.active,br=C.bracketFor(s),match=a?C.nextMatch(s):null;
  $('championshipBracket').innerHTML=(a?`<b>현재 대진: ${esc(C.get(a.cupId).name)}</b><p>${a.round===0?(br?.rounds.length===3?'8강':'준결승'):a.round===br?.rounds.length-1?'결승':'준결승'} · 상대 테이머 ${esc(match?.trainer||'경기 준비 중')} · ${esc(match?.opponentTeam?.join(' / ')||'')} · 실제 자동 전투 판정</p><button id="championshipFight" class="primary" ${a.awaiting?'disabled':''}>${a.awaiting?'전투 진행 중':'⚔ 다음 경기 출전'}</button>`:
   (br?'<b>마지막 대회 대진표</b>':'진행 중인 대회가 없어. 일정과 참가 조건을 확인해 줘.'))+bracketHtml(br);
  $('championshipHistory').innerHTML=(c.history.length?'<b>최근 대회 기록</b>'+c.history.slice(0,4).map(h=>`<p>DAY ${Number(h.day)||1} · ${esc(h.cup)} · ${h.won?'🏆 우승':'패배'} ${h.won?'+'+h.prize+' Bit':''}</p>`).join(''):'')+
   (c.matchHistory.length?'<div class="championshipRecent"><b>경기별 전적</b>'+c.matchHistory.slice(0,6).map(h=>`<p>DAY ${Number(h.day)||1} · ${esc(C.get(h.cupId)?.name||'대회')} ${Number(h.round)+1}차전 · ${esc(h.trainer||'상대 테이머')} (${(h.opponent||[]).map(esc).join(' / ')}) · ${h.won?'승리':'패배'}</p>`).join('')+'</div>':'');
 }
 $('championshipCalendar').addEventListener('click',e=>{const btn=e.target.closest('[data-cup]');if(!btn)return;const result=C.enter(state,btn.dataset.cup);if(!result.ok){toast(result.missing.join(' · '));return;}say(C.get(result.active.cupId).name+' 참가!');renderChampionship();save(false);});
 $('championshipBracket').addEventListener('click',e=>{if(!e.target.closest('#championshipFight'))return;const match=C.nextMatch(state);if(!match)return;
  const r=C.beginMatch(state,match.matchId);if(!r.ok){toast(r.reason);return;}
  save(false);renderChampionship();const ok=window.DCBattleArena?.launchTournament(match);
  if(!ok){C.cancelUnstarted(state,match.matchId);save(false);renderChampionship();}
 });
 window.DCChampionshipUI={render:renderChampionship};
 const originalRender=render;render=function(){originalRender();renderChampionship()};
 $('reset').addEventListener('click',()=>queueMicrotask(()=>renderChampionship()));
 $('hexArchiveFile')?.addEventListener('change',()=>queueMicrotask(()=>renderChampionship()));
 renderChampionship();
})();
</script>'''
for name in ('index.html','standalone.html'):
 p=ROOT/name;html=p.read_text()
 # On Codex branch this tool is intended to be rerun on a clean HTML base.
 if 'v0.23.1 — bracket cards' in html:print('skip already patched',name);continue
 head='<script id="championship-core-v023">';foot='</script>'
 start=html.index(head);end=html.index(foot,start)+len(foot)
 html=html[:start]+head+'\n'+CORE+'\n'+foot+html[end:]
 old_ui='<script id="championship-ui-v023">'
 start=html.index(old_ui);end=html.index('</script>',start)+len('</script>')
 html=html[:start]+UI+html[end:]
 style_start=html.index('<style id="championshipStyle">')
 style_end=html.index('</style>',style_start)
 html=html[:style_end]+STYLE+html[style_end:]
 old='<div id="championshipCalendar" class="championshipCalendar"></div>'
 assert html.count(old)==1,name
 html=html.replace(old,old+'<div id="championshipTrophies" aria-label="우승 트로피"></div>')
 # Inject explicit opposing Digimon without changing ordinary sandbox battles.
 old="  fighters=[...me.map((n,i)=>fighter(n,0,i,count)),...other.map((n,i)=>fighter(n,1,i,count))];"
 new="  if(tournamentMatch?.opponentTeam?.length)other.splice(0,other.length,...tournamentMatch.opponentTeam.slice(0,count));\n"+old
 assert html.count(old)==1,(name,'enemy roster integration location changed')
 html=html.replace(old,new)
 old="  if(result.ok){if(result.complete&&result.won)say('🏆 '+result.result.cup+' 우승! 상금 '+result.prize+' 시설 Bit를 받았어.');"
 assert html.count(old)==1,(name,'battle result integration location changed')
 # A general progression message supports quarterfinal -> semifinal as well as final.
 html=html.replace("else say('준결승 승리! 결승 진출. 체력과 TP를 회복하고 다음 경기에 출전해.');","else say('대회 다음 라운드 진출! 체력과 TP를 회복하고 다음 경기에 출전해.');")
 p.write_text(html)
 print('patched',name,len(html))
