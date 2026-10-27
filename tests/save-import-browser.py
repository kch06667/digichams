"""Import malformed nested saves over real HTTP; failed imports must preserve live and stored state."""
import functools,http.server,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
failed=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  for entry in ['index.html','standalone.html']:
   context=browser.new_context();page=context.new_page()
   url=f'http://127.0.0.1:{server.server_port}/{entry}'
   page.goto(url);page.wait_for_function('!!window.DCHexFarm')
   page.evaluate('state.world.paused=true;save(false)')
   baseline=page.evaluate('JSON.stringify(state)')
   mutations=["bad.world='broken'","bad.farm.foods={}","bad.team[0].evo.ap='broken'","bad.farm.actors[bad.team[0].instanceId]=null","bad.farm.actors[bad.team[0].instanceId].route=[{x:'bad',y:0}]","bad.team[0].instanceId='__proto__'","bad.team[0].care=[]","bad.farm.foods=[null]","bad.championship={active:'bad'}"]
   for mutation in mutations:
    result=page.evaluate('''(mutation)=>{
      const before=JSON.stringify(state),stored=localStorage.getItem('dc_recreation_save'),backup=localStorage.getItem('dc_save_backup_before_import_v0144');
      const bad=JSON.parse(before);eval(mutation);let rejected=false;
      try{DCHexFarm.importSaveObject({format:'digicham-save',exportVersion:1,state:bad})}catch{rejected=true}
      return {rejected,unchanged:JSON.stringify(state)===before,stored:localStorage.getItem('dc_recreation_save')===stored,backup:localStorage.getItem('dc_save_backup_before_import_v0144')===backup};
    }''',mutation)
    ok=all(result.values());print('PASS' if ok else 'FAIL',entry,mutation,result,flush=True)
    if not ok:failed.append((entry,mutation,result))
    page.evaluate('(before)=>localStorage.setItem("dc_recreation_save",before)',baseline)
    page.reload();page.wait_for_function('!!window.DCHexFarm')
   positive=page.evaluate("""() => {
    const legacy=JSON.parse(JSON.stringify(state));delete legacy.world;delete legacy.farm;
    for(const m of legacy.team){delete m.instanceId;delete m.evo;delete m.care;}
    const original=JSON.stringify(legacy);DCHexFarm.importSaveObject(legacy);
    const accepted=!!state.team[0].instanceId&&!!state.team[0].evo&&!!state.farm;
    const untouched=JSON.stringify(legacy)===original;
    state.world.paused=true;
    const before=JSON.stringify(state),stored=localStorage.getItem('dc_recreation_save'),backup=localStorage.getItem('dc_save_backup_before_import_v0144');
    const candidate=DCHexFarm.exportSaveObject();candidate.state.food+=10;
    const savedRender=render;let first=true;render=function(){if(first){first=false;throw Error('test render failure')}return savedRender()};
    let rejected=false;try{DCHexFarm.importSaveObject(candidate)}catch{rejected=true}finally{render=savedRender}
    return {accepted,untouched,rejected,restored:JSON.stringify(state)===before,stored:localStorage.getItem('dc_recreation_save')===stored,backup:localStorage.getItem('dc_save_backup_before_import_v0144')===backup};
   }""")
   print('PASS' if all(positive.values()) else 'FAIL',entry,'legacy / detached input / render rollback',positive,flush=True)
   if not all(positive.values()):failed.append((entry,positive))
   context.close()
  browser.close()
finally:
 server.shutdown();server.server_close()
if failed:raise SystemExit(1)
