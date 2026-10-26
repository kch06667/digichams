/* v0.22 gameplay rules: user-design extension, NOT decoded NDS ROM constants. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DCBattleCore=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const TACTICS={balanced:{name:'균형',skillThreshold:1,guard:1,retreat:1,focus:false},aggressive:{name:'공세',skillThreshold:1,guard:.4,retreat:.68,focus:false},defensive:{name:'수비',skillThreshold:1,guard:1.8,retreat:1.5,focus:false},focus:{name:'집중 공격',skillThreshold:1,guard:1,retreat:1,focus:true},conserve:{name:'TP 절약',skillThreshold:1.65,guard:1.15,retreat:1.1,focus:false}};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const tactic=id=>TACTICS[id]||TACTICS.balanced;
 const skillCost=(f,technique)=>technique&&Number.isFinite(technique.cost)?technique.cost:24;
 const tpMaximum=source=>{const proposed=Number(source?.maxTp);return Number.isFinite(proposed)&&proposed>0?Math.round(clamp(proposed,1,9999)):Math.round(clamp(55+Number(source?.spd||10)*.45,35,180));};
 const fighterVitals=source=>{const maxTp=tpMaximum(source);const tp=Number(source?.tp);return {maxTp,tp:Number.isFinite(tp)?clamp(tp,0,maxTp):maxTp};};
 const canUseSkill=(f,technique,tacticId)=>{const c=skillCost(f,technique);return f.hp>0&&f.energy>=99.9&&f.skillCD<=0&&f.cd<=0&&f.tp>=c*(tactic(tacticId).skillThreshold);};
 const target=(actor,opponents,tacticId)=>{const foes=opponents.filter(f=>f.hp>0);if(!foes.length)return null;const policy=tactic(tacticId);return foes.slice().sort((a,b)=>{
  const score=f=>policy.focus? (f.hp/Math.max(1,f.max))*130+Math.hypot(actor.x-f.x,actor.y-f.y)*.40 : Math.hypot(actor.x-f.x,actor.y-f.y)+f.hp*.17;
  return score(a)-score(b);
 })[0]};
 const spendTP=(f,technique,preview=false)=>{const cost=skillCost(f,technique);if(!preview&&f.tp<cost)return false;if(!preview)f.tp=clamp(f.tp-cost,0,f.maxTp);return true;};
 const regainTP=(f,amount)=>{f.tp=clamp(f.tp+amount,0,f.maxTp);return f.tp;};
 return Object.freeze({TACTICS,tactic,skillCost,tpMaximum,fighterVitals,canUseSkill,target,spendTP,regainTP});
});
