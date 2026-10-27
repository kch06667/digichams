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

  function knockbackForDamage(damage) {
    return clamp(55 + Math.max(0, Number(damage) || 0) * 1.8, 55, 140);
  }

  function gainTrainingStat(current, amount) {
    if (!Number.isFinite(current) || !Number.isFinite(amount)) throw Error('Invalid training stat');
    return clamp(Math.floor(current + amount), 0, 9999);
  }

  function playableAction(manifest, action) {
    if (!validateManifest(manifest)) return null;
    const entry = manifest.actions[String(action)];
    return entry && entry.frames > 0 ? entry : null;
  }

  return Object.freeze({ ACTION, STATES, selectAction, validateManifest,
    knockbackForDamage, gainTrainingStat, playableAction });
});
