# PC 1.0 integrated playthrough — original save, both battle engines (PR65)

## The gap this catches

The original 4-way (PC/touch, `index.html`/`standalone.html`)
one-save acceptance journey tested real hunting, timed care, evolution,
legacy arena and championship, with a QA-only deterministic legacy
combat outcome. Independent Phaser smoke tests tested in-page matches,
but **not a Phaser match after a real hunt, evolved starter, cup reward
and save export/import on the SAME persistent game**.

A source game may pass both independently while still dropping a caught
monster, tournament crown, training, evolution or JSON archive when
the live Phaser match is committed/reloaded.

## New PC milestone

`tests/pc-complete-phaser-journey-browser.py` runs in a *single*
desktop Chromium browser context using genuine original `index.html`:

1. Original capture UI: trace rope, capture wild Digimon; use existing
   hunt save/reload path (same helpers as the original full journey).
2. Original timed farm training, explicit Koromon → Agumon evolution
   goal, repeated legacy matches + novice championship. The legacy
   combat QA hook uses documented deterministic forced enemy defeat;
   it is **not** presented as a natural-AI combat validation.
3. Preserve both unique Digimon identities, captured species, genuine
   training score, original cup crown, win/loss and facility Bit baseline.
4. Without replacing/recreating that save, open the *production-default*
   Phaser in the **same original browser tab** and run an authentic
   in-page 1v1 **without injecting stats, HP, a winner or rewards**.
   The existing QA helper advances original autonomous AI to finish.
5. Verify guarded Phaser completion and automatic original-page reload.
   It must add exactly one win or loss while preserving two identities,
   captured species, training, championship crown, saved pause
   preference, and existing facility currency. No duplicate result or
   orphan recovery lease is permitted.
6. Export the *combined* official `digicham-save` JSON, import it
   through the original rollback-safe API, reload again and check
   roster/crown/win totals and import backup.

The test only touches synthetic in-CI browser game saves and
transient local browser state. It never publishes or commits licensed
original assets, ROM files, or personal save files.

## Scope / honest limits

- This is the critical **PC single-save bridge acceptance** rather
  than a new game mode or a claim that original art/skills match NDS.
- Other dedicated CI flows still test real six-source-GIF Phaser
  3v3 PC/touch and real 1v1 default Phaser, plus championship,
  save crash recovery and interrupted commits.
- It does **not** yet replace physical long-session PC playtesting
  and original NDS visual/move-by-move fidelity review. It covers
  one original full journey path and one real Phaser continuation.
- The original single-save acceptance harness gives the legacy
  opponents deterministic HP=0 for evolution/cup progression. The
  subsequent Phaser encounter advances the original autonomous AI
  without a forced win or stat boost, and accepts either result.
