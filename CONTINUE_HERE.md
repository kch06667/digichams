# 현재 재개 지점 — 2026-10-27 / v0.23.0 기반

- 원격 main `dbca68e`를 기존 깨끗한 체크아웃에 fast-forward 후 `improve/farm-movement-v023` 브랜치 생성.
- 최신 사용자 요청: ROM 대기 없이 플레이 가능한 게임 개선 우선. 전체 조사 반복 대신 아래 구조와 TEST_REPORT.md 재사용.
- 완료: 열린 육각형 안쪽 먹이 배치 제한, 시설 대기 해제 시 순간 이동 수정, 보관/알 개체의 시설 점유 제외, 먹이 배치 중 개체 선택 클릭 방지. HTML 두 종류 동기화.
- 실행 파일 index.html / 오프라인 standalone.html. 사육장 core/UI/CSS는 src/hex-farm* 및 src/farm-core.js. 나머지 각 시스템은 src/*-core.js. 원작 수치 미검증.
- 실제 검증: 신규 Node 4건, 기존 핵심 10개 스위트, 실제 HTTP 브라우저 4조합 통과. 상세 TEST_REPORT.md.
- 마지막 게임 수정 정상 커밋: `3e1328f`. 이후 스프라이트 감사 도구/결과를 별도 커밋. 현재 미완료 코드 수정 없음.
- 다음: `docs/audits/sprites-v023.json` 재사용. 유니몬 #5는 파일 부재, 양쪽 HTML 모두 #4 대체(해시 일치). 후보 #5_1 모션 의미 확인 후 대표 종 모션 검토. 시설의 두 사용자가 같은 좌표에 겹치는 문제와 시설 간 경로가 육각형 사이를 직선 통과하는 문제는 아직 남음. 전체 내비게이션 완료로 보고하지 말 것.
- ROM은 /workspace 탐색에서 없음. ROM 복원 및 수치 교체는 하지 않음. 외부 push/배포 안 함.
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
