"""Real original game's lbStart button: opt-in Phaser route versus legacy.
Isolated Chromium desktop/touch and fake farm member, no personal saves.
"""
import functools
import http.server
import subprocess
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
VENDOR=ROOT/"node_modules"/"phaser"/"dist"/"phaser.min.js"
CDN="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def open_page(browser,base,mobile):
    options={"viewport":{"width":390,"height":844} if mobile else
             {"width":1280,"height":800}}
    if mobile:
        options.update(is_mobile=True,has_touch=True,device_scale_factor=2)
    context=browser.new_context(**options)
    if VENDOR.is_file():
        context.route(CDN,lambda route:route.fulfill(
            path=str(VENDOR),content_type="application/javascript"))
    page=context.new_page()
    page.goto(base+"/index.phaser.html?phaserBattle=1",wait_until="domcontentloaded")
    # The selector belongs to the ORIGINAL modal, hidden until launched.
    page.locator("#dc-phaser-engine").wait_for(
        state="attached",timeout=30000)
    page.wait_for_function("""() => {
      try{return Boolean(eval('state')?.team?.length)}
      catch(_){return false}
    }""",timeout=30000)
    return context,page

def check(browser,base,mobile=False):
    context,farm=open_page(browser,base,mobile)
    errors=[]
    farm.on('pageerror',lambda e:errors.append('farm: '+str(e)))
    # Use one of the real game's existing farm actors; retain immutable ID.
    farm.evaluate("""() => {
      const s=eval('state');
      s.pendingBattle=null;
      s.day=10;
      const mon=JSON.parse(JSON.stringify(s.team[0]));
      if(!mon.instanceId)throw Error('No original instanceId');
      s.team.splice(0,s.team.length,{
        ...mon,name:'아구몬',hp:123,maxHp:140,
        atk:47,def:24,spd:59,tp:40,maxTp:90,
        egg:false,lost:false,location:'farm'
      });
    }""")
    assert farm.locator("#dc-phaser-engine").input_value()=="legacy"
    # Open the actual in-game live battle modal, not the old floating
    # "Phaser sparring" development launch button.
    farm.locator("#wideMode").click()
    farm.locator("#liveBattleLaunch").click()
    farm.locator("#lbMode").select_option("owned")
    farm.locator("#lbTeamSize").select_option("1")
    farm.locator("#dc-phaser-engine").select_option("phaser")
    with context.expect_page() as popup:
        farm.locator("#lbStart").click()
    arena=popup.value
    arena.on('pageerror',lambda e:errors.append('arena: '+str(e)))
    arena.wait_for_function("""() =>
      window.DigiPhaserLab?.selectedRoster()?.name === '아구몬'
    """,timeout=30000)
    assert arena.locator("#squadSize").input_value()=="1"
    assert farm.evaluate("""() => !eval('state').pendingBattle""")
    assert farm.evaluate("""() => document.getElementById('liveBattle').style.display
      === 'none'""")
    arena.locator("#battle").click()
    arena.wait_for_function("""() => {
      const s=window.DigiPhaserLab?.matchSnapshot();
      return s && s.fighters.length===2 && s.elapsed>0
        && s.fighters[0].name==='아구몬';
    }""",timeout=12000)
    assert arena.evaluate("DigiPhaserLab.qaFinishCombat()")
    result=arena.evaluate("DigiPhaserLab.battleResultPreview()")
    assert result and result["saveApplied"] is False
    # The result must NOT auto-commit. Only a real approval click in the
    # ORIGINAL game tab can persist it.
    apply=farm.locator("#dc-phaser-farm-apply")
    apply.wait_for(state="visible",timeout=12000)
    assert farm.evaluate("""() =>
      localStorage.getItem(DCDevPhaserCommit.BACKUP_KEY)===null""")
    original=farm.evaluate("""() => {
      const s=eval('state');
      return {wins:s.wins,losses:s.losses,id:s.team[0].instanceId};
    }""")
    farm.evaluate("""() => {
      // Same synchronous click task, no world-tick race between checkpoint
      // and the compare-and-save guard.
      localStorage.setItem('dc_recreation_save',JSON.stringify(eval('state')));
      document.querySelector('#dc-phaser-farm-apply').click();
    }""")
    farm.locator("#dc-phaser-engine").wait_for(
        state="attached",timeout=20000)
    saved=farm.evaluate("""() =>
      JSON.parse(localStorage.getItem('dc_recreation_save'))""")
    assert saved["wins"]+saved["losses"]==original["wins"]+original["losses"]+1,saved
    assert saved["team"][0]["instanceId"]==original["id"]
    assert saved["team"][0]["evo"]["battles"]>=1
    assert "pendingBattle" not in saved
    assert farm.evaluate("""() => Boolean(
      localStorage.getItem(DCDevPhaserCommit.BACKUP_KEY))""")
    assert not errors,errors
    print("OK actual game lbStart -> optional Phaser 1v1 -> approved save",
          "touch" if mobile else "desktop")
    context.close()

def check_legacy(browser,base):
    context,page=open_page(browser,base,False)
    assert page.locator("#dc-phaser-engine").input_value()=="legacy"
    page.locator("#wideMode").click()
    page.locator("#liveBattleLaunch").click()
    page.locator("#lbMode").select_option("owned")
    page.locator("#lbTeamSize").select_option("1")
    page.locator("#lbStart").click()
    page.wait_for_function("""() => {
      try{return Boolean(eval('state').pendingBattle)}
      catch(_){return false}
    }""",timeout=8000)
    assert page.locator("#liveBattle").evaluate(
      "(el)=>getComputedStyle(el).display !== 'none'")
    assert len(context.pages)==1,'default original button must not open Phaser'
    context.close()
    print('OK legacy default keeps original owned match and modal')

def main():
    subprocess.run(['node','tools/build-phaser-optin-page.cjs'],
                   cwd=ROOT,check=True,capture_output=True,text=True)
    handler=functools.partial(QuietHandler,directory=str(ROOT))
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                base=f'http://127.0.0.1:{server.server_port}'
                check_legacy(browser,base)
                check(browser,base,False)
                check(browser,base,True)
            finally:
                browser.close()
    finally:
        server.shutdown();server.server_close();thread.join(timeout=3)

if __name__=='__main__':
    main()
