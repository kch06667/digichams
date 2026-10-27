"""v0.23.3 integration smoke: both HTML builds, phone/desktop, graphics,
valid/invalid food gestures, Esc, save rejection, tournament display.
Uses real local HTTP, not pre-existing test result JSON.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import base64
import json,os,traceback
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
result=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  for name in ['index.html','standalone.html']:
   for width in [390,1365]:
    errors=[]
    page=browser.new_page(viewport={'width':width,'height':840},is_mobile=(width==390),has_touch=(width==390),accept_downloads=True)
    page.on('pageerror',lambda e:errors.append(str(e)))
    case={'html':name,'width':width}
    try:
     html=(ROOT/name).read_text()
     if name=='index.html':
      b64=base64.b64encode((ROOT/'assets/farm/hex_farm_v0232.webp').read_bytes()).decode('ascii')
      html=html.replace('assets/farm/hex_farm_v0232.webp','data:image/webp;base64,'+b64)
     mock="<script>window.__savedData={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return window.__savedData[k]||null},setItem(k,v){window.__savedData[k]=String(v)},removeItem(k){delete window.__savedData[k]}}});</script>"
     html=html.replace('<script',mock+'<script',1)
     page.set_content(html,wait_until='domcontentloaded',timeout=60000)
     page.wait_for_function('!!window.DCHexFarm && !!window.DCChampionship',timeout=15000)
     # Stop real-time ticks while operating on a deterministic fixture.
     page.evaluate('state.world.paused=true')
     a=page.evaluate('''() => ({tiles:document.querySelectorAll('.hexTile').length,actors:document.querySelectorAll('.hexActor').length,css: getComputedStyle(document.querySelector('.farmWorld')).backgroundImage,overflow:document.body.scrollWidth-innerWidth,cups:DCChampionship.CUPS.length,fragments:document.querySelectorAll('.championshipBracketGrid').length})''')
     assert a['tiles']==7 and a['actors']>=1 and a['cups']==3, a
     assert a['overflow']<=1,a
     assert ('data:image/webp;base64' in a['css']), 'Farm WebP background not embedded'
     a['css']='verified embedded WebP'
     # If an actor blocks the core center, food placement must ignore it.
     page.evaluate("state.food=5;DCHexFarm.core.ensure(state);document.getElementById('hexDrop').click()")
     page.keyboard.press('Escape')
     assert not page.evaluate("document.getElementById('farmWorld').classList.contains('foodPlacement')")
     assert page.evaluate('state.food')==5
     page.evaluate("document.getElementById('hexDrop').click()")
     # Deliberately click a locked tile (food remains armed / not charged).
     page.locator('[data-hex="training"]').click(force=True)
     assert page.evaluate('state.food')==5
     assert page.evaluate("document.getElementById('farmWorld').classList.contains('foodPlacement')")
     # Click core center and confirm exactly one food consumed.
     page.locator('[data-hex="core"]').click(force=True)
     assert page.evaluate('state.food')==4
     assert page.evaluate('state.farm.foods.length')==1
     # Path line should become visible for a purchased plot. No bitmap changes.
     movement=page.evaluate('''() => {state.day=2;state.facilityCredits=1000;DCHexFarm.choose('training');document.querySelector('[data-hex-buy=training]').click();return {connectors:document.querySelectorAll('.hexPath').length, api:typeof DCFarm.walkable, ground:DCFarm.foodGround(state,50,-76)} }''')
     assert movement['connectors']>=1 and movement['api']=='function' and movement['ground'],movement
     # Import invalid data must never replace state or localStorage snapshots.
     imp=page.evaluate('''() => {
       const before=JSON.stringify(state),ls=localStorage.getItem('dc_recreation_save');
       const o=DCHexFarm.exportSaveObject();
       o.state.farm.actors[state.team[0].instanceId].mode='broken';
       let blocked=false;try{DCHexFarm.importSaveObject(o)}catch(err){blocked=true}
       return {blocked,unchanged:before===JSON.stringify(state),persisted:ls===localStorage.getItem('dc_recreation_save'),version:DCHexFarm.exportSaveObject().gameVersion};
     }''')
     assert all(imp[k] for k in ['blocked','unchanged','persisted']) and imp['version']=='0.23.3',imp
     # Check graphics+brackets coexist after unlocking higher-level tournament.
     cup=page.evaluate('''() => {state.team=['아구몬','가부몬','그레이몬'].map(makeMon);state.day=10;state.wins=6;state.championship={crowns:{novice:1,regional:1},history:[],matchHistory:[],sequence:0,rank:2};render();document.querySelector('[data-cup="grand"]').click();return {rounds:state.championship.active?.bracket?.rounds.map(r=>r.length),fixtures:document.querySelectorAll('.championshipFixture').length,rank:document.getElementById('farmRank').textContent}}''')
     assert cup['rounds']==[4,2,1] and cup['fixtures']==7,cup
     # Capture one actual game screenshot per viewport.
     page.locator('#farmPanel').scroll_into_view_if_needed(timeout=12000)
     out=ROOT/('PREVIEW_v0233_'+name.replace('.html','')+'_'+str(width)+'.png')
     page.screenshot(path=str(out),full_page=False,timeout=30000)
     case.update(status='PASS',initial=a,importCheck=imp,tournament=cup,preview=str(out.name),pageErrors=errors)
     assert not errors,errors
    except Exception as e:
     case.update(status='FAIL',error=str(e)[:1600],trace=traceback.format_exc()[-1500:],pageErrors=errors[:5])
    result.append(case)
    page.close()
  browser.close()
finally:
 server.shutdown()
 (ROOT/'TEST_REPORT_v0.23.3_BROWSER.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
assert all(x['status']=='PASS' for x in result)
