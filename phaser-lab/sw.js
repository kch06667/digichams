/* Generated safely by build script; only cache allowlisted procedural demo files. */
'use strict';
const CACHE='digichams-safe-pwa-__BUILD_ID__';
const PREFIX='digichams-safe-pwa-';
const FILES=[
  './','./index.html','./game.js','./logic.js','./domain-bridge.js','./realtime-core.js',
  './farm.html','./farm.js','./farm-model.js',
  './engine-core/battle-core.js','./engine-core/care-core.js',
  './engine-core/championship-core.js','./vendor/phaser.min.js',
  './manifest.webmanifest','./icon.svg','./pwa.js'
];
const allowed=new Set(FILES.map(p=>new URL(p,self.registration.scope).pathname));
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const path of FILES){
      try {
        const url=new URL(path,self.registration.scope);
        const response=await fetch(url,{cache:'reload'});
        if(response.ok)await cache.put(url,response);
      } catch(_) { /* Some files are absent in unbundled local development. */ }
    }
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!allowed.has(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(event.request);
    if(event.request.mode==='navigate'){
      try {
        const response=await fetch(event.request,{cache:'no-store'});
        if(response.ok){await cache.put(event.request,response.clone());return response;}
      }catch(_){}
      return cached||await cache.match(new URL('./index.html',self.registration.scope))||
        Response.error();
    }
    if(cached)return cached;
    try{
      const response=await fetch(event.request);
      if(response.ok)await cache.put(event.request,response.clone());
      return response;
    }catch(_){return Response.error();}
  })());
});
