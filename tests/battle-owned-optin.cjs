'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const Optin=require('../src/battle-owned-optin.js');
const Commit=require('../src/battle-commit-core.js');

function sample(size=1,missingTp=false){
 const team=Array.from({length:size},(_,i)=>({
   instanceId:'id-'+i,name:'아구몬',stage:'성장기',
   hp:120,maxHp:140,atk:50,def:25,spd:38,level:1,exp:0,
   friendship:20,hunger:20,fatigue:10,
   ...(missingTp?{}:{tp:80,maxTp:95}),evo:{battles:0,wins:0}
 }));
 const state={saveVersion:4,day:3,wins:0,losses:0,points:1,logs:[],
   team,pendingBattle:{id:'optin-live-1',participants:team.map(m=>m.instanceId)}};
 const fighters=[
   ...team.map((m,i)=>({
     name:m.name,side:0,slot:i,instanceId:m.instanceId,
     hp:90-i*6,max:140,tp:40+i,maxTp:95
   })),
   ...team.map((m,i)=>({
     name:'상대',side:1,slot:i,hp:0,max:110,tp:8,maxTp:95
   }))
 ];
 return {state,args:{won:true,elapsed:31,fighters,lookup:()=>null}};
}
function storage(raw,{denyBackup=false,denySave=false}={}){
 const data=new Map([[Commit.SAVE_KEY,raw]]);
 let saveWrites=0;
 return {
   getItem:k=>data.has(k)?data.get(k):null,
   setItem(k,v){
     if(denyBackup&&k!==Commit.SAVE_KEY)throw Error('Backup quota denied');
     if(denySave&&k===Commit.SAVE_KEY)throw Error('Save quota denied');
     if(k===Commit.SAVE_KEY)saveWrites++;
     data.set(k,v);
   },
   get saved(){return data.get(Commit.SAVE_KEY);},
   get count(){return saveWrites;}
 };
}
test('default-off modules can commit a complete owned 1v1 result only after two verified backups',()=>{
 const {state,args}=sample(),old=JSON.stringify(state),s=storage(old);
 const done=Optin.commitFinished(state,args,s);
 assert.equal(s.count,1);
 assert.equal(JSON.stringify(state),old);
 assert.equal(s.getItem(Optin.FIRST_BACKUP_KEY),old);
 assert.equal(s.getItem(Optin.BACKUP_KEY),old);
 assert.equal(s.saved,JSON.stringify(done.state));
 assert.equal(done.state.pendingBattle,undefined);
 assert.equal(done.state.team[0].hp,90);
 assert.equal(done.state.team[0].tp,40);
 assert.equal(done.state.wins,1);
 assert.equal(done.state.points,3);
 assert.equal(done.receipt.won,true);
 assert.match(done.state.logs[0],/승리/);
 assert.throws(()=>Optin.commitFinished(state,args,s),/synchronized/);
});
test('same-species 2v2 uses slots for stable IDs, not team names',()=>{
 const {state,args}=sample(2),s=storage(JSON.stringify(state));
 const result=Optin.commitFinished(state,args,s);
 assert.equal(result.receipt.participants.length,2);
 assert.deepEqual(result.receipt.participants,['id-0','id-1']);
 assert.deepEqual(result.state.team.map(m=>m.hp),[90,84]);
 assert.equal(result.state.team[1].tp,41);
});
test('legacy monster without tp fields can be staged, without changing pre-battle save',()=>{
 const {state,args}=sample(1,true),old=JSON.stringify(state),s=storage(old);
 const result=Optin.commitFinished(state,args,s);
 assert.equal(result.state.team[0].tp,40);
 assert.equal(result.state.team[0].maxTp,95);
 assert.equal(s.getItem(Optin.BACKUP_KEY),old);
 assert.equal(JSON.stringify(state),old);
});
test('missing checkpoint, denied backup and denied save all prevent unsafe adoption',()=>{
 const {state,args}=sample(),raw=JSON.stringify(state);
 const stale=storage('{"newer":true}');
 assert.throws(()=>Optin.commitFinished(state,args,stale),/synchronized/);
 assert.equal(stale.count,0);
 const backupDenied=storage(raw,{denyBackup:true});
 assert.throws(()=>Optin.commitFinished(state,args,backupDenied),/Backup quota denied/);
 assert.equal(backupDenied.count,0);
 assert.equal(backupDenied.saved,raw);
 const saveDenied=storage(raw,{denySave:true});
 assert.throws(()=>Optin.commitFinished(state,args,saveDenied),/Save quota denied/);
 assert.equal(saveDenied.count,0);
 assert.equal(saveDenied.saved,raw);
 assert.equal(JSON.stringify(state),raw);
});
test('opt-in page generator leaves both original HTML files unchanged',()=>{
 const root=path.join(__dirname,'..');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'digicham-optin-'));
 try{
   const inputs=['index.html','standalone.html'];
   const original=inputs.map(p=>fs.statSync(path.join(root,p)).size);
   cp.execFileSync(process.execPath,[path.join(root,'tools/build-owned-battle-optin.cjs'),tmp,'--all'],{timeout:60000});
   for(let i=0;i<inputs.length;i++){
     const name=inputs[i];
     const html=fs.readFileSync(path.join(tmp,name),'utf8');
     assert.match(html,/OPTIONAL_BATTLE_SAVE_V1/);
     assert.match(html,/dcOwnedSaveEnabled=false/);
     assert.match(html,/dcTryOwnedCommit\(!!won\);return;/);
     assert.match(html,/function settleMatch\(won,aborted=false\)/);
     assert.ok(Buffer.byteLength(html,'utf8')>original[i]);
     assert.equal(fs.statSync(path.join(root,name)).size,original[i]);
   }
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
