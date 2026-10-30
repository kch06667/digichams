'use strict';
/* Real Windows Electron renderer integration test.
 * Verifies both 'npm start' and the electron-builder unpacked EXE.
 * No ROM access, screenshots, exported save files, or downloadable binaries.
 */
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {_electron}=require('playwright');

const desktopRoot=path.resolve(__dirname,'..');
const packaged=process.env.DC_PACKAGED_EXE||'';
const target=packaged?'packaged Windows game':'desktop development game';

async function run(){
  let app;
  const errors=[];
  // Never run a visual test against the player's real Electron save profile.
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'digichamp-ui-test-'));
  try{
    app=await _electron.launch({
      cwd:desktopRoot,
      env:{...process.env,DC_TEST_USER_DATA:profile},
      args:packaged?[]:['.'],
      ...(packaged?{executablePath:path.resolve(packaged)}:{})
    });
    const actualProfile=await app.evaluate(({app})=>app.getPath('userData'));
    assert.equal(path.resolve(actualProfile).toLowerCase(),
      path.resolve(profile).toLowerCase(),
      'automated UI test must not use a real player save profile');
    const page=await app.firstWindow({timeout:60000});
    page.on('pageerror',e=>errors.push(e.message));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(()=>
      document.querySelector('#farmPanel .farmWorld') && !!window.DCFarm,
      {timeout:60000});
    assert.match(page.url(),/^digichamp:\/\/game\//,
      'Electron must load the packaged local secure protocol');
    const desktop=await page.evaluate(()=>({
      width:innerWidth,
      height:innerHeight,
      title:document.title,
      world:[document.querySelector('#farmPanel .farmWorld').clientWidth,
        document.querySelector('#farmPanel .farmWorld').clientHeight],
      nativeNode:typeof window.require,
      nativeProcess:typeof window.process,
      origin:location.origin
    }));
    assert.ok(desktop.width>=900&&desktop.height>=600,
      'standalone window has unexpected small size');
    assert.deepEqual(desktop.world,[920,690],
      'game ranch geometry must not change in desktop integration');
    assert.equal(desktop.nativeNode,'undefined',
      'renderer must not expose Node require');
    assert.equal(desktop.nativeProcess,'undefined',
      'renderer must not expose Electron process');
    assert.match(desktop.origin,/^digichamp:\/\/game$/,
      'saved data must use the persistent game origin');

    // Source game, graphics and JS must be served locally from either the
    // source checkout or the EXE's resources/game, without remote CDNs.
    const localAssets=await page.evaluate(async()=>{
      const urls=[
        'src/farm-core.js',
        'assets/farm/hex_farm_v0232.webp',
        'assets/farm/continuous_ranch_preview.svg',
        'src/pc-ranch-facade-occlusion.js',
        'phaser-lab/index.html'
      ];
      return Promise.all(urls.map(async url=>{
        try {
          const result=await fetch(url,{cache:'no-store'});
          return {url,status:result.status,length:(await result.arrayBuffer()).byteLength};
        } catch(e) {return {url,error:String(e)};}
      }));
    });
    for(const asset of localAssets){
      assert.equal(asset.status,200,
        'local game asset missing from '+target+': '+JSON.stringify(asset));
      assert.ok(asset.length>0,
        'empty bundled game resource: '+asset.url);
    }

    // The ranch preview remains optional and the canonical game stays intact.
    if(!(await page.evaluate(()=>Boolean(window.DCContinuousRanchPreview))))
      await page.addScriptTag({url:'digichamp://game/src/pc-playability-guide.js'});
    await page.waitForFunction(()=>
      Boolean(window.DCContinuousRanchPreview&&window.DCRanchFacadeOcclusion),
      {timeout:30000});
    // The actual farm simulation runs continuously. Freeze *only for this
    // visual A/B assertion*, otherwise hunger/idle timers change naturally
    // while Playwright clicks the preview button.
    await page.evaluate(()=>{eval('state').world.paused=true;});
    const before=await page.evaluate(()=>{
      const s=eval('state');
      return JSON.stringify({
        team:s.team,facilities:s.facilities,food:s.food,
        farm:s.farm,wins:s.wins,championship:s.championship
      });
    });
    const toggle=page.locator('#dc-ranch-preview-toggle');
    assert.equal(await toggle.count(),1);
    assert.equal(await toggle.getAttribute('aria-pressed'),'false');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#farmPanel .farmWorld').evaluate(el=>
      getComputedStyle(el).backgroundImage),/continuous_ranch_preview\.svg/);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'),'false');
    const after=await page.evaluate(()=>{
      const s=eval('state');
      return JSON.stringify({
        team:s.team,facilities:s.facilities,food:s.food,
        farm:s.farm,wins:s.wins,championship:s.championship
      });
    });
    assert.equal(after,before,'graphics preview must never touch save state');

    // Use a *separate* probe key: do not mutate or overwrite game saves.
    const key='__dc_electron_validation_v1';
    await page.evaluate(k=>localStorage.setItem(k,'desktop-persist-ok'),key);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!document.querySelector('#farmPanel .farmWorld'));
    const saved=await page.evaluate(k=>localStorage.getItem(k),key);
    assert.equal(saved,'desktop-persist-ok',
      'standalone window failed to preserve localStorage across reload');

    // A reload is not the same as closing and reopening a Windows EXE.
    // Reuse the disposable profile after fully terminating Electron so the
    // actual disk-backed storage survives a true application cold start.
    await app.close();
    app=null;
    app=await _electron.launch({
      cwd:desktopRoot,
      env:{...process.env,DC_TEST_USER_DATA:profile},
      args:packaged?[]:['.'],
      ...(packaged?{executablePath:path.resolve(packaged)}:{})
    });
    const coldProfile=await app.evaluate(({app})=>app.getPath('userData'));
    assert.equal(path.resolve(coldProfile).toLowerCase(),
      path.resolve(profile).toLowerCase(),
      'cold-start run used a different profile than the first app launch');
    const coldPage=await app.firstWindow({timeout:60000});
    coldPage.on('pageerror',e=>errors.push(e.message));
    await coldPage.waitForLoadState('domcontentloaded');
    await coldPage.waitForFunction(()=>
      !!document.querySelector('#farmPanel .farmWorld'),
      {timeout:60000});
    assert.match(coldPage.url(),/^digichamp:\/\/game\//,
      'cold-start app must restore the same local game origin');
    const coldSaved=await coldPage.evaluate(k=>localStorage.getItem(k),key);
    assert.equal(coldSaved,'desktop-persist-ok',
      'app close and reopen lost the persisted localStorage value');
    await coldPage.evaluate(k=>localStorage.removeItem(k),key);
    assert.deepEqual(errors,[],'uncaught desktop renderer errors');
    console.log('PASS',target,'local protocol, 920x690 ranch, optional skin, secure renderer, assets, reload and cold-restart storage');
    console.log('PASS local resources',localAssets.map(a=>a.url).join(', '));
  }finally{
    if(app)await app.close();
    try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:250});}
    catch(e){console.warn('Could not clean disposable Electron test profile',e.message);}
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
