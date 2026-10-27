/* v0.15.1 hex farm UI. New visual layout, reuses v0.14.2 game state and battle. */
(()=>{'use strict';
const $=id=>document.getElementById(id), core=window.DCFarm, cages=window.DCCages, care=window.DCCare;
if(!core||!cages||!care){console.error('Missing DCFarm or DCCages');return;}
const CFG=[
 {id:'core',label:'중앙 사육장',x:460,y:340,cost:0,day:1,wins:0,rank:0,needs:null,desc:'처음부터 열려 있는 생활 공간. 이동·먹이·훈련·휴식을 이용할 수 있어.'},
 {id:'training',label:'특별 훈련장',x:460,y:128,cost:220,day:2,wins:0,rank:0,needs:'core',desc:'완성되면 공격·방어 훈련을 이 구역에서 수행해. 훈련 주기 15% 단축 및 +10 Bit 보상(임시 수치).'},
 {id:'garden',label:'휴식 정원',x:270,y:234,cost:640,day:3,wins:2,rank:1,needs:'training',desc:'정원을 개방하면 휴식 주기마다 HP 추가 +2 (확장판 임시 수치).'},
 {id:'track',label:'주행 훈련장',x:650,y:234,cost:1000,day:5,wins:5,rank:2,needs:'training',desc:'완성되면 속도 훈련을 이 구역에서 수행해. 속도 추가 +1 (확장판 임시 수치).'},
 {id:'rest',label:'휴식 에리어',x:270,y:446,cost:310,day:2,wins:1,rank:0,needs:'core',desc:'완성되면 휴식을 이 구역에서 수행해. 회복 HP +3, 피로 추가 -4 (임시 수치).'},
 {id:'clinic',label:'치료 에리어',x:650,y:446,cost:570,day:3,wins:2,rank:1,needs:'rest',desc:'HP·부상·질병을 한 번에 치료하는 시설.'},
 {id:'forest',label:'숲 사육장',x:460,y:552,cost:900,day:5,wins:5,rank:2,needs:'clinic',desc:'미래 자연형 시설 후보. 현재 건설/표시만 가능하며 특수 행동은 아직 없음.'}
];
for(const f of CFG)[f.x,f.y]=core.HEX_CENTERS[f.id];
const byId=Object.fromEntries(CFG.map(x=>[x.id,x]));const ranks=['신입','브론즈','실버','골드'];
let selected='core',knownState=null,lastTeam='',lastFrame=performance.now(),uiClock=0,persistClock=0,knownCompleted=0,knownDay=1,knownWins=0,actors=new Map(),foodNodes=new Map();
function rank(){const w=state.wins||0,d=state.day||1;if(w>=9&&d>=10&&state.team.length>=3)return 3;if(w>=5&&d>=5&&state.team.length>=2)return 2;if(w>=2&&d>=3)return 1;return 0;}
function prepare(){cages.ensure(state);if(!state.facilities||typeof state.facilities!=='object')state.facilities={};state.facilities.core=true;if(!Number.isFinite(state.facilityCredits))state.facilityCredits=0;if(!Number.isFinite(state.facilityPaidWins))state.facilityPaidWins=state.wins||0;if(!Number.isFinite(state.facilityPaidDays))state.facilityPaidDays=state.day||1;core.ensure(state);
 if(knownState!==state){knownState=state;knownDay=state.day;knownWins=state.wins||0;knownCompleted=state.farm.completed;lastTeam='';actors.clear();foodNodes.clear();document.querySelectorAll('.hexActor,.hexFood').forEach(n=>n.remove());}}
function missing(f){const out=[];if(f.needs&&!state.facilities[f.needs])out.push('선행 구역 필요');if(state.day<f.day)out.push('DAY '+f.day);if((state.wins||0)<f.wins)out.push('대회 '+f.wins+'승');if(rank()<f.rank)out.push(ranks[f.rank]+' 등급');return out;}
function canBuy(f){return f&&!state.facilities[f.id]&&!missing(f).length&&state.facilityCredits>=f.cost;}
function format(n){return Math.floor(n).toLocaleString('ko-KR');}
function tileHTML(f){const unlocked=!!state.facilities[f.id],isCore=f.id==='core';return `<button type="button" class="hexTile ${unlocked?'unlocked':'locked'} ${isCore?'core':''} ${selected===f.id?'selected':''}" data-hex="${f.id}" aria-label="${f.label}, ${unlocked?'개방':'잠김'}" style="left:${f.x}px;top:${f.y}px"><span class="hexInner"><b>${isCore?'🏡':unlocked?'🌿':'🔒'}</b><strong>${f.label}</strong><small>${unlocked?'개방 중':format(f.cost)+' Bit'}</small></span></button>`;}
function drawTiles(){const layer=$('farmWorld');const nodes=Array.from(layer.querySelectorAll('.hexActor,.hexFood'));layer.innerHTML=CFG.map(tileHTML).join('');for(const node of nodes)layer.appendChild(node);drawDetails();drawNumbers();}
function drawNumbers(){$('farmCredits').textContent=format(state.facilityCredits);$('farmRank').textContent=ranks[rank()];$('farmRoomCount').textContent=CFG.filter(f=>state.facilities[f.id]).length;$('farmWinCount').textContent=state.wins||0;}
function drawDetails(){const f=byId[selected]||byId.core,owned=!!state.facilities[f.id],needs=missing(f);
 const el=$('farmDetails');
 el.innerHTML=`<strong>${owned?'✅':'🔒'} ${f.label}</strong><p>${f.desc}</p>${owned?f.id==='clinic'?'<button type="button" data-hex-heal>💚 80 Bit · HP·부상·질병 전체 치료</button>':'<span class="small">선택한 시설이 열려 있어.</span>':`<p>건설 비용: <b>${format(f.cost)} Bit</b> · 보유 ${format(state.facilityCredits)} Bit</p><p class="farmReq">${needs.length?'해금 조건: '+needs.join(' · '):state.facilityCredits<f.cost?'돈 '+format(f.cost-state.facilityCredits)+' Bit 부족':'건설 가능'}</p><button type="button" data-hex-buy="${f.id}" ${canBuy(f)?'':'disabled'}>🔨 건설</button>`}`;
}
function centerOn(id='core',smooth=false){const f=byId[id]||byId.core,v=$('farmViewport');v.scrollTo({left:Math.max(0,f.x-v.clientWidth/2),top:Math.max(0,f.y-v.clientHeight/2),behavior:smooth?'smooth':'instant'});}
function choose(id){if(!byId[id])return;selected=id;document.querySelectorAll('.hexTile').forEach(t=>t.classList.toggle('selected',t.dataset.hex===id));drawDetails();centerOn(id,true);}
let foodPlacement=false;
function armFoodPlacement(){if(state.food<=0)return toast('먹이가 없어.');if(state.farm.foods.length>=12)return toast('바닥에 먹이를 더 놓을 수 없어.');foodPlacement=true;$('hexDrop').textContent='🍖 먹이 위치 선택 중 · 취소';$('feed').textContent='🍖 위치 선택 취소';$('farmWorld').classList.add('foodPlacement');toast('사육장 지도에서 먹이를 놓을 위치를 눌러 줘.');$('farmViewport').scrollIntoView({behavior:'smooth',block:'center'});}
function disarmFoodPlacement(){foodPlacement=false;$('hexDrop').textContent='🍖 바닥에 먹이 놓기';$('feed').textContent='🍖 먹이 주기';$('farmWorld').classList.remove('foodPlacement');}
function toggleFoodPlacement(){if(foodPlacement)disarmFoodPlacement();else armFoodPlacement();}
$('farmWorld').addEventListener('click',e=>{
 if(foodPlacement){
  const rect=$('farmWorld').getBoundingClientRect();
  const x=(e.clientX-rect.left-369)/1.82,y=(e.clientY-rect.top-262)/1.56;
  if(!core.foodGround(state,x,y))return toast('개방된 사육장 바닥 안쪽에 먹이를 놓아 줘.');
  if(!core.placeFood(state,x,y))return toast('먹이가 부족하거나 지금은 놓을 수 없어.');
  disarmFoodPlacement();render();save(false);updateActors();drawStatus();toast('선택한 위치에 먹이를 놓았어.');return;
 }
 const tile=e.target.closest('[data-hex]');if(tile)choose(tile.dataset.hex);
});
$('farmDetails').addEventListener('click',e=>{const build=e.target.closest('[data-hex-buy]');if(build){const f=byId[build.dataset.hexBuy];if(!canBuy(f))return toast('아직 건설 조건을 충족하지 못했어.');state.facilityCredits-=f.cost;state.facilities[f.id]=true;say(f.label+' 건설 완료: -'+format(f.cost)+' Bit');drawTiles();refreshCageFacilities();save(false);}
 if(e.target.closest('[data-hex-heal]')){if(!state.facilities.clinic)return;const m=state.team.find(x=>x.instanceId===$('hexMon').value)||current();
 const result=care.treat(state,m,'clinic');if(!result.ok)return toast(result.reason==='credits'?'80 Bit가 부족해.':'현재 치료할 상태가 아니야.');
 say(m.name+' 완치 및 HP 회복 (-80 Bit)');render();drawDetails();drawNumbers();drawStatus();save(false);}});
$('farmHome').textContent='⌂ 중앙';$('farmLeft').textContent='◀ 왼쪽 구역';$('farmRight').textContent='오른쪽 구역 ▶';
$('farmHome').onclick=()=>choose('core');$('farmLeft').onclick=()=>choose('garden');$('farmRight').onclick=()=>choose('track');
const intro=$('farmPanel').querySelector('.farmIntro');intro.querySelector('h2').textContent='⬡ 육각형 사육장 · 첫 번째 구역';intro.querySelector('p').textContent='디지몬을 선택해 시설로 보내면 걸어서 이동하고 훈련·먹이·휴식을 수행해.';intro.querySelector('.tag').textContent='v0.20.0 · 계절·질병·부상·환생';
$('farmViewport').setAttribute('aria-label','육각형 사육장 지도, 좌우 및 상하로 스크롤 가능');
const controls=document.createElement('div');controls.className='hexControls';controls.innerHTML=`<div class="hexClock"><strong id="hexTime">DAY 1 · 00:00</strong><span id="hexSeason" aria-label="현재 계절">🌱 봄</span><button type="button" id="hexPause">⏸ 일시정지</button><label for="hexSpeed">속도</label><select id="hexSpeed"><option value="1">1배</option><option value="2">2배</option><option value="4">4배</option></select></div><div class="hexOrders"><label for="hexMon">명령 대상</label><select id="hexMon"></select><button type="button" data-hex-command="attack">⚔ 공격 훈련</button><button type="button" data-hex-command="defense">🛡 방어 훈련</button><button type="button" data-hex-command="speed">💨 속도 훈련</button><button type="button" data-hex-command="rest">💤 휴식</button><button type="button" id="hexDrop">🍖 바닥에 먹이 놓기</button><button type="button" data-hex-command="stop">■ 중지</button><button type="button" id="hexFollow">📍 디지몬 따라가기</button><label class="hexAutoToggle"><input type="checkbox" id="hexAutoRest" checked> 체력 부족 시 자동 휴식 후 훈련 복귀</label></div><div class="hexTargetControls"><label class="hexAutoToggle"><input type="checkbox" id="hexGoalEnabled"> 목표 능력치까지 훈련하고 자동 중지</label><label for="hexGoalValue">목표 수치 <input id="hexGoalValue" type="number" min="1" max="999" step="1" value="20" inputmode="numeric"></label><span>공격·방어·속도 훈련 명령에만 적용 (진화 보장 아님)</span></div><section class="hexCageBox"><strong>🏞 원작 훈련 시설 · 숨겨진 종족 AP</strong><div class="hexCageActions"><label for="hexCageSelect">시설 선택</label><select id="hexCageSelect"></select><button type="button" id="hexCageBuy">🔨 시설 구입</button><button type="button" id="hexCageTrain">🏋 종족 AP 훈련</button></div><label class="hexAutoToggle"><input type="checkbox" id="hexCageGoalEnabled"> AP 목표를 달성하면 자동 중지</label><label for="hexCageGoalValue">AP 목표 <input type="number" min="1" max="999" step="1" id="hexCageGoalValue" value="20" inputmode="numeric"></label><p id="hexCageInfo" class="hexCageInfo"></p><p id="hexCageValue" class="hexCageInfo"></p><span class="hexCageNote">원작 공략 기반 시설 효과 · AP 수치/비용/해금 조건은 임시 조정값 · 별도 건물 그래픽은 추후 구현</span></section><div class="hexCareControls"><strong>🩹 건강 관리</strong><button type="button" id="hexBandage">🩹 붕대 30 Bit</button><button type="button" id="hexMedicine">💊 약 50 Bit</button><span id="hexCareInfo">부상·질병 없음</span></div><p class="hexNote" id="hexStatus">중앙 사육장에서 명령을 선택해 봐. 시설 능력치/시간은 확장판 임시 밸런스야.</p>`;
$('farmScrollFrame')?.after(controls); // No existing wrapper is assumed; fallback below.
if(!controls.isConnected)$('farmPanel').querySelector('.farmScrollFrame').after(controls);
function refreshCageFacilities(){
 cages.ensure(state);
 const list=$('hexCageSelect'),last=list.value;
 list.replaceChildren();for(const c of cages.CAGES){const option=document.createElement('option');option.value=c.id;
 option.textContent=(cages.owned(state,c.id)?'✅ ':'🔒 ')+c.label+' — '+Object.keys(c.ap).map(k=>cages.FAMILY_LABELS[k]||k).join('/');
 list.appendChild(option);}
 if(cages.MAP[last])list.value=last;
 updateCageInfo();
}
function updateCageInfo(){
 const c=cages.info(state,$('hexCageSelect').value);if(!c)return;
 const apKey=Object.keys(c.ap)[0],m=state.team.find(x=>x.instanceId===$('hexMon').value);
 const owned=cages.owned(state,c.id);
 $('hexCageBuy').disabled=owned||c.needs.length>0||!c.affordable;
 $('hexCageBuy').textContent=owned?'✅ 건설 완료':'🔨 '+format(c.cost)+' Bit에 구입';
 $('hexCageTrain').disabled=!owned;
 $('hexCageInfo').textContent=c.label+': '+c.description+' · '+(owned?'사용 가능':c.needs.length?c.needs.join(' · '):'구매 가능');
 const amount=m?.evo?.ap?.[apKey]||0;
 const elem=m?.evo?.resist||{};
 $('hexCageValue').textContent=(m?.name||'디지몬')+' · '+(cages.FAMILY_LABELS[apKey]||apKey)+' AP: '+amount+' · 저항: '+Object.keys(cages.ELEMENT_LABELS).map(k=>cages.ELEMENT_LABELS[k]+(elem[k]||0)).join(' / ');
}
$('hexCageSelect').onchange=updateCageInfo;
$('hexCageBuy').onclick=()=>{const c=$('hexCageSelect').value;if(!cages.buy(state,c))return toast('시설 구매 조건이나 Bit를 확인해 줘.');
 say(cages.MAP[c].label+' 건설 완료!');drawNumbers();refreshCageFacilities();save(false);};
$('hexCageTrain').onclick=()=>{const c=$('hexCageSelect').value,m=$('hexMon').value;const options={cage:c};
 if($('hexCageGoalEnabled').checked){const goal=Number($('hexCageGoalValue').value);
  if(!Number.isInteger(goal)||goal<1||goal>999)return toast('AP 목표는 1~999로 입력해 줘.');options.apTarget=goal;}
 if(!core.command(state,m,'cage',options))return toast('시설을 건설하고 디지몬을 선택해 줘.');
 drawStatus();save(false);toast('선택한 시설로 이동해 종족 AP 훈련을 시작해.');};
// Portable JSON saves contain game state only, never ROM/sprite resources.
const archive=document.createElement('div');archive.className='hexArchive';
archive.innerHTML='<button type="button" id="hexExportSave">💾 세이브 파일 내보내기</button><button type="button" id="hexImportSave">📂 세이브 파일 불러오기</button><input id="hexArchiveFile" type="file" accept=".json,application/json" hidden><span class="hexArchiveNote">브라우저나 기기를 옮길 때 사용 · JSON 파일에는 ROM/이미지 없음</span>';
controls.appendChild(archive);
function getSaveData(){return {format:'digicham-save',exportVersion:1,exportedAt:new Date().toISOString(),gameVersion:'0.19.0',state:JSON.parse(JSON.stringify(state))};}
function importSaveData(json){
 const next=json&&json.format==='digicham-save'?json.state:json;
 if(!next||typeof next!=='object'||!Array.isArray(next.team)||next.team.length<1||next.team.length>50||!Number.isInteger(next.day)||next.day<1||next.day>100000||next.pendingBattle){throw Error('지원되지 않는 세이브 파일이거나 중단된 전투가 포함되어 있어.');}
 if(next.team.some(m=>!m||typeof m.name!=='string'||!m.name||!Number.isFinite(m.maxHp)||m.maxHp<=0||!Number.isFinite(m.hp)))throw Error('디지몬 개체 기록이 올바르지 않아.');
 if(!Array.isArray(next.logs))next.logs=[];
 if(next.logs.length>250)next.logs=next.logs.slice(0,250);
 if(next.team.some(m=>!Number.isFinite(m.atk)||!Number.isFinite(m.def)||!Number.isFinite(m.spd)||!Number.isFinite(m.hunger)||!Number.isFinite(m.fatigue)))throw Error('디지몬 능력치 기록이 올바르지 않아.');
 if(!Number.isInteger(next.selected)||next.selected<0||next.selected>=next.team.length)next.selected=0;
 for(const key of ['food','ropes','points','wins','losses'])if(!Number.isFinite(next[key]))next[key]=0;
 // Only after validating, preserve the current state and replace it.
 try{if(!localStorage.getItem('dc_save_backup_before_import_v0144'))localStorage.setItem('dc_save_backup_before_import_v0144',JSON.stringify(state));}catch{}
 state=next;ensureInstances();DCEvolution.ensure(state);prepare();core.ensure(state);selected='core';drawTiles();renderRoster();drawClock();drawStatus();render();save(false);centerOn('core');return true;
}
$('hexExportSave').onclick=()=>{
 try{const data=JSON.stringify(getSaveData(),null,2);const blob=new Blob([data],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='digicham-save-day'+state.day+'.json';a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('세이브 JSON 파일을 내려받았어.');}
 catch(e){toast('세이브 파일 만들기에 실패했어.');}
};
$('hexImportSave').onclick=()=>$('hexArchiveFile').click();
$('hexArchiveFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw Error('세이브 파일이 너무 커.');const parsed=JSON.parse(await file.text());importSaveData(parsed);toast('세이브 불러오기 성공!');}catch(err){toast('불러오기 실패: '+(err.message||'파일 오류'));}finally{e.target.value='';}});

function renderRoster(){const names=state.team.filter(m=>m.location!=='storage');const select=$('hexMon'),value=select.value;
 const key=names.map(m=>m.instanceId+':'+m.name).join('|');if(key===lastTeam)return;lastTeam=key;
 select.replaceChildren();names.forEach(m=>{const o=document.createElement('option');o.value=m.instanceId;o.textContent=m.name+' · Lv.'+m.level;select.appendChild(o);});
 if(names.some(m=>m.instanceId===value))select.value=value;else if(state.team[state.selected])select.value=state.team[state.selected].instanceId;
 for(const [id,node] of actors){if(!names.some(m=>m.instanceId===id)){node.remove();actors.delete(id);}}
 for(const m of names){if(actors.has(m.instanceId))continue;const node=document.createElement('button');node.className='hexActor';node.type='button';node.title=m.name+' 선택';node.innerHTML='<img alt=""><span></span><i class="hexEmote" aria-hidden="true"></i>';node.querySelector('span').textContent=m.name;node.addEventListener('click',()=>{select.value=m.instanceId;state.selected=state.team.findIndex(a=>a.instanceId===m.instanceId);render();drawStatus();});$('farmWorld').appendChild(node);actors.set(m.instanceId,node);}}
$('hexMon').onchange=()=>{const actor=state.farm.actors[$('hexMon').value];$('hexGoalEnabled').checked=!!actor?.target;if(actor?.target)$('hexGoalValue').value=actor.target.value;state.selected=state.team.findIndex(m=>m.instanceId===$('hexMon').value);render();save(false);drawStatus();updateCageInfo();};
$('hexAutoRest').onchange=()=>{const ar=state.farm.actors[$('hexMon').value];if(!ar)return;ar.autoRest=$('hexAutoRest').checked;save(false);drawStatus();};
controls.addEventListener('click',e=>{const btn=e.target.closest('[data-hex-command]');if(btn){const id=$('hexMon').value;const kind=btn.dataset.hexCommand;const options={};if(['attack','defense','speed'].includes(kind)&&$('hexGoalEnabled').checked){const target=Number($('hexGoalValue').value);if(!Number.isInteger(target)||target<1||target>999)return toast('목표 수치는 1~999로 입력해 줘.');options.target=target;}
 if(!core.command(state,id,kind,options))return toast('선택한 디지몬에게 명령을 내릴 수 없어.');drawStatus();save(false);}
 if(e.target.closest('#hexDrop'))toggleFoodPlacement();});
$('hexBandage').onclick=()=>treatSelected('injury');
$('hexMedicine').onclick=()=>treatSelected('sickness');
function treatSelected(kind){const m=state.team.find(x=>x.instanceId===$('hexMon').value);if(!m)return;
 const result=care.treat(state,m,kind);if(!result.ok)return toast(result.reason==='credits'?'치료 비용이 부족해.':'현재 치료가 필요하지 않아.');
 render();drawStatus();drawNumbers();save(false);toast('치료 완료. 이미 누적된 진화 패널티는 유지돼.');}
$('hexFollow').onclick=()=>{const a=state.farm.actors[$('hexMon').value];if(!a)return;const v=$('farmViewport');v.scrollTo({left:Math.max(0,369+a.x*1.82-v.clientWidth/2),top:Math.max(0,262+a.y*1.56-v.clientHeight/2),behavior:'smooth'});};
$('hexPause').onclick=()=>{state.world.paused=!state.world.paused;drawClock();save(false);};$('hexSpeed').onchange=()=>{state.world.speed=Number($('hexSpeed').value);save(false);drawClock();};
function drawClock(){const w=state.world;const elapsed=w.seconds%core.CFG.daySeconds;const minutes=Math.floor(elapsed/core.CFG.daySeconds*24*60);$('hexSeason').textContent=({봄:'🌱',여름:'☀️',가을:'🍂',겨울:'❄️'}[care.season(state.day)]||'🌱')+' '+care.season(state.day);$('hexTime').textContent='DAY '+state.day+' · '+String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');$('hexPause').textContent=w.paused?'▶ 계속':'⏸ 일시정지';$('hexSpeed').value=String(w.speed);}
function drawStatus(){const mon=state.team.find(m=>m.instanceId===$('hexMon').value);if(!mon)return;const a=state.farm.actors[mon.instanceId];const labels={idle:'대기',moving:'이동 중',waiting:'시설 대기',acting:'행동 중'};const kind={attack:'공격 훈련',defense:'방어 훈련',speed:'속도 훈련',cage:'종족 AP 훈련',rest:'휴식',eat:'먹기',wander:'산책'};
 const ar=state.farm.actors[mon.instanceId];$('hexAutoRest').checked=ar?.autoRest!==false;
 $('hexStatus').textContent=`${mon.name}: ${labels[a?.mode]||'대기'}${a?.goal?' · '+(a.goal.kind==='cage'?(cages.MAP[a.goal.cage]?.label||'종족 훈련'):(kind[a.goal.kind]||''))+' · '+({core:'중앙',training:'특별훈련장',track:'주행장',forest:'숲',rest:'휴식 구역'}[a.goal.zone]||'중앙') : ''}${a?.target?' · 목표 '+(a.target.stat||a.target.ap)+' '+a.target.value:''} | HP ${Math.ceil(mon.hp)}/${mon.maxHp} · 배고픔 ${Math.floor(mon.hunger)}/100 · 피로 ${Math.floor(mon.fatigue)} · 훈련 ${mon.training}`;
 care.ensureMon(mon);$('hexCareInfo').textContent=(mon.care.injured?'🩹 부상 ':'')+(mon.care.sick?'🤒 질병 ':'')+(!mon.care.injured&&!mon.care.sick?'건강':'')+' · 육성 패널티 '+(mon.evo?.penalties||0);
 $('hexBandage').disabled=!mon.care.injured;$('hexMedicine').disabled=!mon.care.sick;
 updateCageInfo();}
function updateActors(){renderRoster();const monset=new Map(state.team.map(m=>[m.instanceId,m]));for(const [id,node] of actors){const m=monset.get(id),a=state.farm.actors[id];if(!m||!a)continue;node.style.left=(369+a.x*1.82)+'px';node.style.top=(262+a.y*1.56)+'px';node.querySelector('img').style.transform=`scaleX(${a.face||-1})`;if(node.dataset.pose!==String(a.pose)||node.dataset.mon!==m.name){const src=spriteUrl(m.name,a.pose||0);if(src)node.querySelector('img').src=src;node.dataset.pose=String(a.pose);node.dataset.mon=m.name;}node.classList.toggle('active',id===$('hexMon').value);const emote=node.querySelector('.hexEmote');if(emote){const happy=a.emoteUntil>state.world.seconds;emote.textContent=happy?a.emote:'';emote.classList.toggle('visible',happy);}}
 const used=new Set();for(const f of state.farm.foods){used.add(f.id);let node=foodNodes.get(f.id);if(!node){node=document.createElement('span');node.className='hexFood';node.textContent='🍖';node.title='바닥에 둔 먹이';node.classList.add('falling');node.addEventListener('animationend',()=>node.classList.remove('falling'),{once:true});$('farmWorld').appendChild(node);foodNodes.set(f.id,node);}node.style.left=(369+f.x*1.82)+'px';node.style.top=(262+f.y*1.56)+'px';}for(const [id,node] of foodNodes){if(!used.has(id)){node.remove();foodNodes.delete(id);}}}
function credit(amount,label){state.facilityCredits+=amount;say(label+': +'+format(amount)+' Bit');drawNumbers();drawDetails();save(false);}
// All nursery quick controls now use the SAME timed farm engine as the hex panel.
// Remove legacy onclicks to avoid immediate stat changes / duplicate Bit or food costs.
function selectedId(){return state.team[state.selected]?.instanceId;}
function quickOrder(kind){const id=selectedId();if(!id||!core.command(state,id,kind))return toast('이 디지몬에게 지금 명령을 내릴 수 없어.');$('hexMon').value=id;drawStatus();save(false);toast('사육장에 '+({attack:'훈련',rest:'휴식'}[kind]||kind)+' 명령을 예약했어.');}
$('train').onclick=()=>quickOrder('attack');
$('rest').onclick=()=>quickOrder('rest');
$('feed').onclick=toggleFoodPlacement;
$('nextDay').addEventListener('click',()=>{prepare();state.world.seconds=Math.max(state.world.seconds,(state.day-1)*core.CFG.daySeconds);payDays();drawClock();save(false);});
$('reset').addEventListener('click',()=>queueMicrotask(()=>{disarmFoodPlacement();prepare();drawTiles();renderRoster();refreshCageFacilities();drawClock();centerOn('core');}));
function payDays(){if(state.day>state.facilityPaidDays){const n=state.day-state.facilityPaidDays;state.facilityPaidDays=state.day;credit(35*n,'일일 사육 관리비');}}
function payWins(){if((state.wins||0)>state.facilityPaidWins){const n=state.wins-state.facilityPaidWins;state.facilityPaidWins=state.wins;credit(180*n,'대회 승리 보상');}}
function frame(now){const dt=Math.max(0,Math.min(.15,(now-lastFrame)/1000));lastFrame=now;
 if(!document.hidden){prepare();core.advance(state,dt,{xp:grantExperience,evolution:DCEvolution,lookup:speciesLookup});payWins();payDays();
 const n=state.farm.completed;if(n>knownCompleted){const gain=n-knownCompleted;knownCompleted=n;credit((20+(state.facilities.training?10:0))*gain,'자동 훈련 '+gain+'회 보상');render();save(false);}
 updateActors();uiClock+=dt;persistClock+=dt;if(uiClock>=.3){drawClock();drawStatus();drawNumbers();uiClock=0;}
 if(persistClock>=6){save(false);persistClock=0;}}
 requestAnimationFrame(frame);}
prepare();drawTiles();renderRoster();drawClock();refreshCageFacilities();drawStatus();requestAnimationFrame(()=>centerOn('core'));
window.addEventListener('resize',()=>centerOn(selected));requestAnimationFrame(frame);
window.DCHexFarm={get state(){return state},tick:(seconds)=>{core.advance(state,seconds,{xp:grantExperience,evolution:DCEvolution,lookup:speciesLookup});payDays();payWins();
 const n=state.farm.completed;if(n>knownCompleted){const gain=n-knownCompleted;knownCompleted=n;credit((20+(state.facilities.training?10:0))*gain,'자동 훈련 '+gain+'회 보상');}
 drawStatus();updateActors();render();save(false);},choose,core,exportSaveObject:getSaveData,importSaveObject:importSaveData};
})();
