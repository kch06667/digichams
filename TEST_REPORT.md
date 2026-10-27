# 실제 테스트 — 2026-10-27

환경: Node 24.19.0, Python 3.12.14, 시스템 Chromium, Python Playwright.

## 수정 전 재현
`node --test tests/farm-navigation.cjs`: 4건 중 1 통과/3 실패.
지도 밖 및 잠긴 구역 먹이 허용, 대기 해제 순간 이동, 보관 개체의 시설 점유를 재현.

## 수정 후
- 신규 farm-navigation: 4/4 통과. 기존 먹이 소비·구매한 외곽 시설 배치도 검증.
- 기존 10개 Node 스위트 모두 exit 0: farm-core, evolution-core(12), evolution-tree(18), sprite-catalog, cage-training, care-seasons, hunt-core, battle-core, battle-rest, championship-core(11).
- `python3 tests/farm-placement-browser.py`: index/standalone × PC/모바일 터치 4조합 통과. NDS/확장 화면 문서 폭, 먹이 버튼→맵 클릭/탭→1회 소비→섭취, 잘못된 위치 무과금, JSON 가져오기, 실제 HTTP localStorage 새로고침 보존. pageerror 없음.
- 기존 Node 테스트는 현재 구현의 회귀 검증이며 원작 재현도 증거가 아님.

## 미검증
실제 Android 장기 사용, 전투 시각/넉백/AI, 전체 브라우저 과거 테스트, ROM 원작 값, 전체 시설 경로 및 개체 충돌. 이번 수정은 그래픽 교체가 아니며 전후 이미지 비교는 생략.

## 스프라이트 자동 감사
- `python3 tools/audit-sprites.py --output /tmp/digichams-sprite-audit.json`: exit 1, 예상 8,640개 중 8,639개 모든 프레임 디코딩 성공, 누락 경로 1개. 감사 실패를 통과로 취급하지 않는다.
- 유니몬 m357_unimon_main_5.gif 없음. 실제 index.html은 #4 대체, standalone #5도 #4와 SHA-256 동일. 별도 #5_1.gif 존재하나 의미 미확정이므로 교체하지 않음.
- 단일 프레임 3,676개(오류/모션 부재로 단정할 수 없음), 256px 초과 캔버스 0. 종별 단일 프레임 목록은 docs/audits/sprites-v023.json. #6/27/36/38/39 의미 미확정.
- 감사 도구 합성 fixture 테스트 `python3 -m unittest discover -s tests -p test_sprite_audit.py -v`: 1/1 통과. 정상/다중프레임/누락/손상 구분.

## 시설 자리·경로 개선 (2026-10-27 후속)
- 수정 전 두 시설 사용자의 동일 좌표 겹침 재현. 직선 이동은 외곽 구역 사이를 가로질렀음.
- `node --test tests/farm-navigation.cjs`: 9/9 통과. 기존 4건 + 두 자리/대기 해제, 지형·통로 이동, 중간 저장 복원 동일성, 구세이브 겹침 복구, 공격/방어 공유 대기열.
- 기존 핵심 10개 스위트 모두 exit 0. farm-core의 훈련 주기 비교는 고정 이동 초 대신 실제 도착 시점을 기다리도록 변경. 보상 전 상태 및 15% 주기 단축 검증 유지.
- `python3 tests/farm-routing-browser.py`: 두 HTML × PC/터치 4조합 통과. 실제 표시 좌표 58px 이상 분리, 연결 통로, 대기→훈련, 저장 복원, NDS/확장 화면 문서 폭 검사. pageerror 없음.
- `python3 tests/farm-placement-browser.py`: 4조합 통과. 먹이 클릭/탭/섭취/JSON/새로고침 보존 유지.
- 추가 진단: 열린 7구역에서 외곽 4시설까지 총 28쌍 이동을 0.05초 단위 표본 검사. 지면/통로 이탈 0, 이동속도 한도 초과 0.
- 전후 캡처: test-output/farm-routing/index.html-{desktop,touch}-{before,after}.png. before는 d4b3a1e HTML을 동일 3개체 시나리오로 실행. 이미지는 로컬 ignored 출력, 외부 업로드 없음.
- 한계: 이동 중 개체 상호 회피·혼잡 상황, 모든 시설 사이 서로 다른 작업 위치 간 충돌, 실제 Android 장기 사용 미검증. 통로/좌표 규칙은 확장판 설계이며 ROM 복원 아님.

