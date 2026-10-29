# PR55 — Mobile long-play regression, 2026-10-29

## Scope

This PR adds a reproducible **browser test**, not an Android-native
performance fix. It preserves all original game JS, graphics, tournament,
hunting/evolution logic, save schema and both full playable HTML files.

`tests/mobile-longplay-browser.py` opens real `index.html` on desktop
Chromium and `standalone.html` in a touch/mobile Chromium context over HTTP,
each with separate clean localStorage. It uses the unchanged original
`DCHexFarm.tick(60)` API, 4× game speed, 30 cycles, to advance **7,200
simulated game seconds (2 game hours)**. This is **not** 2 hours of wall-clock
testing, and does not emulate Android memory pressure, thermal throttling,
low-memory killer, OS force close or battery use.

At six checkpoints it switches hunt↔nursery tabs, verifies finite Digimon
stats, unique instance IDs, bounded on-screen actor/food DOM counts, and
records Chromium CDP post-GC `JSHeapUsedSize` / `Nodes` metrics. The gate only
rejects *severe* simultaneous absolute + relative sustained increases
(>48 MiB AND >2.5× early heap, or >1,800 nodes AND >2× early count).
This is an intentionally coarse regression alarm, not proof of zero leaks.

After the simulation it exercises the actual save-to-localStorage code,
then reloads the **full original HTML twice**, comparing world seconds, day,
team identities, food, wins and paused state. No fake combat or rewards.

## Reproduction

```bash
python3 -m pip install playwright==1.57.0
python3 -m playwright install chromium
python3 tests/mobile-longplay-browser.py
```

Optional `CHROMIUM_PATH` uses an existing compatible Chromium binary.
The test starts/stops a local ephemeral HTTP server and writes no ROM,
extracted private art, personal game saves or generated ZIP.

## Limits and next verification

A passing result supports browser regression stability within the selected
scenario only. It does not guarantee Android real-device stability or an
exact original NDS simulation. For a genuine 1–2-hour **wall-clock** soak,
run the actual game on the Samsung/Android target device, switching apps,
watching memory and FPS, testing repeated hunts/battles, and force-closing at
various points; record measurable issues before changing production code.

Existing PR54 background-save and PR53 full-game journey tests independently
exercise interrupted hunting/settlement and gameplay integration.
