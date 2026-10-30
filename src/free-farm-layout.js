/* Free placement farm blueprint v1. Separate from the legacy hex farm until runtime migration. */
(function(root){
'use strict';
const WIDTH=1920,HEIGHT=1200,MARGIN=40;
const SIZES=Object.freeze({training:[160,140],rest:[150,130],food:[96,80],tree:[95,105],pond:[205,150],path:[100,75]});
const DEFAULT=Object.freeze([{id:1,kind:'training',x:540,y:410},{id:2,kind:'rest',x:850,y:660},{id:3,kind:'food',x:470,y:720},{id:4,kind:'tree',x:400,y:210},{id:5,kind:'tree',x:1160,y:260},{id:6,kind:'pond',x:1360,y:690}]);
function rectangle(o){const size=SIZES[o.kind];if(!size)return null;return {l:o.x-size[0]/2,r:o.x+size[0]/2,t:o.y-size[1]/2,b:o.y+size[1]/2};}
function isValidObject(o){return o&&Number.isSafeInteger(o.id)&&o.id>0&&SIZES[o.kind]&&Number.isFinite(o.x)&&Number.isFinite(o.y);}
function valid(objects,o,skipId=null){if(!isValidObject(o))return false;const r=rectangle(o);if(r.l<MARGIN||r.t<MARGIN||r.r>WIDTH-MARGIN||r.b>HEIGHT-MARGIN)return false;return !objects.some(other=>other.id!==skipId&&other.id!==o.id&&(()=>{const b=rectangle(other);return b&&r.l<b.r+12&&r.r>b.l-12&&r.t<b.b+12&&r.b>b.t-12;})());}
function validate(objects){if(!Array.isArray(objects)||objects.length>300)return false;const seen=new Set(),added=[];for(const o of objects){if(!isValidObject(o)||seen.has(o.id)||!valid(added,o)){return false;}seen.add(o.id);added.push(o);}return true;}
function initial(){return DEFAULT.map(x=>({...x}));}
function fromJSON(input){const source=typeof input==='string'?JSON.parse(input):input;if(!source||source.format!=='digichams-free-farm-layout'||!validate(source.objects))throw new Error('Invalid free farm blueprint');return source.objects.map(o=>({id:o.id,kind:o.kind,x:o.x,y:o.y}));}
function serialize(objects){if(!validate(objects))throw new Error('Invalid free farm placement');return {format:'digichams-free-farm-layout',version:2,world:{width:WIDTH,height:HEIGHT},objects:objects.map(o=>({...o}))};}
function rosterFromSave(save){const team=Array.isArray(save?.team)?save.team:Array.isArray(save?.state?.team)?save.state.team:[];return team.filter(m=>m&&!m.egg&&!m.lost&&m.location!=='storage').map(m=>({id:m.instanceId||null,name:String(m.name||m.species||'디지몬')}));}
const api={WIDTH,HEIGHT,SIZES,DEFAULT,initial,rectangle,valid,validate,fromJSON,serialize,rosterFromSave};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.DCFreeFarm=api;
})(typeof globalThis!=='undefined'?globalThis:this);
