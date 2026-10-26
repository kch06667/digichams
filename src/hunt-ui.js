/* Pointer hunting UI — works with touch, mouse, pen. Requires DCHunt core & legacy state helpers. */
(()=>{'use strict';
 const ui=id=>document.getElementById(id), stage=ui('huntStage'),canvas=ui('huntStageCanvas');
 if(!stage||!canvas||typeof DCHunt==='undefined')return;
 const ctx=canvas.getContext('2d');let encounter=null,arm=false,gesture=null,guide='',lastTime=performance.now();
 const zones={forest:{label:'숲',list:['코로몬','토코몬','파타몬','아구몬','쿠네몬','파르몬','고부리몬','테리어몬','플롯트몬']},coast:{label:'해변',list:['베타몬','고마몬','쉬라몬','브이몬','가부몬','코로몬','토코몬']},ruins:{label:'유적',list:['케라몬','임프몬','톱니몬','아구몬','가부몬','파피몬','코로몬']}};
 function zone(){return ui('huntZone').value in zones?ui('huntZone').value:'forest';}
 function active(){return !!encounter&&!['escaped','captured'].includes(encounter.mode);}
 function limits(){const w=state.wins||0;return w>=12?3:w>=6?2:w>=2?1:0;}
 const stageOrder={'유년기 I':0,'유년기 II':0,'성장기':1,'성숙기':2,'완전체':3,'궁극체':4};
 function pool(){const cap=limits();const all=SPECIES.filter(s=>s.name&&s.stage in stageOrder&&stageOrder[s.stage]<=cap);
  const match=all.filter(s=>zones[zone()].list.includes(s.name));return match.length?match:all;}
 function hint(msg){guide=msg;ui('huntInstructions').textContent=msg;ui('captureHint').textContent=msg;}
 function redrawHUD(){ui('huntRopes').textContent=state.ropes||0;ui('huntRopeCount').textContent=state.ropes||0;ui('huntFoodCount').textContent=state.food||0;
  ui('huntRopeTier').textContent=['유년기','성장기','성숙기','완전체'][limits()]+'용';
  ui('huntHealth').textContent=encounter?Math.ceil(encounter.hp)+' / '+Math.ceil(encounter.maxHp):'—';
  ui('huntEscape').textContent=encounter?Math.ceil(encounter.time)+'초':'—';
  ui('captureMeter').style.width=encounter?Math.min(100,Math.round(encounter.hp/encounter.maxHp*100))+'%':'0%';
  ui('throwRope').disabled=!encounter||encounter.mode!=='wild'||state.ropes<=0;
  ui('throwRope').classList.toggle('huntRopeActive',arm);
  ui('throwRope').textContent=arm?'🪢 원 그리기 선택 중':'🪢 로프 선택';
  ui('huntBait').disabled=!encounter||encounter.mode!=='wild'||state.food<=0;
  ui('huntGrab').disabled=!encounter||encounter.mode!=='stunned';
  ui('wildName').textContent=encounter?.name||'탐색 준비';
  let phase=encounter?.mode||'none';
  ui('huntStatus').textContent=({none:'사냥할 지역을 정하고 탐색해 봐.',wild:arm?'화면에서 디지몬 주변에 원을 그려 줘.':'야생 디지몬 발견 · 로프를 선택해!',tied:'묶었어! 디지몬을 누른 채 바깥으로 당긴 후 손을 떼 줘.',stunned:'기절 성공! 디지몬을 누르거나 손 버튼을 눌러 포획해.',captured:'포획 성공! 동료가 사육장에 들어왔어.',escaped:'도망쳤어. 다시 탐색해 봐.'})[phase];
 }
 function start(){const choices=pool();if(!choices.length){hint('이 지역에 등장할 수 있는 디지몬이 없어.');return;}
  const s=choices[Math.floor(Math.random()*choices.length)];encounter=DCHunt.encounter(s);state.wild={...makeMon(s.name),diff:s.diff};
  arm=false;gesture=null;ui('wildArt').classList.remove('hidden','tied');
  hint('로프 선택 → 디지몬 주변에 원을 한 번 그리고 손을 떼 줘.');say(`야생 ${s.name} 발견 (${zones[zone()].label}).`);
  setSprite('wildArt',s.name,SPRITE_STATES.idle);render();redrawHUD();save(false);
 }
 function finishEscape(reason){if(!encounter||encounter.mode!=='escaped')return;arm=false;gesture=null;state.wild=null;hint(reason||'야생 디지몬이 도망쳤어.');say(`${encounter.name} 사냥 실패.`);save(false);render();redrawHUD();}
 function finishCapture(){if(!encounter||encounter.mode!=='stunned')return;
  if(state.team.length>=50){hint('보유 디지몬이 50마리야. 지금은 포획을 더 진행할 수 없어.');return;}
  const name=encounter.name;if(!DCHunt.capture(encounter))return;
  const mon=makeMon(name);state.team.push(mon);if(typeof DCEvolution!=='undefined')DCEvolution.ensure(state);
  state.wild=null;arm=false;gesture=null;hint('포획 성공! '+name+'이(가) 사육장에 합류했어.');say(`${name} 포획 성공!`);
  toast(`${name} 포획 성공!`);setSprite('wildArt',name,SPRITE_STATES.happy);render();save(false);redrawHUD();
 }
 function bait(){if(!encounter||encounter.mode!=='wild'||state.food<=0)return;
  state.food--;encounter.bait=12;encounter.time+=13;hint('먹이로 야생 디지몬을 유인했어. 움직임이 잠시 느려져.');say(`${encounter.name}에게 미끼를 던졌다.`);render();save(false);redrawHUD();}
 function pointer(e){const r=stage.getBoundingClientRect();return {x:DCHunt.clamp((e.clientX-r.left)/r.width,0,1),y:DCHunt.clamp((e.clientY-r.top)/r.height,0,1)};}
 stage.addEventListener('pointerdown',e=>{
  if(!encounter||!active())return;
  const p=pointer(e);
  if(encounter.mode==='stunned')return finishCapture();
  if(encounter.mode==='wild'&&!arm)return hint('먼저 로프 선택 버튼을 눌러 줘.');
  if(encounter.mode==='tied'&&DCHunt.distance(p,encounter)>.18)return hint('디지몬을 직접 누른 뒤 바깥으로 끌어당겨 줘.');
  e.preventDefault();stage.setPointerCapture?.(e.pointerId);gesture={type:encounter.mode==='wild'?'lasso':'pull',start:p,points:[p],end:p,target:{x:encounter.x,y:encounter.y}};
 });
 stage.addEventListener('pointermove',e=>{if(!gesture)return;e.preventDefault();const p=pointer(e);gesture.end=p;
  if(DCHunt.distance(gesture.points[gesture.points.length-1],p)>.007)gesture.points.push(p);
 });
 function release(e){if(!gesture)return;e.preventDefault();let g=gesture;gesture=null;const p=pointer(e);g.end=p;if(DCHunt.distance(g.points[g.points.length-1],p)>.007)g.points.push(p);
  if(g.type==='lasso'){
   // If the creature moves slightly while the circle is drawn, use its current position.
   const r=DCHunt.lasso(g.points,g.target);
   if(!r.ok){hint(r.reason);return;}
   if(state.ropes<=0){hint('로프가 부족해.');return;}
   state.ropes--;DCHunt.bind(encounter);arm=false;ui('wildArt').classList.add('tied');
   setSprite('wildArt',encounter.name,SPRITE_STATES.tiedIdle);hint('묶었어! 디지몬을 눌러 바깥으로 당기고 손을 떼 줘. 너무 길게 당기면 끊어져.');render();save(false);
  }else{
   const r=DCHunt.pull(encounter,g.start,g.end);
   if(r.broken){hint(r.reason);finishEscape(r.reason);setSprite('wildArt',encounter.name,SPRITE_STATES.flee);}
   else if(r.ok){setSprite('wildArt',encounter.name,r.stunned?SPRITE_STATES.ko:SPRITE_STATES.tiedSurprised);
    hint(r.stunned?'기절시켰어! 손 버튼이나 디지몬을 눌러서 데려와.':`체력 -${r.damage}! 힘을 조절해서 다시 당겨 줘.`);}
   else hint(r.reason);
  }
  redrawHUD();
 }
 stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',()=>{gesture=null;});
 ui('explore').onclick=start;
 ui('throwRope').onclick=()=>{if(!encounter||encounter.mode!=='wild'||state.ropes<=0)return;arm=!arm;hint(arm?'디지몬을 원으로 둘러싸고 손을 떼 줘.':'로프 선택을 취소했어.');if(arm)stage.scrollIntoView({block:'center',behavior:'instant'});redrawHUD();};
 ui('huntBait').onclick=bait;ui('huntGrab').onclick=finishCapture;
 ui('huntZone').onchange=()=>{if(encounter&&active())hint('지역 변경은 다음 탐색부터 반영돼.');};
 function draw(){const r=stage.getBoundingClientRect();if(!r.width)return;const dpi=Math.min(2,window.devicePixelRatio||1),w=Math.round(r.width*dpi),h=Math.round(r.height*dpi);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.clearRect(0,0,w,h);ctx.lineCap='round';ctx.lineJoin='round';
  if(gesture&&gesture.points.length>1){ctx.beginPath();const pts=gesture.points;pts.forEach((p,i)=>{if(!i)ctx.moveTo(p.x*w,p.y*h);else ctx.lineTo(p.x*w,p.y*h)});ctx.lineWidth=4*dpi;ctx.strokeStyle='#fff0a4';ctx.shadowColor='#121b29';ctx.shadowBlur=7*dpi;ctx.stroke();ctx.shadowBlur=0;}
  if(encounter?.mode==='tied'||encounter?.mode==='stunned'){
   const x=encounter.x*w,y=encounter.y*h;ctx.beginPath();ctx.ellipse(x,y,50*dpi,37*dpi,0,0,Math.PI*2);ctx.lineWidth=3*dpi;ctx.strokeStyle='#f8db84';ctx.stroke();
   if(gesture?.type==='pull'){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(gesture.end.x*w,gesture.end.y*h);ctx.lineWidth=4*dpi;ctx.strokeStyle='#fdf5d0';ctx.stroke();}
  }
 }
 function frame(t){const dt=Math.min(.15,Math.max(0,(t-lastTime)/1000));lastTime=t;
  if(encounter&&active()&&!document.hidden&&ui('hunt').classList.contains('active')&&!gesture){
   const was=encounter.mode;DCHunt.tick(encounter,dt);
   if(encounter.mode==='escaped'&&was!=='escaped')finishEscape('시간이 지나 디지몬이 달아났어.');
   if(encounter.mode==='wild')setSprite('wildArt',encounter.name,SPRITE_STATES.walk);
  }
  if(encounter){ui('wildArt').style.left=100*encounter.x+'%';ui('wildArt').style.top=100*encounter.y+'%';ui('huntEmote').style.left=100*encounter.x+'%';ui('huntEmote').style.top=100*encounter.y+'%';
   ui('huntEmote').textContent=encounter.mode==='tied'?'당겨!':encounter.mode==='stunned'?'💫':encounter.mode==='escaped'?'💨':'';
  }
  redrawHUD();draw();requestAnimationFrame(frame);
 }
 // Prevent stale JSON imports or resets from mutating an older local encounter.
 ui('reset').addEventListener('click',()=>queueMicrotask(()=>{encounter=null;arm=false;gesture=null;ui('wildArt').classList.add('hidden');redrawHUD();}));
 ui('hexArchiveFile')?.addEventListener('change',()=>{encounter=null;arm=false;gesture=null;redrawHUD();});
 ui('wildArt').classList.add('hidden');
 // A pre-v0.21 unfinished encounter cannot be resumed as a lasso-in-progress.
 state.wild=null;
 hint('지역을 선택한 뒤 탐색해 봐.');redrawHUD();requestAnimationFrame(frame);
 window.DCHuntUI={get encounter(){return encounter},start,bait,finishCapture,redrawHUD};
})();
