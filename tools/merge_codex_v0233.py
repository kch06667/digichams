#!/usr/bin/env python3
"""v0.23.3 guarded port of Codex farm/navigation/save fixes onto v0.23.2 graphical+cup build.
Source comparison: GitHub kch06667/digichams main aa6db16 vs v0.23.2 snapshot.
Does not touch tournament engine or graphical sprites.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
F=ROOT/'src/farm-core.js'
U=ROOT/'src/hex-farm-ui.js'
C=ROOT/'src/hex-farm.css'

def replace_once(s, old, new, where):
    n=s.count(old)
    if n!=1: raise RuntimeError(f'{where}: expected 1 anchor found {n}: {old[:100]}')
    return s.replace(old,new,1)

farm=F.read_text()
assert 'function foodGround(' not in farm
helper=r'''// Same pixel-space hex geometry as the UI; placement must stay on open ground.
const HEX_CENTERS={core:[460,340],training:[460,128],garden:[270,234],track:[650,234],rest:[270,446],clinic:[650,446],forest:[460,552]};
function foodGround(s,x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 const px=369+x*1.82,py=262+y*1.56;
 return Object.entries(HEX_CENTERS).some(([id,[cx,cy]])=>{
  if(id!=='core'&&!s.facilities?.[id])return false;
  const dx=Math.abs(px-cx),dy=Math.abs(py-cy);
  // A small inset keeps the meal inside the clipped hex border.
  return dx<=102&&dy<=105-dx*113/220;
 });
}
function center(id){const [x,y]=HEX_CENTERS[id];return {x:(x-369)/1.82,y:(y-262)/1.56};}
function openZones(s){return Object.keys(HEX_CENTERS).filter(id=>id==='core'||s.facilities?.[id]);}
function zoneAt(s,p){return openZones(s).sort((a,b)=>Math.hypot(p.x-center(a).x,p.y-center(a).y)-Math.hypot(p.x-center(b).x,p.y-center(b).y))[0];}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function walkable(s,x,y){
 if(foodGround(s,x,y))return true;
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 return openZones(s).some(id=>id!=='core'&&segmentDistance({x,y},center('core'),center(id))<=9);
}
// Expansion topology, not recovered NDS movement: outer plots connect through core.
function routeTo(s,a,target){
 const from=zoneAt(s,a),to=zoneAt(s,target),points=[];
 if(from!==to){if(from!=='core')points.push(center(from));points.push(center('core'));if(to!=='core')points.push(center(to));}
 points.push({x:target.x,y:target.y});return points;
}
// Small ground footprints, not sprite bounding boxes. Numbers are expansion UX.
const PERSONAL_SPACE=10;
function safeStride(s,a,p,peers){
 if(!walkable(s,p.x,p.y))return false;
 return peers.every(b=>{
  const before=Math.hypot(a.x-b.x,a.y-b.y),after=Math.hypot(p.x-b.x,p.y-b.y);
  // Old saves/spawn positions may overlap. Permit only movement that separates them.
  if(before<PERSONAL_SPACE-1e-6)return after>before+1e-6;
  return segmentDistance(b,a,p)>=PERSONAL_SPACE-1e-6;
 });
}
function yieldIdle(s,a,target){
 const actors=activeActors(s);
 for(const b of actors){
  if(b===a||b.mode!=='idle'||b.goal||Math.hypot(a.x-b.x,a.y-b.y)>PERSONAL_SPACE*2||Math.hypot(target.x-b.x,target.y-b.y)>PERSONAL_SPACE)continue;
  const angle=Math.atan2(b.y-a.y,b.x-a.x);
  for(const turn of [Math.PI/2,-Math.PI/2,Math.PI,0]){
   const p={x:b.x+Math.cos(angle+turn)*18,y:b.y+Math.sin(angle+turn)*18};
   if(!foodGround(s,p.x,p.y)||actors.some(c=>c!==b&&Math.hypot(c.x-p.x,c.y-p.y)<PERSONAL_SPACE))continue;
   // Only idle actors yield: explicit training, rest and reserved meals are untouched.
   b.goal={...p,kind:'wander',yielding:true};b.mode='moving';b.route=null;b.routeKey=null;b.pose=2;break;
  }
 }
}
function stride(s,a,p,amount){
 const dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy),length=Math.min(d,amount);
 if(d<1e-9)return true;
 if(a.route.length===1)yieldIdle(s,a,p);
 const peers=activeActors(s).filter(b=>b!==a&&Math.hypot(a.x-b.x,a.y-b.y)<PERSONAL_SPACE+amount+1);
 // Consistent right-hand preference avoids symmetric head-on stand-offs.
 const angles=[0,Math.PI/6,Math.PI/3,Math.PI/2,2*Math.PI/3,5*Math.PI/6,Math.PI,-Math.PI/6,-Math.PI/3,-Math.PI/2,-2*Math.PI/3];
 for(const angle of angles){
  const ux=dx/d*Math.cos(angle)-dy/d*Math.sin(angle),uy=dx/d*Math.sin(angle)+dy/d*Math.cos(angle);
  const next={x:a.x+ux*length,y:a.y+uy*length};
  if(!safeStride(s,a,next,peers))continue;
  a.x=next.x;a.y=next.y;if(Math.abs(ux)>1e-9)a.face=ux<0?1:-1;a.pose=2;
  a.trafficWait=0;return angle===0&&length>=d-1e-9;
 }
 a.pose=0;a.trafficWait=(a.trafficWait||0)+amount/CFG.moveSpeed;
 return false;
}
function walk(s,a,target,dt){
 const key=target.x+','+target.y;
 if(a.routeKey!==key||!Array.isArray(a.route)||!a.route.length){a.routeKey=key;a.route=routeTo(s,a,target);}
 let travel=CFG.moveSpeed*dt;
 while(a.route.length){
  const p=a.route[0],d=Math.hypot(p.x-a.x,p.y-a.y);
  if(d<1e-9){a.route.shift();continue;}
  // A transit marker is not an action destination: walk around an occupied marker.
  if(a.route.length>1&&d<PERSONAL_SPACE*2&&activeActors(s).some(b=>b!==a&&Math.hypot(p.x-b.x,p.y-b.y)<PERSONAL_SPACE)){
   const next=a.route[1];
   if([.25,.5,.75].every(t=>walkable(s,a.x+(next.x-a.x)*t,a.y+(next.y-a.y)*t))){a.route.shift();continue;}
  }
  if(!stride(s,a,p,travel))return false;
  travel-=d;a.route.shift();
  if(travel<1e-9&&a.route.length)return false;
 }
 a.routeKey=null;return true;
}
function facilityKey(a){return a.goal&&SLOTS[a.goal.kind]?(a.goal.zone||'core')+':'+((a.goal.zone||'core')==='core'?a.goal.kind:'shared'):null;}
function activeActors(s){return s.team.filter(m=>!m.egg&&m.location!=='storage').map(m=>actor(s,m.instanceId));}
function stationPoint(a){const g=a.goal;return {x:g.x+(a.station===1?(g.zone==='core'&&g.x>50?-32:32):0),y:g.y};}
function reserveStation(s,a){
 const key=facilityKey(a);if(!key)return true;
 const peers=activeActors(s).filter(b=>b!==a&&facilityKey(b)===key);
 // Existing acting users get first claim when migrating saves without reservations.
 const reserved=new Set(peers.filter(b=>Number.isInteger(b.station)).map(b=>b.station));
 if(!Number.isInteger(a.station)||a.station<0||a.station>1||peers.some(b=>b.station===a.station&&b.mode==='acting')){
  a.station=[0,1].find(n=>!reserved.has(n));
 }
 if(a.station!==undefined){a.waitPosition=null;return true;}
 if(!a.waitPosition){
  const c=center(a.goal.zone||'core');
  // Bounded waiting positions; never grow queue rings outside the purchased hex.
  const occupied=activeActors(s).filter(b=>b!==a).map(b=>b.waitPosition||((Number.isInteger(b.station)&&b.goal)?stationPoint(b):b));
  outer:for(const dy of [30,12,-12,-30])for(const dx of [-32,0,32]){
   const p={x:c.x+dx,y:c.y+dy};
   if(foodGround(s,p.x,p.y)&&occupied.every(b=>Math.hypot(p.x-b.x,p.y-b.y)>=18)){a.waitPosition=p;break outer;}
  }
 }
 return false;
}
function migrateStations(s){
 const used=new Map();
 for(const a of activeActors(s).filter(a=>a.mode==='acting'&&facilityKey(a))){
  const key=facilityKey(a),taken=used.get(key)||new Set();used.set(key,taken);
  if(!Number.isInteger(a.station)||a.station<0||a.station>1||taken.has(a.station))a.station=[0,1].find(n=>!taken.has(n));
  if(a.station===undefined){a.mode='waiting';a.repositioning=true;continue;}
  taken.add(a.station);
  const p=stationPoint(a);
  if(Math.hypot(a.x-p.x,a.y-p.y)>1e-6){a.mode='moving';a.repositioning=true;a.route=null;}
 }
}
'''
farm=replace_once(farm,"const CARE=root.DCCare",helper+"const CARE=root.DCCare",'farm helpers')
farm=replace_once(farm,"a.foodId=null;a.waitPosition=null;a.idleTime=0;","a.foodId=null;a.waitPosition=null;a.station=undefined;a.route=null;a.routeKey=null;a.repositioning=false;a.trafficWait=0;a.idleTime=0;",'farm clear')
farm=replace_once(farm,"||!Number.isFinite(x)||!Number.isFinite(y))return false;","||!foodGround(s,x,y))return false;",'farm placement guard')
farm=replace_once(farm,"x:Math.max(-369/1.82,Math.min((920-369)/1.82,x)),y:Math.max(-262/1.56,Math.min((690-262)/1.56,y))","x,y",'farm placed food coords')
farm=replace_once(farm,' assignFood(s);\n for(const m of s.team){',' assignFood(s);\n migrateStations(s);\n for(const m of s.team){','farm station migration')
a=farm.index("   const waiting=a.mode==='waiting';")
b=farm.index("   a.mode='acting';a.remaining=",a)
assert b-a>1200
farm=farm[:a]+'''   const kind=a.goal.kind;
   const available=reserveStation(s,a);
   if(!available){
    a.mode='waiting';
    if(a.waitPosition){if(walk(s,a,a.waitPosition,dt))a.pose=0;}else a.pose=0;
    continue;
   }
   const target=facilityKey(a)?stationPoint(a):a.goal;
   a.mode='moving';
   if(!walk(s,a,target,dt))continue;
   if(kind==='wander'){a.goal=null;a.mode='idle';a.pose=0;continue;}
   if(a.repositioning){a.repositioning=false;a.mode='acting';a.pose=kind==='rest'?13:32;continue;}
'''+farm[b:]
farm=replace_once(farm,'SLOTS,PLOTS,destination,CFG};','SLOTS,PLOTS,destination,CFG,HEX_CENTERS,foodGround,walkable};','farm exports')
F.write_text(farm)

ui=U.read_text()
ui=replace_once(ui,"];\nconst byId=", "];\nfor(const f of CFG)[f.x,f.y]=core.HEX_CENTERS[f.id];\nconst byId=",'UI alignment')
old="layer.innerHTML=CFG.map(tileHTML).join('');"
new="layer.innerHTML=CFG.filter(f=>f.id!=='core'&&state.facilities[f.id]).map(f=>`<span class=\"hexPath\" aria-hidden=\"true\" style=\"left:460px;top:340px;width:${Math.hypot(f.x-460,f.y-340)}px;transform:translateY(-50%) rotate(${Math.atan2(f.y-340,f.x-460)}rad)\"></span>`).join('')+CFG.map(tileHTML).join('');"
ui=replace_once(ui,old,new,'UI paths')
ui=replace_once(ui,"toast('사육장 지도에서 먹이를 놓을 위치를 눌러 줘.');", "toast('지도에서 먹이 위치를 선택해 줘. 버튼을 다시 누르거나 Esc로 취소할 수 있어.');",'UI food prompt')
ui=replace_once(ui,"function toggleFoodPlacement(){if(foodPlacement)disarmFoodPlacement();else armFoodPlacement();}","function toggleFoodPlacement(){if(foodPlacement)disarmFoodPlacement();else armFoodPlacement();}\nwindow.addEventListener('keydown',e=>{if(e.key==='Escape'&&foodPlacement){disarmFoodPlacement();toast('먹이 놓기를 취소했어.');}});",'UI Esc')
ui=replace_once(ui,"  if(!core.placeFood(state,x,y))return toast('먹이가 부족하거나 바닥이 가득 찼어.');","  if(!core.foodGround(state,x,y))return toast('개방된 사육장 바닥 안쪽에 먹이를 놓아 줘.');\n  if(!core.placeFood(state,x,y))return toast('먹이가 부족하거나 지금은 놓을 수 없어.');",'UI placement')
ui=replace_once(ui,"gameVersion:'0.19.0'","gameVersion:'0.23.3'",'UI save header')
validation=r'''function validateSaveStructures(next){
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const fail=()=>{throw Error('세이브의 내부 기록이 손상되어 있어. 현재 게임은 유지돼.');};
 const object=v=>{if(v!=null&&!record(v))fail();};
 const numbers=(v,keys)=>{if(v)for(const k of keys)if(v[k]!=null&&!Number.isFinite(v[k]))fail();};
 const point=v=>{if(!record(v)||!Number.isFinite(v.x)||!Number.isFinite(v.y))fail();};
 for(const key of ['world','farm','facilities','cageFacilities','championship'])object(next[key]);
 numbers(next.world,['seconds','seed','careSeed','accumulator','speed']);
 if(next.world?.accumulator>1||next.world?.accumulator<0)fail();
 for(const m of next.team){
  if(!record(m))fail();
  if(m.instanceId!=null&&(typeof m.instanceId!=='string'||Object.prototype.hasOwnProperty.call(Object.prototype,m.instanceId)))fail();
  object(m.evo);object(m.care);object(m.evo?.ap);object(m.evo?.resist);
 }
 if(next.farm){
  object(next.farm.actors);
  if(next.farm.foods!=null){
   if(!Array.isArray(next.farm.foods)||next.farm.foods.length>12)fail();
   const foodIds=new Set();
   for(const f of next.farm.foods){point(f);numbers(f,['id','age']);if(!Number.isSafeInteger(f.id)||f.id<1||foodIds.has(f.id))fail();foodIds.add(f.id);}
  }
  for(const [id,a] of Object.entries(next.farm.actors||{})){
   if(Object.prototype.hasOwnProperty.call(Object.prototype,id))fail();
   point(a);numbers(a,['remaining','idleTime','station','trafficWait']);
   if(!['idle','moving','waiting','acting'].includes(a.mode))fail();
   for(const key of ['goal','waitPosition'])if(a[key]!=null)point(a[key]);
   if(a.goal&&(!['attack','defense','speed','rest','cage','eat','wander'].includes(a.goal.kind)||a.goal.zone!=null&&!Object.hasOwn(core.HEX_CENTERS,a.goal.zone)))fail();
   if(a.route!=null){if(!Array.isArray(a.route)||a.route.length>16)fail();a.route.forEach(point);}
   object(a.target);object(a.resumeOptions);
  }
 }
 if(next.championship){object(next.championship.crowns);object(next.championship.active);}
}
'''
ui=replace_once(ui,"function importSaveData(json){",validation+"function importSaveData(json){",'UI validation declaration')
ui=replace_once(ui," const next=json&&json.format==='digicham-save'?json.state:json;", " if(json?.format!=null&&(json.format!=='digicham-save'||json.exportVersion!==1))throw Error('지원하지 않는 세이브 형식이야.');\n const next=JSON.parse(JSON.stringify(json&&json.format==='digicham-save'?json.state:json));",'UI candidate deep clone')
ui=replace_once(ui,"if(!next||typeof next!=='object'||!Array.isArray(next.team)","if(!next||typeof next!=='object'||!Array.isArray(next.team)",'UI validation intro') if False else ui
line=" if(next.team.some(m=>!m||typeof m.name!=='string'"
ui=replace_once(ui,line," validateSaveStructures(next);\n"+line,'UI validate early')
a=ui.index(' // Only after validating, preserve the current state and replace it.')
b=ui.index('\n}',a)
ui=ui[:a]+''' // Initialize an isolated candidate; a rejected import never touches the live save.
 const ids=new Set();for(const m of next.team){if(!m.instanceId||ids.has(m.instanceId))m.instanceId=dcNewInstanceId();ids.add(m.instanceId);}
 DCEvolution.ensure(next);care.ensure(next);cages.ensure(next);core.ensure(next);
 const previous=state,previousTile=selected;
 try{
  state=next;prepare();selected='core';drawTiles();renderRoster();drawClock();drawStatus();render();centerOn('core');
 }catch(error){
  state=previous;knownState=null;selected=previousTile;prepare();drawTiles();renderRoster();drawClock();drawStatus();render();
  throw error;
 }
 // Commit persistent data only after the candidate also rendered successfully.
 try{if(!localStorage.getItem('dc_save_backup_before_import_v0144'))localStorage.setItem('dc_save_backup_before_import_v0144',JSON.stringify(previous));}catch{}
 disarmFoodPlacement();save(false);return true;'''+ui[b:]
ui=replace_once(ui,"wander:'산책'","wander:a?.goal?.yielding?'자리 양보':'산책'",'UI yielding label')
ui=replace_once(ui," const ar=state.farm.actors[mon.instanceId];", " const activity=(a?.mode==='moving'||a?.mode==='waiting')&&a.trafficWait>=.2?'통로 대기':labels[a?.mode]||'대기';\n const ar=state.farm.actors[mon.instanceId];",'UI waiting activity')
ui=replace_once(ui,"${labels[a?.mode]||'대기'}${a?.goal?", "${activity}${a?.goal?",'UI status')
ui=replace_once(ui,"function rank(){const w=state.wins||0,d=state.day||1;if(w>=9&&d>=10&&state.team.length>=3)return 3;if(w>=5&&d>=5&&state.team.length>=2)return 2;if(w>=2&&d>=3)return 1;return 0;}","function rank(){const w=state.wins||0,d=state.day||1;const legacy=w>=9&&d>=10&&state.team.length>=3?3:w>=5&&d>=5&&state.team.length>=2?2:w>=2&&d>=3?1:0;return Math.max(legacy,DCChampionship.ensure(state).rank);}",'v0.23.1 tournament rank preservation')
U.write_text(ui)

css=C.read_text()
assert '/* Placement targets the ground;' not in css
css+='''\n/* Placement targets the ground; actors must not steal selection clicks/taps. */
#farmPanel .farmWorld.foodPlacement{cursor:crosshair;}
#farmPanel .farmWorld.foodPlacement .hexActor{pointer-events:none;}

/* Walkable connectors use the same core-to-plot graph as the simulation. */
#farmPanel .hexPath{position:absolute;z-index:0;height:28px;transform-origin:0 50%;pointer-events:none;background:repeating-linear-gradient(90deg,#9c8756 0 12px,#827044 12px 14px);border-block:3px solid #544c35;box-sizing:border-box;}
'''
C.write_text(css)

# Patch the inline script/CSS blocks from the exact v0.23.2 code snapshot.
# Using regex anchored by ID avoids replacing the whole HTML, thereby preserving
# the tournament v0.23.1 script and all original graphics.
oldroot=Path('/mnt/data/digimon_dev_workspace/game')
for name in ['index.html','standalone.html']:
 path=ROOT/name
 html=path.read_text()
 for scriptid,src in [('farm-core-v0143','src/farm-core.js'),('hex-farm-v0143','src/hex-farm-ui.js')]:
  oldsrc=(oldroot/src).read_text()
  newsrc=(ROOT/src).read_text()
  # Inline source differs only by surrounding tag and optional trailing newlines.
  pattern=r'(<script id="'+scriptid+r'">)(.*?)(</script>)'
  m=re.search(pattern,html,re.S)
  if not m:raise RuntimeError('missing script id '+scriptid+' in '+name)
  if scriptid=='hex-farm-v0143':
   oldsrc=oldsrc.replace("function rank(){const w=state.wins||0,d=state.day||1;if(w>=9&&d>=10&&state.team.length>=3)return 3;if(w>=5&&d>=5&&state.team.length>=2)return 2;if(w>=2&&d>=3)return 1;return 0;}","function rank(){const w=state.wins||0,d=state.day||1;const legacy=w>=9&&d>=10&&state.team.length>=3?3:w>=5&&d>=5&&state.team.length>=2?2:w>=2&&d>=3?1:0;return Math.max(legacy,DCChampionship.ensure(state).rank);}")
  if m.group(2).strip()!=oldsrc.strip():
   raise RuntimeError('Inline mismatch for '+scriptid+' in '+name)
  html=html[:m.start(2)]+newsrc+html[m.end(2):]
 cssid='hex-farm-style-v0143'
 pattern=r'(<style id="'+cssid+r'">)(.*?)(</style>)'
 m=re.search(pattern,html,re.S)
 if not m:raise RuntimeError('missing CSS id '+cssid+' in '+name)
 oldcss=(oldroot/'src/hex-farm.css').read_text()
 # Standalone uses inlined webp data URI, so replacing the entire block would
 # break its independent art. Append only the seven Codex CSS rules.
 if name=='index.html':
  assert m.group(2).strip()==oldcss.strip(), 'Index CSS no longer synchronized'
  html=html[:m.start(2)]+css+html[m.end(2):]
 else:
  assert 'v0.23.2 map visual skin' in m.group(2)
  addition=css[len(oldcss):]
  html=html[:m.end(2)]+addition+html[m.end(2):]
 path.write_text(html)
 print('patched',name,'bytes',path.stat().st_size)
print('Codex migration integrated; preserve v0.23.2 tournament and visual layers')
