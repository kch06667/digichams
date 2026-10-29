"""Original playable 216-species game evolution guide on PC and mobile.

The actual existing goal-selection and catalog tree UI is driven through DOM.
No ROM/private sprite files are attached or uploaded by this test.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

def check(browser, filename, touch):
    context=browser.new_context(
        viewport={'width':390,'height':844} if touch else
                 {'width':1280,'height':800},
        is_mobile=touch,has_touch=touch)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content((ROOT/filename).read_text(encoding='utf-8'),
                     wait_until='domcontentloaded',timeout=90000)
    page.wait_for_function('Boolean(window.DCEvolutionGuide)')
    page.evaluate("""() => {
      state.team=[makeMon('아구몬')];state.selected=0;
      DCEvolution.ensure(state);render();
    }""")
    page.locator('[data-tab="dex"]').click()
    row=page.locator('#evolutionGoalDiagnostics .evoGuideRow').filter(
        has_text='지오그레이몬')
    assert row.count()==1
    first=row.inner_text()
    assert '전투 0 / 6' in first,first
    assert '용족 AP 0 / 20' in first,first
    baseline=page.evaluate("JSON.stringify(current().evo)")
    page.evaluate("DCEvolutionGuide.refresh()")
    assert page.evaluate("JSON.stringify(current().evo)")==baseline

    # Existing game's original target button still controls evolution choice.
    page.locator('#evolutionRules [data-evo-target="지오그레이몬"]').click()
    assert page.evaluate('current().evo.target')=='지오그레이몬'
    assert '다른 진화 분기는 보류' in page.locator(
        '#evolutionGoalDiagnostics').inner_text()
    page.evaluate("""() => {
      const m=current();
      for(let i=0;i<6;i++)DCEvolution.recordBattle(
        state,[m.instanceId],true,speciesLookup);
      m.evo.ap.dragon=14;render();
    }""")
    assert page.evaluate('current().name')=='아구몬'
    middle=row.inner_text()
    assert '전투 6 / 6' in middle,middle
    assert '용족 AP 14 / 20' in middle,middle
    assert '부족 6' in middle,middle
    page.evaluate("""() => {current().evo.ap.dragon=20;render();}""")
    assert '진화 조건 충족' in row.inner_text()
    page.locator('#evolve').click()
    assert page.evaluate('current().name')=='지오그레이몬'
    assert page.evaluate('current().evo.target') is None

    # Native catalog picker still drives the existing tree renderer.
    page.locator('#catalogSearch').fill('워그레이몬')
    assert page.locator('.catalogCard').count()>=1
    page.locator('.catalogCard').first.click()
    page.wait_for_function("""() => Boolean(
      document.getElementById('evolutionCatalogLineage')?.textContent
      ?.includes('메탈그레이몬'))""")
    lineage=page.locator('#evolutionCatalogLineage').inner_text()
    assert '진화 전:' in lineage and '메탈그레이몬' in lineage,lineage
    assert '진화 후:' in lineage

    # Mobile guide must remain within its own scrollable layout width;
    # never assert the entire legacy viewport has no preexisting overflow.
    if touch:
        widths=page.evaluate("""() => {
          const x=document.getElementById('evolutionGoalDiagnostics');
          return {actual:x.scrollWidth,available:x.clientWidth};
        }""")
        assert widths['actual']<=widths['available']+3,widths
    assert not errors,errors
    print('OK',filename,'touch' if touch else 'desktop',
          '477 route diagnosis, locked goal, actual evolution, catalog lineage',
          flush=True)
    context.close()

def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True)
        try:
            for filename in ('index.html','standalone.html'):
                for touch in (False,True):
                    check(browser,filename,touch)
        finally:
            browser.close()

if __name__=='__main__':main()
