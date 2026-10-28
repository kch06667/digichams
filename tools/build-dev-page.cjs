#!/usr/bin/env node
'use strict';

/**
 * Convert the checked-in playable index.html to an untracked, source-equivalent
 * developer entry page. No game-state, source HTML or assets are modified.
 * Generated external classic scripts run in exactly the original source order.
 */
const fs = require('node:fs');
const path = require('node:path');

function relocateCssUrls(css) {
  // An inline <style> resolves relative URLs against the HTML document.
  // An external stylesheet inside .dev-generated/ resolves them from its folder.
  // The ../ prefix restores the original document-relative asset locations.
  const needsPrefix = url => !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(url.trim());
  return css.replace(/url\(\s*(["']?)([^"')]*?)\1\s*\)/gi, (all, quote, raw) =>
    needsPrefix(raw) ? "url(" + quote + "../" + raw + quote + ")" : all
  ).replace(/(@import\s+)(["'])([^"']+)\2/gi, (all, prefix, quote, raw) =>
    needsPrefix(raw) ? prefix + quote + "../" + raw + quote : all
  );
}

function build({root = path.resolve(__dirname, '..'), input = 'index.html'} = {}) {
  const sourceFile = path.join(root, input);
  const outputFile = path.join(root, 'index.dev.html');
  const generatedDir = path.join(root, '.dev-generated');
  if (!fs.existsSync(sourceFile)) throw new Error("Source missing: " + sourceFile);
  const source = fs.readFileSync(sourceFile, 'utf8');
  fs.mkdirSync(generatedDir, { recursive: true });
  const counters = {script: 0, style: 0};
  const written = [];
  const safeSlug = value => (value || '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  const generated = source.replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi,
    (matched, rawType, attributes, contents) => {
      const type = rawType.toLowerCase();
      // Non-JavaScript data, external, async, defer and nomodule tags stay put.
      if (type === 'script' && (/(?:^|\s)(?:src|async|defer|nomodule)\b/i.test(attributes)
         || /\btype\s*=\s*["'](?!text\/javascript|application\/javascript)[^"']+["']/i.test(attributes))) return matched;
      const ordinal = ++counters[type];
      const name = (attributes.match(/\bid\s*=\s*["']([^"']+)["']/i) || [,''])[1];
      const basename = type + '-' + String(ordinal).padStart(2, '0') + '-' + (safeSlug(name) || 'inline') + '.' + (type === 'script' ? 'js' : 'css');
      const relative = ".dev-generated/" + basename;
      fs.writeFileSync(path.join(generatedDir, basename), type === 'style' ? relocateCssUrls(contents) : contents, 'utf8');
      written.push({ type, file: relative, bytes: Buffer.byteLength(contents) });
      return type === 'script'
        ? '<script' + attributes + ' src="' + relative + '"></script>'
        : '<link rel="stylesheet"' + attributes + ' href="' + relative + '">';
    });
  if (counters.script === 0) throw new Error('No inline game scripts found; source structure changed');
  // Opt-in performance overlay is referenced ONLY by generated developer HTML.
  // It does nothing unless ?perf=1 is set in the address bar.
  const diagnosticScript = '<script defer src="src/dev-performance-overlay.js"></script>';
  // Read-only Phaser roster handoff: source exists only in generated dev entry.
  // It is itself inert unless the user visits ?phaserBridge=1.
  const farmHandoffScript = '<script defer src="src/dev-phaser-farm-launch.js"></script>';
  const devScripts = diagnosticScript + '\n' + farmHandoffScript;
  const developerPage = generated.includes('</body>')
    ? generated.replace('</body>', devScripts + '\n</body>')
    : generated + '\n' + devScripts;
  fs.writeFileSync(outputFile, developerPage, 'utf8');
  return { input, output: path.relative(root, outputFile), originalBytes: Buffer.byteLength(source),
           developerBytes: Buffer.byteLength(developerPage), scripts: counters.script, styles: counters.style, files: written };
}

if (require.main === module) {
  try {
    const result = build();
    console.log('Developer page: ' + result.output + ' (' + (result.developerBytes / 1024).toFixed(1) + ' KB; original ' + (result.originalBytes / 1024 / 1024).toFixed(2) + ' MB)');
    console.log('Externalized ' + result.scripts + ' synchronous scripts and ' + result.styles + ' styles. Start an HTTP server and open /index.dev.html');
    console.log('Do not edit generated files: edit checked-in sources, regenerate, and keep production HTML intact.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build, relocateCssUrls };
