# Codex에 붙여 넣을 첫 메시지

이 폴더는 NDS 《디지몬 월드 챔피언십》의 개인용 PC·모바일 웹 확장판 개발을 위한 인수인계 프로젝트다.

먼저 `README_FIRST.md`와 `AGENTS.md`, `docs/PROJECT_BRIEF_LATEST.md`, `docs/SYSTEM_CONTRACTS.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/OPEN_QUESTIONS.md`를 읽어라. 이어서 자세한 원본 자료인 `docs/MASTER_SPEC_SOURCE_v0.4.md`와 `docs/DESIGN_DECISIONS_SOURCE.md`를 검토하라.

`existing_prototype/v0.14_full_site.zip`가 있다면 압축을 풀어 기존 웹 게임을 살펴보고 실행·테스트 가능 여부를 확인하라. `local_assets/DigimonWorldChampionshipSprites.zip`는 로컬 참고 자산이며, ROM이나 영상은 패키지에 없으므로 없으면 '미제공'으로 기록하라. 경로를 임의로 가정하지 마라.

**이번 첫 작업에서는 전체 게임을 한 번에 구현하지 마라.**
(1) 기존 기능 목록과 작동/미작동 항목,
(2) 사용자 확정 사항과 원작 검증 필요 사항의 구분,
(3) 기존 v0.14의 재사용/교체 대상,
(4) 주요 데이터 구조·기술 아키텍처,
(5) 플레이 가능한 첫 수직 슬라이스(육각형 사육장 하나, 디지몬 이동·먹이·훈련·휴식·저장)의 구체적인 구현 계획,
(6) 우선순위별 테스트 및 미확인 리스크를 한국어 보고서로 작성하라.

원작 충실도를 최우선으로 하되 사용자가 승인한 확장 사항을 우선한다. 검증되지 않은 정확한 수치를 원작 확정치로 위장하지 말고, 임시 밸런스는 별도 태그로 구분하라. ROM/저작권 자산을 공개 저장소에 포함하지 마라. 다음 단계 작업은 이 보고서를 바탕으로 순차 진행한다.
