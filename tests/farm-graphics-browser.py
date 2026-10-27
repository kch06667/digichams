from pathlib import Path
import os, json, base64
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
results=[]
with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
  for name,width,height in [('index.html',1280,950),('standalone.html',390,844)]:
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
    try:
      html=(ROOT/name).read_text()
      # Local file navigation is disabled by the sandbox browser policy.
      # Embed the external image for the test; production path is separately verified.
      if name=='index.html':
        data='data:image/webp;base64,'+base64.b64encode((ROOT/'assets/farm/hex_farm_v0232.webp').read_bytes()).decode()
        html=html.replace('assets/farm/hex_farm_v0232.webp',data)
      page.set_content(html,wait_until='domcontentloaded',timeout=70000)
      page.wait_for_timeout(1200)
      img=page.locator('#farmWorld')
      assert img.count()==1
      assert page.locator('.hexTile').count()==7
      assert page.locator('.hexActor').count()>=1
      info=page.evaluate('''async()=>{
        const el=document.getElementById('farmWorld'),css=getComputedStyle(el);
        const image=css.backgroundImage;
        let loaded=false;
        if(image.includes('data:image/webp')){let url=image.slice(5,-2);const img=new Image();loaded=await new Promise(ok=>{img.onload=()=>ok(img.width===920&&img.height===690);img.onerror=()=>ok(false);img.src=url;});}
        else {const img=new Image();loaded=await new Promise(ok=>{img.onload=()=>ok(img.width===920&&img.height===690);img.onerror=()=>ok(false);img.src=new URL('assets/farm/hex_farm_v0232.webp',location.href).href;});}
        return {background:image.slice(0,70),loaded,actors:document.querySelectorAll('.hexActor').length,tiles:document.querySelectorAll('.hexTile').length};
      }''')
      assert info['loaded'],info
      # Confirm existing game commands and food placement react through map despite transparent hit areas.
      page.locator('#hexDrop').click()
      before=page.evaluate('state.farm.foods.length')
      page.locator('[data-hex="core"]').click(force=True)
      after=page.evaluate('state.farm.foods.length')
      assert after==before+1,(before,after)
      before=page.evaluate('state.food')
      page.locator('#hexDrop').click()
      page.locator('#hexDrop').click()
      assert page.evaluate('state.food')==before, 'cancel should not spend food'
      assert len(errors)==0,errors
      if name=='index.html':
        # View the actual in-game map and existing creatures/facility labels.
        page.locator('#farmViewport').screenshot(path='/mnt/data/Digimon_v0232_in_game_desktop.png',timeout=20000)
      else:
        page.locator('#farmViewport').screenshot(path='/mnt/data/Digimon_v0232_in_game_mobile.png',timeout=20000)
      results.append({'html':name,'status':'PASS','assetsLoaded':info['loaded'],'tiles':info['tiles'],'actors':info['actors'],'foodPlaced':after,'pageErrors':errors})
    except Exception as e:
      results.append({'html':name,'status':'FAIL','error':str(e)[:1400],'pageErrors':errors[:5]})
    finally:page.close()
  browser.close()
(ROOT/'tests'/'farm-graphics-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
assert all(v['status']=='PASS' for v in results)
