#!/usr/bin/env node
'use strict';
// Explicit allowlist: never copy proprietary sprite art, ROM files, or the large game HTML.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'phaser-lab');
const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist', 'phaser-preview');
const allow = ['index.html', 'game.js', 'logic.js', 'domain-bridge.js', 'farm.html', 'farm.js', 'farm-model.js'];
const safeCore = ['battle-core.js', 'care-core.js', 'championship-core.js'];
// Deliberately prohibit an output directory inside the source or repo root.
if (output === root || output === source || output.startsWith(source + path.sep)) {
  throw Error('Refusing unsafe preview output directory');
}
fs.rmSync(output, {recursive:true,force:true});
fs.mkdirSync(output, {recursive:true});
for (const file of allow) {
  const input=fs.readFileSync(path.join(source,file));
  if (file==='index.html') {
    const html=input.toString('utf8');
    let safe=html;
    for (const core of safeCore) {
      const from='../src/'+core, to='./engine-core/'+core;
      if (!safe.includes(from)) throw Error('Missing core script in index.html: '+from);
      safe=safe.replace(from,to);
    }
    fs.writeFileSync(path.join(output,file),safe);
  } else fs.writeFileSync(path.join(output,file),input);
}
const coreOut=path.join(output,'engine-core');
fs.mkdirSync(coreOut);
for (const core of safeCore) fs.copyFileSync(
  path.join(root,'src',core),path.join(coreOut,core));
const manifest = {
  build: 'phaser-safe-demo-v1',
  files: [...allow, ...safeCore.map(name=>'engine-core/'+name)],
  explanation: 'Procedural artwork and three allowlisted legacy rule modules only. No ROM, GIF, or extracted artwork.'
};
fs.writeFileSync(path.join(output,'build-info.json'),JSON.stringify(manifest,null,2)+'\n');
const actual=fs.readdirSync(output).sort();
if (actual.some(name=>/\.(?:nds|gif|webp|png|zip)$/i.test(name))) throw Error('Protected asset leaked');
if(fs.readdirSync(coreOut).sort().join(',')!==safeCore.slice().sort().join(',')) throw Error('Unexpected files in core output');
console.log('Safe preview:', output, actual.join(', '));
