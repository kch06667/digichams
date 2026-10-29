'use strict';
/* Continuous-ranch preview only: verify original game DOM and save are untouched. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css',
  '.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp',
  '.png':'image/png','.gif':'image/gif'};
const server=http.createServer((req,res)=>{
  let file;
  try{const url=new URL(req.url,'http://localhost');
    file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  }catch{res.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,buf)=>{
    if(err){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    res.end(buf);
  });
});
async function measure(page){
  return page.evaluate(()=>{
    const world=document.querySelector('#farmPanel .farmWorld');
    const tiles=[...document.querySelectorAll('#farmPanel .hexTile')];
    return {
      worldSize:{width:world.clientWidth,height:world.clientHeight},
      tileCount:tiles.length,
      tiles:tiles.map(t=>({id:t.dataset.hex,left:t.style.left,top:t.style.top})),
      actorCount:document.querySelectorAll('#farmPanel .hexActor').length,
      foodCount:document.querySelectorAll('#farmPanel .hexFood').length,
      background:getComputedStyle(world).backgroundImage,
      documentWidth:document.documentElement.scrollWidth,
      save:JSON.stringify((()=>{
        const s=eval('state');
        return {team:s.team,facilities:s.facilities,farm:s.farm,
          food:s.food,wins:s.wins,championship:s.championship};
      })())
    };
  });
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true,
      executablePath:process.env.CHROMIUM_PATH||undefined,
      args:['--no-sandbox','--disable-dev-shm-usage']});
    const base='http://127.0.0.1:'+server.address().port;
    for(const [width,height] of [[1366,768],[1024,768]]){
      const page=await browser.newPage({viewport:{width,height}});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/',{waitUntil:'domcontentloaded'});
      if(!await page.evaluate(()=>Boolean(window.DCPCGuide)))
        await page.addScriptTag({url:base+'/src/pc-playability-guide.js'});
      await page.waitForFunction(()=>Boolean(window.DCContinuousRanchPreview),{timeout:12000});
      await page.waitForFunction(()=>Boolean(document.querySelector('#dc-continuous-ranch-css')?.sheet));
      await page.evaluate(()=>{eval('state').world.paused=true;});
      const original=await measure(page);
      assert.deepEqual(original.worldSize,{width:920,height:690});
      assert.equal(original.tileCount,7);
      assert.equal(await page.locator('#dc-ranch-preview-toggle').getAttribute('aria-pressed'),'false');
      await page.locator('#dc-ranch-preview-toggle').click();
      assert.equal(await page.locator('#dc-ranch-preview-toggle').getAttribute('aria-pressed'),'true');
      const scene=await measure(page);
      assert.ok(scene.background.includes('continuous_ranch_preview.svg'),scene.background);
      assert.equal(scene.worldSize.width,original.worldSize.width);
      assert.equal(scene.worldSize.height,original.worldSize.height);
      assert.deepEqual(scene.tiles,original.tiles,'facility placement must remain unchanged');
      assert.equal(scene.actorCount,original.actorCount);
      assert.equal(scene.foodCount,original.foodCount);
      assert.equal(scene.save,original.save,'terrain preview must not modify the gameplay state');
      assert.ok(scene.documentWidth<=width+4,'unexpected sideways page scroll: '+scene.documentWidth);
      const response=await page.request.get(base+'/assets/farm/continuous_ranch_preview.svg');
      assert.equal(response.status(),200,'preview terrain asset must load');
      const svg=await response.text();
      assert.ok(svg.includes('viewBox="0 0 920 690"')&&svg.includes('<svg'));
      await page.locator('#dc-ranch-preview-toggle').click();
      const reverted=await measure(page);
      assert.ok(reverted.background.includes('hex_farm_v0232.webp'));
      assert.equal(reverted.save,original.save,'reverting preview must preserve gameplay state');
      assert.equal(errors.length,0,JSON.stringify(errors));
      console.log('PASS PC continuous-ranch preview',width,height,
        'unchanged tiles',original.tileCount,'unchanged actor count',original.actorCount);
      await page.close();
    }
    const ctx=await browser.newContext({viewport:{width:390,height:844},
      hasTouch:true,isMobile:true});
    const page=await ctx.newPage();
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#dc-ranch-preview-toggle').count(),0,
      'preview must not modify touch/mobile UI');
    assert.equal(await page.evaluate(()=>!!window.DCContinuousRanchPreview),false);
    console.log('PASS touch/mobile ranch preview is absent');
    await ctx.close();
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
