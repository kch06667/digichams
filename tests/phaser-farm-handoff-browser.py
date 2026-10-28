"""Actual developer farm -> Phaser original-AI 1v1 handoff, desktop/touch.
Uses an isolated browser profile and synthetic roster only, never user saves.
"""
import functools
import http.server
import subprocess
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
VENDOR=ROOT/"node_modules/phaser/dist/phaser.min.js"
CDN="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

def check(browser,host,mobile=False):
    settings={"viewport":{"width":390,"height":844} if mobile
              else {"width":1280,"height":800}}
    if mobile:
        settings.update(is_mobile=True,has_touch=True,device_scale_factor=2)
    ctx=browser.new_context(**settings)
    if VENDOR.exists():
        ctx.route(CDN,lambda route:route.fulfill(
            path=str(VENDOR),content_type="application/javascript"))
    errors=[]
    farm=ctx.new_page()
    farm.on("pageerror",lambda err:errors.append("farm: "+str(err)))
    farm.goto(host+"/index.dev.html?phaserBridge=1",wait_until="domcontentloaded")
    farm.locator("#dc-phaser-farm-launch").wait_for(timeout=30000)
    farm.wait_for_function("""() => {
      try { return !!eval('state')?.team; } catch (_) { return false; }
    }""",timeout=30000)
    # Synthetic member in a TEST-ONLY browser context. Real users' farm is
    # read from the game's current live state on clicking the same button.
    farm.evaluate("""() => {
      const s=eval('state');
      s.pendingBattle=null;
      s.day=10;
      // Preserve the existing game's required stable instanceId, farm actor,
      // and other validated world fields when replacing its visible stats.
      const base=JSON.parse(JSON.stringify(s.team[0]));
      if(!base?.instanceId)throw Error('No existing farm actor to use for QA');
      s.team.splice(0,s.team.length,{
        ...base,name:'아구몬',hp:123,maxHp:140,atk:47,def:24,spd:59,
        tp:40,maxTp:90,egg:false,lost:false,location:'farm'
      });
    }""")
    with ctx.expect_page() as popup_info:
        farm.locator("#dc-phaser-farm-launch").click()
    arena=popup_info.value
    arena.on("pageerror",lambda err:errors.append("arena: "+str(err)))
    arena.wait_for_function("""() =>
      window.DigiPhaserLab?.selectedRoster()?.name === '아구몬'
    """,timeout=30000)
    roster=arena.evaluate("DigiPhaserLab.selectedRoster()")
    assert roster["hp"]==123 and roster["atk"]==47,roster
    assert arena.locator("#squadSize").input_value()=="1"
    assert "사육장 명단 연결 완료" in arena.locator("#status").inner_text()
    assert arena.evaluate("DigiPhaserLab.importedSavePreview().team[0].name")=="아구몬"
    arena.locator("#battle").click()
    arena.wait_for_function("""() => {
      const s=window.DigiPhaserLab?.matchSnapshot();
      return s && s.fighters.length===2 && s.elapsed>0
        && s.fighters[0].name==='아구몬';
    }""",timeout=12000)
    combat=arena.evaluate("DigiPhaserLab.matchSnapshot()")
    assert combat["fighters"][0]["max"]==140,combat
    assert arena.evaluate("DigiPhaserLab.qaFinishCombat()")
    result=arena.evaluate("DigiPhaserLab.battleResultPreview()")
    assert result and not result["saveApplied"] and not result["rewardsApplied"],result
    assert "연습전" in farm.locator("#dc-phaser-farm-launch").inner_text()
    assert not errors,errors
    print("OK dev farm -> Phaser read-only 1v1", "touch" if mobile else "desktop")
    ctx.close()

def main():
    subprocess.run(["node","tools/build-dev-page.cjs"],cwd=ROOT,check=True,
                   capture_output=True,text=True)
    handler=functools.partial(QuietHandler,directory=str(ROOT))
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser=playwright.chromium.launch(headless=True)
            try:
                host=f"http://127.0.0.1:{server.server_port}"
                check(browser,host,mobile=False)
                check(browser,host,mobile=True)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)

if __name__=="__main__":
    main()
