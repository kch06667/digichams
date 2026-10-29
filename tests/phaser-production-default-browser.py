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
        page.locator("#lbStart").click()
        assert len(context.pages)==1,"Phaser must stay inside the game tab"
        overlay=page.locator("#dc-phaser-overlay")
        overlay.wait_for(state="visible",timeout=10000)
        assert page.locator("#dc-phaser-overlay-close").is_visible()
        arena=page.frame_locator("#dc-phaser-arena-frame")
        arena.locator("#game canvas").wait_for(state="visible",timeout=30000)
        page.wait_for_function("""() => {
          const frame=document.querySelector('#dc-phaser-arena-frame');
          const lab=frame?.contentWindow?.DigiPhaserLab;
          const battle=lab?.matchSnapshot();
          return lab?.selectedRoster()?.name==='아구몬' &&
            battle?.fighters?.length===2 && battle.elapsed>0;
        }""",timeout=30000)
        assert overlay.bounding_box()["height"]>500
        # The real production HTML uses the player-facing retro field,
        # not the former demo oval. Its original-art count is transparent.
        stage=page.evaluate("""() => {
          const frame=document.getElementById('dc-phaser-arena-frame');
          return frame?.contentWindow?.DigiPhaserLab?.stageStatus();
        }""")
        assert stage["version"]=="retro-field-v1",stage
        assert stage["fighters"]==2,stage
        assert stage["originalArt"]>=1,stage
        assert stage["originalArt"]+stage["fallback"]==2,stage
        assert page.evaluate("eval('state').world.paused")
        assert page.locator("#dc-phaser-farm-cancel").is_visible()
        # No user click inside the Phaser lab: the validated in-page
        # handoff automatically starts the existing autonomous battle.
        # Observe one real victory pose BEFORE the iframe can be closed
        # by the production result auto-commit. The same synchronous task
        # exercises the original real-time AI finish, not a forced winner.
        victory=page.evaluate("""() => {
          const frame=document.getElementById('dc-phaser-arena-frame');
          const lab=frame?.contentWindow?.DigiPhaserLab;
          if(!lab?.qaFinishCombat())throw Error('Battle did not end');
          const end=lab.matchSnapshot(),art=lab.renderedArt();
          return {winner:end.winner,actors:art,fighters:end.fighters,
            overlayVisible:!!document.querySelector('#dc-phaser-overlay')};
        }""")
        assert victory["overlayVisible"],"Victory animation was removed instantly"
        assert any(
            art["action"]=="victory:30" and art["privateArt"] and
            f["side"]==victory["winner"] and f["hp"]>0
            for f,art in zip(victory["fighters"],victory["actors"])),victory
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
        assert page.locator("#dc-phaser-overlay").count()==0
        assert len(context.pages)==1
        assert not errors,errors
        print("PASS real",entry,"touch" if mobile else "desktop",
              "in-page auto 1v1 -> guarded save -> original reload",
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
        # Fail creation of the embedded battle window (not window.open),
        # verify the original one-click legacy retry is still available.
        page.evaluate("""() => {
          const create=document.createElement.bind(document);
          document.createElement=(tag,...args)=>{
            if(tag.toLowerCase()==='iframe')
              throw Error('QA: embedded frame blocked');
            return create(tag,...args);
          };
        }""")
        before=page.evaluate("eval('state').wins")
        page.locator("#lbStart").click()
        assert page.locator("#dc-phaser-engine").input_value()=="legacy"
        assert len(ctx.pages)==1
        assert page.locator("#dc-phaser-overlay").count()==0
        assert not page.evaluate("Boolean(eval('state').pendingBattle)")
        assert page.evaluate("eval('state').wins")==before
        page.locator("#lbStart").click()
        page.wait_for_function("Boolean(eval('state').pendingBattle)",
                               timeout=10000)
        assert len(ctx.pages)==1
        print("PASS real index.html iframe failure -> legacy battle retry",
              flush=True)
    finally:
        ctx.close()


def check_cancel(browser,base):
    ctx=browser.new_context(viewport={"width":390,"height":844},
                            is_mobile=True,has_touch=True)
    page=ctx.new_page()
    try:
        page.goto(base+"/standalone.html",
                  wait_until="domcontentloaded",timeout=90000)
        page.locator("#dc-phaser-engine").wait_for(state="attached")
        before=page.evaluate("""() => {
          const s=eval('state');
          s.world.paused=false;save(false);
          return {id:s.team[0].instanceId,wins:s.wins,
            losses:s.losses,paused:s.world.paused};
        }""")
        page.locator("#wideMode").click()
        page.locator("#liveBattleLaunch").click()
        page.locator("#lbMode").select_option("owned")
        page.locator("#lbTeamSize").select_option("1")
        page.locator("#lbStart").click()
        page.locator("#dc-phaser-overlay").wait_for(state="visible")
        assert len(ctx.pages)==1
        assert page.evaluate("eval('state').world.paused")
        page.locator("#dc-phaser-overlay-close").click()
        assert page.locator("#dc-phaser-overlay").count()==0
        recovered=page.evaluate("""() => ({
          id:eval('state').team[0].instanceId,
          paused:eval('state').world.paused,
          wins:eval('state').wins,losses:eval('state').losses,
          pending:!!eval('state').pendingBattle
        })""")
        assert recovered["id"]==before["id"],recovered
        assert recovered["paused"]==before["paused"],recovered
        assert recovered["wins"]==before["wins"],recovered
        assert recovered["losses"]==before["losses"],recovered
        assert not recovered["pending"],recovered
        print("PASS touch in-page cancel restores original farm clock",flush=True)
    finally:
        ctx.close()



def check_interrupted(browser,base,entry,mobile):
    """Crash-style same-tab reload is NOT a result; restore paused farm only."""
    ctx=browser.new_context(
        viewport={"width":390,"height":844} if mobile else
                 {"width":1280,"height":800},
        is_mobile=mobile,has_touch=mobile)
    if VENDOR.is_file():
        ctx.route(CDN,lambda route:route.fulfill(
            path=str(VENDOR),content_type="application/javascript"))
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    try:
        page.goto(base+"/"+entry,wait_until="domcontentloaded",timeout=90000)
        page.locator("#dc-phaser-engine").wait_for(state="attached")
        baseline=page.evaluate("""() => {
          const s=eval('state');
          s.world.paused=false;
          save(false);
          return {paused:s.world.paused,wins:s.wins,losses:s.losses,
            instanceId:s.team[0].instanceId,
            backing:localStorage.getItem('dc_recreation_save')};
        }""")
        page.locator("#wideMode").click()
        page.locator("#liveBattleLaunch").click()
        page.locator("#lbMode").select_option("owned")
        page.locator("#lbTeamSize").select_option("1")
        page.locator("#lbStart").click()
        page.locator("#dc-phaser-overlay").wait_for(state="visible")
        mark=page.evaluate("""() => {
          const record=JSON.parse(localStorage.getItem(
            'dc_phaser_park_recovery_v1'));
          return {record,saved:localStorage.getItem('dc_recreation_save'),
            session:sessionStorage.getItem('dc_phaser_tab_recovery_v1')};
        }""")
        assert mark["record"] and mark["record"]["paused"] is False,mark
        assert mark["record"]["saved"]==mark["saved"],mark
        assert mark["session"]==mark["record"]["token"],mark
        assert page.evaluate("eval('state').world.paused")
        # The browser reload has NO validated terminal packet. The
        # persisted paused pre-fight checkpoint must be repaired instead
        # of silently awarding a result or leaving farm time frozen.
        page.reload(wait_until="domcontentloaded",timeout=90000)
        page.locator("#dc-phaser-engine").wait_for(state="attached")
        result=page.evaluate("""() => ({
          saved:JSON.parse(localStorage.getItem('dc_recreation_save')),
          live:eval('state'),
          marker:localStorage.getItem('dc_phaser_park_recovery_v1'),
          tab:sessionStorage.getItem('dc_phaser_tab_recovery_v1'),
          status:document.getElementById('dc-phaser-farm-status').textContent
        })""")
        assert result["marker"] is None and result["tab"] is None,result
        assert result["saved"]["world"]["paused"]==baseline["paused"],result
        assert result["live"]["world"]["paused"]==baseline["paused"],result
        assert result["saved"]["wins"]==baseline["wins"],result
        assert result["saved"]["losses"]==baseline["losses"],result
        assert result["saved"]["team"][0]["instanceId"]==baseline["instanceId"],result
        assert not result["saved"].get("pendingBattle"),result
        assert "중단" in result["status"] and "복구" in result["status"],result
        assert page.locator("#dc-phaser-overlay").count()==0
        assert len(ctx.pages)==1
        assert not errors,errors
        print("PASS real",entry,"touch" if mobile else "desktop",
              "interrupted Phaser reload restores farm clock with no reward",
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
                check_cancel(browser,root)
                check_interrupted(browser,root,"index.html",False)
                check_interrupted(browser,root,"standalone.html",True)
            finally:browser.close()
    finally:
        srv.shutdown();srv.server_close();thread.join(timeout=3)


if __name__=="__main__":main()
