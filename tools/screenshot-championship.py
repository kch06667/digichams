from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
s=(root/'index.html').read_text()
for var,val in [('EXTRA_SPRITE_FRAMES','{}'),('ROM_ASSETS','[]'),('SPRITE_FRAMES',"{'코로몬':['R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=']}"),('ANIMATION_SHEETS','{}'),('ROM_ARENA_IMAGES',"{grass:'',orange:'',stone:'',ring:''}"),('ROM_BATTLE_HUD',"''")]:
 s=re.sub(r'(^\s*const '+var+r'=)[^\n]*',lambda m:m.group(1)+val+';',s,count=1,flags=re.M)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 page=b.new_page(viewport={'width':880,'height':720},device_scale_factor=1)
 page.set_content(s,wait_until='domcontentloaded',timeout=30000)
 page.evaluate("""()=>{state.team=['아구몬','가부몬','그레이몬'].map(makeMon);state.day=10;state.wins=9;state.championship={crowns:{novice:1,regional:1},history:[]};render();document.querySelector('[data-tab=battle]').click();document.querySelector('[data-cup=grand]').click();}""")
 page.locator('#championshipPanel').screenshot(path='/mnt/data/digimon_championship_v0231_bracket_preview.png',timeout=15000)
 print('Screenshot saved')
 b.close()
