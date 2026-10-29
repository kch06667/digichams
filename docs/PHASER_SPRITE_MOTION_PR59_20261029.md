# PR59 — Original sprite combat motion: foot anchoring and visible victory (2026-10-29)

## Scope

Production `index.html` / `standalone.html` already use the **same-tab**
Phaser scene by PR58. This change improves rendering **within that real
battle**, not a disconnected demo or replacement AI.

The owner's local indexed GIF audit confirms that a single Digimon can
change its sprite cell geometry between actions. For example, the 40-action
index has species with 24×24 idle cells, 24×32 hurt cells, and 32×16 KO
cells. Their frame heights are NOT necessarily equivalent. The renderer
previously positioned every sprite by its **center** at `f.y-34`, so a
transition from idle → hit → KO could visibly jump its feet. Existing hit
knockback rotation, direction flip, and shadow continue to follow the
original 2D fighter position, not a new synthetic physics simulation.

### Changes

1. Original private GIF artwork is now **bottom anchored** with
   `setOrigin(.5,1)`, with the foot at `f.y-2` plus existing subpixel bob.
   This preserves the source GIF pixels and a stable local pixel scale
   across different animation cell sizes. Placeholder procedural silhouettes
   retain their previous centered positioning.
2. Winner action **30** (user-confirmed) now loops during the victory state.
   Original attack animations 7–10 still play once; KO 37 remains one-frame
   as in the source; hit 5, guard 31, and actual knockback tilt remain driven
   by the original `DCOriginalArenaCore` state and events.
3. Only in **embedded production battles**, after original AI produces the
   finished result, keep the Phaser scene visible for **1,100 ms** to show
   victory 30 before sending the exact same sealed terminal result packet
   to the existing validated save/backup/reload handler. We never change
   the winner, damage, TP, stats, opponent team, reward calculation, or
   persistent save format. A discarded frame cannot deliver a stale result.
   Standalone Phaser demo and developer manual-approval modes keep their
   previous result delivery timing.
4. Rendering-only test probe includes sprite origin, foot Y and display
   height for regression without exposing original GIF bytes.

### Verification

- `tests/phaser-216-browser.py`: real converted source GIF animations
  for six distinct named species in 3v3 on desktop/touch; confirms each
  species is bottom anchored to the original fighter's ground Y; after
  real autonomous fight completion confirms every surviving winner has
  `victory:30` and every KO has `ko:37`, with distinct sprite identity.
- `tests/phaser-production-default-browser.py`: actual production
  `index.html` and `standalone.html` with original owned-fighter
  1v1; asserts a real private-art victory 30 remains visible inside the
  game screen **before** verified automatic result commit and reload.
- Existing `tests/phaser-duel-browser-smoke.py` still checks the original
  GIF frame durations and distinct Agumon/Gabumon visuals on desktop/touch.
  Full original-game, championship, Phaser save, background and legacy
  regressions are preserved.

## Explicit limits

Action 30 (victory) and 32 (training) are user-confirmed; 0/2/3/5/7–10/
31/33/37 are *working web-game mappings*, not each validated against a
real NDS recording. Precise attack-impact frames, per-species offset and
all 216 species' action meanings still need ROM/video evidence; action GIF
cell size alone does not prove NDS pixel-perfect positioning. Local private
GIF packs must be converted to appear in Phaser; missing packs still use
procedural placeholders. No raw NDS ROM, generated GIF/PNG art or ZIP is
committed. Chrome touch tests are not physical Android performance results.
