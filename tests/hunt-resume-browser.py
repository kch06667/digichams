"""Original HTML hunting session resumes after real localStorage page reload.

Both desktop and touch Chromium exercise ROPE → TIED → RELOAD → PULL
→ STUN → CAPTURE → RELOAD, with no duplicate capture or roaming ghost.
"""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright
import math

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

def run(browser,base,entry,mobile):
 context=browser.new_context(viewport={"width":390,"height":844} if mobile else
    {"width":1250,"height":860},is_mobile=mobile,has_touch=mobile)
 page=context.new_page()
 errors=[];page.on("pageerror",lambda err:errors.append(str(err)))
 page.goto(base+"/"+entry,wait_until="domcontentloaded",timeout=90000)
 page.wait_for_function("typeof DCHuntUI==='object'")
 page.locator('[data-tab="hunt"]').click()
 page.evaluate("state.ropes=9;state.wins=4;")
 initial=page.evaluate("state.team.length")
 page.locator("#explore").tap() if mobile else page.locator("#explore").click()
 page.evaluate("""() => {
   DCHuntUI.encounter.vx=0;DCHuntUI.encounter.vy=0;
   window.dispatchEvent(new Event('pagehide'));
 }""")
 pre=page.evaluate("""() => ({name:DCHuntUI.encounter.name,
   ropes:state.ropes,team:state.team.length,
   stamp:JSON.parse(localStorage.getItem('dc_recreation_save')).huntSession.version})""")
 assert pre["stamp"]==1,pre
 page.locator("#throwRope").tap() if mobile else page.locator("#throwRope").click()
 page.locator("#huntStage").scroll_into_view_if_needed()
 rect=page.locator("#huntStage").bounding_box()
 pos=page.evaluate("({x:DCHuntUI.encounter.x,y:DCHuntUI.encounter.y})")
 ring=[]
 for i in range(41):
  a=2*math.pi*i/40
  ring.append((rect["x"]+(pos["x"]+.125*math.cos(a))*rect["width"],
               rect["y"]+(pos["y"]+.125*math.sin(a))*rect["height"]))
 def stroke(points):
  if not mobile:
   page.mouse.move(*points[0]);page.mouse.down()
   for xy in points[1:]:page.mouse.move(*xy)
   page.mouse.up()
  else:
   cdp=context.new_cdp_session(page)
   try:
    cdp.send("Input.dispatchTouchEvent",{"type":"touchStart",
        "touchPoints":[{"x":points[0][0],"y":points[0][1]}]})
    for xy in points[1:]:
     cdp.send("Input.dispatchTouchEvent",{"type":"touchMove",
         "touchPoints":[{"x":xy[0],"y":xy[1]}]})
     page.wait_for_timeout(16)
    cdp.send("Input.dispatchTouchEvent",{"type":"touchEnd","touchPoints":[]})
   finally:cdp.detach()
 stroke(ring)
 tied=page.evaluate("""() => ({
   mode:DCHuntUI.encounter.mode,ropes:state.ropes,
   stored:JSON.parse(localStorage.getItem('dc_recreation_save')).huntSession.encounter.mode
 })""")
 assert tied["mode"]=="tied" and tied["stored"]=="tied",tied
 assert tied["ropes"]==pre["ropes"]-1,tied
 page.reload(wait_until="domcontentloaded",timeout=90000)
 page.wait_for_function("typeof DCHuntUI==='object'")
 page.locator('[data-tab="hunt"]').click()
 restored=page.evaluate("""() => ({
   mode:DCHuntUI.encounter?.mode,ropes:state.ropes,
   name:DCHuntUI.encounter?.name,
   session:state.huntSession?.encounter?.mode,
   wild:state.wild?.name
 })""")
 assert restored=={"mode":"tied","ropes":tied["ropes"],"name":pre["name"],
    "session":"tied","wild":pre["name"]},restored
 # No second lasso or rope cost is required after reload.
 assert page.locator("#throwRope").is_disabled()
 # Chromium touch dispatch uses *viewport* coordinates. Reload resets scroll
 # and leaves the canvas below the fold; move it into view before pulling.
 page.locator("#huntStage").scroll_into_view_if_needed()
 rect=page.locator("#huntStage").bounding_box()
 for _ in range(12):
  if page.evaluate("DCHuntUI.encounter.mode")=="stunned":break
  pos=page.evaluate("({x:DCHuntUI.encounter.x,y:DCHuntUI.encounter.y})")
  start=(rect["x"]+pos["x"]*rect["width"],
         rect["y"]+pos["y"]*rect["height"])
  stroke([start,(rect["x"]+(pos["x"]-.20)*rect["width"],start[1])])
 phase=page.evaluate("""() => ({mode:DCHuntUI.encounter.mode,
   hp:DCHuntUI.encounter.hp,pulls:DCHuntUI.encounter.pulls,
   hint:document.getElementById('huntInstructions').textContent})""")
 assert phase["mode"]=="stunned",phase
 assert page.evaluate("state.huntSession.encounter.mode")=="stunned"
 page.locator("#huntGrab").tap() if mobile else page.locator("#huntGrab").click()
 page.locator("#huntGrab").evaluate("(el)=>el.click()")
 caught=page.evaluate("""() => ({
   team:state.team.length,
   wild:state.wild,
   session:state.huntSession,
   stored:JSON.parse(localStorage.getItem('dc_recreation_save')).team.length
 })""")
 assert caught["team"]==initial+1 and caught["stored"]==initial+1,caught
 assert caught["wild"] is None and caught["session"] is None,caught
 page.reload(wait_until="domcontentloaded",timeout=90000)
 page.wait_for_function("typeof DCHuntUI==='object'")
 assert page.evaluate("state.team.length")==initial+1
 assert page.evaluate("state.wild===null && state.huntSession===null")
 assert page.evaluate("DCHuntUI.encounter===null")
 page.locator('[data-tab="hunt"]').click()
 page.locator("#explore").tap() if mobile else page.locator("#explore").click()
 assert page.locator("#explore").is_disabled()
 page.locator("#huntAbandon").tap() if mobile else page.locator("#huntAbandon").click()
 assert page.evaluate("state.huntSession===null && state.wild===null")
 assert not page.locator("#explore").is_disabled()
 assert page.evaluate("state.team.length")==initial+1
 assert not errors,errors
 print("PASS",entry,"mobile touch" if mobile else "desktop",
       "tied reload→stun→capture once→reload→abandon",flush=True)
 context.close()

def main():
 server=ThreadingHTTPServer(("127.0.0.1",0),partial(Handler,directory=str(ROOT)))
 thread=Thread(target=server.serve_forever,daemon=True);thread.start()
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True)
   try:
    for entry,mobile in [("index.html",False),("standalone.html",True)]:
     run(browser,f"http://127.0.0.1:{server.server_port}",entry,mobile)
   finally:browser.close()
 finally:server.shutdown();server.server_close();thread.join(timeout=3)

if __name__=="__main__":main()
