/* Real-time independent AI battle visualizer — not a turn-based scheduler.
 * The original in-index arena remains the full gameplay authority.
 * Exhibition outcomes here NEVER write to the original save.
 */
(() => {
  'use strict';
  const status=document.getElementById('status');
  const say=message=>{status.textContent=message;};
  const L=window.DigiPhaserLabLogic, B=window.DigiDomainBridge,
        RT=window.DCOriginalArenaCore, Art=window.DigiPrivateArtLoader;
  const buttons=['battle','train','reset','sound','cups','speed'];
  if(!window.Phaser||!L||!B||!RT||!Art){
    say('원본 전투 계산 모듈을 불러오지 못했어. 새로고침하거나 네트워크를 확인해.');
    return;
  }
  let manifest=null, soundEnabled=false,simSpeed=2,
      savePreview=B.previewSample(), rosterChosen=null, trainingBonus=10,
      latestSpecies=null;
  // Browser-memory-only packs. One pack per distinct species, never published.
  const privatePacks=new Map(),MAX_PRIVATE_PACKS=6,MAX_PRIVATE_BYTES=48*1024*1024;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const key=(source,id)=>'private-motion-'+encodeURIComponent(source)+'-'+id;
  const artSources=()=>{
    const sources=manifest?[{species:manifest.species,source:'local',manifest,
      lookup:filename=>'./local-assets/'+filename}]:[];
    for(const pack of privatePacks.values())sources.push({
      species:pack.species,source:'user:'+pack.species,
      manifest:pack.manifest,lookup:pack.lookup
    });
    return sources;
  };
  const format=n=>Math.max(0,Math.round(n));
  const available=()=>B.eligibleRoster(savePreview);

  function mockTextures(scene){
    const colors=[0xffc666,0x92dbfc,0xeaa6ed,0x8bd0a1,0xe8aa92,0xb5bded];
    for(let side=0;side<2;side++)for(let slot=0;slot<3;slot++){
      const color=colors[side*3+slot];
      for(let frame=0;frame<2;frame++){
        const texture='practice-'+side+'-'+slot+'-'+frame;
        if(scene.textures.exists(texture))continue;
        const g=scene.make.graphics({x:0,y:0});
        const rect=(x,y,w,h,c)=>{g.fillStyle(c);g.fillRect(x,y,w,h);};
        const bob=frame*2;
        // Original, non-Digimon procedural silhouettes for public safety.
        rect(21,8+bob,30,27,color);
        rect(12,15+bob,13,15,color);
        rect(45,15+bob,12,15,color);
        rect(24,2+bob,9,13,color);
        rect(41,2+bob,9,13,color);
        rect(25,34+bob,23,17,color);
        rect(23,50+(frame?0:2),10,8,color);
        rect(40,50+(frame?2:0),10,8,color);
        rect(26,21+bob,5,5,0x192535);
        rect(43,21+bob,5,5,0x192535);
        rect(33,32+bob,10,3,0x594438);
        rect(20,44+bob,7,7,0x334454);
        g.generateTexture(texture,72,64);
        g.destroy();
      }
    }
  }
  class RealTimeScene extends Phaser.Scene {
    constructor(){super('RealTimeArena');}
    init(config={}){
      this.requestedMode=config.mode||'idle';
      this.requestedTactic=config.tactic||'balanced';
      this.requestedSize=config.teamSize||3;
    }
    preload(){
      for(const source of artSources())for(const [id,cfg] of Object.entries(source.manifest.actions)){
        // Reimport of one species replaces only that species' frames.
        const texture=key(source.source,id);
        if(this.textures.exists(texture))this.textures.remove(texture);
        this.load.spritesheet(texture,source.lookup(cfg.file),{
          frameWidth:cfg.frameWidth,frameHeight:cfg.frameHeight,
          endFrame:cfg.frames-1
        });
      }
    }
    create(){
      this.cameras.main.setBackgroundColor('#172d43');
      mockTextures(this);
      this.loadedActions=new Map();
      for(const source of artSources()){
        const actions=new Set();
        for(const [id,cfg] of Object.entries(source.manifest.actions)){
          const idx=Number(id),texture=key(source.source,id);
          if(!this.textures.exists(texture))continue;
          actions.add(idx);
          if(cfg.frames>1){
            const animation='realtime-'+encodeURIComponent(source.source)+'-'+id;
            if(this.anims.exists(animation))this.anims.remove(animation);
            const frames=this.anims.generateFrameNumbers(texture,{
              start:0,end:cfg.frames-1
            }).map((frame,i)=>({...frame,duration:clamp(cfg.durationsMs[i],30,30000)}));
            this.anims.create({key:animation,frames,frameRate:12,
              repeat:[0,2,3,14,32].includes(idx)?-1:0});
          }
        }
        if(actions.size)this.loadedActions.set(source.species,{
          actions,manifest:source.manifest,source:source.source
        });
      }
      this.drawStage();
      this.createMatch();
      this.mode='idle';
      this.accum=0;
      this.frameId=0;
      this.graphics=this.add.graphics().setDepth(7);
      this.projectileGraphics=this.add.graphics().setDepth(8);
      this.visuals=new Map();
      for(const actor of this.sim.fighters)this.addActor(actor);
      this.refreshActors();
      this.updateHud();
      say('준비 완료 · '+RT.alive(this.sim,0).length+':'+RT.alive(this.sim,1).length+
        ' 기존 게임 전투 판정 · '+(this.loadedActions.size?
          ('개인 모션 '+this.loadedActions.size+'종 로드 · 미등록 종은 임시 그래픽'):
          '저작권 없는 임시 도형 그래픽')+
        ' · 본게임 전투가 아님');
      window.DigiPhaserLab={
        battle:()=>this.battle(),train:()=>this.train(),
        reset:()=>this.scene.restart({mode:'idle',
          tactic:this.requestedTactic,teamSize:this.requestedSize}),
        sound:enabled=>{
          soundEnabled=enabled;
          if(enabled&&this.sound.context?.resume)this.sound.context.resume();
        },
        speed:()=>{simSpeed=simSpeed===1?2:simSpeed===2?3:1;return simSpeed;},
        matchSnapshot:()=>RT.snapshot(this.sim),
        // Deterministic browser QA: exercise all remaining ORIGINAL engine
        // ticks immediately, then render the authentic match conclusion.
        // This isolated exhibition never writes to a player save.
        qaFinishCombat:()=>{
          if(this.mode!=='battle')return this.sim.finished;
          for(let i=0;i<4200&&!this.sim.finished;i++){
            RT.step(this.sim,1/30);
            const end=this.sim.events.find(e=>e.type==='finish');
            if(end)this.consumeEvent(end);
          }
          this.refreshActors(this.time.now);
          this.updateHud();
          return this.sim.finished;
        },
        encounterSnapshot:()=>({
          ally:RT.snapshot(this.sim.fighters.find(f=>f.side===0)),
          enemy:RT.snapshot(this.sim.fighters.find(f=>f.side===1)),
          fighters:RT.snapshot(this.sim.fighters),elapsed:this.sim.elapsed,
          winner:this.sim.winner,finished:this.sim.finished,
          source:'original-html-arena-calculation-preview'
        }),
        cupPreview:()=>B.cupPreview(savePreview),
        importedSavePreview:()=>JSON.parse(JSON.stringify(savePreview)),
        selectedRoster:()=>rosterChosen?{...rosterChosen}:null,
        trainingPreview:day=>B.train(day,trainingBonus,1),
        privatePackStatus:()=>{
          const latest=privatePacks.get(latestSpecies);
          return latest?{species:latest.species,
            actions:Object.keys(latest.manifest.actions).length,
            speciesList:[...privatePacks.keys()]}:null;
        },
        renderedArt:()=>this.sim.fighters.map(f=>{
          const v=this.visuals.get(f.id);
          return {id:f.id,name:f.name,privateArt:!!v?.useArt,
            textureKey:v?.sprite.texture.key||null};
        })
      };
      for(const id of buttons)document.getElementById(id).disabled=false;
      if(this.requestedMode==='battle')this.beginBattle();
      if(this.requestedMode==='train')this.beginTrain();
    }
    createMatch(){
      const candidates=available(),selected=rosterChosen&&candidates.find(
        mon=>mon.index===rosterChosen.index);
      const size=this.requestedSize;
      const allies=selected?
        [selected,...candidates.filter(mon=>mon.index!==selected.index)].slice(0,size):
        RT.defaultTeam(0).slice(0,size);
      this.sim=RT.createMatch({
        allies,
        teamSize:size,
        opponents:RT.defaultTeam(1).slice(0,allies.length),
        tactic:this.requestedTactic,
        seed:20261028
      });
    }
    drawStage(){
      const g=this.add.graphics();
      g.fillStyle(0x294866,1);g.fillRect(0,0,800,450);
      g.fillStyle(0x4e7773,1);g.fillEllipse(400,275,735,300);
      g.lineStyle(2,0x9bc7bd,.45);g.strokeEllipse(400,275,730,290);
      g.lineStyle(1,0xb2d5ce,.25);
      for(let x=65;x<750;x+=66)g.lineBetween(x,138,x,385);
      for(let y=155;y<390;y+=57)g.lineBetween(60,y,740,y);
      const overlay=this.add.graphics().setDepth(18);
      overlay.fillStyle(0x102339,.92);overlay.fillRoundedRect(12,10,776,90,9);
      this.title=this.add.text(23,16,
        '기존 게임의 실제 자동 전투 판정 · Phaser 화면',{
        color:'#f6eed0',fontSize:'18px',fontFamily:'sans-serif'
      }).setDepth(19);
      this.hud=this.add.text(23,44,'',{color:'#defff3',
        fontFamily:'monospace',fontSize:'16px'}).setDepth(19);
      this.metrics=this.add.text(23,70,'',{color:'#c4dceb',
        fontFamily:'monospace',fontSize:'13px'}).setDepth(19);
      this.foot=this.add.text(400,429,
        '기존 게임 전투 계산 재사용 · 그래픽은 별도 · 시연 결과는 저장되지 않음',
        {color:'#e0e6ed',fontSize:'13px'}).setOrigin(.5).setDepth(19);
    }
    addActor(f){
      // A one-species atlas may NOT replace all other fighters with that art.
      const art=this.loadedActions.get(f.name);
      const useArt=!!art;
      const atlas=useArt?(art.actions.has(0)?0:[...art.actions][0]):null;
      const texture=useArt?key(art.source,atlas):'practice-'+f.side+'-'+f.slot+'-0';
      const sprite=this.add.sprite(f.x,f.y-31,texture).setDepth(4);
      const cfg=useArt?art.manifest.actions[String(atlas)]:null;
      const scale=useArt?Math.min(64/cfg.frameWidth,69/cfg.frameHeight,2.4):.90;
      sprite.setScale(scale);
      if(useArt&&f.side===1)sprite.setTint(0xe8b8ad);
      const label=this.add.text(f.x,f.y+4,f.name,{
        color:f.side===0?'#b9ffe0':'#ffe0ce',fontSize:'12px',
        fontFamily:'sans-serif',backgroundColor:'#142b3980',
        padding:{x:3,y:1}
      }).setOrigin(.5).setDepth(9);
      this.visuals.set(f.id,{sprite,label,pose:null,scale,side:f.side,
        slot:f.slot,frame:0,useArt,art});
    }
    pose(f,v){
      const type=f.hp<=0?'ko':f.act;
      // Original HTML combat already chooses exact animation slot for
      // each action, including shout -> attack4 within one special move.
      // Never collapse those phases into one generic 'cast' pose.
      const fallback=type==='victory'?30:type==='ko'?37:type==='hurt'?5:
        type==='attack'?7:type==='special'?10:type==='evade'?3:
        type==='guard'?5:type==='run'?3:type==='walk'?2:0;
      const id=type==='victory'?30:type==='ko'?37:
        Number.isInteger(f.pose)&&f.pose>=0&&f.pose<=39?f.pose:fallback;
      const motionKey=type+':'+id;
      if(motionKey===v.pose)return;
      v.pose=motionKey;
      if(v.useArt&&v.art.actions.has(id)){
        const cfg=v.art.manifest.actions[String(id)];
        v.sprite.setTexture(key(v.art.source,id),0).setScale(v.scale);
        if(cfg.frames>1)v.sprite.play('realtime-'+encodeURIComponent(v.art.source)+'-'+id);
        else v.sprite.anims.stop();
      }else if(v.useArt&&v.art.actions.size){
        v.sprite.anims.stop();
        v.sprite.setTexture(key(v.art.source,v.art.actions.has(0)?0:[...v.art.actions][0]),0)
          .setScale(v.scale);
      }else{
        v.sprite.anims.stop();
        v.sprite.setTexture('practice-'+f.side+'-'+f.slot+'-0')
          .setScale(v.scale);
      }
    }
    refreshActors(time=0){
      for(const f of this.sim.fighters){
        const v=this.visuals.get(f.id);
        if(!v)continue;
        this.pose(f,v);
        const bob=(f.act==='walk'||f.act==='evade')?
          Math.sin(time*.012+f.slot)*1.7:Math.sin(time*.003+f.slot)*.4;
        v.sprite.x=f.x;v.sprite.y=f.y-34+bob;
        // Original GIFs were left-facing. Flip when travelling right.
        v.sprite.setFlipX((f.visualDir??f.dir)>0);
        v.sprite.setAlpha(f.hp<=0?.5:f.flash>0?.65:1);
        if(!v.useArt&&f.hp>0&&
           (f.act==='walk'||f.act==='evade')&&Math.floor(time/160)%2===1){
          v.sprite.setTexture('practice-'+f.side+'-'+f.slot+'-1');
        }else if(!v.useArt){
          v.sprite.setTexture('practice-'+f.side+'-'+f.slot+'-0');
        }
        v.label.x=f.x;v.label.y=f.y+8;
        v.label.setText(f.name);
        v.label.setAlpha(f.hp<=0?.5:1);
      }
      this.graphics.clear();
      this.projectileGraphics.clear();
      for(const f of this.sim.fighters){
        this.graphics.fillStyle(0x0b1d22,.32);
        this.graphics.fillEllipse(f.x,f.y,41,9);
        this.graphics.fillStyle(0x172231,.9);
        this.graphics.fillRoundedRect(f.x-25,f.y+22,50,5,2);
        this.graphics.fillStyle(f.side===0?0x75e9b4:0xffa48f,1);
        this.graphics.fillRect(f.x-24,f.y+23,48*clamp(f.hp/f.max,0,1),3);
        this.graphics.fillStyle(0x79baff,.9);
        this.graphics.fillRect(f.x-24,f.y+30,48*clamp(f.tp/f.maxTp,0,1),2);
        if(f.act==='guard'){
          this.graphics.lineStyle(2,0xd7eaff,.9);
          this.graphics.strokeEllipse(f.x,f.y-29,57,65);
        }
        if(f.act==='cast'){
          this.graphics.lineStyle(2,0xffe393,.8);
          this.graphics.strokeCircle(f.x,f.y-34,35+Math.sin(time*.02)*3);
        }
      }
      for(const shot of this.sim.projectiles){
        const tint=Phaser.Display.Color.HexStringToColor(shot.color||'#ffb451').color;
        this.projectileGraphics.fillStyle(tint,.35);
        this.projectileGraphics.fillCircle(shot.x,shot.y,13);
        this.projectileGraphics.fillStyle(tint,1);
        this.projectileGraphics.fillCircle(shot.x,shot.y,6);
      }
    }
    updateHud(){
      const alive0=RT.alive(this.sim,0).length,alive1=RT.alive(this.sim,1).length;
      this.hud.setText('아군 '+alive0+'명   vs   상대 '+alive1+
        '명   ·   '+this.sim.elapsed.toFixed(1)+'초   ·   속도 '+simSpeed+'×');
      this.metrics.setText('실시간 AI: 이동 '+Math.round(this.sim.stats.movement)+'px'+
        ' · 공격 적중 '+this.sim.stats.hits+' · 회피 '+this.sim.stats.dodges+
        ' · 필살기 '+this.sim.stats.specials+
        ' · 넉백 '+Math.round(this.sim.stats.knockback)+'px');
    }
    soundImpact(){
      if(!soundEnabled)return;
      const ctx=this.sound.context;
      if(!ctx||!ctx.createOscillator||ctx.state!=='running')return;
      const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
      osc.type='triangle';
      osc.frequency.setValueAtTime(125,now);
      osc.frequency.exponentialRampToValueAtTime(48,now+.11);
      gain.gain.setValueAtTime(.10,now);
      gain.gain.exponentialRampToValueAtTime(.001,now+.16);
      osc.connect(gain).connect(ctx.destination);osc.start(now);osc.stop(now+.17);
    }
    consumeEvent(e){
      if(e.type==='hit'){
        this.soundImpact();
        this.cameras.main.shake(e.special?180:90,e.special?.010:.005);
        const hit=this.add.circle(e.x,e.y-29,e.special?26:14,
          e.special?0xf6ac77:0xffe5a2,.86).setDepth(13);
        this.tweens.add({targets:hit,alpha:0,scale:2.7,duration:260,
          onComplete:()=>hit.destroy()});
        const dmg=this.add.text(e.x,e.y-54,String(e.damage),{
          color:'#fff3bf',fontSize:e.special?'25px':'18px',
          fontFamily:'monospace',fontStyle:'bold'
        }).setOrigin(.5).setDepth(14);
        this.tweens.add({targets:dmg,y:e.y-91,alpha:0,duration:650,
          onComplete:()=>dmg.destroy()});
        if(e.special)this.cameras.main.zoomTo(1.04,100);
        if(e.special)this.time.delayedCall(165,()=>this.cameras.main.zoomTo(1,180));
      }
      if(e.type==='skill'){
        const f=this.sim.fighters.find(a=>a.id===e.attackerId);
        const notice=this.add.text(400,120,
          (f?.name||'디지몬')+' · '+(e.technique||'필살기')+'!',{
          color:'#fff3ce',fontFamily:'sans-serif',fontSize:'26px',
          backgroundColor:'#122b42bb',padding:{x:12,y:7}
        }).setOrigin(.5).setDepth(30);
        this.tweens.add({targets:notice,alpha:0,y:108,duration:940,
          onComplete:()=>notice.destroy()});
      }
      if(e.type==='dodge'){
        const t=this.add.text(e.x,e.y-70,'회피!',{
          color:'#bcfff2',fontSize:'15px'
        }).setDepth(15).setOrigin(.5);
        this.tweens.add({targets:t,alpha:0,y:e.y-104,duration:500,
          onComplete:()=>t.destroy()});
      }
      if(e.type==='finish'){
        this.mode='finished';
        const win=e.winner===0?'아군':'상대';
        say(win+' 승리 · 실시간 자동 전투 종료 · '+e.elapsed.toFixed(1)+
          '초 · 원본 세이브는 변경되지 않았어');
      }
    }
    beginBattle(){
      this.mode='battle';
      say('원본 판정 시연 중 · '+RT.alive(this.sim,0).length+':'+RT.alive(this.sim,1).length+
        ' 자동 전투 · 원본 AI·피해·필살기 타이밍 적용 · 세이브 변경 없음');
    }
    battle(){
      this.scene.restart({mode:'battle',tactic:document.getElementById('tactic').value,
        teamSize:Number(document.getElementById('squadSize').value)});
    }
    beginTrain(){
      this.mode='train';
      const left=this.sim.fighters.find(f=>f.side===0);
      this.time.delayedCall(270,()=>{
        left.act='attack';left.actTime=0;
        this.time.delayedCall(370,()=>{
          left.act='idle';left.actTime=0;
          const result=B.train(1,trainingBonus,1);
          trainingBonus=result.next;
          this.mode='idle';
          say('훈련 1회 완료 · 능력치 +'+result.gained+
            ' (기존 care-core 계절 보정 시연 · 세이브 변경 없음)');
        });
      });
    }
    train(){
      this.scene.restart({mode:'train',tactic:this.requestedTactic,
        teamSize:this.requestedSize});
    }
    update(time,delta){
      if(this.mode==='battle'){
        this.accum+=Math.min(delta/1000,.1)*simSpeed;
        let steps=0;
        while(this.accum>=1/30&&steps<15&&!this.sim.finished){
          RT.step(this.sim,1/30);
          for(const e of this.sim.events)this.consumeEvent(e);
          this.accum-=1/30;steps++;
        }
        if(steps>=15)this.accum=0;
      }
      this.refreshActors(time);
      this.frameId++;
      if(this.frameId%6===0)this.updateHud();
    }
  }
  async function boot(){
    for(const id of buttons)document.getElementById(id).disabled=true;
    try{
      const resp=await fetch('./local-assets/manifest.json',{cache:'no-store'});
      if(resp.ok){
        const maybe=await resp.json();
        if(L.validateManifest(maybe))manifest=maybe;
      }
    }catch(_){/* Locally converted GIFs are optional. */}
    new Phaser.Game({
      type:Phaser.AUTO,width:800,height:450,parent:'game',
      scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
      render:{pixelArt:true,antialias:false},backgroundColor:'#172d43',
      scene:[RealTimeScene]
    });
    document.getElementById('battle').addEventListener('click',
      ()=>window.DigiPhaserLab?.battle());
    document.getElementById('train').addEventListener('click',
      ()=>window.DigiPhaserLab?.train());
    document.getElementById('reset').addEventListener('click',
      ()=>window.DigiPhaserLab?.reset());
    document.getElementById('speed').addEventListener('click',e=>{
      const n=window.DigiPhaserLab?.speed()||simSpeed;
      e.currentTarget.textContent='속도 '+n+'×';
    });
    document.getElementById('sound').addEventListener('click',e=>{
      soundEnabled=!soundEnabled;
      e.currentTarget.setAttribute('aria-pressed',String(soundEnabled));
      e.currentTarget.textContent=soundEnabled?'타격음 끄기':'타격음 켜기';
      window.DigiPhaserLab?.sound(soundEnabled);
    });
    document.getElementById('artFiles').addEventListener('change',async e=>{
      const files=Array.from(e.currentTarget.files||[]);
      if(!files.length)return;
      try{
        const pack=await Art.fromFiles(files,L.validateManifest);
        // Make the entire valid pack ready before discarding previous references.
        // Texture frames are removed/reloaded in Scene.preload on restart.
        const old=privatePacks.get(pack.species);
        const bytes=files.reduce((sum,f)=>sum+f.size,0);
        const total=bytes+[...privatePacks.entries()].reduce(
          (sum,[species,entry])=>sum+(species===pack.species?0:entry.totalBytes),0);
        if(total>MAX_PRIVATE_BYTES){
          pack.dispose();
          throw Error('선택한 그래픽의 총 크기가 48MB 제한을 넘어. 기존 그래픽은 유지했어.');
        }
        pack.totalBytes=bytes;
        if(old)privatePacks.delete(pack.species);
        privatePacks.set(pack.species,pack);
        latestSpecies=pack.species;
        let evicted=null;
        if(privatePacks.size>MAX_PRIVATE_PACKS){
          evicted=privatePacks.values().next().value;
          privatePacks.delete(evicted.species);
        }
        const scene=window.DigiPhaserLab;
        if(scene)scene.reset();
        // Release only replaced/evicted packs; never discard another species.
        if(old)old.dispose();
        if(evicted)evicted.dispose();
        say('개인 그래픽 적용 · '+pack.species+' · '+
          Object.keys(pack.manifest.actions).length+
          '개 모션 · 현재 '+privatePacks.size+'종 보유 (최대 6종) · 서버 전송 없음');
      }catch(err){
        say('로컬 그래픽 가져오기 실패: '+err.message);
      }
    });
    document.getElementById('saveFile').addEventListener('change',async e=>{
      const file=e.currentTarget.files?.[0];if(!file)return;
      if(file.size>3*1024*1024){say('세이브 파일은 최대 3MB야.');return;}
      try{
        const preview=B.inspectExport(JSON.parse(await file.text()));
        savePreview=preview;
        const options=available();
        const select=document.getElementById('rosterChoice');
        select.replaceChildren(new Option('기본 시연',''));
        options.forEach(m=>select.add(new Option(m.name+
          ' · HP '+m.hp+'/'+m.maxHp+' · 공격 '+m.atk,String(m.index))));
        rosterChosen=null;
        say('세이브 읽기 전용 확인 · DAY '+preview.day+' · 디지몬 '+
          preview.team.length+'마리 · 출전 가능 '+options.length+'마리');
      }catch(err){
        say('세이브 미리보기 실패: '+err.message+
          ' · 기존 상태는 변경되지 않았어');
      }
    });
    document.getElementById('rosterChoice').addEventListener('change',e=>{
      const mon=available().find(f=>String(f.index)===e.currentTarget.value);
      rosterChosen=mon?{...mon}:null;
      say(mon?mon.name+' 선택 완료 · 연습전에는 원본 스탯을 복사해 사용해.':
        '기본 시연 팀을 사용할게.');
    });
    document.getElementById('cups').addEventListener('click',()=>{
      const cups=window.DigiPhaserLab?.cupPreview()||[];
      say('기존 대회 규칙: '+cups.map(c=>c.name+
        (c.available?' 참가 가능':' '+c.missing.join(', '))).join(' / '));
    });
  }
  boot().catch(err=>say('전투 시연 초기화 실패: '+err.message));
})();
