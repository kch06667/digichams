# v0.19.0 검증 결과 (2026-10-26)

### PASS
- `node tests/farm-core.cjs` — **30/30** PASS. 훈련/먹이/자율 행동/자동 휴식/세이브 기반.
- `node tests/evolution-core.cjs` — **12/12** PASS. 종별 진화/누적 배틀/환생.
- `node tests/evolution-tree.cjs` — **18/18** PASS. 216종/477분기/진화 목표.
- `node tests/sprite-catalog.cjs` — **9/9** PASS. 216종 스프라이트/카탈로그.
- `node tests/cage-training.cjs` — **16/16** PASS. 11계열, 구매, 조건, AP/저항 분리, 목표 지정, 진화 시 정지, JSON, 기존 데이터 이관.
- `python tests/cage-browser.py` — **2/2** PASS. 실제 Chromium, PC 1280px `index.html` / 모바일 390px `standalone.html`: UI 선택, 시설 구매, 이동훈련 명령, 용족 AP 6 획득. JS pageerror 없음.
- `python tests/evolution-browser.py` — **2/2** PASS. 실제 Chromium 양 HTML: 코로몬 진화, 가부몬 시간진화, JSON 기록 유지, 실제 전투 기록.
- `node --check` 소스 4종, HTML 양쪽 내장 스크립트 각 10개 PASS.

### NOT RUN/UNVERIFIED
- 오래된 `tests/integration.cjs`와 `tests/regression.cjs`: 이 환경에서 `jsdom` 모듈이 없어 `MODULE_NOT_FOUND`. **실행 실패이지 기능 오류 확정이 아님.** 그 대신 실제 Chromium 테스트를 실행함.
- 모바일 실기기에서 장시간 운영/세이브 복구 수동 검증 미실시.
- 原작 ROM의 시설별 실제 AP 증가량, 비용, 랭크, 저항 증가량, 계절 효율 검증 미실시. 공략의 경향만 반영. 원작과 달리 자동 반복 훈련은 확장판.
