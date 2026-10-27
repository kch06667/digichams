# v0.23.2 사육장 그래픽 안전 병합

## 목적
이 브랜치는 최신 `main`의 사육장 이동/경로/양보, Esc 먹이 취소, 세이브 보호, ROM 도구 및 대회를 **그대로 보존**하면서 사용자 제공 `Digimon_Championship_v0.23.2_Graphics_Playable.zip`에서 CSS와 WebP **만** 가져오기 위한 병합 준비다.

## 적용
새 작업 브랜치에서 프로젝트 최상위에 ZIP을 넣지 않고, 저장소 **밖**의 입력 ZIP 경로를 지정:

```bash
python3 tools/integrate-farm-graphics-v0232.py --zip /path/to/Digimon_Championship_v0.23.2_Graphics_Playable.zip --dry-run
python3 tools/integrate-farm-graphics-v0232.py --zip /path/to/Digimon_Championship_v0.23.2_Graphics_Playable.zip
python3 -m unittest discover -s tests -p 'test_integrate_farm_graphics.py' -v
node --test tests/farm-avoidance.cjs tests/farm-navigation.cjs
python3 tests/farm-routing-browser.py
python3 tests/save-import-browser.py
```

반드시 `git diff --stat`로 허용된 **네 경로**(`src/hex-farm.css`, `index.html`, `standalone.html`, `assets/farm/hex_farm_v0232.webp`)만 변경됐는지 확인. `git diff -U0`에서 두 HTML JavaScript 변경이 없음을 확인. 변경 후 브라우저 실제 화면/터치 테스트가 통과해야 병합한다.

## 현재 진행 상태
- 도구/회귀 테스트/병합 안내: GitHub 작업 브랜치에 준비.
- **최신 GitHub 게임 파일에 원본 WebP를 아직 적용하지 않음.** GitHub 연결 도구에서 이 대화에 첨부된 106KB 바이너리 이미지를 직접 원격 저장소로 전송하는 경로가 없어서 아트/HTML을 임의로 덮어쓰지 않았다.
- 로컬 제공 v0.23.2 ZIP에서 원본 WebP가 존재하고 7개 육각형 타일의 그래픽 구현이 있는 것을 확인.
- 메인 최신 그래픽 비교/기기 실측/최종 인라인 HTML 통합 및 완전 회귀검증: **대기**.
- 매번 ZIP을 출력하거나 생성하지 않는 기존 프로젝트 원칙 유지.
