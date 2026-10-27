/* Separate prototype farm data. Illustrative prices/timings, never real save state. */
(function(root,factory) {
  const api=factory();
  if (typeof module==='object'&&module.exports) module.exports=api;
  if (root) root.DigiFarmLabModel=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const COLUMNS=6, MAX_ROWS=5, CAGE_COST=100, ROW_COST=220, FOOD_COST=5, FOOD_BITES=4;
  const code=(row,col)=>row+':'+col;
  const inside=(s,row,col)=>Number.isInteger(row)&&Number.isInteger(col)&&
    row>=0&&row<s.rows&&col>=0&&col<COLUMNS;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const initial=()=>({
    rows:2,credits:600,selected:'0:0',training:10,
    cages:{
      '0:0':{hunger:60,food:0,name:'디지몬 A'},
      '1:0':{hunger:45,food:0,name:'디지몬 B'}
    }
  });
  function transition(state, action){
    if(!state||!action||typeof action.type!=='string')throw Error('Invalid farm transition');
    const s={...state,cages:{...state.cages}};
    const [row,col]=String(s.selected).split(':').map(Number);
    const targetKey=action.type==='bite'&&typeof action.at==='string'?action.at:s.selected;
    const cage=s.cages[targetKey];
    const fail=message=>({state,message,changed:false});
    const ok=message=>({state:s,message,changed:true});
    switch(action.type){
      case 'select':
        if(!inside(s,action.row,action.col))return fail('격자 밖은 선택할 수 없어.');
        s.selected=code(action.row,action.col);
        return ok('케이지 칸 '+(action.row+1)+'행 '+(action.col+1)+'열 선택');
      case 'buy':
        if(!inside(s,row,col))return fail('배치할 수 없는 위치야.');
        if(cage)return fail('이미 케이지가 있는 칸이야.');
        if(s.credits<CAGE_COST)return fail('케이지 구입 비용이 부족해.');
        s.credits-=CAGE_COST;
        s.cages[s.selected]={hunger:50,food:0,name:'새 디지몬'};
        return ok('작은 케이지 배치 완료 · '+CAGE_COST+' Bit (임시)');
      case 'feed':
        if(!cage)return fail('먼저 케이지를 배치해.');
        if(cage.food>0)return fail('놓인 먹이를 먼저 다 먹어야 해.');
        if(s.credits<FOOD_COST)return fail('먹이 비용이 부족해.');
        s.credits-=FOOD_COST;
        s.cages[s.selected]={...cage,food:FOOD_BITES};
        return ok('먹이 배치 · '+FOOD_BITES+'입 남음 (시연 수치)');
      case 'bite':
        if(!cage||cage.food<=0)return fail('먹이가 없어.');
        s.cages[targetKey]={...cage,food:cage.food-1,
          hunger:clamp(cage.hunger-6,0,100)};
        return ok('한 입 먹음 · 남은 먹이 '+s.cages[targetKey].food+'/'+FOOD_BITES);
      case 'train':
        if(!cage)return fail('훈련할 케이지를 선택해.');
        s.training=clamp(s.training+1,0,9999);
        return ok('짧은 훈련 · 능력치 +1 (임시)');
      case 'expand':
        if(s.rows>=MAX_ROWS)return fail('시연용 최대 '+MAX_ROWS+'행까지 확장돼.');
        if(s.credits<ROW_COST)return fail('행 확장 비용이 부족해.');
        s.rows++;s.credits-=ROW_COST;
        return ok('새로운 케이지 행 개방 · '+ROW_COST+' Bit (임시)');
      default:
        return fail('알 수 없는 조작');
    }
  }
  return Object.freeze({COLUMNS,MAX_ROWS,CAGE_COST,ROW_COST,FOOD_COST,
    FOOD_BITES,initial,transition,code,inside});
});
