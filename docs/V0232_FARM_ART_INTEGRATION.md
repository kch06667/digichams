# v0.23.2 사육장 원본 그래픽의 최신 게임 통합 — 검증 기록

## 작업 범위
- 출처: 사용자가 제공한 `Digimon_Championship_v0.23.2_Graphics_Playable.zip`.
- **원본 이미지 그대로**: `assets/farm/hex_farm_v0232.webp` (106,788바이트), SHA-256 `67f92692d36b8cedae3db3abe6293c2e757799d57600acb6eac0eb96cc8ebccc`, Git blob SHA `3041c6d7e99362cd4829c3c846c16f7334e7fabe`.
- 기존 `main`에서 최신화된 `src/hex-farm.css`에 v0.23.2 **그래픽 전용 CSS 블록**만 추가했다. ZIP 속 2,956자 원문과 FNV-1a `d03e2ca6` 일치.
- `tools/sync-embedded-farm.py`로 `index.html`과 `standalone.html`의 farm-core/UI/CSS를 재동기화했다. `index.html`은 외부 WebP 참조, `standalone.html`은 동일 WebP의 base64 data URI 내장.
- **사육장 이동 회피, 통로 양보, 구 세이브 복구, 진화, 포획, 자동 전투, 대회, 저장/불러오기 코드는 재작성하지 않았다.** 두 HTML의 소스 동기화는 기존 canonical 파일을 기준으로만 실행했다.

## 검증
- 체크섬·두 HTML 스타일 동등성: `python3 -m unittest discover -s tests -p test_farm_graphics_integrated.py -v`.
- 코어/이동/회피/세이브/대회 Node 회귀: GitHub Actions `40572205819` **성공**.
- 별도 기존 제공 ZIP 재현 브라우저에서 배경 이미지 920×690 로드, 육각형 7개, 캐릭터·먹이·선택 기능, JS 오류 없음 확인 (데스크톱/모바일 예비 검사).
- 최신 GitHub HTML을 실제 PC·터치 Chromium에서 확인하는 `python3 tests/farm-graphics-browser.py`는 별도 PR 자동 브라우저 작업으로 검증한다. 실기 Android/실제 기기 프레임 저하는 이 검사만으로 확정할 수 없다.

## 실행
```bash
python -m http.server 8000
# http://localhost:8000/index.html
# 단독 파일 사용은 standalone.html
python tests/farm-graphics-browser.py
```

## 제한 및 운영
- `main`에 PR 검증 후 병합하기 전에는 `main` 배경 변경으로 오인하지 않는다.
- 원작 ROM/NDS 파일, 26 MB 프로젝트 ZIP은 GitHub에 추가하지 않음.
- 개인용 코드 저장소의 이미지이며 별도 공개 배포 권리는 확인되지 않았다.
- 필요할 때만 ZIP 배포본을 만든다. 변경사항과 다음 단계는 `CONTINUE_HERE.md`에 기록한다.
