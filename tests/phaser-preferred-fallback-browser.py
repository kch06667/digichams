"""PR56: explicit Phaser-first beta and safe manual legacy fallback.

Runs the original full playable game, not a mock UI. Nothing is committed
to the user's save on a failed popup; the normal HTML stays unchanged.
"""
import functools
import http.server
import subprocess
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def run(browser,base,mobile):
    settings={'viewport':{'width':390,'height':844} if mobile else
             {'width':1280,'height':800},
             'is_mobile':mobile,'has_touch':mobile}
    ctx=browser.new_context(**settings)
    try:
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        entry='/index.phaser.html?phaserBattle=1'

        # No query opt-in: the existing engine must remain default.
        page.goto(base+entry,wait_until='domcontentloaded',timeout=90000)
        page.locator('#dc-phaser-engine').wait_for(state='attached')
        assert page.locator('#dc-phaser-engine').input_value()=='legacy'
        assert page.locator('#dc-phaser-cup-engine').input_value()=='legacy'

        # Only the explicit flag promotes the beta choice, both for arena
        # and for tournament selection. It never auto-approves settlement.
        page.goto(base+entry+'&phaserPreferred=1',
                  wait_until='domcontentloaded',timeout=90000)
        page.locator('#dc-phaser-engine').wait_for(state='attached')
        assert page.locator('#dc-phaser-engine').input_value()=='phaser'
        assert page.locator('#dc-phaser-cup-engine').input_value()=='phaser'
        assert page.locator('#dc-phaser-farm-apply').is_hidden()
        assert page.evaluate("""() =>
          localStorage.getItem('dc_recreation_save_backup_phaser_dev_v1')
        """) is None

        page.locator('#wideMode').click()
        page.locator('#liveBattleLaunch').click()
        page.locator('#lbMode').select_option('owned')
        page.locator('#lbTeamSize').select_option('1')
        before=page.evaluate("""() => {
          const s=eval('state');
          s.world.paused=true;save(false);
          return {wins:s.wins,losses:s.losses,
            ids:s.team.map(m=>m.instanceId),
            stored:localStorage.getItem('dc_recreation_save')};
        }""")

        # Simulate popup blocking at the actual original Start click.
        # Phaser must NOT begin the old battle in the same event, nor
        # corrupt the current team; instead choose legacy for retry.
        page.evaluate("window.open=()=>null")
        page.locator('#lbStart').click()
        assert page.locator('#dc-phaser-engine').input_value()=='legacy'
        assert len(ctx.pages)==1
        rejected=page.evaluate("""() => {
          const s=eval('state');
          return {wins:s.wins,losses:s.losses,
            ids:s.team.map(m=>m.instanceId),pending:!!s.pendingBattle,
            backup:localStorage.getItem(
              'dc_recreation_save_backup_phaser_dev_v1')};
        }""")
        assert rejected['wins']==before['wins'],rejected
        assert rejected['losses']==before['losses'],rejected
        assert rejected['ids']==before['ids'],rejected
        assert not rejected['pending'] and rejected['backup'] is None,rejected
        assert '기존 전투' in page.locator('#dc-phaser-arena-note').inner_text()

        # The NEXT physical click takes the untouched old onclick path.
        page.locator('#lbStart').click()
        page.wait_for_function("""() => Boolean(eval('state').pendingBattle)""")
        assert page.locator('#liveBattle').evaluate(
            "(el)=>getComputedStyle(el).display!=='none'")
        assert len(ctx.pages)==1
        assert not errors,errors
        print('PASS', 'touch' if mobile else 'desktop',
              'legacy default / explicit Phaser-first / popup denial / '
              'single-click manual legacy retry',flush=True)
    finally:
        ctx.close()


def main():
    # The original 6MB+ production HTML is read-only. The generated beta
    # page is local-only and untracked, built by the existing fail-closed tool.
    for filename in ['index.html','standalone.html']:
        original=(ROOT/filename).read_text(encoding='utf-8')
        # Real production now includes Phaser; the developer-only builder
        # must strip exactly that tagged group to keep beta tests isolated.
        assert original.count('<!-- DC-PHASER-PRODUCTION-BEGIN -->')==1,filename
    subprocess.run(['node','tools/build-phaser-optin-page.cjs'],
                   cwd=ROOT,check=True,capture_output=True,text=True)
    generated=(ROOT/'index.phaser.html').read_text(encoding='utf-8')
    assert 'DC-PHASER-PRODUCTION-BEGIN' not in generated
    assert generated.count('src/phaser-arena-entry-choice.js')==1
    server=http.server.ThreadingHTTPServer(
        ('127.0.0.1',0),
        functools.partial(QuietHandler,directory=str(ROOT)))
    t=threading.Thread(target=server.serve_forever,daemon=True)
    t.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                base=f'http://127.0.0.1:{server.server_port}'
                run(browser,base,False)
                run(browser,base,True)
            finally:browser.close()
    finally:
        server.shutdown();server.server_close();t.join(timeout=3)


if __name__=='__main__':main()
