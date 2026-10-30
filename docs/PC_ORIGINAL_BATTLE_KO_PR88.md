# 16차 — 실제 전투 공격·피격·기절 모션 연속성 보정

## 발견된 표시 문제
Phaser 게임 화면의 `refreshActors()`는 HP가 0인 디지몬에도
살아 있는 캐릭터와 동일한 대기 bob 흔들림을 매 프레임 적용했습니다.
또 **원본 기절/KO GIF 37번을 실제 로드해 사용 중이어도**
캐릭터 전체를 50% 반투명으로 처리했습니다. 원본 KO 도트가
전투 종료까지 안정적으로 보이지 않는 UI 표현 오류입니다.

## 수정
- `phaser-lab/logic.js`에 순수 표시 함수
  `fighterPresentation(f,useArt,hasNativeKo,time)`를 추가.
- **실제 원본 KO 37번을 로드한 경우** 전투불능 시 bob=0,
  기절 자세 수직 유지, 불필요한 반투명 효과 제거(alpha=1).
  원본 GIF의 개별 프레임/지연 시간/종 정보/방향은 유지합니다.
- 원본 KO GIF가 없는 **기존 선택형 개인 atlas/임시 그래픽**에는
  쓰러진 자세(-78°/78°), 기존 반투명 대체 표시를 그대로 유지.
- 살아 있는 디지몬은 기존 공격 7/8/9/10, 피격 5, 넉백 방향,
  보호 31, 이동 2, 승리 30 및 타격 flash 타이밍을 변경하지 않음.
- `phaser-lab/game.js`: 기존 Phaser 장면에서 위 순수 스타일 함수
  사용. `DigiPhaserLab.renderedArt()`의 read-only `opacity`
  를 추가해 실제 브라우저에서도 기절 스프라이트 확인 가능.
- 실제 전투 판정 원본 `src/arena-original-core.js`, 스탯,
  진화, 대회 보상, 저장, NDS 자산은 **수정하지 않음**.

## 검증
- `tests/phaser-ko-presentation.cjs`: 원본 공격 4포즈 →
  피격 5 → 기절 37, 생존 피격 knockback, 원본 KO 불투명/바닥
  고정, KO GIF 미보유시 대체 자세, 실제 전투 객체 불변.
- Windows 출시 전 `desktop/package.json` 검사에 포함.
- `.github/workflows/battle-pose-presentation.yml`:
  원본 전투/Phaser 구문검사, motion 테스트, 216종 8,640개 원본
  GIF 검사.
- 기존 원본 PC·터치, 한 저장 전체 게임 여정, Windows 패키징,
  Phaser 자동 전투 회귀검사는 기존 GitHub Actions를 통해 확인.

## 주의
이 수정은 **해당 종의 원본 GIF가 로드된 전투 장면에서**
더 자연스럽게 표시하는 품질 개선입니다. 아직 게임 전체가 원작
그래픽을 모든 전투에서 자동 로드한다는 것을 뜻하지 않습니다.
기존 Phaser 일부 로컬 atlas는 선택 설치이며 미등록 종은 대체
시각화가 나올 수 있습니다. 원작 실제 모션 타이밍의 완전 일치,
PC 장기 실플레이, 공개 배포 권리 확인은 남은 과제입니다.

15차 PR #87 위 Draft PR입니다. main 자동 병합 및 EXE/원작
자산 공개 업로드는 하지 않습니다.
