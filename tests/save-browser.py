"""Chromium set_content smoke with a persistent mock Storage because this environment blocks browser navigation."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
import json,pathlib,os,sys
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
RESULTS=[];ERRORS=[]
def run(name,cb):
 try: cb();RESULTS.append(dict(name=name,status='PASS'));print('PASS',name,flush=True)
 except Exception as e: RESULTS.append(dict(name=name,status='FAIL',message=str(e)));print('FAIL',name,str(e)[:200],flush=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*a): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':900});page.on('pageerror',lambda e:ERRORS.append(str(e)))
 page.evaluate("Object.defineProperty(window,'localStorage',{configurable:true,value:{saved:{},setItem(k,v){this.saved[k]=v},getItem(k){return this.saved[k]??null},removeItem(k){delete this.saved[k]}}})")
 page.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded',timeout=60000);page.wait_for_function("!!window.DCHexFarm")
 def js(s,arg=None): return page.evaluate(s,arg)
 def legacy_timed():
  base=js('({food:state.food,training:state.team[0].training,atk:state.team[0].atk,credits:state.facilityCredits})')
  js("document.getElementById('train').click()")
  assert js('state.team[0].training')==base['training'],'legacy train completed instantly'
  assert js('state.facilityCredits')==base['credits'],'Bit paid before training finished'
  js('DCHexFarm.tick(9)')
  assert js('state.team[0].training')>base['training']
  assert js('state.facilityCredits')>base['credits']
  js("document.getElementById('train').click();document.getElementById('feed').click()")
  assert js('state.food')==base['food'],'food should not deduct until choosing map location'
  assert js("document.getElementById('farmWorld').classList.contains('foodPlacement')")
  page.locator("[data-hex=core]").click()
  assert js('state.food')==base['food']-1,'feed should deduct only once when placed'
  assert js('state.farm.foods.length')==1
 run('old train and feed buttons route into timed hex simulation',legacy_timed)
 def autorest():
  js("document.getElementById('hexAutoRest').checked=false;document.getElementById('hexAutoRest').dispatchEvent(new Event('change',{bubbles:true}))")
  assert js('state.farm.actors[state.team[0].instanceId].autoRest') is False
  js("document.getElementById('hexAutoRest').checked=true;document.getElementById('hexAutoRest').dispatchEvent(new Event('change',{bubbles:true}))")
  assert js('state.farm.actors[state.team[0].instanceId].autoRest') is True
 run('auto-rest preference is editable from farm UI',autorest)
 def persistent():
  global page
  js("document.getElementById('save').click()")
  snap=js("({id:state.team[0].instanceId,training:state.team[0].training,credit:state.facilityCredits,seconds:state.world.seconds})")
  stored=js("localStorage.saved");page.close()
  page=browser.new_page(viewport={"width":1280,"height":900},accept_downloads=True);page.on("pageerror",lambda e:ERRORS.append(str(e)))
  page.evaluate("(storage)=>Object.defineProperty(window,'localStorage',{configurable:true,value:{saved:storage,setItem(k,v){this.saved[k]=v},getItem(k){return this.saved[k]??null},removeItem(k){delete this.saved[k]}}})",stored)
  page.set_content((ROOT/'index.html').read_text(),wait_until='domcontentloaded',timeout=60000);page.wait_for_function('!!window.DCHexFarm')
  fresh=js("({id:state.team[0].instanceId,training:state.team[0].training,credit:state.facilityCredits,seconds:state.world.seconds})")
  assert fresh['id']==snap['id'] and fresh['training']==snap['training'] and fresh['credit']==snap['credit'],(snap,fresh)
  assert fresh['seconds']>=snap['seconds']
 run('mock Storage persists team and training after reload',persistent)
 def archive():
  saved=js('DCHexFarm.exportSaveObject()');assert saved['format']=='digicham-save'
  old=saved['state']['team'][0]['atk']
  js('state.team[0].atk=999')
  js('(v)=>DCHexFarm.importSaveObject(v)',saved)
  assert js('state.team[0].atk')==old
  assert js('localStorage.getItem("dc_save_backup_before_import_v0144")') is not None
  malformed=dict(saved);malformed['state']=dict(saved['state']);malformed['state']['team']=[]
  assert js('(v)=>{try{DCHexFarm.importSaveObject(v);return false}catch(e){return true}}',malformed)
 run('JSON export/import restores state and rejects broken archive',archive)
 def archive_download():
  with page.expect_download() as down:
   js("document.getElementById('hexExportSave').click()")
  obj=down.value
  assert obj.suggested_filename.startswith('digicham-save-day')
  path=ROOT/'tests'/'test-save-export.json';obj.save_as(str(path));data=json.loads(path.read_text());path.unlink()
  assert data['format']=='digicham-save'
 run('downloaded JSON save archive is valid',archive_download)
 def mobile():
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
  assert js('document.body.scrollWidth<=innerWidth'), (js('document.body.scrollWidth'),js('innerWidth'))
  assert page.locator('#hexAutoRest').count()==1
 run('updated controls do not introduce mobile page overflow',mobile)
 assert not ERRORS,ERRORS
 browser.close()
server.shutdown()
(ROOT/'tests'/'save-browser-results.json').write_text(json.dumps({'results':RESULTS,'errors':ERRORS},ensure_ascii=False,indent=2))
if any(x['status']=='FAIL' for x in RESULTS):sys.exit(1)
