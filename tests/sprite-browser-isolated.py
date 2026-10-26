"""Browser UI smoke test of the real sprite catalog component, isolated from the large ROM canvas.
Full-page navigation is blocked by this runtime's network administrator, so this is NOT full-game coverage.
"""
from pathlib import Path
import re,json,base64
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
page_html=BeautifulSoup((root/'index.html').read_text(),'html.parser')
fragment=str(page_html.select_one('#speciesCatalogPanel'))
last_script=page_html.find_all('script')[-1].text
entries=json.loads((root/'assets/species-catalog.json').read_text())['entries']
war=next(x for x in entries if x['name']=='워그레이몬')
frame=lambda i:base64.b64encode((root/f'assets/sprites/{war["folder"]}/{war["stem"]}_{i}.gif').read_bytes()).decode('ascii')
html='''<!doctype html><html lang="ko"><meta charset="utf-8"><style>.catalogCards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.catalogCard img{width:70px}</style><body>'''+fragment+'<script>const SPRITE_CATALOG='+json.dumps(entries,ensure_ascii=False)+';\nconst images='+json.dumps({'a':frame(0),'b':frame(7)})+';function spriteUrl(name,idx=0){return "data:image/gif;base64,"+(idx===7?images.b:images.a)};</script><script>'+last_script+'</script></body></html>'
report=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':390,'height':844})
 page=context.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=30000)
 assert page.locator('.catalogCard').count()==30
 page.locator('#catalogSearch').fill('워그레이몬')
 assert page.locator('.catalogCard').count()==2
 page.locator('.catalogCard').first.click()
 page.locator('[data-pose="7"]').click()
 assert '(7번)' in page.locator('#catalogPoseTitle').inner_text()
 assert page.locator('#catalogPreviewImg').evaluate('(img)=>img.complete&&img.naturalWidth>0')
 page.locator('#catalogSearch').fill('')
 page.locator('#catalogStage').select_option('mega')
 assert page.locator('.catalogCard').count()==30
 page.locator('#catalogNext').click()
 assert page.locator('.catalogCard').count()==7
 assert not errors,errors
 report.append({'test':'isolated actual catalog DOM in Chromium mobile viewport','search_wargreymon':2,'mega_page_two':7,'preview_image':'loaded','errors':errors,'status':'PASS'})
 context.close();browser.close()
(root/'tests/sprite-ui-isolated-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
