'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { build, relocateCssUrls } = require('../tools/build-dev-page.cjs');

test('developer page preserves script/style contents, sequence and original HTML', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'digimon-dev-page-'));
  try {
    const original = '<!doctype html><link href="assets/main.css"><style id="ui">.x{color:red}</style><script id="first">window.order=[1]</script><div id="view"></div><script>window.order.push(2)</script>';
    fs.writeFileSync(path.join(root, 'index.html'), original);
    const result = build({ root });
    assert.equal(result.scripts, 2);
    assert.equal(result.styles, 1);
    const built = fs.readFileSync(path.join(root, 'index.dev.html'), 'utf8');
    assert.match(built, /<div id="view"><\/div>/);
    assert.match(built, /<link href="assets\/main.css">/);
    assert.ok(built.indexOf('script-01-first') < built.indexOf('script-02-inline'));
    assert.equal(fs.readFileSync(path.join(root, '.dev-generated/script-01-first.js'), 'utf8'), 'window.order=[1]');
    assert.equal(fs.readFileSync(path.join(root, '.dev-generated/script-02-inline.js'), 'utf8'), 'window.order.push(2)');
    assert.equal(fs.readFileSync(path.join(root, '.dev-generated/style-01-ui.css'), 'utf8'), '.x{color:red}');
    assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), original);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('non-JavaScript data and externally loaded scripts remain untouched', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'digimon-dev-page-'));
  try {
    const original = '<script type="application/json" id="meta">{"a":1}</script><script src="lib.js"></script><script>hello()</script>';
    fs.writeFileSync(path.join(root, 'index.html'), original);
    const result = build({root});
    assert.equal(result.scripts, 1);
    const built = fs.readFileSync(path.join(root, 'index.dev.html'), 'utf8');
    assert.match(built, /<script type="application\/json" id="meta">\{"a":1\}<\/script>/);
    assert.match(built, /<script src="lib.js"><\/script>/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('externalized CSS preserves image and font relative path semantics', () => {
  assert.equal(relocateCssUrls('.map{background:url("assets/farm.png")}'), '.map{background:url("../assets/farm.png")}');
  assert.equal(relocateCssUrls('@import "theme/base.css";'), '@import "../theme/base.css";');
  assert.equal(relocateCssUrls('.x{background:url(data:image/png;base64,AAA) url(#mask) url(/root.png)}'),
    '.x{background:url(data:image/png;base64,AAA) url(#mask) url(/root.png)}');
});


test('performance monitor is included only in untracked developer HTML', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'digimon-dev-perf-'));
  try {
    const original = '<!doctype html><body><script>window.game = true;</script></body>';
    fs.writeFileSync(path.join(root, 'index.html'), original);
    const result = build({root});
    const page = fs.readFileSync(path.join(root, 'index.dev.html'), 'utf8');
    assert.match(page, /<script defer src="src\/dev-performance-overlay\.js"><\/script>/);
    assert.match(page, /<script defer src="src\/dev-phaser-farm-launch\.js"><\/script>/);
    assert.doesNotMatch(original,/dev-phaser-farm-launch/,
      'playable index.html must remain unchanged');
    assert.match(page, /<\/body>$/);
    assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), original);
    assert.ok(result.developerBytes < result.originalBytes + 200);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
