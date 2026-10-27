# ROM 분석 상태 — 2026-10-27

원본 ROM 없음: /workspace에서 .nds/.srl/ZIP/7z 탐색 결과 없음, /mnt/data 없음.
이번 세션에서 실제 ROM 분석/테이블 추출은 수행하지 않았다. 현재 요청은 ROM 없이 게임 개선 우선.

기존 자료: ROM_ANALYSIS/rom_metadata.json, rom_file_manifest.csv(6434행), analysis_targets.md.
역분석 메모: ROM_reverse_engineering.md, ROM_effect_pointer_registry.json 및 DIGIMON_CODEX_HANDOFF/references/.
기존 문서의 overlay19 ROM 0x1ef600, load 0x0210e8a0, pointer table +0x26234, 151개 효과 이름 주장은 이번 세션 재검증 안 됨. 기술 ID/AI/진화 테이블을 뜻하지 않는다.
assets/evolution-routes.json은 공략 출처 기반 179 출발점/477 경로. 능력치·수명·우선순위·TP 등 원작 테이블 복원 없음.

다음 ROM 작업: 제공 경로에서 읽기 전용 SHA-256 확인 → 헤더/FAT/FNT/오버레이 검사 → 정적 진화/능력치 후보 하나 선택 → 주소/레이아웃/필드 의미를 독립 검증 → 추출 테스트 → 게임 데이터 차이 보고. 후보 검색만으로 원작 검증 판정 금지.
