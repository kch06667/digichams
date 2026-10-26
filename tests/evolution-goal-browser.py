"""Full-app Chromium smoke test: target selector and its effect on real evolution logic."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for name in ['index.html','standalone.html']:
  page=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.set_content((root/name).read_text(),wait_until='domcontentloaded',timeout=60000)
   page.evaluate('''() => {state.team=[makeMon('아구몬')];state.selected=0;render()}''')
   page.locator('[data-tab="dex"]').click()
   page.locator('#evolutionRules [data-evo-target="지오그레이몬"]').click()
   assert page.evaluate('current().evo.target')=='지오그레이몬'
   page.evaluate('''() => {const m=current();for(let i=0;i<6;i++)DCEvolution.recordBattle(state,[m.instanceId],true,speciesLookup)}''')
   assert page.evaluate('current().name')=='아구몬'
   page.evaluate('''() => {current().evo.ap.dragon=20;evolve()}''')
   assert page.evaluate('current().name')=='지오그레이몬'
   assert page.evaluate('current().evo.target') is None
   page.locator('#catalogSearch').fill('워그레이몬')
   assert page.locator('.catalogCard').count()==2
   page.locator('.catalogCard').first.click()
   assert '메탈그레이몬' in page.locator('.evoTree').inner_text()
   assert not errors, errors
   results.append({'file':name,'status':'PASS','goal_lock':'PASS','target_evolution':'PASS','tree':'PASS','pageerrors':errors})
  except Exception as exc:results.append({'file':name,'status':'FAIL','error':str(exc),'pageerrors':errors})
  page.close()
 browser.close()
(root/'tests/evolution-goal-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False))
if any(r['status']!='PASS' for r in results):raise SystemExit(1)
