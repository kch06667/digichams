"""Real Chromium localStorage behavior for the isolated battle commit helper.

The quota/security failures below are deterministic *in-browser injections*,
not claims about reaching the device's physical quota or Android stability.
"""
import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass


def check(browser, base_url, mobile=False):
    options = {"viewport": {"width": 390, "height": 844}
               if mobile else {"width": 1280, "height": 800}}
    if mobile:
        options.update(is_mobile=True, has_touch=True, device_scale_factor=2)
    context = browser.new_context(**options)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base_url + "/tests/fixtures/battle-commit-browser.html",
              wait_until="load")
    assert page.evaluate(
        "typeof DCBattleCommit?.persistCopy === 'function'")
    key = "dc_recreation_save"

    result = page.evaluate("""() => {
      const {state,args}=qaBattle(),key=DCBattleCommit.SAVE_KEY;
      const old=JSON.stringify(state);
      localStorage.setItem(key,old);
      const staged=DCBattleCommit.persistCopy(state,args,localStorage);
      return {
        sameOriginal:JSON.stringify(state)===old,
        committed:JSON.stringify(staged.state)===localStorage.getItem(key),
        hasPending:!!staged.state.pendingBattle,
        battleWon:staged.receipt.won
      };
    }""")
    assert result == {"sameOriginal": True, "committed": True,
                      "hasPending": False, "battleWon": True}, result
    page.reload(wait_until="load")
    assert page.evaluate(
      "() => JSON.parse(localStorage.getItem(DCBattleCommit.SAVE_KEY)).pendingBattle===undefined")
    # A second tab cannot settle the same old state again.
    replay = page.evaluate("""() => {
      const {state,args}=qaBattle();
      try {DCBattleCommit.persistCopy(state,args,localStorage);return 'accepted';}
      catch(e){return e.message;}
    }""")
    assert "stale" in replay, replay

    for kind in ("quota", "denied", "silent-drop", "blocked-read"):
        outcome = page.evaluate("""kind => {
          const {state,args}=qaBattle(),key=DCBattleCommit.SAVE_KEY;
          const prior=JSON.stringify(state);
          localStorage.setItem(key,prior);
          const savedSet=Storage.prototype.setItem;
          const savedGet=Storage.prototype.getItem;
          let issue=null;
          try {
            if(kind==='blocked-read'){
              Storage.prototype.getItem=function(k) {
                if(k===key)throw new DOMException('Denied', 'SecurityError');
                return savedGet.call(this,k);
              };
            } else {
              Storage.prototype.setItem=function(k,v) {
                if(k===key && kind==='silent-drop')return undefined;
                if(k===key)throw new DOMException('Injected failure',
                  kind==='quota'?'QuotaExceededError':'SecurityError');
                return savedSet.call(this,k,v);
              };
            }
            try {DCBattleCommit.persistCopy(state,args,localStorage);
              issue='wrongly accepted';
            } catch(e){issue=e.name+':'+e.message;}
          }finally{
            Storage.prototype.setItem=savedSet;
            Storage.prototype.getItem=savedGet;
          }
          return {issue,saveKept:localStorage.getItem(key)===prior,
            sourceKept:JSON.stringify(state)===prior};
        }""", kind)
        assert outcome["saveKept"] and outcome["sourceKept"], (kind,outcome)
        if kind == "quota":
            assert "QuotaExceededError" in outcome["issue"], outcome
        elif kind in ("denied", "blocked-read"):
            assert "SecurityError" in outcome["issue"], outcome
        else:
            assert "verification failed" in outcome["issue"], outcome
        page.reload(wait_until="load")
        assert page.evaluate("""() => {
            const snapshot=JSON.parse(localStorage.getItem('dc_recreation_save'));
            return snapshot.pendingBattle?.id==='qa-battle';
        }"""), kind

    migration = page.evaluate("""() => {
      const legacy={saveVersion:1,day:3,logs:['old'],
        team:[{name:'아구몬',hp:100,maxHp:120,level:1,exp:0}]};
      const oldBytes=JSON.stringify(legacy),key=DCBattleCommit.SAVE_KEY;
      localStorage.setItem(key,oldBytes);
      const {state,args}=qaBattle();
      const prebattle=JSON.stringify(state);
      let refused=false;
      try{DCBattleCommit.persistCopy(state,args,localStorage);}
      catch(e){refused=/stale/.test(e.message);}
      const preserved=localStorage.getItem(key)===oldBytes;
      // This explicit QA-only checkpoint simulates the future game's
      // dedicated migration and backup step. persistCopy never does it.
      localStorage.setItem('qa_legacy_backup',oldBytes);
      localStorage.setItem(key,prebattle);
      const staged=DCBattleCommit.persistCopy(state,args,localStorage);
      return {refused,preserved,
        backupKept:localStorage.getItem('qa_legacy_backup')===oldBytes,
        committed:JSON.stringify(staged.state)===localStorage.getItem(key),
        oldSourceKept:JSON.stringify(state)===prebattle};
    }""")
    assert all(migration.values()), migration
    page.reload(wait_until="load")
    assert page.evaluate("""() => {
      const s=JSON.parse(localStorage.getItem('dc_recreation_save'));
      return !s.pendingBattle && s.team[0].instanceId==='qa-1' &&
        !!localStorage.getItem('qa_legacy_backup');
    }""")
    assert not errors, errors
    print("OK isolated browser battle storage:", "touch" if mobile else "desktop",
          "commit/reload, stale replay, simulated quota/access, legacy checkpoint")
    context.close()


def main():
    handler = functools.partial(Handler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            try:
                base = f"http://127.0.0.1:{server.server_port}"
                check(browser, base, mobile=False)
                check(browser, base, mobile=True)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=3)


if __name__ == "__main__":
    main()
