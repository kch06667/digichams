"""Two ACTUAL species sprites in original-AI 1v1, isolated Chromium desktop/touch.

Run only after local (ignored) Agumon+Gabumon atlas conversion. The test
never sends private sprite sheets to a service or publishes them as artifacts.
"""
import functools
import hashlib
import http.server
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
VENDOR=ROOT/"node_modules/phaser/dist/phaser.min.js"
CDN="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass


def open_page(browser,origin,mobile=False,missing=False):
    settings={"viewport":{"width":390,"height":844} if mobile
              else {"width":1280,"height":800}}
    if mobile:
        settings.update(is_mobile=True,has_touch=True,device_scale_factor=2)
    ctx=browser.new_context(**settings)
    page=ctx.new_page()
    if VENDOR.exists():
        page.route(CDN,lambda route:route.fulfill(
            path=str(VENDOR),content_type="application/javascript"))
    if missing:
        page.route("**/local-assets/duel-gabumon/manifest.json",
            lambda route:route.fulfill(status=404,content_type="application/json",
                                       body='{"missing":true}'))
    js_errors=[]
    page.on("pageerror",lambda err:js_errors.append(str(err)))
    page.goto(origin+"/phaser-lab/",wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.DigiPhaserLab)",timeout=30000)
    ready=page.evaluate("DigiPhaserLab.duelStatus()")
    if missing:
        assert not ready["ready"],ready
        assert ready["names"]==[],ready
        ctx.close()
        return
    assert ready["ready"] and ready["names"]==["아구몬","가부몬"],ready
    page.locator("#duel").click()
    page.wait_for_function("""() => {
      const s=window.DigiPhaserLab?.matchSnapshot();
      return s && s.fighters.length===2 && s.elapsed>0
        && s.fighters[0].name==='아구몬'
        && s.fighters[1].name==='가부몬';
    }""",timeout=12000)
    rendered=page.evaluate("DigiPhaserLab.renderedArt()")
    assert len(rendered)==2,rendered
    assert rendered[0]["name"]=="아구몬" and rendered[0]["privateArt"],rendered
    assert rendered[1]["name"]=="가부몬" and rendered[1]["privateArt"],rendered
    assert rendered[0]["textureKey"]!=rendered[1]["textureKey"],rendered
    assert all("duel%3Aduel-" in entry["textureKey"] for entry in rendered),rendered
    # Real Phaser animations must retain the GIF delays exported privately:
    # Phaser's per-frame duration is an ADDITIONAL delay.
    timings=page.evaluate("""async () => {
      const data=[];
      for(const folder of ['duel-agumon','duel-gabumon']){
        const manifest=await (await fetch(
          './local-assets/'+folder+'/manifest.json')).json();
        for(const [id,cfg] of Object.entries(manifest.actions)){
          if(cfg.frames<2)continue;
          const key='realtime-'+encodeURIComponent('duel:'+folder)+'-'+id;
          const timing=DigiPhaserLab.animationFrameTiming('duel:'+folder,id);
          if(!timing)throw Error('Missing animation '+key);
          data.push({key,expected:cfg.durationsMs,
            actual:timing.extraMs.map(ms=>timing.baseMs+ms)});
        }
      }
      return data;
    }""")
    assert timings,"Expected multi-frame original art for GIF timing check"
    for item in timings:
        assert len(item["expected"])==len(item["actual"]),item
        assert all(abs(expected-actual)<0.01 for expected,actual in zip(
            item["expected"],item["actual"])),item
    # Playback speed must follow the original simulation's 2x default,
    # then 3x/1x/2x without restarting the live autonomous battle.
    # This checks ACTUAL sprite AnimationState.timeScale on both species.
    for index,expected in enumerate([2,3,1,2]):
        if index:
            page.locator("#speed").click()
        speeds=page.evaluate("DigiPhaserLab.renderedArt()")
        assert [entry["animationTimeScale"] for entry in speeds]==[
            expected,expected],speeds
        assert f"속도 {expected}×" in page.locator("#speed").inner_text()
    # A new pose may start after the speed was toggled. Ensure the latest
    # speed survives combat updates instead of being reset to Phaser's 1x.
    page.wait_for_timeout(300)
    assert all(entry["animationTimeScale"]==2 for entry in
               page.evaluate("DigiPhaserLab.renderedArt()"))
    # Genuine original AI completes: no forced damage, winner or reward.
    assert page.evaluate("DigiPhaserLab.qaFinishCombat()")
    finished=page.evaluate("DigiPhaserLab.matchSnapshot()")
    assert finished["finished"] and finished["winner"] in [0,1],finished
    assert finished["stats"]["hits"]>0
    assert not js_errors,js_errors
    print("OK private-original duel", "touch" if mobile else "desktop",
          "real Agumon + Gabumon motion, auto-AI, completed 1v1")
    ctx.close()


def main():
    root=ROOT/"phaser-lab/local-assets"
    a=root/"duel-agumon/action_0.png"
    b=root/"duel-gabumon/action_0.png"
    assert a.is_file() and b.is_file(),"Run export-phaser-duel.py first"
    assert hashlib.sha256(a.read_bytes()).digest()!=hashlib.sha256(
        b.read_bytes()).digest(),"Species art must actually differ"
    handler=functools.partial(QuietHandler,directory=str(ROOT))
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                url=f"http://127.0.0.1:{server.server_port}"
                open_page(browser,url,mobile=False)
                open_page(browser,url,mobile=True)
                open_page(browser,url,missing=True)
            finally:
                browser.close()
    finally:
        server.shutdown();server.server_close();thread.join(timeout=3)


if __name__=="__main__":
    main()
