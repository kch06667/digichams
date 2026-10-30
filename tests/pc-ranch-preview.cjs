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
      await page.waitForFunction(()=>Boolean(window.DCRanchWalkability),{timeout:12000});
      await page.waitForFunction(()=>Boolean(window.DCRanchGroundPaths),{timeout:12000});
      await page.waitForFunction(()=>Boolean(window.DCRanchActorDepth),{timeout:12000});
      await page.waitForFunction(()=>Boolean(window.DCRanchFacadeOcclusion),{timeout:12000});
      await page.evaluate(()=>{eval('state').world.paused=true;});
      const original=await measure(page);
      // Exercise real local GIF HTTP loads without mutating player actors.
      // The recovery guard may ONLY retry an animation as the same species'
      // native idle frame. If that is also absent, the broken image is hidden.
      await page.waitForFunction(()=>Boolean(window.DCRanchSpriteGuard),{timeout:12000});
      const spriteCheck=await page.evaluate(()=>DCRanchSpriteGuard.fallbackUrlFor(
        'assets/sprites/rookie/m201_agumon_main_14.gif'));
      assert.equal(spriteCheck,'assets/sprites/rookie/m201_agumon_main_0.gif');
      await page.evaluate(()=>{
        const world=document.querySelector('#farmPanel .farmWorld');
        for(const [id,stem,pose] of [
          ['dc-sprite-success-probe','m201_agumon_main',99],
          ['dc-sprite-missing-probe','invalid_species_animation',18]
        ]){
          const actor=document.createElement('button');
          actor.type='button';actor.className='hexActor';actor.id=id;
          actor.dataset.mon='아구몬';
          const img=document.createElement('img');
          img.alt='아구몬 GIF 테스트';
          actor.append(img,document.createElement('span'));
          world.appendChild(actor);
          img.src='assets/sprites/rookie/'+stem+'_'+pose+'.gif';
        }
      });
      await page.waitForFunction(()=>{
        const el=document.querySelector('#dc-sprite-success-probe');
        return el?.dataset.dcSpriteRecovery==='retry-idle' &&
          el.querySelector('img')?.naturalWidth>0;
      },{timeout:12000});
      await page.waitForFunction(()=>{
        const el=document.querySelector('#dc-sprite-missing-probe');
        return el?.dataset.dcSpriteRecovery==='missing' &&
          el.querySelector('img')?.style.visibility==='hidden';
      },{timeout:12000});
      const spriteResult=await page.evaluate(()=>{
        const good=document.querySelector('#dc-sprite-success-probe');
        const broken=document.querySelector('#dc-sprite-missing-probe');
        return {
          recovered:good.querySelector('img').getAttribute('src'),
          missing:broken.querySelector('img').style.visibility,
          warnings:DCRanchSpriteGuard.missing,
          caught:DCRanchSpriteGuard.recovered
        };
      });
      assert.match(spriteResult.recovered,/m201_agumon_main_0\.gif$/);
      assert.equal(spriteResult.missing,'hidden');
      assert.ok(spriteResult.caught>=2&&spriteResult.warnings>=1);
      await page.evaluate(()=>{
        document.getElementById('dc-sprite-success-probe')?.remove();
        document.getElementById('dc-sprite-missing-probe')?.remove();
      });
      assert.equal((await measure(page)).save,original.save,
        'test-only GIF failures and fallback never touch actual player save');
      // Opt-in ambient walks must be separate from the graphics preview and
      // never alter a paused real player save simply by toggling a button.
      await page.waitForFunction(()=>Boolean(window.DCRanchFreeRoam),{timeout:12000});
      const roamButton=page.locator('#dc-ranch-free-roam-toggle');
      assert.equal(await roamButton.count(),1);
      assert.equal(await roamButton.getAttribute('aria-pressed'),'false');
      const lifeStatus=page.locator('#dc-ranch-life-status');
      assert.equal(await lifeStatus.count(),1);
      assert.match(await lifeStatus.textContent(),/자유 산책 꺼짐/);
      await roamButton.click();
      assert.equal(await roamButton.getAttribute('aria-pressed'),'true');
      assert.match(await lifeStatus.textContent(),/산책 .*구경 .*식사 .*휴식 .*훈련 /,
        'live life counts must be visible with the optional behavior enabled');
      const isolatedWalk=await page.evaluate(()=>{
        const s={day:3,food:4,ropes:1,points:0,logs:[],
          facilities:{training:true},
          team:[{instanceId:'roam-ui-probe',name:'테스트',
            hp:300,maxHp:300,hunger:0,fatigue:0,training:0,
            atk:7,def:5,spd:7,friendship:0,exp:0}]};
        DCFarm.ensure(s);
        s.farm.actors['roam-ui-probe'].idleTime=3;
        DCFarm.advance(s,.05);
        const a=s.farm.actors['roam-ui-probe'];
        return {zone:a.goal?.zone,kind:a.goal?.kind,
          onGround:DCFarm.foodGround(s,a.goal?.x,a.goal?.y),
          training:s.team[0].training,points:s.points};
      });
      assert.deepEqual(isolatedWalk,{zone:'training',kind:'wander',
        onGround:true,training:0,points:0},
        'real game core must take a safe unlocked-zone ambient walk');
      await roamButton.click();
      assert.equal(await roamButton.getAttribute('aria-pressed'),'false');
      assert.match(await lifeStatus.textContent(),/자유 산책 꺼짐/);
      assert.equal((await measure(page)).save,original.save,
        'roaming toggle and isolated test cannot mutate the paused player save');
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
      // A route is painted only for purchased facilities and must be a
      // straight line between the exact canonical 920x690 map centers.
      const pathsBefore=await page.evaluate(()=>{
        const c=DCFarm.HEX_CENTERS,s=eval('state');
        const expected=Object.keys(c).filter(z=>z!=='core'&&s.facilities?.[z]);
        const actual=[...document.querySelectorAll('#dc-ranch-ground-paths g[data-zone]')]
          .map(g=>({zone:g.dataset.zone,d:g.firstElementChild?.getAttribute('d')}));
        return {expected,actual,
          visible:getComputedStyle(document.querySelector('#dc-ranch-ground-paths')).display!=='none'};
      });
      assert.equal(pathsBefore.visible,true,'dynamic terrain paths should appear in preview');
      assert.deepEqual(pathsBefore.actual.map(p=>p.zone),pathsBefore.expected,
        'locked facilities must not have a decorative open route');
      for(const route of pathsBefore.actual){
        const [x,y]=await page.evaluate(id=>DCFarm.HEX_CENTERS[id],route.zone);
        assert.equal(route.d,`M460 340 L${x} ${y}`,
          'painted road must use DCFarm canonical straight route');
      }
      // Emulate an unlocked facility and map repaint. Only the read-only
      // visual route should change; restored gameplay state stays identical.
      const facilitiesBefore=await page.evaluate(()=>JSON.parse(
        JSON.stringify(eval('state').facilities)));
      await page.evaluate(()=>{
        const s=eval('state');
        s.facilities.training=true;
        document.getElementById('farmWorld').appendChild(
          Object.assign(document.createElement('span'),{id:'dc-ranch-test-poke'}));
      });
      await page.waitForFunction(()=>Boolean(
        document.querySelector('#dc-ranch-ground-paths g[data-zone="training"]')));
      const trainingPath=await page.locator(
        '#dc-ranch-ground-paths g[data-zone="training"] path').first().getAttribute('d');
      assert.equal(trainingPath,'M460 340 L460 128');
      // Old/imported saves may encode unlocked as 1 rather than true.
      // The real DCFarm.walkable uses truthiness, so the painted path must too.
      await page.evaluate(()=>{
        eval('state').facilities.training=1;
        DCRanchGroundPaths.refresh();
      });
      assert.equal(await page.locator(
        '#dc-ranch-ground-paths g[data-zone="training"]').count(),1,
        'truthy legacy unlock must still draw its actual route');
      await page.evaluate(saved=>{
        const s=eval('state');
        s.facilities=saved;
        document.getElementById('dc-ranch-test-poke')?.remove();
      },facilitiesBefore);
      await page.waitForFunction(expected=>{
        const actual=[...document.querySelectorAll('#dc-ranch-ground-paths g[data-zone]')]
          .map(g=>g.dataset.zone);
        return JSON.stringify(actual)===JSON.stringify(expected);
      },pathsBefore.expected);
      assert.equal((await measure(page)).save,original.save,
        'previewed facility unlock may not change the saved data');
      const clickAreas=await page.locator('#farmPanel .hexTile').evaluateAll(
        tiles=>tiles.map(tile=>({
          id:tile.dataset.hex,
          width:tile.getBoundingClientRect().width,
          height:tile.getBoundingClientRect().height
        })));
      for(const area of clickAreas){
        assert.ok(area.width<=160 && area.height<=90,
          'preview tile must not block invisible 220x226 ground: '+JSON.stringify(area));
      }
      const inspector=page.locator('#dc-ranch-walkable-toggle');
      assert.equal(await inspector.count(),1,'truth overlay control must load');
      assert.equal(await inspector.getAttribute('aria-pressed'),'false');
      assert.ok(await inspector.isVisible());
      assert.equal(await page.locator('#dc-ranch-walkable-mask').isVisible(),false);
      await inspector.click();
      assert.equal(await inspector.getAttribute('aria-pressed'),'true');
      const passability=await page.evaluate(()=>{
        const overlay=window.DCRanchWalkability;
        const canvas=document.getElementById('dc-ranch-walkable-mask');
        const ctx=canvas.getContext('2d');
        return {
          size:[canvas.width,canvas.height],
          samples:overlay.sampleCount,
          centerPassable:overlay.walkableAt(460,340),
          unopenedTrainingPassable:overlay.walkableAt(460,128),
          centerAlpha:ctx.getImageData(460,340,1,1).data[3],
          unopenedTrainingAlpha:ctx.getImageData(460,128,1,1).data[3]
        };
      });
      assert.deepEqual(passability.size,[920,690]);
      assert.ok(passability.samples>50,'walkability inspector sampled no ground');
      assert.equal(passability.centerPassable,true);
      assert.equal(passability.unopenedTrainingPassable,false);
      assert.ok(passability.centerAlpha>0,
        'walkable shared pasture must be tinted by the actual movement mask');
      assert.equal(passability.unopenedTrainingAlpha,0,
        'locked training plot must not appear walkable');
      assert.equal((await measure(page)).save,original.save,
        'walking overlay must not touch gameplay or save state');
      // The original button's click behavior must survive shrinking the
      // formerly invisible 220x226 hex bounding box.
      await page.locator('[data-hex="training"]').click();
      assert.equal(await page.locator('[data-hex="training"]').evaluate(
        el=>el.classList.contains('selected')),true,
        'clicking the reduced facility target must select that facility');
      assert.ok((await page.locator('#farmDetails').textContent()).includes('특별 훈련장'),
        'hidden drawer still keeps the original facility details updated');
      assert.equal((await measure(page)).save,original.save,
        'facility selection must not touch gameplay state');
      // Front facade occlusion QA: the original atlas should cover actors
      // standing BEHIND an unlocked facility, never those in front.
      assert.equal(await page.locator('.dc-ranch-facade-front').count(),0,
        'the preview must not show locked building facades');
      const facadesSaved=await page.evaluate(()=>
        JSON.parse(JSON.stringify(eval('state').facilities)));
      const occlusion=await page.evaluate(()=>{
        const s=eval('state'),id='training';
        s.facilities[id]=true;
        const tile=document.querySelector('.hexTile[data-hex="training"]');
        const was={locked:tile.classList.contains('locked'),
          unlocked:tile.classList.contains('unlocked')};
        tile.classList.add('unlocked');
        tile.classList.remove('locked');
        const active=window.DCRanchFacadeOcclusion.refresh();
        const facade=document.querySelector(
          '.dc-ranch-facade-front[data-zone="training"]');
        const style=getComputedStyle(facade);
        return {was,active,left:facade.style.left,top:facade.style.top,
          z:Number(facade.style.zIndex),offset:facade.style.getPropertyValue(
            '--dc-facade-offset'),pointerEvents:style.pointerEvents,
          display:style.display,mask:style.maskImage,
          background:style.backgroundImage};
      });
      assert.ok(occlusion.active.includes('training'));
      assert.equal(occlusion.left,'460px');
      assert.equal(occlusion.top,'128px');
      assert.equal(occlusion.z,260);
      assert.equal(occlusion.offset,'-350px -15px');
      assert.equal(occlusion.pointerEvents,'none',
        'visible original building art must never block clicks');
      assert.equal(occlusion.display,'block');
      assert.match(occlusion.mask,/radial-gradient/);
      assert.match(occlusion.background,/hex_farm_v0232.webp/);
      const facilityDepth=await page.evaluate(()=>{
        const world=document.getElementById('farmWorld');
        const create=(id,y)=>{
          const node=document.createElement('button');
          node.id=id;node.type='button';node.className='hexActor';
          node.style.left='460px';node.style.top=y+'px';
          const image=document.createElement('img');
          image.width=50;image.height=40;
          const label=document.createElement('span');
          label.textContent=id;
          node.append(image,label);
          world.appendChild(node);
        };
        create('dc-test-behind',133);
        create('dc-test-ahead',198);
        DCRanchActorDepth.refresh();
        const behind=document.getElementById('dc-test-behind');
        const ahead=document.getElementById('dc-test-ahead');
        return {behind:Number(behind.style.zIndex),
          ahead:Number(ahead.style.zIndex),
          facade:Number(document.querySelector(
            '.dc-ranch-facade-front[data-zone="training"]').style.zIndex),
          shadowWidth:behind.style.getPropertyValue('--dc-ground-shadow-width')};
      });
      assert.ok(facilityDepth.behind<facilityDepth.facade &&
        facilityDepth.facade<facilityDepth.ahead,
        'facility must hide a rear actor but not a front actor');
      assert.equal(facilityDepth.shadowWidth,'34px',
        'actor contact shadow scales to its real rendered image width');
      await page.evaluate(saved=>{
        const s=eval('state');
        s.facilities=saved;
        const tile=document.querySelector('.hexTile[data-hex="training"]');
        tile.classList.remove('unlocked');
        tile.classList.add('locked');
        DCRanchFacadeOcclusion.refresh();
        document.getElementById('dc-test-behind')?.remove();
        document.getElementById('dc-test-ahead')?.remove();
      },facadesSaved);
      assert.equal(await page.locator(
        '.dc-ranch-facade-front[data-zone="training"]').count(),0,
        'unbuilt building facades must disappear after lock restore');
      assert.equal((await measure(page)).save,original.save,
        'the facade comparison must preserve the complete farm save');
      // Visual-depth QA: Y determines front-to-back sprite stacking. In a
      // cluster only redundant nameplates collapse; sprites are never hidden.
      await page.evaluate(()=>{
        const world=document.getElementById('farmWorld');
        const make=(id,x,y,active)=>{
          const el=document.createElement('button');
          el.id=id;
          el.type='button';
          el.className='hexActor'+(active?' active':'');
          el.style.left=x+'px';el.style.top=y+'px';
          const img=document.createElement('img');
          const label=document.createElement('span');
          label.textContent=id;
          el.append(img,label);
          world.appendChild(el);
        };
        make('dc-test-depth-a',410,310,true);
        make('dc-test-depth-b',422,326,false);
        DCRanchActorDepth.refresh();
      });
      let depth=await page.evaluate(()=>{
        const a=document.getElementById('dc-test-depth-a');
        const b=document.getElementById('dc-test-depth-b');
        return {za:Number(a.style.zIndex),zb:Number(b.style.zIndex),
          hiddenA:a.dataset.dcLabelCollapsed,
          hiddenB:b.dataset.dcLabelCollapsed,
          imageA:getComputedStyle(a).visibility,
          imageB:getComputedStyle(b).visibility,
          labelB:getComputedStyle(b.querySelector('span')).visibility};
      });
      assert.ok(depth.zb>depth.za,'lower-on-screen actor must draw in front');
      assert.equal(depth.hiddenA,'false','selected Digimon name must win overlap');
      assert.equal(depth.hiddenB,'true','secondary overlapping name should collapse');
      assert.equal(depth.imageA,'visible');
      assert.equal(depth.imageB,'visible','actors must never disappear');
      assert.equal(depth.labelB,'hidden');
      await page.locator('#dc-test-depth-b').hover({force:true});
      assert.equal(await page.locator('#dc-test-depth-b span').evaluate(
        e=>getComputedStyle(e).visibility),'visible',
        'a hidden name must reappear on hover');
      await page.evaluate(()=>{
        const a=document.getElementById('dc-test-depth-a');
        const b=document.getElementById('dc-test-depth-b');
        a.classList.remove('active');
        b.classList.add('active');
        DCRanchActorDepth.refresh();
      });
      depth=await page.evaluate(()=>({
        a:document.getElementById('dc-test-depth-a').dataset.dcLabelCollapsed,
        b:document.getElementById('dc-test-depth-b').dataset.dcLabelCollapsed
      }));
      assert.equal(depth.a,'true');
      assert.equal(depth.b,'false','new selected name must take priority');
      await page.evaluate(()=>{
        const b=document.getElementById('dc-test-depth-b');
        b.style.left='700px';b.style.top='520px';
        DCRanchActorDepth.refresh();
      });
      assert.equal(await page.locator('#dc-test-depth-a').getAttribute(
        'data-dc-label-collapsed'),'false',
        'names should reappear after moving apart');
      assert.equal(await page.locator('#dc-test-depth-b').getAttribute(
        'data-dc-label-collapsed'),'false');
      assert.equal((await measure(page)).save,original.save,
        'sprite depth and nameplate layout must not change saves');

      const response=await page.request.get(base+'/assets/farm/continuous_ranch_preview.svg');
      assert.equal(response.status(),200,'preview terrain asset must load');
      const svg=await response.text();
      assert.ok(svg.includes('viewBox="0 0 920 690"')&&svg.includes('<svg'));
      assert.ok(!svg.includes('M459 340Q462 273'),
        'static winding route must not falsely display locked paths');
      await page.locator('#dc-ranch-preview-toggle').click();
      const reverted=await measure(page);
      assert.ok(reverted.background.includes('hex_farm_v0232.webp'));
      await page.evaluate(()=>{
        DCRanchActorDepth.refresh();
        DCRanchFacadeOcclusion.refresh();
      });
      assert.equal(await page.locator('.dc-ranch-facade-front').count(),0,
        'original hex map must never show the duplicate facility facade');
      for(const id of ['dc-test-depth-a','dc-test-depth-b']){
        const actor=page.locator('#'+id);
        assert.equal(await actor.evaluate(e=>e.style.zIndex),'',
          'original hex view must restore legacy actor layering');
        assert.equal(await actor.getAttribute('data-dc-label-collapsed'),null,
          'original map must keep all legacy nameplates');
      }
      await page.evaluate(()=>{
        document.getElementById('dc-test-depth-a')?.remove();
        document.getElementById('dc-test-depth-b')?.remove();
      });
      assert.equal(await page.locator('#dc-ranch-ground-paths').isVisible(),false,
        'original hex map must hide the new path layer');
      await page.waitForFunction(()=>window.DCRanchWalkability?.visible===false);
      assert.equal(await page.locator('#dc-ranch-walkable-toggle').isVisible(),false,
        'inspector must disappear with the preview');
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
    assert.equal(await page.evaluate(()=>!!window.DCRanchWalkability),false,
      'walkability inspector must not load in touch mode');
    assert.equal(await page.evaluate(()=>!!window.DCRanchGroundPaths),false,
      'terrain-route painter must not load on mobile/touch');
    assert.equal(await page.evaluate(()=>!!window.DCRanchActorDepth),false,
      'desktop actor depth polish must not load on mobile/touch');
    assert.equal(await page.evaluate(()=>!!window.DCRanchFacadeOcclusion),false,
      'front facade layers must not load on mobile/touch');
    assert.equal(await page.evaluate(()=>!!window.DCRanchFreeRoam),false,
      'free roaming extension must not load on mobile/touch');
    assert.equal(await page.locator('#dc-ranch-life-status').count(),0,
      'PC life-status UI must never load on mobile/touch');
    assert.equal(await page.evaluate(()=>!!window.DCRanchSpriteGuard),false,
      'PC-only original GIF recovery must not load on mobile/touch');
    console.log('PASS touch/mobile ranch preview is absent');
    await ctx.close();
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
