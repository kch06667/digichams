# Phaser rendering lab · separate from the existing game

This is a **development vertical slice**, not a replacement for index.html / standalone.html.
No main save, battle reward, evolution or ROM-backed AI logic is modified.

## Run

1. From the repository root: `python3 -m http.server 8000 --bind 127.0.0.1`
2. Open `http://127.0.0.1:8000/phaser-lab/` in a desktop browser.
3. Use the buttons: auto battle, one training action, restart, sound toggle.
4. Open `http://127.0.0.1:8000/phaser-lab/farm.html` for a separate small-hex cage prototype.
   Click/tap individual cage tiles; buy additional cages, feed across four visible
   bites, practice, expand from two rows and pan/zoom. No save data is touched.

The demo loads **Phaser 3.90.0 from a version-pinned CDN**, so the browser needs
internet access. Without exported GIF assets, the demo uses freshly drawn,
copyright-free procedural placeholder characters. Training bonus, attack damage,
AI turns and timings are **demonstration-only**, not NDS reverse-engineered.

## Test existing GIFs locally — private use only

Run from the repository root with Python and Pillow available:

```sh
python3 -m pip install Pillow
python3 tools/export-phaser-atlas.py --species 아구몬
python3 -m http.server 8000 --bind 127.0.0.1
```

Reload `http://127.0.0.1:8000/phaser-lab/`. The exporter writes:
- `phaser-lab/local-assets/manifest.json`
- `phaser-lab/local-assets/action_<index>.png`

**Do not commit or share those outputs.** The folder is ignored by Git.
This conversion preserves every GIF frame and its source GIF duration and pads
**all actions to one shared canvas size** to avoid pose-dependent scale jumps.
It deliberately only exports one test Digimon. The input GIFs remain untouched.
Not every GIF contains multiple frames (notably training action 32 can be static).

Action 30 is user-confirmed **victory**, 32 is user-confirmed **training**.
The short attack motion adjacent to original training remains unverified.
The demo temporarily plays 32 followed by attack 7 to test the choreography,
not to assert that this is the ROM's exact training sequence.

## Tests

```sh
node --test tests/phaser-lab.cjs tests/phaser-preview.cjs
python3 -m unittest discover -s tests -p test_phaser_atlas.py -v
```

The farm model has additional offline regression coverage in `node --test tests/phaser-farm.cjs`.
The first tests run offline. The synthetic GIF conversion test needs Pillow.
Full Phaser WebGL/Canvas rendering on physical Android still needs manual
verification. The original DOM game and save format have not been migrated yet.

## Web delivery — art-free preview only

```sh
node tools/build-phaser-preview.cjs
```

Produces only three allowlisted Phaser demo files and build-info.json under
`dist/phaser-preview`. This **intentionally excludes original game pages,
sprites, ROM art, and generated local GIF sheets**. A GitHub Pages workflow is
provided for merging into main after review. Pages must be configured in repo
settings for deployment to work. Browser updates happen on reload/revisit,
not by replacing active JavaScript mid-game. This preview has no save data.

## Next integration steps

- Verify 0–39 sprite meanings using Codex's separate ROM analysis.
- Use a shared render contract (pose, orientation, position) and a spritesheet
  manifest without coupling game rules to Phaser.
- Replace one existing battle renderer behind a feature flag only after
  comparing full battle outcomes and old-save roundtrips.
- Keep handling of owner-provided copyrighted artwork private; obtain proper
  authorization before any public game release.

## Step 3 — real rule-module bridge (read-only)

`domain-bridge.js` now delegates **existing** Javascript engine functions:

- `src/battle-core.js`: existing tactic selection, targeting policy, TP skill
  threshold/cost, bounded TP updates. The prototype still uses demo-only
  damage (36 skill / 18 normal), encounter scheduling and knockback; those are
  **NOT** equivalent to the full original arena embedded in `index.html`.
- `src/care-core.js`: seasonal training gain. Values remain earlier project
  extension balance, not yet ROM-verified.
- `src/championship-core.js`: real project cup availability rules. Click
  **대회 조건** to view conditions for a *sample roster*.
- Optional **세이브 JSON 읽기** reads a user-selected export, validates its
  safe subset in browser memory, and shows a roster summary and actual cup
  eligibility. It never writes localStorage, never overwrites original game
  files, never sends this file to the public preview server, and never changes
  the original game's active save. The import is *preview only*, not live
  battle save integration.

The safe preview copies only these three allowlisted JS rule modules into
`engine-core/` and rewrites their relative script URLs. No ROM graphics or
binary files are included. Browser smoke tests cover both the unbundled and
deployment builds (subject to CI settings).

## Safe PWA installation and automatic web updates

The `phaser-lab` preview now provides `manifest.webmanifest`, an original
icon, `sw.js` and an opt-in update prompt. The site can be opened on PC or
Android; when the browser supports installation, use **Install app** or
**Add to Home screen**. Installation affordances vary by browser and platform.

For CI-deployed GitHub Pages only, the build includes a pinned, MIT-licensed
`phaser@3.90.0` under `vendor/` plus its license. After **one successful
online visit and service worker installation**, the **safe lab** should reopen
offline (battle/farm demos only). The source tree still references the CDN for
unbundled development; offline capability is verified on the generated Pages
bundle, not promised for every local setup.

