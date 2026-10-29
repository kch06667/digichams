# PR67 — PC playability pass for farm, capture and championship

## Goal

A player should be able to see the **original game's actual farm, capture
and tournament screens**, quickly reach the relevant action and understand
what to do next, without a second demo UI replacing the existing controls.

## Player-visible improvement

On an ordinary Windows PC browser at width 900+ with a fine pointer,
a compact `PC 빠른 이동` strip appears after the original five-tab menu:

- **Farm / Alt+1:** points to the existing training settings; reads the
  selected Digimon, farm time, pause status and original training progress.
- **Hunt / Alt+2:** points to the real rope-drawing capture field; reads
  original ropes remaining and the game's actual hunt instructions.
- **Battle / Alt+3:** points to the original championship calendar or
  next match button if a cup is already active; reads original wins/losses
  and whether a championship match is pending.
- **Jump to action:** scrolls to the live original field or training/cup
  controls; it never starts a hunt, buys a facility, advances training,
  enters a cup, begins a battle or grants a reward.
- **Short help:** an optional collapsed control guide explains rope
  circle→pull, training and cup workflow. Alt+digits only work when the
  original game is not in a battle modal and there is no focused form
  field, textarea, select or editable text.
- **Honest graphics status:** a missing/corrupt, fully loaded Digimon
  img triggers a warning to check the owner's private local art.
  During normal loading or for valid images no warning is shown; the
  original sprites are never changed, replaced, downloaded or uploaded.

All this is intentionally **read-only** apart from normal clicks on
the original tabs and nonfunctional scrolling. No new localStorage keys,
save schema changes, overwriting existing progress or new gameplay rules.

The guide is injected as a separate `src/pc-playability-guide.js` by
the existing external `src/phaser-arena-entry-choice.js` script **only**
when its actual production flag is set and viewport/pointer meet PC
conditions. The huge embedded original `index.html` and
`standalone.html` remain unmodified. The mobile/touch layout stays
unchanged; the original safe Phaser preview and developer-only pages
do not receive the PC guide.

## Verification

New `tests/pc-guided-ux-browser.py` opens the **actual original**
`index.html` and `standalone.html` via localhost at 1440×900:
original nursery→hunt→battle→nursery via Alt+2/3/1, original
hunt/cup controls located, read-only contextual status, normal
input focus protection, help disclosure, synthetic broken image
diagnostic and its cleanup, and exact original user-owned Digimon
IDs / wins / losses / crowns / food / Bit unchanged. A separate
390px touch case ensures the desktop guide is not injected.

Existing full-game capture→training→evolution→championship→Phaser
save journeys, real GIF fights, tournament settlement and crash
recovery continue as mandatory CI gates. This is a usability pass;
it does **not** claim that all 216 species or NDS screen graphics
have been manually visually compared. Real Windows hands-on
screenshots and feel testing are still recommended before v1.0
sign-off.

## How to try on PC

`git pull origin main`, then double-click `PLAY_ON_PC.bat`.
With the normal PC browser sized at least 900px, use the quick bar
just under the game's tabs. Alt+1 / Alt+2 / Alt+3 works while no input
is focused; moving the mouse to or clicking the actual original
controls always works independently of the quick bar.
