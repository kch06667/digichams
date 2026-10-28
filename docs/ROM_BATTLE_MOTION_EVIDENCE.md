# 2026-10-29 battle animation/ROM evidence checkpoint

This is an evidence log, **not** a declaration of byte-for-byte NDS
battle/skill equivalence. No private ROM bytes or animated artwork belong in
GitHub, CI artifacts, public Pages or this document.

## What was checked against supplied local sources

- Korean NDS file `디지몬 챔피언쉽(K).nds` SHA-256:
  `2092998ee80d6646c7115ef8f008f955e72e1860c718dc8d7cbc3b8cea9f2234`
  equals the hash in `ROM_effect_pointer_registry.json`.
- Overlay 19 is at local ROM offset `0x1ef600`; load RAM base
  `0x0210e8a0`; effect name pointer table starts at overlay `+0x26234`.
  Direct little-endian pointer dereference confirms **151 named strings**
  in slots **1–151**. Selected examples: slot 7 `e003_fireball00`,
  slot 21 `e003_missile00`, slot 38 `e003_rocketpunch00`,
  slot 75 `e003_gigadestroyer00`, slot 79 `e003_H_claw`.
- This proves the **existence and location of effect resource names**,
  **NOT** which Digimon fires which effect, the animation state's numeric
  meaning, or the exact timing of the in-game draw call.
- Owner-provided v0.23.2 graphics ZIP: **216 unique** species; **8,640**
  resolvable action GIFs (40 per species), **14,179 total frames**, **4,963
  GIFs with more than one frame**, **17 frames with a genuine 10ms delay**.
  No missing or unopenable indexed GIFs in this archive.
- Action 0: 216/216 animated. 5 (candidate hit): 216/216 single-frame.
  30 (user-confirmed victory): 216/216 animated. 32 (user-confirmed
  training): 215/216 single-frame, 1 multi-frame. 33 (candidate shout):
  216/216 animated. 37 (candidate KO): 216/216 single-frame.
  7–10 (existing attack candidates) have multiple frames for all 216.
  The corrected `m357_unimon_main_5_1.gif` is substituted for Unimon 5
  based on the previous pixel comparison; this does not prove the *meaning*
  of every action number.

## Implementation in this PR

- Exporter retains **source GIF 10ms durations**, not silently doubling
  them to 20ms. The renderer's Phaser per-frame timing base is 10ms, so
  `base duration + extra duration` reproduces source metadata. A physical
  60Hz screen is still unable to display every 10ms frame distinctly.
- Existing arena presentation still prioritizes **KO slot 37** and
  **victory slot 30** over stale attack poses; the existing original-HTML
  battle sequence selects candidate shout 33 and attack 10 for a special
  charge/release. These are verified **against the current webgame source**,
  *not* NDS hardware video.
- Rendered projectile shape is now visibly different for the current web
  extension's `orb`, `missile` and `claw` technique metadata, using no
  ROM-extracted effect textures. These visual shapes **do not change**
  hit registration, HP, TP, knockback, AI or saved results. There is **no
  speculative species→ROM effect ID mapping**.
- New `tools/audit-phaser-rom-battle.py` reproduces all GIF timing
  observations from private indexed GIFs, and `--rom ...` independently
  verifies the 151 effect pointers on the owner's **private** Korean ROM.
  It only prints numeric metadata and safe string names to stdout.

## Reproduce on an authorized private checkout

```powershell
py -m pip install Pillow
py tools/audit-phaser-rom-battle.py
py tools/audit-phaser-rom-battle.py --rom "C:\\path\\to\\디지몬 챔피언쉽(K).nds"
py tools/export-phaser-roster.py --species 아구몬 --species 가부몬
node tools/build-phaser-optin-page.cjs
py -m http.server 8000
```

Run `node --test tests/phaser-lab.cjs` and
`python -m unittest discover -s tests -p 'test_phaser_*.py' -v`.
GitHub CI verifies 216-source GIFs and browser rendering without shipping the
ROM or source art; it uses synthetic pointer fixtures, **not the real ROM**.

## What still prevents "combat 100% complete"

1. Find actual ROM species/technique → `e003_*` effect IDs with confirmed
   code/data references or runtime emulator instrumentation.
2. Compare original NDS gameplay recordings with **all 216 species** for
   animation slot meaning, directional flip, rendered offset, projectile
   trail, impact frame and movement/attack timing.
3. Validate combat AI/TP, damage and critical logic against the ROM, not
   only current webgame parity. Present tactics and skill metadata include
   deliberately unverified values.
4. Physical Android hardware soak/performance, memory and long-run
   save-recovery testing; final normal `index.html` production cutover.

This PR completes a **fidelity audit and a measured visual improvement**,
not these four remaining tasks.
