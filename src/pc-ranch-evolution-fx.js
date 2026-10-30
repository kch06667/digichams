/* PC-only original-GIF evolution transition.
 * Observes the production renderer's existing data-mon changes. Does not
 * alter species, evolution timing, stats, GIF sources or saved game state.
 */
(function(root){
'use strict';
function isSpeciesChange(before,after){
 return typeof before==='string'&&before.length>0&&
  typeof after==='string'&&after.length>0&&before!==after;
}
if(typeof module!=='undefined'&&module.exports)
 module.exports={isSpeciesChange};
if(!root?.document||
 !root.matchMedia?.('(min-width:900px) and (pointer:fine)').matches||
 root.DCRanchEvolutionFX)return;
const world=root.document.querySelector('#farmPanel .farmWorld');
if(!world)return;
const known=new WeakMap();
const timers=new WeakMap();
let transitions=0;
const nodes=()=>[...world.querySelectorAll('.hexActor')].filter(n=>n.parentElement===world);
function remember(actor){
 const name=actor.dataset.mon;
 if(name)known.set(actor,name);
}
for(const node of nodes())remember(node);
function transition(actor,from,to){
 if(!actor.isConnected||actor.parentElement!==world)return;
 if(timers.has(actor))root.clearTimeout(timers.get(actor));
 const label=from.slice(0,28)+' → '+to.slice(0,28);
 actor.dataset.dcEvolutionLabel=label;
 actor.classList.remove('dc-ranch-evolving');
 // Force a new CSS animation when a second evolution occurs in rapid
 // succession, but do not touch the original img/src/GIF animation frames.
 void actor.offsetWidth;
 actor.classList.add('dc-ranch-evolving');
 transitions++;
 timers.set(actor,root.setTimeout(()=>{
  actor.classList.remove('dc-ranch-evolving');
  delete actor.dataset.dcEvolutionLabel;
  timers.delete(actor);
 },1200));
}
const observer=new MutationObserver(changes=>{
 for(const change of changes){
  if(change.type==='attributes'&&change.attributeName==='data-mon'){
   const actor=change.target;
   if(!actor.classList?.contains('hexActor')||actor.parentElement!==world)continue;
   const previous=known.get(actor),current=actor.dataset.mon;
   if(isSpeciesChange(previous,current))transition(actor,previous,current);
   if(current)known.set(actor,current);
  }
 }
 // An imported save remounts actor buttons. New buttons are memorized only:
 // their first draw must not be misidentified as a live evolution event.
 for(const actor of nodes())if(!known.has(actor))remember(actor);
});
observer.observe(world,{subtree:true,childList:true,attributes:true,attributeFilter:['data-mon']});
root.addEventListener('pagehide',()=>{
 observer.disconnect();
 for(const actor of nodes())if(timers.has(actor))root.clearTimeout(timers.get(actor));
},{once:true});
root.DCRanchEvolutionFX=Object.freeze({
 isSpeciesChange,
 get transitions(){return transitions;}
});
})(typeof window!=='undefined'?window:globalThis);
