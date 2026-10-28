"""Original FULL-GAME cup button -> real Phaser original-AI -> approval.
PC/mobile bracket opponents, semifinal/final and save round-trip. Synthetic
roster lives only in fresh browser contexts; no user's save is accessed.
"""
import functools
import http.server
import threading
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
VENDOR=ROOT/"node_modules/phaser/dist/phaser.min.js"
CDN="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def new_farm(browser,base,mobile=False):
    options={"viewport":{"width":390,"height":844} if mobile else
             {"width":1280,"height":800}}
    if mobile:options.update(is_mobile=True,has_touch=True,device_scale_factor=2)
    ctx=browser.new_context(**options)
    if VENDOR.is_file():
        ctx.route(CDN,lambda route:route.fulfill(
            path=str(VENDOR),content_type="application/javascript"))
    page=ctx.new_page()
    page.goto(base+"/index.phaser.html?phaserBattle=1",wait_until="domcontentloaded")
    page.locator("#dc-phaser-cup-engine").wait_for(state="attached",timeout=30000)
    page.wait_for_function("""() => {
      try{return Boolean(eval('state')?.team?.[0]?.instanceId)}
      catch(_){return false}
    }""")
    return ctx,page

def prepare(page,cup):
    page.evaluate("""(cup)=>{
      const s=eval('state');
      s.day=cup==='grand'?10:cup==='regional'?5:1;
      s.wins=cup==='grand'?5:cup==='regional'?2:0;
      s.pendingBattle=null;s.championship={
        active:null,crowns:cup==='grand'?{novice:1,regional:1}:
          cup==='regional'?{novice:1}:{},
        history:[],matchHistory:[],sequence:0,rank:0,lastResult:null
      };
      const first=JSON.parse(JSON.stringify(s.team[0]));
      const count=cup==='grand'?3:cup==='regional'?2:1;
      s.team=Array.from({length:count},(_,i)=>({
        ...JSON.parse(JSON.stringify(first)),
        instanceId:i===0?first.instanceId:'qa-cup-'+cup+'-'+i,
        name:['아구몬','파타몬','팔몬'][i],
        hp:3000,maxHp:3000,atk:900,def:900,spd:400,
        maxTp:170,tp:170,egg:false,lost:false,location:'farm',
        exp:0,level:1,friendship:20
      }));
      s.selected=0;
      s.farm.actors??={};
      for(const m of s.team){
        s.farm.actors[m.instanceId]??={x:50,y:62,mode:'idle',
          pose:0,remaining:0,idleTime:0,autoRest:true};
      }
      const r=DCChampionship.enter(s,cup);
      if(!r.ok)throw Error('Original bracket cannot start: '+r.missing);
      DCChampionshipUI.render();
    }""",cup)
    # Cup widgets are in the actual original BATTLE tab.
    page.locator('[data-tab="battle"]').click()
    page.locator("#dc-phaser-cup-engine").select_option("phaser")

