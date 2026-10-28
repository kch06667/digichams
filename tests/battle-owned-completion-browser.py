"""End-to-end original owned-arena completion under optional settlement.

The original combat update(dt) runs without rendering between simulated frames.
No test forces HP or chooses the winner. This is deterministic-time Chromium
simulation, *not* a physical Android real-time / animation performance test.
"""
import functools
import http.server
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,fmt,*args):
        pass


def check(browser,host,mobile):
    options={"viewport":{"width":390,"height":844} if mobile
             else {"width":1280,"height":800}}
    if mobile:
        options.update(is_mobile=True,has_touch=True,device_scale_factor=2)
    context=browser.new_context(**options)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto(host+"/dist/battle-optin/index.html",wait_until="domcontentloaded")
    page.locator("#dc-owned-optin").wait_for(timeout=20000)
    assert page.evaluate("typeof window.__dcOwnedBattleQa?.fastForward")=="function"
    assert not page.locator("#dc-owned-optin-enable").is_checked()

    # A synchronous, QA-only persisted checkpoint avoids the normal farm
    # animation tick between serializing state and clicking the switch.
    page.locator("#dc-owned-optin summary").click()
    status=page.evaluate("""() => {
      const s=eval('state');
      localStorage.setItem('dc_recreation_save',JSON.stringify(s));
      document.querySelector('#dc-owned-optin-enable').click();
      return document.querySelector('#dc-owned-optin-status').textContent;
    }""")
    assert page.locator("#dc-owned-optin-enable").is_checked(),status

    # The optional settings details popover overlaps the original floating
    # arena launch button when left expanded. Collapse it through its real
    # summary toggle before opening the battle.
    page.locator("#dc-owned-optin summary").click()
    # The game defaults to its NDS two-screen skin, where the floating
    # liveBattleLaunch control is intentionally hidden. Switch through the
    # genuine visible display-mode button, then open the real arena.
    page.locator("#wideMode").click()
    assert not page.evaluate("document.body.classList.contains('mode-nds')")
    page.locator("#liveBattleLaunch").click()
    page.locator("#lbMode").select_option("owned")
    page.locator("#lbTeamSize").select_option("1")
    page.locator("#lbStart").click()
    page.wait_for_function("window.__dcOwnedBattleQa.snapshot().started",
                           timeout=8000)
    before=page.evaluate("window.__dcOwnedBattleQa.snapshot()")
    assert before["pendingId"], before
    assert len(before["fighters"])==2 and before["elapsed"]==0
    before_saved=page.evaluate(
      "() => JSON.parse(localStorage.getItem('dc_recreation_save'))")
    assert before_saved["pendingBattle"]["id"]==before["pendingId"]
    assert page.evaluate("""() => !!localStorage.getItem(
      DCBattleOwnedOptin.FIRST_BACKUP_KEY)""")

    # Exercise real original AI movement, collision, attacking and damage
    # until its normal victory/timeout callback fires.
    after=page.evaluate("window.__dcOwnedBattleQa.fastForward(3000)")
    assert after["finished"] and after["settled"],after
    assert after["winningSide"] in (0,1),after
    assert after["pendingId"] is None,after
    assert after["elapsed"]>0
    assert after["stats"]["movement"]>0 if "movement" in after["stats"] else after["stats"]["distance"]>0
    assert after["stats"]["hits"]>0,after["stats"]
    assert "새 전투 정산과 저장 완료" in page.locator(
      "#dc-owned-optin-status").inner_text()
    final=json.loads(after["saved"])
    assert "pendingBattle" not in final
    assert final["wins"]+final["losses"]==before_saved["wins"]+before_saved["losses"]+1
    assert final["wins"]==before_saved["wins"]+(after["winningSide"]==0)
    assert final["losses"]==before_saved["losses"]+(after["winningSide"]==1)
    assert final["team"][0]["evo"]["battles"]>=1
    assert "[DAY" in final["logs"][0]
    assert "승리" in final["logs"][0] if after["winningSide"]==0 else "패배" in final["logs"][0]

    # Reopen the actual page with fresh JS globals; it must load the same
    # stored state and not award a duplicate victory or extra cup prize.
    snapshot=json.dumps(final,ensure_ascii=False,sort_keys=True)
    page.reload(wait_until="domcontentloaded")
    page.locator("#dc-owned-optin").wait_for(timeout=20000)
    assert not page.locator("#dc-owned-optin-enable").is_checked()
    reloaded=page.evaluate(
      "() => JSON.parse(localStorage.getItem('dc_recreation_save'))")
    assert json.dumps(reloaded,ensure_ascii=False,sort_keys=True)==snapshot
    assert "pendingBattle" not in reloaded
    assert reloaded["wins"]==final["wins"]
    assert reloaded["losses"]==final["losses"]
    assert len(reloaded["logs"])==len(final["logs"])
    assert not errors,errors
    print("OK natural original owned-arena settlement",
          "touch" if mobile else "desktop",
          after["winningSide"],round(after["elapsed"],2),
          "simulated seconds")
    context.close()


def main():
    handler=functools.partial(QuietHandler,directory=str(ROOT))
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                host=f"http://127.0.0.1:{server.server_port}"
                check(browser,host,False)
                check(browser,host,True)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


if __name__=="__main__":
    import json
    main()
