"""Desktop/touch Chromium smoke of default-OFF optional real-game build.
Uses an isolated browser profile; never touches actual user saves.
"""
import functools
import http.server
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

def check(browser, host, mobile=False):
    settings={"viewport":{"width":390,"height":844} if mobile
             else {"width":1280,"height":800},
             "accept_downloads":True}
    if mobile:
        settings.update(is_mobile=True,has_touch=True,device_scale_factor=2)
    context=browser.new_context(**settings)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.goto(host+"/dist/battle-optin/index.html",wait_until="domcontentloaded")
    page.locator("#dc-owned-optin").wait_for(timeout=30000)
    assert page.evaluate("typeof DCBattleOwnedOptin?.commitFinished")=="function"
    assert page.evaluate("typeof DCBattleCommit?.persistCopy")=="function"
    assert not page.locator("#dc-owned-optin-enable").is_checked()
    page.locator("#dc-owned-optin summary").click()
    synced=page.evaluate("""() => {
      // Test-only storage writes in a brand-new, isolated browser context.
      const current=eval('state');
      if(!current || !Array.isArray(current.team))return false;
      localStorage.setItem('dc_recreation_save',JSON.stringify(current));
      return true;
    }""")
    assert synced
    page.locator("#dc-owned-optin-enable").click()
    status=page.locator("#dc-owned-optin-status").inner_text()
    assert page.locator("#dc-owned-optin-enable").is_checked(), status
    assert "다음 정상 종료" in status, status
    assert page.evaluate("""() => {
      const raw=localStorage.getItem('dc_recreation_save');
      return raw===localStorage.getItem(DCBattleOwnedOptin.BACKUP_KEY)
        && raw===localStorage.getItem(DCBattleOwnedOptin.FIRST_BACKUP_KEY);
    }""")
    with page.expect_download(timeout=12000) as downloaded:
        page.locator("#dc-owned-optin-download").click()
    assert downloaded.value.suggested_filename=="digicham-before-optin.json"
    page.locator("#dc-owned-optin-enable").uncheck()
    assert "기존 전투" in page.locator("#dc-owned-optin-status").inner_text()
    assert not page.locator("#dc-owned-optin-enable").is_checked()
    # A reload resets the experimental switch to OFF without deleting backup.
    page.reload(wait_until="domcontentloaded")
    page.locator("#dc-owned-optin").wait_for(timeout=20000)
    assert not page.locator("#dc-owned-optin-enable").is_checked()
    assert page.evaluate("""() => Boolean(
      localStorage.getItem(DCBattleOwnedOptin.FIRST_BACKUP_KEY)
    )""")
    assert not errors, errors
    print("OK optional owned battle UI", "touch" if mobile else "desktop",
          "default-off, explicit opt-in, backup, disable and reload")
    context.close()

def main():
    handler=functools.partial(QuietHandler,directory=str(ROOT))
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),handler)
    th=threading.Thread(target=server.serve_forever,daemon=True)
    th.start()
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
        server.shutdown();server.server_close();th.join(timeout=3)

if __name__=="__main__":
    main()
