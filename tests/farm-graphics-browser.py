"""Verify the v0.23.2 farm art in both HTML builds at desktop and touch sizes.

Run from the repository root:
    python3 tests/farm-graphics-browser.py
Needs Python Playwright + Chromium (CHROMIUM_PATH optional).
Does not modify game files, saves or repository state.
"""
import functools
import http.server
import os
import re
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSET = "assets/farm/hex_farm_v0232.webp"
EXPECTED_DIMS = [920, 690]
errors = []

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def check(page, entry, mobile):
    page.goto(f"http://127.0.0.1:{server.server_port}/{entry}", wait_until="load", timeout=90000)
    page.wait_for_function("!!window.DCHexFarm && !!document.getElementById('farmWorld')", timeout=45000)
    page.locator('[data-tab="nursery"]').click()
    assert page.locator('#farmWorld .hexTile').count() == 7
    assert page.locator('#farmWorld .hexActor').count() > 0

    bg = page.locator('#farmWorld').evaluate(
        "(node) => getComputedStyle(node).backgroundImage"
    )
    if not mobile:
        # The PC honeycomb must NOT leave the baked-in radial WebP beneath
        # the new adjacent cells. Verify the actual connected pixel pasture.
        assert page.evaluate('window.DCFarm.PC_HONEYCOMB === true'), entry
        assert 'radial-gradient' in bg, f"Missing PC honeycomb ground in {entry}: {bg[:100]}"
        visible = page.locator('#farmWorld .hexTile').evaluate_all(
            "(nodes) => nodes.filter(n => getComputedStyle(n).visibility !== 'hidden').length"
        )
        assert visible == 1, f"new PC ranch should show its one built core, got {visible}"
        art = page.locator('#farmWorld .hexTile[data-hex="core"]').evaluate(
            """node => ({
                image:getComputedStyle(node).backgroundImage,
                position:getComputedStyle(node).backgroundPosition
            })"""
        )
        assert 'hex_farm_v0232.webp' in art['image'], f"PC must reuse the source tile artwork: {art}"
        assert art['position'] == '-350px -227px', f"Wrong original core crop: {art}"

    else:
        assert bg.startswith('url('), f"Missing original mobile background in {entry}: {bg[:100]}"
        assert bg.startswith('url(') and bg.endswith(')'), bg[:100]
        url = bg[4:-1].strip(chr(34) + chr(39))
        if entry == 'standalone.html':
            assert url.startswith("data:image/webp;base64,"), "Standalone must embed its WebP"
        else:
            assert url.endswith('/' + ASSET), "Mobile original game must use the farm WebP"
        dimensions = page.evaluate("""async url => {
            const image = new Image();
            image.src = url;
            await image.decode();
            return [image.naturalWidth, image.naturalHeight];
        }""", url)
        assert dimensions == EXPECTED_DIMS, f"Wrong/missing original backdrop {dimensions}"

    if not mobile:
        page.locator('#dc-pc-drawer-toggle').click()
        assert page.locator('#dc-pc-live-commands #hexDrop').count() == 1

    before = page.evaluate('state.food')
    action = 'tap' if mobile else 'click'
    getattr(page.locator('#hexDrop'), action)()
    assert page.evaluate('state.food') == before, "Selecting food must not charge immediately"
    getattr(page.locator('[data-hex="core"]'), action)()
    assert page.evaluate('state.food') == before - 1
    assert page.locator('#farmWorld .hexFood').count() >= 1
    assert not errors, errors
    print('PASS', entry, 'touch' if mobile else 'desktop',
          '920x690 art / seven hexes / actors / food placement', flush=True)

server = http.server.ThreadingHTTPServer(
    ('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT))
)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        opts = {"args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if os.environ.get("CHROMIUM_PATH"):
            opts["executable_path"] = os.environ["CHROMIUM_PATH"]
        browser = pw.chromium.launch(**opts)
        try:
            for entry in ("index.html", "standalone.html"):
                for mobile in (False, True):
                    context = browser.new_context(
                        viewport={'width': 390 if mobile else 1365, 'height': 844 if mobile else 900},
                        is_mobile=mobile, has_touch=mobile
                    )
                    try:
                        page = context.new_page()
                        page.on('pageerror', lambda error: errors.append(str(error)))
                        check(page, entry, mobile)
                    finally:
                        context.close()
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
