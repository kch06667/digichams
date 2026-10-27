# 개발 체크포인트 — 2026-10-28 오래된 사육장 좌표 복구

- 사육장 렌더링 변경 PR #7 / `b138e49`는 `main` 통합 완료. 캐릭터/먹이의 불필요한 DOM 쓰기 생략 및 레벨업 시 목록 표시 갱신. GitHub Actions 및 PC/모바일 Chromium 4조건 스모크 확인.
- 이번 복구 브랜치: `fix/farm-offmap-save-recovery-20261028`. `src/farm-core.js`가 구세이브에서 지도 밖 좌표를 최초 한 번만 검사·복구하고, 진행 중인 훈련의 남은 시간 및 기존 개체·능력치·자원은 유지한다. 목표 자체가 잘못된 경우만 명령을 취소한다.
- `tools/sync-embedded-farm.py`에 farm-core 내장 블록까지 일치 검사를 추가. `tests/farm-offmap-recovery.cjs` 신규 **6/6 Node 통과** 및 기존 farm/navigation/avoidance/championship Node 통과.
- 이 브랜치의 첫 Actions 검증은 **테스트는 모두 성공**, HTML 커밋 push가 동시 원격 커밋으로 인해 거절됨. 추후 재시도·HTML 동기화 완료 및 PR CI 성공 전에는 main 병합하지 않는다.
- 상세: `docs/FARM_OFFMAP_SAVE_RECOVERY.md`. 매 업데이트 ZIP 미생성 원칙 유지. v0.23.2 WebP 아트 실물은 여전히 미통합.

---

# 최신 체크포인트 — 2026-10-28 개발 성능 진단

- GitHub `main` 성능 진단 PR #6 병합: `32ff7d3`. 개발용 `index.dev.html?perf=1`에서 FPS, 긴 프레임, Long Task, 이미지 요청 및 사용 가능 힙을 확인할 수 있다. 기능은 생성된 개발 페이지에만 포함되며 실제 배포 HTML·세이브는 변경하지 않는다.
- `npm run dev:build` → `python3 -m http.server 8000 --bind 127.0.0.1` → `http://127.0.0.1:8000/index.dev.html?perf=1`. 상세 `docs/DEV_PERFORMANCE.md`.
- HTML 생성기 로컬 동등 테스트 4/4 통과. 기기별 실제 수치 측정은 아직 필요. `?perf=1`이 없으면 모니터는 비활성화.
- 기존 `main`에 이미 더 나은 체크섬 검증 그래픽 임포터가 있어 중복 PR #5는 **병합 없이 종료**. `tools/import-farm-graphics-v0232.py`가 기존 정식 도구다.
- **v0.23.2 WebP 아트는 아직 최신 main에 없음**. ZIP에서 안전 적용 → JS/CSS 검증 → 브라우저 검사 후 병합이 다음 실제 그래픽 단계. 매 업데이트 ZIP 생성/전달 금지 유지.

---

# 최신 재개 지점 — 2026-10-28 성능 최적화 + 그래픽 안전 이식 도구

- GitHub `main`이 기준. 이번 완료 병합: PR #2 / `5e00249` (사육장 화면 DOM 갱신 최대 30fps, 사육장 패널 숨김 시 화면 갱신 생략. 시간/육성 로직 변경 없음); PR #3 / `1fff61e` (v0.23.2 CSS/아트 안전 이식 도구 + 자동 검증).
- 두 HTML의 JS가 GitHub Actions에서 자동 재생성되어 실제 플레이 경로에 반영됨. Actions 성공: https://github.com/kch06667/digichams/actions/runs/40561133209. 그래픽 임포트 도구 테스트 성공: https://github.com/kch06667/digichams/actions/runs/40561958541.
- **중요: v0.23.2 아트 자체의 최신 main 통합은 미완료**. `assets/farm/hex_farm_v0232.webp`는 아직 GitHub 저장소에 없음. 기존 CSS 그대로, 새 그림이 표시되는 버전이라고 말하면 안 된다.
- 사용자가 제공한 `Digimon_Championship_v0.23.2_Graphics_Playable.zip`을 받아 별도 브랜치에서 `python3 tools/import-farm-graphics-v0232.py --zip /absolute/path/to/ZIP`로 이미지/CSS만 적용한다. 이어서 `python3 tools/sync-embedded-farm.py --check`, Node/Playwright 테스트를 실시하고 변경 파일(아트·CSS·두 HTML)만 커밋한다. 자세한 사항 `docs/FARM_GRAPHICS_IMPORT.md`.
- 첨부 ZIP 기반 로컬 시험에서는 importer 적용/재적용, 사육장 타일 7개/액터/먹이/이미지 브라우저 테스트 통과. 별도 최신 `main` 전체와 Android 실기 테스트는 아직 하지 않았다.
- 사용자 운영 결정: 업데이트 때마다 전체 ZIP을 생성/전달하지 않는다. GitHub 기반 소형 코드 변경과 체크포인트만 기록한다. 배포 요청이 있을 때만 ZIP 생성.

