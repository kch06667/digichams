# PR66 — PC local Phaser runtime + offline longplay release gate

## Player impact

The PC `PLAY_ON_PC.bat` path (from PR64) previously served the original
full game over localhost, but each real battle iframe fetched the pinned
Phaser 3.90.0 engine from jsDelivr. Without internet, the farm loaded but
the **actual new combat screen could fail** and force a legacy fallback.

PR66 fixes that for the **local PC launcher only**:

1. The launcher checks `phaser-lab/local-assets/vendor/phaser.min.js`.
2. It accepts only SHA-256
   `e92ddef111ba42e92d316979c732311757093688ea1810591cb7aa2858eba7a7`
   of the official pinned Phaser **3.90.0** npm-distribution file.
3. If the private cache is absent, copy a verified locally installed
   `node_modules/phaser/dist/phaser.min.js`; otherwise download the
   fixed-version HTTPS release **once** and verify the complete bytes
   before atomically caching. A hash mismatch, incomplete transfer,
   permission error or inaccessible network stops the launcher safely
   without modifying the player's browser save.
4. All later launches reuse the verified local engine: **no internet
   needed for Phaser battles**. No Node.js/npm install is necessary
   if the verified HTTPS download succeeds on first launch.
5. Only the local Python game server rewrites the one pinned CDN script
   in `/phaser-lab/index.html` to
   `./vendor/phaser.min.js`. The protected original code and public
   Phaser safe-preview source/build continue to use their existing
   independent distribution path. Server GET/HEAD for the vendor path
   validates its SHA-256 again; the generated local runtime remains
   Git-ignored and is never uploaded.
6. Default server binding stays `127.0.0.1`. The original complete
   game, player saves, original GIF sheets and ROM remain local. The
   optional `--lan` mode still requires explicit player opt-in.

**First launch still requires internet** if the Phaser runtime is not
already installed/cached. The game cannot be run fully offline on a fresh
checkout with neither dependency present. After one verified preparation,
network can be disconnected for the next launcher run and battle.

## PC real browser verification

`tests/test_play_local.py` now injects tiny **synthetic** JS bytes and
hashes to verify fail-closed behavior: offline repeat reuse, corrupt
cache, mismatched HTTPS download, atomic write, local HTML script
rewriting, and protected local vendor GET route. No official Phaser
binary is committed or copied into this repository.

`tests/pc-offline-phaser-soak-browser.py` uses the real full-game
`index.html` on an isolated localhost server with **all browser HTTPS
traffic aborted and recorded**. The CI runner installs a public pinned
Phaser test dependency and locally exports owner-provided GIF sheets.
The test checks:
- original production Phaser engine chosen without network/CDN;
- three successive 1v1 real autonomous matches, original result
  transaction/backup, auto-reload and exact owned Digimon identity;
- runtime-rendered actual original GIF art vs temporary fallback;
- 7,200 seconds of **accelerated world time**, checkpoint saves,
  two additional reloads, matching team IDs and no duplicate result,
  pending battle or stranded recovery marker;
- bounded browser heap using best-effort post-GC Chromium metrics;
- no page errors and zero external network requests during the entire
  tested game session.

For deterministic repeated fight availability the test fixture
temporarily boosts one starter's HP/TP/attack/defense/stamina. The
original real-time AI still determines each battle's winner; the
test does not fake results or directly grant rewards. These are
**accelerated simulation and Chromium memory probes**, not two hours
of real time and not proof that every PC/GPU/drivers combination is
stable for long sessions.

## Run

After merging PR66, update the current GitHub checkout with
`git pull origin main` and double-click `PLAY_ON_PC.bat`.
The first run obtains a verified pinned engine if needed and prepares
the owner's private sprite sheets. Close the server window after
playing. On later runs, the user can disconnect the PC's internet
and still run the default in-page Phaser fights.

Remaining PC 1.0 work: user-in-hand visual/UI fidelity checks for the
full game and all 216 species, ergonomics, real-wall-clock multi-hour
soak across desktop browsers, and actual NDS motion/effect
equivalence where source evidence supports it. The mobile device
optimizations remain deferred as requested.
