/* Real-time independent AI battle visualizer — not a turn-based scheduler.
 * The original in-index arena remains the full gameplay authority.
 * Exhibition outcomes here NEVER write to the original save.
 */
(() => {
  'use strict';
  const embeddedBattle=new URLSearchParams(location.search).get('embeddedBattle')==='1';
  if(embeddedBattle){
    // Production uses the full existing Phaser renderer within a same-page
    // frame. Keep controls in the DOM for the existing engine but show only
    // the canvas and read-only status in the compact battle view.
    document.body.classList.add('dc-embedded-battle');
    const style=document.createElement('style');
    style.textContent=
      'body.dc-embedded-battle{margin:0;padding:0;height:100dvh;overflow:hidden}'+
      'body.dc-embedded-battle main{max-width:none;height:100dvh;display:flex;'+
        'flex-direction:column;padding:4px;gap:4px}'+
      'body.dc-embedded-battle main > :not(#game):not(#status):not(#battleReport)'+
        '{display:none!important}'+
      'body.dc-embedded-battle #game{width:100%;flex:1;min-height:0;'+
        'height:auto;aspect-ratio:auto;margin:0}'+
      'body.dc-embedded-battle #status{min-height:28px;margin:0;'+
        'font-size:12px;overflow:hidden}'+
      'body.dc-embedded-battle #battleReport{max-height:58px;'+
        'overflow:auto;font-size:12px;margin:0!important}';
    document.head.appendChild(style);
  }
  const status=document.getElementById('status');
  const say=message=>{status.textContent=message;};
  const L=window.DigiPhaserLabLogic, B=window.DigiDomainBridge,
        RT=window.DCOriginalArenaCore, Art=window.DigiPrivateArtLoader;
  const buttons=['battle','duel','train','reset','sound','cups','speed'];
  if(!window.Phaser||!L||!B||!RT||!Art){
    say('원본 전투 계산 모듈을 불러오지 못했어. 새로고침하거나 네트워크를 확인해.');
    return;
  }
  let manifest=null, localDuelPacks=[],localSpeciesCatalog=null,
      soundEnabled=false,simSpeed=2,
      savePreview=B.previewSample(), rosterChosen=null, trainingBonus=10,
      latestSpecies=null;
  // Browser-memory-only packs. One pack per distinct species, never published.
  const privatePacks=new Map(),MAX_PRIVATE_PACKS=6,MAX_PRIVATE_BYTES=48*1024*1024;
  // The local indexed catalog covers up to 216 species, but the renderer
  // loads only the active fight's 1-6 species, never 8,640 PNGs on boot.
  const convertedPacks=new Map(),MAX_CONVERTED_PACKS=6;
  let artLoadSerial=0;
  async function loadLocalMatchArt(names){
    if(!localSpeciesCatalog)return;
    const requested=[...new Set(names)].filter(Boolean).slice(0,6);
    for(const name of requested){
      if(convertedPacks.has(name)){
        const existing=convertedPacks.get(name);
        convertedPacks.delete(name);convertedPacks.set(name,existing);
        continue;
      }
      // Legacy arena demonstration calls Palmon '팔몬'; the 216-species
      // original GIF index uses its canonical Korean name '파르몬'.
      // Remap ONLY this documented alias; the actual fighter/skill identity
      // and original AI state are not renamed or modified.
      const catalogName=name==='팔몬'?'파르몬':name;
      const entry=Object.prototype.hasOwnProperty.call(localSpeciesCatalog.entries,catalogName)?
        localSpeciesCatalog.entries[catalogName]:null;
      if(!entry)continue; // never substitute the wrong species' sprite
      try {
        const response=await fetch('./local-assets/'+entry.folder+'/manifest.json',
          {cache:'no-store'});
        if(!response.ok)continue;
        const candidate=await response.json();
        if(candidate.species!==catalogName||!L.validateManifest(candidate)||
           Object.keys(candidate.actions).length!==entry.actions)
          throw Error('Invalid private species sprite manifest: '+name);
        convertedPacks.set(name,{species:name,folder:entry.folder,
          source:'catalog:'+entry.folder,manifest:candidate});
        while(convertedPacks.size>MAX_CONVERTED_PACKS)
          convertedPacks.delete(convertedPacks.keys().next().value);
      }catch(err){
        // Missing or corrupt local files must not prevent the match.
        // A missing species renders with the safe procedural placeholder.
        say('개인 그래픽 읽기 실패 · '+name+' · '+err.message);
      }
    }
  }
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const key=(source,id)=>'private-motion-'+encodeURIComponent(source)+'-'+id;
  const artSources=()=>{
    const sources=manifest?[{species:manifest.species,source:'local',manifest,
      lookup:filename=>'./local-assets/'+filename}]:[];
    // These two species are read only from privately converted local files.
    // No assets are copied into the safe public preview build.
    for(const pack of localDuelPacks)sources.push({
      species:pack.species,source:'duel:'+pack.folder,manifest:pack.manifest,
      lookup:filename=>'./local-assets/'+pack.folder+'/'+filename
    });
    for(const pack of convertedPacks.values())sources.push({
      species:pack.species,source:pack.source,manifest:pack.manifest,
      lookup:filename=>'./local-assets/'+pack.folder+'/'+filename
    });
    for(const pack of privatePacks.values())sources.push({
      species:pack.species,source:'user:'+pack.species,
      manifest:pack.manifest,lookup:pack.lookup
    });
    return sources;
  };
  const format=n=>Math.max(0,Math.round(n));
  const available=()=>B.eligibleRoster(savePreview);
  let farmHandoffRequested=false, farmHandoffPeer=null,
    tournamentOpponents=null;
  // A single-use same-origin message channel. No URL-based roster or
  // persistent-storage transfer; the independent Phaser scene remains read-only.
  function prepareFarmHandoff(){
    const token=new URLSearchParams(location.search).get('farmHandoff');
    const parent=embeddedBattle && window.parent!==window?
      window.parent:window.opener;
    if(farmHandoffRequested || !/^[a-f0-9]{32}$/.test(token||'') ||
        !parent || location.origin==='null')return;
    farmHandoffRequested=true;
    const handler=event=>{
      if(event.origin!==location.origin || event.source!==parent ||
          event.data?.type!=='dc-phaser-roster-v1' ||
          event.data.token!==token)return;
      window.removeEventListener('message',handler);
      try {
        const preview=B.inspectExport(event.data.payload);
        const roster=B.eligibleRoster(preview);
        const choice=event.data.handoff||{teamSize:1,leadIndex:roster[0]?.index,
          tactic:'balanced'};
        if(![1,2,3].includes(choice.teamSize)||
           !Number.isSafeInteger(choice.leadIndex)||
           !['balanced','aggressive','defensive','focus','conserve'].includes(choice.tactic))
          throw Error('유효하지 않은 전투 구성');
        if(choice.tournament){
          const t=choice.tournament;
          if(!['novice','regional','grand'].includes(t.cupId)||
             typeof t.matchId!=='string'||!/^cup-[1-9][0-9]*-round-[0-2]$/.test(t.matchId)||
             !Number.isSafeInteger(t.round)||t.round<0||t.round>2||
             t.size!==choice.teamSize||typeof t.trainer!=='string'||
             !Array.isArray(t.opponentTeam)||!Array.isArray(t.opponents)||
             t.opponentTeam.length!==choice.teamSize||
             t.opponents.length!==choice.teamSize||
             !t.opponents.every((foe,i)=>foe&&foe.name===t.opponentTeam[i]&&
                typeof foe.name==='string'&&foe.name.length>0&&
                ['hp','maxHp','tp','maxTp','atk','def','spd'].every(key=>
                  Number.isFinite(foe[key])&&foe[key]>=0)&&
                foe.hp===foe.maxHp&&foe.hp>0&&foe.tp<=foe.maxTp))
            throw Error('Invalid original tournament opponent lineup');
          tournamentOpponents=t.opponents.map(foe=>({...foe}));
        }else tournamentOpponents=null;
        const lead=roster.find(mon=>mon.index===choice.leadIndex);
        if(!lead||roster.length<choice.teamSize)
          throw Error('선봉이 출전 불가능하거나 출전 인원이 부족해.');
        savePreview=preview;
        rosterChosen={...lead};
        farmHandoffPeer={parent,token,teamSize:choice.teamSize,
          tournament:choice.tournament?{
            cupId:choice.tournament.cupId,
            matchId:choice.tournament.matchId,
            round:choice.tournament.round,
            trainer:choice.tournament.trainer,
            opponentTeam:choice.tournament.opponentTeam.slice(),
            size:choice.teamSize
          }:null,saveAllowed:true};
        const select=document.getElementById('rosterChoice');
        select.replaceChildren(new Option('기본 시연',''));
        roster.forEach(m=>select.add(new Option(
          m.name+' · HP '+m.hp+'/'+m.maxHp+' · 공격 '+m.atk,String(m.index))));
        select.value=String(rosterChosen.index);
        select.disabled=true;
        document.getElementById('squadSize').value=String(choice.teamSize);
        document.getElementById('squadSize').disabled=true;
        document.getElementById('tactic').value=choice.tactic;
        document.getElementById('tactic').disabled=true;
        say((choice.tournament?'🏆 '+choice.tournament.trainer+' 대회전 · ':'')+
          '사육장 명단 연결 완료 · 선봉 '+rosterChosen.name+
          ' · '+choice.teamSize+'대'+choice.teamSize+' 자동 전투');
        if(embeddedBattle){
          // The scene has finished create() before this async handoff.
          // Begin the ORIGINAL real-time AI match without a second click.
          Promise.resolve().then(()=>window.DigiPhaserLab?.battle())
            .catch(error=>say('전투 시작 실패: '+error.message));
        }
      } catch(err) {
        say('사육장 연습전 명단 검증 실패: '+err.message+' · 저장 없음');
      }
    };
    window.addEventListener('message',handler);
    parent.postMessage({type:'dc-phaser-ready-v1',token},location.origin);
  }

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
      // Release evicted auto-loaded species textures AND their animation
      // definitions before creating the next scene. Manual file packs and
      // the two private duel packs are not affected by this cleanup.
      const retained=new Set([...convertedPacks.values()].map(pack=>
        'private-motion-'+encodeURIComponent(pack.source)+'-'));
      for(const name of this.textures.getTextureKeys()){
        if(name.startsWith('private-motion-catalog%3A')&&
           ![...retained].some(prefix=>name.startsWith(prefix)))
          this.textures.remove(name);
      }
      for(const name of Object.keys(this.anims.anims.entries)){
        if(name.startsWith('realtime-catalog%3A')&&
           ![...convertedPacks.values()].some(pack=>
             name.startsWith('realtime-'+encodeURIComponent(pack.source)+'-')))
          this.anims.remove(name);
      }
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
            // Frame durations in the manifest already include the whole GIF
            // delay. Phaser ADDS frame.duration to 1000/frameRate.
            const timing=L.gifFrameTiming(cfg.durationsMs);
            const frames=this.anims.generateFrameNumbers(texture,{
              start:0,end:cfg.frames-1
            }).map((frame,i)=>({...frame,duration:timing.extraMs[i]}));
            this.anims.create({key:animation,frames,frameRate:timing.frameRate,
              // Action 30 is the user's verified victory motion. Keep it alive
              // for the short post-match celebration instead of freezing
              // on the final GIF frame. Attack/hit/KO motions do not loop.
              repeat:[0,2,3,14,30,32].includes(idx)?-1:0});
          }
        }
        if(actions.size)this.loadedActions.set(source.species,{
          actions,manifest:source.manifest,source:source.source
        });
      }
      this.drawStage();
      this.createMatch();
      this.mode='idle';
      document.getElementById('battleReport').textContent='';
      this.accum=0;
      this.frameId=0;
      this.graphics=this.add.graphics().setDepth(7);
      this.projectileGraphics=this.add.graphics().setDepth(8);
      this.particleColors=new Map();
      this.visuals=new Map();
      this.motionEvidence={charge:false,release:false,specialHits:0,knockbackFrames:0};
      // Keep only a small read-only cue audit. No new hit/damage events
      // are generated: each entry corresponds to an original RT.step hit.
      this.hitEffectHistory=[];
      for(const actor of this.sim.fighters)this.addActor(actor);
      this.refreshActors();
      this.updateHud();
      say('준비 완료 · '+RT.alive(this.sim,0).length+':'+RT.alive(this.sim,1).length+
        ' 기존 게임 전투 판정 · '+(this.loadedActions.size?
          ('개인 모션 '+this.loadedActions.size+'종 로드 · 미등록 종은 임시 그래픽'):
          '저작권 없는 임시 도형 그래픽')+
        (embeddedBattle?' · 본게임 전투 준비 완료':' · 본게임 전투가 아님'));
      window.DigiPhaserLab={
        battle:()=>this.battle(),
        duel:()=>{
          // Explicit fixed 1v1 starter showcase; never imports or mutates a save.
          rosterChosen=null;
          document.getElementById('rosterChoice').value='';
          document.getElementById('squadSize').value='1';
          this.scene.restart({mode:'battle',teamSize:1,
            tactic:document.getElementById('tactic').value});
        },
        duelStatus:()=>({ready:localDuelPacks.length===2,
          names:localDuelPacks.map(pack=>pack.species),
          rendered:this.sim.fighters.filter(f=>this.visuals.get(f.id)?.useArt)
            .map(f=>f.name)}),
        train:()=>this.train(),
        reset:()=>this.scene.restart({mode:'idle',
          tactic:this.requestedTactic,teamSize:this.requestedSize}),
        sound:enabled=>{
          soundEnabled=enabled;
          if(enabled&&this.sound.context?.resume)this.sound.context.resume();
        },
        speed:()=>{
          simSpeed=simSpeed===1?2:simSpeed===2?3:1;
          // Original arena ticks already run at simSpeed; keep each private
          // GIF animation on that clock without changing combat calculations.
          for(const v of this.visuals.values())
            if(v.useArt&&v.sprite.anims)v.sprite.anims.timeScale=simSpeed;
          return simSpeed;
        },
        matchSnapshot:()=>RT.snapshot(this.sim),
        motionEvidence:()=>({...this.motionEvidence}),
        hitEffectSamples:()=>this.hitEffectHistory.map(cue=>({...cue})),
        // Read-only test probe; contains frame timing numbers, never art bytes.
        animationFrameTiming:(source,id)=>{
          const a=this.anims.get('realtime-'+encodeURIComponent(source)+'-'+id);
          return a?{baseMs:a.msPerFrame,extraMs:a.frames.map(f=>f.duration)}:null;
        },
        // Deterministic browser QA: exercise all remaining ORIGINAL engine
        // ticks immediately, then render the authentic match conclusion.
        // This isolated exhibition never writes to a player save.
        qaFinishCombat:()=>{
          if(this.mode!=='battle')return this.sim.finished;
          for(let i=0;i<4200&&!this.sim.finished;i++){
            RT.step(this.sim,1/30);
            for(const fighter of this.sim.fighters){
              const phase=L.specialPhase(fighter);
              if(phase)this.motionEvidence[phase]=true;
              if(L.knockbackTilt(fighter)!==0)this.motionEvidence.knockbackFrames++;
            }
            this.motionEvidence.specialHits+=this.sim.events.filter(e=>
              e.type==='hit'&&e.special).length;
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
        battleResultPreview:()=>this.lastBattleReport?
          JSON.parse(JSON.stringify(this.lastBattleReport)):null,
        selectedRoster:()=>rosterChosen?{...rosterChosen}:null,
        handoffInfo:()=>farmHandoffPeer?{
          teamSize:farmHandoffPeer.teamSize,
          saveAllowed:farmHandoffPeer.saveAllowed,
          tournament:farmHandoffPeer.tournament?{
            cupId:farmHandoffPeer.tournament.cupId,
            matchId:farmHandoffPeer.tournament.matchId,
            trainer:farmHandoffPeer.tournament.trainer,
            opponentTeam:farmHandoffPeer.tournament.opponentTeam.slice()
          }:null
        }:null,
        trainingPreview:day=>B.train(day,trainingBonus,1),
        localCatalogStatus:()=>({
          indexedSpecies:localSpeciesCatalog?
            Object.keys(localSpeciesCatalog.entries).length:0,
          residentSpecies:[...convertedPacks.keys()],
          residentCount:convertedPacks.size
        }),
        privatePackStatus:()=>{
          const latest=privatePacks.get(latestSpecies);
          return latest?{species:latest.species,
            actions:Object.keys(latest.manifest.actions).length,
            speciesList:[...privatePacks.keys()]}:null;
        },
        renderedArt:()=>this.sim.fighters.map(f=>{
          const v=this.visuals.get(f.id);
          return {id:f.id,name:f.name,privateArt:!!v?.useArt,
            textureKey:v?.sprite.texture.key||null,
            action:v?.pose||null,angle:v?.sprite.angle||0,
            originY:v?.sprite.originY??null,
            footY:v?.sprite.y??null,
            // Phaser scene.restart() may dispose sprite.frame before
            // the next scene is created. Never touch the height getter
            // until its texture source is still alive.
            displayHeight:v?.sprite?.frame?.source?
              v.sprite.displayHeight:null,
            phase:L.specialPhase(f),
            hasKoArt:!!v?.art?.actions.has(37),
            // During scene.restart(), Phaser may already have disposed an
            // old sprite's AnimationState before the new scene is created.
            animationTimeScale:v?.useArt?(v.sprite?.anims?.timeScale??null):null};
        })
      };
      for(const id of buttons)document.getElementById(id).disabled=false;
      prepareFarmHandoff();
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
        opponents:tournamentOpponents||RT.defaultTeam(1).slice(0,allies.length),
        tactic:this.requestedTactic,
        seed:20261028
      });
      this.lastBattleReport=null;
      this.reportContext=selected?{
        imported:JSON.parse(JSON.stringify(savePreview)),
        teamIndices:allies.map(mon=>mon.index),
        initialFighters:RT.snapshot(this.sim.fighters.filter(f=>f.side===0)),
        initialOpponents:RT.snapshot(this.sim.fighters.filter(f=>f.side===1))
      }:null;
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
        (embeddedBattle?'디지몬 챔피언십 · 실시간 자동 전투':
          '기존 게임의 실제 자동 전투 판정 · Phaser 화면'),{
        color:'#f6eed0',fontSize:'18px',fontFamily:'sans-serif'
      }).setDepth(19);
      this.hud=this.add.text(23,44,'',{color:'#defff3',
        fontFamily:'monospace',fontSize:'16px'}).setDepth(19);
      this.metrics=this.add.text(23,70,'',{color:'#c4dceb',
        fontFamily:'monospace',fontSize:'13px'}).setDepth(19);
      this.foot=this.add.text(400,429,
        (embeddedBattle?'실시간 자동 전투 · 승패 및 보상은 종료 후 자동 정산':
          '기존 게임 전투 계산 재사용 · 그래픽은 별도 · 시연 결과는 저장되지 않음'),
        {color:'#e0e6ed',fontSize:'13px'}).setOrigin(.5).setDepth(19);
    }
    addActor(f){
      // A one-species atlas may NOT replace all other fighters with that art.
      const art=this.loadedActions.get(f.name);
      const useArt=!!art;
      const atlas=useArt?(art.actions.has(0)?0:[...art.actions][0]):null;
      const texture=useArt?key(art.source,atlas):'practice-'+f.side+'-'+f.slot+'-0';
      const sprite=this.add.sprite(f.x,f.y-31,texture).setDepth(4);
      // The source GIFs use different cell heights (e.g. 24px idle,
      // 32px hit, 16px KO). Anchor private art at the FEET so switching
      // a 1-frame hit/KO never bounces the monster above the ground.
      if(useArt)sprite.setOrigin(.5,1);
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
      const id=L.motionAction(f,v.useArt?v.art.actions:null);
      const motionKey=type+':'+id;
      if(motionKey===v.pose)return;
      v.pose=motionKey;
      if(v.useArt&&v.art.actions.has(id)){
        const cfg=v.art.manifest.actions[String(id)];
        v.sprite.setTexture(key(v.art.source,id),0).setScale(v.scale);
        if(cfg.frames>1){
          v.sprite.play('realtime-'+encodeURIComponent(v.art.source)+'-'+id);
          // Phaser resets the AnimationState scale on a new play(), so
          // reapply the current simulation speed at every pose transition.
          v.sprite.anims.timeScale=simSpeed;
        }else v.sprite.anims.stop();
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
        const faintFallback=f.hp<=0&&
          (!v.useArt||!v.art.actions.has(37));
        v.sprite.x=f.x;
        v.sprite.y=v.useArt?f.y-2+bob:
          f.y-(faintFallback?14:34)+bob;
        // When the sprite pack lacks the KO animation, show an actual
        // collapsed fighter instead of a standing idle sprite. Keep
        // original KO artwork upright: its own frames supply the motion.
        const knockLean=L.knockbackTilt(f);
        v.sprite.setAngle(faintFallback?(f.side===0?-78:78):
          (knockLean||(!v.useArt&&f.act==='hurt'?(f.side===0?-12:12):0)));
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
        const skillPhase=L.specialPhase(f);
        if(skillPhase==='charge'){
          // Pose 33: real original windup; no launch before pose 10.
          this.graphics.lineStyle(2,0xffe393,.8);
          this.graphics.strokeCircle(f.x,f.y-34,35+Math.sin(time*.02)*3);
        }else if(skillPhase==='release'){
          // Pose 10: release aura only. Projectile and damage still come
          // exclusively from the original engine's projectile/hit events.
          const facing=(f.visualDir??f.dir)>0?1:-1;
          this.graphics.lineStyle(3,0xb8ecff,.85);
          this.graphics.strokeCircle(f.x+facing*19,f.y-34,24);
          this.graphics.lineBetween(f.x+facing*29,f.y-34,
            f.x+facing*48,f.y-34);
        }
      }
      // Render bounded original-engine sparks and projectile history.
      // Pure presentation: combat damage/timing remain in arena-original-core.
      const tintOf=color=>{
        if(!this.particleColors.has(color)){
          if(this.particleColors.size>32)this.particleColors.clear();
          this.particleColors.set(color,
            Phaser.Display.Color.HexStringToColor(color||'#ffb451').color);
        }
        return this.particleColors.get(color);
      };
      for(const p of this.sim.particles||[]){
        this.projectileGraphics.fillStyle(tintOf(p.color),p.alpha*.9);
        this.projectileGraphics.fillCircle(p.x,p.y,p.radius);
      }
      for(const shot of this.sim.projectiles){
        const tint=tintOf(shot.color);
        const trail=shot.trail||[];
        for(let i=0;i<trail.length;i++){
          const progress=(i+1)/(trail.length+1);
          this.projectileGraphics.fillStyle(tint,progress*.42);
          this.projectileGraphics.fillCircle(trail[i].x,trail[i].y,1+4*progress);
        }
        // Renderer-only silhouette driven by existing original battle
        // projectile TYPE; do not invent a ROM e003 effect ID for a species.
        const shape=L.projectileShape(shot);
        if(shape==='missile'){
          const tail=trail.length?trail[trail.length-1]:{
            x:shot.x-(shot.dir||1)*8,y:shot.y};
          const dx=shot.x-tail.x,dy=shot.y-tail.y;
          const magnitude=Math.hypot(dx,dy)||1;
          const ux=dx/magnitude,uy=dy/magnitude;
          const nx=-uy,ny=ux;
          this.projectileGraphics.fillStyle(tint,.32);
          this.projectileGraphics.fillEllipse(shot.x,shot.y,22,19);
          this.projectileGraphics.fillStyle(tint,1);
          this.projectileGraphics.fillTriangle(
            shot.x+ux*13,shot.y+uy*13,
            shot.x-ux*9+nx*6,shot.y-uy*9+ny*6,
            shot.x-ux*9-nx*6,shot.y-uy*9-ny*6);
        }else if(shape==='claw'){
          this.projectileGraphics.lineStyle(3,tint,.92);
          for(let line=-1;line<=1;line++)
            this.projectileGraphics.lineBetween(
              shot.x-10+line*5,shot.y+9,
              shot.x+10+line*5,shot.y-9);
        }else{
          this.projectileGraphics.fillStyle(tint,.35);
          this.projectileGraphics.fillCircle(shot.x,shot.y,13);
          this.projectileGraphics.fillStyle(tint,1);
          this.projectileGraphics.fillCircle(shot.x,shot.y,6);
        }
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
        const victim=this.sim.fighters.find(f=>f.id===e.targetId);
        const attacker=this.sim.fighters.find(f=>f.id===e.attackerId);
        const cue=L.hitCue(e,victim,attacker);
        if(cue){
          this.hitEffectHistory.push({
            ...cue,at:this.sim.elapsed,
            // Visual evidence only. The original battle state is unchanged.
            // Store no full player save or persistent instance identifiers.
          });
          if(this.hitEffectHistory.length>24)this.hitEffectHistory.shift();
          const flash=this.add.graphics({x:cue.x,y:cue.y}).setDepth(13);
          const perpendicular={x:-cue.dy,y:cue.dx};
          // Knockback impulse comes from the original 2-D battle engine:
          // the streak points in the direction of the real impact.
          flash.lineStyle(cue.special?4:2,cue.color,.94);
          flash.strokeCircle(0,0,cue.radius);
          flash.lineStyle(cue.special?3:2,cue.color,.88);
          for(let i=-2;i<=2;i++){
            const spread=i/3;
            const vx=cue.dx+perpendicular.x*spread;
            const vy=cue.dy+perpendicular.y*spread;
            const length=Math.hypot(vx,vy)||1;
            const unitX=vx/length,unitY=vy/length;
            const reach=cue.reach*(1-.1*Math.abs(i));
            flash.lineBetween(unitX*(cue.radius*.55),
              unitY*(cue.radius*.55),unitX*reach,unitY*reach);
          }
          if(cue.special){
            flash.lineStyle(2,cue.color,.55);
            flash.strokeCircle(0,0,cue.radius+8);
          }
          this.tweens.add({targets:flash,alpha:0,
            scaleX:1.30,scaleY:1.30,duration:260,
            onComplete:()=>flash.destroy()});
        }
        const dmg=this.add.text(e.x,e.y-54,String(e.damage),{
          color:'#fff3bf',fontSize:e.special?'25px':'18px',
          fontFamily:'monospace',fontStyle:'bold'
        }).setOrigin(.5).setDepth(14);
        this.tweens.add({targets:dmg,y:e.y-91,alpha:0,duration:650,
          onComplete:()=>dmg.destroy()});
        if(e.special)this.cameras.main.zoomTo(1.04,100);
        if(e.special)this.time.delayedCall(165,()=>this.cameras.main.zoomTo(1,180));
        const knockedOut=this.sim.fighters.some(f=>f.id===e.targetId&&f.hp<=0);
        if(knockedOut){
          const ko=this.add.text(e.x,e.y-95,'K.O.',{
            fontSize:'27px',fontFamily:'sans-serif',fontStyle:'bold',
            color:'#ffb39c',stroke:'#2c1020',strokeThickness:5
          }).setOrigin(.5).setDepth(25);
          this.tweens.add({targets:ko,alpha:0,y:e.y-125,duration:950,
            onComplete:()=>ko.destroy()});
        }
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
        this.cameras.main.zoomTo(1,160);
        const banner=this.add.text(400,225,win+' 승리!',{
          fontSize:'34px',fontFamily:'sans-serif',fontStyle:'bold',
          color:'#fff0b8',backgroundColor:'#142b42d9',
          padding:{x:24,y:14}
        }).setOrigin(.5).setAlpha(0).setDepth(31);
        this.tweens.add({targets:banner,alpha:1,duration:360});
        if(this.reportContext){
          try{
            const c=this.reportContext;
            this.lastBattleReport=B.previewBattleResult(this.sim,c.imported,
              c.teamIndices,c.initialFighters);
            // Only a validated, COMPLETE 1v1 result may be offered to
            // the original farm for optional explicit settlement.
            if(farmHandoffPeer&&
               c.teamIndices.length===farmHandoffPeer.teamSize&&
               this.sim.fighters.length===farmHandoffPeer.teamSize*2){
              const peer=farmHandoffPeer;
              // Every complete 1v1/2v2/3v3 report goes to the
              // original farm tab, where exact launch-time instance IDs
              // and the latest persisted save are independently checked.
              // Phaser never applies a save or awards experience itself.
              // The original win action 30 is animated. The previous
              // production bridge immediately removed the Phaser frame at
              // finish, before one victory GIF could complete. Let the
              // renderer show the actual winning action for 1.1 seconds,
              // then deliver exactly the same verified terminal packet.
              const resultMessage={
                type:'dc-phaser-finished-v1',token:peer.token,
                packet:{preview:this.lastBattleReport,
                  initial:RT.snapshot(c.initialFighters),
                  opponentsInitial:RT.snapshot(c.initialOpponents),
                  ...(peer.tournament?{tournament:peer.tournament}:{}),
                  final:{finished:this.sim.finished,
                    winner:this.sim.winner,elapsed:this.sim.elapsed,
                    fighters:RT.snapshot(this.sim.fighters)}}
              };
              farmHandoffPeer=null; // never send the same result twice
              const deliver=()=>peer.parent.postMessage(resultMessage,location.origin);
              if(embeddedBattle)this.time.delayedCall(1100,deliver);
              else deliver();
            }
            document.getElementById('battleReport').textContent=
              (embeddedBattle?'경기 종료 · 저장 검증 중: ':
                '전투 결과 미리보기 (저장되지 않음): ')+
              this.lastBattleReport.changes.map(m=>
                m.name+' [명단 '+(m.teamIndex+1)+'] HP '+m.hpBefore+'→'+m.hpAfter+
                ', TP '+m.tpBefore+'→'+m.tpAfter).join(' / ')+
              (embeddedBattle?' · 원본 사육장으로 자동 복귀':
                ' · 보상/승패 저장 미적용');
          }catch(err){
            this.lastBattleReport=null;
            document.getElementById('battleReport').textContent=
              '결과 미리보기 검증 실패: '+err.message+' · 세이브 변경 없음';
          }
        }
        say(embeddedBattle?
          win+' 승리! · 원본 승리 모션 30번 재생 · 전투 결과 저장 중…':
          win+' 승리 · 실시간 자동 전투 종료 · '+e.elapsed.toFixed(1)+
          '초 · 사육장 탭에서 선택적으로 정산 가능 · 자동 저장 없음');
      }
    }
    beginBattle(){
      this.mode='battle';
      say(embeddedBattle?
        '내 디지몬 '+RT.alive(this.sim,0).length+' vs 상대 '+
          RT.alive(this.sim,1).length+' · 자동 전투 진행 중':
        '원본 판정 시연 중 · '+RT.alive(this.sim,0).length+':'+
          RT.alive(this.sim,1).length+
          ' 자동 전투 · 원본 AI·피해·필살기 타이밍 적용 · 세이브 변경 없음');
    }
    async battle(){
      const teamSize=Number(document.getElementById('squadSize').value);
      const tactic=document.getElementById('tactic').value;
      const candidates=available(),selected=rosterChosen&&candidates.find(
        mon=>mon.index===rosterChosen.index);
      const allies=selected?
        [selected,...candidates.filter(mon=>mon.index!==selected.index)].slice(0,teamSize):
        RT.defaultTeam(0).slice(0,teamSize);
      const opponents=tournamentOpponents||RT.defaultTeam(1).slice(0,allies.length);
      const request=++artLoadSerial;
      const button=document.getElementById('battle');
      button.disabled=true;
      try{
        await loadLocalMatchArt([...allies,...opponents].map(mon=>mon.name));
        if(request!==artLoadSerial)return;
        this.scene.restart({mode:'battle',tactic,teamSize});
      }finally{
        button.disabled=false;
      }
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
    try{
      const response=await fetch('./local-assets/catalog.json',{cache:'no-store'});
      if(response.ok){
        const candidate=await response.json();
        if(L.validateLocalCatalog(candidate))localSpeciesCatalog=candidate;
      }
    }catch(_){/* The 216-species catalog is private and optional. */}
    // All-or-nothing: never substitute Agumon art for Gabumon, and never
    // advertise a real-art duel unless both species manifests are valid.
    try{
      const specs=[['아구몬','duel-agumon'],['가부몬','duel-gabumon']];
      const packs=await Promise.all(specs.map(async([species,folder])=>{
        const response=await fetch('./local-assets/'+folder+'/manifest.json',
          {cache:'no-store'});
        if(!response.ok)return null;
        const candidate=await response.json();
        if(candidate.species!==species||!L.validateManifest(candidate))
          throw Error('Invalid local duel sprites for '+species);
        return {species,folder,manifest:candidate};
      }));
      if(packs.every(Boolean))localDuelPacks=packs;
    }catch(_){/* Bad/missing personal art must never prevent game launch. */}
    new Phaser.Game({
      type:Phaser.AUTO,width:800,height:450,parent:'game',
      scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
      render:{pixelArt:true,antialias:false},backgroundColor:'#172d43',
      scene:[RealTimeScene]
    });
    document.getElementById('battle').addEventListener('click',
      ()=>window.DigiPhaserLab?.battle());
    document.getElementById('duel').addEventListener('click',
      ()=>window.DigiPhaserLab?.duel());
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
