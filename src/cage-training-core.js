/* Digimon World Championship training cages v0.19.
 * PRIMARY CAGE EFFECTS: hemlock86 GameFAQs #54306 and FAQ #45836974.
 * AP value per completed cycle, costs, prerequisites, stat/resistance magnitudes:
 * provisional extension balance, NOT decoded from ROM.
 * Hidden family/attribute evolution affinity is NOT the visible elemental AP resistance.
 */
(function(root){'use strict';
const SOURCE='https://gamefaqs.gamespot.com/ds/943756-digimon-world-championship/faqs/54306';
const FAMILY_LABELS={dragon:'용족',beast:'짐승',bird:'조류',water:'수중',insect:'곤충·식물',machine:'기계',darkness:'암흑',holy:'신성',data:'데이터',virus:'바이러스',vaccine:'백신'};
const ELEMENT_LABELS={heat:'열',cold:'냉기',lightning:'번개',light:'빛',dark:'어둠'};
const CAGES=[
 {id:'miniVolcano',label:'미니 화산',type:'용족 훈련',cost:160,rank:0,day:2,ap:{dragon:2},stat:'atk',element:{heat:1},description:'용족 AP · 공격력 · 열 저항'},
 {id:'grassland',label:'초원',type:'짐승 훈련',cost:180,rank:0,day:2,ap:{beast:2},stat:'spd',description:'짐승 AP · 속도'},
 {id:'highMountain',label:'높은 산',type:'조류 훈련',cost:240,rank:1,day:3,ap:{bird:2},stat:'spd',description:'조류 AP · 속도'},
 {id:'beach',label:'해변',type:'수중 훈련',cost:180,rank:0,day:2,ap:{water:2},element:{cold:1},description:'수중 AP · 냉기 저항'},
 {id:'forest',label:'숲',type:'곤충·식물 훈련',cost:200,rank:0,day:2,ap:{insect:2,bird:1},stat:'wis',description:'곤충·식물 AP · 조류 AP · 지능'},
 {id:'factory',label:'공장',type:'기계 훈련',cost:280,rank:1,day:3,ap:{machine:2,data:1},element:{lightning:1},description:'기계 AP · 데이터 AP · 번개 저항'},
 {id:'graveyard',label:'묘지',type:'암흑 훈련',cost:280,rank:1,day:3,ap:{darkness:2,virus:1},element:{dark:1},description:'암흑 AP · 바이러스 AP · 어둠 저항'},
 {id:'flowerGarden',label:'꽃밭',type:'신성 훈련',cost:280,rank:1,day:3,ap:{holy:2,vaccine:1},description:'신성 AP · 백신 AP'},
 {id:'laboratory',label:'연구소',type:'데이터 훈련',cost:420,rank:2,day:5,ap:{data:2},stat:'wis',description:'데이터 AP · 지능'},
 {id:'evilRoom',label:'마의 방',type:'바이러스 훈련',cost:420,rank:2,day:5,ap:{virus:2,darkness:1},element:{dark:1},description:'바이러스 AP · 암흑 AP · 어둠 저항'},
 {id:'dojo',label:'도장',type:'백신 훈련',cost:350,rank:1,day:3,ap:{vaccine:2,holy:1},description:'백신 AP · 신성 AP'}
];
const MAP=Object.fromEntries(CAGES.map(c=>[c.id,c]));
const BASE={attack:{ap:{machine:2,data:1},name:'미니 체육관'},defense:{ap:{insect:2},element:{dark:1},name:'공터'},speed:{ap:{beast:2},name:'미니 운동장'}};
const CYCLE_AP=2;
const rank=(s)=>{const w=s.wins||0,d=s.day||1,n=s.team?.length||0;return w>=9&&d>=10&&n>=3?3:w>=5&&d>=5&&n>=2?2:w>=2&&d>=3?1:0;};
function ensure(s){if(!s.cageFacilities||typeof s.cageFacilities!=='object'||Array.isArray(s.cageFacilities))s.cageFacilities={};return s.cageFacilities;}
function info(s,id){const c=MAP[id];if(!c)return null;ensure(s);const needs=[];
 if(!s.facilities?.training)needs.push('특별 훈련장 건설');
 if((s.day||1)<c.day)needs.push('DAY '+c.day);
 if(rank(s)<c.rank)needs.push('테이머 등급 '+c.rank+' 필요');
 return {...c,owned:!!s.cageFacilities[id],needs,affordable:(s.facilityCredits||0)>=c.cost};}
function owned(s,id){return !!MAP[id]&&!!ensure(s)[id]&&!!s.facilities?.training;}
function buy(s,id){const c=info(s,id);if(!c||c.owned||c.needs.length||!c.affordable)return false;
 s.facilityCredits-=c.cost;s.cageFacilities[id]=true;return true;}
function effect(s,kind,zone,cageId){if(kind==='cage')return owned(s,cageId)?MAP[cageId]:null;
 if(!BASE[kind])return null;
 // Dedicated Gym and Track produce basic physical stats; no invented dragon AP from 'training' tile.
 if(zone==='training'&&kind==='attack')return {name:'체육관',ap:{}};
 if(zone==='training'&&kind==='defense')return {name:'체육관',ap:{}};
 if(zone==='track'&&kind==='speed')return {name:'운동장',ap:{}};
 return BASE[kind];}
const api={SOURCE,FAMILY_LABELS,ELEMENT_LABELS,CAGES,MAP,BASE,CYCLE_AP,rank,ensure,info,owned,buy,effect};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.DCCages=api;
})(typeof globalThis!=='undefined'?globalThis:this);
