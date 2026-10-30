# 13차 — PC 포획·대회·사육장 화면 이동 복귀 수정

## 사용자 불편 원인 (원본 전체 게임에서 발견)
PC 빠른 이동 메뉴의 `inGameModal()`이
`document.getElementById('dc-phaser-overlay')`가 **있기만 해도**
전투 중이라고 판정했습니다. Phaser 오버레이를 DOM에서 제거하지 않고
숨긴 상태에서는 포획·대전·사육장 빠른 이동 버튼과 Alt+1/2/3 단축키가
이후 계속 막힐 수 있었습니다.

## 13차 수정
- `src/pc-playability-guide.js`: 전투창의 **실제 표시 상태**를 판정.
  `hidden`, `aria-hidden=true`, CSS `display:none`/
  `visibility:hidden`, 레이아웃에 없는 경우는 비활성 전투로 취급.
  반대로 실제 표시 중인 원본 `#liveBattle` / `#dc-phaser-overlay`
  는 이전과 같이 화면 전환 금지.
- 빠른 이동은 기존 `nav.tabs button[data-tab]`의 실제 클릭을 재사용하고
  성공 여부를 원본 활성 탭으로 확인합니다. 기존 전투를 새로 시작하지
  않고, 팝업 닫기·저장·명령·진화 상태도 조작하지 않습니다.
- 원본의 두 화면·확장 화면 전환으로 DOM이 재배치되는 경우를 위해
  바로 뒤 마이크로태스크에서 PC 정보 표시를 한 번 더 새로고침합니다.
- `window.DCPCGuide`에 변경 없는 테스트/접근성 용도의 읽기 전용
  `blocked`와 실제 빠른 이동을 호출하는 `navigate(tab)`를 공개.
- **신규 게임 세이브 필드, 자산·NDS·애니메이션 및 전투 로직 변경 없음.**
  모바일에는 기존과 동일하게 PC 메뉴가 주입되지 않습니다.

## 자동 테스트
- `tests/pc-ranch-preview.cjs`: 원본 게임 Chromium에서 숨긴 전투창이
  있어도 사육장→포획→대전→사육장 이동됨을 확인. 열려 있는
  전투창은 변경 금지, 다시 숨기면 즉시 이동 가능, 세이브 불변.
- `desktop/tests/electron-smoke.cjs`: 실제 Electron 개발 버전과
  패키징된 Windows `win-unpacked` EXE에서 같은 이동·저장 무결성 확인.
- 모든 이전 8~12차 사육장·진화·216종 GIF·포획·대회·Phaser
  자동 회귀검사 함께 유지합니다.

## 남은 검수
실제 사용자 PC에서의 그래픽·조작감 검수, 최종 portable EXE 배포와
권리 확인은 별도입니다. 신규 디지몬·도트 제작은 게임 완성 후 진행.
상위 PR #84 기반 **Draft PR**이며 `main`에 자동 병합하지 않습니다.