---
# 최신 개발 작업 방식 — 2026-10-28

- 사용자 확정: 매 업데이트마다 전체 ZIP을 만들거나 전달하지 않는다. GitHub 커밋/브랜치와 이 파일을 체크포인트로 쓴다.
- 기준은 GitHub `main` (2026-10-27 `aa6db16`), 새 작업 브랜치 `chore/modular-dev-workflow-20261028`. 첨부 v0.23.2 ZIP을 그대로 main에 덮어쓰지 않는다.
- 개발용 페이지 생성: `node tools/build-dev-page.cjs` → `python3 -m http.server 8000 --bind 127.0.0.1` → `/index.dev.html`. 산출물은 Git 무시. 검사: `node --test tests/build-dev-page.cjs`.
- 인라인/분리 코드 완전 통합과 이미지 런타임 최적화는 **별도 후속 단계**. 현재 `index.html` 및 `standalone.html`의 실제 사용자 실행 경로/기능은 변경하지 않았다.
- 상세와 테스트의 한계는 `docs/DEVELOPMENT_WORKFLOW.md` 확인. 최신 main에서 실행 및 모바일 실기 테스트는 후속 검증 필요.

---

# 현재 재개 지점 — v0.23.0 기반 / 다른 환경에서 이어가기

## 최신 통합 체크포인트
- main의 기존 `160b852`와 작업 브랜치의 `a2ccb25`까지 병합. 병합 커밋 `93ec2a9`; 이후 이 인수인계 문서 갱신 포함.
- 새 환경은 최신 main을 받은 뒤 AGENTS.md → 이 문서 → ROM_ANALYSIS_PROGRESS.md 순서로 읽는다. 변경 시작 전 git status를 확인하고 새 작업 브랜치를 만든다.
- 게임 실행: 저장소 루트에서 `python3 -m http.server 8000 --bind 127.0.0.1`. index.html 사용; standalone.html은 단독 실행용.
- 빠른 검사: `node --test tests/farm-avoidance.cjs tests/farm-navigation.cjs`. 순수 Node 검사에는 npm 설치 불필요. 브라우저 검사에는 Python Playwright와 Chromium이 필요(AGENTS.md 참고).
- `/workspace/scratch/digichams-private`는 기존 클라우드 인스턴스의 로컬 경로이며 다른 환경에 자동 복사되지 않는다. ROM 분석은 별도로 제공된 로컬 입력 경로를 `--rom`에 지정하고, `--output-dir`은 체크아웃 밖으로 지정한다. ROM이 없어도 게임 개발/대부분의 테스트는 가능.
- 다음 작업: 시설 표지/픽셀 배경 개선 또는 고밀도 이동 문제 재현. ROM은 이름 후보와 종 ID 대응부터 추가 검증. 기존 완료 작업/검증 내역은 아래와 TEST_REPORT.md 참고.

## 이전 작업 기록

