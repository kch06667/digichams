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
- 해당 브랜치에는 **그래픽 바이너리를 아직 올리지 않았다.** 최신 main과 전체 병합·실기 Android 검증은 미완료다.
- ROM이나 게임 ZIP을 GitHub에 push하지 않는다. 원본 그래픽의 공유/공개 권리도 별도로 확인한다.

## 후속

GitHub 저장소의 최신 main 체크아웃을 받아 제공 ZIP으로 안전 병합 → PC/모바일 테스트 → 그래픽 자산과 CSS만 커밋. 이후 GIF 필요 시 로딩과 렌더링 비용을 실제로 측정해 추가 최적화.