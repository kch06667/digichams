"""Actual Chromium DOM smoke for cage UI and training using the existing full game HTML."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for filename,width in [('index.html',1280),('standalone.html',390)]:
  page=browser.new_page(viewport={'width':width,'height':850},is_mobile=width<500,has_touch=width<500)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.set_content((ROOT/filename).read_text(),wait_until='domcontentloaded',timeout=55000)
   page.wait_for_timeout(250)
   assert page.locator('#hexCageSelect').count()==1,'Cage selector not initialized'
   assert page.locator('#hexCageSelect option').count()==11,'Need eleven source-based cages'
   assert not errors,errors
   # Simulate unlocking original training plot. Purchases still run through real UI click handlers.
   page.evaluate("""() => {state.facilities.training=true;state.day=6;state.wins=6;state.facilityCredits=3000;state.team.push(makeMon('아구몬'));DCEvolution.ensure(state);DCHexFarm.core.ensure(state);const option=document.querySelector('#hexCageSelect');option.value='miniVolcano';option.dispatchEvent(new Event('change'));}""")
   assert page.locator('#hexCageBuy').is_enabled()
   page.locator('#hexCageBuy').click()
   assert page.evaluate("DCCages.owned(state,'miniVolcano')") is True
   page.locator('#hexMon').select_option(label='아구몬 · Lv.1') if False else None
   # manually select Agumon by game state, since roster select rebuild is asynchronous
   page.evaluate("""() => {const m=state.team.find(x=>x.name==='아구몬');const el=document.getElementById('hexMon');el.value=m.instanceId;el.dispatchEvent(new Event('change'));} """)
   page.locator('#hexCageGoalEnabled').check();page.locator('#hexCageGoalValue').fill('6');page.locator('#hexCageTrain').click()
   data=page.evaluate("""() => {const m=state.team.find(x=>x.name==='아구몬');const a=state.farm.actors[m.instanceId];return {cage:a.goal?.cage,goal:a.target?.value,zone:a.goal?.zone};} """)
   assert data=={'cage':'miniVolcano','goal':6,'zone':'training'},data
   page.evaluate('DCHexFarm.tick(32)')
   value=page.evaluate("""() => {const m=state.team.find(x=>x.name==='아구몬');return m.evo.ap.dragon;}""")
   assert value==6,value
   assert not errors,errors
   results.append({'html':filename,'width':width,'status':'PASS','dragonAp':value,'cagePurchase':True,'controls':11})
  except Exception as e:
   results.append({'html':filename,'width':width,'status':'FAIL','error':str(e)[:600],'pageerrors':errors})
  finally:page.close()
 browser.close()
(ROOT/'tests/cage-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
if any(x['status']!='PASS' for x in results):raise SystemExit(1)
