"""Original FULL GAME -> Phaser 2v2 / 3v3, approved verified save in desktop/touch.

Uses test-only synthetic Digimon; no personal save is accessed.
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
    assert arena.evaluate("DigiPhaserLab.handoffInfo().saveAllowed") is True
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
    # The original farm only offers this button after staging EVERY
    # participant's result. It has not written any save automatically.
    apply=farm.locator("#dc-phaser-farm-apply")
    apply.wait_for(state="visible",timeout=12000)
    assert "검증 완료" in farm.locator("#dc-phaser-farm-status").inner_text()
    assert farm.evaluate("""() =>
      localStorage.getItem(DCDevPhaserCommit.BACKUP_KEY)===null""")
    before=farm.evaluate("""() => {
      const s=eval('state');
      return {wins:s.wins,losses:s.losses,points:s.points,
        ids:s.team.map(mon=>mon.instanceId)};
    }""")
    # Atomic testing-only checkpoint and user approval in the same task.
    # Outside QA, the save guard rejects any stale/unsaved farm data.
    farm.evaluate("""() => {
      localStorage.setItem('dc_recreation_save',JSON.stringify(eval('state')));
      document.querySelector('#dc-phaser-farm-apply').click();
    }""")
    farm.locator("#dc-phaser-engine").wait_for(state="attached",timeout=15000)
    saved=farm.evaluate("""() => JSON.parse(
      localStorage.getItem('dc_recreation_save'))""")
    assert saved["wins"]+saved["losses"]==before["wins"]+before["losses"]+1,saved
    assert saved["points"]==before["points"]+(2 if result["winner"]==0 else 0)
    assert "pendingBattle" not in saved
    assert [m["instanceId"] for m in saved["team"]]==before["ids"]
    import math
    for change in result["changes"]:
        mon=saved["team"][change["teamIndex"]]
        assert mon["hp"]==math.ceil(change["hpAfter"]),mon
        assert mon["tp"]==math.floor(change["tpAfter"]),mon
        assert mon["evo"]["battles"]>=1,mon
    assert farm.evaluate("""() => Boolean(
      localStorage.getItem(DCDevPhaserCommit.BACKUP_KEY) &&
      localStorage.getItem(DCDevPhaserCommit.FIRST_BACKUP_KEY)
    )""")
    assert farm.locator("#dc-phaser-farm-apply").is_hidden()
    assert not errors,errors
    print("OK original farm -> Phaser "+str(size)+"v"+str(size)+
          " saved after explicit approval", "touch" if mobile else "desktop")
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
