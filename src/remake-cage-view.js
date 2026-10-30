/* Phase 1 original-remake cage navigator: presentation only.
 * The existing farm, training, purchases, roster and save remain authoritative.
 * Two rows are a first UI layout pass, not verified NDS cage geometry.
 */
(() => {
  'use strict';
  if(window.DCRemakeCages || !matchMedia('(min-width:900px) and (pointer:fine)').matches) return;
  const panel=document.getElementById('farmPanel');
  const farm=window.DCHexFarm,cages=window.DCCages;
  const select=document.getElementById('hexCageSelect');
  const training=document.getElementById('hexCageTrain');
  const purchase=document.getElementById('hexCageBuy');
  const originalMap=panel?.querySelector('.farmScrollFrame');
  if(!panel||!originalMap||!farm||!cages?.CAGES?.length||!select||!training||!purchase)return;

  const source=document.currentScript?.src;
  if(source&&!document.getElementById('dc-remake-cage-style')){
    const css=document.createElement('link');
    css.id='dc-remake-cage-style';
    css.rel='stylesheet';
    css.href=new URL('remake-cage-view.css',source).href;
    document.head.appendChild(css);
  }

  const slots=[
    {id:'base',label:'기본 사육장',
      description:'디지몬의 생활·먹이·휴식·기본 훈련을 담당하는 공간.'},
    ...cages.CAGES.map(c=>({id:c.id,label:c.label,
      description:c.description||c.type||'훈련 시설'}))
  ];
  let mode='overview',selected='base',fingerprint='';
  const overview=document.createElement('section');
  overview.id='dc-cage-overview';
  overview.setAttribute('aria-label','2줄 사육 케이지 선택');
  overview.innerHTML='<div class="dc-cage-heading"><div><strong>사육 케이지</strong>'+
    '<small>기본 생활 공간과 기존 종족 훈련 시설</small></div>'+
    '<span id="dc-cage-count"></span></div>'+
    '<div class="dc-cage-grid" id="dc-cage-grid" role="group" aria-label="두 줄 케이지"></div>'+
    '<p class="dc-cage-hint">잠긴 시설도 선택해 조건을 확인할 수 있어요. 구매와 훈련은 기존 게임 기능을 사용해요.</p>';
  const room=document.createElement('section');
  room.id='dc-cage-room';
  room.innerHTML='<div class="dc-cage-room-top">'+
    '<button type="button" id="dc-cage-back">◀ 전체 케이지</button>'+
    '<div><strong id="dc-cage-name">기본 사육장</strong>'+
    '<small id="dc-cage-description"></small></div>'+
    '<span id="dc-cage-unlock"></span></div>'+
    '<p id="dc-cage-action" role="status"></p>';
  originalMap.before(overview);
  originalMap.before(room);
  const grid=overview.querySelector('#dc-cage-grid');
  const count=overview.querySelector('#dc-cage-count');
  const name=room.querySelector('#dc-cage-name');
  const description=room.querySelector('#dc-cage-description');
  const unlock=room.querySelector('#dc-cage-unlock');
  const action=room.querySelector('#dc-cage-action');
  const back=room.querySelector('#dc-cage-back');
  const details=id=>id==='base'
    ? {owned:true,needs:[],affordable:true,label:'기본 사육장'}
    : cages.info(farm.state,id);
  const available=id=>id==='base'||!!(farm.state&&cages.owned(farm.state,id));

  for(let i=0;i<slots.length;i++){
    const slot=slots[i];
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='dc-cage-slot';
    btn.dataset.dcCage=slot.id;
    const number=document.createElement('span');
    number.className='dc-cage-number';
    number.textContent=String(i+1).padStart(2,'0');
    const lock=document.createElement('span');
    lock.className='dc-cage-lock';
    lock.setAttribute('aria-hidden','true');
    const title=document.createElement('strong');
    title.textContent=slot.label;
    const sub=document.createElement('small');
    btn.append(number,lock,title,sub);
    btn.addEventListener('click',()=>open(slot.id));
    grid.appendChild(btn);
  }
  function setMode(next){
    mode=next;
    panel.classList.toggle('dc-cage-mode-overview',next==='overview');
    panel.classList.toggle('dc-cage-mode-room',next==='room');
    overview.hidden=next!=='overview';
    room.hidden=next!=='room';
  }
  function render(){
    if(!farm.state)return;
    count.textContent=slots.filter(x=>available(x.id)).length+
      '/'+slots.length+' 개방';
    for(const slot of slots){
      const btn=grid.querySelector('[data-dc-cage="'+slot.id+'"]');
      const owned=available(slot.id),info=details(slot.id);
      const subtitle=owned?(slot.id==='base'?'생활·먹이·휴식·훈련':'종족 훈련 가능'):
        (info?.needs?.length?info.needs.join(' · '):'구입 가능')+
        (info?.cost?' · '+info.cost.toLocaleString('ko-KR')+' Bit':'');
      btn.classList.toggle('dc-cage-locked',!owned);
      btn.querySelector('.dc-cage-lock').textContent=owned?'●':'🔒';
      btn.querySelector('small').textContent=subtitle;
      btn.setAttribute('aria-label',slot.label+' · '+(owned?'개방':'잠김')+' · '+subtitle);
      btn.setAttribute('aria-pressed',String(mode==='room'&&selected===slot.id));
    }
    if(mode==='room'){
      const owned=available(selected),info=details(selected);
      unlock.textContent=owned?'● 개방':'🔒 미개방';
      action.textContent=selected==='base'?
        '기존 디지몬을 선택해 먹이·훈련·휴식을 명령할 수 있어요.':
        owned?'아래의 기존 종족 AP 훈련 버튼으로 명령할 수 있어요.':
        info?.needs?.length?'해금 조건: '+info.needs.join(' · '):
          '조건을 충족하면 아래의 기존 시설 구매 버튼으로 구입할 수 있어요.';
    }
  }
  function open(id){
    const slot=slots.find(s=>s.id===id);
    if(!slot)return false;
    selected=id;
    name.textContent=slot.label;
    description.textContent=slot.description;
    setMode('room');
    if(id==='base'){
      farm.choose('core');
    }else{
      select.value=id;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      farm.choose(farm.state?.facilities?.training?'training':'core');
    }
    render();
    return true;
  }
  back.addEventListener('click',()=>{
    setMode('overview');
    render();
    grid.querySelector('.dc-cage-slot')?.focus({preventScroll:true});
  });
  // The user explicitly selected one PC game window, not the old NDS shell.
  // Use the original UI switch; do not reimplement or rewrite saved game state.
  if(document.body.classList.contains('mode-nds'))
    document.getElementById('wideMode')?.click();
  setMode('overview');
  render();
  function refresh(){
    if(!farm.state)return;
    const s=farm.state;
    const state=JSON.stringify([s.day,s.wins,s.facilityCredits,
      s.facilities,s.cageFacilities,selected,mode]);
    if(state!==fingerprint){fingerprint=state;render();}
  }
  const timer=setInterval(()=>{if(!document.hidden)refresh();},1100);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  window.DCRemakeCages=Object.freeze({
    open,
    overview(){setMode('overview');render();},
    snapshot(){refresh();return {
      mode,cage:selected,slots:slots.length,
      unlocked:slots.filter(x=>available(x.id)).length
    };}
  });
})();
