# REMAKE P0 — 최신 main 실행 기준선 (2026-10-31)

## 확인한 GitHub 기준
2026-10-31 확인한 main HEAD: ee3d64aa2e3f2d8de34d2402834a925e989fa1eb (PR #68). 사용자 소유 원본 ROM·개인 스프라이트·저장 파일은 읽거나 변경하지 않음.

| 구분 | 근거 | 판정 |
|---|---|---|
| 기본 게임 | 루트 index.html / standalone.html / PLAY_ON_PC.bat | 브라우저 게임 존재 |
| Windows 실행기 | PLAY_ON_PC.bat가 py -3 tools/play_local.py 호출; Python 3·Pillow 필요 | 독립 EXE 아님 |
| Electron 앱 | main에 desktop/ 및 desktop/package.json 없음 | 첫 EXE 게이트 미충족 |
| Phaser 단독 페이지 | phaser-lab/index.html에 Phaser 3.90.0 jsDelivr CDN 직접 참조 | 별도 정적 서버 실행 시 오프라인 위험 |
| 전용 로컬 서버 | tools/play_local.py GameFileHandler가 CDN을 ./vendor/phaser.min.js로 교체 | 전용 게임 서버 경로에서만 로컬 엔진 사용 |
| 첫 실행 | 검증된 로컬 캐시나 npm이 없으면 최초 HTTPS 다운로드 필요 | 첫 실행 완전 오프라인 보장 없음 |
| 포획→사육→진화→대회→Phaser·저장 | tests/pc-complete-phaser-journey-browser.py 존재 | 테스트 파일 확인; 이번 PR에서 실제 Windows 실행 안 함 |
| 장시간 전투 | tests/pc-offline-phaser-soak-browser.py 존재 | 가속 테스트가 실제 장시간 Windows 안정성 보장은 아님 |
| 원작 수치 | src/battle-core.js는 확장/임시 수치로 명시, 진화도 일부 원작 숫자 미검증 | 원작 충실 재현 완료 아님 |

## 사용자 증상과의 관계
과거 보고된 'Phaser 전투 not found'와 'Windows EXE 무창'을 **현재 main 실행 환경에서 재현하지는 못함**. 따라서 서버 시작 경로, 엔진 부재, 파일 설치 오류 중 어느 원인인지 확정하지 않는다. 원본 폴더 루트와 서버 진입 URL을 먼저 확인해야 한다.

## 이번 PR
- tools/remake-p0-readiness.cjs: 파일/런처/Phaser 로컬 엔진 무결성/EXE 소스 여부를 **읽기 전용 JSON**으로 점검.
- tests/remake-p0-readiness.cjs: 4개 합성 파일 테스트. ROM, 실제 사용자 세이브, 외부 네트워크 사용 금지.
- .github/workflows/remake-p0-readiness.yml: PR에서 단위 테스트와 비파괴 진단 실행.

### 사용법
node --test tests/remake-p0-readiness.cjs

node tools/remake-p0-readiness.cjs

node tools/remake-p0-readiness.cjs --strict-first-play

기본 진단은 미완료 항목을 JSON으로 출력하고 exit 0. strict 모드는 차단 요소가 존재하면 exit 1을 내보낸다. 진단 성공은 전체 게임/Windows 플레이 검증 성공이 아니다.

## 다음 코딩 단계
1. PR #98 로드맵 확정과 코드 기준 통일.
2. 원작의 두 줄 케이지 개요를 PC 단일 창에 복원. 자유 배치형 거대 맵은 배제.
3. 한 세이브를 통한 포획→육성/분기 진화→AI 대회 정산의 실제 브라우저 경로 재확인.
4. 독립 Electron EXE/로컬 엔진 의존성 해결 및 Windows 실제 더블클릭 검증.

**주의:** 이번에는 런처·사육장·전투 코드를 변경하지 않았고 Windows EXE 제작 완료라고 주장하지 않는다. 공개 GitHub에 사용자 ROM·추출 그래픽·개인 저장 파일을 올리지 않는다.
