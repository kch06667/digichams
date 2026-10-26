"""Live Chrome end-to-end hunting gestures on both desktop and touch screen."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,math
ROOT=Path(__file__).resolve().parents[1]
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-timer-throttling'])
 for filename, mobile in [('index.html',False),('standalone.html',True)]:
  page=browser.new_page(viewport={'width':390 if mobile else 1250,'height':860},is_mobile=mobile,has_touch=mobile)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.set_content((ROOT/filename).read_text(),wait_until='domcontentloaded',timeout=75000)
   page.locator('[data-tab="hunt"]').click()
   assert page.locator('#huntStage').is_visible()
   assert page.evaluate("typeof DCHuntUI === 'object'")
   page.evaluate('state.ropes=9; state.wins=4;')
   page.locator('#explore').click()
   page.wait_for_timeout(100)
   # Freeze only during the slow gesture test; movement is verified in pure simulation tests.
   page.evaluate('DCHuntUI.encounter.vx=0;DCHuntUI.encounter.vy=0;')
   pre=page.evaluate('''() => ({name:state.wild.name,ropes:state.ropes,mode:DCHuntUI.encounter.mode})''')
   assert pre['mode']=='wild',pre
   page.locator('#throwRope').click()
   page.locator('#huntStage').scroll_into_view_if_needed()
   rect=page.locator('#huntStage').bounding_box()
   point=page.evaluate('''() => ({x:DCHuntUI.encounter.x,y:DCHuntUI.encounter.y})''')
   x=rect['x']+point['x']*rect['width'];y=rect['y']+point['y']*rect['height'];points=[]
   for i in range(41):
    a=2*math.pi*i/40
    points.append((rect['x']+(point['x']+math.cos(a)*.125)*rect['width'],rect['y']+(point['y']+math.sin(a)*.125)*rect['height']))
   def stroke(points):
    if not mobile:
     page.mouse.move(*points[0]);page.mouse.down()
     for p in points[1:]:page.mouse.move(*p)
     page.mouse.up()
    else:
     cdp=page.context.new_cdp_session(page)
     cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':points[0][0],'y':points[0][1]}]})
     for p in points[1:]:
      cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':p[0],'y':p[1]}]})
      page.wait_for_timeout(16)
     cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
     cdp.detach()
   stroke(points)
   page.wait_for_timeout(100)
   tied=page.evaluate('''() => ({mode:DCHuntUI.encounter.mode,ropes:state.ropes})''')
   assert tied['mode']=='tied',(tied,page.locator('#huntInstructions').inner_text(),page.evaluate('DCHuntUI.encounter'))
   assert tied['ropes']==pre['ropes']-1,tied
   # Pull in controlled amounts; touch screens and mouse share the pointer path.
   for i in range(10):
    value=page.evaluate('DCHuntUI.encounter.mode')
    if value=='stunned':break
    point=page.evaluate('''() => ({x:DCHuntUI.encounter.x,y:DCHuntUI.encounter.y})''')
    start=(rect['x']+point['x']*rect['width'],rect['y']+point['y']*rect['height'])
    end=(rect['x']+(point['x']-.20)*rect['width'],start[1]);stroke([start,end])
   stunned=page.evaluate('DCHuntUI.encounter.mode');assert stunned=='stunned',stunned
   page.locator('#huntGrab').click()
   assert page.evaluate('DCHuntUI.encounter.mode')=='captured'
   assert page.evaluate('state.wild === null')
   assert page.evaluate('state.team.some(m=>m.name === DCHuntUI.encounter.name)')
   assert not errors,errors[:4]
   results.append({'html':filename,'input':'touch' if mobile else 'mouse','status':'PASS','capture':pre['name'],'ropeSpent':1,'teamCount':page.evaluate('state.team.length')})
  except Exception as ex:
   results.append({'html':filename,'input':'touch' if mobile else 'mouse','status':'FAIL','error':str(ex)[:1100],'pageerrors':errors[:5]})
  finally:page.close()
 browser.close()
(ROOT/'tests/hunt-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
if any(x['status']!='PASS' for x in results):raise SystemExit(1)
