"""Bounded two-hour *simulated* farm soak on the original playable HTML.

Runs real UI, original farm simulation, localStorage and reload in Chromium.
A simulated 7,200-second world advance is NOT two wall-clock hours or a
physical Android device test. CDP JS heap is an indicative regression signal.
"""
import functools
import http.server
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
KEY = "dc_recreation_save"
CYCLES = 30
STEP_SECONDS = 60
SPEED = 4
MIB = 1024 * 1024


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def read_metrics(cdp):
    # Only compare post-GC samples in the same fresh browser/context.
    cdp.send("HeapProfiler.collectGarbage")
    vals = {x["name"]: x["value"] for x in
            cdp.send("Performance.getMetrics")["metrics"]}
    return {"heap": vals.get("JSHeapUsedSize"), "nodes": vals.get("Nodes")}


def check_dom_and_state(page):
    return page.evaluate("""() => {
      const team=state.team;
      const roster=team.filter(m=>m.location!=='storage');
      const actors=document.querySelectorAll('.hexActor');
      const foods=document.querySelectorAll('.hexFood');
      if(actors.length>roster.length)
        throw Error('farm actor DOM count exceeds visible roster');
      if(foods.length>state.farm.foods.length)
        throw Error('duplicated food DOM node');
      if(!team.every(m=>[m.hp,m.maxHp,m.atk,m.def,m.spd,
        m.hunger,m.fatigue].every(Number.isFinite)))
        throw Error('non-finite Digimon stat after long play');
      if(new Set(team.map(m=>m.instanceId)).size!==team.length)
        throw Error('duplicate Digimon instanceId');
      if(!Number.isFinite(state.world.seconds))
        throw Error('non-finite farm clock');
      return {seconds:state.world.seconds,day:state.day,
        ids:team.map(m=>m.instanceId),team:team.length,
        actors:actors.length,foods:foods.length,food:state.food,
        wins:state.wins,paused:state.world.paused};
    }""")


def run(browser, base, entry, mobile):
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844} if mobile
                 else {"width": 1280, "height": 800},
        is_mobile=mobile, has_touch=mobile,
    )
    try:
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(base + "/" + entry, wait_until="domcontentloaded",
                  timeout=90000)
        page.wait_for_function("Boolean(window.DCHexFarm && window.DCHuntUI)")
        page.locator('[data-tab="nursery"]').click()
        page.evaluate("""() => {
          state.world.paused=true;state.world.speed=4;save(false);
        }""")
        initial = check_dom_and_state(page)
        cdp = ctx.new_cdp_session(page)
        cdp.send("Performance.enable")
        cdp.send("HeapProfiler.enable")
        metrics = []
        try:
            for cycle in range(1, CYCLES + 1):
                result = page.evaluate("""() => {
                  state.world.paused=false;
                  DCHexFarm.tick(60);
                  state.world.paused=true;
                  save(false);
                  return {seconds:state.world.seconds,day:state.day};
                }""")
                assert result["seconds"] > initial["seconds"], result
                if cycle % 5 == 0:
                    # Exercise tab lifecycle; return to the real farm before
                    # checking bounds, including mobile/touch navigation.
                    page.locator('[data-tab="hunt"]').click()
                    page.locator('[data-tab="nursery"]').click()
                    page.wait_for_timeout(80)
                    snap = check_dom_and_state(page)
                    samples = read_metrics(cdp)
                    metrics.append(samples)
                    assert snap["paused"], snap
                    assert not errors, errors
            final = check_dom_and_state(page)
            elapsed = final["seconds"] - initial["seconds"]
            assert abs(elapsed - CYCLES * STEP_SECONDS * SPEED) < 1, (
                elapsed, final)
            assert len(metrics) == CYCLES // 5, metrics

            # Robust, deliberately generous guard: only fail on a severe
            # post-GC trend, not normal heap fluctuations/initial loading.
            heaps = [m["heap"] for m in metrics if m["heap"] is not None]
            if len(heaps) >= 4:
                early = min(heaps[:2])
                late = max(heaps[-2:])
                assert not (late - early > 48 * MIB and
                            late > early * 2.5), {
                    "reason": "suspected unbounded JS heap growth",
                    "heap_samples": heaps}

            nodes = [m["nodes"] for m in metrics if m["nodes"] is not None]
            if len(nodes) >= 4:
                early_nodes = min(nodes[:2])
                late_nodes = max(nodes[-2:])
                assert not (late_nodes - early_nodes > 1800 and
                            late_nodes > early_nodes * 2), {
                    "reason": "suspected unbounded DOM growth",
                    "node_samples": nodes}

            saved = page.evaluate("""() => {
              save(false);
              const v=JSON.parse(localStorage.getItem(
                'dc_recreation_save'));
              return {ids:v.team.map(m=>m.instanceId),food:v.food,
                wins:v.wins,day:v.day,seconds:v.world.seconds,
                paused:v.world.paused};
            }""")
            assert saved["ids"] == final["ids"] and saved["paused"], saved
            # Reload the actual full HTML twice to catch duplicated
            # actors and loss of persistent long-play progress.
            for _ in range(2):
                page.reload(wait_until="domcontentloaded", timeout=90000)
                page.wait_for_function("Boolean(window.DCHexFarm && window.DCHuntUI)")
                page.locator('[data-tab="nursery"]').click()
                restored = check_dom_and_state(page)
                assert restored["ids"] == saved["ids"], (restored, saved)
                assert restored["food"] == saved["food"], (restored, saved)
                assert restored["wins"] == saved["wins"], (restored, saved)
                assert restored["day"] == saved["day"], (restored, saved)
                assert abs(restored["seconds"] - saved["seconds"]) < .2, (
                    restored, saved)
                assert restored["paused"], restored
            assert not errors, errors
            print("PASS", entry, "touch" if mobile else "desktop",
                  "7200 simulated seconds; two reloads; bounded DOM;",
                  "post-GC heap MiB", [round(x / MIB, 1) for x in heaps],
                  "CDP nodes", nodes, flush=True)
        finally:
            cdp.detach()
    finally:
        ctx.close()


def main():
    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0),
        functools.partial(QuietHandler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            options = {"headless": True,
                       "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
            if os.getenv("CHROMIUM_PATH"):
                options["executable_path"] = os.environ["CHROMIUM_PATH"]
            browser = pw.chromium.launch(**options)
            try:
                base = f"http://127.0.0.1:{server.server_port}"
                run(browser, base, "index.html", False)
                run(browser, base, "standalone.html", True)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


if __name__ == "__main__":
    main()
