/* PC-only ranch GIF recovery: never replace one Digimon with another.
 * The canonical spriteUrl(), species names, battle and farm animation
 * state are untouched. This only repairs an <img> after a failed load.
 */
(function(root){
'use strict';
function fallbackUrlFor(url){
 if(typeof url!=='string'||!/(?:^|\/)assets\/sprites\//.test(url))return null;
 const match=url.match(/_(\d{1,2})(\.gif)([?#].*)?$/i);
 if(!match||Number(match[1])===0)return null;
 return url.slice(0,match.index)+'_0'+match[2]+(match[3]||'');
}
if(typeof module!=='undefined'&&module.exports)
 module.exports={fallbackUrlFor};
if(!root?.document||
 !root.matchMedia?.('(min-width:900px) and (pointer:fine)').matches||
 root.DCRanchSpriteGuard)return;
const world=root.document.querySelector('#farmPanel .farmWorld');
if(!world)return;
let recovered=0,missing=0;
function sourceIsFarmSprite(img){
 return img?.tagName==='IMG'&&img.parentElement?.classList?.contains('hexActor')&&
   img.parentElement.parentElement===world;
}
function onError(event){
 const img=event.target;
 if(!sourceIsFarmSprite(img))return;
 const actor=img.parentElement,failed=img.getAttribute('src')||'';
 // If a GIF index is absent, retry only frame 0 from the SAME species stem.
 // No other species, SVG placeholder, stock image or outside URL.
 const alternate=fallbackUrlFor(failed);
 if(alternate && img.dataset.dcRanchTried!==alternate){
  img.dataset.dcRanchTried=alternate;
  actor.dataset.dcSpriteRecovery='retry-idle';
  recovered++;
  img.src=alternate;return;
 }
 // If even the species' idle GIF is missing, hide the broken-image icon.
 // The existing named selectable actor remains, with a diagnostic.
 img.style.visibility='hidden';
 actor.dataset.dcSpriteRecovery='missing';
 actor.title=(actor.dataset.mon||actor.querySelector('span')?.textContent||'디지몬')+
   ' · 도트 파일을 불러올 수 없음';
 missing++;
}
function onLoad(event){
 const img=event.target;
 if(!sourceIsFarmSprite(img))return;
 const actor=img.parentElement;
 img.style.removeProperty('visibility');
 if(actor.dataset.dcSpriteRecovery==='missing'){
  delete actor.dataset.dcSpriteRecovery;
  actor.title=(actor.dataset.mon||'디지몬')+' 선택';
 }
 // Leave retry-idle as readable diagnostics, but no game state changes.
 // A later normal frame source replaces the fallback on original renderer cue.
}
world.addEventListener('error',onError,true);
world.addEventListener('load',onLoad,true);
root.DCRanchSpriteGuard=Object.freeze({
 fallbackUrlFor,
 get recovered(){return recovered;},
 get missing(){return missing;}
});
})(typeof window!=='undefined'?window:globalThis);
