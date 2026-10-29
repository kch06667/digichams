#!/usr/bin/env node
'use strict';
/* Build a FULL playable game entry with an explicit, default-OFF Phaser
 * engine chooser. It never edits the 6MB source index.html or standalone.
 * Because the opt-in HTML stays at the repository root, all old relative
 * asset paths and original inline JS execute without relocation.
 */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const modules=[
  'src/battle-settlement-core.js',
  'src/battle-commit-core.js',
  'src/dev-phaser-commit.js',
  'src/dev-phaser-farm-launch.js',
  'src/phaser-arena-entry-choice.js'
];
function build({rootDir=root}={}){
  const sourcePath=path.join(rootDir,'index.html');
  const outputPath=path.join(rootDir,'index.phaser.html');
  const source=require('./phaser-production-entry.cjs').strip(fs.readFileSync(sourcePath,'utf8'));
  if(source.split('id="lbStart"').length!==2||
     source.split("el('lbStart').onclick=()=>start(false);").length!==2||
     !source.includes('id="lbMode"')||
     !source.includes('id="lbTeamSize"')||
     !source.includes('function settleMatch(')||
     !source.includes('<script id="championship-core-v023">')||
     !source.includes("window.DCBattleArena={launchTournament(")||
     source.split('</body>').length!==2||
     source.includes('src/phaser-arena-entry-choice.js'))
    throw Error('Original battle entry changed: refuse to generate optional entry');
  const includes=modules.map(file=>{
    if(!fs.existsSync(path.join(rootDir,file)))
      throw Error('Missing opt-in source: '+file);
    return '<script defer src="'+file+'"></script>';
  }).join('\n');
  const result=source.replace('</body>',includes+'\n</body>');
  fs.writeFileSync(outputPath,result,'utf8');
  return {path:outputPath,originalBytes:Buffer.byteLength(source),
    outputBytes:Buffer.byteLength(result),moduleCount:modules.length};
}
if(require.main===module){
  try{
    const output=build();
    console.log('Opt-in playable original arena:',output.path,
      'extra bytes:',output.outputBytes-output.originalBytes,
      'scripts:',output.moduleCount);
    console.log('Serve project root; use /index.phaser.html?phaserBattle=1');
  }catch(err){console.error(err.message);process.exitCode=1;}
}
module.exports={build};
