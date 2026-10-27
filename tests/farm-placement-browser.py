"""Real HTTP browser checks for farm placement and save roundtrip; no result files in source."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
errors = []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox','--disable-dev-shm-usage'])
        for entry in ['index.html', 'standalone.html']:
            for mobile in [False, True]:
                context = browser.new_context(viewport={'width':390 if mobile else 1365,'height':844 if mobile else 900}, is_mobile=mobile, has_touch=mobile)
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(f'http://127.0.0.1:{server.server_port}/{entry}', wait_until='load')
                page.wait_for_function('!!window.DCHexFarm')
                page.evaluate('state.world.paused=true')
                for mode in ['dsMode','wideMode']:
                    page.locator('#'+mode).click()
                    page.locator('[data-tab="nursery"]').click()
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
                # Click/tap on the core hex; the food must wait until placement, then be consumed once.
                action = 'tap' if mobile else 'click'
                before = page.evaluate('state.food')
                getattr(page.locator('#hexDrop'), action)()
                assert page.evaluate('state.food') == before
                getattr(page.locator('[data-hex="core"]'), action)()
                assert page.evaluate('state.food') == before-1
                assert page.locator('.hexFood').count() == 1
                snapshot = page.evaluate('DCHexFarm.exportSaveObject()')
                page.evaluate('state.world.paused=false; DCHexFarm.tick(10); state.world.paused=true')
                assert page.evaluate('state.farm.foods.length') == 0
                page.evaluate('(data)=>DCHexFarm.importSaveObject(data)', snapshot)
                assert page.evaluate('state.farm.foods.length') == 1
                # Invalid placement keeps placement mode armed and spends nothing.
                getattr(page.locator('#hexDrop'), action)()
                page.evaluate("""() => {const w=document.getElementById('farmWorld'),r=w.getBoundingClientRect();
                    w.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+5,clientY:r.top+5}));}""")
                assert page.evaluate('state.food') == before-1
                assert page.evaluate("document.getElementById('farmWorld').classList.contains('foodPlacement')")
                getattr(page.locator('#hexDrop'), action)()
                # Persistent HTTP localStorage, not about:blank emulation.
                page.reload(wait_until='load')
                page.wait_for_function('!!window.DCHexFarm')
                assert page.evaluate('state.food') == before-1
                assert page.evaluate('state.farm.foods.length') == 1
                assert not errors, errors
                print('PASS',entry,'touch' if mobile else 'desktop','placement / eat / import / reload / both layouts',flush=True)
                context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
