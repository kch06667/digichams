# Phaser transition checkpoint (2026-10-28)

Related: GitHub Issue #11. Work branch `feature/phaser-vertical-slice-20261028`.
This phase intentionally does **not** modify original-game HTML, save format,
battle rules, farm navigation logic, Digimon database, or private ROM analysis.

## Product definition (user-confirmed)
NDS Championship raising loop: obtain Digimon → cage husbandry and training →
AI-controlled automatic battle → open more evolution possibilities → repeatedly
challenge the championships. Player is the tamer/coach, not a manual move pilot.

## Architecture as of this checkpoint
- Existing pure/semipure JS modules: `src/battle-core.js` (tactics, TP),
  `src/farm-core.js` (actor navigation), `src/cage-training-core.js`,
  `src/care-core.js`, `src/evolution-core.js`,
  `src/championship-core.js`. Preserve these for migration.
- The active farm renderer is `src/hex-farm-ui.js` plus inline HTML code,
  with fixed large radial facilities; user now wants smaller NDS-like cage
  cells, initial two rows expandable by progression, and bottom navigation.
  Implement later after ROM/UI reference review; don't silently mutate saves.
- New `phaser-lab/` includes a separate Phaser 3.90.0 battle lab and a
  *small hex cage farm lab* (`farm.html`/`farm-model.js`/`farm.js`). The cage
  demo starts with two rows of 6 candidate slots and two occupied cages,
  supports purchase, row expansion, training demo, four visible bites and
  pan/zoom. Grid dimensions, prices and feeding portions are demo-only.
  No game state bridge
  or production replacement is claimed.
- `phaser-lab/logic.js` defines verified action IDs and simple independent
  rendering/math contract, also importable in Node tests.
- `tools/export-phaser-atlas.py` converts private GIFs into **local-only**
  fixed-cell PNG sprite sheets, retaining original frame durations.
- `tools/build-phaser-preview.cjs` creates strictly allowlisted deploy output
  with **no** game art or original game HTML.
- Two independent CI workflows: isolated Node/Python tests, and Pages build
  from main after merge. Pages settings and hosting success not assumed.

## Motions and gameplay evidence
- User confirms 30 = victory. Never replace with 28 randomly.
- User confirms 32 = training but it may be static; user recalls a short attack
  immediately followed by stat gain, **not** push-ups. Which attack frame belongs
  in the NDS training sequence remains to be proven by Codex/video.
- 2 = walking is a candidate from old mapping, **not ROM-verified**.
- Battle presently lacks impact, big knockback, sound, correct motion switching
  and constant sprite scale; prototype tests those effects without touching
  real damage/AI.
- Original-style food consumption should animate several bites and shrink meat.
- `index.html` loaded through Android Zipper content:// can break relative
  graphics while fully extracted/HTTP `standalone.html` works.

## Quality gates before merging Phaser into actual game
1. Test prototype with/without locally generated atlas on Chromium and Android.
2. Check that 0/2/5/7/30/32 display at consistent size and correct direction.
3. Verify win uses 30, train displays 32 + researched transition, battle
   applies actual walk while moving and full hit reaction on impact.
4. Connect existing battle simulation to Phaser **without changing outcome**,
   with regression tests that compare before/after serialized state.
5. Add save migration only if needed, JSON import/export safety, and reliable
   cache/update notices. No accidental public upload of proprietary sprite art.
6. Rework hex cage placement and feeding incrementally after NDS evidence.

## What is not done
- Full Phaser migration of the current playable game.
- Production-ready 216-Digimon animation processing or verified action mapping.
- Original NDS battle/AI/sound reverse engineering (Codex task).
- Public distribution of any extracted GIFs/ROM graphics.
- Actual GitHub Pages enablement or Android hardware QA.

## Run locally and resume
See `phaser-lab/README.md` for commands.
Run regression tests on existing game separately:
`node tests/battle-core.cjs`, `node --test tests/farm-navigation.cjs`,
`node tests/cage-training.cjs`; run browser tests if dependencies installed.
Always update this checkpoint with *actual* test and PR results, never guessed.

## Future responsibilities
Codex: NDS reverse engineering on separate branch; keep empirical frame
evidence, provenance and exact GIF action mapping.
Phaser track: renderer/atlas/tooling, mobile input, strong hit feel, small
hex cage UI, game-domain adapter, safe web preview.
