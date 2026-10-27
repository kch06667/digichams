"""DOM paint regression for both legacy HTML bundles (Chromium desktop and touch).

Tests via page.set_content: no network, ROM or persistent localStorage dependency.
Requires Python Playwright + Chromium. Exercises farm actor updates without altering saves.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def verify(page, entry):
    page.set_content((ROOT / entry).read_text(encoding='utf-8'), wait_until='domcontentloaded', timeout=45000)
    page.wait_for_function('!!window.DCHexFarm && !!document.querySelector("#hexMon")')
    page.evaluate('state.world.paused=true')
    page.locator('[data-tab="nursery"]').click()
    page.evaluate('DCHexFarm.tick(0)')
    idle_mutations = page.evaluate('''async () => {
      const root=document.querySelector('#farmWorld');
      const seen=[];
      const observer=new MutationObserver(records => seen.push(...records.map(r=>r.type+':'+r.attributeName)));
      observer.observe(root,{subtree:true,attributes:true,characterData:true,childList:true});
      DCHexFarm.tick(0);
      await Promise.resolve();
      observer.disconnect();
      return seen;
    }''')
    assert idle_mutations == [], f'unexpected idle DOM writes: {idle_mutations}'
    moved = page.evaluate('''() => {
      const id=document.querySelector('#hexMon').value;
      const actor=state.farm.actors[id];
      const node=Array.from(document.querySelectorAll('#farmWorld .hexActor'))
        .find(el => el.dataset.mon === state.team.find(m=>m.instanceId===id).name);
      if(!node)throw Error('active actor missing');
      const old=node.style.left;actor.x+=1;
      DCHexFarm.tick(0);
      return {old,next:node.style.left};
    }''')
    assert moved['next'] != moved['old'], f'position did not repaint: {moved}'
    changed = page.evaluate('''() => {
      const select=document.querySelector('#hexMon');
      const mon=state.team.find(m=>m.instanceId===select.value);
      mon.level+=1;DCHexFarm.tick(0);
      return {level:mon.level,label:select.selectedOptions[0]?.textContent};
    }''')
    assert 'Lv.' + str(changed['level']) in changed['label'], f'level label stale: {changed}'


if __name__ == '__main__':
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            for entry in ('index.html', 'standalone.html'):
                for mobile in (False, True):
                    context = browser.new_context(viewport={'width': 390 if mobile else 1365, 'height': 844 if mobile else 900}, is_mobile=mobile, has_touch=mobile)
                    try:
                        page = context.new_page()
                        errors=[]
                        page.on('pageerror', lambda err: errors.append(str(err)))
                        verify(page, entry)
                        assert not errors, errors
                        print('PASS', entry, 'touch' if mobile else 'desktop', 'no-op paint / movement / roster level', flush=True)
                    finally:
                        context.close()
        finally:
            browser.close()
