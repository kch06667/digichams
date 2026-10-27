> 개발 작업 안내 (2026-10-28): 최신 GitHub `main`을 기준으로 진행하고 매 수정마다 ZIP을 만들지 않습니다. `node tools/build-dev-page.cjs`로 가벼운 `index.dev.html`을 생성하여 개발·테스트하고, 기존 배포용 HTML은 그대로 유지합니다. `docs/DEVELOPMENT_WORKFLOW.md` 참고. 아래 v0.23.0 설명은 과거 기능 기록입니다.

# Digimon World Championship · Browser Expansion Prototype v0.23.0

Extract the full ZIP, then open `index.html` or `standalone.html`. Retains the earlier v0.14.2 game's battle, hunting, evolution, ROM art and sprite code; progressively integrates the user-approved hex farm.

## Playable added functions

- Digimon walk to destinations before feeding, training and resting.
- Advanced unlocked top training hex, right racetrack hex, bottom-left rest hex are actual navigation destinations; follow-camera button.
- Stat HP cost and fatigue, attack/defense/speed changes, 1x/2x/4x clock, automatic rest and resumed training.
- **NEW target training**: enable `목표 능력치까지 훈련하고 자동 중지`, set desired stat (1–999), click corresponding Attack/Defense/Speed button. Repeats until reached, then stops. This does not guarantee Digimon evolution.
- JSON game-state export/import as a portable backup, plus local autosaves where browser storage permits.

## Important

Always export JSON before version changes. No original `.nds` ROM is packaged. Original NDS numeric values are not all decoded; expansion time/bonus values are placeholders. View `TEST_REPORT_v0.16.0.md` and `CONTINUE_HERE.md` for factual implementation/test limits.

- v0.15.1: hungry Digimon queue for placed food (most hungry first), autonomous wandering/rest and eat animation; unified embedded and detached JS sources.

## v0.16.0 reproduction upgrade
Species-specific evolution rules, individual battle/win history, AP gains, stage aging, egg revert framework. Old saves are migrated without discarding Digimon, and a battle ID generation browser crash was repaired. Balancing remains explicitly provisional pending ROM checks.

### v0.17.0
원본 스프라이트 216종을 도감/전투/탐색 자원에 연결. 한글 명칭은 ROM 파일명 기준 1차 대응이며 일부 검수가 필요. 조건 미확인 진화는 임의 생성하지 않음.

### 0.18.0 진화 계보
- 도감 선택 → 하단 이전/다음 진화 버튼 탐색. 소유 디지몬 도감 → 진화 목표 지정 → 해당 조건 충족 시 진화.
- 179종 출발·477개 경로. `assets/evolution-routes.json`에서 모든 경로 검토 가능. 진화 밸런스 수치는 추후 원작 검증 필요.


### v0.19.0 원작 시설 효과 재현 1차
- **육각형 사육장 → 특별 훈련장 건설 → 사육장 하단 `원작 훈련 시설` 목록**에서 하위 케이지를 선택해 구입하고, 디지몬을 보내면 이동 후 반복 훈련. AP 목표 수치 지정 및 자동 휴식·재개 지원.
- 11개 시설로 11종 숨겨진 종족·속성 AP를 커버하며, 열/냉기/번개/빛/어둠 저항은 별도 기록.
- 실제 시설 효과 방향은 원작 공략 근거; 수치·비용·랭크 제한은 임시 밸런스. 원작은 진입 1회 훈련이고, 지속 자동 반복은 확장판 기능.
- 훈련 → 종별 진화 조건 달성 → 자동 진화 이후의 행동 중지 연결. 기존 세이브의 시설 기록은 유지되고 신규 `cageFacilities`는 빈 값으로 이관.
- 상세 출처/제한: `docs/CAGE_TRAINING_SOURCES.md`. 216종 그래픽, 477개 진화 분기, 식사/전투/보관소 유지.

**v0.20.0:** 계절별 훈련 효율과 질병/부상 시스템, 치료 버튼 추가. 정확한 ROM 수치(발생 확률/수명/계절 길이)는 미검증 임시값.


### v0.21.0 — 원작형 사냥 조작 1차

