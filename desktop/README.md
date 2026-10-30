# Digimon Championship — Windows PC 시각 검수 통합판

이 폴더는 **기존 게임을 실제 Windows 독립 창에서 실행**하기 위한 Electron
셸입니다. NDS ROM 에뮬레이터나 ROM 수정본이 아닙니다.

## 통합 상태

- 작업 브랜치: `integration/windows-ranch-review-20261030`
- 통합 기반: 사육장 PR #70 → #72 → #74 → #75 → #76 → #77
- Windows 런처: 기존 PR #71의 `desktop/` 파일만 별도 가져와 통합
- 아직 `main`에 병합되지 않은 **Draft PC 테스트 판**입니다.
- 기본 사육장은 원래 맵이며, PC에서 **‘연결형 지형 시험 보기’** 버튼으로
  변경 화면을 비교할 수 있습니다. 선택은 저장 데이터를 바꾸지 않습니다.

## Windows 로컬 실행

1. [Node.js LTS](https://nodejs.org/)를 설치합니다. (npm 포함)
2. GitHub에서 이 **통합 브랜치**의 소스를 로컬 폴더에 준비합니다.
   Git 사용이 불가능하면 GitHub Desktop 앱에서 브랜치를 체크아웃할 수 있습니다.
3. **프로젝트의 `desktop` 폴더**에서 명령 프롬프트 또는 PowerShell을 엽니다.
4. 아래 명령을 순서대로 실행합니다.

```powershell
npm install
npm start
```

- 게임이 독립된 `1440 × 900` 창으로 열립니다. 최소 크기는 `960 × 640`입니다.
- 브라우저 개발 미리보기와 게임 코드/세이브 계산은 동일합니다.
- `digichamp://game/` 로컬 보안 프로토콜로 게임의 CSS/JS/이미지를 불러옵니다.
- 다른 사이트로 이동하거나 새 창을 여는 동작은 기본 차단됩니다.

## 테스트 및 Windows EXE 로컬 빌드

```powershell
npm test
npm run test:ui
npm run build:dir
npm run build:win
```

- `npm test`: Electron 프로토콜·경로/권한 격리 검사
- `npm run test:ui`: **실제 Electron**에서 사육장·원본/연결형 지형 전환·
  게임 리소스·로컬스토리지 저장/재시작 유지 검사
- `npm run build:dir`: 압축되지 않은 실행 파일 구조를 `dist/desktop/win-unpacked/`에 생성
- `npm run build:win`: portable Windows EXE를 `dist/desktop/`에 생성
- Windows 자동 검사는 GitHub Actions
  `Windows desktop integration (local review only)`에서 실제 실행 및 빌드를
  시도합니다. **GitHub에 EXE나 게임 자산을 다운로드 아티팩트로 업로드하지 않습니다.**
  자동 검사 성공과 사용자의 실제 PC 화면이 만족스러운지는 서로 별개의 기준입니다.

## 저장 데이터·권한

- Electron의 `digichamp://game/` 저장 공간은 Chrome 웹사이트 저장 공간과
  다릅니다. 기존 브라우저 세이브는 자동 이관되지 않습니다.
- 필요하면 기존 게임의 **세이브 JSON 내보내기/불러오기** 기능을 사용하세요.
- 개인용 개발·테스트 외, 권리가 확인되지 않은 원작 ROM/이미지나 이를
  포함한 EXE를 공개 배포하지 마세요.
- Windows Defender 경고, 깨진 이미지/사운드, 전투·탐험 실행, 게임 종료 후
  세이브 보존은 **본인 Windows 컴퓨터에서 추가 검수**가 필요합니다.

## 이 단계에서 하지 않은 것

- 디지몬 환경별 자유 생활 AI나 원작 진화 공식 신규 구현
- ROM을 실행하는 기능, 모바일 별도 게임 제작
- GitHub main 자동 병합, 배포용 ZIP·EXE 공개 업로드
