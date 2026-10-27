"""HTTP rendering, queue separation and save checks; screenshots stay in ignored test-output."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
OUTPUT=ROOT/'test-output/farm-routing'
OUTPUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
errors=[]
setup="""() => {
 state.world.paused=true;
 const base=JSON.parse(JSON.stringify(state.team[0]));
 state.team=['a','b','c'].map(instanceId=>({...JSON.parse(JSON.stringify(base)),instanceId,egg:false,hp:500,maxHp:500,fatigue:0}));
 state.facilities.training=true;state.facilities.rest=true;state.farm.actors={};
 const saved=DCHexFarm.exportSaveObject();DCHexFarm.importSaveObject(saved);
 for(const m of state.team) DCFarm.command(state,m.instanceId,'attack');
 state.world.paused=false;DCHexFarm.tick(12);state.world.paused=true;
 DCHexFarm.choose('training');
}"""
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
        for entry in ['index.html','standalone.html']:
            for mobile in [False,True]:
                context=browser.new_context(viewport={'width':390 if mobile else 1365,'height':844 if mobile else 900},has_touch=mobile,is_mobile=mobile)
                page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(f'http://127.0.0.1:{server.server_port}/{entry}',wait_until='load')
                page.wait_for_function('!!window.DCHexFarm')
                page.locator('#wideMode').click();page.locator('[data-tab="nursery"]').click()
                page.evaluate(setup)
                page.wait_for_timeout(400)
                assert page.locator('.hexPath').count()==2
                actors=page.evaluate('Object.values(state.farm.actors).map(a=>({mode:a.mode,x:a.x,y:a.y}))')
                assert [a['mode'] for a in actors].count('acting')==2,actors
                assert actors[2]['mode']=='waiting'
                boxes=page.locator('.hexActor').evaluate_all('(nodes)=>nodes.map(n=>({x:parseFloat(n.style.left),y:parseFloat(n.style.top)}))')
                assert abs(boxes[0]['x']-boxes[1]['x'])>=58,boxes
                for mode in ['dsMode','wideMode']:
                    page.locator('#'+mode).click()
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                page.locator('#farmViewport').scroll_into_view_if_needed()
                page.locator('#farmViewport').screenshot(path=str(OUTPUT/f'{entry}-{ "touch" if mobile else "desktop"}-after.png'))
                saved=page.evaluate('DCHexFarm.exportSaveObject()')
                page.evaluate('(saved)=>DCHexFarm.importSaveObject(saved)',saved)
                assert page.evaluate('state.team.map(m=>m.training)')==[m['training'] for m in saved['state']['team']]
                page.evaluate("DCFarm.command(state,'a','stop');state.world.paused=false;DCHexFarm.tick(8);state.world.paused=true")
                assert page.evaluate("state.team.find(m=>m.instanceId==='c').training")>0
                traffic=page.evaluate("""() => {
                    const base=JSON.parse(JSON.stringify(state.team[0]));
                    state.team=['a','b','c','d'].map(instanceId=>({...JSON.parse(JSON.stringify(base)),instanceId,egg:false,hunger:0,fatigue:0}));
                    state.farm.actors={};DCFarm.ensure(state);state.world.paused=false;
                    const paths=[[20,50,80,50],[80,50,20,50],[50,20,50,80],[50,80,50,20]];
                    Object.values(state.farm.actors).forEach((a,i)=>Object.assign(a,{x:paths[i][0],y:paths[i][1],mode:'moving',goal:{kind:'wander',x:paths[i][2],y:paths[i][3]}}));
                    let minimum=Infinity;const arrived=new Set();
                    for(let tick=0;tick<400;tick++){
                        DCFarm.step(state,.05);
                        const as=Object.values(state.farm.actors);
                        as.forEach((a,i)=>{if(a.mode==='idle'){arrived.add(i);a.idleTime=-100;}});
                        for(let i=0;i<as.length;i++)for(let j=i+1;j<as.length;j++)minimum=Math.min(minimum,Math.hypot(as[i].x-as[j].x,as[i].y-as[j].y));
                    }
                    state.world.paused=true;DCHexFarm.tick(0);
                    return {minimum,arrived:arrived.size};
                }""")
                assert traffic['minimum']>=9.99 and traffic['arrived']==4,traffic
                assert page.locator('.hexActor').count()==4
                assert not errors,errors
                print('PASS' ,entry,'touch' if mobile else 'desktop','stations / queue / save / four-way avoidance',flush=True)
                context.close()
        browser.close()
finally:
    server.shutdown();server.server_close()
