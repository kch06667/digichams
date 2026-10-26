/* Digimon World Championship v0.20 care and seasons. 4 seasons x 30 days, chance,
 * treatment prices, and training multipliers are provisional until ROM validation.
 * Documented in DW Championship FAQ: summer favors gain, winter favors loss;
 * injuries count 1 penalty, sickness counts 2; penalties reset on evolution.
 */
(function(root){'use strict';
const SEASONS=['봄','여름','가을','겨울'];
const CONFIG={daysPerSeason:30,injuryPrice:30,illnessPrice:50,clinicPrice:80,
 gain:{'봄':1,'여름':1.5,'가을':1,'겨울':.5},loss:{'봄':1,'여름':.5,'가을':1,'겨울':1.5},
 injuredTrainingChance:.15,illnessHungerThreshold:90};
function season(day){const index=Math.floor((Math.max(1,Number(day)||1)-1)/CONFIG.daysPerSeason)%4;return SEASONS[index];}
function ensureMon(m){if(!m||typeof m!=='object')return m;
 m.care??={};const c=m.care;
 c.injured=!!c.injured;c.sick=!!c.sick;
 c.injuryDays=Math.max(0,Math.floor(Number(c.injuryDays)||0));
 c.sickDays=Math.max(0,Math.floor(Number(c.sickDays)||0));
 c.injuryCount=Math.max(0,Math.floor(Number(c.injuryCount)||0));
 c.illnessCount=Math.max(0,Math.floor(Number(c.illnessCount)||0));
 c.treatments=Math.max(0,Math.floor(Number(c.treatments)||0));
 return m;
}
function ensure(s){for(const m of s.team||[])ensureMon(m);return s;}
function rnd(s){s.world??={};const previous=Number.isFinite(s.world.careSeed)?s.world.careSeed:0x5eed;
 s.world.careSeed=(Math.imul(previous,1664525)+1013904223)>>>0;return s.world.careSeed/4294967296;}
function log(s,msg){s.logs??=[];s.logs.unshift('[육성] '+msg);s.logs.length=Math.min(60,s.logs.length);}
function suffer(s,m,kind){ensureMon(m);if(!m.evo&&root.DCEvolution?.ensureMon)root.DCEvolution.ensureMon(m);const c=m.care;
 if(kind==='injury'){
  if(c.injured)return false;c.injured=true;c.injuryDays=0;c.injuryCount++;
  if(m.evo)m.evo.penalties=(Number(m.evo.penalties)||0)+1;
  log(s,m.name+'이(가) 부상당했어! (진화 육성 패널티 +1)');return true;
 }
 if(kind==='sickness'){
  if(c.sick)return false;c.sick=true;c.sickDays=0;c.illnessCount++;
  if(m.evo)m.evo.penalties=(Number(m.evo.penalties)||0)+2;
  log(s,m.name+'이(가) 병에 걸렸어! (진화 육성 패널티 +2)');return true;
 }
 return false;
}
function effect(day){const phase=season(day);return {season:phase,gain:CONFIG.gain[phase],loss:CONFIG.loss[phase]};}
function statGain(day,base){const e=effect(day);return Math.max(1,Math.round(base*e.gain));}
function statLoss(day,base){const e=effect(day);return Math.max(0,e.loss<1?Math.floor(base*e.loss):Math.ceil(base*e.loss));}
function afterTraining(s,m){ensureMon(m);
 if(m.care.sick||m.care.injured)return;
 // Overwork / existing strain increase chance; determined by saved PRNG seed.
 if((Number(m.fatigue)||0)>=60){let chance=CONFIG.injuredTrainingChance;
  if(season(s.day)==='겨울')chance+=.10;
  if((Number(m.hp)||0)<(Number(m.maxHp)||1)*.3)chance+=.08;
  if(rnd(s)<chance)suffer(s,m,'injury');
 }
}
function advanceDays(s,days){ensure(s);
 for(let n=0;n<Math.min(365,Math.max(0,Math.floor(days)));n++){
  for(const m of s.team||[]){if(m.location==='storage'||m.egg||m.lost)continue;
   const c=m.care;
   if(c.injured){c.injuryDays++;if(c.injuryDays>=2&&!c.sick)suffer(s,m,'sickness');}
   if(c.sick)c.sickDays++;
   if(Number(m.hunger)>=CONFIG.illnessHungerThreshold&&!c.sick)suffer(s,m,'sickness');
  }
 }
}
function treat(s,m,kind,discount=false){ensureMon(m);if(!m||m.egg||m.location==='storage'||m.lost)return {ok:false,reason:'unavailable'};
 const c=m.care;
 const price=discount?0:kind==='injury'?CONFIG.injuryPrice:kind==='sickness'?CONFIG.illnessPrice:CONFIG.clinicPrice;
 if(kind==='injury'&&!c.injured)return {ok:false,reason:'not-injured'};
 if(kind==='sickness'&&!c.sick)return {ok:false,reason:'not-sick'};
 if(kind==='clinic'&&!c.injured&&!c.sick&&m.hp>=m.maxHp)return {ok:false,reason:'already-healthy'};
 if(!['injury','sickness','clinic'].includes(kind))return {ok:false,reason:'invalid'};
 if((s.facilityCredits||0)<price)return {ok:false,reason:'credits',price};
 s.facilityCredits-=price;
 if(kind==='injury'||kind==='clinic'){c.injured=false;c.injuryDays=0;}
 if(kind==='sickness'||kind==='clinic'){c.sick=false;c.sickDays=0;}
 if(kind==='clinic')m.hp=m.maxHp;
 c.treatments++;log(s,m.name+' '+({injury:'붕대',sickness:'약',clinic:'치료 에리어'}[kind])+' 치료 완료 (-'+price+' Bit).');
 // Treatment never erases previously incurred evolution penalties.
 return {ok:true,price};
}
const api={SEASONS,CONFIG,season,ensureMon,ensure,effect,statGain,statLoss,suffer,afterTraining,advanceDays,treat};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.DCCare=api;
})(typeof globalThis!=='undefined'?globalThis:this);
