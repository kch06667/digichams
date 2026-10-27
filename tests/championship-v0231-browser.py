"""Browser integration: 8-team tournament, 3 actual battle settlements, trophy and save.
Asset/media blobs are stubbed to reduce startup cost; state and battle scripts remain intact.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re, json
ROOT=Path(__file__).resolve().parents[1]
ANCHOR=" window.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.style.display==='block')close()});reset();"
HOOK="window.__battleTest={reset,update,fighters:()=>fighters,renderTeams};"
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for name in ('index.html','standalone.html'):
  page=browser.new_page(viewport={'width':390 if name=='standalone.html' else 1200,'height':790});page.set_default_timeout(12000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   src=(ROOT/name).read_text()
   assert src.count(ANCHOR)==1
   for var,val in [('EXTRA_SPRITE_FRAMES','{}'),('ROM_ASSETS','[]'),('SPRITE_FRAMES',"{'코로몬':['R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=']}"),('ANIMATION_SHEETS','{}'),('ROM_ARENA_IMAGES',"{grass:'',orange:'',stone:'',ring:''}"),('ROM_BATTLE_HUD',"''")]:
    src=re.sub(r'(^\s*const '+var+r'=)[^\n]*',lambda m:m.group(1)+val+';',src,count=1,flags=re.M)
   src=src.replace(ANCHOR,HOOK+ANCHOR)
   mock="<script>window.__savedData={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return window.__savedData[k]||null},setItem(k,v){window.__savedData[k]=String(v)},removeItem(k){delete window.__savedData[k]}}});</script>"
   src=src.replace('<script',mock+'<script',1)
   page.set_content(src,wait_until='domcontentloaded',timeout=28000)
   result=page.evaluate('''() => {
    state.team=['아구몬','가부몬','그레이몬'].map(makeMon);state.team.forEach(m=>{m.hp=m.maxHp;m.maxTp=50;m.tp=50});
    state.day=10;state.wins=6;state.facilityCredits=0;state.points=0;
    state.championship={crowns:{novice:1,regional:1},history:[],matchHistory:[],sequence:0,rank:2};render();
    document.querySelector('[data-cup="grand"]').click();
    const bracket=state.championship.active.bracket;
    const early={rounds:bracket.rounds.map(r=>r.length),participants:bracket.participants.length,visibleMatches:document.querySelectorAll('.championshipFixture').length,scroll:!!document.querySelector('.championshipBracketGrid')};
    const battles=[];
    for(let r=0;r<3;r++){
     state.team.forEach(m=>{m.hp=m.maxHp;m.tp=m.maxTp||50});render();
     const match=DCChampionship.nextMatch(state);document.querySelector('#championshipFight').click();
     const enemyFighters=__battleTest.fighters().filter(f=>f.side===1).map(f=>f.name);
     const expected=match.opponentTeam;const pending=state.pendingBattle?.tournamentMatchId;
     __battleTest.fighters().filter(f=>f.side===1).forEach(f=>f.hp=0);__battleTest.update(.016);__battleTest.update(.016);
     battles.push({round:r,trainer:match.trainer,enemyFighters,expected,pending,after:state.championship.active?.round??null});
     document.querySelector('#lbClose').click();
    }
    const final={credits:state.facilityCredits,rank:state.championship.rank,crown:state.championship.crowns.grand,history:state.championship.history.length,matchHistory:state.championship.matchHistory.length,bracketDisplay:document.querySelectorAll('.championshipFixture').length,trophy:document.querySelector('#championshipTrophies').textContent,lastWinner:state.championship.lastResult.bracket.rounds[2][0].winner,save:JSON.parse(localStorage.getItem('dc_recreation_save')).championship.crowns.grand};
    return {early,battles,final};
   }''')
   assert result['early']['rounds']==[4,2,1] and result['early']['participants']==8 and result['early']['visibleMatches']==7,result
   assert result['early']['scroll'],result
   assert len(result['battles'])==3 and len({r['trainer'] for r in result['battles']})==3,result
   assert all(x['enemyFighters']==x['expected'] and x['pending'] and x['round']==i for i,x in enumerate(result['battles'])),result
   f=result['final'];assert f['credits']==1400 and f['rank']==3 and f['crown']==1 and f['history']==1 and f['matchHistory']==3,result
   assert f['bracketDisplay']==7 and f['lastWinner']=='player' and f['save']==1 and '월드 챌린지 컵' in f['trophy'],result
   assert not errors,errors[:4]
   results.append({'html':name,'status':'PASS','result':result})
  except Exception as e:results.append({'html':name,'status':'FAIL','error':str(e)[:2000],'pageErrors':errors[:5]})
  finally:page.close()
 browser.close()
(ROOT/'tests/championship-v0231-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
assert all(r['status']=='PASS' for r in results),results
