# PR63 — Storage-fault-safe production Phaser pre-fight save / recovery

## Actual reliability issue

PR62 correctly recovered a farm which had been persisted in paused mode
during an interrupted production Phaser match, **if** a lease already
existed. But its start order was:
1. write paused farm save;
2. read back;
3. write recovery marker.

An Android/browser process termination between (1) and (3) could
persist a frozen farm without a recovery marker. Error handling also
attempted an unconditional rollback save after storage exceptions and
cleared recovery markers even if a rollback failed. During an explicit
cancel, such failures could leave an uncaught exception and hide the
recovery instructions.

## Changes

- **Recovery intent first:** write and read back a versioned matching
  recovery marker plus tab identity BEFORE writing the paused save.
  The marker includes a byte-for-byte copy of the predicted paused
  snapshot. If killed before saving, the old game save remains and the
  mismatched marker can be discarded; if killed after saving, a matching
  marker is ready for same-tab recovery. The regular original game's
  save(false) remains responsible for the save itself, not a new writer.
- If the preflight write errors, restore the in-memory pause preference
  and roll back the persisted save **only if it exactly matches the
  checkpoint we wrote**. If already the old unpaused save, clear the
  abandoned marker without writing. If a rollback write/readback is
  rejected, keep the recovery marker for a later reload and give an
  actionable warning. No newer other-tab save is rolled back.
- On interrupted-fight restore, verify the saved game actually contains
  the restored clock. If a storage write fails, restore the live frozen
  clock and keep the recovery marker; no false success or reward.
- On cancel, check the storage rollback and readback, retain the matching
  marker on failure, close the battle iframe and remove stale message
  listeners. A storage exception stays inside the recovery handler rather
  than bubbling out of the click event. If another tab has a newer save,
  preserve the warning instead of replacing it with a misleading success.
- Cleaning marker/tab metadata is best-effort if storage access is
  denied. No personal save or private sprite data is uploaded, no save
  schema or original battle calculations change.

## End-to-end verification

In real original `index.html` and `standalone.html`, the browser
regression intentionally simulates:
1. quota error while writing the recovery marker: game never starts,
   original disk save remains, original pause/ID/wins retained;
2. quota error on paused game-save write after a valid marker was
   prepared: cancel launch, clean orphan metadata, leave save unchanged;
3. a silent no-op game-save write: readback detects it, never claims a
   successful battle;
4. error while saving an explicit mobile-touch cancellation: battle
   closes with a recovery warning, paused checkpoint + lease retained;
   after reloading, recover clock, preserve identity, do not grant wins
   or rewards.

Existing PR62 same-tab reload, other-tab newer-save protection,
real in-game original PC/mobile 1v1 Phaser settlement, tournament,
3v3, original legacy completion and full original game journey must
stay green in GitHub Actions.

## Non-claims / remaining risk

Web Storage offers **no cross-key atomic transaction** and an OS can
kill a process without even running a JS callback. Intent-before-save
closes the specific gap without claiming general power-loss atomicity.
There is still no mid-match resume, and Chromium touch emulation is not
a physical Android crash/profile/long-play measurement. The recovery
lease duplicates the paused checkpoint string in localStorage (subject
to browser quota); failures explicitly cancel the new fight rather
than discarding existing progress. Gameplay art and NDS ownership
requirements are unchanged.
