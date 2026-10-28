# Optional owned battle settlement — experimental generated build (2026-10-29)

This is an **opt-in playable experiment**, not a production change to index.html, standalone.html, GitHub Pages, or the default game. It uses the original HTML game and adds a separate per-session switch that is OFF at every fresh page load. ROM assets, extracted sprites, and save files are never committed by the build.

## Build locally

    node tools/build-owned-battle-optin.cjs dist/battle-optin
    # For standalone additionally (large output; local only):
    node tools/build-owned-battle-optin.cjs dist/battle-optin --all

Run a local HTTP server at the repository root (for example python -m http.server 8000), then open /dist/battle-optin/index.html in a desktop browser. The original /index.html remains the default game. Do not publish generated files automatically. The generated index includes its embedded assets from the existing game; do not redistribute without addressing source rights.

## Enabling safely

1. Export a playable-game save file using the existing game controls first. Keep that export off the device.
2. Finish or close any active combat before opting in. Explicitly save the game from the game's UI. The new helper **requires** that the exact in-memory JSON already exists in localStorage.
3. Open the bottom-right "실험적 전투 정산 (기본 꺼짐)" panel. Check "새 전투 저장 사용". The helper checks the current checkpoint, verifies a first-use backup that is retained for the entire experimental session, then verifies a per-fight backup. If backup creation fails, opt-in stays OFF.
4. Use the original owned-battle arena. Only normally finished owned fights take the new path. Aborted fights, sandboxes, and the regular HTML build continue using the original settlement.
5. Use "보관된 백업 다운로드" to export the most recent backup. If there is a write/verification error, the experiment will not retry or perform a fallback settlement; reload to assess which result actually persisted. Keep the user export and back-up copy before any manual recovery.

Backups use localStorage keys dc_recreation_save_backup_owned_optin_v1 and dc_recreation_save_backup_owned_optin_first_v1; the first one is written only if absent, and neither is silently overwritten by the replay rejection path.

## What is verified

- The generated HTML preserves original checked-in HTML (same file contents untouched).
- CI builds the opt-in game and uses Chromium desktop and mobile-touch emulation to confirm OFF-by-default, explicit enable, backups, downloadable JSON, disable and reload resets.
- Unit tests cover 1v1 and duplicate-species 2v2 match data, missing old TP values, save failure, denied backups, and stale checkpoint protection.
- The original full-state and species-evolution settlement parity checks continue separately.

## What is NOT yet verified

- An end-to-end **real owned battle with the experimental toggle enabled**, using natural arena simulation through completion in a physical Android device. This requires manual QA before upgrading the main page.
- Transactionally restoring a save from different tabs/power failure, true Android app crashes, browser eviction, unsynced autosave behavior in every game mode.
- The NDS's original AI and animation completeness. This is a limited web port prototype; one PR is not the final game.

If the opt-in fails, use the unchecked state (or launch /index.html) until recovery has been assessed. Do not force an unverified rollback that can erase a newer save.

## 2026-10-29: real original arena completion smoke (CI)

Run the diagnostic-only generated build (never ship this generated HTML as the normal user build):

    node tools/build-owned-battle-optin.cjs dist/battle-optin --qa
    python3 tests/battle-owned-completion-browser.py

This test clicks the real game owned-arena launch/start controls on a fresh Chromium origin, explicitly opts into new settlement, and invokes the original arena AI's real `update(0.048)` loop through a **separate, QA-only clock driver**. It does **not** set a winner or damage an opponent by test code. The real arena decides via KO or 135-second timeout, calls the real `settleMatch` opt-in branch and validates the persisted finished result: pendingBattle removed, one winner/loser result, evolved battle count, logs, retained backup and no duplicate rewards after reload. Both desktop and touch-sized Chromium contexts run.

This is a fast-forward of original game logic without frame drawing, not proof of 135-second physical device performance or animation fidelity. The `--qa` flag is **never** used for ordinary `node tools/build-owned-battle-optin.cjs` builds and the real `index.html` remains unchanged. Tests must fail if the QA helper leaks into the default build.

After this gate, additional end-to-end cases remain: deterministic win *and* loss, tournament reward, evolution, storage failure during a completed arena, real Android long-session and memory/performance QA. Keep opt-in off by default.

### KO state sync validation

The original arena calls `syncBattleHP()` during fighting and can persist HP=0 for a knocked-out participant **before** its normal `settleMatch`. The detached validator now accepts zero pre-settlement HP **only when the same identity/slot/name/vitals/active pendingBattle match and the final fighter also has HP=0**. It continues refusing a zero-HP saved fighter whose final result claims positive HP. This specifically fixes a natural-arena loss caught by the first E2E run, without weakening duplicate settlement rejection or permitting arbitrary resurrection.
