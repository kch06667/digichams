/* Battle techniques transcribed from the already playable HTML arena (v0.23).
 * Names/type are existing extension metadata, NOT verified NDS skill IDs.
 * DOM-free; shared by Node tests and the Phaser rehearsal renderer only.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DigiArenaTechniques=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const known=Object.freeze({
    '아구몬':{name:'화염 공격',type:'orb',color:'#ffb451'},
    '그레이몬':{name:'메가 플레임',type:'orb',color:'#ff873f'},
    '메탈그레이몬':{name:'기가 디스트로이어',type:'missile',color:'#ffd273'},
    '가부몬':{name:'블루 블래스터',type:'orb',color:'#87e6ff'},
    '아르마몬':{name:'돌진 타격',type:'claw',color:'#f8dca2'},
    '쿠와가몬':{name:'강습 베기',type:'claw',color:'#ef98c4'},
    '가루몬':{name:'돌진 타격',type:'claw',color:'#bee9ff'},
    '엔젤몬':{name:'빛의 타격',type:'claw',color:'#fff0ae'},
    '고부리몬':{name:'강타',type:'claw',color:'#e5f8b3'},
    '워그레이몬':{name:'가이아 포스',type:'orb',color:'#ffb95b',cost:36},
    '블랙워그레이몬':{name:'가이아 포스',type:'orb',color:'#d0a4f2',cost:36},
    '메탈가루몬':{name:'코큐토스 브레스',type:'missile',color:'#9fe5ff',cost:34},
    '듀크몬':{name:'로얄 세이버',type:'claw',color:'#ffbf94',cost:34},
    '파타몬':{name:'에어 샷',type:'orb',color:'#c0eaff',cost:20},
    '텐타몬':{name:'쁘띠 썬더',type:'orb',color:'#f2eb8b',cost:20},
    '피요몬':{name:'매지컬 파이어',type:'orb',color:'#ffb596',cost:20},
    '팔몬':{name:'포이즌 아이비',type:'claw',color:'#afeea2',cost:20},
    '길몬':{name:'파이어 볼',type:'orb',color:'#ffa48b',cost:22},
    '브이몬':{name:'브이몬 헤드',type:'claw',color:'#8cb6ff',cost:22}
  });
  const melee=Object.freeze(['아르마몬','쿠와가몬','고부리몬','가루몬','엔젤몬']);
  const legalTypes=new Set(['claw','orb','missile']);
  function forSpecies(species){
    const knownOne=known[species];
    const selected=knownOne||{name:'기본 필살기(임시)',
      type:melee.includes(species)?'claw':'orb',color:'#c0eeff'};
    // Do not mutate the source database. Canonical cost default from battle-core.
    return Object.freeze({...selected,cost:selected.cost??24,verifiedByRom:false});
  }
  function forFighter(f){
    const base=forSpecies(f.name);
    if(f.skillKind===undefined)return base;
    if(!['melee','projectile'].includes(f.skillKind))return base;
    const type=f.skillKind==='melee'?'claw':'orb';
    return Object.freeze({...base,type});
  }
  function valid(tech){
    return tech&&typeof tech.name==='string'&&tech.name.length>0&&
      legalTypes.has(tech.type)&&/^#[0-9a-f]{6}$/i.test(tech.color)&&
      Number.isFinite(tech.cost)&&tech.cost>0;
  }
  return Object.freeze({forSpecies,forFighter,valid,known});
});
