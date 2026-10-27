# 챔피언십 v0.23.1 통합/재개 안내

## 주의: Codex 로컬 이동 브랜치를 덮어쓰지 마세요
이 결과물은 GitHub `main`의 v0.23.0을 복사해 챔피언십 모듈만 개선한 **별도 체크포인트**입니다.
Codex가 알려준 `improve/farm-movement-v023`, 먹이 선택 `Esc`, 통로 대기/자리 양보는 **이 결과물에 포함되어 있지 않습니다**. 포함됐다고 표시해서는 안 됩니다.

## 단독으로 실행
1. 이 ZIP 전체를 새 디렉터리에 풉니다.
2. PC 브라우저에서는 `index.html`, 데이터 없는 단독 파일용은 `standalone.html`을 엽니다.
3. 기존 세이브는 진행하기 전에 JSON 파일로 내보내어 별도로 백업합니다.
4. 전투 → 테이머 챔피언십에서 4팀/8팀 대진을 확인합니다.

## Codex의 최신 브랜치가 GitHub에 올라오면
1. Codex 최신 브랜치를 체크아웃하고, 보존용 새 병합 브랜치를 만듭니다.
2. **이 ZIP의 `src/championship-core.js`와 `tools/apply-championship-v0231.py`만 먼저 가져옵니다.**
3. `python tools/apply-championship-v0231.py` 를 실행합니다. 스크립트는 HTML 내 특정 앵커를 검증하고 챔피언십 부분만 변경합니다. 각 앵커가 바뀌었으면 오류를 내고 멈추며, farm/hex 로직을 임의 재작성하지 않습니다.
4. 이 ZIP의 테스트 파일 `tests/championship-bracket-expansion.cjs`, `tests/championship-v0231-browser.py`를 가져오고 실행합니다.
5. `node tests/farm-core.cjs` 및 Codex의 이동 회피·먹이 Esc 브라우저 회귀 테스트도 실행합니다.
6. `index.html` / `standalone.html` 스크립트 동기화 상태를 확인한 후 커밋/푸시합니다.

※ HTML 전체를 이 ZIP에서 Codex 최신 브랜치에 덮어쓰기 하지 마세요. Codex 이동/먹이 개선이 사라집니다.

## 추가된 주요 소스
- `src/championship-core.js`: NPC/팀 명단, 4/8팀 대진 계산, 경기별 이력/세이브, 종전 참가/보상 인터페이스 유지.
- `tools/apply-championship-v0231.py`: HTML에 챔피언십 UI/CSS, 상대 팀 연동 코드 삽입.
- `tests/championship-bracket-expansion.cjs`: 순수 엔진 신규 단위 테스트 8개.
- `tests/championship-v0231-browser.py`: 두 HTML과 실제 자동전투 3연승 브라우저 검증.
- `TEST_REPORT_v0.23.1.md`: 구현/실행/제약 사실 기록.

## 알려진 Codex 로컬 작업 (이번 코드에 없음)
- 브랜치 `improve/farm-movement-v023`, 중간 정상 커밋 `3f8cfaa`.
- 먹이 위치 Esc 취소, 이동 중 최소 거리 10, 우측 우회, 정면 교행, 자리 양보, 통로 대기/자리 양보 상태 표시.
- Codex는 `TEST_REPORT.md`와 최신 `CONTINUE_HERE.md`를 로컬에서 갱신했다고 보고.
