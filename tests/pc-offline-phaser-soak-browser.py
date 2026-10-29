"""PC 1.0 soak: browser fully offline, several real in-page battles, farm clock.

The full game runs on real localhost HTTP with all external HTTPS blocked.
No user's save is imported and no ROM/sprite output is committed.
This accelerates world time; it is not 2 hours of physical wall-clock QA.
"""
import functools
import http.server
import importlib.util
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "pc_start",ROOT/"tools"/"play_local.py")
launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)


def run(browser,base):
    ctx=browser.new_context(viewport={"width":1280,"height":800})
    remote=[]
    # A blocked external request is a test failure, not something supplied
    # by a hidden Playwright CDN route.
    ctx.route("https://**/*",lambda route:(
        remote.append(route.request.url),route.abort()))
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    cdp=ctx.new_cdp_session(page)
    cdp.send("Performance.enable")
    cdp.send("HeapProfiler.enable")
    try:
        page.goto(base+"/index.html",wait_until="domcontentloaded",timeout=90000)
        page.locator("#dc-phaser-engine").wait_for(state="attached",timeout=30000)
        assert page.locator("#dc-phaser-engine").input_value()=="phaser"
        init=page.evaluate("""() => {
          const s=eval('state'),m=s.team[0];
          // QA-only high stamina lets multiple autonomous fights run
          // without requiring food/health recovery clicks between rounds.
          m.hp=2000;m.maxHp=2000;m.atk=450;m.def=350;m.spd=130;
          m.tp=160;m.maxTp=160;m.egg=false;m.lost=false;
          m.location='farm';s.world.paused=false;save(false);
          return {id:m.instanceId,wins:s.wins,losses:s.losses};
        }""")
        before_heap=None
        counts=[]
        for i in range(3):
            if not page.locator("#liveBattleLaunch").is_visible():
                page.locator("#wideMode").click()
            page.locator("#liveBattleLaunch").click()
            page.locator("#lbMode").select_option("owned")
            page.locator("#lbTeamSize").select_option("1")
            assert page.locator("#dc-phaser-engine").input_value()=="phaser"
            page.locator("#lbStart").click()
            page.locator("#dc-phaser-overlay").wait_for(
                state="visible",timeout=15000)
            frame=page.frame_locator("#dc-phaser-arena-frame")
            frame.locator("#game canvas").wait_for(state="visible",timeout=30000)
            page.wait_for_function("""() => {
              const w=document.getElementById('dc-phaser-arena-frame')
                ?.contentWindow,lab=w?.DigiPhaserLab;
              return lab?.matchSnapshot()?.fighters?.length===2 &&
                lab?.matchSnapshot()?.elapsed>0;
            }""",timeout=30000)
            status=page.evaluate("""() => {
              const lab=document.getElementById('dc-phaser-arena-frame')
                .contentWindow.DigiPhaserLab;
              return {stage:lab.stageStatus(),result:lab.qaFinishCombat(),
                      model:lab.matchSnapshot()};
            }""")
            assert status["result"] and status["model"]["finished"],status
            assert status["stage"]["version"]=="retro-field-v1",status
            assert status["stage"]["originalArt"]>=1,status
            expected=init["wins"]+init["losses"]+i+1
            page.wait_for_function("""total => {
              const v=JSON.parse(localStorage.getItem('dc_recreation_save')||'{}');
              return (v.wins||0)+(v.losses||0)===total &&
                !v.pendingBattle && !document.getElementById('dc-phaser-overlay');
            }""",arg=expected,timeout=30000)
            page.locator("#dc-phaser-engine").wait_for(state="attached")
            state=page.evaluate("""() => {
              const s=eval('state');
              return {id:s.team[0].instanceId,
                wins:s.wins,losses:s.losses,paused:s.world.paused,
                park:localStorage.getItem('dc_phaser_park_recovery_v1')};
            }""")
            assert state["id"]==init["id"] and state["park"] is None,state
            assert state["wins"]+state["losses"]==expected,state
            counts.append(expected)
            # Keep fixture stamina for another original-AI fight while
            # preserving the exact original save settlement from this one.
            page.evaluate("""() => {
              const s=eval('state'),m=s.team[0];
              m.hp=m.maxHp;m.tp=m.maxTp;save(false);
            }""")
            cdp.send("HeapProfiler.collectGarbage")
            metrics={x["name"]:x["value"] for x in
                     cdp.send("Performance.getMetrics")["metrics"]}
            if before_heap is None:before_heap=metrics.get("JSHeapUsedSize")
        assert not remote,remote
        # 2 simulated hours: 30 × 60-second ticks × world speed x4.
        start=page.evaluate("""() => {
          const s=eval('state');
          s.world.paused=true;s.world.speed=4;save(false);
          return {seconds:s.world.seconds,day:s.day,
                  ids:s.team.map(m=>m.instanceId),
                  wins:s.wins,losses:s.losses};
        }""")
        for _ in range(30):
            page.evaluate("""() => {
              state.world.paused=false;DCHexFarm.tick(60);
              state.world.paused=true;save(false);
            }""")
        after=page.evaluate("""() => {
          const s=eval('state');
          return {seconds:s.world.seconds,day:s.day,
                  ids:s.team.map(m=>m.instanceId),
                  wins:s.wins,losses:s.losses};
        }""")
        assert abs(after["seconds"]-start["seconds"]-7200)<1,(start,after)
        assert after["ids"]==start["ids"],after
        assert (after["wins"],after["losses"])==(
            start["wins"],start["losses"]),(start,after)
        for _ in range(2):
            page.reload(wait_until="domcontentloaded",timeout=90000)
            page.locator("#dc-phaser-engine").wait_for(state="attached")
            state=page.evaluate("""() => {
              const s=eval('state'),stored=JSON.parse(
                localStorage.getItem('dc_recreation_save'));
              return {ids:s.team.map(m=>m.instanceId),
                wins:s.wins,losses:s.losses,seconds:s.world.seconds,
                paused:s.world.paused,pending:!!s.pendingBattle,
                park:localStorage.getItem('dc_phaser_park_recovery_v1'),
                savedIds:stored.team.map(m=>m.instanceId)};
            }""")
            assert state["ids"]==state["savedIds"]==start["ids"],state
            assert state["wins"]==start["wins"] and state["losses"]==start["losses"],state
            assert abs(state["seconds"]-after["seconds"])<.5,state
            assert state["paused"] and not state["pending"] and state["park"] is None,state
        cdp.send("HeapProfiler.collectGarbage")
        values={x["name"]:x["value"] for x in
                cdp.send("Performance.getMetrics")["metrics"]}
        final_heap=values.get("JSHeapUsedSize")
        if before_heap and final_heap:
            assert not (final_heap-before_heap>64*1024*1024 and
                        final_heap>before_heap*2.5),{
                "early":before_heap,"late":final_heap}
        assert not errors,errors
        assert not remote,remote
        print("PASS PC fully offline local Phaser: 3 original AI matches, "
              "7200 simulated world seconds, 2 reloads, exact save IDs; "
              "heap MiB",round((final_heap or 0)/1048576,1),
              "progressive totals",counts,flush=True)
    finally:
        cdp.detach()
        ctx.close()


def main():
    # The CI workflow installs the pinned Phaser package and converts
    # original GIFs privately. Launcher validates SHA before serving.
    launcher.prepare_engine(allow_download=False)
    server=http.server.ThreadingHTTPServer(
        ("127.0.0.1",0),
        functools.partial(launcher.GameFileHandler,directory=str(ROOT)))
    worker=threading.Thread(target=server.serve_forever,daemon=True)
    worker.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:run(browser,f"http://127.0.0.1:{server.server_port}")
            finally:browser.close()
    finally:
        server.shutdown();server.server_close();worker.join(timeout=3)


if __name__=="__main__":main()
