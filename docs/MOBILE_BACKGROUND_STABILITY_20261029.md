# Mobile background save and resume QA — 2026-10-29

This work builds on the merged PR #53 end-to-end original-game acceptance.
Scope: mobile switching / suspend, not new evolution, damage or farm balance.

## Actual behavior

- Existing original farm saves periodically every ~6 foreground seconds.
  Mobile/WebView may suspend earlier. The farm now immediately calls the
  EXISTING save(false) when document visibility changes to hidden, or
  window pagehide fires. No new storage format, key or schema migration.
  Storage failures are contained rather than crashing the visibility event.
- **Protected settlement guard:** While an external Phaser battle is
  still pending, or a championship round is awaiting a result, a stale
  original page must NOT run a background save over a newer approved
  atomic battle result. Pending battle/cup states are already protected
  by the battle-launch/commit code. The opt-in Phaser approval sets a
  short-lived DCDevPhaserApprovedSave marker immediately after the atomic
  result is stored and BEFORE reloading the stale game tab. Background save
  skips while that marker is set, even though the live game has no
  pendingBattle. A browser regression simulates a
  newer authoritative localStorage result then triggers old-page
  visibilitychange + pagehide and confirms no overwrite.
- Farm resets its lastFrame origin on visibility changes so a sleeping
  browser does not apply a phantom catch-up delta when foregrounded.
  Normal 1x/2x/4x and paused choices remain untouched; no offline training.
- Hunting also checkpoints its live encounter (same existing localStorage
  session, HP, rope, time and position) on document hidden, rather than
  waiting for pagehide, which Android often does not fire on app switch.
  An interrupted pointer drag is cancelled on hide; any resumed lasso
  must begin with a new touch rather than finishing an old pointer.
- Canonical source modules src/hex-farm-ui.js and src/hunt-ui.js are
  synchronized into BOTH real playable index.html and standalone.html
  using existing fail-closed sync scripts in a combined CI workflow.

## Repeatable verification

Run: python3 tests/mobile-suspend-browser.py

The browser uses real HTTP, normal localStorage and the original game.
It runs desktop index.html and touch-emulated standalone.html:

1. Simulate 1,200 seconds of accelerated farm simulation, verifying finite
   stats and bounded rendered actors. This is NOT 1,200 seconds of wall time.
2. Modify live unsaved resources. Simulate document.hidden and
   visibilitychange, then check the immediately persisted state.
3. Confirm that the clock stays frozen while hidden and avoids large
   resumption catch-up.
4. Start a real wild hunt, modify HP/time, background the page and verify
   the exact saved encounter snapshot.
5. Dispatch pagehide after a late resource change; verify it persists.
6. Reload the full original HTML and check resources, team, farm time,
   paused state and same ongoing wild encounter are preserved.

The full original-game acceptance CI independently tests all 4 combos of
index/standalone and desktop/touch and the complete hunt→farm→evolution→
arena→cup→JSON-save single-save journey.

## Important limits

This DOES NOT test real Android OS force-kills, battery, long physical-device
soak or actual memory use. Android may terminate an app without firing
either browser event, so autosave every ~6 foreground seconds remains a
second safety net, not an absolute durability guarantee.
It also does not establish NDS ROM numeric accuracy or long-term
public-release performance. No private ROM, original GIF art or ZIP included.
