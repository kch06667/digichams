# PR68 — Desktop visual layout pass (farm / capture / cup / battle)

This is a **PC-first presentation change**, not a reimplementation of the
original NDS graphics or a gameplay balance change. It builds on PR67's
read-only desktop navigation bar.

## Actual source/layout observations

Inspected the existing original full-game HTML + CSS and an available
v0.23.2 playable graphics archive. That archive is a **baseline**, not
the current GitHub production version. A direct local Chromium screenshot
attempt was blocked by the container's browser policy, so **do not treat
this as a human-reviewed visual pixel comparison**. The actual latest
GitHub desktop render is exercised by Chromium CI with measured DOM
geometry and computed styles, not screenshots uploaded to a public repo.

Problems found in source:
- The original header has **five tabs**, while its common desktop
  CSS sets **four grid columns**, wrapping the ROM tab onto another row.
- The capture field shares almost equal columns with help/statistics,
  leaving a narrow gesture canvas even on a wide PC monitor.
- Facility chips, scrollable 920×690 farm map, training controls,
  hunt actions, and tournament cards have small type and inconsistent
  action sizes and spacing.
- The real fullscreen Phaser overlay has no centered maximum content
  width for very wide displays.

## Changes

New standalone `src/pc-visual-polish.css` loaded by the existing
`src/pc-playability-guide.js` **only on a fine-pointer desktop with
viewport at least 900px in the production game**. Existing script
already chooses whether to display desktop-only controls. Original
`index.html`/`standalone.html`, original sprite assets and mobile
CSS are not edited.

- **Display modes:** original startup can be the deliberately narrow
  **NDS two-screen layout** (roughly 560px shell / 330px farm viewport).
  PR68 leaves that mode intact. The PC quick bar now offers an explicit
  **PC 확장 화면** button using the game's original `wideMode` action,
  with no automatic preference or save change. The larger dimensions
  below are checked **after selecting expanded PC mode**.
- **Top navigation:** five equal columns, readable 45px-high buttons
  and explicit keyboard focus / active-tab borders.
- **Farm:** more distinct resource chips, centered scrollable map frame,
  taller viewport, grouped training controls, larger training progress
  and 44px buttons. **Original 920×690 map image is never stretched**;
  simulation hex coordinates and character animations remain untouched.
- **Capture:** first panel gets more width, the existing rope gesture
  canvas gets a larger frame, legible instructional callouts,
  2×2 action control grid and clearer rope/HP readouts.
- **Battle / championship:** improved real original two-panel layout,
  legible tournament cards in flexible columns, bracket emphasis,
  45px cup enrollment buttons and source-game status preserved.
- **Phaser dialog:** adds a focused PC frame/header treatment while
  retaining original full-window overlay, close control, autonomous AI,
  commit and save behavior.
- Narrow PC breakpoints and reduced-motion preference are supported.
  Touch/mobile remains under existing unmodified CSS.

## Automated acceptance

Existing `tests/pc-guided-ux-browser.py` now validates the actual
`index.html` and `standalone.html` desktop game at **1440×900**:
- loaded stylesheet and explicit use of original wide-mode switch;
- loaded PC stylesheet;
- all five original tab buttons on a **single row**, proper target sizes;
- no body horizontal overflow;
- original 920×690 farm dimensions and existing original farm bitmap;
- capture field usable dimensions and larger action buttons;
- cup cards legible in the actual championship panel;
- original tab shortcuts, input focus protection, sprite error notice,
  **unchanged exact real save IDs/wins/losses/Bit/food/crowns**.

It additionally narrows the same original window to **1024×768** and
verifies single-row tabs / no overflowing document / preserved map.
A separate 390px mobile-touch test verifies neither guide nor new
desktop style is injected. These automated checks are regression gates;
they are not a substitute for actual manual PC visual review.

Full independent original single-save journey and existing
Phaser PC/touch, offline multi-fight soak, guarded settlement/backup
and 2v2/3v3 championships still must pass before GitHub merge.

## User verification

After merging: `git pull origin main`, run `PLAY_ON_PC.bat`, use
a desktop Chrome/Edge window at least 900px wide. Select
**PC 확장 화면** in the quick bar (or the original **▤ 확장 화면**
button), then compare the top five tabs, the 920×690 farm art,
rope field and cup
cards. Original private GIFs / ROM remain local; **no screenshots
containing the user's game art are published into Git**.

Next work after screenshots: adjust specific spacing/background/color
issues based on user-in-hand actual PC rendering. Pixel-perfect NDS
visual restoration and 216-species motion QA remain separate work.
