# 디지몬 월드 챔피언십 웹 확장판 — Codex 전달 패키지
최신 정리: 2026-10-26 / 목적: 개인용 PC·모바일 웹 게임 개발 인수인계

## 가장 간편한 시작 (권장)
1. 이 ZIP을 PC 또는 Codex가 접근 가능한 프로젝트 작업 폴더에 압축 해제한다.
2. 해당 폴더에서 Codex를 열고 `CODEX_FIRST_MESSAGE.md`의 지시문을 전달한다.
3. `AGENTS.md`는 Codex 작업 원칙, `docs/PROJECT_BRIEF_LATEST.md`는 **최신 설계 통합 요약**이다.
4. 나머지 `docs/MASTER_SPEC_SOURCE_v0.4.md` 및 `docs/DESIGN_DECISIONS_SOURCE.md`를 자세한 원천 기록으로 참조한다.
5. 첫 요청은 자료 조사·구조 점검·구현 계획 수립이다. 한 번에 전체 게임을 구현시키지 않는다.

## 포함 사항
- `AGENTS.md` — 구현 원칙, 자료 우선순위, 저장/테스트/권리 관련 주의
- `CODEX_FIRST_MESSAGE.md` — 바로 복사/붙여넣을 첫 명령
- `docs/PROJECT_BRIEF_LATEST.md` — 확정 사항을 최신 우선순위로 통합
- `docs/SYSTEM_CONTRACTS.md` — 데이터/시뮬레이션 계약·검증
- `docs/IMPLEMENTATION_ROADMAP.md` — 단계별 작업/수락 기준
- `docs/OPEN_QUESTIONS.md` — 원작 확인·미확정 수치·충돌
- `docs/MASTER_SPEC_SOURCE_v0.4.md` — 긴 원작 분석 및 누적 명세 (과거 미확정 표기 일부는 최신 결정으로 덮어써야 함)
- `docs/DESIGN_DECISIONS_SOURCE.md` — 추가 결정 원본
- `references/` — 검증 전 ROM 분석 메모 등
- 전체 패키지에 한해 `existing_prototype/v0.14_full_site.zip`과 `local_assets/DigimonWorldChampionshipSprites.zip`도 포함

## 반드시 알 것
- 원본 한국어 NDS ROM과 플레이 영상은 **포함하지 않았다**. 사용자가 로컬에서 별도 입력해야 하며, 경로는 환경마다 다르다.
- 기존 v0.14는 '기준 프로토타입'이지 완성된 정확한 원작 재현본이 아니다.
- 기존 문서의 2026-10-26 업데이트 이후 확정된 최신 사항은 PROJECT_BRIEF_LATEST가 우선한다.
- ROM 데이터는 검증 전까지 원작 사실로 표시하지 않는다.
- 무단으로 저작권 자산/ROM을 공개 저장소나 공개 배포물에 포함하지 않는다. 로컬 테스트 자산도 권리 확인 필요.
