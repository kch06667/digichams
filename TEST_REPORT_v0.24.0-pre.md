# v0.24.0-pre 안정화 체크포인트

- 기준: v0.23.3 통합판 (GitHub main aa6db16에서 병합된 Codex 변경 포함).
- 수정: 이전 세이브에서 디지몬 좌표가 사육장 밖이거나 비정상 숫자인 경우 중앙의 유효 좌표로 복구.
- 진행 중 훈련 명령은 보존하며, 복구 직후 훈련 보상이 지급되지 않도록 이동 모드로 전환.
- 수정 소스: src/farm-core.js, index.html, standalone.html.
- 테스트: farm-navigation + farm-avoidance 19/19 통과 (기존 17 + 신규 2).
- 핵심 Node 11개 묶음 통과, ROM/sprite/sync 도구 테스트 통과.
- 브라우저 통합 재검증은 장시간 실행으로 일부 미완료. 실제 Android 테스트 미실시.
- 스프라이트 유니몬 #5 누락과 고밀도 교착은 아직 미해결.
- GitHub: integration/v0.23.3-safe 브랜치는 main의 aa6db16에서 생성했지만 통합 ZIP 내용은 아직 푸시하지 않음.
- 추가: `python tests/v0233-merge-browser.py` 통과 (index/standalone × 390/1365px 4/4; 오류 0). 테스트의 UI gameVersion 표시는 0.23.3이며 v0.24-pre 코드 버전 전반의 변경을 의미하지 않는다.
- 최종 ZIP 무결성 점검: 약 8,915개 엔트리, CRC 오류 없음.
