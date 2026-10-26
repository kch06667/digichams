# v0.18.0 테스트 및 변경 내역

- 216종 스프라이트 도감 명칭과 GameFAQs 2008-10-04 hemlock86 원작 진화표를 연결
- 유년기 I/II, 성장기, 성숙기, 완전체에서 총 179종 진화 출발점 및 477개 분기 규칙 등록. 궁극체 37종은 마지막 단계이므로 출발 경로 없음
- 조건: 누적 전투, 승률, AP 11계열, 환생 횟수, 육성 패널티, 시간 경과
- 진화 목표 설정/해제 기능: 목표가 있으면 나머지 분기로 자동 진화하지 않음
- 도감 종 상세에서 전단계/다음단계 검색 및 클릭 탐색 기능
- 기존 실험용 쿠네몬->쿠와가몬 AP 진화는 원작 공략의 쿠네몬->캅테리몬으로 변경; 쿠와가몬은 텐타몬 AP 경로 등에서 접근
- Guide 이상 데이터 주의: 성숙기 블루메라몬이 공략 Perfect 섹션의 진화 출발점으로 등장; 가드로몬->세이버드라몬 등 동일 단계 경로 존재. 원본 자료 그대로 표시하되 원작 ROM과 추가 대조 필요
- **원작 미검증:** 진화 우선순위, 테이머 랭크 제한의 구체적 값, 시간 경과 5일, 단계별 수명 수치, 시설별 AP 획득량. 현재 게임에서는 임시 규칙 유지.

자료: https://gamefaqs.gamespot.com/ds/943756-digimon-world-championship/faqs/54306

## 실행 검사 결과
- Node 자동 테스트: `farm-core.cjs` 30/30, `evolution-core.cjs` 12/12, `evolution-tree.cjs` 18/18, `sprite-catalog.cjs` 9/9, **총 69/69 PASS**.
- HTML 내 인라인 스크립트 Node 구문 검사: index 9/9, standalone 9/9 PASS.
- 실제 Chromium: `evolution-ui-browser.py` 모바일 390px/PC 1280px 도감 계보 탐색 + GIF 불러오기 모두 통과.
- 실제 Chromium: `evolution-browser.py` index 및 standalone 기존 전투 기록 → 코로몬 진화, 가부몬 시간 진화, JSON 상태 복원, 대전 참가 기록 통과.
- 실제 Chromium: `evolution-goal-browser.py` index 및 standalone 목표 설정, 다른 진화 차단, 목표 조건 충족 후 진화, 도감 검색 통과. JS 오류 0건.
- **한계**: 전체 게임의 장시간 모바일 수동 플레이 테스트는 미실시. 특정 원작 ROM 동작/진화 우선순위/테이머 랭크 조건은 미확인.

