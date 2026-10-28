"""Chromium smoke checks for copyright-free Phaser scene: desktop and touch."""
import contextlib
import functools
import http.server
import os
import json
import tempfile
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
        assert "개인 모션" in page.locator("#status").inner_text()
        # Private images are selected FROM THIS browser's local disk.
        # They must not be added to any published Pages build or sent online.
        local = ROOT / "phaser-lab" / "local-assets"
        sprites=[str(p) for p in sorted(local.glob("action_*.png"))]
        files=[str(local / "manifest.json"), *sprites]
        page.locator("#artFiles").set_input_files(files)
        page.wait_for_function(
          "Boolean(window.DigiPhaserLab?.privatePackStatus())",timeout=12000)
        info=page.evaluate("DigiPhaserLab.privatePackStatus()")
        assert info["species"]=="아구몬"
        assignments=page.evaluate("DigiPhaserLab.renderedArt()")
        assert any(x["name"]=="아구몬" and x["privateArt"] for x in assignments)
        assert all((x["name"]=="아구몬") or not x["privateArt"]
                   for x in assignments), assignments
        # Reimporting another species must retain the first species'
        # textures. This uses temporary TEST-ONLY relabelled sheets;
        # it makes no claim that the image is actual Gabumon artwork.
        with tempfile.TemporaryDirectory() as directory:
            second = json.loads((local / "manifest.json").read_text(encoding="utf-8"))
            second["species"] = "가부몬"
            other_manifest = Path(directory) / "manifest.json"
            other_manifest.write_text(
                json.dumps(second, ensure_ascii=False), encoding="utf-8")
            page.locator("#artFiles").set_input_files([str(other_manifest), *sprites])
            page.wait_for_function(
              "() => window.DigiPhaserLab?.privatePackStatus()?.speciesList?.includes('가부몬')",
              timeout=12000)
            status = page.evaluate("DigiPhaserLab.privatePackStatus()")
            assert status["speciesList"] == ["아구몬", "가부몬"], status
            # Phaser scene.restart() is asynchronous; wait for textures
            # to be loaded before checking assignments.
            page.wait_for_function(
              "() => window.DigiPhaserLab?.renderedArt()?.some(x => x.name === '가부몬' && x.privateArt)",
              timeout=12000)
            assignments = page.evaluate("DigiPhaserLab.renderedArt()")
            for name in ("아구몬", "가부몬"):
                assert any(x["name"] == name and x["privateArt"]
                           for x in assignments), assignments
            assert all(x["name"] in ("아구몬", "가부몬") or not x["privateArt"]
                       for x in assignments), assignments
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
    assert page.evaluate("DigiRealTimeCore.createMatch().fighters.length")==6
    assert page.evaluate("DCOriginalArenaCore.createMatch().fighters.length")==6
    assert page.evaluate("DCOriginalArenaCore.source")==\
           "original-index-html-v0.23.2-extracted"
    page.locator("#squadSize").select_option("3")
    page.locator("#battle").click()
    page.wait_for_function(
        "document.querySelector('#status').textContent.includes('시연 중')",
        timeout=7000)
    baseline=page.evaluate("DigiPhaserLab.matchSnapshot()")
    assert len(baseline["fighters"])==6
    assert "turn" not in baseline
    page.wait_for_timeout(1100)
    moving=page.evaluate("DigiPhaserLab.matchSnapshot()")
    assert moving["stats"]["movement"]>20
    assert len([f for f in moving["fighters"] if f["moveDistance"]>0])==6
    assert any(abs(f["y"]-baseline["fighters"][i]["y"])>0.1
               for i,f in enumerate(moving["fighters"]))
    # Exercise the actual original battle simulator to completion without
    # forcing CI to spend 135 simulated seconds on every desktop/touch run.
    assert page.evaluate("DigiPhaserLab.qaFinishCombat()")
    page.wait_for_function(
        "document.querySelector('#status').textContent.includes('승리')",
        timeout=7000)
    finish=page.evaluate("DigiPhaserLab.matchSnapshot()")
    assert finish["finished"]
    assert finish["stats"]["hits"]>0
    # Inspect phase cues collected from the real ORIGINAL AI during the
    # accelerated simulation, not synthetic hand-authored skill events.
    cues=page.evaluate("DigiPhaserLab.motionEvidence()")
    assert cues["charge"] and cues["release"], cues
    assert cues["specialHits"]>0 and cues["knockbackFrames"]>0, cues
    assert page.evaluate("""() => DigiPhaserLabLogic.specialPhase(
      {hp:50,act:'special',pose:33})""")=="charge"
    assert page.evaluate("""() => DigiPhaserLabLogic.specialPhase(
      {hp:50,act:'special',pose:10})""")=="release"
    # Verify sparse private sprite packs use relevant fallback motions, not
    # an idle/attack pose during KO. Also inspect actual rendered actor angles
    # after natural original-AI combat rather than mocking a Phaser sprite.
    assert page.evaluate("""() => DigiPhaserLabLogic.motionAction(
      {hp:0,act:'attack',pose:7},new Set([0,5]))""") == 5
    rendered=page.evaluate("DigiPhaserLab.renderedArt()")
    for record in rendered:
        fighter=next(f for f in finish["fighters"] if f["id"]==record["id"])
        if fighter["hp"]<=0 and not record["hasKoArt"]:
            assert abs(record["angle"])>=70,record
            assert record["action"].startswith("ko:"),record
    # Existing rules are loaded into the real browser, and read-only JSON
    # inspection must not touch browser localStorage or the active scene.
    assert page.evaluate("typeof DigiDomainBridge.plan")=="function"
    assert page.evaluate("DigiPhaserLab.cupPreview().length")==3
    page.locator("#tactic").select_option("conserve")
    assert page.evaluate("DigiDomainBridge.plan(Object.assign("
      "DigiDomainBridge.newEncounter('conserve'),{ally:"
      "Object.assign({},DigiDomainBridge.newEncounter('conserve').ally,{tp:30})})).action")=="normal"
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
    assert page.locator("#rosterChoice option").count()==2
    page.locator("#rosterChoice").select_option("0")
    page.locator("#battle").click()
    page.wait_for_function(
      "DigiPhaserLab.encounterSnapshot().ally.name === '시험용 디지몬'",
      timeout=6000)
    assert page.evaluate("DigiPhaserLab.encounterSnapshot().ally.max")==100
    assert page.evaluate("DigiPhaserLab.encounterSnapshot().ally.hp")<=80
    assert page.evaluate("DigiPhaserLab.encounterSnapshot().ally.atk")==25
    assert page.evaluate("DigiPhaserLab.selectedRoster().name")=="시험용 디지몬"
    assert page.evaluate("DigiPhaserLab.battleResultPreview()") is None
    preview_before=page.evaluate("DigiPhaserLab.importedSavePreview()")
    assert page.evaluate("DigiPhaserLab.qaFinishCombat()")
    report=page.evaluate("DigiPhaserLab.battleResultPreview()")
    assert report["type"]=="read-only-battle-result", report
    assert report["source"]=="original-arena-completed-match-preview"
    assert report["saveApplied"] is False and report["rewardsApplied"] is False
    assert report["changes"][0]["teamIndex"]==0
    assert report["changes"][0]["name"]=="시험용 디지몬"
    assert report["changes"][0]["hpBefore"]==80
    assert report["changes"][0]["hpAfter"]<=80
    assert "저장되지 않음" in page.locator("#battleReport").inner_text()
    assert page.evaluate("DigiPhaserLab.importedSavePreview()")==preview_before
    page.locator("#reset").click()
    page.wait_for_function("Boolean(window.DigiPhaserLab?.battleResultPreview() === null)")
    assert page.locator("#battleReport").inner_text()==""
    assert not errors, f"JS errors ({'mobile' if mobile else 'desktop'}): {errors}"
    print("OK", "touch" if mobile else "desktop",
          "3v3 independent realtime movement + victory + roster")
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
    sample={"format":"digicham-save","exportVersion":1,
      "state":{"day":18,"wins":7,"team":[
        {"name":"아구몬 테스트","hp":187,"maxHp":255,"atk":40,"def":25,
         "spd":31,"hunger":64,"location":"farm"},
        {"name":"가부몬 테스트","hp":88,"maxHp":125,"atk":20,"def":19,
         "spd":29,"hunger":10,"location":"farm"}]}}
    page.locator("#farmSaveFile").set_input_files({
      "name":"farm-save.json","mimeType":"application/json",
      "buffer":json.dumps(sample,ensure_ascii=False).encode("utf-8")})
    page.wait_for_function(
        "Boolean(window.DigiFarmLab.snapshot().viewOnly)",timeout=5000)
    farm=page.evaluate("DigiFarmLab.snapshot()")
    assert farm["cages"]["0:0"]["name"]=="아구몬 테스트"
    assert farm["cages"]["0:0"]["hp"]==187
    assert farm["cages"]["0:1"]["name"]=="가부몬 테스트"
    assert page.locator("#buy").is_disabled()
    assert page.locator("#feed").is_disabled()
    page.evaluate("DigiFarmLab.select(0,1)")
    assert page.evaluate("DigiFarmLab.snapshot().selected")=="0:1"
    page.locator("#reset").click()
    page.wait_for_function(
      "window.DigiFarmLab.snapshot().viewOnly !== true",timeout=5000)
    assert page.locator("#buy").is_enabled()
    assert not errors,f"Farm runtime JS errors: {errors}"
    print("OK farm","touch" if mobile else "desktop","cage/feed/expand")
    context.close()


