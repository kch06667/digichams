"""v0.15.1 feed-placement & autonomous-life browser smoke tests, desktop and touch."""
import os,pathlib,json,sys
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
results=[];errors=[]
def check(name,fn):
 try:
  fn();results.append({'name':name,'status':'PASS'});print('PASS',name,flush=True)
 except Exception as exc:
  results.append({'name':name,'status':'FAIL','error':str(exc)});print('FAIL',name,str(exc)[:220],flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1240,'height':850});page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded')
 page.wait_for_function('!!window.DCHexFarm')
 def js(s):return page.evaluate(s)
 def place_on_tile(tile='core'):
  page.locator('#hexDrop').click()
  assert js("document.getElementById('farmWorld').classList.contains('foodPlacement')")
  page.locator(f'[data-hex="{tile}"]').click()
  assert not js("document.getElementById('farmWorld').classList.contains('foodPlacement')")
 def desktop_placement():
  before=js('state.food')
  page.locator('#hexDrop').click()
  assert js('state.food')==before
  page.locator('[data-hex="core"]').click()
  f=js('state.farm.foods[0]')
  assert js('state.food')==before-1
  assert abs(f['x']-50)<61 and abs(f['y']-50)<65,f
  assert page.locator('.hexFood.falling').count()==1
  page.evaluate('DCHexFarm.tick(8)')
  assert js('state.farm.foods.length')==0
  assert js('state.farm.actors[state.team[0].instanceId].emote')=='💚'
 check('desktop: button then tile click places and consumes one food',desktop_placement)
 def cancel():
  initial=js('state.food')
  page.locator('#hexDrop').click();page.locator('#hexDrop').click()
  assert js('state.food')==initial
  assert not js('document.getElementById("farmWorld").classList.contains("foodPlacement")')
 check('cancelling placement does not consume food',cancel)
 def save_restore():
  page.locator('#hexDrop').click();page.locator('[data-hex="core"]').click()
  snapshot=js('DCHexFarm.exportSaveObject()')
  assert len(snapshot['state']['farm']['foods'])==1
  js('DCHexFarm.tick(8)')
  js('DCHexFarm.importSaveObject('+json.dumps(snapshot,ensure_ascii=False)+')')
  assert js('state.farm.foods.length')==1
  js('DCHexFarm.tick(8)')
  assert js('state.farm.foods.length')==0
 check('JSON export/import preserves meal on the ground',save_restore)
 def multiple():
  js("state.team.push({...state.team[0],instanceId:'hungry-other',name:'아구몬',hunger:85,location:'farm'});state.team[0].hunger=15;DCHexFarm.core.ensure(state)")
  place_on_tile()
  js('DCHexFarm.tick(.05)')
  assert js('state.farm.foods[0].claim')=='hungry-other'
  assert js('state.farm.actors["hungry-other"].goal.kind')=='eat'
  assert js('state.farm.actors[state.team[0].instanceId].goal?.kind')!='eat'
  js('DCHexFarm.tick(8)')
  assert js('state.farm.foods.length')==0
 check('two Digimon compete: only hungriest eats',multiple)
 def mobile_touch():
  touch=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
  tp=touch.new_page();tp.on('pageerror',lambda e:errors.append(str(e)))
  tp.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded')
  tp.wait_for_function('!!window.DCHexFarm')
  try:
   before=tp.evaluate('state.food');tp.locator('#hexDrop').tap();assert tp.evaluate('state.food')==before
   tp.locator('[data-hex="core"]').tap()
   assert tp.evaluate('state.farm.foods.length')==1
   assert tp.evaluate('state.food')==before-1
   assert tp.evaluate('document.documentElement.scrollWidth<=innerWidth')
  finally:touch.close()
 check('mobile real touch: button -> tapped plot -> food appears',mobile_touch)
 print('page-errors:',errors)
 (ROOT/'tests'/'feeding-browser-results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2))
 browser.close()
if errors or any(t['status']=='FAIL' for t in results):sys.exit(1)
