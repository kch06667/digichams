"""One SAVE, real original game: capture -> farm -> evolution -> owned battle
-> championship -> reload. Desktop + mobile-touch, index and standalone.

Only the arena fight-resolution hook is QA-driven; enemy HP is set to zero to
make the *real original settlement and save paths* deterministic. Actual
autonomous match AI is independently tested by existing Phaser browser CI.
No fake species, player-owned team injection, or direct prize granting.
"""
import functools
import http.server
import math
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
ARENA_ANCHOR=" window.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.style.display==='block')close()});reset();"
ARENA_HOOK="""window.__journeyArena={update,
  fighters:()=>fighters,settleMatch,
  finished:()=>finished};"""
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        path=self.path.split('?',1)[0].split('#',1)[0]
        if path in ('/index.html','/standalone.html'):
            src=(ROOT/path.lstrip('/')).read_text(encoding='utf-8')
            if src.count(ARENA_ANCHOR)!=1:
                self.send_error(500,'Arena QA hook unique anchor missing')
                return
            src=src.replace(ARENA_ANCHOR,ARENA_HOOK+ARENA_ANCHOR)
            b=src.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b)))
            self.end_headers()
            self.wfile.write(b)
            return
        super().do_GET()

def stroke(page,mobile,points):
    if not mobile:
        page.mouse.move(*points[0]);page.mouse.down()
        for point in points[1:]:page.mouse.move(*point)
        page.mouse.up()
        return
    cdp=page.context.new_cdp_session(page)
    try:
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart',
            'touchPoints':[{'x':points[0][0],'y':points[0][1]}]})
        for x,y in points[1:]:
            cdp.send('Input.dispatchTouchEvent',{'type':'touchMove',
                'touchPoints':[{'x':x,'y':y}]})
            page.wait_for_timeout(16)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    finally:
        cdp.detach()

def defeat_opponents(page):
    """Deterministic QA settlement using the ORIGINAL arena update / save."""
    result=page.evaluate("""() => {
      if(!state.pendingBattle)throw Error('battle was not registered');
      const match=window.__journeyArena.fighters();
      if(!match.length||!match.some(f=>f.side===1)||!match.some(f=>f.side===0))
        throw Error('missing original team in live battle');
      const before={wins:state.wins,losses:state.losses,
        lead:match.find(f=>f.side===0).instanceId,
        pending:state.pendingBattle.tournamentMatchId||null};
      for(const foe of match.filter(f=>f.side===1))foe.hp=0;
      __journeyArena.update(.016);__journeyArena.update(.016);
      return {before,wins:state.wins,losses:state.losses,
        pending:!!state.pendingBattle,settled:__journeyArena.finished()};
    }""")
    assert result['wins']==result['before']['wins']+1,result
    assert result['losses']==result['before']['losses'],result
    assert not result['pending'] and result['settled'],result
    page.locator('#lbClose').click()
    return result

