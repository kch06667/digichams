# PR60 — Event-synchronized battle impact effects (2026-10-30)

## Why

The original HTML battle simulation `DCOriginalArenaCore.step()` supplies
*actual* damage events including the exact target, measured HP loss, hit
position, and whether it came from the original special attack. The fighter
snapshot also exposes the two-axis physical knockback impulse
(`knockVX/knockVY`). Phaser already rendered hit circles and damage text,
but the circles did not point in the real impulse direction and used one
generic color even for established original-webgame special colors.

## Shipped changes

- Pure `DigiPhaserLabLogic.hitCue(event,victim,attacker)` rejects unrelated
  events, nonpositive damage and nonfinite position, and derives a bounded
  **directional impact descriptor** from the real opponent impulse. Fallback
  to attacker → victim vector, then neutral rightward direction only if both
  are unavailable.
- On **each genuine `hit` from `RT.step()` only**, the current Phaser
  `consumeEvent` displays a short ring and five directional streaks, with a
  bounded emphasis for actual special strikes. For special hits, a validated
  `#RRGGBB` from the original technique is used; unsafe/unknown values use a
  neutral fallback. Normal hits remain warm. Small 260ms renderer-only
  tweens destroy their own temporary graphics.
- The existing exact damaged HP number, real-time camera shake, special
  zoom, projectile path, persistent knockback movement, real GIF action
  poses (attack 7–10 / web candidate hit 5 / KO 37), source GIF timings,
  victory 30, and PR57–59 guarded save are unchanged.
- A capped, read-only 24-hit cue probe helps browser QA reconcile **visual
  effects with event-history entries**, without exposing raw sprites,
  private save data, or changing the simulation.
- No fabricated attacker, no new damage/TP roll, no invented species →
  `e003_*` ROM effect ID lookup. Color is strictly from current original
  WEB battle technique metadata, not ROM-verified effect textures.

## Verification

- New node tests verify measured two-axis impulse, direction fallback,
  bounds, immutable original event, strict hex color fallback, and the fact
  non-hit and zero-damage events produce no flash.
- Original six-distinct-GIF 3v3 desktop + touch Chromium integration now
  waits for an **unforced live AI hit** and reconciles each visual cue to
  `matchSnapshot().eventHistory` by same target, damage, coordinates
  and timestamp. It continues checking animation identities, action 30/37
  and bounded per-match sprite loading.
- The existing original-game PC/mobile Phaser auto-save/backup/close,
  championship, developer opt-in, original AI, sprite/timing and economy
  regressions must stay green before merge.

## Remaining fidelity caveats

Full NDS effect-resource names are known but the ROM has not been proven to
map every Digimon/technique to the corresponding `e003_*` visual effect.
Consequently this PR is a **visible webgame fidelity upgrade** and not
pixel-perfect NDS replication. Still needed: evidence-backed ROM motion and
skill FX mappings, full background/UI polish, local export/use of all 216
species, physical Android performance and interrupted-match recovery, and
portable/offline bundling. No ROM, private GIF or extracted PNG is committed.
