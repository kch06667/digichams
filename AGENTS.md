# Latest checkpoint v0.23.0 (2026-10-27)
# Follow `CONTINUE_HERE.md` first. Hexagonal farm supersedes corridor plans. Preserve game saves and make versioned ZIP checkpoints.

# Latest checkpoint v0.23.0 (2026-10-27)
# Follow `CONTINUE_HERE.md` first. Hexagonal farm supersedes corridor plans. Preserve game saves and make versioned ZIP checkpoints.

# Codex 작업 지침 — Digimon World Championship 개인 웹 확장판

## 고정 목표
- 원작 한국어 NDS 《디지몬 월드 챔피언십》의 핵심 육성, 포획, 진화, 전투, 대회 구조를 가능한 한 충실히 복원하고, 합의한 웹 확장을 단계적으로 추가한다.
- 개인용 PC/Android 브라우저, 좁은 모바일 터치 및 PC 마우스/키보드 지원. NDS 듀얼 스크린과 현대적인 확장 뷰는 동일 게임 상태를 사용한다.
- 첫 화면·개발 핵심은 '작은 육각형 사육장 하나'이며, 거대 맵이나 직선 복도형 방 구매 구성을 초기 기본 설계로 채택하지 않는다.

## 읽기 순서/충돌 해결
1. `docs/PROJECT_BRIEF_LATEST.md`: 최신 합의/기능 책임의 최우선 출처.
2. `docs/SYSTEM_CONTRACTS.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/OPEN_QUESTIONS.md`.
3. `docs/DESIGN_DECISIONS_SOURCE.md`: 추가 결정의 실제 기록.
4. `docs/MASTER_SPEC_SOURCE_v0.4.md`: 원작/위키 연구, 상세 사례, 과거 제안.
5. `references/` 및 실제 ROM/영상/프로토타입 파일. **원작 수치는 문서의 주장이 아니라 검증 대상**.
사용자가 새로 확정한 변경 > 최신 통합 합의 > 과거 제안. 원작의 사실 여부는 ROM 검사 > 관찰 가능한 영상 > 위키 주장 > 임시 밸런스 수치 순으로 증거를 분리한다.

## 금지/주의
- 파일이 존재한다고 가정하지 말고 탐색할 것. 원문의 `/mnt/data` 경로는 옮겨진 Codex 프로젝트에서는 유효하지 않을 수 있다.
- 없는 종/기술/애니메이션/ROM 해독 결과를 만들어 '원작 확정'이라고 표시하지 말 것. 필요하면 임시 데이터임을 명시한다.
- P0 자료 조사 완료 전 대규모 게임 전체 재작성을 하지 말 것. 기존 v0.14 동작을 테스트하고 안전하게 단계적으로 모듈화한다.
- 확장 퀘스트/전문 테이머 전원 처치를 원작 대회 입장 필수 조건으로 추가하지 말 것.
- 개체값 6V, 25기질, 관계/합동 기술을 원작 규칙과 혼동하지 말 것.
- 원작 자동 전투를 유지하고, 전술은 기술/TP/조건을 우회하지 않는다.
- 자동화로 훈련 시간을 건너뛰거나 진화 조건을 무시하지 말 것.
- ROM/원본 저작권 자산을 공개 저장소/공개 배포에 포함하지 않는다. 제3자 IP의 배포 권한이 없음을 전제한다.

## 구현 아키텍처
- 게임 로직과 표현(UI, GIF, 이펙트)을 분리한다. 데이터 중심 JSON/타입·검증, 결정적 시뮬레이션 시계, 정지/1x/2x/4x, saveVersion 및 마이그레이션.
- 최소 공통 모듈: world clock/event scheduler, species/individual, stats & breeding, evolution, farm/hex/navigation, facility/training, food/health, storage, hunting, battle/AI, tournament, quest/NPC, UI, save/load.
- `provenance`: `rom_verified`, `video_observed`, `community_wiki_unverified`, `user_design`, `temporary_balance`. 계층에 따라 설명 가능한 근거(경로·주소·타임코드) 보존.
- 시간 배속 중 이벤트 중복 실행, 교육/회복 이중 정산, 화면 레이아웃 전환 시 상태 초기화 방지. 소수 주요 시스템은 자동화 테스트를 작성한다.

