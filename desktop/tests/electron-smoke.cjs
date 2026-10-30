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

    // The EXE should present one ranch viewport and two menu rows, not
    // a long webpage with separate lower management windows.
    await page.waitForFunction(()=>!!document.querySelector('#dc-pc-visual-polish')?.sheet,
      null,{timeout:30000});
    const shell=await page.evaluate(()=>{
      const nav=document.querySelector('.wrap > nav.tabs');
      const css=getComputedStyle(nav);
      return {columns:css.gridTemplateColumns.split(' ').length,
        rows:css.gridTemplateRows.split(' ').length,
        stageHeight:document.querySelector('#nursery.active #farmPanel')?.clientHeight,
        viewportHeight:innerHeight};
    });
    assert.equal(shell.columns,3,'PC menu should occupy 3 columns');
    assert.equal(shell.rows,2,'PC menu must be exactly two rows');
    assert.ok(shell.stageHeight>250&&shell.stageHeight<=shell.viewportHeight,
      'ranch viewport should fit inside the one-window PC game shell');

    // Verify actual species animation GIFs through the same secure local
    // protocol in both development mode and the packaged Windows EXE.
    const nativeGifs=await page.evaluate(async()=>{
      const urls=['assets/sprites/rookie/m201_agumon_main_0.gif',
        'assets/sprites/champion/m357_unimon_main_4.gif'];
      return Promise.all(urls.map(async url=>{
        const response=await fetch(url,{cache:'no-store'});
        const data=new Uint8Array(await response.arrayBuffer());
        return {url,status:response.status,length:data.byteLength,
          signature:String.fromCharCode(...data.slice(0,6))};
      }));
    });
    for(const gif of nativeGifs){
      assert.equal(gif.status,200,'missing original species GIF: '+gif.url);
      assert.ok(gif.length>32,'empty/corrupt GIF: '+gif.url);
      assert.equal(gif.signature,'GIF89a','invalid GIF: '+gif.url);
    }

    // The original farm launcher used /phaser-lab/ (a folder). Electron
    // must serve the actual local HTML there, not a 404 Not Found page.
    const directoryAlias=await page.evaluate(async()=>{
      const response=await fetch('phaser-lab/?farmHandoff=route-check');
      const html=await response.text();
      return {status:response.status,
        local:html.includes('./vendor/phaser.min.js'),
        valid:html.includes('id="game"')};
    });
    assert.deepEqual(directoryAlias,{status:200,local:true,valid:true},
      'production Phaser folder URL must never return Not Found');

    // The ACTUAL packaged Windows game must start a real 216-species
    // Phaser battle with the network disconnected. Previous checks only
    // exercised the Electron shell, not the imported battle engine.
    const offlineAssets=await page.evaluate(async()=>{
      const htmlResponse=await fetch('phaser-lab/index.html',{cache:'no-store'});
      const html=await htmlResponse.text();
      const engine=await fetch('phaser-lab/vendor/phaser.min.js',
        {cache:'no-store'});
      const bytes=(await engine.arrayBuffer()).byteLength;
      return {htmlStatus:htmlResponse.status,engineStatus:engine.status,
        bytes,local:html.includes('./vendor/phaser.min.js'),
        cdn:html.includes('https://cdn.jsdelivr.net/npm/phaser@')};
    });
    assert.equal(offlineAssets.htmlStatus,200);
    assert.equal(offlineAssets.engineStatus,200,
      'packaged Windows battle must serve local Phaser with no CDN fetch');
    assert.ok(offlineAssets.local&&!offlineAssets.cdn,
      'Windows game battle page must NEVER load Phaser over the internet');
    assert.ok(offlineAssets.bytes>200000&&offlineAssets.bytes<2*1024*1024);
    // Actively block ALL external web requests, not just the known CDN.
    // The real same-origin digichamp:// game and 216 built-in GIFs must
    // initialize and render without any permitted external network access.
    const externalRequests=[];
    await page.route(/^https?:\/\//,route=>{
      externalRequests.push(route.request().url());
      return route.abort();
    });
    await page.evaluate(()=>{
      const frame=document.createElement('iframe');
      frame.id='dc-desktop-offline-phaser-probe';
      frame.src='phaser-lab/index.html?embeddedBattle=1';
      frame.style.cssText='position:fixed;left:-1400px;top:0;'+
        'width:800px;height:500px;pointer-events:none;border:0';
      document.body.appendChild(frame);
    });
    try{
      await page.waitForFunction(()=>{
        const frame=document.querySelector('#dc-desktop-offline-phaser-probe');
        const child=frame?.contentWindow;
        return child?.Phaser && child?.DigiPhaserLab?.stageStatus?.().nativeArt===6;
      },null,{timeout:45000});
      const offlineBattle=await page.evaluate(()=>{
        const frame=document.querySelector('#dc-desktop-offline-phaser-probe');
        const child=frame.contentWindow,stage=child.DigiPhaserLab.stageStatus();
        return {stage,srcs:[...child.document.querySelectorAll(
          '#dc-native-battle-gifs img')].map(img=>img.getAttribute('src'))};
      });
      assert.equal(offlineBattle.stage.fighters,6);
      assert.equal(offlineBattle.stage.nativeArt,6,
        'Windows bundled Phaser must show all six REAL original Digimon GIFs');
      assert.equal(offlineBattle.srcs.length,6);
      for(const src of offlineBattle.srcs)
        assert.ok(src?.startsWith('../assets/sprites/')&&src.endsWith('.gif'),
          'native original GIF path missing: '+String(src));
      assert.deepEqual(externalRequests,[],
        'actual Windows Phaser fight must make ZERO external HTTP(S) requests');
    }finally{
      await page.evaluate(()=>document.querySelector(
        '#dc-desktop-offline-phaser-probe')?.remove());
    }

    // The ranch preview remains optional and the canonical game stays intact.
    if(!(await page.evaluate(()=>Boolean(window.DCContinuousRanchPreview))))
      await page.addScriptTag({url:'digichamp://game/src/pc-playability-guide.js'});
    await page.waitForFunction(()=>
      Boolean(window.DCContinuousRanchPreview&&window.DCRanchFacadeOcclusion&&
        window.DCRanchSpriteGuard),
      {timeout:30000});
    const sameSpecies=await page.evaluate(()=>DCRanchSpriteGuard.fallbackUrlFor(
      'assets/sprites/rookie/m201_agumon_main_14.gif'));
    assert.equal(sameSpecies,'assets/sprites/rookie/m201_agumon_main_0.gif',
      'Windows native game must use identical-species GIF fallback');
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
    await page.locator('#dc-pc-drawer-toggle').click();
    assert.equal(await toggle.getAttribute('aria-pressed'),'false');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#farmPanel .farmWorld').evaluate(el=>
      getComputedStyle(el).backgroundImage),/continuous_ranch_preview\.svg/);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'),'false');
    await page.locator('#dc-pc-drawer-close').click();
    const after=await page.evaluate(()=>{
      const s=eval('state');
      return JSON.stringify({
        team:s.team,facilities:s.facilities,food:s.food,
        farm:s.farm,wins:s.wins,championship:s.championship
      });
    });
    assert.equal(after,before,'graphics preview must never touch save state');

    // A closed Phaser overlay may stay mounted after combat. It must NOT
    // disable PC farm/hunt/battle navigation for the rest of the session.
    const flow=await page.evaluate(()=>{
      if(!window.DCPCGuide)throw Error('PC original-game guide missing');
      const existing=document.getElementById('dc-phaser-overlay');
      if(existing)throw Error('Fresh game unexpectedly has active Phaser overlay');
      const ghost=document.createElement('div');
      ghost.id='dc-phaser-overlay';ghost.style.cssText=
        'display:none;position:fixed;width:22px;height:22px';
      document.body.append(ghost);
      try{
        const hunt=DCPCGuide.navigate('hunt');
        const huntActive=document.querySelector('nav.tabs button.active')?.dataset.tab;
        ghost.style.display='block';
        const blocked=DCPCGuide.navigate('battle');
        const battleNotEntered=document.querySelector('nav.tabs button.active')?.dataset.tab;
        ghost.hidden=true;
        const battle=DCPCGuide.navigate('battle');
        const nursery=DCPCGuide.navigate('nursery');
        return {hunt,huntActive,blocked,battleNotEntered,battle,nursery,
          final:document.querySelector('nav.tabs button.active')?.dataset.tab};
      }finally{ghost.remove();}
    });
    assert.deepEqual(flow,{
      hunt:true,huntActive:'hunt',blocked:false,battleNotEntered:'hunt',
      battle:true,nursery:true,final:'nursery'
    },'hidden Phaser overlay must not trap user out of game tabs');
    const afterNavigation=await page.evaluate(()=>{
      const s=eval('state');return JSON.stringify({
        team:s.team,facilities:s.facilities,food:s.food,
        farm:s.farm,wins:s.wins,championship:s.championship
      });
    });
    assert.equal(afterNavigation,before,'PC navigation must never change player save');

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
