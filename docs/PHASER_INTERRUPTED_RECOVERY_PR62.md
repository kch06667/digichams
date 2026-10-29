# PR62 — recover an interrupted Phaser match without a false reward

## User-visible problem

The real production browser game (`index.html`, `standalone.html`) pauses the
farm-world clock before launching the same-tab Phaser iframe and saves that
paused state to prevent time/auto-save racing combat. Before this change,
a browser refresh, Android process loss or navigation **before the validated
result arrived** could reload the farm with `world.paused=true`, even
if the player had originally chosen to let time advance.

## Recovery contract

- At the start of each **production** Phaser battle, after the existing
  verified saved-state checkpoint, record a versioned temporary recovery
  lease in **same-origin localStorage**. It holds the exact existing saved
  bytes, an unpredictable 128-bit token, the previous pause preference and
  creation time. Store its token in **sessionStorage** for same-tab identity.
  Nothing is sent to a remote server or inserted into the Phaser frame.
- On an ordinary same-tab reload (including a tab restored by the browser),
  auto-recover **only** when the session token and persistent lease match
  and the current saved game bytes still equal the lease's checkpoint:
  restore only `world.paused` to its pre-fight value using the game's
  existing save function. No match completion, rewards, HP/TP mutation,
  pending-battle marker or trophy is invented.
- If the original tab is gone and the player opens another tab, **never
  auto-recover a possibly active match from another tab**. Display a manual
  recovery button; it becomes effective only after three minutes and an
  explicit player click. A genuine match might still be active on the
  other tab; use manual recovery only after closing that tab.
- If the persisted save differs from the exact checkpoint, do **not**
  overwrite a newer save or grant a battle reward. Discard the stale lease
  instead of resurrecting an obsolete combat save.
- On a successful guarded settlement, user cancellation, handshake timeout,
  or other ordinary completed/failed exit, remove only the matching lease.
  Also remove message listeners on cancel/timeout so delayed iframe messages
  cannot settle a canceled match.
- A storage/lease write failure cancels the proposed battle before play,
  restores the previous pause preference and keeps the existing save usable.
  The separate developer popup/explicit-approval mode does not create
  production leases and continues to work as before.

## Regression gate

`tests/phaser-production-default-browser.py` runs actual production
`index.html` on desktop and `standalone.html` on touch:
- start a real 1v1 Phaser in-game fight (no extra tab),
- verify exact checkpoint and tab token,
- reload before its terminal packet,
- verify farm clock restored, instance IDs unchanged, no win/loss or reward,
  no pending battle, and both recovery records cleared.
Existing explicit cancel case now asserts matching recovery records are
removed. Both normal completed-match paths retain original guarded
backup, settlement and reload tests. The comprehensive original
1–3v3, championships and mobile browser suite remains enabled.

## Known limitation

Chromium touch emulation does **not** prove all Android process-kill
patterns retain sessionStorage. If the tab session record does not return,
the player can explicitly restore after three minutes only if the exact
saved checkpoint is unchanged. A physically interrupted match is
*abandoned*, not resumed mid-attack. Exact original NDS rendering and
offline graphics still need separate work. This is a user-save safety fix,
not a claim of 1.0 final completion.