## 매 작업 수행
1. 지금 단계/사용자 요구/관련 파일 파악.
2. 최소 변경의 구현·테스트.
3. 실행 방법, 바뀐 파일, 실제 통과/실패 테스트, 확인된 원작 근거, 임시 데이터, 남은 할 일을 한국어로 보고.
4. 상태 표시: 완료 / 부분 구현 / 검증 대기 / 미구현. 실제 안 한 일 완료로 표시 금지.
5. 우선 첫 단계에서는 **프로젝트 현황 조사 + 실행 가능 여부 확인 + P1 첫 수직 슬라이스 작업계획**부터 제출한다.

## v0.23.0 이후 개발 / 재개 (2026-10-27)
- 시작 시 이 파일, CONTINUE_HERE.md, ROM_ANALYSIS_PROGRESS.md를 먼저 읽는다. 최신 사용자 지시가 우선한다.
- 기존 체크아웃에서 작업 브랜치를 사용한다. 요청 없이 worktree 생성, main 덮어쓰기, 원격 push/배포를 하지 않는다.
- `src/farm-core.js`, `src/hex-farm-ui.js`, `src/hex-farm.css` 수정 시 두 HTML의 동일 ID 인라인 블록을 동기화한다. 전체 HTML은 대용량이므로 필요한 블록만 읽는다.
- 핵심 테스트: `node --test tests/farm-navigation.cjs`, `node tests/farm-core.cjs`; 관련 회귀: evolution-core/evolution-tree/cage-training/care-seasons/hunt-core/battle-core/battle-rest/championship-core/sprite-catalog.cjs.
- 브라우저: `python3 tests/farm-placement-browser.py` (Python Playwright, Chromium; CHROMIUM_PATH 지원). 실제 HTTP 서버를 임시 포트에서 실행·종료하며 두 HTML/PC/터치/저장 복원 확인.
- 실행: 저장소 루트에서 `python3 -m http.server 8000 --bind 127.0.0.1`. index.html 사용. 새 프로세스는 새 세션에서 재시작 필요.
- 테스트가 생성한 기존 results.json을 현재 실행 결과와 혼동하지 않는다. 실제 실행 내역은 TEST_REPORT.md 기록.
- ROM_VERIFIED/GUIDE_VERIFIED/INFERRED/PLACEHOLDER는 의미·출처 검증에 따라 구분. 파일 존재만으로 모션 의미를 확정하지 않는다.
- 스프라이트 감사: `python3 tools/audit-sprites.py --output /tmp/sprite-audit.json` (Pillow). 현재 알려진 누락 1개로 exit 1; docs/audits/sprites-v023.json 재사용. 도구 테스트: `python3 -m unittest discover -s tests -p test_sprite_audit.py -v`.
- 시설/경로 변경 후 `node --test tests/farm-navigation.cjs`, `python3 tests/farm-routing-browser.py` 실행. 경로는 열린 외곽→중앙→목표 시설이며 station 예약과 남은 행동 타이머의 저장/복원 유지. test-output/farm-routing에 로컬 캡처 생성.
- 이동 회피 변경 후 `node --test tests/farm-avoidance.cjs tests/farm-navigation.cjs` 실행. 최소 발 간격은 10 좌표단위(확장 UX), 실제 스프라이트 외곽 크기와 구분. 명시적 행동을 회피를 위해 취소하지 않는다.
- 세이브 가져오기 수정 시 `python3 tests/save-import-browser.py` 실행. 입력 사본을 먼저 검증/초기화하고, 실패 시 live state와 저장/백업을 유지해야 한다.
- ROM 입력/도구는 ROM_ANALYSIS_PROGRESS.md 참조. `tools/rom-database.py`는 해시가 일치하는 제공 한국판을 읽기 전용 분석하고 체크아웃 밖으로만 출력. 출력 텍스트/원본/바이너리를 git add 하지 않는다. text_index는 아직 종 ID가 아니다.

- ROM 그래픽: `tools/rom_graphics.py --rom ... --output-dir <저장소 밖> --audit --compare-web`; 검사 `python3 -m unittest discover -s tests -p test_rom_graphics.py -v`. Pillow 필요. 그래픽 인덱스/파일명으로 모션 의미나 종 ID를 임의 확정하지 않는다.
