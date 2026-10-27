## 실제 이미지 이식 체크포인트 (2026-10-28)

- 기존 v0.23.2 ZIP에서 확인한 WebP 원본 106,788바이트를 Git 객체 SHA `3041c6d7e99362cd4829c3c846c16f7334e7fabe`로 최신 `main` 기반 작업 브랜치 `feature/integrate-v0232-farm-art-20261028`에 정확히 추가함. SHA-256은 `67f92692d36b8cedae3db3abe6293c2e757799d57600acb6eac0eb96cc8ebccc`.
- 원본 ZIP CSS에서 그래픽 스킨 뒷부분 **2,956자**만 최신 `src/hex-farm.css`에 추가. FNV-1a 해시 `d03e2ca6`로 ZIP 스킨과 바이트 단위 동등함을 검사. 이전 CodeX의 통로/먹이 배치 CSS는 그대로 유지.
- `python3 tools/sync-embedded-farm.py`가 두 HTML의 핵심/UI/CSS 블록을 동기화하고 `standalone.html`의 WebP를 data URI로 포함하도록 구성됨.
- 검증 목표: `python3 -m unittest discover -s tests -p 'test_farm_graphics_integrated.py' -v`, `python3 tests/farm-graphics-browser.py`, 기존 사육장·세이브·대회 회귀검사. 통과 전까지 `main` 병합 여부를 판단하지 않음.
- 원본 NDS ROM이나 전체 프로젝트 ZIP은 업로드하지 않음. 외부 공개 배포도 진행하지 않음.

---

# v0.23.2 그래픽 병합 — 최신 main 보존

사용자 제공 ZIP은 과거 v0.23.1 엔진 기반이므로, 전체 ZIP을 main에 덮어쓰면 최신 이동 회피 및 세이브 보호 기능을 잃을 수 있다.

## 적용 (ZIP을 저장소에 추가하지 않는다)

별도 작업 브랜치를 최신 main에서 만든 뒤 다음 명령을 실행한다.

    python3 tools/import-farm-graphics-v0232.py --zip /absolute/path/to/Digimon_Championship_v0.23.2_Graphics_Playable.zip
    python3 tools/sync-embedded-farm.py --check
    python3 -m unittest discover -s tests -p test_farm_graphics_import.py -v
    node --test tests/farm-avoidance.cjs tests/farm-navigation.cjs
    python3 tests/farm-placement-browser.py

## 안전 범위

- ZIP에서 SHA256 검증된 WebP 한 장 및 CSS 스킨만 추출한다.
- 오직 src/hex-farm.css, assets/farm/hex_farm_v0232.webp, index.html, standalone.html만 변경한다.
- standalone.html에는 아트를 data URI로 포함한다. JS/게임 세이브/전투/ROM 관련 변경 없음.
- 두 번째 같은 ZIP 적용 시 추가 변경 없음(멱등성). 잘못된 ZIP·HTML 블록이면 변경을 중지한다.

## 검증 현황

- 첨부 ZIP의 106,788바이트 아트로 로컬 테스트: 두 HTML 7개 타일·캐릭터·먹이·아트 로드 확인, JS 오류 없음.
- 이 아래 문단은 **2026-10-28 이전 기록**이다. 상단 새 체크포인트를 기준으로 최신 상태를 판단한다. Android 실기 검증은 별도로 미완료다.
- ROM이나 게임 ZIP을 GitHub에 push하지 않는다. 원본 그래픽의 공유/공개 권리도 별도로 확인한다.

## 후속

GitHub 저장소의 최신 main 체크아웃을 받아 제공 ZIP으로 안전 병합 → PC/모바일 테스트 → 그래픽 자산과 CSS만 커밋. 이후 GIF 필요 시 로딩과 렌더링 비용을 실제로 측정해 추가 최적화.