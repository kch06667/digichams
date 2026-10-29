"""PR67: real PC original-game usability without mutating player saves.

Verifies keyboard help and contextual farm/capture/championship bar on BOTH
real original HTML entries, plus touch/mobile abstention. No image/ROM export.
"""
import functools
import http.server
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass


def stable_values(page):
    return page.evaluate("""() => {
      const s=eval('state');
      return {ids:s.team.map(m=>m.instanceId),
        wins:s.wins,losses:s.losses,
        crowns:JSON.stringify(s.championship?.crowns||{}),
        food:s.food,credits:s.facilityCredits};
    }""")


def check_desktop(browser,url,entry):
    ctx=browser.new_context(viewport={"width":1440,"height":900},
                            has_touch=False,is_mobile=False)
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda err:errors.append(str(err)))
    try:
        page.goto(url+"/"+entry,wait_until="domcontentloaded",timeout=90000)
        page.locator("#dc-phaser-engine").wait_for(state="attached",timeout=30000)
        guide=page.locator("#dc-pc-guide")
        guide.wait_for(state="visible",timeout=10000)
        assert page.locator("#dc-pc-guide-context").inner_text().startswith(
            "사육장"),page.locator("#dc-pc-guide-context").inner_text()
        assert page.locator('[data-dc-pc-tab="nursery"]').get_attribute(
            "aria-current")=="page"
        page.evaluate("""() => {
          eval('state').world.paused=true;
          save(false);
        }""")
        before=stable_values(page)

        # Navigation must reach the ORIGINAL tab, not a mock screen.
        page.keyboard.press("Alt+2")
        page.wait_for_function("""() =>
          document.querySelector('nav.tabs [data-tab="hunt"]')
            ?.classList.contains('active') &&
          DCPCGuide.snapshot()?.tab==='hunt'""")
        status=page.locator("#dc-pc-guide-context").inner_text()
        assert "포획" in status and "로프" in status,status
        page.locator("#dc-pc-guide-jump").click()
        assert page.locator("#huntStage").count()==1
        assert page.locator('[data-dc-pc-tab="hunt"]').get_attribute(
            "aria-current")=="page"

        page.keyboard.press("Alt+3")
        page.wait_for_function("""() =>
          document.querySelector('nav.tabs [data-tab="battle"]')
            ?.classList.contains('active') &&
          DCPCGuide.snapshot()?.tab==='battle'""")
        assert "승" in page.locator("#dc-pc-guide-context").inner_text()
        assert "대회" in page.locator("#dc-pc-guide-jump").inner_text()
        page.locator("#dc-pc-guide-jump").click()
        assert page.locator("#championshipPanel").count()==1

        page.keyboard.press("Alt+1")
        page.wait_for_function("""() => DCPCGuide.snapshot()?.tab==='nursery'""")
        page.locator("#dc-pc-guide-help summary").click()
        assert page.locator("#dc-pc-guide-help").get_attribute("open") is not None
        assert "Alt+1" in page.locator("#dc-pc-guide-help").inner_text()

        # In a focused editor, a hotkey must NOT switch screen or
        # cause unintended training/capture or overwrite player input.
        field=page.locator("#hexCageGoalValue")
        field.focus()
        page.keyboard.press("Alt+2")
        assert page.locator('nav.tabs [data-tab="nursery"]').get_attribute(
            "class") is not None
        assert page.evaluate("""() => document.querySelector(
          'nav.tabs button.active')?.dataset.tab""")=="nursery"

        # An actual failed image, not a slow/loading sprite, must produce
        # an explicit warning without replacing the source art.
        page.evaluate("""() => {
          const n=document.createElement('div');
          n.className='hexActor';n.id='dc-pc-qa-broken';
          n.style.cssText='position:fixed;top:170px;left:35px;width:40px;height:40px';
          const i=document.createElement('img');
          i.src='data:image/png;base64,@@invalid@@';
          n.appendChild(i);document.querySelector('#farmPanel').appendChild(n);
        }""")
        page.wait_for_function("""() => {
          const n=document.querySelector('#dc-pc-qa-broken img');
          return n?.complete && n?.naturalWidth===0 &&
            DCPCGuide.snapshot()?.missing>0;
        }""",timeout=10000)
        assert "이미지" in page.locator("#dc-pc-guide-graphics").inner_text()
        page.locator("#dc-pc-qa-broken").evaluate("(el)=>el.remove()")
        page.wait_for_function("() => DCPCGuide.snapshot()?.missing===0")
        assert page.locator("#dc-pc-guide-graphics").is_hidden()

        after=stable_values(page)
        assert before==after,(before,after)
        assert not errors,errors
        print("PASS original",entry,"PC guide keyboard nav, input protection, "
              "farm/hunt/cup status, missing-art warning, save unchanged",
              flush=True)
    finally:ctx.close()


def check_mobile(browser,url):
    ctx=browser.new_context(viewport={"width":390,"height":844},
                            is_mobile=True,has_touch=True)
    page=ctx.new_page()
    try:
        page.goto(url+"/standalone.html",wait_until="domcontentloaded",
                  timeout=90000)
        page.locator("#dc-phaser-engine").wait_for(state="attached")
        assert page.locator("#dc-pc-guide").count()==0
        assert page.evaluate("window.DCPCGuide===undefined")
        assert page.locator('nav.tabs [data-tab="hunt"]').count()==1
        print("PASS original mobile touch unchanged: PC guide not injected",
              flush=True)
    finally:ctx.close()


def main():
    srv=http.server.ThreadingHTTPServer(
        ("127.0.0.1",0),functools.partial(Quiet,directory=str(ROOT)))
    thread=threading.Thread(target=srv.serve_forever,daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                url=f"http://127.0.0.1:{srv.server_port}"
                for entry in ("index.html","standalone.html"):
                    check_desktop(browser,url,entry)
                check_mobile(browser,url)
            finally:browser.close()
    finally:
        srv.shutdown();srv.server_close();thread.join(timeout=3)


if __name__=="__main__":
    main()
