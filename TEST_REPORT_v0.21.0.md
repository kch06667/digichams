# v0.21.0 사냥 시스템 테스트 보고서

2026-10-26. Based on user-provided v0.20.0 ZIP; preserved all original sprites and gameplay code.

## 구현
- 원작식 `탐색 → 로프 선택 → 원을 그리고 손을 뗌 → 여러 번 적당히 당김 → 기절 → 손으로 잡기`.
- PC mouse / Chromium simulated Android mobile touchscreen PointerEvent handling.
- Wild roaming and temporary flee countdown, rope-break failure, stage-dependent rope ranks, illustrated forest/coast/ruins, bait cost, capture into state.team using existing makeMon/evolution/farm migration.
- Does not consume rope on an invalid circle. One rope is spent only on binding.
- Both HTML bundles contain identical source from src/hunt-core.js, src/hunt-ui.js, src/hunt.css.

## Test results
- Node core: farm 30, evolution 12, evolution lineage 18, species 9, facility 16, care 11, hunting 14 = **110 / 110 passed**.
- `python tests/hunt-browser.py`: **2 / 2 passed**: index.html desktop mouse, standalone.html Chromium simulated touch (40 touch-move points, repeated drag, hand click, new teammate).
- Prior browser regressions: `care-browser.py` 2 / 2, `cage-browser.py` 2 / 2, `evolution-browser.py` 2 / 2, `save-browser.py` PASS all checks (training, preferences, mock reload, JSON import/export, mobile overflow).
- Embedded scripts parsed by Node syntax checker in both versions; embedded hunt sources byte-for-byte matched detached sources.
- Archive ZIP checked with zipfile.testzip below after packaging.

## Known limits / not verified
- ROM-exact HP, rope tier unlocks, rope inventory model, stage caps, flee time, drag length, spawn probabilities, regional encounters and bait effect are provisional.
- Hunting scene uses illustrated placeholder background; original ROM field hunting art not recreated here.
- Hunting in-progress lasso is not saved; completed captures/ropes/food and obtained Digimon are persisted.
- Original Android phone (as opposed to Chromium simulated mobile touch) NOT manually verified.
- Unavailable old `jsdom` regression suites were NOT run.
- At the 50 team-save limit, catching another monster is blocked. Original hunting memory capacity is pending.
- Some UI may require scrolling inside the NDS lower screen on phones.
