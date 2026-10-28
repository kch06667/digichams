"""Six distinct indexed species graphics in the original autonomous Phaser arena.

No ROM/sprite output is published; manifests/PNGs are local ignored files.
Mobile and desktop use separate, ephemeral Chromium contexts.
"""
import functools
import http.server
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CDN="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"
VENDOR=ROOT/"node_modules/phaser/dist/phaser.min.js"
NAMES=["아구몬","파타몬","팔몬","가부몬","텐타몬","피요몬"]

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def check(browser,base,mobile):
    opts={"viewport":{"width":390,"height":844} if mobile else
          {"width":1280,"height":800}}
    if mobile:opts.update(is_mobile=True,has_touch=True,device_scale_factor=2)
    ctx=browser.new_context(**opts)
    page=ctx.new_page()
    errors=[];art_requests=[]
    page.on("pageerror",lambda err:errors.append(str(err)))
    page.on("request",lambda req:art_requests.append(req.url) if
            "/local-assets/species/" in req.url else None)
    if VENDOR.is_file():
        page.route(CDN,lambda route:route.fulfill(
            path=str(VENDOR),content_type="application/javascript"))
    page.goto(base+"/phaser-lab/",wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.DigiPhaserLab)",timeout=30000)
    assert not art_requests,"Auto-loaded species art before any battle!"
    stats=page.evaluate("DigiPhaserLab.localCatalogStatus()")
    assert stats["indexedSpecies"]==6,stats
    assert stats["residentCount"]==0,stats
    assert page.locator("#squadSize").input_value()=="3"
    page.locator("#battle").click()
    page.wait_for_function("""() => {
      const s=window.DigiPhaserLab?.matchSnapshot();
      const actors=window.DigiPhaserLab?.renderedArt();
      return s?.fighters?.length===6 && s.elapsed>0 &&
        actors?.length===6 && actors.every(a=>a.privateArt);
    }""",timeout=30000)
    actors=page.evaluate("DigiPhaserLab.renderedArt()")
    assert [a["name"] for a in actors]==NAMES,actors
    keys=[a["textureKey"] for a in actors]
    assert len(set(keys))==6,actors
    assert all("catalog%3Aspecies%2F" in key for key in keys),actors
    assert all(a["hasKoArt"] for a in actors),actors
    stats=page.evaluate("DigiPhaserLab.localCatalogStatus()")
    assert stats["residentCount"]==6 and set(stats["residentSpecies"])==set(NAMES)
    # At most 6*13 local battle spritesheets; never all 216*13.
    names={url.split("/local-assets/species/")[1].split("/")[0]
           for url in art_requests}
    assert len(names)==6,names
    assert len(art_requests)<=6*13+6, len(art_requests)
    assert page.evaluate("DigiPhaserLab.qaFinishCombat()")
    finished=page.evaluate("DigiPhaserLab.matchSnapshot()")
    assert finished["finished"] and finished["winner"] in (0,1),finished
    # Restart with only two fighters. Existing converted pack cache reused
    # without re-reading all 216 manifests or creating a new art identity.
    page.locator("#squadSize").select_option("1")
    page.locator("#battle").click()
    page.wait_for_function("""() => {
      const s=window.DigiPhaserLab?.matchSnapshot();
      return s?.fighters?.length===2 && s.elapsed>0 &&
        window.DigiPhaserLab.renderedArt().every(a=>a.privateArt);
    }""",timeout=30000)
    assert page.evaluate("DigiPhaserLab.localCatalogStatus().residentCount")==6
    assert not errors,errors
    print("OK lazy indexed 216-species infrastructure, six actual species in 3v3,",
          "touch" if mobile else "desktop")
    ctx.close()

def main():
    for name in NAMES:
        assert (ROOT/"phaser-lab/local-assets/catalog.json").is_file()
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),
          functools.partial(Handler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                base=f"http://127.0.0.1:{server.server_port}"
                check(browser,base,False)
                check(browser,base,True)
            finally:browser.close()
    finally:server.shutdown();server.server_close();thread.join(timeout=3)

if __name__=="__main__":main()
