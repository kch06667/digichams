"""Lightweight real Chromium integration; strips large media blobs, not gameplay/UI scripts."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re,json
ROOT=Path(__file__).resolve().parents[1]
ANCHOR=" window.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.style.display==='block')close()});reset();"
HOOK="window.__battleTest={reset,update,beginSkill,fighters:()=>fighters,skillInfo,renderTeams,settleMatch};"
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for name in ('index.html','standalone.html'):
  page=browser.new_page(viewport={'width':390 if name=='standalone.html' else 1200,'height':790})
  page.set_default_timeout(9000); errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  try:
   src=(ROOT/name).read_text();assert src.count(ANCHOR)==1
   for var,val in [('EXTRA_SPRITE_FRAMES','{}'),('ROM_ASSETS','[]'),('SPRITE_FRAMES',"{'코로몬':['R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=']}"),('ANIMATION_SHEETS','{}'),('ROM_ARENA_IMAGES',"{grass:'',orange:'',stone:'',ring:''}"),('ROM_BATTLE_HUD',"''")]:
    src=re.sub(r'(^\s*const '+var+r'=)[^\n]*',lambda m:m.group(1)+val+';',src,count=1,flags=re.M)
   src=src.replace(ANCHOR,HOOK+ANCHOR)
   mock="""<script>window.__savedData={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return Object.prototype.hasOwnProperty.call(window.__savedData,k)?window.__savedData[k]:null},setItem(k,v){window.__savedData[k]=String(v)},removeItem(k){delete window.__savedData[k]}}});</script>"""
   src=src.replace('<script',mock+'<script',1)
   page.set_content(src,wait_until='domcontentloaded',timeout=25000)
   result=page.evaluate('''() => {
     state.team=[makeMon('아구몬')];state.team[0].hp=state.team[0].maxHp;state.facilityCredits=0;state.points=0;state.wins=0;state.day=1;state.championship=null;render();
     const before={cups:document.querySelectorAll('.championshipCup').length,locked:Array.from(document.querySelectorAll('[data-cup]')).filter(b=>b.disabled).length};
     document.querySelector('[data-cup="novice"]').click();
     const bracket={active:state.championship.active?.cupId,round:state.championship.active?.round,button:!!document.getElementById('championshipFight')};
     document.querySelector('#championshipFight').click();
     const first={pending:state.pendingBattle?.tournamentMatchId,opponent:document.querySelector('#lbEnemy').value,mode:document.querySelector('#lbMode').value,scale:document.querySelector('#lbTeamSize').value};
     __battleTest.fighters().filter(f=>f.side===1).forEach(f=>f.hp=0);__battleTest.update(.016);__battleTest.update(.016);
     const semifinal={active:state.championship.active?.cupId,round:state.championship.active?.round,crowns:state.championship.crowns.novice||0,credits:state.facilityCredits};
     document.querySelector('#lbClose').click();
     document.querySelector('#championshipFight').click();
     const final={opponent:document.querySelector('#lbEnemy').value,pending:!!state.pendingBattle};
     __battleTest.fighters().filter(f=>f.side===1).forEach(f=>f.hp=0);__battleTest.update(.016);__battleTest.update(.016);
     const end={active:state.championship.active,crowns:state.championship.crowns.novice,rank:state.championship.rank,credits:state.facilityCredits,points:state.points,history:state.championship.history.length,wins:state.wins,pending:!!state.pendingBattle,rankUI:document.querySelector('#championshipRank').textContent,localStored:JSON.parse(localStorage.getItem('dc_recreation_save')).championship?.crowns?.novice};
     __battleTest.update(.016);const duplicate={credits:state.facilityCredits,history:state.championship.history.length};
     return {before,bracket,first,semifinal,final,end,duplicate};
   }''')
   assert result['before']['cups']==3 and result['before']['locked']==2,result
   assert result['bracket']['active']=='novice' and result['bracket']['round']==0,result
   assert result['first']['pending'] and result['first']['mode']=='owned' and result['first']['scale']=='1',result
   assert result['semifinal']['round']==1 and result['semifinal']['credits']==0,result
   assert result['final']['opponent']=='아구몬' and result['final']['pending'],result
   assert result['end']['active'] is None and result['end']['crowns']==1 and result['end']['credits']==260,result
   assert result['end']['history']==1 and result['end']['wins']==2 and not result['end']['pending'],result
   assert result['duplicate']['credits']==260 and result['duplicate']['history']==1,result
   assert result['end']['localStored']==1 and not errors,(result,errors[:2])
   results.append({'html':name,'status':'PASS','result':result})
  except Exception as e:results.append({'html':name,'status':'FAIL','error':str(e)[:1100],'pageErrors':errors[:3]})
  finally:page.close()
 browser.close()
(ROOT/'tests/championship-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2),flush=True)
if any(r['status']!='PASS' for r in results):raise SystemExit(1)
