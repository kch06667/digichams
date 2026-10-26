"""Browser regression for v0.20: actual user-facing season and health controls."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
ROOT=Path(__file__).resolve().parents[1]
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for filename,width in [('index.html',1280),('standalone.html',390)]:
  page=browser.new_page(viewport={'width':width,'height':850},is_mobile=width<500,has_touch=width<500)
  errors=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  try:
   page.set_content((ROOT/filename).read_text(),wait_until='domcontentloaded',timeout=60000)
   page.wait_for_timeout(350)
   assert page.locator('#hexSeason').count()==1
   assert page.locator('#hexBandage').count()==1
   assert page.locator('#hexMedicine').count()==1
   assert page.evaluate('typeof DCCare')=='object'
   assert page.evaluate('DCCare.season(31)')=='여름'
   info=page.evaluate('''() => {
    let m=state.team[0];state.facilityCredits=500;state.day=91;state.facilityPaidDays=91;state.facilityPaidWins=state.wins;DCEvolution.ensure(state);
    DCCare.suffer(state,m,'injury');
    const el=document.getElementById('hexMon');el.value=m.instanceId;el.dispatchEvent(new Event('change'));
    return {selected:el.value,mon:m.instanceId,injured:m.care.injured,penalties:m.evo.penalties,season:document.getElementById('hexSeason').textContent};
   }''')
   assert info['selected']==info['mon'],info
   assert info['injured'] and info['penalties']==1,info
   page.locator('#hexBandage').click()
   after_bandage=page.evaluate('''() => ({injured:state.team[0].care.injured,penalties:state.team[0].evo.penalties,credits:state.facilityCredits})''')
   assert after_bandage=={'injured':False,'penalties':1,'credits':470},after_bandage
   page.evaluate("() => {DCCare.suffer(state,state.team[0],'sickness');document.getElementById('hexMon').dispatchEvent(new Event('change'));}")
   page.locator('#hexMedicine').click()
   after_medicine=page.evaluate('''() => ({sick:state.team[0].care.sick,penalties:state.team[0].evo.penalties,credits:state.facilityCredits})''')
   assert after_medicine=={'sick':False,'penalties':3,'credits':420},after_medicine
   save=page.evaluate('''() => {const current=JSON.parse(JSON.stringify(state));DCEvolution.ensure(current);DCCare.ensure(current);return {penalties:current.team[0].evo.penalties,treatments:current.team[0].care.treatments};}''')
   assert save=={'penalties':3,'treatments':2},save
   assert not errors,errors[:5]
   results.append({'html':filename,'width':width,'status':'PASS','treatment':after_medicine,'season':'겨울','save':save})
  except Exception as ex:
   results.append({'html':filename,'width':width,'status':'FAIL','error':str(ex)[:700],'pageerrors':errors[:5]})
  finally:page.close()
 browser.close()
(ROOT/'tests/care-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
if any(x['status']!='PASS' for x in results):raise SystemExit(1)
