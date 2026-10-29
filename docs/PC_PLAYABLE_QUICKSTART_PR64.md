# PR64 — PC-first playable setup and incremental local sprite repair

## Why this update, rather than another battle animation micro-patch?

The player now prioritizes **one usable desktop web game** over Android
optimization. The current launcher already converts original indexed
GIFs for all 216 species to private Phaser motion packs, but if even
a single PNG or manifest is missing it used to regenerate **every**
species. That is a large unnecessary CPU/disk delay on a Windows PC.

## Delivered

- `PLAY_ON_PC.bat`: from the current checked-out game directory,
  **double-click** to open the real production `index.html` through
  `tools/play_local.py`; it keeps the local-only HTTP server alive
  until the console is closed. No `--lan`, game save reset, ROM extraction,
  asset redistribution, remote upload, admin rights, or silent pip install.
  It checks Python 3 launcher and Pillow before trying to start. If a
  prerequisite is missing the console stays open with a clear action.
- `tools/play_local.py:missing_art` inspects a complete locally cached
  216-species index and each recorded `species/m*_*/manifest.json` plus
  all required 13 nonempty motion sheets. Only species with missing or
  invalid metadata or image files are sent to existing
  `export-phaser-roster.py --species ...` equivalent (direct import).
  A ready cache is reused without rewriting anything.
- Local, unrecognized or corrupted `catalog.json` now causes an explicit
  diagnostic rather than silently overwriting indexed metadata or source.
  `catalog_ready` remains available to other callers.
- The existing `GameFileHandler` remains loopback by default, blocks
  direct requests to original ROM/save/data and Git tooling directories,
  and uses the existing source game's `index.html`. No change to
  battles/AI/animations/save format/clock/bonus rules.

## Verification and limits

`tests/test_play_local.py` creates **only synthetic** 216-species
manifest and image metadata and also real tiny local generated GIF
inputs for two damaged species. It verifies that the other 214
existing species are untouched, one empty file is detected, malformed
catalogs are rejected without deletion, all 216 are ready after repair,
and a second start skips conversion entirely. It statically verifies the
double-click batch launches the local production game without LAN.

Full Phaser browser CI (real original source game desktop and touch,
real original GIF 3v3, tournament, guarded save/recovery) remains required
before merge. These are PC-browser readiness changes, **not** proof of
pixel-exact NDS effects, physical Android reliability, or full v1.0
content balance.

## Start on Windows

1. From your existing checkout: `git pull origin main`
2. Once: `py -3 -m pip install Pillow` (if Pillow not already installed)
3. Double-click **`PLAY_ON_PC.bat`** (or run
   `py tools/play_local.py` from PowerShell).
4. Confirm the browser opened `http://127.0.0.1:8000/index.html`,
   choose a Digimon, and enter the actual **Phaser live battle**.
5. Leave the console open while playing. Closing it stops the server,
   **not the browser's saved game**. Browser saves are origin-specific.

No ROM, private sprites, user save or generated ZIP is included in Git.