- 최신 완료: 세이브 불러오기 전 사본 검증/초기화, 화면 적용 오류 시 원상복구. 손상된 중첩 구조/경로/개체 ID를 거부하며 현재 게임·저장·백업 유지. 두 HTML 테스트 통과.
- ROM 도구 완료: tools/rom-database.py로 FAT 6434/이름 6412/ARM9 overlay 22 및 도감 텍스트 1176항목 확인. 첫 216 이름 후보와 웹 이름 146개 정확 일치. 실제 종 ID/진화 조건은 미확정. 상세 ROM_ANALYSIS_PROGRESS.md 재사용.
- 새 입력 발견: origin/main 160b852의 사용자 추가 ZIP에 64MiB NDS 존재. 저장소 밖 /workspace/scratch/digichams-private/game.nds에 읽기 전용 보관. SHA-256은 기존 ROM 기록과 동일. 아래 과거 “ROM 없음”은 갱신 전 기록이다. ROM/ZIP을 작업 브랜치에 추가하거나 push하지 않았음.
- 최근 추가: 먹이 위치 선택 중 Esc로 취소 가능. 두 먹이 버튼의 문구/선택 상태 복귀, 먹이 무차감 확인. UI와 두 HTML 동기화.
- 최근 가벼운 UI 개선: 선택한 디지몬 상태에 `통로 대기`(0.2초 이상 정체)와 `자리 양보` 표시. 일반 이동/시설 대기/유휴로 돌아오면 표시도 복귀. 이동 규칙 변경 없음. UI/두 HTML 동기화 및 4브라우저 조합의 5상태 전환 검사 통과.
- 작업 브랜치 `improve/farm-movement-v023`. 이전 정상 커밋 `3f8cfaa`; 이번 이동 회피 변경 커밋은 git log -1 확인.
- 완료: 이동 중 발 위치 기준 최소 10 좌표단위 회피, 일관된 우측 우회 선호, 좁은 통로 정면 교행, 4방향 교차 이동. 원작 ROM 규칙이 아닌 확장판 이동 설계.
- 목적지를 막은 유휴 개체만 가까운 빈 위치로 양보. 훈련/휴식/예약 먹이 명령은 회피를 위해 취소하지 않음. 점유된 중간 경유점은 통과 가능한 경우 우회.
- 초기 겹침은 거리를 늘리는 이동만 허용해 해소. 이동 속도 상한·지면/통로 경계 검사 유지. 스프라이트 그림 전체 외곽의 겹침까지 금지하는 방식은 아님.
- src/farm-core.js + 두 HTML 인라인 동기화. `trafficWait`는 임시 통행 대기 시간; `goal.yielding`은 유휴 양보 표시. JSON 저장/복원 결정성 테스트 통과.
- 검증: 회피 8 + 기존 경로 9 = 17/17, 기존 핵심 10개 스위트, 시설/회피 브라우저 4조합, 먹이 브라우저 4조합. TEST_REPORT.md 참조.
- 남음: 고밀도/대기 위치 부족, 목적지가 행동 중 개체에 완전히 막힌 경우, 구세이브 맵 밖 좌표 복구. 모든 혼잡 상황의 교착 해소를 보장하지 않음.
- 다음: 시설 표지·픽셀 배경 개선 전 assets/rom_images의 해당 그래픽을 선별 확인하고 PC/모바일 전후 캡처. 또는 위 고밀도 문제를 재현한 후 대기열 정책 개선. 이미 완료한 전체 스프라이트 감사는 반복하지 말 것.
- 스프라이트 감사 docs/audits/sprites-v023.json: 유니몬 #5는 #4 대체, 후보 #5_1 의미 미확정.
- 현재 ROM은 저장소 밖 private 폴더에서 사용 가능(상단/ROM_ANALYSIS_PROGRESS.md 참조). 외부 push/배포 안 함. 미완료 소스 수정 없이 로컬 커밋으로 체크포인트 저장.
- 아래는 과거 이력이며 최상단 현재 지점이 우선한다.

---

# v0.14.7 인수인계 / 개발 재개 지점 (2026-10-26)

## 반드시 지킬 내용

- 사용자 최종 확정: **육각형 사육장**. 과거 `NEXT_WORK_BRIEF.md` 등의 복도형 사육장/횡스크롤 필수 지시는 폐기됨.
- 게임 전체와 sprites/ROM 그래픽을 재작성하지 않는다. 현재 체크포인트는 v0.14.2 원본 전투·진화·사냥 코드에 육각형 사육장을 통합한 것.
- 개인용 웹게임. ROM 원본 파일은 포함하지 않는다. 원작 진화 조건/능력치 수치는 ROM에서 확인하지 않으면 '임시 확장판 밸런스'다.

## 이번에 추가된 기능