def capture(page,mobile):
    page.locator('[data-tab="hunt"]').click()
    start=page.evaluate("""() => ({
      team:state.team.length,ropes:state.ropes,
      id:state.team[0].instanceId,starter:state.team[0].name})""")
    assert start['starter']=='코로몬',start
    assert start['ropes']>=1,start
    page.locator('#explore').click()
    page.evaluate("""() => {DCHuntUI.encounter.vx=0;DCHuntUI.encounter.vy=0;}""")
    prey=page.evaluate("DCHuntUI.encounter.name")
    page.locator('#throwRope').click()
    stage=page.locator('#huntStage')
    stage.scroll_into_view_if_needed()
    rect=stage.bounding_box()
    pos=page.evaluate("({x:DCHuntUI.encounter.x,y:DCHuntUI.encounter.y})")
    circle=[]
    for i in range(41):
        rad=2*math.pi*i/40
        circle.append((
          rect['x']+(pos['x']+.125*math.cos(rad))*rect['width'],
          rect['y']+(pos['y']+.125*math.sin(rad))*rect['height']))
    stroke(page,mobile,circle)
    phase=page.evaluate("DCHuntUI.encounter.mode")
    assert phase=='tied',(phase,prey)
    assert page.evaluate("state.ropes")==start['ropes']-1
    # The same encounter, paid rope and initial roster must survive true reload.
    page.reload(wait_until='domcontentloaded',timeout=90000)
    page.wait_for_function("Boolean(window.DCHuntUI&&window.__journeyArena)")
    page.locator('[data-tab="hunt"]').click()
    assert page.evaluate("DCHuntUI.encounter.mode")=='tied'
    assert page.evaluate("state.ropes")==start['ropes']-1
    stage.scroll_into_view_if_needed()
    rect=stage.bounding_box()
    for _ in range(14):
        if page.evaluate("DCHuntUI.encounter.mode")=='stunned':break
        pos=page.evaluate("({x:DCHuntUI.encounter.x,y:DCHuntUI.encounter.y})")
        begin=(rect['x']+pos['x']*rect['width'],
               rect['y']+pos['y']*rect['height'])
        end=(rect['x']+(pos['x']-.2)*rect['width'],begin[1])
        stroke(page,mobile,[begin,end])
    assert page.evaluate("DCHuntUI.encounter.mode")=='stunned'
    page.locator('#huntGrab').click()
    caught=page.evaluate("""() => ({
      team:state.team.map(x=>({id:x.instanceId,name:x.name})),
      wild:state.wild,session:state.huntSession,
      saved:JSON.parse(localStorage.getItem('dc_recreation_save')).team.length
    })""")
    assert len(caught['team'])==start['team']+1,caught
    assert caught['team'][-1]['name']==prey,caught
    assert caught['saved']==len(caught['team']) and caught['wild'] is None and caught['session'] is None,caught
    return {'starter':start['id'],'captured':caught['team'][-1]['id'],
            'prey':prey,'ropes':start['ropes']-1,'teamSize':len(caught['team'])}

def farm_and_goal(page,identity):
    page.locator('[data-tab="nursery"]').click()
    page.locator('#hexMon').select_option(identity['captured'])
    before=page.evaluate("""(id) => {
      const m=state.team.find(x=>x.instanceId===id);
      return {training:m.training,atk:m.atk,food:state.food};
    }""",identity['captured'])
    page.locator('[data-hex-command="attack"]').click()
    moving=page.evaluate("""(id)=> DCFarm.trainingStatus(state,id)""",identity['captured'])
    assert moving and moving['kind']=='attack',moving
    page.evaluate("""() => {
      state.world.paused=false;DCHexFarm.tick(22);
      state.world.paused=true;render();save(false);
    }""")
    after=page.evaluate("""(id) => {
      const m=state.team.find(x=>x.instanceId===id);
      return {training:m.training,atk:m.atk};
    }""",identity['captured'])
    assert after['training']>before['training'] or after['atk']>before['atk'],(before,after)

    # Select the REAL initial Koromon and lock its battle-count evolution.
    page.locator('#hexMon').select_option(identity['starter'])
    assert page.evaluate("current().name")=='코로몬'
    page.locator('[data-tab="dex"]').click()
    page.locator('#evolutionRules [data-evo-target="아구몬"]').click()
    assert page.evaluate("current().evo.target")=='아구몬'
    assert '전투 0 / 3' in page.locator(
        '#evolutionGoalDiagnostics .evoGuideRow').filter(has_text='아구몬').inner_text()
    # Saved midway through the single user journey; reload must retain the
    # captured Digimon, its actual training and starter target.
    page.locator('#save').click()
    page.reload(wait_until='domcontentloaded',timeout=90000)
    page.wait_for_function("Boolean(window.DCHexFarm&&window.__journeyArena)")
    restored=page.evaluate("""(ids) => ({
      captured:state.team.find(x=>x.instanceId===ids.captured),
      starter:state.team.find(x=>x.instanceId===ids.starter),
      team:state.team.length
    })""",identity)
    assert restored['team']==identity['teamSize'],restored
    assert restored['captured'] and (restored['captured']['training']>before['training'] or
                                     restored['captured']['atk']>before['atk']),restored
    assert restored['starter']['evo']['target']=='아구몬',restored

