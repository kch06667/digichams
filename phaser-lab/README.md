# Phaser rendering lab · separate from the existing game

This is a **development vertical slice**, not a replacement for index.html / standalone.html.
No main save, battle reward, evolution or ROM-backed AI logic is modified.

## Run

1. From the repository root: `python3 -m http.server 8000 --bind 127.0.0.1`
2. Open `http://127.0.0.1:8000/phaser-lab/` in a desktop browser.
3. Use the buttons: auto battle, one training action, restart, sound toggle.

The demo loads **Phaser 3.90.0 from a version-pinned CDN**, so the browser needs
internet access. Without exported GIF assets, the demo uses freshly drawn,
copyright-free procedural placeholder characters. Training bonus, attack damage,
AI turns and timings are **demonstration-only**, not NDS reverse-engineered.

## Test existing GIFs locally — private use only

Run from the repository root with Python and Pillow available:

```sh
python3 -m pip install Pillow
python3 tools/export-phaser-atlas.py --species 아구몬
python3 -m http.server 8000 --bind 127.0.0.1
```

Reload `http://127.0.0.1:8000/phaser-lab/`. The exporter writes:
- `phaser-lab/local-assets/manifest.json`
- `phaser-lab/local-assets/action_<index>.png`

**Do not commit or share those outputs.** The folder is ignored by Git.
This conversion preserves every GIF frame and its source GIF duration and pads
**all actions to one shared canvas size** to avoid pose-dependent scale jumps.
It deliberately only exports one test Digimon. The input GIFs remain untouched.
Not every GIF contains multiple frames (notably training action 32 can be static).

Action 30 is user-confirmed **victory**, 32 is user-confirmed **training**.
The short attack motion adjacent to original training remains unverified.
The demo temporarily plays 32 followed by attack 7 to test the choreography,
not to assert that this is the ROM's exact training sequence.

## Tests

```sh
node --test tests/phaser-lab.cjs tests/phaser-preview.cjs
python3 -m unittest discover -s tests -p test_phaser_atlas.py -v
```

The first tests run offline. The synthetic GIF conversion test needs Pillow.
Full Phaser WebGL/Canvas rendering on physical Android still needs manual
verification. The original DOM game and save format have not been migrated yet.

## Web delivery — art-free preview only

```sh
node tools/build-phaser-preview.cjs
```

Produces only three allowlisted Phaser demo files and build-info.json under
`dist/phaser-preview`. This **intentionally excludes original game pages,
sprites, ROM art, and generated local GIF sheets**. A GitHub Pages workflow is
provided for merging into main after review. Pages must be configured in repo
settings for deployment to work. Browser updates happen on reload/revisit,
not by replacing active JavaScript mid-game. This preview has no save data.

## Next integration steps

- Verify 0–39 sprite meanings using Codex's separate ROM analysis.
- Use a shared render contract (pose, orientation, position) and a spritesheet
  manifest without coupling game rules to Phaser.
- Replace one existing battle renderer behind a feature flag only after
  comparing full battle outcomes and old-save roundtrips.
- Keep handling of owner-provided copyrighted artwork private; obtain proper
  authorization before any public game release.
