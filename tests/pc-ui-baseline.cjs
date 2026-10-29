// PC UI baseline audit for issue #69. Read-only: no game state or source changes.
// Usage: node tests/pc-ui-baseline.cjs (after npm install / Playwright browser setup)
const { chromium } = require('playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const out = path.join(root, 'test-output', 'pc-ui-baseline');
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(root, '.' + relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      const ext = path.extname(file).toLowerCase();
      res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml'})[ext] || 'application/octet-stream');
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox','--disable-dev-shm-usage']});
    const report = [];
    for (const [width, height] of [[1366,768],[1920,1080]]) {
      const page = await browser.newPage({viewport:{width,height}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:' + server.address().port + '/', {waitUntil:'domcontentloaded'});
      await page.waitForTimeout(1000);
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const rect = el => { const r=el.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}; };
        return {
          viewport:{width:innerWidth,height:innerHeight},
          document:{width:Math.max(doc.scrollWidth,body.scrollWidth),height:Math.max(doc.scrollHeight,body.scrollHeight)},
          verticalPageScroll:Math.max(doc.scrollHeight,body.scrollHeight)>innerHeight+2,
          horizontalPageScroll:Math.max(doc.scrollWidth,body.scrollWidth)>innerWidth+2,
          gameRegions:['#farmWorld','#hexFarm','#game','#app'].filter(s=>document.querySelector(s)).map(s=>({selector:s,rect:rect(document.querySelector(s))})),
          visibleButtons:Array.from(document.querySelectorAll('button')).filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;}).length
        };
      });
      const screenshot = 'pc-main-' + width + 'x' + height + '.png';
      await page.screenshot({path:path.join(out,screenshot),fullPage:true});
      report.push({resolution:width+'x'+height, screenshot, ...metrics, pageErrors:errors});
      await page.close();
    }
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
    if(report.some(r=>r.pageErrors.length)) process.exitCode=1;
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
