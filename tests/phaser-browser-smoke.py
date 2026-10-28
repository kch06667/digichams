"""Chromium smoke checks for copyright-free Phaser scene: desktop and touch."""
import contextlib
import functools
import http.server
import os
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "node_modules" / "phaser" / "dist" / "phaser.min.js"
CDN = "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass


def check_page(browser, mobile, base_url):
    kwargs = {"viewport": {"width": 390, "height": 844} if mobile
              else {"width": 1280, "height": 800}}
    if mobile:
        kwargs.update({"is_mobile": True, "has_touch": True,
                       "device_scale_factor": 2})
    context = browser.new_context(**kwargs)
    page = context.new_page()
    if VENDOR.is_file():
        page.route(CDN, lambda route: route.fulfill(
            path=str(VENDOR), content_type="application/javascript"))
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base_url + "/phaser-lab/", wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.DigiPhaserLab)", timeout=30000)
    page.locator("#game canvas").wait_for(timeout=10000)
    assert "준비 완료" in page.locator("#status").inner_text()
    if (ROOT / "phaser-lab" / "local-assets" / "manifest.json").is_file():
        assert "변환된 GIF 모션" in page.locator("#status").inner_text()
    assert page.evaluate("DigiPhaserLabLogic.selectAction('victory')") == 30
    assert page.evaluate("DigiPhaserLabLogic.selectAction('training')") == 32
    if mobile:
        assert page.locator("#game canvas").bounding_box()["width"] <= 390
    page.locator("#train").click()
    page.wait_for_function(
        "document.querySelector('#status').textContent.includes('훈련 1회 완료')",
        timeout=7000)
    assert "11" in page.locator("#game").evaluate(
        "(el) => window.DigiPhaserLabLogic.gainTrainingStat(10,1).toString()")
    page.locator("#battle").click()
    page.wait_for_function(
        "document.querySelector('#status').textContent.includes('시연 중')",
        timeout=7000)
    page.wait_for_function(
        "document.querySelector('#status').textContent.includes('승리')",
        timeout=25000)
    # Existing rules are loaded into the real browser, and read-only JSON
    # inspection must not touch browser localStorage or the active scene.
    assert page.evaluate("typeof DigiDomainBridge.plan")=="function"
    assert page.evaluate("DigiPhaserLab.cupPreview().length")==3
    page.locator("#tactic").select_option("conserve")
    assert page.evaluate("DigiDomainBridge.plan(Object.assign("
      "DigiDomainBridge.newEncounter('conserve'),{ally:"
      "Object.assign({},DigiDomainBridge.newEncounter('conserve').ally,{tp:30})})).action")=="normal"
    import json
    sample={"format":"digicham-save","exportVersion":1,
      "state":{"day":10,"wins":6,
        "championship":{"crowns":{"novice":1,"regional":1}},
        "team":[{"name":"시험용 디지몬","hp":80,"maxHp":100,
          "atk":25,"def":12,"spd":34,"tp":35}]}}
    page.locator("#saveFile").set_input_files({
      "name":"test-save.json","mimeType":"application/json",
      "buffer":json.dumps(sample,ensure_ascii=False).encode("utf-8")})
    page.wait_for_function(
      "document.querySelector('#status').textContent.includes('세이브 읽기 전용 확인')",
      timeout=5000)
    assert page.evaluate("DigiPhaserLab.importedSavePreview().team[0].name")=="시험용 디지몬"
    page.locator("#cups").click()
    assert "대회 규칙" in page.locator("#status").inner_text()
    assert not errors, f"JS errors ({'mobile' if mobile else 'desktop'}): {errors}"
    print("OK", "touch" if mobile else "desktop",
          "training + auto battle + victory")
    context.close()


def check_farm(browser, mobile, base_url):
    kwargs={"viewport":{"width":390,"height":844} if mobile
            else {"width":1280,"height":800}}
    if mobile:
        kwargs.update({"is_mobile":True,"has_touch":True,
                       "device_scale_factor":2})
    context=browser.new_context(**kwargs)
    page=context.new_page()
    if VENDOR.is_file():
        page.route(CDN,lambda route:route.fulfill(
            path=str(VENDOR),content_type="application/javascript"))
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    page.goto(base_url+"/phaser-lab/farm.html",wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.DigiFarmLab)",timeout=30000)
    canvas=page.locator("#farm canvas")
    box=canvas.bounding_box()
    assert box and box["width"] <= (390 if mobile else 1280)
    assert page.evaluate("DigiFarmLabModel.initial().rows")==2
    assert page.evaluate("DigiFarmLabModel.FOOD_BITES")==4
    # Real mouse/touch selection in the game canvas at the second hex cell.
    canvas.click(position={"x":221*box["width"]/800,
                           "y":175*box["height"]/450})
    page.wait_for_function(
        "document.querySelector('#status').textContent.includes('2열 선택')",
        timeout=5000)
    page.locator("#buy").click()
    page.wait_for_function(
        "document.querySelector('#status').textContent.includes('배치 완료')",
        timeout=5000)
    page.locator("#feed").click()
    page.wait_for_function(
        "document.querySelector('#status').textContent.includes('먹이 배치')",
        timeout=5000)
    try:
        page.wait_for_function(
            "() => window.DigiFarmLab.snapshot().cages['0:1'].food === 0",
            timeout=12000)
    except Exception:
        print("Farm feeding diagnostic:",
              page.locator("#status").inner_text(),
              page.evaluate("window.DigiFarmLab.snapshot()"),
              errors)
        raise
    page.locator("#expand").click()
    page.wait_for_function(
        "document.querySelector('#status').textContent.includes('행 개방')",
        timeout=5000)
    assert not errors,f"Farm runtime JS errors: {errors}"
    print("OK farm","touch" if mobile else "desktop","cage/feed/expand")
    context.close()


def main():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as p:
            chrome = os.environ.get("CHROMIUM_PATH")
            browser = p.chromium.launch(headless=True,
                                        executable_path=chrome or None,
                                        args=["--use-gl=angle", "--use-angle=swiftshader"])
            try:
                check_page(browser, False, host)
                check_page(browser, True, host)
                check_farm(browser, False, host)
                check_farm(browser, True, host)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
