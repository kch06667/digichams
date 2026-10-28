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

## 2026-10-28 second integration checkpoint

- Site: `https://kch06667.github.io/digichams/` (asset-free Pages demo).
  The previous Pages configure 404 was resolved after owner enabled Pages;
  successful workflow rerun: `40586958965`.
- Feature track: `feature/phaser-legacy-core-adapter-20261028`.
- New `phaser-lab/domain-bridge.js` executes original project battle
  tactics/TP core, care seasons and championship requirements, rather than
  independently reimplementing these rules in the lab.
- `phaser-lab/index.html` can read a JSON game export to preview the real
  Digimon roster and cup eligibility. This is read-only and doesn't modify
  gameplay or stored saves.
- The preview generator copies only three JavaScript rules files into
  `engine-core/`; never add ROM extracts or copyrighted sprite art to Pages.
- Remaining critical: original `index.html` arena combat time/AI/damage
  and real player save mutation/compatibility are still NOT integrated.
- **Visibility warning:** repository metadata reported a public repository
  after the Pages change. The source tree already contains `assets/rom` and
  `assets/rom_images` among other extracted-looking image files. The owner
  should review whether these belong in any public repository and change
  visibility / history exposure as appropriate. Our Pages preview explicitly
  does not deploy these assets; that does not hide files already public in Git.

## Asset-free PWA checkpoint

- `phaser-lab/manifest.webmanifest`, `icon.svg`, `pwa.js` and `sw.js`
  provide install/update behavior for the **safe Phaser demo only**.
- Public Pages build uses an explicit allowlist, includes pinned Phaser 3.90
  distribution with MIT license, and omits original art. Versioned service
  worker caches only safe known paths and offers a reload button after an
  update; no hidden automatic in-progress game reload.
- Service worker never intercepts or caches uploaded JSON files or paths
  outside the allowlist; no live save writes.
- Tests must prove offline load of the bundle, training and farm on desktop;
  Android device install still requires owner QA.
- Repository visibility is a separate consideration: public source metadata
  has already shown extracted-looking files in the main tree. Pages allowlist
  does not protect public Git contents. Avoid assuming this fixes copyright
  or private-development concerns.

## 2026-10-28 read-only roster vertical slice

Track: `feature/phaser-roster-battle-farm-readonly-20261028`.

- Both independent Phaser scenes accept user-exported JSON saves and display
  *copied, validated* actual Digimon records without modifying localStorage
  or the in-game save.
- The battle lab permits choosing one eligible active Digimon; its copied
  name/HP/attack/defense/speed/TP are passed into the lab's `newEncounter()`.
  Existing TP and targeting functions still decide special versus normal.
  This is **not** the legacy arena's full AI/damage rules and does **not**
  apply the demonstration battle outcome to the original save.
- The farm lab projects up to 30 active monsters into small hex cages,
  shows real HP/name/hunger, and disables all mutation controls in
  read-only mode. It excludes storage/lost monsters and does not claim the
  slot allocation reflects NDS cages.
- Save previews are transient browser-only data. No cross-page persistence
  or server upload. To inspect both scenes, select the JSON file separately.
- Added unit tests for invalid roster eligibility and no mutation, 30-slot
  clipping, and Chromium desktop/mobile import and selection.
- Still needed: isolate the **full actual** legacy arena logic (some inline
  in the original HTML), separate world state mutation from renderer,
  implement game-event replay in Phaser without changing win/loss outcomes,
  and build real save-backed integration after those rules stabilize.

## 2026-10-28 correction — Phaser turn demo was NOT our desired combat

Owner observed two unrelated placeholder figures trading one hit each,
revealing the earlier Phaser prototype used `turn % 2`. That was a design
mistake, not a required Phaser limitation.

Correct baseline already exists in old `index.html` under the main
`DCBattleArena` implementation: multi-fighter real-time AI `think(f,dt)`,
`advanceSpecial`, `beginMelee`, 2D chase/strafe/disengage/dodge, dynamic
targeting, knockback, cast/projectiles, KO, victory pose and owned-match
settlement. Codex ROM analysis is separate; do NOT conflate original-game
JS simulation with ROM-verified NDS mechanics.

New branch `fix/phaser-autonomous-realtime-battle-20261028` implements a
**temporary but concurrent** fixed-step 2D simulation in
`phaser-lab/realtime-core.js` and plugs it into `phaser-lab/game.js`.
Default mode 3v3; 1v1/2v2 optional, no user attack controls. The rendering
still uses noncopyrighted placeholders publicly or private local converted
GIF atlas. Training and user JSON save previews remain read-only.

This is NOT final simulation parity with original `DCBattleArena`; next
task is extracting original production AI/simulation logic and replay
events through Phaser. Keep save settlement entirely disabled in the
independent prototype until regression equivalence tests verify outcomes.