def fight(ctx,farm,errors,expected_round):
    match=farm.evaluate("""() => {
      const s=eval('state'),m=DCChampionship.nextMatch(s);
      if(!m)throw Error('Original tournament has no next match');
      if(Array.isArray(m.opponentTeam))return m;
      const names=eval('allNames'),found=names.indexOf(m.opponent);
      if(found<0)throw Error('Original opponent species missing');
      const team=[m.opponent];
      for(let i=1;team.length<m.size&&i<names.length;i++){
        const name=names[(found+i+2)%names.length];
        if(!team.includes(name))team.push(name);
      }
      return {...m,opponentTeam:team,trainer:m.trainer||'상대 테이머'};
    }""")
    assert match["round"]==expected_round,match
    assert len(match["opponentTeam"])==match["size"]
    farm.locator('[data-tab="battle"]').click()
    with ctx.expect_page() as popup:
        farm.locator("#championshipFight").click()
    arena=popup.value
    arena.on("pageerror",lambda e:errors.append('arena:'+str(e)))
    arena.wait_for_function("""(id)=>window.DigiPhaserLab?.handoffInfo()
      ?.tournament?.matchId===id""",arg=match["matchId"],timeout=30000)
    info=arena.evaluate("DigiPhaserLab.handoffInfo()")
    assert info["tournament"]["opponentTeam"]==match["opponentTeam"]
    assert info["tournament"]["trainer"]==match["trainer"]
    assert arena.locator("#squadSize").input_value()==str(match["size"])
    assert farm.evaluate("""() => {
      const s=eval('state');
      return !s.pendingBattle&&s.championship.active.awaiting!=null;
    }""")
    arena.locator("#battle").click()
    arena.wait_for_function("""(size)=>{
      const x=window.DigiPhaserLab?.matchSnapshot();
      return x?.fighters?.length===size*2&&x.elapsed>0;
    }""",arg=match["size"],timeout=12000)
    fighters=arena.evaluate("DigiPhaserLab.matchSnapshot().fighters")
    assert [x["name"] for x in fighters if x["side"]==1]==match["opponentTeam"]
    for enemy in [x for x in fighters if x["side"]==1]:
        assert enemy["max"]>0 and enemy["maxTp"]>0
    assert arena.evaluate("DigiPhaserLab.qaFinishCombat()")
    report=arena.evaluate("DigiPhaserLab.battleResultPreview()")
    assert report and report["saveApplied"] is False
    # The synthetic raised team is far stronger than any cup team; it
    # should win the real autonomous fight without forcing a winner.
    assert report["winner"]==0,report
    apply=farm.locator("#dc-phaser-farm-apply")
    apply.wait_for(state="visible",timeout=12000)
    assert "대회 경기" in farm.locator("#dc-phaser-farm-status").inner_text()
    assert farm.evaluate("""() =>
      localStorage.getItem(DCDevPhaserCommit.BACKUP_KEY)===null""")
    farm.evaluate("""() => {
      // Synthetic test fixture needs a synchronous authoritative checkpoint.
      localStorage.setItem('dc_recreation_save',JSON.stringify(eval('state')));
      document.getElementById('dc-phaser-farm-apply').click();
    }""")
    farm.locator("#dc-phaser-cup-engine").wait_for(state="attached",timeout=15000)
    saved=farm.evaluate("""() => JSON.parse(
      localStorage.getItem('dc_recreation_save'))""")
    assert "pendingBattle" not in saved
    assert saved["championship"]["active"] is None or (
      saved["championship"]["active"]["awaiting"] is None)
    if saved["championship"].get("matchHistory"):
        assert saved["championship"]["matchHistory"][0]["matchId"]==match["matchId"]
        assert saved["championship"]["matchHistory"][0]["opponent"]==match["opponentTeam"]
    assert farm.evaluate("""() =>
      Boolean(localStorage.getItem(DCDevPhaserCommit.BACKUP_KEY))""")
    arena.close()
    assert not errors,errors
    return match,saved

def check(browser,base,cup,mobile=False):
    ctx,farm=new_farm(browser,base,mobile)
    errors=[]
    farm.on("pageerror",lambda e:errors.append('farm:'+str(e)))
    prepare(farm,cup)
    rounds=2 if cup=='novice' else 1
    first=None
    for r in range(rounds):
        match,saved=fight(ctx,farm,errors,r)
        if first is None:first=match
    if cup=='novice':
        assert saved["championship"]["active"] is None
        assert saved["championship"]["crowns"]["novice"]==1
        assert saved["championship"]["rank"]==1
        assert saved["facilityCredits"]>=260
        if saved["championship"].get("matchHistory"):
            assert saved["championship"]["matchHistory"][0]["round"]==1
            assert len(saved["championship"]["matchHistory"])==2
        assert len(saved["championship"]["history"])==1
    else:
        assert saved["championship"]["active"]["round"]==1
        assert not saved["championship"]["crowns"].get(cup)
        if saved["championship"].get("matchHistory"):
            assert len(saved["championship"]["matchHistory"])==1
    print("OK original championship",cup,
      "touch" if mobile else "desktop","real bracket / opponents / save")
    ctx.close()

def legacy_default(browser,base):
    ctx,farm=new_farm(browser,base)
    prepare(farm,'novice')
    farm.locator("#dc-phaser-cup-engine").select_option("legacy")
    assert farm.locator("#dc-phaser-cup-engine").input_value()=="legacy"
    farm.locator("#championshipFight").click()
    farm.wait_for_function("""() => Boolean(eval('state').pendingBattle)""")
    assert len(ctx.pages)==1
    assert farm.locator("#liveBattle").evaluate(
      "(el)=>getComputedStyle(el).display!=='none'")
    ctx.close()
    print("OK championship original legacy default unchanged")

def main():
    subprocess.run(["node","tools/build-phaser-optin-page.cjs"],
      cwd=ROOT,check=True,capture_output=True,text=True)
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),
      functools.partial(QuietHandler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                base=f"http://127.0.0.1:{server.server_port}"
                legacy_default(browser,base)
                check(browser,base,'novice',False)
                check(browser,base,'novice',True)
                check(browser,base,'regional',False)
                check(browser,base,'grand',True)
            finally:browser.close()
    finally:
        server.shutdown();server.server_close();thread.join(timeout=3)

if __name__=="__main__":main()
