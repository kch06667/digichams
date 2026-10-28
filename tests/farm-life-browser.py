"""Real playable HTML farm-life consistency on desktop and mobile touch.

Test only in fresh browser contexts. No personal game save or ROM files.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

def check(browser, entry, mobile):
    ctx=browser.new_context(
        viewport={"width":390,"height":844} if mobile else
                 {"width":1280,"height":800},
        is_mobile=mobile,has_touch=mobile,
    )
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.set_content((ROOT/entry).read_text(encoding="utf-8"),
                     wait_until="domcontentloaded",timeout=90000)
    page.wait_for_function("!!window.DCHexFarm && !!window.DCFarm")
    page.locator('[data-tab="nursery"]').click()
    result=page.evaluate("""() => {
      const s=eval('state'),core=window.DCFarm;
      s.world.paused=true;
      const living=s.team[0];
      living.hp=living.maxHp;living.fatigue=0;living.hunger=0;
      const lost={...JSON.parse(JSON.stringify(living)),
        instanceId:'qa-lost-original',lost:true,hunger:80,
        location:'farm',training:0};
      s.team.push(lost);
      core.ensure(s);
      const snap=JSON.stringify(lost);
      const beforeFood=s.food;
      if(!core.placeFood(s))throw Error('food did not place');
      s.world.paused=false;
      core.advance(s,10);
      s.world.paused=true;
      if(!s.farm.foods.length)throw Error('fed actor with no hunger');
      if(s.food!==beforeFood-1)throw Error('incorrect meal cost');
      if(JSON.stringify(lost)!==snap)throw Error('lost actor state changed');
      if(core.command(s,lost.instanceId,'attack'))throw Error('lost actor trained');
      living.hunger=90;
      s.world.paused=false;
      core.advance(s,9);
      s.world.paused=true;
      if(s.farm.foods.length)throw Error('hungry living actor did not eat');
      if(JSON.stringify(lost)!==snap)throw Error('lost actor stole food');
      if(s.farm.actors[lost.instanceId].goal)
        throw Error('lost actor retained reserved target');
      const heldSeconds=s.world.seconds;
      s.world.accumulator=Infinity;
      core.ensure(s);
      if(s.world.accumulator!==0)throw Error('corrupted backlog not reset');
      s.world.paused=false;
      core.advance(s,Infinity);
      s.world.paused=true;
      if(s.world.seconds!==heldSeconds)
        throw Error('infinite frame delta advanced clock');
      if(s.team.some(m=>m.instanceId==='qa-lost-original'&&m.training>0))
        throw Error('lost actor earned training');
      return {foodSpent:beforeFood-s.food,livingHunger:living.hunger,
        lostUnchanged:JSON.stringify(lost)===snap,clockSafe:true};
    }""")
    assert result["foodSpent"]==1 and result["lostUnchanged"] and result["clockSafe"],result
    assert not errors,errors
    print("PASS",entry,"mobile touch" if mobile else "desktop",
          "no ghost training / hungry feeding / corrupt-time safety")
    ctx.close()

def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True)
        try:
            for entry in ("index.html","standalone.html"):
                for mobile in (False,True):
                    check(browser,entry,mobile)
        finally:
            browser.close()

if __name__=="__main__":
    main()
