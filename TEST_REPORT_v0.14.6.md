# 2026-10-26 v0.14.6 QA

| Test | Result | Meaning |
| --- | --- | --- |
| Core unit (`node tests/farm-core.cjs`) | **17/17 PASS** | Plot navigation, stat changes, day counter, food, pauses, rest, training bonus, storage freeze |
| Browser hex (`python tests/hex-browser.py`) | **7/7 PASS** | Live battle retained, no JS errors, training and peripheral travel, mobile overflow |
| Browser JSON and controls (`python tests/save-browser.py`) | **6/6 PASS** | Legacy controls timed, JSON save export/import, malformed saves rejected, mock storage recreation, mobile UI |
| `index.html` / `standalone.html` smoke | **Both PASS** | Both have 7 tiles, actor, follow button and no page errors |

**Important limitations:** The test browser blocks localhost and file navigation. There is NO verified real browser refresh/localStorage durability test; an independent fresh-page mock Storage test was used. No Android physical device was controlled. Old Node regression scripts requiring jsdom/Playwright remain unexecuted due missing dependencies. NDS stat/timing formulas remain unverified.