1. 시간 기반 사육장: 이동, 먹이, 공격/방어/속도 훈련, HP·피로 감소, 자동 휴식/복귀.
2. 구매한 상단 훈련장, 오른쪽 주행장, 좌하단 휴식 구역으로 실제 디지몬이 이동한다. `📍 디지몬 따라가기` 버튼 제공.
3. `목표 능력치까지 훈련하고 자동 중지` 체크+목표 숫자(1..999). 해당 공격/방어/속도 훈련 버튼으로 목표를 설정하며, **진화 조건 충족을 보장하지 않음**. 목표 달성 시 반복 훈련 중지, 자동 휴식 후 목표 유지.
4. 예전 빠른 먹이/훈련/휴식 버튼도 시간 기반 사육 명령 사용.
5. 브라우저용 JSON 세이브 내보내기/가져오기. 원본 세이브는 한 번 백업. 내보낸 JSON에는 게임 상태만 있고 ROM/스프라이트는 없다.

## 파일 안내

- `index.html` 및 `standalone.html`은 독립 HTML 번들로 소스 동일화됨.
- `src/farm-core.js`: simulation truth source; `src/hex-farm-ui.js`: UI integration and save JSON; `src/hex-farm.css`: CSS. HTML 두 개에 같은 소스를 스크립트/스타일로 인라인하므로 수정 시 반드시 동기화.
- `src/legacy-v0142.html`: 원본 회귀/비교용, 삭제 금지.
- `TEST_REPORT_v0.14.7.md`: 실제 실행 테스트/한계.

## 다음 단계

- 기기 자체 Android Chrome에서 파일 열기·저장/새로고침·JSON 백업 실제 테스트. 로컬 실행 환경에 따라 localStorage 제약이 있을 수 있음.
- 원작 수치로 진화/기술/훈련 시설 검증; 훈련/휴식 시설당 동시 점유 및 디지몬끼리의 충돌 처리.
- 활동 사육장 G 용량과 무제한 보관소(보관 중 시간 정지) UI.
- 개체값(6개 0..31, 영향 작게)과 기질(25종) / 원래 성격(8종) 데이터 아키텍처.
- 라이벌, NPC, 전문 테이머, 자유 퀘스트.

## 테스트 명령

`node tests/farm-core.cjs`, `python tests/hex-browser.py`, `python tests/save-browser.py`. 예전 jsdom/node playwright 회귀 테스트는 `npm install` 후 별도 실행.

## v0.14.8 소규모 수정
- 같은 확장 육각형 시설에 동시에 행동하는 디지몬을 최대 2마리로 제한. 대기 중인 개체는 자리가 나면 시작.
- 중앙 시설은 기존 종류별 동시 행동을 2마리로 제한. 수치는 임시 밸런스.

## v0.15.0
먹이 버튼 누른 후 지도 클릭 위치에 먹이 배치. 디지몬이 해당 위치로 이동해 섭취. 확장 지도 위치 좌표 지원. 모바일 터치 click 지원.

## v0.15.1 (2026-10-26) 먹이 및 생활 AI
- hunger+먹이 선점: 여러 마리가 먹이 1개를 두고 다투면 배고픔이 높은 순, 이후 가까운 먹이 우선 배정. 하나의 먹이당 하나의 claim/섭취 처리.
- 산책 중인 디지몬도 먹이가 나오면 접근, 명령 받은 훈련/휴식은 멋대로 취소하지 않음.
- 고피로/저HP 유휴 디지몬은 자율 휴식. 식사 후 배부름 표시, 먹이 낙하 애니메이션, 현재 배고픔 정보 UI.
- v0.15.0 웹 HTML과 분리된 src/hex-farm-ui.js 내용이 어긋났던 문제 해결: 실행 HTML 기준으로 동기화.
- 원작 수치 미검증: 배고픔 임계치/회복량/속도는 개발용 임시 규칙이며, 아래 테스트 결과 참고.

