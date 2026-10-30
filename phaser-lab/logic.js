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
          sheet.durationsMs.some(v => !Number.isFinite(v) || v < 10 || v > 30000)) return false;
    }
    return true;
  }

  // A private catalog may contain 216 species but NEVER arbitrary URLs or
  // filesystem traversal. Browser requests stay inside local-assets/species.
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
          typeof entry.folder !== 'string' ||
          !entry.folder.startsWith('species/m') ||
          !entry.folder.slice('species/m'.length) ||
          [...entry.folder.slice('species/m'.length)].some(ch=>
            !'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'.includes(ch)) ||
          !Number.isSafeInteger(entry.actions) || entry.actions<1 ||
          entry.actions>40 || paths.has(entry.folder)) return false;
      paths.add(entry.folder);
    }
    return true;
  }

  function knockbackForDamage(damage) {
    return clamp(55 + Math.max(0, Number(damage) || 0) * 1.8, 55, 140);
  }

  // Read-only visual burst for an ACTUAL original-engine hit event.
  // Direction uses the victim's measured two-axis knockback impulse; the
  // attacker/target vector is only a fallback when impulse is zero.
  // Do NOT infer a ROM effect resource ID from a Digimon name or technique.
  function hitCue(event, victim, attacker) {
    if (!event || event.type !== 'hit' || !Number.isFinite(event.x) ||
        !Number.isFinite(event.y) || !Number.isFinite(event.damage) ||
        event.damage <= 0) return null;
    const special=event.special===true;
    let dx=Number.isFinite(victim?.knockVX)?victim.knockVX:0;
    let dy=Number.isFinite(victim?.knockVY)?victim.knockVY:0;
    if(Math.hypot(dx,dy)<1 && victim && attacker &&
        Number.isFinite(victim.x) && Number.isFinite(victim.y) &&
        Number.isFinite(attacker.x) && Number.isFinite(attacker.y)){
      dx=victim.x-attacker.x;dy=victim.y-attacker.y;
    }
    const magnitude=Math.hypot(dx,dy);
    if(magnitude<.001){dx=1;dy=0;}
    else{dx/=magnitude;dy/=magnitude;}
    const color= special && typeof event.color==='string' &&
      /^#[0-9a-f]{6}$/i.test(event.color)?
      Number.parseInt(event.color.slice(1),16):
      special?0xb4e4ff:0xffe5a2;
    return Object.freeze({
      x:event.x,y:event.y-29,dx,dy,special,color,
      radius:clamp(12+event.damage*.55,13,special?36:25),
      reach:clamp(15+event.damage*.95,16,special?53:36),
      damage:event.damage,targetId:event.targetId??null
    });
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
  // A 10ms base preserves the 17 short frames discovered in the owner's
  // 216-species source set; 60Hz displays may visually skip sub-frame motion.
  function gifFrameTiming(durationsMs) {
    const baseMs = 10;
    if (!Array.isArray(durationsMs) || !durationsMs.length ||
        durationsMs.some(ms => !Number.isFinite(ms) || ms < baseMs || ms > 30000))
      throw Error('Invalid GIF frame timings');
    return {frameRate: 1000 / baseMs,
      extraMs: durationsMs.map(ms => ms - baseMs)};
  }

  // Render-only cues for the existing original battle effect TYPES.
  // These do NOT claim a species->ROM e003_* effect ID match: the overlay
  // confirms 151 resource strings but does not identify which move uses one.
  function projectileShape(projectile) {
    if (!projectile || typeof projectile !== 'object') return 'orb';
    if (projectile.type === 'missile' ||
        projectile.projectileType === 'missile') return 'missile';
    if (projectile.type === 'claw' ||
        projectile.projectileType === 'claw') return 'claw';
    return 'orb';
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

  // Pure, renderer-only pose styling. Keep the last native KO GIF frame
  // upright and fully visible instead of continuously bobbing/ghosting it.
  // When there is NO original KO action in the fighter's local atlas, keep
  // the prior collapsed procedural pose (including its distinct opacity).
  // This never advances the battle clock or changes an actor's HP/AI/save.
  function fighterPresentation(f, useArt, hasNativeKo, time=0) {
    const knockedOut=f.hp<=0;
    const faintFallback=knockedOut&&(!useArt||!hasNativeKo);
    const bob=knockedOut?0:
      (f.act==='walk'||f.act==='evade'
        ?Math.sin(time*.012+f.slot)*1.7
        :Math.sin(time*.003+f.slot)*.4);
    const knockLean=knockbackTilt(f);
    const angle=knockedOut
      ?(faintFallback?(f.side===0?-78:78):0)
      :(knockLean||(!useArt&&f.act==='hurt'?(f.side===0?-12:12):0));
    const alpha=knockedOut?(faintFallback?.5:1):f.flash>0?.65:1;
    return {bob,faintFallback,angle,alpha};
  }

  function playableAction(manifest, action) {
    if (!validateManifest(manifest)) return null;
    const entry = manifest.actions[String(action)];
    return entry && entry.frames > 0 ? entry : null;
  }

  return Object.freeze({ ACTION, STATES, selectAction, validateManifest,
    knockbackForDamage, gainTrainingStat, playableAction, motionAction,
    specialPhase, knockbackTilt, fighterPresentation, gifFrameTiming, validateLocalCatalog,
    projectileShape, hitCue });
});
