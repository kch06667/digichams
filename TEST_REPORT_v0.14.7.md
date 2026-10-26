# v0.14.7 테스트 보고 (2026-10-26)

| Test | Pass | Tested |
| --- | --- | --- |
| `node tests/farm-core.cjs` | **22/22** | 기본 사육, 장소 이동, 데이카운터, 자동휴식, 시설 버프, 목표수치 달성·중지·복귀·저장 및 오류 검사 |
| `python tests/hex-browser.py` | **8/8** | 기존 전투/ROM UI, 훈련, 시설 걷기, 목표 UI, 배속, 모바일 폭 넘침 방지 및 JS 오류 0 |
| `python tests/save-browser.py` | **6/6** | 기존 버튼 시간 명령, 세이브 JSON 다운로드·불러오기, 저장소 모의 재구성, 모바일 입력 UI |

**Limits**: Browser navigation to localhost and `file://` is administratively blocked in this environment; save-browser.py uses fresh-page mocked Storage, so real browser reload durability on Android is not proven. Node-based old integration/regression requiring installed jsdom and playwright npm packages were not run. All training/evolution numeric formulas flagged provisional until verified from ROM. This is not yet a complete original campaign or full game.
