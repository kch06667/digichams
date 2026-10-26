from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import threading, json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}'
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for name in ['index.html','standalone.html']:
  page=browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  try:
   html=(ROOT/name).read_text()
   needle="window.addEventListener('keydown',e=>{if(e.key==='Escape'"
   assert needle in html
   html=html.replace(needle,"window.__evoLiveTest={settleMatch,get ownedMatch(){return ownedMatch}};"+needle,1)
   page.set_content(html,wait_until='domcontentloaded',timeout=50000)
   page.wait_for_timeout(400)
   assert not errors,errors
   assert page.locator('#evolutionRules').count()==1
   assert page.evaluate('current().name')=='코로몬'
   # Simulate actual participation from main loop not global win total
   r=page.evaluate('''() => {let m=current();for(let i=0;i<3;i++)DCEvolution.recordBattle(state,[m.instanceId],i!==1,speciesLookup);render();return {name:m.name,battles:m.evo.battles,wins:m.evo.wins,saveVersion:state.saveVersion}}''')
   assert r['name']=='아구몬' and r['battles']==3 and r['wins']==2,r
   # time passage + whole app should update legacy and UI
   r2=page.evaluate('''() => {state.team=[makeMon('가부몬')];state.selected=0;for(let i=0;i<5;i++)nextDay();return {name:current().name,stageDays:current().evo.stageDays}}''')
   assert r2['name']=='가루몬',r2
   # JSON roundtrip matches a portable exported save when local browsing storage is unavailable
   before=page.evaluate('JSON.stringify(state.team[0].evo)')
   after=page.evaluate('''() => {const next=JSON.parse(JSON.stringify(state));DCEvolution.ensure(next);return JSON.stringify(next.team[0].evo);}''')
   assert before==after,(before,after)
   # Owned canvas battle is not a preview: it must record participation and wins.
   live=page.evaluate('''() => {state.team=[makeMon('코로몬')];state.selected=0;render();document.getElementById('lbMode').value='owned';document.getElementById('lbTeamSize').value='1';for(let i=0;i<3;i++){document.getElementById('lbStart').click();if(!state.pendingBattle)throw Error('real battle did not start');__evoLiveTest.settleMatch(i%2===0);}return {name:current().name,battles:current().evo.battles,wins:current().evo.wins};}''')
   assert live=={'name':'아구몬','battles':3,'wins':2},live
   assert page.locator('#evoInfo').count()==1
   assert not errors,errors
   results.append({'page':name,'status':'PASS','details':{'battle_evolution':r,'time_evolution':r2,'json_roundtrip':'PASS','real_canvas_battles':live}})
  except Exception as e:
   results.append({'page':name,'status':'FAIL','error':str(e),'pageerrors':errors})
  finally:page.close()
 browser.close()
server.shutdown()
print(json.dumps(results,ensure_ascii=False,indent=2))
(ROOT/'tests/evolution-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
if any(r['status']!='PASS' for r in results):raise SystemExit(1)
