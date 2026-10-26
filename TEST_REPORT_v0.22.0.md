# v0.22.0 전투 업그레이드 검증 보고서

## 이번 변경점
- 216종 원본 GIF 및 기존 모션 매핑과 NDS 배경은 그대로 사용.
- 보유 디지몬의 공격·방어·속도·HP 적용 유지 + 신규 TP/최대TP 반영·저장.
- 필살기 시 TP 차감. TP가 부족하면 차지가 가득 차도 사용하지 않음. TP는 전투 중 일부 회복 및 사육장 휴식으로 회복.
- 아군 전술 5개: 균형, 공세, 수비, 집중 공격, TP 절약. 출전 후 선택한 전술과 TP를 저장.
- 대표 디지몬 기술 이름 일부 추가. 기타 디지몬 임시 필살기. 실제 ROM 수치·기술 ID는 미검증.

## 실제 실행 검증 (2026-10-26)
- `node tests/farm-core.cjs`: 30 PASS
- `node tests/evolution-core.cjs`: 12 PASS
- `node tests/evolution-tree.cjs`: 18 PASS
- `node tests/sprite-catalog.cjs`: 9 PASS
- `node tests/cage-training.cjs`: 16 PASS
- `node tests/care-seasons.cjs`: 11 PASS
- `node tests/hunt-core.cjs`: 14 PASS
- `node tests/battle-core.cjs`: 6 PASS
- `node tests/battle-rest.cjs`: 1 PASS (TP/HP 회복, 보관소 동결)
- 위의 독립 검증 합계 **117 PASS**, 실패 없음.
- `python tests/battle-browser-logic.py`: **2/2 PASS** (`index.html`, `standalone.html`). Chromium에서 전술 메뉴, 보유 개체 출전, TP 비용 24 지불(57→33), 전투 승리, 보상 1회, 저장 TP 및 전술 유지를 확인함. UI 실행 스크립트는 실제 프로젝트 코드이고, 테스트 성능을 위해 거대 미디어(base64)만 임시 제거한 **경량 통합 검사**임.
- Node로 두 HTML의 모든 내장 `<script>` 구문 검사 통과, ZIP 검증 별도.

## 수행 못 한 검증 및 한계
- 브라우저의 원본 대형 GIF 및 필드 아트를 모두 로드하는 완전판 UI 자동 테스트는 이 실행 환경에서 시간 초과. 따라서 최신 전투 그래픽 렌더링의 시각적 정확성, 실제 모바일 터치와 장시간 3vs3 안정성은 아직 검증하지 못함.
- 기존 `tests/regression.cjs`/`tests/integration.cjs` 는 각각 `jsdom`, Node `playwright` 패키지 부재로 미실행. 위의 Python Playwright Chromium 경량 통합 테스트로 전투 TP 저장 흐름 보완.
- TP/기술/모션 선택 로직은 원작 파일의 숫자 값 완전 복원이 아닌 사용자 확장판 임시 규칙.
- 원본 ROM을 ZIP에 포함하지 않음.
