# 사육장 화면 갱신 최소화 (2026-10-28)

## 변경 내용
- 기존 사육장 캐릭터 DOM 갱신은 화면이 보일 때 초당 최대 30회 실행한다.
- 이동 중이 아니거나 동일한 값인 경우 `left`, `top`, `transform`, 표정, 선택 상태의 반복 쓰기를 건너뛰도록 했다. 먹이도 위치가 달라질 때만 DOM 스타일을 바꾼다.
- `renderRoster()`의 캐시 키에 개체 `level`을 추가해 레벨업 후 선택 목록의 Lv. 표시가 최신으로 갱신된다.
- 원본 게임 상태/전투/훈련 포인트/시뮬레이션 시계·속도·세이브 구조는 변경하지 않았다.

## 검증 내역
- 소스 `src/hex-farm-ui.js`와 HTML 양쪽 내장 farm UI 블록이 동일한지 `python3 tools/sync-embedded-farm.py --check`.
- GitHub Actions `Sync farm inline bundles (performance branch)` 성공. Node 사육장 경로·회피·기본 코어 및 대회 회귀검사 성공.
- 제공 ZIP 기반 Chromium 브라우저에서 `tests/farm-dom-paint-browser.py`와 동일한 새 갱신 함수를 사용해 index/standalone × desktop/touch **4조합 통과**: 변화 없는 tick(0)에서 사육장 DOM 변경 없음, 실제 좌표 변경 시 위치 반영, 레벨 상승 시 선택 메뉴 반영.
- 브라우저 브랜치 자동 테스트는 포함하지 않았으므로 Android 실기 FPS/메모리 및 실제 기기 성능 개선 폭을 확정할 수 없다. `index.dev.html?perf=1`로 동일한 기기·조건에서 비교 권장.

## 적용 방법
`python3 tests/farm-dom-paint-browser.py`를 사용하며 Python Playwright/Chromium 필요. 실제 게임은 기존 `index.html` 또는 `standalone.html`로 실행한다. 배포 ZIP은 매 커밋마다 만들지 않는다.

## 남은 작업
- v0.23.2 WebP 그래픽은 아직 최신 main에 미통합.
- 고밀도 사육장 정체/오래된 세이브의 지도 밖 좌표, Android 실기 장시간 측정은 별도 과제.
