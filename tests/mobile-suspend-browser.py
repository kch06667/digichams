"""Simulated Android/WebView suspend and resume on the ORIGINAL full HTML.

This tests browser document visibility/pagehide and mobile-touch emulation.
It does NOT claim a real Android phone was tested. The actual farm and hunt
save functions, localStorage and reload code run unmodified.
"""
import functools
import http.server
import math
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
KEY='dc_recreation_save'

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def run(browser,base,entry,mobile):
    opts={'viewport':{'width':390,'height':844} if mobile else
          {'width':1280,'height':800},
          'has_touch':mobile,'is_mobile':mobile}
    context=browser.new_context(**opts)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'/'+entry,wait_until='domcontentloaded',timeout=90000)
    page.wait_for_function('Boolean(window.DCHexFarm && window.DCHuntUI)')
    page.locator('[data-tab="nursery"]').click()

    # A short simulated *foreground* high-speed farm session must keep
    # deterministic, finite stats and bounded actor nodes.
    progress=page.evaluate("""() => {
      state.world.paused=false;state.world.speed=4;
      const previous=state.world.seconds;
      DCHexFarm.tick(300); // capped external delta, 1,200 simulated seconds
      state.world.paused=true;save(false);
      const active=state.team.filter(m=>!m.egg&&!m.lost&&
        m.location!=='storage').length;
      const actors=document.querySelectorAll('.hexActor').length;
      if(actors>active)throw Error('duplicated farm actors');
      if(!state.team.every(m=>[m.hp,m.maxHp,m.atk,m.def,m.spd,
        m.hunger,m.fatigue].every(Number.isFinite)))
        throw Error('non-finite stats during accelerated play');
      return {elapsed:state.world.seconds-previous,actors,active,
        day:state.day};
    }""")
    assert abs(progress['elapsed']-1200)<1,progress

    # Dirty the real in-memory game *without manually saving*. Visibility
    # change must flush immediately rather than waiting six real seconds.
    pending=page.evaluate("""() => {
      state.food+=7;
      return {food:state.food,day:state.day,
        before:JSON.parse(localStorage.getItem('dc_recreation_save')).food,
        seconds:state.world.seconds};
    }""")
    assert pending['before']!=pending['food'],pending
    hidden=page.evaluate("""() => {
      Object.defineProperty(document,'hidden',{configurable:true,
        get:()=>true});
      document.dispatchEvent(new Event('visibilitychange'));
      return {food:JSON.parse(localStorage.getItem('dc_recreation_save')).food,
        seconds:JSON.parse(localStorage.getItem('dc_recreation_save')).world.seconds,
        paused:state.world.paused};
    }""")
    assert hidden['food']==pending['food'] and hidden['paused'],hidden
    assert abs(hidden['seconds']-pending['seconds'])<.2,hidden
    page.wait_for_timeout(400)
    hidden_clock=page.evaluate('state.world.seconds')
    assert abs(hidden_clock-pending['seconds'])<.01,(hidden_clock,pending)

    # Reopening a sleeping app must not replay the time in the background.
    page.evaluate("""() => {
      Object.defineProperty(document,'hidden',{configurable:true,
        get:()=>false});
      document.dispatchEvent(new Event('visibilitychange'));
      state.world.paused=false;
    }""")
    page.wait_for_timeout(250)
    recovered_clock=page.evaluate('state.world.seconds')
    assert recovered_clock-hidden_clock<2,(recovered_clock,hidden_clock)
    page.evaluate('state.world.paused=true')

    # Simulate an externally committed Phaser result while an old battle
    # tab still has an in-flight transaction. Its pagehide must NOT
    # overwrite the newer authoritative storage with stale pendingBattle.
    settlement_guard=page.evaluate("""() => {
      const key='dc_recreation_save';
      const approved=JSON.parse(localStorage.getItem(key));
      approved.food+=11;
      const authoritative=JSON.stringify(approved);
      localStorage.setItem(key,authoritative);
      state.pendingBattle={id:'qa-stale-inflight'};
      state.food=approved.food-3;
      Object.defineProperty(document,'hidden',{configurable:true,
        get:()=>true});
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
      const preserved=localStorage.getItem(key)===authoritative;
      delete state.pendingBattle;
      state.food=approved.food;
      Object.defineProperty(document,'hidden',{configurable:true,
        get:()=>false});
      document.dispatchEvent(new Event('visibilitychange'));
      save(false);
      return {preserved,approvedFood:approved.food,
        liveFood:state.food};
    }""")
    assert settlement_guard['preserved'],settlement_guard
    assert settlement_guard['approvedFood']==settlement_guard['liveFood']

    # A second class of unfinished state, live hunting, must checkpoint the
    # encounter HP/time on visibilitychange (not only on pagehide).
    page.locator('[data-tab="hunt"]').click()
    page.locator('#explore').click()
    hunt=page.evaluate("""() => {
      const e=DCHuntUI.encounter;
      if(!e||e.mode!=='wild')throw Error('hunting not started');
      e.vx=0;e.vy=0;
      e.hp=Math.max(1,e.hp-3);
      e.time=Math.max(1,e.time-4);
      return {name:e.name,hp:e.hp,time:e.time,
        team:state.team.length,ropes:state.ropes};
    }""")
    persisted=page.evaluate("""() => {
      Object.defineProperty(document,'hidden',{configurable:true,
        get:()=>true});
      document.dispatchEvent(new Event('visibilitychange'));
      const saved=JSON.parse(localStorage.getItem('dc_recreation_save'));
      return {food:saved.food,session:saved.huntSession?.encounter,
        wild:saved.wild?.name,team:saved.team.length};
    }""")
    assert persisted['session']['name']==hunt['name'],persisted
    assert persisted['session']['hp']==hunt['hp'],persisted
    assert abs(persisted['session']['time']-hunt['time'])<.25,persisted
    assert persisted['team']==hunt['team'] and persisted['wild']==hunt['name']
    page.wait_for_timeout(350)
    freeze=page.evaluate('DCHuntUI.encounter.time')
    assert abs(freeze-hunt['time'])<.3,(freeze,hunt)
    page.evaluate("""() => {
      Object.defineProperty(document,'hidden',{configurable:true,
        get:()=>false});
      document.dispatchEvent(new Event('visibilitychange'));
    }""")

    # Verify a literal pagehide event flushes a late unsaved farm state
    # while the hunt owns the active browser tab.
    pagehide=page.evaluate("""() => {
      const previous=state.food;
      state.food+=2;
      window.dispatchEvent(new Event('pagehide'));
      return {previous,stored:JSON.parse(
        localStorage.getItem('dc_recreation_save')).food};
    }""")
    assert pagehide['stored']==pagehide['previous']+2,pagehide

    page.reload(wait_until='domcontentloaded',timeout=90000)
    page.wait_for_function('Boolean(window.DCHexFarm && window.DCHuntUI)')
    restored=page.evaluate("""() => ({
      food:state.food,day:state.day,seconds:state.world.seconds,
      paused:state.world.paused,
      name:DCHuntUI.encounter?.name,
      hp:DCHuntUI.encounter?.hp,
      time:DCHuntUI.encounter?.time,
      team:state.team.length,ropes:state.ropes
    })""")
    assert restored['food']==pagehide['stored'],restored
    assert restored['day']==progress['day'],restored
    assert restored['name']==hunt['name'] and restored['hp']==hunt['hp'],restored
    assert abs(restored['time']-hunt['time'])<.3,restored
    assert restored['team']==hunt['team'] and restored['ropes']==hunt['ropes'],restored
    assert not errors,errors
    print('PASS',entry,'touch' if mobile else 'desktop',
          '1200 simulated seconds + hidden save + hunt HP/time + pagehide + reload',
          flush=True)
    context.close()

def main():
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),
       functools.partial(QuietHandler,directory=str(ROOT)))
    worker=threading.Thread(target=server.serve_forever,daemon=True)
    worker.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                base=f'http://127.0.0.1:{server.server_port}'
                # Diagonal coverage plus existing four-combo journey CI.
                run(browser,base,'index.html',False)
                run(browser,base,'standalone.html',True)
            finally:browser.close()
    finally:
        server.shutdown();server.server_close();worker.join(timeout=3)

if __name__=='__main__':main()
