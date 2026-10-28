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
