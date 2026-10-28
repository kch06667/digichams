/* Independent rendering contract; no save-state mutations. CommonJS + browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DigiPhaserLabLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function () {
  'use strict';
  const ACTION = Object.freeze({
    idle: 0, walk: 2, run: 3, hit: 5, attack: 7,
    eat: 14, victory: 30, training: 32, ko: 37
  });
  const STATES = Object.freeze({
    idle: 'idle', moving: 'walk', attacking: 'attack',
    hit: 'hit', victory: 'victory', training: 'training'
  });
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function selectAction(state) {
    return ACTION[STATES[state] || 'idle'];
  }

  function validateManifest(manifest) {
    if (!manifest || typeof manifest !== 'object' || !manifest.actions ||
        typeof manifest.actions !== 'object' || Array.isArray(manifest.actions)) return false;
    for (const [id, sheet] of Object.entries(manifest.actions)) {
      if (!/^\d+$/.test(id) || !sheet || typeof sheet.file !== 'string' ||
          !/^[\w.-]+\.png$/i.test(sheet.file) || !Number.isSafeInteger(sheet.frameWidth) ||
          !Number.isSafeInteger(sheet.frameHeight) || !Number.isSafeInteger(sheet.frames) ||
          sheet.frameWidth < 1 || sheet.frameWidth > 512 ||
          sheet.frameHeight < 1 || sheet.frameHeight > 512 ||
          sheet.frames < 1 || sheet.frames > 300 ||
          !Array.isArray(sheet.durationsMs) || sheet.durationsMs.length !== sheet.frames ||
          sheet.durationsMs.some(v => !Number.isFinite(v) || v < 20 || v > 30000)) return false;
    }
    return true;
  }

  // Only load local, private indexed manifests. Reject paths that could
  // point outside the ignored /local-assets/species directory or to URLs.
  function validateLocalCatalog(catalog) {
    if (!catalog || catalog.format !== 'digi-phaser-local-species-catalog-v1' ||
        !catalog.entries || typeof catalog.entries !== 'object' ||
        Array.isArray(catalog.entries)) return false;
    const records=Object.entries(catalog.entries);
    if (!records.length || records.length > 216) return false;
    const paths=new Set();
    for (const [name,entry] of records) {
      if (!name || name.length>80 || name==='__proto__' ||
          !entry || typeof entry !== 'object' ||
          !/^species\\/m[a-zA-Z0-9_-]+$/.test(entry.folder) ||
          !Number.isSafeInteger(entry.actions) || entry.actions<1 ||
          entry.actions>40 || paths.has(entry.folder)) return false;
      paths.add(entry.folder);
    }
    return true;
  }

  function knockbackForDamage(damage) {
    return clamp(55 + Math.max(0, Number(damage) || 0) * 1.8, 55, 140);
  }

  function gainTrainingStat(current, amount) {
    if (!Number.isFinite(current) || !Number.isFinite(amount)) throw Error('Invalid training stat');
    return clamp(Math.floor(current + amount), 0, 9999);
  }

  // The original arena picks exact pose IDs. Some user-imported species
  // have only a subset of the animations, so choose the closest available
  // action instead of showing an idle Digimon while it attacks or faints.
  // This is rendering-only: it cannot change damage, AI, timing or saves.
  function motionAction(f, actions) {
    if (!f || !(actions instanceof Set) || actions.size === 0) return null;
    const type = f.hp <= 0 ? 'ko' : f.act;
    const desired = type === 'ko' ? 37 : type === 'victory' ? 30 :
      Number.isInteger(f.pose) && f.pose >= 0 && f.pose <= 39
        ? f.pose : null;
    const alternatives = {
      ko:[37,5,0], victory:[30,28,0],
      hurt:[5,31,0], guard:[31,5,0],
      attack:[7,8,9,10,0], special:[33,10,7,0],
      walk:[2,3,0], run:[3,2,0], evade:[3,2,0],
      idle:[0,2,3]
    };
    const candidates = [
      ...(desired === null ? [] : [desired]),
      ...(alternatives[type] || [0])
    ];
    for (const id of candidates) if (actions.has(id)) return id;
    // A sparse manifest may still have one other valid motion: display
    // that rather than replacing the species with procedural graphics.
    return [...actions].sort((a,b)=>a-b)[0];
  }

  // These cues describe only the already-computed ORIGINAL arena pose.
  // No simulation clock, attack damage, hit detection, or TP is changed.
  // Phaser adds a per-frame duration on top of 1000/frameRate.
  // Our exporter stores the TOTAL original GIF delay, not an extra delay.
  // A 20ms base preserves even the shortest validated GIF frame exactly.
  function gifFrameTiming(durationsMs) {
    const baseMs = 20;
    if (!Array.isArray(durationsMs) || !durationsMs.length ||
        durationsMs.some(ms => !Number.isFinite(ms) || ms < baseMs || ms > 30000))
      throw Error('Invalid GIF frame timings');
    return {frameRate: 1000 / baseMs,
      extraMs: durationsMs.map(ms => ms - baseMs)};
  }

  function specialPhase(f) {
    if (!f || f.hp <= 0 || f.act !== 'special') return null;
    return f.pose === 33 ? 'charge' : f.pose === 10 ? 'release' : null;
  }

  function knockbackTilt(f) {
    if (!f || f.hp <= 0 || !Number.isFinite(f.knockVX) ||
        Math.abs(f.knockVX) < 12) return 0;
    // A slight visual lean follows the actual 2D impulse direction,
    // not a synthetic damage event. Fades as the original impulse decays.
    return clamp(f.knockVX * 0.075, -14, 14);
  }

  function playableAction(manifest, action) {
    if (!validateManifest(manifest)) return null;
    const entry = manifest.actions[String(action)];
    return entry && entry.frames > 0 ? entry : null;
  }

  return Object.freeze({ ACTION, STATES, selectAction, validateManifest,
    knockbackForDamage, gainTrainingStat, playableAction, motionAction,
    specialPhase, knockbackTilt, gifFrameTiming, validateLocalCatalog });
});
