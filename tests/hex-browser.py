"""Self-contained browser smoke for v0.14.3; no HTTP required in restricted environments.
Usage: python tests/hex-browser.py (pip install playwright, system Chromium).
Note: about:blank disallows real localStorage persistence, so reload persistence is a separate manual QA item.
"""
import json,os,pathlib,sys
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
RESULTS=[];ERRORS=[]

def run(name, callback):
 try:
  callback();RESULTS.append({'name':name,'status':'PASS'});print('PASS',name,flush=True)
 except Exception as e:
  RESULTS.append({'name':name,'status':'FAIL','error':str(e)});print('FAIL',name,str(e)[:200],flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1365,'height':900});page.on('pageerror',lambda e: ERRORS.append(str(e)))
 page.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded',timeout=60000)
 page.wait_for_timeout(500)
 def probe(expr):return page.evaluate(expr)
 def baseline():
  assert page.locator('.hexTile').count()==7
  assert page.locator('.hexActor').count()==1
  assert page.locator('#hexSpeed').count()==1
  assert page.locator('#lbCanvas').count()==1
  assert page.locator('#romRoom').count()==1
  assert not ERRORS,ERRORS
 run('new hex board retains live battle & ROM UI',baseline)
 def command_train():
  page.locator('[data-hex-command="attack"]').click()
  v=probe('''() => ({training:state.team[0].training,mode:state.farm.actors[state.team[0].instanceId].mode})''')
  assert v['training']==0,v
  page.evaluate('DCHexFarm.tick(8)')
  v=probe('''() => ({training:state.team[0].training,attack:state.team[0].atk,completed:state.farm.completed})''')
  assert v['training']>=1 and v['training']==v['completed'] and v['attack']>7,v
 run('move then repeated training updates owned Digimon exactly once',command_train)
 def food_rest():
  page.locator('[data-hex-command="stop"]').click()
  page.locator('#hexDrop').click()
  assert probe('state.farm.foods.length')==0
  page.locator('[data-hex="core"]').click()
  assert probe('state.farm.foods.length')==1
  page.evaluate('DCHexFarm.tick(8)')
  assert probe('state.farm.foods.length')==0
  v=probe('state.team[0].hp');page.locator('[data-hex-command="rest"]').click();page.evaluate('DCHexFarm.tick(7)');assert probe('state.team[0].hp')>=v
 run('food on ground consumed and rest works',food_rest)
 def clock():
  s=probe('state.world.seconds');page.locator('#hexPause').click();page.evaluate('DCHexFarm.tick(3)');assert abs(probe('state.world.seconds')-s)<.35
  page.locator('#hexPause').click();page.locator('#hexSpeed').select_option('4');page.evaluate('DCHexFarm.tick(1)');assert abs(probe('state.world.seconds')-s-4)<.35
 run('pause/resume and 4x simulation clock',clock)
 def battle():
  assert probe('typeof window.DCHexFarm')=='object'
  page.evaluate("document.getElementById('liveBattleLaunch').click()")
  assert probe("document.getElementById('liveBattle').style.display")=='block'
  page.evaluate("document.getElementById('lbClose').click()")
 run('existing live battle modal preserved',battle)
 def goal_training():
  page.evaluate("state.team[0].atk=7;state.team[0].maxHp=1000;state.team[0].hp=1000;state.team[0].fatigue=0;state.world.speed=1")
  page.locator('#hexGoalEnabled').check()
  page.locator('#hexGoalValue').fill('9')
  page.locator('[data-hex-command="attack"]').click()
  assert probe('state.farm.actors[state.team[0].instanceId].target.value')==9
  page.evaluate('DCHexFarm.tick(15)')
  a=probe('state.team[0].atk')
  assert a>=9,a
  assert probe('state.farm.actors[state.team[0].instanceId].target') is None
  t=probe('state.team[0].training');page.evaluate('DCHexFarm.tick(8)')
  assert probe('state.team[0].training')==t
 run('UI target-stat training stops automatically',goal_training)
 def peripheral():
  page.evaluate("state.facilities.training=true;state.facilities.track=true;state.facilities.rest=true;state.world.speed=1;state.team[0].hp=state.team[0].maxHp;state.team[0].fatigue=0")
  page.evaluate("DCHexFarm.core.command(state,state.team[0].instanceId,'attack')")
  assert probe('state.farm.actors[state.team[0].instanceId].goal.zone')=='training'
  page.evaluate('DCHexFarm.tick(12)')
  assert probe('state.farm.actors[state.team[0].instanceId].y') < -60,probe('JSON.stringify(state.farm.actors[state.team[0].instanceId])')
  page.evaluate("DCHexFarm.core.command(state,state.team[0].instanceId,'speed')")
  assert probe('state.farm.actors[state.team[0].instanceId].goal.zone')=='track'
  page.evaluate('DCHexFarm.tick(26)')
  assert probe('state.farm.actors[state.team[0].instanceId].x') > 140,probe('JSON.stringify(state.farm.actors[state.team[0].instanceId])')
  page.evaluate("state.team[0].maxHp=1000;state.team[0].hp=10;DCHexFarm.core.command(state,state.team[0].instanceId,'rest')")
  assert probe('state.farm.actors[state.team[0].instanceId].goal.zone')=='rest'
  page.evaluate('DCHexFarm.tick(44)')
  assert probe('state.farm.actors[state.team[0].instanceId].x') < -40,probe('JSON.stringify(state.farm.actors[state.team[0].instanceId])')
  assert page.locator('#hexFollow').count()==1
 run('purchased peripheral plots receive actual walking Digimon',peripheral)
 def mobile():
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(300)
  dim=probe('''() => ({body:document.body.scrollWidth,win:innerWidth,map:document.getElementById('farmViewport').scrollWidth})''')
  assert dim['body']<=dim['win'],dim
  assert dim['map']>400,dim
  assert page.locator('#hexDrop').count()==1
 run('mobile has horizontally scrollable board but no page overflow',mobile)
 assert not ERRORS,ERRORS
 print('PAGE_ERRORS',ERRORS)
 (ROOT/'tests'/'hex-browser-results.json').write_text(json.dumps({'results':RESULTS,'errors':ERRORS},ensure_ascii=False,indent=2))
 browser.close()
if any(x['status']!='PASS' for x in RESULTS):sys.exit(1)
