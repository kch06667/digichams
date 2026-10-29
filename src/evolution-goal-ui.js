/* Evolution 477-route diagnostics and read-only lineage, original game's
 * existing target-selection and catalog interfaces remain authoritative.
 * No new save data, no sprite bytes, and no evolution decisions here.
 */
(function(root){'use strict';
 const evo=root.DCEvolution;
 const rules=document.getElementById('evolutionRules');
 const catalog=document.getElementById('catalogDetail');
 if(!evo?.routeProgress||!evo?.lineage||!rules||!catalog)return;
 const labels={battles:'전투',winRate:'승률',eggReverts:'환생',
  penalties:'육성 패널티',stageDays:'성장 경과'};
 const family={dragon:'용족',beast:'짐승',bird:'조류',water:'수중',
  insect:'곤충·식물',machine:'기계',darkness:'암흑',holy:'신성',
  data:'데이터',virus:'바이러스',vaccine:'백신'};
 const diagnostics=document.createElement('section');
 diagnostics.id='evolutionGoalDiagnostics';
 diagnostics.className='evoGuide';
 diagnostics.setAttribute('aria-label','진화 조건 상세 진행');
 rules.insertAdjacentElement('afterend',diagnostics);
 const genealogy=document.createElement('section');
 genealogy.id='evolutionCatalogLineage';
 genealogy.className='evoGuide';
 genealogy.setAttribute('aria-label','도감 진화 연결 관계');
 catalog.insertAdjacentElement('afterend',genealogy);
 function conditionLabel(c){
  const name=c.kind==='ap'?(family[c.key]||c.key)+' AP':labels[c.kind]||c.kind;
  if(c.kind==='winRate'){
   const value=Math.round(c.have*100),need=Math.round(c.need*100);
   return name+' '+value+'% / '+need+'%'+(c.met?' ✓':' (부족 '+Math.max(0,need-value)+'%p)');
  }
  return name+' '+c.have+' / '+c.need+(c.met?' ✓':' (부족 '+c.missing+')');
 }
 function addText(parent,tag,str,className){
  const element=document.createElement(tag);
  if(className)element.className=className;
  element.textContent=str;parent.appendChild(element);return element;
 }
 function renderGoals(){
  const m=typeof root.current==='function'?root.current():null;
  if(!m)return;
  const rows=evo.routeProgress(m,n=>typeof root.speciesLookup==='function'&&!!root.speciesLookup(n));
  diagnostics.replaceChildren();
  addText(diagnostics,'strong','🧭 진화 목표 조건 분석 · '+m.name);
  const target=m.evo?.target;
  addText(diagnostics,'p',target?'🎯 '+target+' 목표 고정 · 다른 진화 분기는 보류 중':
   '자동 진화 선택 중 · 목표를 지정하면 다른 분기는 보류돼.', 'evoGuideHint');
  if(!rows.length){addText(diagnostics,'p','확인된 다음 진화 경로가 없어.');return;}
  const list=document.createElement('div');list.className='evoGuideList';
  for(const row of rows){
   const item=document.createElement('div');item.className='evoGuideRow';
   const text=(row.selected?'🎯 ':'')+row.to+' · '+
    (!row.available?'도감 대상 데이터 없음':row.ready?'진화 조건 충족':
     '조건 '+row.conditions.filter(c=>c.met).length+'/'+row.conditions.length+' 충족');
   addText(item,'strong',text);
   addText(item,'p',row.conditions.length?
    row.conditions.map(conditionLabel).join(' · '):
    '추가 조건 없음',row.ready?'evoGuideReady':'evoGuideMissing');
   list.appendChild(item);
  }
  diagnostics.appendChild(list);
  addText(diagnostics,'p','전투·AP·환생·경과일의 필요 수치는 현재 진화표 기준이며, '+
   '일부 AP 획득량과 성장일·분기 우선순위는 ROM 미검증 임시값이야.','evoGuideNote');
 }
 function renderLineage(){
  const title=catalog.querySelector('h3');
  const name=title?.textContent?.trim();
  genealogy.replaceChildren();
  if(!name){genealogy.hidden=true;return;}
  genealogy.hidden=false;
  const path=evo.lineage(name);
  addText(genealogy,'strong','🌳 '+name+' 진화 연결 관계');
  addText(genealogy,'p','진화 전: '+(path.from.join(' · ')||'확인된 이전 단계 없음'));
  addText(genealogy,'p','진화 후: '+(path.to.join(' · ')||'확인된 다음 단계 없음'));
  addText(genealogy,'p','전체 216종 · 공략 자료 기반 477개 진화 경로 · '+
   '현재 육성 중인 디지몬의 진화 목표 선택은 위 진화 후보 화면에서 가능.','evoGuideNote');
 }
 // Observe only the game's authoritative rendered content, not our siblings.
 // A MutationObserver on the entire page would be too expensive for the farm.
 let queuedGoals=false,queuedLineage=false;
 new MutationObserver(()=>{
  if(queuedGoals)return;queuedGoals=true;
  queueMicrotask(()=>{queuedGoals=false;renderGoals();});
 }).observe(rules,{childList:true});
 new MutationObserver(()=>{
  if(queuedLineage)return;queuedLineage=true;
  queueMicrotask(()=>{queuedLineage=false;renderLineage();});
 }).observe(catalog,{childList:true,subtree:true,characterData:true});
 renderGoals();renderLineage();
 root.DCEvolutionGuide={refresh:renderGoals,refreshLineage:renderLineage};
})(typeof globalThis!=='undefined'?globalThis:this);