def check_offline_preview(browser, host):
    # Only safe allowlisted deployment output; no original sprite/ROM assets.
    preview=ROOT / "dist" / "phaser-preview"
    if not (preview/"index.html").is_file():
        return
    context=browser.new_context(viewport={"width":1100,"height":800},
                                service_workers="allow")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    site=host+"/dist/phaser-preview/"
    page.goto(site,wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.DigiPhaserLab)",timeout=30000)
    assert page.evaluate("typeof DigiDomainBridge.plan")=="function"
    assert page.evaluate("DigiPwaStatus().registered")
    # Installation pre-caches exact allowlist, including vendored Phaser.
    page.wait_for_function("navigator.serviceWorker.controller !== null",
                           timeout=20000)
    assert page.evaluate("DigiPwaStatus().controlled")
    context.set_offline(True)
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.DigiPhaserLab)",timeout=12000)
    page.locator("#train").click()
    page.wait_for_function(
        "document.querySelector('#status').textContent.includes('훈련 1회 완료')",
        timeout=7000)
    page.goto(site+"farm.html",wait_until="domcontentloaded")
    page.wait_for_function("Boolean(window.DigiFarmLab)",timeout=12000)
    assert page.evaluate("DigiFarmLabModel.initial().rows")==2
    assert not errors, f"offline preview JS errors: {errors}"
    print("OK safe PWA offline: battle/training + farm after reload")
    context.set_offline(False)
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
                check_offline_preview(browser, host)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
