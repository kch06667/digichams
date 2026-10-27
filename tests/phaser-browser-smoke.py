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
    assert not errors, f"JS errors ({'mobile' if mobile else 'desktop'}): {errors}"
    print("OK", "touch" if mobile else "desktop",
          "training + auto battle + victory")
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
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
