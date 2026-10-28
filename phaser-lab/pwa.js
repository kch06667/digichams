/* Optional install/update support for the safe Phaser preview only. */
(() => {
 'use strict';
 const info=document.getElementById('pwaStatus');
 const update=document.getElementById('updateBtn');
 if(!info||!update||!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol))return;
 let registration=null,hadController=!!navigator.serviceWorker.controller,refreshing=false;
 function announce(worker){
   if(!worker)return;
   info.textContent='새 테스트 버전이 준비됐어. 게임을 저장한 뒤 업데이트를 적용해.';
   update.hidden=false;
   update.onclick=()=>worker.postMessage({type:'ACTIVATE_UPDATE'});
 }
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
   if(hadController&&!refreshing){refreshing=true;location.reload();}
   hadController=true;
 });
 navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(reg=>{
   registration=reg;
   if(reg.waiting&&navigator.serviceWorker.controller)announce(reg.waiting);
   reg.addEventListener('updatefound',()=>{
     const worker=reg.installing;
     if(!worker)return;
     worker.addEventListener('statechange',()=>{
       if(worker.state==='installed'&&navigator.serviceWorker.controller)announce(worker);
     });
   });
 }).catch(()=>{info.textContent='설치형 업데이트를 사용하지 못해도 브라우저 플레이는 가능해.';});
 window.DigiPwaStatus=()=>({registered:!!registration,
   waiting:!!registration?.waiting,controlled:!!navigator.serviceWorker.controller});
})();
