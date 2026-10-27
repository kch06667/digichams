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
