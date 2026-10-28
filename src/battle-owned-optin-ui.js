/* OPTIONAL_BATTLE_SAVE_V1 — injected ONLY by tools/build-owned-battle-optin.cjs.
 * Inside the original arena closure: uses its state, fighters and UI functions.
 * Never affects the checked-in playable HTML, and starts disabled.
 */
let dcOwnedSaveEnabled=false;
const dcOwnedSaveBox=document.createElement('details');
dcOwnedSaveBox.id='dc-owned-optin';
dcOwnedSaveBox.style.cssText='position:fixed;left:8px;top:8px;z-index:40;max-width:min(310px,90vw);padding:8px 10px;background:#19253c;color:#fff;border:2px solid #7ad7ad;border-radius:10px;font:12px sans-serif;';
dcOwnedSaveBox.innerHTML='<summary style="cursor:pointer">실험적 전투 정산 (기본 꺼짐)</summary>'+
 '<label><input id="dc-owned-optin-enable" type="checkbox"> 새 전투 저장 사용</label>'+
 '<p style="margin:5px 0">선택 시에만 작동. 중단/기권은 기존 방식. 실패 시 백업을 확인하세요.</p>'+
 '<button id="dc-owned-optin-download" type="button">보관된 백업 다운로드</button>'+
 '<p id="dc-owned-optin-status" aria-live="polite">기존 전투 정산 사용 중</p>';
document.body.appendChild(dcOwnedSaveBox);
const dcOwnedCheckbox=dcOwnedSaveBox.querySelector('#dc-owned-optin-enable');
const dcOwnedStatus=dcOwnedSaveBox.querySelector('#dc-owned-optin-status');
dcOwnedCheckbox.addEventListener('change',()=>{
 if(!dcOwnedCheckbox.checked){
   dcOwnedSaveEnabled=false;
   dcOwnedStatus.textContent='기존 전투 정산으로 복귀';
   return;
 }
 try{
   if(!settled)throw Error('전투 도중에는 켤 수 없어. 전투 전에 설정해.');
   DCBattleOwnedOptin.checkpoint(state,localStorage);
   dcOwnedSaveEnabled=true;
   dcOwnedStatus.textContent='다음 정상 종료 전투부터 새 방식 사용';
 }catch(err){
   dcOwnedSaveEnabled=false;dcOwnedCheckbox.checked=false;
   dcOwnedStatus.textContent='사용 불가: '+String(err.message||err);
 }
});
dcOwnedSaveBox.querySelector('#dc-owned-optin-download').addEventListener('click',()=>{
 try{
   const backup=localStorage.getItem(DCBattleOwnedOptin.BACKUP_KEY)||
     localStorage.getItem(DCBattleOwnedOptin.FIRST_BACKUP_KEY);
   if(!backup)throw Error('실험용 백업 없음');
   const url=URL.createObjectURL(new Blob([backup],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;
   link.download='digicham-before-optin.json';
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   dcOwnedStatus.textContent='백업 다운로드 요청 완료';
 }catch(err){dcOwnedStatus.textContent='백업 다운로드 오류: '+String(err.message||err);}
});
function dcTryOwnedCommit(won){
 try{
   const result=DCBattleOwnedOptin.commitFinished(state,{
     won,elapsed,fighters,lookup:speciesLookup
   },localStorage);
   state=result.state;matchState=state;settled=true;
   controlsLocked(false);tournamentMatch=null;
   dcOwnedStatus.textContent='새 전투 정산과 저장 완료';
   render();
 }catch(err){
   // A storage write could have succeeded before verification failed.
   // Never apply the legacy settlement or automatic rollback in that case.
   settled=true;running=false;controlsLocked(false);
   dcOwnedStatus.textContent='새 정산 실패: '+String(err.message||err)+
     ' · 백업 다운로드 후 새로고침해 저장 상태를 확인하세요.';
   toast('전투 저장 확인 실패. 백업을 내려받고 새로고침해.');
 }
}
