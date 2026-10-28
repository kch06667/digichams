# Owned-battle settlement parity / staged save transaction

## 2026-10-29: result logs and safe commit preparation

The new src/battle-commit-core.js provides two opt-in detached helpers. Neither is connected to production HTML or the Phaser preview.

- stageCopy(state, options): invokes the validated clone-only settlement and appends the **exact original** settleMatch outcome messages to its cloned state. The game evolution log comes first, then the cup message, then the fight message. Messages are prepended as [DAY n] entries; newest 60 retained.
- persistCopy(state, options, storage): requires an explicitly injected readable/writable storage object. It verifies that the serialized saved dc_recreation_save equals the input state before and after staging. If stale or unreadable, abort. If valid, make exactly one full-state setItem and return the staged state **only after success**. It never deliberately changes its input state.
- The existing settleCopy() remains pure gameplay-state/receipt computation without UI logs or persistence.

## Regression coverage

- tests/battle-full-state-parity.cjs: the actual index.html and standalone.html settleMatch functions compared with stageCopy for 1v1/2v2/3v3 wins/losses and novice cup semifinal/final. Compare **all saved fields including logs**, not just combat stats.
- tests/battle-evolution-settlement-parity.cjs: same comparison with actual catalog lookups, evolutions and evolution/battle logs for Koromon, Patamon, same-species independent instances and championship evolution.
- tests/battle-commit-safety.cjs: message format/order, log cap, one save write, no duplicate/stale-tab overwrite, rejected/replayed battles, missing and inaccessible storage, write exceptions, and a lookup callback mutating the active state.

## Save-failure guarantees and limitations

In a deterministic fake storage, a rejected setItem leaves the existing serialized save unchanged, and the source state is never intentionally changed. The *caller* must only adopt the new state after persistCopy succeeds and must show failure feedback if it throws.

This is **not** proof of safety against real physical power loss, disk corruption, browser storage eviction, a storage implementation that writes then throws, or a multi-tab race outside the synchronous operation. Before production integration, ensure the exact pre-battle checkpoint is persisted and consistent with autosave; maintain a user-exportable backup.

## Remaining gates before live save integration

1. Test browser denied/quota/eviction cases and reload on desktop and physical Android; handle ambiguous writes and backup/recovery.
2. Verify old save migration, tournament abandonment, evolving farm actors, and pre-battle checkpoint synchronisation.
3. Wire the helper into *both* production HTML builds only in a separate reviewed change. Preserve UI error messages and adopt only on successful save.
4. The web evolution balance is not fully NDS ROM-verified; do not claim original NDS accuracy.

Run:
    node --test tests/battle-full-state-parity.cjs tests/battle-evolution-settlement-parity.cjs tests/battle-commit-safety.cjs

Do not commit new ROM or extracted game artwork.

## 2026-10-29: legacy checkpoints and real Chromium failure regression

- New test `tests/battle-legacy-storage.cjs` covers an old v1 save, unknown historical fields, absent instance IDs, and migration that changed the in-memory snapshot. `persistCopy` must reject a migrated or otherwise modified save until the future game explicitly persists an identical pre-battle checkpoint; it never automatically overwrites old disk data.
- New `tests/fixtures/battle-commit-browser.html` and `tests/battle-browser-storage-smoke.py` load the real JavaScript modules on an isolated Chromium HTTP origin and verify one successful commit + reload, replay rejection in the same origin, old raw save retention, then separate explicit test-only backup/checkpoint followed by commit. Both desktop and touch-sized browser contexts run.
- Chromium quota and security denial are **simulated with DOMException injected into Storage.prototype**, because actual quotas/permissions vary across devices and environments. Reload confirms the old serialized save remains intact after these simulated failures. A silent-drop adapter is also rejected.
- `persistCopy` now reads back `dc_recreation_save` after `setItem` and requires exact serialized equality before returning an adoptable state. A readback denial or ambiguous write is treated as failure: callers must re-read/reload instead of blindly retrying or rolling back; an earlier write might already have persisted.
- The helper remains isolated. No production HTML/Phaser integration, automatic v1-v4 migration, irreversible disk rewrite, or physical Android quota/eviction/power-loss claim.

Production integration must first preserve/export the original legacy snapshot, save the migrated pre-battle checkpoint deliberately, and show recovery guidance if storage is blocked. Do not assume this test simulates Android app termination.