- 포획 탭에서 **탐색 → 로프 선택 → 야생 디지몬 주변에 원 1회(손 떼기) → 디지몬을 조금씩 당기기 → HP 0에서 손으로 집어 올리기**. PC는 드래그, 모바일은 터치 제스처.
- 묶인 상태에서 너무 길게 당기면 로프가 끊어지고 사냥 실패. 로프는 성공적으로 묶을 때만 1개 소비.
- 사냥 지역(숲/해변/유적), 움직이는 야생 디지몬, 도주 타이머, 음식 미끼, 대회 기록에 따른 로프 허용 성장 단계(임시).
- 포획한 개체는 `makeMon`을 통해 기존 사육장/진화 세이브에 그대로 등록됨. 팀이 50마리면 포획 불가 안내.
- **원작에서 확인**: 원을 한 번 둘러싸고 펜을 떼서 묶은 뒤 반복 당기기로 HP를 깎고, 마지막에 손으로 집음. **임시 밸런스**: HP, 로프 소모/등급 해금, 출현 지역/시간, 이동 속도, 미끼 효과, 도주 시간.
- 시작 방법: ZIP을 모두 풀어 `index.html` 실행. `standalone.html`은 이미지까지 내장되어 크기가 큼. 실제 기기에서 저장이 제한되면 JSON 내보내기/가져오기 활용.
- 테스트: `node tests/hunt-core.cjs`, `python tests/hunt-browser.py` 및 기존 테스트. 상세 `TEST_REPORT_v0.21.0.md`.


### v0.22.0 — 감독형 실시간 전투 업데이트
- 원본 GIF 216종의 기존 대기/이동/근접공격/피격/기절 매핑을 유지하고 실제 전투에 TP 자원을 연결.
- 내 디지몬의 HP와 TP는 실제 전투 결과와 함께 세이브에 저장됨. 구버전 세이브에 TP가 없으면 해당 개체 속도로 최대 TP를 임시 계산해 초기화. 세이브 로딩 때는 능력치를 임의로 변경하지 않음.
- 자동 전투: 균형 / 공세 / 수비 / 집중 공격 / TP 절약. 집중 공격은 가장 낮은 HP 비율의 적을 우선하며, 공세·수비는 회피/방어 및 이동 정책 차이. 상대편은 균형 AI.
- 기존 차지(에너지 100)에 더해 사용 가능한 TP가 있어야 필살기를 사용함. 전투 중 피격으로 소량 회복, 사육장 휴식으로 TP 회복. 전투 시연은 보상/소모 없이 진행.
- 대표 기술 이름 일부 추가, 기타 디지몬은 `기본 필살기(임시)`로 표시. 기술 이름·피해량·TP값은 ROM에서 완전 복원된 것이 아닌 확장판 임시 규칙.
- UI에서 양 팀 HP·TP 및 아군 전술 선택 가능. 원작 그래픽 파일은 전혀 교체하지 않음.
- `src/battle-core.js`는 조건/전술/TP 순수함수의 원본이며 두 HTML에는 동일 코드를 인라인함.
- 빠른 자동 테스트: `node tests/battle-core.cjs`, `node tests/battle-rest.cjs`. Chromium의 경량 미디어 제거 통합 테스트: `python tests/battle-browser-logic.py`. 자세한 검증 한계는 `TEST_REPORT_v0.22.0.md`.


### v0.23.0 — 챔피언십/리그 진행 루프 (시범 구현)
- 전투 탭 하단 **테이머 챔피언십**에서 대회 일정·참가 조건·우승 이력을 확인하고 경기 출전.
- 신인(1v1)→지역(2v2)→상위(3v3) 컵. 각 대회는 준결승·결승의 2라운드, 패배 시 탈락, 2승 시 트로피/랭크/시설 Bit/훈련 포인트 보상.
- 실제 `DCBattleArena`의 자동 전투·개체 HP/TP 소모 및 누적 전투 이력을 사용. 모의 전투 승부를 결승 판정으로 사용하지 않음.
- 출전 가능 개체/개최 DAY/선행 대회 우승/누적 전투 승리 조건 검사. 일정은 반복 개최, 도전은 1회마다 새 대진.
- 대회별 상태, 준결승 진출 상태, 트로피, 이력을 기존 세이브 JSON에 보관. 중복 정산 방지 및 전투 중 이탈/새로고침 패배 처리.
- **매우 중요**: 대회 이름, 7/10일 주기, 상대 구성, 2라운드, 상금은 ROM 미확인 `temporary_balance`. 원작 대회표가 아님.
- 추가 테스트: `node tests/championship-core.cjs`, `python tests/championship-browser.py`, `python tests/championship-brackets-browser.py`.
