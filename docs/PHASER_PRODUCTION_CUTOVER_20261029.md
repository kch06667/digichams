# PR57 — Phaser becomes the actual default battle engine (2026-10-29)

## What changed (not just a developer page)

The **checked-in** original `index.html` and `standalone.html` now load the
five existing guarded Phaser integration modules, in order, after all original
inline game scripts. On pages served over HTTP(S), the **actual owned arena
Start button** and championship fight entry select Phaser initially, without
any opt-in query parameter or generated developer HTML.

The previous original browser simulation is retained as **기존 전투 (예비)**.
If the popup is blocked or Phaser launch rejects the lineup, selection falls
back to legacy and the player can press Start again. This remains the original
real-time, autonomous AI combat, not a turn-based replacement.

For the *production* entry only:
1. Validate the real saved team/cup and open a separate same-origin Phaser
   real-time battle tab.
2. Park the farm **clock only**, preserving the prior paused/running choice;
   persist a verified localStorage snapshot and do not advance farm time
   while the battle tab is active. Phaser battle time is unaffected.
3. Accept the terminal Phaser result packet only from the correct opener,
   origin and random connection token. Stage the unchanged guarded
   per-instance, per-HP/TP, per-cup clone settlement.
4. Before writing, ensure the saved snapshot still matches the exact parked
   save. Restore the user's pre-battle pause choice, save synchronously, then
   call the same guarded backup + atomic settlement used in PR45/46.
5. Reload the real game to adopt the validated result; never let the stale
   unloading tab overwrite the approved result.
6. If verification fails or another tab changed the saved game, refuse
   automatic settlement rather than overwriting newer progress. A visible
   cancel control allows abandoning a stuck battle and resuming the farm.

The earlier **generated opt-in/developer pages** are deliberately stripped of
the tagged production injection before being built. Their existing
choice/default and manually approved battle semantics are unchanged.

## Real entry points

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

- `http://127.0.0.1:8000/index.html` — Phaser is default in the original PC
  full game.
- `http://127.0.0.1:8000/standalone.html` — Phaser is default when served
  over HTTP on mobile browsers and when `phaser-lab/` and `src/` are
  accessible on the same origin.

**Limit:** opening only the stand-alone HTML as a `file://` or Android
`content://` attachment, without accompanying project scripts and a
reachable `phaser-lab/`, cannot start the external Phaser renderer. In that
offline single-file setting the old embedded arena remains available. This
PR does not claim a self-contained Phaser APK or a single-file Phaser build.

**Private art limit:** local Phaser atlas export is still required for all
original character GIFs; the game falls back to nonoriginal placeholders
for uncached/missing species art. This is an engine cutover, **not** a
fully ROM-verified 216-species visual parity release.

## Verification and warnings

- `python3 tools/sync-phaser-production.py --check` ensures both real HTMLs
  carry exactly the approved five-script block. The PR's GitHub Action
  synchronized them without rewriting their embedded game state/logic.
- `tests/phaser-production-default-browser.py` exercises original desktop
  `index.html` and mobile-touch `standalone.html`, a real Phaser popup,
  1v1 end result, **automatic** verified result save + backup + reload,
  original instance identity, pause choice, and legacy fallback.
- The old full-game acceptance explicitly selects the legacy renderer, so it
  continues testing legacy settlement separately. Full Phaser Node and
  browser CI still exercises 2v2/3v3 and championships in the generated
  opt-in environment.
- Android physical long-session app switching, in-process Phaser rendering,
  missing/CDN-offline renderer, unfinished fights after process death,
  original ROM-accurate techniques and specific private GIF motions need
  further QA. Save an export before personally testing production cutover.

No raw Korean NDS ROM, private extracted sprites, original GIF data or
ZIP distribution is committed by this PR.
