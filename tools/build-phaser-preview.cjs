#!/usr/bin/env node
'use strict';
// Explicit allowlist: never copy proprietary sprite art, ROM files, or the large game HTML.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'phaser-lab');
const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist', 'phaser-preview');
const allow = ['index.html', 'game.js', 'logic.js'];
// Deliberately prohibit an output directory inside the source or repo root.
if (output === root || output === source || output.startsWith(source + path.sep)) {
  throw Error('Refusing unsafe preview output directory');
}
fs.rmSync(output, {recursive:true,force:true});
fs.mkdirSync(output, {recursive:true});
for (const file of allow) fs.copyFileSync(path.join(source,file),path.join(output,file));
const manifest = {
  build: 'phaser-safe-demo-v1',
  files: allow,
  explanation: 'Only procedural test graphics. No ROM, GIF, or extracted artwork.'
};
fs.writeFileSync(path.join(output,'build-info.json'),JSON.stringify(manifest,null,2)+'\n');
const actual=fs.readdirSync(output).sort();
if (actual.some(name=>/\.(?:nds|gif|webp|png|zip)$/i.test(name))) throw Error('Protected asset leaked');
console.log('Safe preview:', output, actual.join(', '));
