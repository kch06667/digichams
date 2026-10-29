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


def verify_pc_layout(page,section,viewport):
    """Read the actual DOM geometry / applied CSS, not a mock screenshot.

    The source NDS-derived art stays private: screenshot files are not
    attached to CI artifacts or checked into public GitHub.
    """
    result=page.evaluate("""(section) => {
      const box=selector=>{
        const n=document.querySelector(selector),r=n?.getBoundingClientRect();
        return r?{width:r.width,height:r.height,left:r.left,right:r.right,
                  top:r.top,bottom:r.bottom}:null;
      };
      const buttons=[...document.querySelectorAll('nav.tabs button')].map(
        n=>({top:n.getBoundingClientRect().top,
             bottom:n.getBoundingClientRect().bottom,
             height:n.getBoundingClientRect().height,
             width:n.getBoundingClientRect().width}));
      const computed=selector=>{
        const e=document.querySelector(selector);
        return e?getComputedStyle(e):null;
      };
      const font=selector=>{
        const e=document.querySelector(selector);
        return e?parseFloat(getComputedStyle(e).fontSize):0;
      };
      return {
        section,width:innerWidth,documentWidth:document.documentElement.scrollWidth,
        cssReady:!!document.querySelector('#dc-pc-visual-polish')?.sheet,
        buttons,nav:getComputedStyle(document.querySelector('nav.tabs')).gridTemplateColumns,
        viewport:box('#farmPanel .farmViewport'),
        map:box('#farmPanel .farmWorld'),
        // Some original entries embed the SAME 920x690 WebP atlas as a
        // data: URI instead of serving the asset pathname. Never dump
        // the copyright-protected full bitmap into CI failure logs.
        mapBackground:(computed('#farmPanel .farmWorld')?.backgroundImage||'').slice(0,115),
        hunt:box('#huntStage'),
        huntFont:font('#huntInstructions'),
        actionButtons:[...document.querySelectorAll('#huntActionBar button')].map(
          el=>({height:el.getBoundingClientRect().height,
                width:el.getBoundingClientRect().width})),
        cup:box('#championshipPanel'),
        cupCards:[...document.querySelectorAll('#championshipCalendar .championshipCup')].map(
          n=>({width:n.getBoundingClientRect().width,
                height:n.getBoundingClientRect().height})),
        battleGrid:computed('#battle>.layout')?.gridTemplateColumns||''
      };
    }""",section)
    assert result["cssReady"],result
    assert result["width"]==viewport,result
    assert result["documentWidth"]<=viewport+2,result
    # Five original tabs must be on ONE row, each with a proper mouse
    # target. Before PR68 the fifth ROM tab wrapped to a separate row.
    assert len(result["buttons"])==5,result
    assert max(x["top"] for x in result["buttons"]) - min(
        x["top"] for x in result["buttons"])<3,result
    # Compact PC shell uses 34px game tabs rather than the previous 45px web tabs.\n    assert min(x["height"] for x in result["buttons"])>=32,result
    assert min(x["width"] for x in result["buttons"])>=80,result
    if section=="nursery":
        assert result["viewport"]["height"]>=375,result
        assert result["viewport"]["width"]>=680,result
        # The original NDS-style farm atlas is not stretched/moved.
        assert abs(result["map"]["width"]-920)<1,result
        assert abs(result["map"]["height"]-690)<1,result
        assert ("connected_ranch_field.svg" in result["mapBackground"] or
                "hex_farm_v0232.webp" in result["mapBackground"] or
                "data:image/webp;base64," in result["mapBackground"]),result
    if section=="hunt":
        assert result["hunt"]["width"]>=440,result
        assert result["hunt"]["height"]>=260,result
        assert result["huntFont"]>=13.5,result
        assert len(result["actionButtons"])>=4,result
        assert min(x["height"] for x in result["actionButtons"])>=45,result
    if section=="battle":
        assert result["cup"]["width"]>700,result
        assert len(result["cupCards"])>=1,result
        assert min(x["width"] for x in result["cupCards"])>=235,result
    print("PASS PC",viewport,section,"visual geometry: "
          "single-row 5 tabs, readable buttons, no page overflow",
          flush=True)
    return result


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
        guide.wait_for(state="attached",timeout=10000)
        assert guide.is_hidden(), "PC game shell intentionally hides legacy guide"
        page.locator('#dc-pc-drawer-toggle').wait_for(state='visible',timeout=10000)
        page.wait_for_function("() => window.DCConnectedRanch?.ready===true",timeout=10000)
        assert page.locator('#dc-pc-ranch-toggle').is_visible()
        page.wait_for_function(
            "Boolean(document.querySelector('#dc-pc-visual-polish')?.sheet)",
            timeout=10000)
        # The source game intentionally starts in a 560px NDS-style
        # two-screen shell; its farm window is only 330px tall. Do NOT
        # silently replace that player's display preference. Use the
        # real original 'wideMode' button via the new discoverable PC CTA.
        if page.evaluate("document.body.classList.contains('mode-nds')"):
            page.locator("#wideMode").evaluate("(el) => el.click()")
        page.wait_for_function("""() =>
          document.querySelector('nav.tabs button[data-tab="nursery"]')
            ?.getBoundingClientRect().width>30""",timeout=12000)
        assert not page.evaluate("document.body.classList.contains('mode-nds')")
        assert page.locator("#dc-pc-guide-wide").is_hidden()
        verify_pc_layout(page,"nursery",1440)
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
        verify_pc_layout(page,"hunt",1440)
        status=page.locator("#dc-pc-guide-context").inner_text()
        assert "포획" in status and "로프" in status,status
        # In the remaster the native tab is the visible control.
        assert page.locator('nav.tabs [data-tab="hunt"]').is_visible()
        page.locator('#huntStage').scroll_into_view_if_needed()
        assert page.locator("#huntStage").count()==1
        assert page.locator('[data-dc-pc-tab="hunt"]').get_attribute(
            "aria-current")=="page"

        page.keyboard.press("Alt+3")
        page.wait_for_function("""() =>
          document.querySelector('nav.tabs [data-tab="battle"]')
            ?.classList.contains('active') &&
          DCPCGuide.snapshot()?.tab==='battle'""")
        verify_pc_layout(page,"battle",1440)
        assert "승" in page.locator("#dc-pc-guide-context").inner_text()
        assert "대회" in page.locator("#dc-pc-guide-jump").inner_text()
        page.locator('#championshipPanel').scroll_into_view_if_needed()
        assert page.locator("#championshipPanel").count()==1

        page.keyboard.press("Alt+1")
        page.wait_for_function("""() => DCPCGuide.snapshot()?.tab==='nursery'""")
        # Narrow PC window: same source farm, field and cup all remain
        # reachable and with no body-wide horizontal overflow.
        page.set_viewport_size({"width":1024,"height":768})
        verify_pc_layout(page,"nursery",1024)
        page.locator('#dc-pc-drawer-toggle').click()
        page.locator('#dc-pc-drawer-close').wait_for(state='visible')
        page.locator('#dc-pc-drawer-close').click()
        assert "Alt+1" in page.locator("#dc-pc-guide-help").text_content()

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
        assert page.locator("#dc-pc-visual-polish").count()==0
        assert page.evaluate("window.DCPCGuide===undefined")
        assert page.evaluate("window.DCConnectedRanch===undefined")
        assert page.locator("#dc-pc-ranch-toggle").count()==0
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
