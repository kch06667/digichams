# v0.14.5 QA report (2026-10-26)

## Actually run in this environment

- `node tests/farm-core.cjs`: **16 / 16 PASS**. Time acceleration, command movement, HP/fatigue, food, automatic rest, storage freeze, facility benefits, status persist serialization.
- `python tests/hex-browser.py`: **6 / 6 PASS**, page errors 0. Existing battle/ROM UI, commands, food/rest, pause, mobile board.
- `python tests/save-browser.py`: **6 / 6 PASS**, page errors 0. Legacy quick buttons now timed, auto-rest checkbox, JSON export/import, malformed save rejection, mock Storage state recreation, mobile overflow.

## Limits

- Headless Chromium in this sandbox blocks both localhost and file:// navigation (ERR_BLOCKED_BY_ADMINISTRATOR). The persistence test uses a freshly created page with a carried-over **mock** localStorage, not a verified device-native reload. Real Android/Chrome refresh still requires manual QA.
- Older `tests/regression.cjs` / `tests/integration.cjs` require `jsdom` / Node Playwright, which are NOT installed here, so they were NOT rerun. Past results are historical only.
- The facility stat modifiers and timing are original-game unverified extension balance.
- All original NDS battle/evolution rules require further ROM verification.