def battles_and_championship(page,identity):
    page.locator('#wideMode').click()
    for i in range(3):
        page.locator('#liveBattleLaunch').click()
        page.locator('#lbMode').select_option('owned')
        page.locator('#lbTeamSize').select_option('1')
        page.locator('#lbStart').click()
        result=defeat_opponents(page)
        assert result['before']['lead']==identity['starter'],result
    evolved=page.evaluate("""(ids)=>{
      const m=state.team.find(x=>x.instanceId===ids.starter);
      return {name:m.name,id:m.instanceId,battles:m.evo.battles,
        target:m.evo.target||null,wins:state.wins};
    }""",identity)
    assert evolved['name']=='아구몬' and evolved['id']==identity['starter'],evolved
    assert evolved['battles']>=3 and evolved['target'] is None,evolved
    # The original championship UI, not direct prize grants or forged saves.
    page.locator('[data-tab="battle"]').click()
    page.locator('[data-cup="novice"]').click()
    assert page.evaluate("state.championship.active?.cupId")=='novice'
    for round_index in (0,1):
        before=page.evaluate("""() => ({
          round:state.championship.active?.round,
          credits:state.facilityCredits,crowns:state.championship.crowns.novice||0
        })""")
        assert before['round']==round_index,before
        page.locator('#championshipFight').click()
        result=defeat_opponents(page)
        assert result['before']['pending'],result
        if round_index==0:
            assert page.evaluate("state.championship.active?.round")==1
            assert page.evaluate("state.championship.crowns.novice||0")==0
    end=page.evaluate("""(ids) => ({
      saved:JSON.parse(localStorage.getItem('dc_recreation_save')),
      wins:state.wins,crowns:state.championship.crowns.novice,
      credits:state.facilityCredits,
      active:state.championship.active,
      roster:state.team.map(x=>({id:x.instanceId,name:x.name}))
    })""",identity)
    assert end['crowns']==1 and end['active'] is None,end
    assert end['credits']>=260,end
    assert end['saved']['championship']['crowns']['novice']==1,end
    page.reload(wait_until='domcontentloaded',timeout=90000)
    page.wait_for_function("Boolean(window.DCChampionship&&window.DCHuntUI)")
    final=page.evaluate("""(ids)=>({
      ids:state.team.map(m=>m.instanceId),
      starter:state.team.find(m=>m.instanceId===ids.starter)?.name,
      captured:state.team.find(m=>m.instanceId===ids.captured)?.name,
      crowns:state.championship.crowns.novice,
      credits:state.facilityCredits,
      wins:state.wins,pending:!!state.pendingBattle,
      hunt:state.huntSession||null
    })""",identity)
    assert final['ids'].count(identity['starter'])==1,final
    assert final['ids'].count(identity['captured'])==1,final
    assert final['starter']=='아구몬' and final['captured']==identity['prey'],final
    assert final['crowns']==1 and final['credits']==end['credits'],final
    assert final['wins']==end['wins'] and not final['pending'] and final['hunt'] is None,final
    return final

def check(browser,origin,entry,mobile):
    options={'viewport':{'width':390,'height':844} if mobile else
                       {'width':1280,'height':800},
             'is_mobile':mobile,'has_touch':mobile}
    ctx=browser.new_context(**options)
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.goto(origin+'/'+entry,wait_until='domcontentloaded',timeout=90000)
    page.wait_for_function("Boolean(window.DCHuntUI&&window.DCFarm&&window.__journeyArena)")
    identity=capture(page,mobile)
    print('CAPTURE',entry,'touch' if mobile else 'desktop',identity,flush=True)
    farm_and_goal(page,identity)
    print('FARM + EVO GOAL',entry,flush=True)
    result=battles_and_championship(page,identity)
    assert not errors,errors
    print('PASS FULL JOURNEY',entry,'touch' if mobile else 'desktop',
          'CAPTURE→TRAIN→GOAL→EVOLVE→OWNED 3x→CUP 2x→RELOAD',result,flush=True)
    ctx.close()

def main():
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),
        functools.partial(Handler,directory=str(ROOT)))
    worker=threading.Thread(target=server.serve_forever,daemon=True)
    worker.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                origin=f'http://127.0.0.1:{server.server_port}'
                for entry,mobile in [('index.html',False),('standalone.html',True)]:
                    check(browser,origin,entry,mobile)
            finally:browser.close()
    finally:
        server.shutdown();server.server_close();worker.join(timeout=3)

if __name__=='__main__':main()
