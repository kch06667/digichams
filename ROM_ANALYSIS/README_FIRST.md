# 디지몬 월드 챔피언십 한국어판 ROM 분석 — Codex 전달용

이 패키지는 사용자가 제공한 `.nds` ROM을 직접 파싱해 만든 **ROM 파일 구조 분석 결과**다. 원본 ROM과 저작권 보호 그래픽·음원은 포함하지 않는다.

## 확인된 사실
- ROM 타이틀: `DIGIMONCHAMP`; 게임 코드: `YDIK`
- ROM 크기: 67,108,864 bytes (64 MiB)
- NitroFS FAT 엔트리: 6,434개; 이름 확인: 6,412개; FNT 디렉터리: 33개
- `sound_data.sdat`, `battle/`, `field/`, `dwc/utility.bin` 등 확인
- `.ncgr`, `.nclr`, `.ncer`, `.nanr` 등 NDS 2D 그래픽·애니메이션 관련 확장자가 다수 존재

## 파일 설명
- `rom_metadata.json`: 헤더/해시/파일 확장자 집계
- `rom_file_manifest.csv`: 각 NitroFS 파일의 ID, 경로, ROM 오프셋, 크기, 선두 4바이트
- `analysis_targets.md`: 이름을 기준으로 뽑은 탐색 후보. 내용 검증 아님
- `CODEX_ROM_TASK.md`: Codex에 전달할 분석 지시
- `extract_nds_files.py`: **원본 ROM을 로컬에서 제공할 경우** NitroFS를 안전하게 추출하는 표준 라이브러리 스크립트

## 검증 수준
**검증됨:** ROM 헤더, 파일 시스템 목록, 크기, 확장자, 오프셋. 
**미검증:** 디지몬별 능력치, 진화 조건, 기술 수치, 대회 규칙, 개체별 데이터, 실제 게임 로직.

추출된 파일을 사용한 재현 구현 전에 바이너리 포맷과 참조 관계를 추가 검증해야 한다. 원본 ROM을 GitHub에 올리지 말 것.
