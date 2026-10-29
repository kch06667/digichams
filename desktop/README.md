# Digimon Championship — Windows desktop pilot

This is an **independent desktop window for the existing game**, not a ROM
patch or an emulator. Game files remain under the repository root. The game
logic and save data are not rewritten by this pilot.

## Windows development

1. Install Node.js LTS (npm included).
2. Open a terminal inside the repository's `desktop` directory.
3. Run `npm install`.
4. Run `npm start` to open the existing game in an Electron window.
5. Run `npm run build:win` to build a **portable Windows EXE** in `dist/desktop`.

An EXE has **not** been produced or verified by adding this configuration.
Windows build/signing and actual gameplay still require testing.

## Important limitations

- The packaged game has no browser URL bar but uses the same HTML/JS engine.
- Existing save/localStorage behavior must be checked for migration from
  Chrome; Chrome browser saves do **not** automatically transfer to Electron.
- Assets are packaged only from explicitly configured paths, not the repository
  root. Do not publish third-party copyrighted ROM/sprite assets or built EXEs
  without the appropriate rights.
- Test startup, images, gameplay, save/reload, 1366×768 resolution, and
  antivirus false positives on Windows before calling this playable.
- The existing website remains a development preview; PC UI cleanup is tracked
  separately in PR #70.

## Scope

This pilot changes only the desktop launcher / packaging configuration.
It does not alter farm, hunt, evolution or battle calculations.
