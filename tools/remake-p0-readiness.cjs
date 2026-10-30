#!/usr/bin/env node
'use strict';
// Read-only preflight for the ORIGINAL remake project. No ROM/saves are opened.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const PHASER_SHA='e92ddef111ba42e92d316979c732311757093688ea1810591cb7aa2858eba7a7';
const required={
  game:'index.html',backupEntry:'standalone.html',windowsLauncher:'PLAY_ON_PC.bat',
  localServer:'tools/play_local.py',phaserPage:'phaser-lab/index.html',
  savedJourneyTest:'tests/pc-complete-phaser-journey-browser.py',
  offlineBattleTest:'tests/pc-offline-phaser-soak-browser.py'
};
function exists(root,file){return fs.existsSync(path.join(root,file));}
function content(root,file){return exists(root,file)?fs.readFileSync(path.join(root,file),'utf8'):'';}
function analyze(root=path.resolve(__dirname,'..'),opts={}){
  const files=Object.fromEntries(Object.entries(required).map(([key,file])=>[key,exists(root,file)]));
  const win=content(root,required.windowsLauncher);
  const server=content(root,required.localServer);
  const phaser=content(root,required.phaserPage);
  const enginePath=path.join(root,'phaser-lab/local-assets/vendor/phaser.min.js');
  let engine='not-cached';
  if(fs.existsSync(enginePath)){
    const bytes=fs.readFileSync(enginePath);
    engine=bytes.length>0&&crypto.createHash('sha256').update(bytes).digest('hex')===(opts.engineSha||PHASER_SHA)?'verified':'invalid-sha256';
  }
  const launcherReferencesServer=/tools\\play_local\.py|tools\/play_local\.py/.test(win);
  const serverRewritesPhaser=server.includes('PHASER_URL')&&server.includes('replace(PHASER_URL,')&&server.includes('/phaser-lab/');
  const labUsesRemoteScript=/https:\/\/cdn\.jsdelivr\.net\/npm\/phaser@3\.90\.0\/dist\/phaser\.min\.js/.test(phaser);
  const electron=exists(root,'desktop/package.json')&&
    (exists(root,'desktop/index.js')||exists(root,'desktop/main.js'));
  const blockers=[];
  for(const [key,available]of Object.entries(files))if(!available)blockers.push('missing:'+required[key]);
  if(files.windowsLauncher&&!launcherReferencesServer)blockers.push('launcher-does-not-reference-local-server');
  if(files.phaserPage&&!labUsesRemoteScript)blockers.push('unexpected-phaser-page-engine-source');
  if(files.localServer&&!serverRewritesPhaser)blockers.push('local-server-phaser-rewrite-not-detected');
  if(engine==='invalid-sha256')blockers.push('phaser-cache-integrity-failed');
  if(!electron)blockers.push('windows-electron-exe-source-not-in-repo');
  return {
    format:'digichams-remake-p0-preflight-v1',
    root:path.resolve(root),
    files,
    launch:{kind:files.windowsLauncher&&launcherReferencesServer?'windows-batch-local-browser':'unknown',
      electronExeSourcePresent:electron,localServerPhaserRewriteDetected:serverRewritesPhaser,
      phaserLabReferencesCdnDirectly:labUsesRemoteScript,verifiedPhaserCache:engine},
    status:blockers.length?'not-first-play-ready':'preflight-only-passed',
    blockers,
    limitations:[
      'Static preflight only: does not prove UI, original ROM parity, live battle, save integrity or successful Windows execution.',
      'Missing local Phaser cache may be repaired on first launcher run if verified network/npm source exists.',
      'Node diagnostic does not download files, edit game saves, extract ROM or start a server.'
    ]
  };
}
function main(argv=process.argv.slice(2)){
  const strict=argv.includes('--strict-first-play');
  const args=argv.filter(x=>x!=='--strict-first-play');
  const report=analyze(args[0]?path.resolve(args[0]):path.resolve(__dirname,'..'));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(strict&&report.status!=='preflight-only-passed')process.exitCode=1;
  return report;
}
if(require.main===module)main();
module.exports={analyze,main,PHASER_SHA};
