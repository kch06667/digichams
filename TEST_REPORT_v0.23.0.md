# v0.23.0 챔피언십 개발·검증 보고서

## 구현
- 신인 컵: DAY 1부터 7일 주기, 1대1, 준결승+결승.
- 지역 컵: DAY 5부터 7일 주기, 2대2, 2승 및 신인 우승 필요.
- 월드 챌린지 컵: DAY 10부터 10일 주기, 3대3, 5승 및 지역 우승 필요.
- 챔피언십 준비/참가/진행/결승 우승/패배, 랭크, 이력, 시설 Bit 상금, 훈련 포인트, 자동 세이브 및 JSON 이관.
- 기존 전투 엔진에서 실제 HP/TP와 육성치를 사용하며 누적 전투/승률/친밀도 등 기존 기록에 반영.
- `pendingBattle.tournamentMatchId`로 전투 중 새로고침·중단 패배 처리, 우승 트로피/상금 중복 정산 방지.
- 이전에는 선택 불가능했던 전투 2v2 옵션을 실제 추가.

## 수행 테스트 (2026-10-27)
- 기존 9개 Node 묶음: farm-core 30 + evolution-core 12 + evolution-tree 18 + sprite-catalog 9 + cage-training 16 + care-seasons 11 + hunt-core 14 + battle-core 6 + battle-rest 1 = **117 PASS**.
- 새 `node tests/championship-core.cjs`: **11 PASS** (일정 계산, 참가 조건, 트로피, 보상 1회, 패배/새로고침, 세이브 유지).
- 총 **128/128 Node PASS**.
- `python tests/battle-browser-logic.py`: 일반/standalone **2 PASS**.
- `python tests/championship-browser.py`: 일반/standalone **2 PASS**. 1대1 2라운드 전투 UI 연동, 우승 보상·세이브 기록·중복 지급 방지. 브라우저 저장소는 실제 보안을 우회하지 않고 테스트용 모의 저장소로 검증.
- `python tests/championship-brackets-browser.py`: 모바일 뷰 **1 PASS**, 지역 2대2와 월드 3대3 출전 인원 및 중단 탈락 검사.
- 두 HTML 각 16개 inline script `node --check` PASS; 두 HTML에 삽입된 진화와 챔피언십 엔진 원본이 파일과 동일함 확인.

## 제한·주석
- 원작 NDS의 구체적인 대회 스케줄, 타이틀/상금/NPC/진행 규칙은 아직 ROM에서 확인하지 못했음. 현재 대회·상대·2라운드 구성은 **확장판 임시 규칙**이며 원작 확인 완료라고 주장하지 않음.
- 기존 로컬 세이브 JSON은 변경 없이 읽도록 설계했지만 실제 사용자 디바이스의 과거 세이브 마이그레이션 수동 검사는 아직 없음. 업그레이드 전 JSON 백업 권장.
- Chromium 경량 통합 테스트는 기존 미디어 데이터를 제거해 게임 로직/DOM만 실행함. 실제 모바일 디바이스의 GIF 프레임과 장시간 전투 렌더링은 미검증.
- 일부 구형 `jsdom` 회귀 묶음은 의존성 설치 상태에 따라 미실행. 위 명시한 테스트만 완료 처리.
- 원본 저작권 이미지 포함: 개인 작업·비공개 백업만. 공개 배포 시 권리 검토 필요.