## 이동 회피 / 유휴 양보 후속 검증
- 수정 전 farm-avoidance 초기 4건 중 3 실패: 정면 교행 최소 거리 약 0.8, 교차 약 0.57, 훈련 개체 관통.
- `node --test tests/farm-avoidance.cjs tests/farm-navigation.cjs`: 17/17 통과.
- 회피 8건: 정면 교행, 교차, 고정 훈련 개체 통과, JSON 복원 결정성, 좁은 중앙-훈련장 통로, 4방향 교차, 목적지 유휴 개체 양보, 초기 겹침 탈출. 위치별 0.05초 검사에서 속도 한도 유지, 열린 지면/통로 유지, 이미 분리된 경우 최소 10 좌표단위 유지와 도착 확인.
- 기존 핵심 10개 Node 스위트 모두 exit 0: farm-core/evolution-core/evolution-tree/sprite-catalog/cage-training/care-seasons/hunt-core/battle-core/battle-rest/championship-core.
- `python3 tests/farm-routing-browser.py`: 두 HTML × PC/터치 4조합 통과. 기존 시설/대기/저장 검사와 4방향 교차의 최소 간격/전원 도착/표시 개체 수 확인. pageerror 없음.
- `python3 tests/farm-placement-browser.py`: 두 HTML × PC/터치 4조합 통과. 먹이 배치/섭취/JSON 및 새로고침 저장 유지.
- 이번 변경은 동적 이동 로직이며 새 그래픽 자산 없음. 기존 시설 스크린샷은 test-output/farm-routing에 재생성됨; 회피 전후 정지화면 비교는 수행하지 않음.
- 실제 Android 장기 사용, 50개체 고밀도 성능, 작업 중 개체가 목적지를 막은 경우, 모든 대기열 포화 상황은 미검증. 그림 외곽이 아닌 발 위치 간격 검사다.

## 상태 문구 표시 확인
- UI만 변경하여 전체 시뮬레이션 회귀는 반복하지 않음.
- 임시 `/tmp/check-farm-status.py`로 실제 HTTP Chromium 검사: index/standalone × 390/1365px에서 통로 대기, 일반 이동, 자리 양보, 시설 대기, 유휴 상태를 주입하여 표시와 이전 문구 해제를 확인. 20개 확인 통과, pageerror 없음.
- 이는 상태 표시 검사이며 실제 회피 동작 검증은 앞선 회피/경로 테스트 결과 참조.

## 먹이 배치 Esc 취소
- 임시 `/tmp/check-feed-escape.py`, 실제 HTTP Chromium에서 index/standalone × hexDrop/feed 총 4조합 통과.
- Esc 취소 후 선택 모드 해제, 두 버튼 원래 문구 복귀, 반복 Esc에서 먹이 수와 바닥 먹이 배열 동일, pageerror 없음.
- 입력/UI 변경만 있어 전체 게임 회귀는 반복하지 않음.

## 세이브 불러오기 보호
- 수정 전 손상 중첩 데이터 9종 × 두 HTML 검사에서 현재 상태 변경 또는 손상 입력 수락 재현.
- `python3 tests/save-import-browser.py`: 두 HTML 각각 손상 입력 9건 거부 및 live state/localStorage/기존 백업 불변 확인. 별도로 구세이브 수락, 입력 객체 불변, 강제 render 실패 시 이전 상태/저장/백업 복구 통과.
- 기존 farm-placement-browser.py 및 farm-routing-browser.py 총 8조합 통과. 다른 게임 엔진은 변경하지 않음.
- 브라우저 저장 용량 초과/권한 차단 시 기존 save 함수의 best-effort 동작은 유지; 저장장치 오류의 원자적 복구까지 보장한 것은 아님.
