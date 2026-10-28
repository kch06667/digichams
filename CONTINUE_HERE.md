# 최신 완료 — 큰 배경 타일 해석 수정 (2026-10-28)

- 유니몬 수정 `9bf5d4d` 뒤 작업. `tools/rom_graphics.py`의 NBS (2,1) 엔트리를 일반 NSCR과 분리: 타일 번호의 1,024 초과 부분을 보존, 반전 비트를 상위로 이동.
- NBS100파일/참조범위 통과(확장89/일반11), 독립 NSCR 대조768칸 및H-flip21개 일치. V-flip bit15는 독립 검증 없이 INFERRED로 명시.
- 배경194개 재복원: 49개 변경, 145개 동일. 기존 PNG 비교57일치/67차이. 대표 field_bm07_01과 cageBG416은 지형이 연속적으로 복원됨. 원본/새 이미지는 저장소에 추가하지 않음.
- 검사 `python3 -m unittest discover -s tests -p 'test_rom*.py' -q`:35/35. ROM 입력으로 --verify-nbs 및 --audit-backgrounds 재현. 전체 스프라이트 재분석은 하지 않았음.
- 결과는 /workspace/scratch/digichams-private/graphics-nbs14. 이전 graphics/background-audit.json은 수정 전 기록으로 보존, 최신 배경 결과와 혼동 금지.
- 공유 cageBG416_000..003 NSCR4개는 연결 미확정. ARM9/overlay의 정확한 파일명 및 연속 ID 패턴 검색에서 근거를 얻지 못함. 파일명 유사성만으로 강제 연결하지 않는다.
- 다음: NDS 로더에서 공유 배경/확장 NBS 해석 추적, V-flip 검증 또는 기존 배경 교정 적용 방법 결정. 이번 변경은 분석 도구이며 게임의 PNG/세이브는 무변경.

---

# 최신 완료 — 유니몬 #5 연결 수정 (2026-10-28)

- ROM 애니메이션 #5와 일치한 기존 `m357_unimon_main_5_1.gif`를 실제 게임에 연결. index.html의 #4 대체 제거, standalone.html의 유니몬 슬롯5 내장 데이터 동기화.
- 다른 게임 코드/내장 프레임/세이브 데이터는 변경하지 않았음을 이전 커밋과 구조 비교로 확인.
- `node tests/sprite-catalog.cjs`: 9/9. 감사 도구 합성 테스트1/1. 전체 스프라이트 감사8,640개/오류0. 두 HTML×390/1365 브라우저 4조합에서 실제 spriteUrl(유니몬,5) 이미지 바이트/로딩 확인, 페이지 오류0.
- 비교 캡처는 무시 경로 test-output/unimon-rom-fix에만 있음. #4/#5 이미지 비교이며 원작 실제 피격 장면과의 동작 대조는 아님.
- 브랜치는 analysis/rom-graphics-20261028, 분석 커밋 f9f285f 뒤 적용 체크포인트. 최종 SHA는 git log -1 확인. main 병합은 별도.
- 다음: 팔레트 차이를 원작 실행/로더 코드로 검증하거나, 공유 배경4개 참조를 확인. 완료한 유니몬 수정/전체 GIF 분석은 반복하지 않는다.

이하 과거 기록의 “유니몬 미적용”은 아래 시점 상태다.

---

# 현재 재개 지점 — 2026-10-28 ROM 그래픽 분석

- 브랜치 `analysis/rom-graphics-20261028`. 기존 main `aa6db16`에서 시작. `c974632`(디지몬 복원/GIF 대조), `d758de5`(배경/씬/공간 격자), 이후 BSA 애니메이션 체크포인트는 `git log -1` 확인.
- 먼저 ROM_ANALYSIS_PROGRESS.md 최상단 → ROM_ANALYSIS/GRAPHICS_FORMATS.md → docs/audits/rom-graphics-v023.json 읽기. 전체 프로젝트/스프라이트 재조사 불필요.
- 검증: 216종 8,640개 GIF 중 7,849 픽셀 시퀀스 일치, 791 차이. 그래픽 구조5,974파일, sprite-bank1,258개/24,602셀 렌더링, 배경194개, BSA19구조검증. NXR96/OPM75/ATR120/COL40/ESC30 별도 파싱. 합성테스트33/33.
- 저장소 밖 `/workspace/scratch/digichams-private/graphics`에만 이미지와 상세 JSON. 다른 환경은 로컬 ROM 입력으로 도구를 재실행. 저장소에는 분석 도구·합성테스트·메타데이터 요약만 있음.
- 게임 소스/세이브/기존 자산은 이번 분석에서 수정하지 않음. 다음 추천: 유니몬 #5_1은 ROM #5와 일치하므로 현재 #4 대체 연결을 작은 코드 수정으로 교체하고 두 HTML/내장 자산 일치 검사. 아직 자동 적용 안 됨.
- 분석 후속: 팔레트 모션 791개 차이(런타임 팔레트 변경 미확인), badge61 4/8bpp 모순, 공유 배경4 참조, COL cm29 24칸 반례. 진화/능력치 숫자 테이블은 미복원.
- 검사 `python3 -m unittest discover -s tests -p 'test_rom*.py' -v`; 필요 패키지 Pillow. 게임 테스트는 소스 무변경으로 이번 단계에 반복하지 않았음.

---

# 2026-10-28 추가 체크포인트

- 그래픽/배경/공간 데이터 분석 도구 작성. 최신 수치와 보류 항목은 ROM_ANALYSIS_PROGRESS.md 최상단 및 docs/audits/rom-graphics-v023.json.
- `analysis/rom-graphics-20261028`, 현재까지 게임 소스 수정 없음. 31개 합성 테스트 통과.
- 216종 비교 재수행 불필요: 저장소 밖 graphics/web-sprite-comparison.json 재사용. 배경/씬 원문 보고서도 같은 private 경로.
- 다음 BSA 배경 애니메이션 19파일 후보 검증 또는 유니몬 #5_1 적용. 새 추출 자산은 Git에 추가하지 않음.

---

# 2026-10-28 현재 분석 작업

- `analysis/rom-graphics-20261028`: ROM 그래픽 복원 도구 + 합성 테스트 추가. 게임 소스는 현재 변경 없음.
- 먼저 ROM_ANALYSIS_PROGRESS.md 최신 항목 확인. 216종/8,640애니메이션 비교 완료(7,849 픽셀 일치, 791 차이). 기존 전체 스프라이트 감사 대신 새 비교 보고서를 재사용.
- 다음: 미지원 NBS/NSCR 변형, 팔레트/투명도 차이 조사. 유니몬 #5_1은 ROM #5와 일치하므로 기존 #4 대체 수정 후보.
- 산출물은 `/workspace/scratch/digichams-private/graphics`에만 있음. 도구·테스트·요약만 커밋. 다른 환경에서는 제공 ROM과 명령으로 재현.
- 빠른 테스트 `python3 -m unittest discover -s tests -p test_rom_graphics.py -v` (14개, Pillow 필요). 마지막 커밋은 `git log -1` 확인.

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
