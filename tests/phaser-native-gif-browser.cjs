'use strict';
/* Browser smoke of the ACTUAL Phaser game with original GIFs, NO private PNG.
 * Does not modify the player save, publish sprites or start an emulator.
 */
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const vendor=path.join(root,'node_modules/phaser/dist/phaser.min.js');
const MIME={'.html':'text/html','.js':'application/javascript',
 '.json':'application/json','.gif':'image/gif','.png':'image/png',
 '.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const full=path.resolve(root,'.'+pathname);
  if(!full.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(full,(err,buf)=>{
   if(err)return res.writeHead(404).end();
   res.setHeader('Content-Type',MIME[path.extname(full)]||'application/octet-stream');
   res.end(buf);
  });
 }catch(_){res.writeHead(400).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,
   args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  assert.ok(fs.existsSync(vendor),'test requires pinned Phaser at node_modules');
  for(const mobile of [false,true]){
   const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1280,height:800},
    isMobile:mobile,hasTouch:mobile
   });
   const errors=[],page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js',
     route=>route.fulfill({path:vendor,contentType:'application/javascript'}));
   await page.goto('http://127.0.0.1:'+server.address().port+'/phaser-lab/',
     {waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.DigiPhaserLab?.stageStatus()?.fighters===6,
     {timeout:25000});
   await page.waitForFunction(()=>window.DigiPhaserLab?.stageStatus()?.nativeArt===6,
     {timeout:25000});
   const start=await page.evaluate(()=>({
    stage:DigiPhaserLab.stageStatus(),
    art:DigiPhaserLab.renderedArt(),
    overlay:[...document.querySelectorAll('#dc-native-battle-gifs img')]
      .map(img=>({src:img.getAttribute('src'),width:img.naturalWidth,
       height:img.naturalHeight,visible:getComputedStyle(img).visibility,
       x:img.style.left,y:img.style.top}))
   }));
   assert.equal(start.stage.fallback,0,JSON.stringify(start.stage));
   assert.equal(start.stage.nativeArt,6);
   assert.equal(start.overlay.length,6);
   assert.ok(start.art.every(f=>f.nativeArt&&!f.privateArt));
   for(const item of start.overlay){
    assert.match(item.src,/^\.\.\/assets\/sprites\/.+_\d+\.gif$/);
    assert.ok(item.width>0&&item.height>0);
    assert.equal(item.visible,'visible');
    assert.doesNotMatch(item.x+item.y,/NaN|Infinity/);
   }
   // The existing ORIGINAL auto combat should now visibly switch animated GIF
   // pose IDs in real time (not alternating synthetic attack markers).
   await page.locator('#battle').click();
   await page.waitForFunction(()=>window.DigiPhaserLab?.matchSnapshot()?.elapsed>.05,
     {timeout:12000});
   let changed=false;
   for(let i=0;i<30;i++){
    const poses=await page.evaluate(()=>DigiPhaserLab.renderedArt().map(a=>a.nativePose));
    if(poses.some(p=>p!==0&&p!==2&&p!==3)){changed=true;break;}
    await page.waitForTimeout(220);
   }
   assert.ok(changed,'real battle must switch native GIF action IDs');
   await page.locator('#duel').click();
   await page.waitForFunction(()=>window.DigiPhaserLab?.stageStatus()?.fighters===2,
     {timeout:12000});
   await page.waitForFunction(()=>window.DigiPhaserLab?.stageStatus()?.nativeArt===2,
     {timeout:15000});
   assert.equal(await page.locator('#dc-native-battle-gifs img').count(),2,
     'scene.restart must remove old battle GIF nodes');
   await page.evaluate(()=>DigiPhaserLab.qaFinishCombat());
   assert.equal(await page.evaluate(()=>DigiPhaserLab.matchSnapshot().finished),true);
   assert.deepEqual(errors,[],'no Phaser/DOM image layer crashes');
   console.log('PASS actual original 216-species GIF 3v3 -> native attacks -> 1v1 restart -> finish,',
     mobile?'touch':'desktop');
   await context.close();
  }
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
