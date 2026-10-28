'use strict';
/* Build an optional game copy from the current checked-out main HTML.
 * Do not rewrite index.html or standalone.html or publish generated assets.
 */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const target=path.resolve(process.argv[2]||path.join(root,'dist/battle-optin'));
const all=process.argv.includes('--all');
const modules=[
 'src/battle-settlement-core.js',
 'src/battle-commit-core.js',
 'src/battle-owned-optin.js',
 'src/battle-owned-optin-ui.js'
];
const source=modules.map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
const marker='function settleMatch(won,aborted=false){if(settled)return;';
const replacement=[
 'function settleMatch(won,aborted=false){if(settled)return;',
 ' if(dcOwnedSaveEnabled && ownedMatch && state===matchState && !aborted && finished){',
 '   dcTryOwnedCommit(!!won);return;',
 ' }'
].join('\n');
const names=all?['index.html','standalone.html']:['index.html'];
fs.mkdirSync(target,{recursive:true});
for(const name of names){
 const original=fs.readFileSync(path.join(root,name),'utf8');
 if(original.split(marker).length!==2)
   throw Error(name+': original match settlement entry moved or duplicated');
 if(original.includes('OPTIONAL_BATTLE_SAVE_V1'))
   throw Error(name+': modified output used as source');
 const patched=original.replace(marker,source+'\n'+replacement);
 if(patched===original||!patched.includes('DCBattleOwnedOptin.commitFinished('))
   throw Error(name+': missing optional integration');
 fs.writeFileSync(path.join(target,name),patched);
 console.log('Built optional live-battle game:',name,patched.length,'characters');
}
