"""Original FULL GAME -> Phaser 2v2 / 3v3, read-only safety in desktop/touch.

Never creates a writable multi-result or touches any user's real save.
Synthetic roster is isolated inside each temporary Chromium context.
"""
import functools
import http.server
import subprocess
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CDN="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"
VENDOR=ROOT/"node_modules/phaser/dist/phaser.min.js"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def check(browser,base,size,mobile):
    opts={"viewport":{"width":390,"height":844} if mobile else
          {"width":1280,"height":800}}
    if mobile:opts.update(is_mobile=True,has_touch=True,device_scale_factor=2)
    ctx=browser.new_context(**opts)
    if VENDOR.is_file():
        ctx.route(CDN,lambda route:route.fulfill(
            path=str(VENDOR),content_type="application/javascript"))
    errors=[]
    farm=ctx.new_page()
    farm.on("pageerror",lambda err:errors.append("farm: "+str(err)))
    farm.goto(base+"/index.phaser.html?phaserBattle=1",wait_until="domcontentloaded")
    farm.locator("#dc-phaser-engine").wait_for(state="attached",timeout=30000)
    farm.wait_for_function("""() => {
      try{return Boolean(eval('state')?.team?.[0]?.instanceId)}
      catch(_){return false}
    }""",timeout=30000)
    names=["아구몬","파타몬","팔몬"]
    stats=farm.evaluate("""({size,names})=>{
      const s=eval('state');
      const original=JSON.parse(JSON.stringify(s.team[0]));
      s.pendingBattle=null;s.day=10;
      s.team=Array.from({length:size},(_,i)=>({
        ...JSON.parse(JSON.stringify(original)),
        instanceId:i===0?original.instanceId:'qa-multi-'+size+'-'+i,
        name:names[i],hp:130+i*10,maxHp:140+i*10,
        tp:40+i*5,maxTp:90+i*5,atk:47+i*11,def:24+i*4,
        spd:59+i*7,egg:false,lost:false,location:'farm'
      }));
      // Original farm clock expects a unique actor for each active Digimon.
      s.farm.actors??={};
      for(const m of s.team){
        s.farm.actors[m.instanceId]??={x:50,y:62,mode:'idle',
          pose:0,remaining:0,idleTime:0,autoRest:true};
      }
      return s.team.map(m=>({name:m.name,hp:m.hp,atk:m.atk}));
    }""",{"size":size,"names":names})
    farm.locator("#wideMode").click()
    farm.locator("#liveBattleLaunch").click()
    farm.locator("#lbMode").select_option("owned")
    farm.locator("#lbTeamSize").select_option(str(size))
    farm.locator("#lbTactic").select_option("focus")
    farm.locator("#dc-phaser-engine").select_option("phaser")
    with ctx.expect_page() as popup_info:
        farm.locator("#lbStart").click()
    arena=popup_info.value
    arena.on("pageerror",lambda err:errors.append("arena: "+str(err)))
    arena.wait_for_function("""(size)=>{
      const x=window.DigiPhaserLab?.handoffInfo();
      return x?.teamSize===size;
    }""",arg=size,timeout=30000)
    assert arena.evaluate("DigiPhaserLab.handoffInfo().saveAllowed") is False
    assert arena.locator("#squadSize").input_value()==str(size)
    assert arena.locator("#squadSize").is_disabled()
    assert arena.locator("#rosterChoice").is_disabled()
    assert arena.locator("#tactic").input_value()=="focus"
    assert arena.locator("#tactic").is_disabled()
    assert farm.evaluate("!eval('state').pendingBattle")
    arena.locator("#battle").click()
    arena.wait_for_function("""(size)=>{
      const s=window.DigiPhaserLab?.matchSnapshot();
      return s?.fighters?.length===size*2 && s.elapsed>0;
    }""",arg=size,timeout=12000)
    fighters=arena.evaluate("DigiPhaserLab.matchSnapshot().fighters")
    assert [m["name"] for m in fighters if m["side"]==0]==names[:size],fighters
    for i,mon in enumerate([m for m in fighters if m["side"]==0]):
        assert mon["atk"]==stats[i]["atk"] and mon["max"]==stats[i]["hp"]+10,mon
    assert arena.evaluate("DigiPhaserLab.qaFinishCombat()")
    result=arena.evaluate("DigiPhaserLab.battleResultPreview()")
    assert result and len(result["changes"])==size and result["saveApplied"] is False
    assert len(set(change["teamIndex"] for change in result["changes"]))==size
    farm.wait_for_function("""() => {
      const n=document.querySelector('#dc-phaser-farm-status')?.textContent;
      return n?.includes('결과 미리보기만 가능');
    }""",timeout=12000)
    assert farm.locator("#dc-phaser-farm-apply").is_hidden()
    assert farm.evaluate("""() =>
      localStorage.getItem(DCDevPhaserCommit.BACKUP_KEY)===null""")
    assert not errors,errors
    print("OK original farm -> Phaser "+str(size)+"v"+str(size)+
          " readonly", "touch" if mobile else "desktop")
    ctx.close()

def main():
    subprocess.run(["node","tools/build-phaser-optin-page.cjs"],
                   cwd=ROOT,check=True,capture_output=True,text=True)
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),
             functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                base=f"http://127.0.0.1:{server.server_port}"
                for size in (2,3):
                    for mobile in (False,True):
                        check(browser,base,size,mobile)
            finally:browser.close()
    finally:server.shutdown();server.server_close()

if __name__=="__main__":main()
