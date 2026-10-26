# v0.15.1 테스트 보고

- 자동 테스트: 총 49개 통과 (farm core + hex browser + save browser + feeding browser)
- PC 브라우저에서 먹이 버튼 → 맵 클릭 → 식사 및 배부름 표시 검증
- 모바일 Chromium 터치 탭 실험 통과 (실제 안드로이드 기기 수동 테스트는 별도)
- 2마리 먹이 경쟁, 저장 파일에 있는 먹이 복원, 훈련 중 명령 보존 검증
- index/standalone 내장 스크립트 구문 검사 통과
- 기존 전투 UI 존재/열기 및 모바일 오버플로 확인. 전투 시나리오 전체 엔드투엔드 플레이는 이번 회귀 검사 범위 밖
- ROM 원작 세부 수치 미검증; hungerRate, HP 효과 등 임시 밸런스
