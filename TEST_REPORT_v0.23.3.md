# v0.23.3 통합 체크포인트 — 실제 검증 보고서

날짜: 2026-10-28(KST). 기존 v0.23.2 ZIP에 GitHub `kch06667/digichams` main `aa6db16` 시점의 Codex 변경을 기능별로 이식함. 원격 GitHub 변경/푸시 없음.

## 실제 코드 통합
- 사육장 시간·진화·전투 관련 기존 소스 그대로 재사용, farm-core 및 hex-farm-ui의 Codex 로직을 해당 블록으로 이식.
- 사육장 2자리 시설 예약, 통로 경유, 이동 회피, 유휴 자리 양보, 이동 대기 메시지.
- 먹이 바닥 좌표·개방 구역 검증, Esc 배치 취소, 화면에서 배우/디지몬이 클릭을 가로채지 않도록 CSS 수정.
- 손상 세이브 구조 검사·불러오기 전 사본 초기화·실패시 기존 상태 복구. 세이브 내보내기 `gameVersion=0.23.3`.
- v0.23.1 4/8팀 대진표, 3경기 월드컵, NPC 개체별 팀과 챔피언십 랭크 연동 보존.
- v0.23.2 사육장 WebP 및 독립형 standalone에 내장 이미지 유지.
- GitHub Codex ROM 텍스트 테이블/파일 인벤토리 분석, 스프라이트 감사 스크립트와 회귀 테스트 추가.

## 통과한 명령
- Node 11개 테스트 묶음: `farm-core`, `evolution-core`, `evolution-tree`, `sprite-catalog`, `cage-training`, `care-seasons`, `hunt-core`, `battle-core`, `battle-rest`, `championship-core`, `championship-bracket-expansion` — **모두 종료 코드 0**.
- `node --test tests/farm-navigation.cjs tests/farm-avoidance.cjs`: **17 / 17 통과** (9개 경로·시설+8개 회피/교차/저장).
- ROM 도구 합성 단위 테스트: **6 / 6 통과**.
- 스프라이트 감사 도구 합성 단위 테스트: **1 / 1 통과**.
- 새 인라인 번들 동기화 유닛 테스트: **3 / 3 통과**.
- Python Playwright Chromium 브라우저: `hex-browser.py`, `save-browser.py`, `hunt-browser.py`, `battle-browser-logic.py`, `evolution-browser.py`, `championship-browser.py`, `championship-brackets-browser.py`, `championship-v0231-browser.py` 모두 종료 코드 0.
- 신규 `v0233-merge-browser.py`: **4 / 4 통과** (index/standalone × 390/1365px). 확인 내용: WebP 배경, 7개 육각형, 오버플로 없음, 실제 좌표 먹이 선택/취소, 2점 통로, 손상 세이브 거부+기존 저장 유지, 8팀 대진 7경기 표시, pageerror 0.
- 브라우저 테스트는 **실제 Android에서 테스트한 결과가 아님**. 로컬 환경에서 HTTP 네비게이션이 차단되어 일부 브라우저 검사에서 HTML `set_content`와 임시 이미지 내장을 사용함. 실제 URL 기준 localStorage 지속성은 기존 save-browser의 모의 Storage 검증만 수행.

## 실제 ROM 파서 재검증
- 제공된 64MiB 한국판 NDS SHA256 `2092998ee80d6646c7115ef8f008f955e72e1860c718dc8d7cbc3b8cea9f2234` 일치.
- `tools/rom-database.py` 실제 실행 성공: FAT 6,434개, 파일 이름 6,412개, ARM9 overlay 22개, 데이터베이스 문자열 1,176개, 이름 후보 216개, 정확한 웹 이름 일치 146개.
- ROM 원본·분석 원문·결과 inventory는 배포 ZIP 바깥 별도 사유 경로에 두었음. ROM의 진화 공식/종 ID/기술 수치 해독 완료라는 의미가 아님.

## 알려진 실패/미검증
- `tools/audit-sprites.py` 전체 감사 결과: 8,640개 이미지 경로 중 **8,639개 정상 디코딩, 1개 누락** (`assets/sprites/champion/m357_unimon_main_5.gif`), 도구 종료 코드 1. 기존 fallback #4가 실행 중 사용되지만 #5_1 대체 의미는 검증 전. 기타 6/27/36/38/39번 애니메이션 의미 미확정.
- 변경 전의 `farm-core.cjs` 확대훈련장 시간 고정 가정은 중앙 경유 이동 변경 이후 부적합해, *도착 이후 남은 주기*를 비교하도록 Github와 동일하게 업데이트. 기존 `hex-browser.py` 외곽 이동 고정 13초 및 `save-browser.py` JS 합성 click(좌표 0,0)은 신규 길찾기/유효 타일 정책에 맞춰 정정했으며 현재 통과.
- 실제 안드로이드 장시간 전투, 포획 제스처, 앱 절전/저장 제한, 50마리 고밀도 길찾기, 기존 맵 밖 세이브 복구는 아직 미검증.
- 216종 스프라이트 모션 의미/원작 진화·훈련·대회 밸런스는 대부분 검증 대기. 일반 ZIP은 원작에서 유래한 그래픽을 포함하므로 공개 배포 권리를 주장하지 않음.

## 다음 액션
1. GitHub 최신 main 안전 브랜치에서 ZIP 변경분 반영, 기존 GitHub-only 분석 파일을 삭제하지 않고 diff 확인.
2. 전체 Node/브라우저 테스트 통과 확인 후 PR 생성, 검토 이후 main 병합.
3. 유니몬 #5 모션 시각 검증, 고밀도 데드락 개선, 안드로이드 실기 테스트.
