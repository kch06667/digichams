#!/usr/bin/env node
'use strict';
// An explicit safe-deployment allowlist. Never publish original ROM or sprite art.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=path.join(root,'phaser-lab');
const output=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'dist','phaser-preview');
const allow=['index.html','game.js','logic.js','domain-bridge.js','arena-techniques.js','private-art-loader.js','realtime-core.js',
  'farm.html','farm.js','farm-model.js','manifest.webmanifest','icon.svg','pwa.js','sw.js'];
const safeCore=['battle-core.js','arena-navigation-core.js','care-core.js','championship-core.js'];
const cdn='https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js';
const phaserDir=path.join(root,'node_modules','phaser');
const phaserDist=path.join(phaserDir,'dist','phaser.min.js');
const phaserLicense=['LICENSE.md','LICENSE','LICENSE.txt'].map(x=>path.join(phaserDir,x))
  .find(file=>fs.existsSync(file));
const vendor=fs.existsSync(phaserDist);
if(vendor&&!phaserLicense)throw Error('Phaser license missing: cannot vend library');
if(output===root||output===source||output.startsWith(source+path.sep))throw Error('Unsafe preview output');
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
const buildId=(process.env.GITHUB_SHA||'local-dev-v1').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,24);
for(const file of allow){
  const raw=fs.readFileSync(path.join(source,file),'utf8');
  let safe=raw;
  if(file==='index.html'||file==='farm.html'){
    for(const core of safeCore){
      const from='../src/'+core,to='./engine-core/'+core;
      if(!safe.includes(from))throw Error('Missing core script: '+from);
      safe=safe.replace(from,to);
    }
  }
  if((file==='index.html'||file==='farm.html')&&vendor){
    if(!safe.includes(cdn))throw Error('Expected pinned Phaser CDN script');
    safe=safe.replace(cdn,'./vendor/phaser.min.js');
  }
  if(file==='sw.js'){
    if(!safe.includes('__BUILD_ID__'))throw Error('Missing service worker build marker');
    safe=safe.replace('__BUILD_ID__',buildId);
  }
  fs.writeFileSync(path.join(output,file),safe);
}
const coreOut=path.join(output,'engine-core');
fs.mkdirSync(coreOut);
for(const core of safeCore)fs.copyFileSync(path.join(root,'src',core),path.join(coreOut,core));
const optional=[];
if(vendor){
  const folder=path.join(output,'vendor');
  fs.mkdirSync(folder);
  fs.copyFileSync(phaserDist,path.join(folder,'phaser.min.js'));
  fs.copyFileSync(phaserLicense,path.join(folder,'PHASER_LICENSE.txt'));
  optional.push('vendor/phaser.min.js','vendor/PHASER_LICENSE.txt');
}
const info={
  build:'phaser-safe-pwa-'+buildId,
  files:[...allow,...safeCore.map(x=>'engine-core/'+x),...optional],
  originalArt:false,
  offlineEngine:vendor,
  explanation:'Only procedurally drawn lab art, three original project JS rule modules and optional MIT-licensed Phaser.'
};
fs.writeFileSync(path.join(output,'build-info.json'),JSON.stringify(info,null,2)+'\n');
const actual=fs.readdirSync(output).sort();
if(actual.some(file=>/\.(?:nds|gif|webp|png|zip)$/i.test(file)))throw Error('Protected asset leaked');
if(fs.readdirSync(coreOut).sort().join(',')!==safeCore.slice().sort().join(','))
  throw Error('Unexpected files in core output');
console.log('Safe preview:',output,actual.join(', '),'vendor:',vendor);
