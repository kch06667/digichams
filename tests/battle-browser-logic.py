"""Chromium lightweight integration: strips embedded media only, keeps real game JS/UI."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
ROOT=Path(__file__).resolve().parents[1]
ANCHOR=" window.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.style.display==='block')close()});reset();"
HOOK="window.__battleTest={reset,update,beginSkill,fighters:()=>fighters,skillInfo,renderTeams,settleMatch};"
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for name in ('index.html','standalone.html'):
  page=browser.new_page(viewport={'width':390 if name=='standalone.html' else 1200,'height':790})
  page.set_default_timeout(7000)
  errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  try:
   src=(ROOT/name).read_text();assert src.count(ANCHOR)==1
   for var,val in [('EXTRA_SPRITE_FRAMES','{}'),('ROM_ASSETS','[]'),('SPRITE_FRAMES',"{'코로몬':['R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=']}"),('ANIMATION_SHEETS','{}'),('ROM_ARENA_IMAGES',"{grass:'',orange:'',stone:'',ring:''}"),('ROM_BATTLE_HUD',"''")]:
    src=re.sub(r'(^\s*const '+var+r'=)[^\n]*',lambda m:m.group(1)+val+';',src,count=1,flags=re.M)
   src=src.replace(ANCHOR,HOOK+ANCHOR)
   page.set_content(src,wait_until='domcontentloaded',timeout=20000)
   result=page.evaluate('''() => {
     state.team=[makeMon('아구몬')];state.team[0].maxTp=77;state.team[0].tp=57;state.team[0].hp=state.team[0].maxHp;
     const tactic=document.querySelector('#lbTactic');tactic.value='focus';tactic.dispatchEvent(new Event('change'));
     document.querySelector('#lbMode').value='owned';
     document.querySelector('#liveBattleLaunch').click();
     document.querySelector('#lbStart').click();
     const ally=__battleTest.fighters().find(f=>f.side===0), foe=__battleTest.fighters().find(f=>f.side===1);
     const initial={tp:ally.tp,maxTp:ally.maxTp,pending:!!state.pendingBattle,selection:tactic.value};
     ally.energy=100;ally.cd=0;ally.skillCD=0;
     __battleTest.beginSkill(ally,foe);
     const spent={tp:ally.tp,special:ally.act==='special'};
     foe.hp=0;__battleTest.update(.016);__battleTest.update(.016);
     return {initial,spent,end:{tp:state.team[0].tp,wins:state.wins,pending:!!state.pendingBattle,tactic:state.battleTactic},choices:tactic.options.length};
   }''')
   assert result['choices']==5,result
   assert result['initial']['tp']==57 and result['initial']['maxTp']==77 and result['initial']['pending'],result
   assert result['spent']['special'] and result['spent']['tp']<57,result
   assert result['end']['tp']==result['spent']['tp'] and result['end']['wins']==1 and not result['end']['pending'],result
   assert result['end']['tactic']=='focus',result
   assert not errors,errors[:3]
   results.append({'html':name,'status':'PASS','result':result})
  except Exception as exc:results.append({'html':name,'status':'FAIL','error':str(exc)[:900],'pageerrors':errors[:3]})
  finally:page.close()
 browser.close()
(ROOT/'tests/battle-browser-logic-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2),flush=True)
if any(r['status']!='PASS' for r in results):raise SystemExit(1)