When a new commit reaches Pages, service worker cache names change using the
build SHA. Existing cached JS is reused within that version, and a button
invites the user to activate a waiting update; it never silently replaces
game JS mid-battle. A full backup plan for the real game saves is still needed.
Original Digimon graphics are intentionally **excluded** from all public Pages
builds, even if present in repository history.

Run `node tools/build-phaser-preview.cjs` after installing Phaser locally for
an offline-capable safe bundle. `node --test tests/phaser-preview.cjs` checks
the preview allowlist. Chromium smoke tests additionally verify offline
navigations on CI.

## Player roster preview in both Phaser scenes

Use the original game's **Save export** to obtain a JSON file. In the battle
lab, open it with the JSON picker and choose an eligible, alive, non-stored
Digimon from **출전 디지몬**. The local Phaser simulation now copies that
Digimon's name, HP, ATK/DEF/SPD and TP into the **temporary auto-sparring
encounter**. The legacy TP/tactic functions continue to choose skills.
**The damage constants (36/18) and turn timing are still just a demo.**
The original save is never changed, and winning this exhibition gives no
reward or permanent stat change.

On `farm.html`, choose the same exported JSON to see the *active* Digimon
laid out in small hexagonal cages with their name, HP and hunger displayed.
The preview shows up to 30 farm Digimon (the existing game's storage Digimon
are not considered active cages), and reports extra undisplayed creatures.
Purchase, training, feeding and expansion controls are disabled in the
read-only view; selecting hexes and panning/zooming still work. **초기화**
returns to the separate simulation. This is a visual projection, **not**
migration of the legacy game's actual cage layout or save format.

The JSON file is parsed entirely in the user's browser. Only an allowlisted
subset (name, vital stats, day, cups) is held in transient page memory.
It is never uploaded to Pages or stored via localStorage, IndexedDB or
service-worker cache. File size is limited to 3 MiB, and source data
is validated before display.

## Why we replaced the old turn-taking Phaser demonstration

The first Phaser test scene was a **misleading scripted alternating attack
sandbox**, and its two placeholder characters did not represent the game's
planned auto-combat. The **original playable `index.html` arena already has**
asynchronous AI-driven 2D movement, approach/flank/disengage, dynamic targets,
dodge, guard, melee and ranged signature attacks, knockback and multimon
team battles. We should have audited and reused that logic first.

The default Phaser battle page now uses `realtime-core.js`, a pure deterministic
fixed-step **concurrent autonomous AI** simulator **inspired by those existing
arena behaviors**. Every actor independently chooses targets, walks/strifes
and can simultaneously wind up/attack; 1v1 / 2v2 / **3v3 default**, different
attack cooldowns, defensive reactions, orbiting, actual projectiles, damage,
hit effects and victory. There is **no global alternating turn scheduler** in
the active Phaser battle view. Node tests explicitly check simultaneous
windups and 3v3 2D motion; desktop+touch browser tests verify the animation
path and automatic outcome.

This is still NOT the exact, already implemented original `index.html`
arena logic ported into Phaser. The original has more detailed unit control,
battle save settlement, AI variability, and species-specific technique/sprite
systems. The current public web preview still uses distinct *original
procedural test sprites*, not redistributed copyrighted Digimon imagery.
User-provided private sprite sheets may be tested locally using the atlas
export script. Never describe this lab as the finished game.

**Next major goal:** extract existing original battle simulation as a
renderer-independent production module (target behavior, cooldowns, attack
outcomes, state transitions, championship settlement), replace
`realtime-core.js` prototype rules with the production module in Phaser,
add equivalence tests before writing any player save.

## 2026-10-28 — species identity + local sprite pack, no public image upload

The Phaser battle lab now imports **existing game technique metadata**
from `arena-techniques.js`: the same named skills and costs currently defined
in the older `index.html` arena for Agumon, Gabumon, Patamon, WarGreymon,
MetalGarurumon and other registered species. For example Agumon uses
`화염 공격`, Gabumon uses `블루 블래스터` and WarGreymon has
a 36 TP cost. **These are extension-era game data, not verified ROM
technique IDs or NDS battle balance.** The energy gate, guarded TP cost,
windup, cooldown and knockback are closer to the existing HTML arena.

Default sparring team members now have actual Digimon names and their own
techniques. The freely distributed art is still **procedurally generated,
non-original placeholder art**; naming real monsters does not magically
supply their licensed graphics.

### Put your existing sprites on YOUR device without publishing them

1. Convert one species' already-owned local GIFs to sprite sheets with
   `python3 tools/export-phaser-atlas.py --species 아구몬` on a PC.
2. Open the safe web lab. Under **내 PC·휴대폰의 변환된 디지몬 모션 파일
   적용**, select **manifest.json and every action_*.png** together from
   `phaser-lab/local-assets`.
3. When that species appears in battle, the lab draws only that species
   using the selected sprite sheets. Other species retain placeholders.

The chosen images are read **only inside the current browser tab** using
short-lived `blob:` URLs. They are not sent to GitHub Pages, put in
`localStorage`, committed to Git, or cached by the service worker.
Selection must be repeated on tab reload; this is intentional. Package
limits: 45 files, 32MiB total, 8MiB per file. Only valid local
manifest+PNG file combinations are accepted. To create multi-species
graphics, a later version needs explicit per-species atlas manifests.
Do not select or publish NDS ROM files.

**Implementation boundary:** This remains a Phaser development lab,
not the original game's complete simulation. Main gameplay and save
settlement remain in the original playable `index.html`; do not treat
the lab's temporary combat statistics as permanent results.
