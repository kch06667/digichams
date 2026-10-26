"""Real Chromium DOM test for complete evolution catalog UI, isolated from heavy legacy game canvas."""
from pathlib import Path
import re,json,base64
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
html=BeautifulSoup((root/'index.html').read_text(),'html.parser')
fragment=str(html.select_one('#speciesCatalogPanel'))
last_script=html.find_all('script')[-1].text
entries=json.loads((root/'assets/species-catalog.json').read_text())['entries']
war=next(x for x in entries if x['name']=='워그레이몬')
frame=lambda i:base64.b64encode((root/f'assets/sprites/{war["folder"]}/{war["stem"]}_{i}.gif').read_bytes()).decode('ascii')
page_src=('''<!doctype html><html lang="ko"><meta charset="utf-8"><body>'''+fragment+
 '<script>const SPRITE_CATALOG='+json.dumps(entries,ensure_ascii=False)+';\nconst images='+json.dumps({'a':frame(0),'b':frame(7)})+';'
 'function spriteUrl(name,idx=0){return "data:image/gif;base64,"+(idx===7?images.b:images.a)};</script>'
 '<script>'+ (root/'src/evolution-core.js').read_text()+'</script><script>'+last_script+'</script></body></html>')
report=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [390,1280]:
  context=browser.new_context(viewport={'width':width,'height':850});page=context.new_page()
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(page_src,wait_until='domcontentloaded',timeout=30000)
  assert page.locator('.catalogCard').count()==30
  assert page.locator('.evoTree').count()==1
  assert '메탈그레이몬' in page.locator('.evoTree').inner_text()
  page.locator('[data-evo-explore="메탈그레이몬"]').first.click()
  assert page.locator('#catalogDetail h3').inner_text()=='메탈그레이몬'
  assert '워그레이몬' in page.locator('.evoTree').inner_text()
  page.locator('[data-evo-explore="워그레이몬"]').first.click()
  assert page.locator('#catalogDetail h3').inner_text()=='워그레이몬'
  page.locator('[data-pose="7"]').click()
  assert '(7번)' in page.locator('#catalogPoseTitle').inner_text()
  assert page.locator('#catalogPreviewImg').evaluate('(img)=>img.complete&&img.naturalWidth>0')
  page.locator('#catalogSearch').fill('아구몬'); assert page.locator('.catalogCard').count()>=2
  assert not errors,errors
  report.append({'viewport_width':width,'tree_navigation':'PASS','sprite_preview':'PASS','search':'PASS','js_errors':errors})
  context.close()
 browser.close()
(root/'tests/evolution-ui-browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
