# v0.23.2 사육장 그래픽을 Codex 최신 코드에 병합하기

1. Codex `improve/farm-movement-v023` 브랜치를 GitHub에 보관한다. 이 그래픽 패치는 그 작업을 대체하지 않는다.
2. 게임 프로젝트 최상위와 별개 디렉터리에 `Digimon_v0232_Farm_Graphics_Only_Patch.zip`를 푼다.
3. 프로젝트에서 `git switch -c feature/farm-graphics-v0232` (기존 Codex 브랜치를 부모로).
4. 패치 디렉터리에서 `python apply-farm-graphics-v0232.py /absolute/path/to/digichams` 실행.
5. `git diff`에서 `src/hex-farm.css`, `index.html`, `standalone.html`의 CSS 및 신규 `assets/farm/` 파일만 변경됐는지 확인. JS 변경이 있으면 병합 취소.
6. 이동 회피/먹이 선택/대회 테스트 및 브라우저 수동 테스트 후에만 커밋/PR. 저장 상태는 변경하지 않는다.

### 안내
- `index.html`은 상대 경로의 WebP 파일을 읽기 때문에 폴더 구조를 유지해야 한다.
- `standalone.html`은 WebP data URI를 인라인하고 있어 단독 실행이 가능하다.
- 이 작업에서 포함된 건물 모양은 시안 기반 시각 표현이며 구매/잠금/맵 좌표는 게임 엔진의 기존 값에 종속된다.
