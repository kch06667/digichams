# PR56 — Phaser beta-first rollout with safe legacy retry (2026-10-29)

## Purpose / scope

The original browser game already has a developer-only generated Phaser arena:
1v1, 2v2, 3v3 and original novice/regional/grand championship handoff
are tested separately. It is not yet safe to change default combat for every
player or write results without approval. This patch prepares a reversible
**opt-in beta-first route**, without altering `index.html`, `standalone.html`,
combat arithmetic, tournament awards, game saves, or sprite assets.

## Play locally

```sh
node tools/build-phaser-optin-page.cjs
python3 -m http.server 8000 --bind 127.0.0.1
```

- `http://127.0.0.1:8000/index.phaser.html?phaserBattle=1`:
  **existing/legacy engine selected by default**, unchanged.
- `http://127.0.0.1:8000/index.phaser.html?phaserBattle=1&phaserPreferred=1`:
  explicit, experiment-only **Phaser initially selected** on the original
  owned-arena and tournament chooser. The user may still choose the legacy
  engine at any time. The preference is from the URL only, not persisted.
- Normal `index.html` and `standalone.html` do not load this chooser at all.

When an original arena Phaser popup cannot open, the canceled click does
not start a battle, record pending state or settle anything. It now switches
the chooser back to **existing engine** and tells the player to press the
original Start button **again**. This avoids a silent second engine launch or
the impression the attempted Phaser fight was recorded. Eligibility errors
also reset to the legacy selection. Tournament bridge launch rejection
similarly resets the choice; the original championship UI remains responsible
for restoring its awaiting-match marker.

The Phaser result remains **read-only until the separate explicit Approve
Save** action. That action already validates participants/HP/TP/cup identity,
checks storage baseline, creates verified backups, and atomically replaces the
save. The beta-first switch does not bypass any guard or auto-approve results.

## Regression

`python3 tests/phaser-preferred-fallback-browser.py` uses the **real full
generated game** on Chromium desktop and mobile-touch contexts, checks legacy
default, explicit preferred state in arena/cup, no auto-approval, simulated
popup denial, unchanged result counters, pending state, IDs and backup key,
then a second click running the real original battle without another tab.
`.github/workflows/phaser-slice-tests.yml` also executes the existing 1–3
fighter, championship, backup, save and animation regressions.

No private ROM, generated original sprites, extracted GIF data, or ZIP is
uploaded. Real Samsung Android and all 216 species in actual hardware are
not proven by Chromium emulation.

## Next gate toward production default

Before promoting the generated beta option into the real game entry:
verify Android popup/tab usability, poor-network Phaser availability,
physical-device memory/FPS under long autonomous matches, interruption
during tournament finals and exact named-opponent/HP/TP/save parity. Keep
a player-visible legacy fallback and separate approval until those pass.
