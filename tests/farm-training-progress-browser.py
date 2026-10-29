"""Real full-game cage progress, rest-resume, saved state and mobile layout."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

def check(browser,entry,mobile):
 ctx=browser.new_context(viewport={"width":390,"height":844} if mobile else
                         {"width":1280,"height":800},
                         is_mobile=mobile,has_touch=mobile)
 page=ctx.new_page();errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.set_content((ROOT/entry).read_text(encoding="utf-8"),
                  wait_until="domcontentloaded",timeout=90000)
 page.wait_for_function("typeof window.DCHexFarm==='object'")
 page.locator('[data-tab="nursery"]').click()
 page.locator('#hexTrainingMeter').wait_for(state="attached")
 assert page.locator('#hexCageSelect option').count()==11
 assert page.evaluate("typeof DCFarm.trainingStatus")== "function"
 page.evaluate("""() => {
  state.day=6;state.wins=6;state.facilities.training=true;
  state.facilityCredits=3000;state.world.paused=true;
  DCCages.ensure(state);DCEvolution.ensure(state);DCHexFarm.core.ensure(state);
  DCHexFarm.tick(.1);
 }""")
 page.locator("#hexCageSelect").select_option("miniVolcano")
 page.locator("#hexCageBuy").click()
 assert page.evaluate("DCCages.owned(state,'miniVolcano')") is True
 page.locator("#hexCageGoalEnabled").check()
 page.locator("#hexCageGoalValue").fill("40")
 page.locator("#hexCageTrain").click()
 first=page.evaluate("""() => {
  const id=document.getElementById('hexMon').value;
  return DCFarm.trainingStatus(state,id);
 }""")
 assert first["cageId"]=="miniVolcano" and first["goal"]==40,first
 assert "목표 40" in page.locator("#hexTrainingDetails").inner_text()
 assert not page.locator("#hexTrainingMeter").is_hidden()
 page.evaluate("""() => {state.world.paused=false;DCHexFarm.tick(19);state.world.paused=true;}""")
 middle=page.evaluate("""() => DCFarm.trainingStatus(state,
  document.getElementById('hexMon').value)""")
 assert middle["measure"]=="ap" and middle["current"]>=2,middle
 assert middle["remaining"]==max(0,40-middle["current"])
 assert "남음" in page.locator("#hexTrainingDetails").inner_text()
 # Drive the existing fatigue/HP threshold, NOT a fake training result.
 page.evaluate("""() => {
  const id=document.getElementById('hexMon').value,m=state.team.find(x=>x.instanceId===id);
  const a=state.farm.actors[id];
  m.hp=Math.round(m.maxHp*.1);m.fatigue=85;
  a.mode='acting';a.remaining=.01;
  state.world.paused=false;DCHexFarm.tick(.1);state.world.paused=true;
 }""")
 resting=page.evaluate("""() => DCFarm.trainingStatus(state,
  document.getElementById('hexMon').value)""")
 assert resting["restResume"] is True,resting
 assert resting["goal"]==40 and resting["cageId"]=="miniVolcano",resting
 assert "자동 휴식" in page.locator("#hexTrainingDetails").inner_text()
 assert "HP 80%" in page.locator("#hexTrainingNext").inner_text()
 # JSON export/import follows the real game's save migration and renderer.
 archive=page.evaluate("DCHexFarm.exportSaveObject()")
 page.evaluate("(value)=>DCHexFarm.importSaveObject(value)",archive)
 page.evaluate("DCHexFarm.tick(.01)")
 post=page.evaluate("""() => DCFarm.trainingStatus(state,
  document.getElementById('hexMon').value)""")
 assert post["restResume"] is True and post["goal"]==40,post
 page.evaluate("""() => {
  const id=document.getElementById('hexMon').value,m=state.team.find(x=>x.instanceId===id);
  const a=state.farm.actors[id];
  m.hp=m.maxHp;m.fatigue=20;
  a.mode='acting';a.remaining=.01;
  state.world.paused=false;DCHexFarm.tick(.1);state.world.paused=true;
 }""")
 resumed=page.evaluate("""() => DCFarm.trainingStatus(state,
  document.getElementById('hexMon').value)""")
 assert resumed["restResume"] is False and resumed["goal"]==40,resumed
 assert resumed["cageId"]=="miniVolcano" and resumed["kind"]=="cage",resumed
 # An already-met AP goal must not erase the resumed, active original order.
 before=page.evaluate("""() => {
  const id=document.getElementById('hexMon').value;
  const m=state.team.find(x=>x.instanceId===id);
  m.evo.ap.dragon=41;
  return JSON.stringify(state.farm.actors[id]);
 }""")
 page.locator("#hexCageTrain").click()
 after=page.evaluate("""() => JSON.stringify(state.farm.actors[
  document.getElementById('hexMon').value])""")
 assert after==before,"already-reached goal erased current training!"
 if mobile:
  overflow=page.evaluate("""() => ({
   width:document.documentElement.scrollWidth,viewport:innerWidth})""")
  assert overflow["width"]<=overflow["viewport"]+2,overflow
 assert not errors,errors
 print("OK",entry,"mobile touch" if mobile else "desktop",
       "goal/AP HUD, rest resume, imported save, completed-target guard",flush=True)
 ctx.close()

def main():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  try:
   for entry in ("index.html","standalone.html"):
    for mobile in (False,True):check(browser,entry,mobile)
  finally:browser.close()

if __name__=="__main__":main()
