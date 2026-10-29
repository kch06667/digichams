'use strict';
/* PR #70 PC shell smoke test.
 * Launches the actual repository index.html and the current desktop guide.
 * Generated screenshots stay CI artifacts; no ROM or source assets are copied.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-output', 'pc-shell-smoke');
fs.mkdirSync(out, {recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript',
  '.json':'application/json','.gif':'image/gif','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
  catch {res.writeHead(400).end();return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',types[path.extname(file).toLowerCase()]||'application/octet-stream');
    res.end(data);
  });
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  const report=[];
  try {
    browser=await chromium.launch({headless:true,
      executablePath:process.env.CHROMIUM_PATH||undefined,
      args:['--no-sandbox','--disable-dev-shm-usage']});
    const base='http://127.0.0.1:'+server.address().port;
    for (const [width,height] of [[1366,768],[1920,1080]]) {
      const page=await browser.newPage({viewport:{width,height}});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/',{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(500);
      if(!await page.evaluate(()=>Boolean(window.DCPCGuide))){
        await page.addScriptTag({url:base+'/src/pc-playability-guide.js'});
      }
      await page.waitForFunction(()=>Boolean(window.DCPCDrawer),{timeout:10000});
      await page.waitForTimeout(300);
      const toggle=page.locator('#dc-pc-drawer-toggle');
      const drawer=page.locator('#dc-pc-control-drawer');
      assert.equal(await toggle.count(),1,'drawer toggle missing');
      assert.equal(await drawer.count(),1,'drawer missing');
      assert.equal(await toggle.getAttribute('aria-expanded'),'false','drawer should start closed');
      assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#dc-pc-control-drawer')).visibility),'hidden');
      await page.screenshot({path:path.join(out,'farm-closed-'+width+'.png')});
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'),'true');
      assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#dc-pc-control-drawer')).visibility),'visible');
      assert.equal(await drawer.locator('#farmLeft').count(),1,'farm navigation was not moved');
      assert.equal(await drawer.locator('#farmDetails').count(),1,'facility details were not moved');
      await page.screenshot({path:path.join(out,'farm-open-'+width+'.png')});
      await page.keyboard.press('Escape');
      assert.equal(await toggle.getAttribute('aria-expanded'),'false','ESC must close panel');
      await toggle.click();
      await drawer.locator('#dc-pc-drawer-close').click();
      assert.equal(await toggle.getAttribute('aria-expanded'),'false','close button failed');
      const metrics=await page.evaluate(()=>{
        const h=document.documentElement,b=document.body;
        return {pageVerticalOverflow:Math.max(h.scrollHeight,b.scrollHeight)-innerHeight,
          pageHorizontalOverflow:Math.max(h.scrollWidth,b.scrollWidth)-innerWidth,
          farmRect:(()=>{const r=document.getElementById('farmPanel').getBoundingClientRect();
            return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};})(),
          modeNds:b.classList.contains('mode-nds'),
          switcherVisible:(()=>{const el=document.querySelector('.displaySwitcher');
            return el?getComputedStyle(el).display!=='none':false;})()};
      });
      const item={resolution:width+'x'+height,...metrics,errors};
      report.push(item);
      assert.equal(metrics.modeNds,false,'PC should open expanded mode');
      assert.equal(metrics.switcherVisible,false,'NDS mode switcher should be hidden');
      assert.ok(metrics.pageHorizontalOverflow<=2,'unexpected horizontal page scroll');
      assert.ok(metrics.pageVerticalOverflow<=2,'unexpected vertical page scroll');
      assert.equal(errors.length,0,'runtime page errors');
      await page.close();
    }
    console.log(JSON.stringify(report,null,2));
  } finally {
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
