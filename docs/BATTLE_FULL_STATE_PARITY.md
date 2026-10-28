# Original HTML vs cloned-state settlement parity — 2026-10-28

## Scope
- Compare **actual extracted** `index.html` and `standalone.html` `grantExperience()`, `syncBattleHP()`, and `settleMatch()` against `DCBattleSettlement.settleCopy()`.
- Same initial save and fighter results: 1v1, 2v2, 3v3, each win/loss; novice cup semifinal win then final win or loss.
- Assert all **persisted gameplay fields** (team including evolution, HP/TP, level/XP, win/loss, points, cups, crowns, prizes, pending battle removal) are identical. Assert original state is untouched, double settlement rejected.
- Intentional difference: the original `settleMatch` adds user-facing `state.logs` entries through `say()`, while `settleCopy` returns a receipt and does not write UI logs. Compare all game fields **except `logs`**, and separately assert this difference remains visible. Do not silently claim full byte-for-byte save equivalence.
- Uses `speciesLookup=()=>null` in these deterministic tests. Thus real species-triggered evolution remains a separate parity gate.

## Commands
```sh
node --test tests/battle-full-state-parity.cjs
node --test tests/battle-settlement-core.cjs tests/battle-cup-final-reward.cjs tests/battle-full-state-parity.cjs
```

## Integration gate
Do not enable live save-writing, UI log writes, production Phaser replacement, or save migration in this PR. Before a live integration PR, verify the UI log/receipt handoff, genuine evolution transformations with species lookup, old-save behavior, and failures during localStorage writes/rollback. Actual Android long-fight QA is still pending. Do not publish ROM or extracted art.
