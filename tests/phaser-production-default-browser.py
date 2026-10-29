"""PR57 — ACTUAL index/standalone default Phaser battle, automatic save.

The original game runs on real HTTP, not an index.phaser/dev/generated page.
Chromium is NOT a physical Android. No private sprites or ROM are uploaded.
"""
import functools
import http.server
import subprocess
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CDN="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"
VENDOR=ROOT/"node_modules/phaser/dist/phaser.min.js"

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass


def check(browser,base,entry,mobile):
    context=browser.new_context(
        viewport={"width":390,"height":844} if mobile else
                 {"width":1280,"height":800},
        is_mobile=mobile,has_touch=mobile)
    if VENDOR.is_file():
        context.route(CDN,lambda route:route.fulfill(
            path=str(VENDOR),content_type="application/javascript"))
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append("game: "+str(e)))
    try:
        page.goto(base+"/"+entry,wait_until="domcontentloaded",timeout=90000)
        page.locator("#dc-phaser-engine").wait_for(state="attached",timeout=30000)
        assert page.locator("#dc-phaser-engine").input_value()=="phaser"
        assert page.locator("#dc-phaser-cup-engine").input_value()=="phaser"
        assert page.locator("#dc-phaser-farm-apply").is_hidden()

        # A healthy participant with original instance identity; test-only
        # stat increase shortens combat, not a modified species database.
        first=page.evaluate("""() => {
          const s=eval('state'),m=s.team[0];
          if(!m?.instanceId)throw Error('missing original owned identity');
          s.team=[{...m,name:'아구몬',hp:300,maxHp:300,
            atk:900,def:900,spd:300,tp:170,maxTp:170,
            egg:false,lost:false,location:'farm'}];
          s.selected=0; s.world.paused=false;
          save(false);
          return {id:s.team[0].instanceId,wins:s.wins,
            losses:s.losses,paused:s.world.paused};
        }""")
        page.locator("#wideMode").click()
        page.locator("#liveBattleLaunch").click()
        page.locator("#lbMode").select_option("owned")
        page.locator("#lbTeamSize").select_option("1")
        assert page.locator("#dc-phaser-engine").input_value()=="phaser"
        with context.expect_page(timeout=10000) as popup:
            page.locator("#lbStart").click()
        arena=popup.value
        arena.on("pageerror",lambda e:errors.append("arena: "+str(e)))
        arena.wait_for_function("""() =>
          window.DigiPhaserLab?.selectedRoster()?.name==='아구몬'""",
          timeout=30000)
        assert page.evaluate("eval('state').world.paused")
        assert page.locator("#dc-phaser-farm-cancel").is_visible()
        arena.locator("#battle").click()
        arena.wait_for_function("""() => {
          const s=DigiPhaserLab?.matchSnapshot();
          return s?.fighters?.length===2 && s.elapsed>0;
        }""",timeout=15000)
        assert arena.evaluate("DigiPhaserLab.qaFinishCombat()")
        # Production must AUTO-APPLY after the same guarded cloned-state
        # backup/commit used in developer mode, without approval click.
        page.wait_for_function("""(before) => {
          const s=JSON.parse(localStorage.getItem('dc_recreation_save')||'{}');
          return s.wins+s.losses===before.wins+before.losses+1 &&
             !s.pendingBattle &&
             !!localStorage.getItem('dc_recreation_save_backup_phaser_dev_v1');
        }""",arg=first,timeout=30000)
        page.locator("#dc-phaser-engine").wait_for(state="attached",timeout=30000)
        current=page.evaluate("""() => ({
          saved:JSON.parse(localStorage.getItem('dc_recreation_save')),
          live:eval('state'),
          approved:!!localStorage.getItem(
            'dc_recreation_save_backup_phaser_dev_v1')
        })""")
        saved=current["saved"]
        assert saved["team"][0]["instanceId"]==first["id"],saved["team"][0]
        assert saved["world"]["paused"]==first["paused"],saved["world"]
        assert saved["wins"]+saved["losses"]==first["wins"]+first["losses"]+1
        assert current["approved"] and current["live"]["team"][0]["instanceId"]==first["id"]
        assert not current["live"].get("pendingBattle"),current["live"]
        assert not errors,errors
        print("PASS real",entry,"touch" if mobile else "desktop",
              "default Phaser 1v1 -> automatic guarded save -> original reload",
              flush=True)
    finally:
        context.close()


def check_fallback(browser,base):
    ctx=browser.new_context(viewport={"width":1280,"height":800})
    page=ctx.new_page()
    try:
        page.goto(base+"/index.html",wait_until="domcontentloaded",timeout=90000)
        page.locator("#dc-phaser-engine").wait_for(state="attached")
        page.locator("#wideMode").click()
        page.locator("#liveBattleLaunch").click()
        page.locator("#lbMode").select_option("owned")
        page.locator("#lbTeamSize").select_option("1")
        page.evaluate("window.open=()=>null")
        before=page.evaluate("eval('state').wins")
        page.locator("#lbStart").click()
        assert page.locator("#dc-phaser-engine").input_value()=="legacy"
        assert len(ctx.pages)==1
        assert not page.evaluate("Boolean(eval('state').pendingBattle)")
        assert page.evaluate("eval('state').wins")==before
        page.locator("#lbStart").click()
        page.wait_for_function("Boolean(eval('state').pendingBattle)",
                               timeout=10000)
        assert len(ctx.pages)==1
        print("PASS real index.html popup-blocked -> legacy battle retry",
              flush=True)
    finally:
        ctx.close()


def main():
    subprocess.run(["python3","tools/sync-phaser-production.py","--check"],
                   cwd=ROOT,check=True)
    srv=http.server.ThreadingHTTPServer(
        ("127.0.0.1",0),functools.partial(Quiet,directory=str(ROOT)))
    thread=threading.Thread(target=srv.serve_forever,daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                root=f"http://127.0.0.1:{srv.server_port}"
                check(browser,root,"index.html",False)
                check(browser,root,"standalone.html",True)
                check_fallback(browser,root)
            finally:browser.close()
    finally:
        srv.shutdown();srv.server_close();thread.join(timeout=3)


if __name__=="__main__":main()