## v0.16.0 verified-guide evolution framework
- Added src/evolution-core.js separate from 5MB atlas; embedded into both HTML variants.
- Replaced temporary level/training/friendship evolution with species rules. Included Koromon/Agumon/Greymon, Patamon, Kunemon, Gabumon routes among registered sprite species.
- Battle participation recorded for both actual canvas battles and legacy battle button. Stage time advances in farm tick and manual Next Day. AP updates from training, stage resets on digivolution. Evolution status displayed in encyclopedia and stats.
- Rebirth uses protective mode for unverified "loss"; actual data tables pending ROM extraction. See docs/EVOLUTION_SOURCES.md.

## v0.17.0 — 216종 스프라이트 활성화
- 216종 × 40프레임을 기존 게임에 연결; 8종 디지에그는 미리보기용 자산으로 유지. `assets/species-catalog.json` 참조.
- 도감: 전체 검색 / 성장 단계별 보기 / 동작 프레임 테스트.
- 성장기 중심으로 사냥 후보 확대, 전투 상대는 승리 횟수 기반 단계별 출현. 궁극체는 기존 전투 시뮬레이터에서 선택 가능.
- 확인된 메탈그레이몬→워그레이몬, 가루몬→워가루몬→메탈가루몬, 계보 일부 추가. 원작 AP시설 연결 수치는 아직 미검증.
- `index.html`은 원본 GIF 파일을 사용. `standalone.html`은 새 스프라이트를 내장해 단독 오프라인 실행 가능.
- 스탯 수치는 원작 ROM 값을 확인하기 전까지 임시 밸런스이며 전체 216종의 진화 관계가 완성된 것은 아님.

## v0.18.0
- 216종 그래픽 전체에 대응하는 179개 출발점 / 477개 진화 조건을 `assets/evolution-routes.json` 및 `src/evolution-core.js`와 두 HTML에 동기화.
- 목표 진화(`m.evo.target`)를 지정하면 다른 분기로 자동 진화하지 않음. 기존 세이브 자동 호환.
- 도감에서 모든 진화 분기/역진화 계보 확인 가능, 목표는 소유 디지몬에서 선택.
- AP, 시간, 수명, 우선순위 및 랭크 게이트는 ROM 미검증.


## CHECKPOINT 13 — v0.19.0
- Project directory `DigimonChampionship_v0.19.0`; packaging: `Digimon_checkpoint_13_v0.19.0.zip`.
- Facility definitions in `src/cage-training-core.js` (new); `src/evolution-core.js` now distinguishes 11 hidden `evo.ap` and 5 `evo.resist`; `src/farm-core.js` supports `cage` command, auto-rest/cage resume, AP target, evolution action cancellation; `src/hex-farm-ui.js` adds cage selection/purchase/training panels. All 3 core modules are embedded in `index.html` and `standalone.html` and must remain in sync.
- `src/hex-farm.css` is embedded in both HTML copies; sync when edited.
- New tests: `node tests/cage-training.cjs`, `python tests/cage-browser.py`. Run prior `node tests/farm-core.cjs`, `node tests/evolution-core.cjs`, `node tests/evolution-tree.cjs`, `node tests/sprite-catalog.cjs`, `python tests/evolution-browser.py`. Older `node tests/integration.cjs`, `regression.cjs` require unavailable `jsdom`, so not run. Do not present them as passed.
- ROM specific gains, facility costs, unlock timing, seasons, jigen/wisdom in battle unverified. See `docs/CAGE_TRAINING_SOURCES.md`.
- User wishes: incremental, original NDS reproduction first, preservation of previous art/game systems, ZIP checkpoints for big milestones, future map sprite redraw.


## v0.20.0 — 계절·건강·환생 (2026-10-26)
- `src/care-core.js`: 봄/여름/가을/겨울, 훈련 효율, 누적 부상 및 질병, 붕대/약/클리닉 치료. 원작 정성 효과 및 패널티 수치 확인; 확률/정량 효과/계절 길이/치료 가격은 임시.
- 부상시 진화 패널티 +1, 질병시 +2; 치료는 과거 패널티를 되돌리지 않음. 진화시 패널티 초기화, 디지에그화 및 부화 시 현재 부상·질병 정리.
- 기존 원작형 수명 경과·환생 및 오래된 세이브 보호 장치는 유지. 장기간 수명 일수는 ROM 확인 전 임시값.
- `index.html`/`standalone.html`에 새 모듈과 UI 인라인 포함, `src` 동기화.


