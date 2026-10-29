# PR58 — In-page Phaser battle on PC and mobile (2026-10-29)

## Actual gameplay change

The **real** `index.html` and `standalone.html` continue to use the
PR57 production Phaser default. No rebuilt demo or query flag is needed.
The production bridge now opens a full-screen **same-document dialog** with a
same-origin `phaser-lab/` iframe instead of `window.open()`. This makes
the renderer visible within the original game's browser tab on both PC
and mobile touch. The original game is never replaced by the lab page.

The existing 32-character random token, exact `event.source`, same-origin
`postMessage`, per-Digimon instance identity, tournament fixture validation,
paused farm snapshot and verified backup/atomic settlement still apply.
The iframe chooses `window.parent` ONLY when explicitly launched with
`embeddedBattle=1`; traditional standalone Phaser lab and developer
popup links keep `window.opener`. Only the compact embedded mode starts
the existing real-time autonomous fight automatically after accepting its
validated roster. The Phaser frame still never receives the full save.

- Full-screen canvas and status, accessible title and 44px cancel button,
  mobile viewport/safe-area aware, no extra browser tab.
- Cancel removes the iframe, restores the original farm clock choice, and
  does not award a result or mark a pending battle.
- Successful battle posts its validated terminal packet and auto-commits
  through the PR57 stage/backup/save/reload flow. Reload naturally removes
  the iframe and adopts the authoritative saved state.
- Missing/blocked frame creation leaves the original engine available.
  A failed handshake times out and also closes the iframe, restores the
  clock and selects the original legacy engine.
- Development opt-in pages remain popup-based and require user approval
  as before. There is **no change** to damage, AI, HP/TP math, costs,
  evolution, RNG, cup schedule, combat assets, original inline HTML or
  save schema.

## Verification

`python3 tests/phaser-production-default-browser.py` now verifies the real
checked-in PC and touch HTMLs: **one tab only**, same-page Phaser canvas,
automatic match start with no second click, Phaser result committed exactly
once with backup/instance ID/pause preserved and the original game reloaded.
Additional cases cover cancel with no settlement and a forced iframe creation
failure with legacy retry. Existing full-game, Phaser 2v2/3v3, cup, sprite,
farm and mobile resume CI remain independent.

`phaser-lab/game.js` contains a compact CSS mode only when the explicit
`embeddedBattle=1` query is provided and the one-time token handoff is valid.

## Known limitations

The iframe is part of the same **page and tab** but a separate browser
document; it is not a single Phaser canvas inserted directly in the original
DOM's battle layout. Full local GIF packs (up to 216 species) require the
owner's local graphics export; absent packs still use placeholders.
Phaser CDN/network and same-origin `phaser-lab/` must be reachable. A single
`file://` or Android `content://` standalone HTML without its project
directories cannot load the frame. Physical Android hardware, 1–2 real
hours, low-RAM kill/reload and exact NDS ROM motion/sound are not proven
by Chromium touch emulation.

Do not upload original ROM, extracted private art, or a generated ZIP.
