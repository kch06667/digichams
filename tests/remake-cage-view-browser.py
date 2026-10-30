"""Phase 1 2-row cage UI regression: synthetic state; no private ROM/art/saves.

Run: python tests/remake-cage-view-browser.py
Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to choose a local Chromium binary.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

HTML="""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
body{font:15px system-ui;background:#101d2c;color:white}
#farmPanel{padding:15px;max-width:1000px}
.farmScrollFrame{height:420px;background:#233548}
.farmViewport{height:420px}
.hexControls{display:grid;background:#293b50}
</style></head><body class="mode-nds">
<button id="wideMode" type="button">PC 화면</button>
<article id="farmPanel"><div class="farmIntro">기존 게임</div>
<div class="farmEconomy">100 Bit</div>
<div class="farmScrollFrame"><div class="farmViewport" id="farmViewport">
<div id="farmWorld"></div></div></div>
<div class="farmNav">원본 탐색</div>
<div class="farmDetails">원본 건설 설명</div>
<div class="hexControls"><select id="hexCageSelect"></select>
<button id="hexCageBuy">원본 구입</button>
<button id="hexCageTrain">원본 훈련</button></div></article>
<script>
const ids=['miniVolcano','grassland','highMountain','beach','forest',
'factory','graveyard','flowerGarden','laboratory','evilRoom','dojo'];
const state={day:1,wins:0,facilityCredits:100,facilities:{core:true},
 cageFacilities:{},team:[{instanceId:'test-mon',name:'코로몬'}]};
const calls=[];
const sel=document.querySelector('#hexCageSelect');
for(const id of ids)sel.add(new Option(id,id));
sel.addEventListener('change',()=>calls.push('facility:'+sel.value));
document.getElementById('wideMode').onclick=()=>
 document.body.classList.remove('mode-nds');
window.DCCages={
 CAGES:ids.map(id=>({id,label:id,description:'원본 시스템의 훈련'})),
 info(s,id){return {owned:!!s.cageFacilities[id],cost:180,
   needs:s.facilities.training?[]:['특별 훈련장 건설']}},
 owned(s,id){return !!s.cageFacilities[id]&&!!s.facilities.training}
};
window.DCHexFarm={get state(){return state},choose(id){calls.push('map:'+id)}};
window.QA={state,calls};
</script></body></html>"""

def attach(page):
    page.set_content(HTML,wait_until="domcontentloaded")
    page.add_style_tag(path=str(ROOT/"src/remake-cage-view.css"))
    page.add_script_tag(path=str(ROOT/"src/remake-cage-view.js"))

def main():
    opts={"headless":True,"args":["--no-sandbox",
           "--disable-dev-shm-usage","--disable-gpu"]}
    binary=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
    if binary:opts["executable_path"]=binary
    with sync_playwright() as pw:
        browser=pw.chromium.launch(**opts)
        try:
            page=browser.new_page(viewport={"width":1360,"height":900})
            errors=[]
            page.on("pageerror",lambda err:errors.append(str(err)))
            attach(page)
            page.wait_for_function("!!window.DCRemakeCages")
            base=page.evaluate("""() => ({
              s:JSON.stringify(QA.state),
              n:document.querySelectorAll('#dc-cage-grid button').length,
              cols:getComputedStyle(document.querySelector('#dc-cage-grid')).gridTemplateColumns.split(' ').length,
              rows:getComputedStyle(document.querySelector('#dc-cage-grid')).gridTemplateRows.split(' ').length,
              hasOriginal:!!document.querySelector('#hexCageTrain'),
              wide:!document.body.classList.contains('mode-nds')
            })""")
            assert base["n"]==12 and base["cols"]==6 and base["rows"]==2,base
            assert base["wide"] and base["hasOriginal"],base
            assert page.locator("#dc-cage-overview").is_visible()
            assert not page.locator(".farmScrollFrame").is_visible()
            page.locator('[data-dc-cage="base"]').click()
            assert page.locator(".farmScrollFrame").is_visible()
            assert page.locator("#hexCageTrain").is_visible()
            assert page.evaluate("QA.calls.at(-1)")=="map:core"
            page.locator("#dc-cage-back").click()
            page.locator('[data-dc-cage="forest"]').click()
            assert page.locator("#hexCageSelect").input_value()=="forest"
            assert "해금 조건" in page.locator("#dc-cage-action").inner_text()
            assert page.evaluate("QA.calls.slice(-2)")==["facility:forest","map:training"]
            # The TEST changes synthetic ownership, never the view code.
            page.evaluate("QA.state.facilities.training=true;QA.state.cageFacilities.forest=true")
            page.evaluate("DCRemakeCages.snapshot()")
            assert page.locator("#dc-cage-unlock").inner_text()=="● 개방"
            assert page.evaluate("QA.state.facilityCredits")==100
            assert page.evaluate("QA.state.team[0].instanceId")=="test-mon"
            assert not errors,errors
            mobile=browser.new_page(viewport={"width":390,"height":800},
                                    is_mobile=True,has_touch=True)
            attach(mobile)
            assert mobile.evaluate("window.DCRemakeCages===undefined")
            assert mobile.evaluate("document.body.classList.contains('mode-nds')")
            print("PASS PC 2x6 overview, original controls, locked/unlock conditions")
            print("PASS mobile untouched, no page errors or synthetic save writes")
        finally:
            browser.close()

if __name__=="__main__":main()