## CHECKPOINT 15 — v0.21.0 (2026-10-26)
- v0.20.0 ZIP에서 직접 이어받음. `src/hunt-core.js`, `src/hunt-ui.js`, `src/hunt.css` 추가 후 `index.html`과 `standalone.html`에 동일 소스 인라인 포함.
- 원작식 원 그리기(한 번 그리고 손을 뗌) → 로프 당기기/체력 소모 → 기절 → 손으로 포획, PC mouse/mobile touch Pointer Events.
- 두 모드(원작 NDS 2화면/확장 화면)에서 포획 필드 스크롤; 중첩 sticky 버튼이 캔버스를 가리지 않도록 주의.
- 3개 지역 임시 출현 그룹, 미끼, 도주 타이머, 단계별 로프 제한(임시).
- v0.20 core and cage/care/browser tests preserve behavior; new tests `tests/hunt-core.cjs`, `tests/hunt-browser.py`.
- IMPORTANT: gameplay timings/gear unlocks/encounter frequencies/graphics are temporary; verify actual ROM data before claiming exact.
- WIP hunting encounter intentionally restarts on reload; caught Digimon and resource spend persist in JSON/local save.


## v0.22.0 배틀 업그레이드 — 다음 작업자 필독
1. 전투 코드 메인은 `index.html` 및 `standalone.html`에 같은 형태로 인라인되어 있음. `src/battle-core.js`가 5개 전술과 TP 규칙의 단일 원본이며 인라인 `battle-core-v022`와 일치해야 함.
2. 내 디지몬 실제 출전 → TP를 사용한 필살기 → HP·TP 저장. 구버전 세이브는 기존에 TP가 없으며 `fighterVitals`가 출전 시 값 계산. `src/farm-core.js`도 TP 휴식 회복을 포함하게 수정했고 두 HTML의 내장 farm-core와 동기화됨.
3. 기존 전투 모션 매핑(SP 0,2,3,5,7~10,28,30,31,33,37) 및 원본 GIF/필드 아트 유지. 6/38번 모션의 실제 역할, 종별 기술표 및 NDS 전투 대미지·TP 수치는 ROM 미확정임.
4. 전술은 공격 방식을 변경하지만 원작 ROM AI 완전 이식은 아님. 최종 Android 기기에서 장시간 3vs3, HP/TP 세이브 내보내기/복구, CPU/배터리 소모 테스트 필요.
5. 테스트: node tests/battle-core.cjs; node tests/battle-rest.cjs; python tests/battle-browser-logic.py. 기존 farm/evolution/hunt/care 스위트도 재실행. jsdom·Node playwright 미설치라 오래된 Node 기반 브라우저 테스트는 미실행.


## v0.23.0 챔피언십 실제 개발 내용
- `src/championship-core.js`는 순수 엔진이며 두 HTML 내부 `championship-core-v023` 스크립트와 동일하게 유지.
- 대회 탭(`battle` 섹션) 하단 `championshipPanel`: 달력/참가 버튼/대진·준결승 결승/우승 목록.
- 전투 `window.DCBattleArena.launchTournament(match)`가 대회 준결승/결승을 기존 AI 전투 엔진으로 실행; `settleMatch` 결과가 `DCChampionship.finishMatch`에서 단 한 번만 정산됨.
- **결승 승리**: 상금(시설 Bit) 및 추가 포인트, 트로피, 랭크 추가. 일상 전투 기본 보상은 기존대로 유지.
- **중도 종료/강제 종료**: 진행 중인 대회 매치만 패배로 기록; 새로고침 `pendingBattle` 확인. 경기 시작 전 화면 닫힘은 자동 부전패로 처리하지 않음.
- **재활용 가능한 2v2** 선택지를 전투 팀 구성에 추가. `state.championship`는 이전 세이브에는 자동 생성.
- **검증 범위**: Node 128 테스트 + Chromium 경량 브라우저의 일반 HTML 및 단일 HTML 1대1 준결승/결승 + 2v2/3v3 규모. 실제 Android 실기 대용량 미디어 장시간 전투는 미검증.
- **ROM 미검증 임시 데이터**: 컵 명칭·우승 상금·주기·적군·계급 요구치. 오리지널 챔피언십 스케줄·실제 NPC 명단은 ROM 분석 후 교체 예정.
