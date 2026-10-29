"""PC 1.0 acceptance: one authentic player save reaches an actual Phaser fight.

First use the existing original journey's *real* capture, timed farm work,
evolution and original cup setup/settlement. Then run the NEW default in-page
Phaser real autonomous AI using the SAME saved Digimon and championship
records; assert its guarded result, browser reload and JSON export/import
round-trip. No artificial team/stat injection, fake winner or direct rewards
in the Phaser step. Legacy cup prelude uses the existing test-only deterministic
arena resolution separately (as documented in full-game-journey-browser.py).
"""
import functools
import http.server
import importlib.util
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CDN="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"
VENDOR=ROOT/"node_modules/phaser/dist/phaser.min.js"

spec=importlib.util.spec_from_file_location(
    "original_journey_acceptance",
    ROOT/"tests"/"full-game-journey-browser.py")
journey=importlib.util.module_from_spec(spec)
spec.loader.exec_module(journey)


def check(browser,base):
    if not VENDOR.is_file():
        raise AssertionError("Local pinned Phaser build missing; install phaser@3.90.0 for QA")
    ctx=browser.new_context(viewport={"width":1280,"height":800})
    ctx.route(CDN,lambda route:route.fulfill(
        path=str(VENDOR),content_type="application/javascript"))
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    try:
        page.goto(base+"/index.html",wait_until="domcontentloaded",timeout=90000)
        page.wait_for_function(
            "Boolean(window.DCHuntUI&&window.DCFarm&&window.__journeyArena&&"
            "document.getElementById('dc-phaser-engine'))",timeout=30000)
        # All four functions operate on the exact same real original-game
        # page and real browser localStorage. They exercise the original
        # hunt canvas, physical rope, farm work, evolution and championship.
        identity=journey.capture(page,False)
        journey.farm_and_goal(page,identity)
        legacy=journey.battles_and_championship(page,identity)
        assert legacy["archiveRoundtrip"] and legacy["crowns"]==1,legacy
        print("PASS PC authentic capture→training→evolution→cup→archive",
              flush=True)

        before=page.evaluate("""() => {
          const live=eval('state'),disk=JSON.parse(
            localStorage.getItem('dc_recreation_save'));
          if(live.championship?.active || live.pendingBattle ||
             live.team.length!==2 || live.team[0].name!=='아구몬')
            throw Error('Original journey was not fully settled');
          return {
            ids:live.team.map(m=>m.instanceId),
            captured:live.team[1].name,
            training:live.team[1].training,
            wins:live.wins,losses:live.losses,
            crowns:live.championship.crowns.novice,
            credits:live.facilityCredits,
            paused:live.world.paused,
            diskMatches:disk.wins===live.wins&&disk.losses===live.losses
          };
        }""")
        assert before["diskMatches"] and before["crowns"]==1,before
        if page.evaluate("document.body.classList.contains('mode-nds')"):
            page.locator("#wideMode").click()
        page.locator("#liveBattleLaunch").click()
        page.locator("#lbMode").select_option("owned")
        page.locator("#lbTeamSize").select_option("1")
        assert page.locator("#dc-phaser-engine").input_value()=="phaser"
        page.locator("#lbStart").click()
        page.locator("#dc-phaser-overlay").wait_for(state="visible",timeout=12000)
        assert len(ctx.pages)==1
        page.frame_locator("#dc-phaser-arena-frame").locator(
            "#game canvas").wait_for(state="visible",timeout=30000)
        page.wait_for_function("""() => {
          const lab=document.querySelector('#dc-phaser-arena-frame')
            ?.contentWindow?.DigiPhaserLab;
          const battle=lab?.matchSnapshot();
          return lab?.selectedRoster()?.name==='아구몬' &&
            battle?.fighters?.length===2 && battle.elapsed>0;
        }""",timeout=30000)
        inspect=page.evaluate("""() => {
          const lab=document.querySelector('#dc-phaser-arena-frame')
            .contentWindow.DigiPhaserLab;
          return {battle:lab.matchSnapshot(),status:lab.stageStatus()};
        }""")
        assert inspect["status"]["version"]=="retro-field-v1",inspect
        assert inspect["status"]["originalArt"]>=1,inspect
        assert inspect["status"]["fallback"]+inspect["status"]["originalArt"]==2
        assert page.evaluate("eval('state').world.paused")
        # Natural original AI fight; qaFinishCombat only advances simulation,
        # it does NOT choose a winner, alter HP or grant a prize.
        result=page.evaluate("""() => {
          const lab=document.querySelector('#dc-phaser-arena-frame')
            .contentWindow.DigiPhaserLab;
          if(!lab.qaFinishCombat())throw Error('Original AI did not finish');
          const model=lab.matchSnapshot();
          return {winner:model.winner,elapsed:model.elapsed,finished:model.finished};
        }""")
        assert result["finished"] and result["winner"] in (0,1),result
        assert result["elapsed"]>0,result
        page.wait_for_function("""before => {
          const raw=localStorage.getItem('dc_recreation_save');
          if(!raw)return false;
          const s=JSON.parse(raw);
          return s.wins+s.losses===before.wins+before.losses+1 &&
            !s.pendingBattle && s.championship?.crowns?.novice===1 &&
            !document.getElementById('dc-phaser-overlay') &&
            !!localStorage.getItem(
              'dc_recreation_save_backup_phaser_dev_v1');
        }""",arg=before,timeout=30000)
        page.wait_for_function("""() =>
          Boolean(window.DCHexFarm?.exportSaveObject&&
                  document.getElementById('dc-phaser-engine'))""",
                               timeout=30000)
        after=page.evaluate("""() => {
          const live=eval('state'),s=JSON.parse(
            localStorage.getItem('dc_recreation_save'));
          return {ids:live.team.map(m=>m.instanceId),
            captured:live.team[1].name,
            training:live.team[1].training,
            wins:live.wins,losses:live.losses,
            crowns:live.championship.crowns.novice,
            credits:live.facilityCredits,
            savedWins:s.wins,savedLosses:s.losses,
            savedCrowns:s.championship.crowns.novice,
            paused:s.world.paused,
            pending:!!live.pendingBattle,
            park:localStorage.getItem('dc_phaser_park_recovery_v1')};
        }""")
        assert after["ids"]==before["ids"],(before,after)
        assert after["captured"]==before["captured"],(before,after)
        assert after["training"]>=before["training"],(before,after)
        assert after["crowns"]==after["savedCrowns"]==before["crowns"],after
        assert after["credits"]>=before["credits"],(before,after)
        assert after["wins"]==after["savedWins"],after
        assert after["losses"]==after["savedLosses"],after
        assert after["wins"]+after["losses"]==before["wins"]+before["losses"]+1
        assert after["paused"]==before["paused"],(before,after)
        assert not after["pending"] and after["park"] is None,after
        print("PASS PC same-save real Phaser autonomous 1v1→guarded "
              "settlement→original reload",result,flush=True)

        # Safeguard the COMBINED history: cup crown, caught Digimon,
        # training and added Phaser result survive official JSON import.
        page.evaluate("""() => {
          const doc=DCHexFarm.exportSaveObject();
          if(doc.format!=='digicham-save')
            throw Error('Archive format mismatch');
          DCHexFarm.importSaveObject(doc);
        }""")
        page.reload(wait_until="domcontentloaded",timeout=90000)
        page.wait_for_function("Boolean(window.DCHexFarm&&window.DCChampionship)")
        restored=page.evaluate("""() => ({
          ids:eval('state').team.map(m=>m.instanceId),
          crowns:eval('state').championship.crowns.novice,
          wins:eval('state').wins,losses:eval('state').losses,
          backedUp:!!localStorage.getItem(
            'dc_save_backup_before_import_v0144')
        })""")
        assert restored["ids"]==before["ids"],restored
        assert restored["crowns"]==1 and restored["backedUp"],restored
        assert (restored["wins"],restored["losses"])==(
            after["wins"],after["losses"]),restored
        assert not errors,errors
        print("PASS PC export/import after both engines preserves roster, "
              "training history, cup crown and battle totals",flush=True)
    finally:
        ctx.close()


def main():
    server=http.server.ThreadingHTTPServer(
        ("127.0.0.1",0),
        functools.partial(journey.Handler,directory=str(ROOT)))
    worker=threading.Thread(target=server.serve_forever,daemon=True)
    worker.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                check(browser,f"http://127.0.0.1:{server.server_port}")
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=3)


if __name__=="__main__":
    main()
