"""Chromium smoke checks tournament 2v2/3v3 squad entry and crash settlement."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re,json
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 src=(ROOT/'index.html').read_text()
 for var,val in [('EXTRA_SPRITE_FRAMES','{}'),('ROM_ASSETS','[]'),('SPRITE_FRAMES',"{'코로몬':['R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=']}"),('ANIMATION_SHEETS','{}'),('ROM_ARENA_IMAGES',"{grass:'',orange:'',stone:'',ring:''}"),('ROM_BATTLE_HUD',"''")]:
  src=re.sub(r'(^\s*const '+var+r'=)[^\n]*',lambda m:m.group(1)+val+';',src,count=1,flags=re.M)
 mock="<script>window.__savedData={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return window.__savedData[k]||null},setItem(k,v){window.__savedData[k]=String(v)}}});</script>"
 src=src.replace('<script',mock+'<script',1)
 page.set_content(src,wait_until='domcontentloaded',timeout=25000)
 result=page.evaluate('''()=>{
 const checks=[];
 for(const [id,day,wins,names,crowns,size] of [
  ['regional',5,2,['아구몬','가부몬'],{novice:1},2],
  ['grand',10,5,['아구몬','가부몬','그레이몬'],{novice:1,regional:1},3]]){
   state.championship={crowns};state.day=day;state.wins=wins;state.team=names.map(makeMon);state.selected=0;state.team.forEach(m=>m.hp=m.maxHp);render();
   const enabled=!document.querySelector(`[data-cup="${id}"]`).disabled;
   document.querySelector(`[data-cup="${id}"]`).click();document.querySelector('#championshipFight').click();
   const f={id,enabled,scale:document.querySelector('#lbTeamSize').value,allies:state.pendingBattle?.participants?.length,opponent:document.querySelector('#lbEnemy').value,waiting:!!state.championship.active.awaiting};
   document.querySelector('#lbClose').click();
   f.eliminated=state.championship.active===null;
   checks.push(f);
 }
 return checks;
 }''')
 print(json.dumps({'results':result,'errors':errors},ensure_ascii=False,indent=2))
 assert len(result)==2 and not errors
 assert all(x['enabled'] and int(x['scale'])==x['allies'] and x['eliminated'] for x in result)
 browser.close()
