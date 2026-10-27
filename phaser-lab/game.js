/* Phaser 3 visual prototype only. No original game/save mutation. */
(() => {
  'use strict';
  const status = document.getElementById('status');
  const buttons = ['battle', 'train', 'reset', 'sound'];
  const say = text => { status.textContent = text; };
  const L = window.DigiPhaserLabLogic;
  if (!window.Phaser || !L) {
    say('Phaser 라이브러리를 불러오지 못했습니다. 인터넷 연결과 CDN 접근을 확인하세요.');
    return;
  }
  let manifest = null, soundEnabled = false, game;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const actionKey = id => 'mon-' + id;

  function drawDemoTextures(scene) {
    for (const color of [0xe3ac54, 0x80c5c9]) for (let frame = 0; frame < 2; frame++) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      // Original procedural test character: no redistributed game graphics.
      const px = (x,y,w,h,c) => { g.fillStyle(c); g.fillRect(x,y,w,h); };
      px(14,10+frame*2,30,34,color);
      px(10,1+frame*2,9,18,color); px(38,2+frame*2,9,18,color);
      px(20,43+frame*2,9,12,color); px(35,43-frame*2,9,12,color);
      px(40,22+frame*2,11,9,color);
      px(22,23+frame*2,5,5,0x122f42); px(38,23+frame*2,5,5,0x122f42);
      px(31,33+frame*2,9,3,0x68482f);
      g.generateTexture('demo-' + color + '-' + frame, 60, 66);
      g.destroy();
    }
  }

  class LabScene extends Phaser.Scene {
    constructor() { super('Lab'); }
    preload() {
      if (!manifest) return;
      for (const [id, sheet] of Object.entries(manifest.actions)) {
        this.load.spritesheet(actionKey(id), './local-assets/' + sheet.file,
          { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight, endFrame: sheet.frames-1 });
      }
    }
    create() {
      this.cameras.main.setBackgroundColor('#152b45');
      drawDemoTextures(this);
      this.drawStage();
      this.readyActions = new Set();
      if (manifest) {
        for (const [id, cfg] of Object.entries(manifest.actions)) {
          if (!this.textures.exists(actionKey(id))) continue;
          this.readyActions.add(Number(id));
          if (cfg.frames > 1) {
            const frames = this.anims.generateFrameNumbers(actionKey(id),
              { start: 0, end: cfg.frames - 1 })
              .map((f, i) => ({...f, duration: clamp(cfg.durationsMs[i], 40, 30000) }));
            this.anims.create({ key: 'act-' + id, frames, frameRate: 10,
              repeat: [0, 2, 3, 14, 32].includes(Number(id)) ? -1 : 0 });
          }
        }
      }
      this.left = this.fighter(175, 290, 0xe3ac54, false, '테이머');
      this.right = this.fighter(620, 290, 0x80c5c9, true, '상대');
      this.mode = 'idle';
      this.turn = 0;
      this.demoStat = 10;
      this.pose(this.left, 'idle');
      this.pose(this.right, 'idle');
      this.updateHud();
      say('실행 준비 완료 · ' + (this.readyActions.size ? '변환된 GIF 모션 ' + this.readyActions.size + '종 로드됨' : '저작권 없는 임시 그래픽으로 실행 중'));
      window.DigiPhaserLab = {
        battle: () => this.battle(),
        train: () => this.train(),
        reset: () => this.scene.restart(),
        sound: enabled => { soundEnabled = enabled; if (enabled && this.sound.context?.resume) this.sound.context.resume(); }
      };
      buttons.forEach(id => { document.getElementById(id).disabled = false; });
    }
    drawStage() {
      const g = this.add.graphics();
      g.fillStyle(0x314c6c, 1); g.fillRect(0, 0, 800, 450);
      g.fillStyle(0x365e62, 1); g.fillEllipse(400, 335, 670, 200);
      g.lineStyle(3, 0x759b9e, .65); g.strokeEllipse(400, 335, 650, 184);
      g.lineStyle(1, 0x7fa9a7, .25);
      for (let x = 110; x < 720; x += 60) g.lineBetween(x, 270, x, 400);
      this.add.text(400, 32, 'PHASER · BATTLE / TRAINING LAB',
        {fontFamily:'monospace',fontSize:'18px',color:'#eafaff'}).setOrigin(.5);
      this.leftHp = this.add.text(35, 72, '', {fontFamily:'monospace',fontSize:'21px',color:'#a0edaf'});
      this.rightHp = this.add.text(570, 72, '', {fontFamily:'monospace',fontSize:'21px',color:'#ffb9a9'});
      this.statLabel = this.add.text(35, 104, '', {fontSize:'17px',color:'#ecdb99'});
      this.add.text(400, 420, '독립 실험: 대전·훈련 수치는 원작 규칙이 아닙니다.',
        {fontFamily:'sans-serif',fontSize:'14px',color:'#d2e7f2'}).setOrigin(.5);
    }
    fighter(x, y, color, leftFacing, label) {
      const container = this.add.container(x, y);
      const shadow = this.add.ellipse(0, 1, 106, 20, 0x0b202c, .48);
      const useAsset = this.readyActions.size > 0;
      const key = useAsset ? actionKey(this.readyActions.has(0) ? 0 : [...this.readyActions][0]) : 'demo-' + color + '-0';
      const sprite = this.add.sprite(0, -54, key);
      // Normalize the displayed object once; never rescale for action changes.
      const w = useAsset ? manifest.actions[String(this.readyActions.has(0)?0:[...this.readyActions][0])].frameWidth : 60;
      const h = useAsset ? manifest.actions[String(this.readyActions.has(0)?0:[...this.readyActions][0])].frameHeight : 66;
      const scale = Math.min(130 / w, 116 / h, 3);
      sprite.setScale(scale).setFlipX(leftFacing);
      if (useAsset && color === 0x80c5c9) sprite.setTint(0x9dccff);
      container.add([shadow, sprite]);
      container.setDepth(4);
      this.add.text(x, y+20, label, {color:'#fff',fontSize:'18px'}).setOrigin(.5);
      return {container, sprite, color, hp:100, pose:'', originX:x, scale, demoFrame:0};
    }
    pose(f, state) {
      if (f.pose === state) return;
      f.pose = state;
      const id = L.selectAction(state);
      if (this.readyActions.has(id)) {
        const cfg = manifest.actions[String(id)];
        f.sprite.setTexture(actionKey(id), 0);
        if (cfg.frames > 1) f.sprite.play('act-' + id);
        else f.sprite.anims.stop();
        f.sprite.setScale(f.scale);
      } else if (this.readyActions.size) {
        const fallback = this.readyActions.has(0) ? 0 : [...this.readyActions][0];
        f.sprite.anims.stop();
        f.sprite.setTexture(actionKey(fallback), 0).setScale(f.scale);
      } else {
        f.sprite.anims.stop();
        f.sprite.setTexture('demo-' + f.color + '-0').setScale(f.scale);
      }
    }
    updateHud() {
      this.leftHp.setText('HP ' + this.left.hp + '/100');
      this.rightHp.setText('HP ' + this.right.hp + '/100');
      this.statLabel.setText('훈련 보너스(임시): ' + this.demoStat);
    }
    resetActors() {
      this.tweens.killTweensOf([this.left.container, this.right.container]);
      this.left.container.x = this.left.originX;
      this.right.container.x = this.right.originX;
      this.pose(this.left,'idle'); this.pose(this.right,'idle');
    }
    thud() {
      if (!soundEnabled) return;
      const ctx = this.sound.context;
      if (!ctx || !ctx.createOscillator || ctx.state !== 'running') return;
      const osc = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(45, now+.13);
      gain.gain.setValueAtTime(.085, now);
      gain.gain.exponentialRampToValueAtTime(.001, now+.15);
      osc.connect(gain).connect(ctx.destination); osc.start(now); osc.stop(now+.16);
    }
    impact(x,y,dmg) {
      this.thud();
      this.cameras.main.shake(140,.009);
      this.cameras.main.zoomTo(1.065,75);
      this.time.delayedCall(160,() => this.cameras.main.zoomTo(1,130));
      const flash = this.add.circle(x,y,20,0xffec9a,.93).setDepth(9);
      this.tweens.add({targets:flash,scale:2.5,alpha:0,duration:210,onComplete:()=>flash.destroy()});
      for (let i=0;i<9;i++) {
        const angle = Math.PI*2*i/9, spark = this.add.circle(x,y,3,0xffe5a3).setDepth(9);
        this.tweens.add({targets:spark,x:x+Math.cos(angle)*55,y:y+Math.sin(angle)*45,
          alpha:0,duration:220,onComplete:()=>spark.destroy()});
      }
      const value = this.add.text(x,y-45,'-'+dmg,
        {fontFamily:'monospace',fontSize:'24px',fontStyle:'bold',color:'#fff3bf'}).setDepth(10).setOrigin(.5);
      this.tweens.add({targets:value,y:y-96,alpha:0,duration:550,onComplete:()=>value.destroy()});
    }
    battle() {
      this.scene.restart(); // reset independent demo and preserve main game save
      // restart invokes create synchronously; start the new scene only on next tick.
      this.time.delayedCall(0, () => {});
      const start = () => {const scene=this.scene.get('Lab'); if(scene) scene.beginBattle();};
      setTimeout(start, 70);
    }
    beginBattle() {
      if (this.mode !== 'idle') return;
      this.mode='battle'; this.turn=0;
      say('자동 전투 시연 중 · 타격, 넉백, 이동 모션 관찰');
      this.time.delayedCall(220,()=>this.attackCycle());
    }
    attackCycle() {
      if (this.mode !== 'battle') return;
      const actor = this.turn % 2 === 0 ? this.left : this.right;
      const target = actor === this.left ? this.right : this.left;
      const sign = actor === this.left ? 1 : -1;
      this.resetActors();
      this.pose(actor,'moving');
      this.tweens.add({targets:actor.container,x:actor.originX+sign*174,duration:440,ease:'Sine.easeOut',
        onComplete:()=>{
          if(this.mode!=='battle')return;
          this.pose(actor,'attacking');
          this.tweens.add({targets:actor.container,x:actor.container.x+sign*48,duration:115,
            onComplete:()=>{
              if(this.mode!=='battle')return;
              const damage=36;
              target.hp=Math.max(0,target.hp-damage);
              this.pose(target,'hit');
              this.impact(target.container.x-sign*36, target.container.y-78, damage);
              this.updateHud();
              const knockback=L.knockbackForDamage(damage);
              // Explicit 75ms hitstop: pause tweens while camera/effects remain independent.
              this.tweens.pauseAll();
              setTimeout(()=>{
                if(!this.sys.isActive()||this.mode!=='battle')return;
                this.tweens.resumeAll();
                this.tweens.add({targets:target.container,x:target.container.x+sign*knockback,
                  duration:230,ease:'Cubic.easeOut',onComplete:()=>{
                    if(target.hp===0){
                      this.mode='finished';this.pose(actor,'victory');this.pose(target,'hit');
                      say((actor===this.left?'테이머':'상대')+' 승리 · 30번 승리 모션 적용');
                    }else{
                      this.pose(target,'idle');
                      this.turn+=1;
                      this.time.delayedCall(350,()=>this.attackCycle());
                    }
                  }});
              },75);
            }});
        }});
    }
    train() {
      this.scene.restart();
      setTimeout(()=>{
        const scene=this.scene.get('Lab');
        if(scene) scene.beginTrain();
      },70);
    }
    beginTrain() {
      if(this.mode!=='idle')return;
      this.mode='training'; this.pose(this.left,'training');
      say('32번 훈련 자세 → 짧은 공격 → 능력치 상승 (연출 가설 검증용)');
      this.time.delayedCall(300,()=>{
        this.pose(this.left,'attacking');
        this.tweens.add({targets:this.left.container,x:this.left.originX+36,y:280,duration:140,yoyo:true,
          onComplete:()=>{
            this.demoStat=L.gainTrainingStat(this.demoStat,1);
            this.updateHud();this.pose(this.left,'idle');
            this.mode='idle';
            say('훈련 1회 완료 · 능력치 +1 (시연 수치, 원작 미검증)');
          }});
      });
    }
    update(_t, delta) {
      if(this.readyActions.size) return;
      // Animation fallback also moves; not a stationary 'GIF' first frame.
      this._gait = (this._gait||0)+delta;
      if(this._gait < 170) return;
      this._gait=0;
      for(const f of [this.left,this.right]){
        if(['moving','idle','training'].includes(f.pose)){
          f.demoFrame=1-f.demoFrame;
          f.sprite.setTexture('demo-'+f.color+'-'+f.demoFrame);
        }
      }
    }
  }

  async function start() {
    buttons.forEach(id => document.getElementById(id).disabled = true);
    try {
      const res = await fetch('./local-assets/manifest.json',{cache:'no-store'});
      if(res.ok) {
        const candidate=await res.json();
        if(L.validateManifest(candidate))manifest=candidate;
        else say('스프라이트 manifest 형식 오류 · 임시 그래픽으로 실행합니다.');
      }
    } catch (_) { /* Atlas export is optional; placeholders always work. */ }
    game = new Phaser.Game({
      type: Phaser.AUTO, width:800, height:450, parent:'game',
      scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
      render:{pixelArt:true,antialias:false}, backgroundColor:'#152b45',
      audio:{disableWebAudio:false}, scene:[LabScene]
    });
    document.getElementById('battle').addEventListener('click',()=>window.DigiPhaserLab?.battle());
    document.getElementById('train').addEventListener('click',()=>window.DigiPhaserLab?.train());
    document.getElementById('reset').addEventListener('click',()=>window.DigiPhaserLab?.reset());
    document.getElementById('sound').addEventListener('click',e=>{
      soundEnabled=!soundEnabled;
      e.currentTarget.setAttribute('aria-pressed',String(soundEnabled));
      e.currentTarget.textContent=soundEnabled?'타격음 끄기':'타격음 켜기';
      window.DigiPhaserLab?.sound(soundEnabled);
    });
  }
  start().catch(err=>say('게임 초기화 실패: '+err.message));
})();
