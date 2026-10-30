# 18차 — Windows PC EXE에서 인터넷 없이 실제 자동전투 실행

## 발견한 문제
원본 `phaser-lab/index.html`은 Phaser 3.90.0을
`https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js`에서
가져옵니다. Electron Windows EXE에는 해당 원본 Phaser
자바스크립트를 포함시키지 않았습니다. 기존 Windows 연동 CI가
게임 실행·사육장·저장·재시작만 테스트했기 때문에, **오프라인
PC의 Phaser 전투가 초기화되지 않아 기존 전투로 돌아갈
위험**을 검증하지 못했습니다.

## 실제 수정
- `desktop/package.json`: **Phaser 3.90.0 버전을 정확히 고정**하고
  게임 EXE의 `resources/game/phaser-lab/vendor/phaser.min.js`로
  함께 패키징. 최초 Node.js/npm 의존성 설치를 제외하면
  게임 시작·전투에 인터넷 불필요.
- `desktop/main.cjs`: Electron `digichamp://game`에서 읽는
  **Phaser HTML에만** 원격 CDN 주소를
  `./vendor/phaser.min.js`로 교체. 개발 모드에서는
  `desktop/node_modules/phaser/dist/phaser.min.js`를,
  Windows EXE에서는 함께 패키징한 로컬 버전을 제공합니다.
- 버전이 다르거나 예상하지 않은 HTML 파일이면
  다른 원격 코드를 조용히 실행하지 않고 503 오류를 표시.
  허용 경로는 **단 하나의 고정된 라이브러리 경로**이며
  다른 node_modules, 파일, 폴더는 노출하지 않습니다.
- 원래 `phaser-lab/index.html` 자체와 일반 웹게임/안전
  시연 사이트를 바꾸지 않습니다. 기존 개발·시연 테스트와
  충돌 방지, Electron 안에서만 로컬 엔진 사용.

## 자동 검증
- `desktop/tests/launcher.test.cjs`: Electron 보안 경로,
  번들 Phaser 주소와 버전, 원본 HTML 1회 치환/실패 처리.
- `desktop/tests/release-preflight.test.cjs`:
  실제 패키징 폴더에서 Phaser 라이브러리 존재·크기 및
  **SHA256 `e92ddef111ba42e92d316979c732311757093688ea1810591cb7aa2858eba7a7`**
  일치 확인. 기존 로컬 PC 서버가 검증하는 핀과 동일.
- `desktop/tests/electron-smoke.cjs`: **Windows 개발
  Electron과 패키징된 EXE 양쪽**에서 실제
  `phaser-lab/index.html?embeddedBattle=1`을
  iframe에 띄워, 외부 CDN 없는 HTML·번들 엔진 로드,
  **실제 3v3 6마리 원본 GIF 표시와 Phaser 게임 초기화**를
  확인. 테스트는 격리된 저장 프로필을 사용하고 종료 후 삭제.
- 기존 실제 원본 게임, 농장/포획/진화/전투·대회,
  216종 GIF, Phaser 렌더러, Windows 저장 테스트 유지.

## 출시 주의
이 변경은 Windows EXE 전투 라이브러리의 **오프라인 가용성**을
보장하기 위한 작업입니다. Phaser는 별도 라이브러리로
라이선스를 확인해 동봉해야 하며, 원작 게임 그래픽·사운드·
디지몬 상표의 공개 배포 권리가 확인됐다는 뜻은 아닙니다.

PR #89 위에 쌓인 **Draft PR**로 유지하고, 사용자
PC에서 최종 게임 외형/장시간 플레이 검수 전에는
`main`에 자동 병합하거나 실행파일/원본 데이터를
공개 업로드하지 않습니다.
