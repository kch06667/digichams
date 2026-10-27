# v0.23.3 통합판: 새 채팅/Codex용 개발 재개 가이드

## 현 버전이 가장 우선
- 2026-10-28 완성한 *로컬 통합 체크포인트* `v0.23.3`.
- 기준: GitHub `kch06667/digichams` main `aa6db16`의 **Codex 사육장 경로·충돌 회피·저장 보호** 수정사항을 v0.23.2 그래픽/대회 프로젝트에 이식.
- **GitHub에는 이 v0.23.3이 아직 푸시되지 않음!** 메인 원격을 무심코 덮지 말 것.
- 원본 ZIP: `Digimon_Championship_v0.23.2_Graphics_Playable.zip`; 작업용 신규 ZIP: `Digimon_Championship_v0.23.3_Integrated_Playable.zip`.

## 포함된 기능
- 216종 디지몬, 477개 진화 분기, 시간 기반 육성/훈련/사냥/전투/대회.
- v0.23.1의 4/8팀 토너먼트, NPC 실제 개체팀, 8팀 월드컵 3전/경기 기록/보상·세이브.
- v0.23.2 육각형 사육장 WebP 배경, index의 파일 참조, standalone의 내장 WebP.
- Codex main의 먹이 영역 검증, 2자리 시설 점유/예약, 중앙 경유 길찾기, 정면·교차 회피, 유휴 자리양보, 통로대기 상태 UI, Esc 취소, 세이브 손상 사전검사/복구.
- 신규 tests/farm-avoidance.cjs, tests/farm-navigation.cjs, tests/v0233-merge-browser.py 및 tools/rom-database.py, tools/audit-sprites.py.
- *대회 승리 랭크가 육성장에서도 반영되는 v0.23.1 rank override* 보존함.

## 로컬 실행
1. 압축을 **통째로** 풀고 `index.html` 실행. 정상적으로 216종의 파일 기반 GIF를 보려면 같은 폴더의 `assets/` 전체 필요.
2. `standalone.html`은 별도로 이동/오프라인에서 단일 파일로 실행 가능한 파일. 데이터는 브라우저 환경에 따라 저장이 제한될 수 있으므로 먼저 JSON 세이브 백업 권장.
3. 개발 서버 권장: 작업 루트에서 `python3 -m http.server 8000`; 브라우저 `http://localhost:8000/index.html`.
4. 저장 전 반드시 JSON 내보내기를 사용하고 수정 전 세이브 백업.

## 검증 명령
```
node --test tests/farm-navigation.cjs tests/farm-avoidance.cjs
node tests/farm-core.cjs
node tests/championship-bracket-expansion.cjs
node tests/championship-core.cjs
python tests/v0233-merge-browser.py
python tests/championship-v0231-browser.py
python tests/save-browser.py
python tests/hunt-browser.py
python tests/battle-browser-logic.py
python tests/evolution-browser.py
python -m unittest discover -s tests -p test_rom_database.py -v
python -m unittest discover -s tests -p test_sprite_audit.py -v
```
- 일부 브라우저 실행 환경에서 `127.0.0.1` 탐색이 차단되어, `v0233-merge-browser.py`는 실제 로드할 HTML을 `set_content`에 넣고 WebP만 검증용으로 내장하여 실행. URL 기반 저장 지속성과 실제 Android 장시간 테스트는 별도 필요.
- `python tools/audit-sprites.py --output /tmp/sprite-audit.json`은 **예상된 누락 유니몬 #5 GIF 1개 때문에 exit 1**. 성공 처리하지 않는다.

## ROM 분석 도구
- `tools/rom-database.py`는 제공된 한국어판 ROM SHA-256이 2092998e...f2234와 일치하는 경우에만 데이터를 추출한다.
- ROM 파일 자체를 ZIP이나 GitHub에 넣지 말 것. 출력 디렉터리는 작업 폴더 밖, 비공개 경로만 허용.
- `text_index`는 ROM의 species ID로 확정되지 않았고 진화/전투 스탯은 복원되지 않았음.

## GitHub 반영 순서 (직접 git 사용 가능 환경)
```
git clone https://github.com/kch06667/digichams.git
cd digichams
git switch -c integrate/v0233-graphics-championship
# ZIP 전체를 별도 폴더에 풀고, 기존 파일을 지우지 말고 새 소스를 복사
# git status/diff로 변경 검토, 인라인 소스·테스트 확인
# GitHub 원본 NDS/ZIP 등 불필요한 대용량 파일을 더 추가하지 말 것
# 테스트 통과 후 commit 및 PR
```
이 ZIP을 GitHub main 전체로 덮어쓸 때 기존 GitHub 전용 분석 파일을 삭제하지 않아야 함.

## 미구현/제약
- 원작 토너먼트 일정·상금·대부분 스탯·기술·AI는 임시 확장판 값.
- 고밀도 교착, 기존 맵 밖 좌표 세이브 복구, 물리 Android 실기 장시간 확인 안 됨.
- 기존 스프라이트 8,640개 참조 중 8,639개 파일 검증, 유니몬 #5 경로 1개 누락.
- 저작권 자료 공개 배포 권한 확보한 것 아님; 개인 개발/보관용으로 제한.
