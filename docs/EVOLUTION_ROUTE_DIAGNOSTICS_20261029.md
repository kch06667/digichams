# 2026-10-29 — 진화 목표·도감 조건 진단 개선

## 이번 변경

원작 웹게임의 기존 **216종 도감 / 477개 진화 경로**와 목표 지정
동작을 유지한 채, 왜 현재 디지몬이 특정 진화를 못 하는지 보여주는
읽기 전용 진단과 도감 연결 관계를 추가했다.

- **진화 후보별 충족 조건/부족량**: 전투 횟수, 승률(%),
  종족 AP(11개 종류), 환생 횟수, 육성 패널티, 성장 경과일의
  현재값/목표값/부족값을 보여준다.
- **선택 목표 강조**: 선택한 진화체에 🎯를 표시하고,
  목표가 남아 있으면 다른 진화 분기가 보류된다는 기존 규칙을
  안내한다. 일반 진화 시도, 전투 자동 진화, 케이지 AP 획득,
  세이브 불러오기 및 유년기 부화 로직은 변경하지 않는다.
- **도감 연결 정보**: 선택한 종의 확인된 직전/다음 진화체
  목록을 함께 표시한다. 이미 있던 도감 트리 탐색 UI 및
  스프라이트 검색·미리보기 UI를 대체하지 않는다.
- **저장값 변경 없음**: 새로운 필드는 없고, 진단 함수
  `DCEvolution.routeProgress(mon, lookup)`와
  `DCEvolution.lineage(name)`는 저장값을 수정하지 않는다.
  기존 `DCEvolution.maybeEvolve()`의 분기 우선순위도 유지한다.
- **성능**: 기존 진화 후보와 도감 상세 노드만 관찰한다.
  메인 사육장 DOM 전체나 게임 루프 매 프레임을 관찰하지 않는다.

## 근거의 범위

원작 공략을 근거로 추출된 477개 진화 경로는 확인했으나,
**AP 지급량·시간 진화 경과일(현재 임시 5일)·분기 우선순위·
각 진화 조건의 세부 숫자까지 한국어 NDS ROM 기준으로 모두
교차검증한 것은 아니다.**

새 UI는 현재 웹게임 진화 규칙을 정확히 읽어 부족 조건을 계산할 뿐,
미검증 임시 수치를 ROM에서 검증된 숫자로 소개하지 않는다.

## 실제 실행 환경 및 테스트

```bash
node --test tests/evolution-route-diagnostics.cjs
node tests/evolution-tree.cjs
node tests/evolution-core.cjs
python3 tools/sync-embedded-evolution.py --check
python3 tests/evolution-route-browser.py
```

자동 동기화 과정은 `src/evolution-core.js`와 새
`src/evolution-goal-ui.js`, `src/evolution-goal-style.css`를
**실제 플레이 가능한 두 HTML 페이지**로 반영한다.
HTML의 기존 스크립트 순서와 사육장/전투/사냥 코드 및 private sprite
리소스는 건드리지 않는다. 477개 모든 경로의 수치 계산 테스트,
아구몬→지오그레이몬 목표 잠금 및 진화, 저장 불변성,
원본 도감 검색·계보를 PC/모바일 터치 Chromium으로 검사한다.

원본 ZIP이나 ROM 파일을 GitHub에 추가하지 않으며, 실제 Android
물리 기기의 장시간 플레이 검증은 별도 과제로 남겨 둔다.
