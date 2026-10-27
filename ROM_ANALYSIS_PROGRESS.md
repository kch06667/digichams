# ROM 분석 상태 — 2026-10-27 업데이트

## 입력과 검증 사실
- 원격 main `160b852`에 사용자가 추가한 ZIP에서 원본 NDS 확인. 이전 “ROM 없음” 기록은 과거 상태.
- 로컬 입력: `/workspace/scratch/digichams-private/game.nds` (읽기 전용, 저장소 밖).
- 67,108,864 bytes, SHA-256 `2092998ee80d6646c7115ef8f008f955e72e1860c718dc8d7cbc3b8cea9f2234`: 기존 메타데이터와 일치.
- FAT 6,434개, FNT 이름 6,412개. 기존 CSV의 전체 ID/오프셋/크기와 일치.
- ARM9 ROM offset 0x4000, size 1,036,216, RAM 0x02000000. ARM7 ROM offset 2,190,336, size 167,292.
- ARM9 오버레이 22개, ARM7 오버레이 0개. 각 파일 SHA-256/주소/크기/압축 플래그를 새 inventory에 기록. 압축 해제기는 아직 없음.

## 새로 재현한 텍스트 테이블
- NitroFS `ui/txt/db_txt_list_txt.dat`, FAT ID 6429, ROM offset 40,974,848, size 64,846.
- ASCII `utf-16<>\n` / 십진수 항목 수 / UTF-16LE 문자열 / ASCII `<>\n` 구분자 / `<END>\n` 꼬리 형식.
- 1,176항목을 엄격한 UTF-16LE 디코딩으로 읽었으며 각 항목의 파일/ROM 오프셋을 기록.
- 앞 216개는 디지몬 이름 문자열 후보. 이후 도감 설명 문자열이 이어지는 것을 확인.
- **ROM_VERIFIED:** 입력 해시, 파일 위치, 항목 수, 바이트→문자열 복호화와 오프셋.
- **INFERRED:** 0..215가 이름 블록이라는 해석 및 웹 종과의 대응. text_index는 문자열 순서이며 아직 게임 species ID로 확정할 수 없음.
- 웹 216개 이름 중 ROM 후보 블록과 정확한 문자열 일치 146개, 미일치 70개. 현지화/별칭/변종 구분 차이 가능성이 있으며 누락 종으로 단정하지 않음. 게임 이름과 세이브 키는 수정하지 않았다.

## 실행/결과 위치
```
python3 tools/rom-database.py --rom /workspace/scratch/digichams-private/game.nds --output-dir /workspace/scratch/digichams-private/analysis
python3 -m unittest discover -s tests -p test_rom_database.py -v
```
- `inventory.json`: ARM/FAT/FNT/오버레이, 각 파일 해시와 주소.
- `database-names.json`: 앞 216개 텍스트 및 오프셋, 웹 이름 비교 목록. 전체 도감 설명은 출력하지 않음.
- 두 결과 모두 저장소 밖 private analysis 폴더. 도구는 체크아웃 안으로 출력하는 경로를 거부.
- 도구/합성 테스트/직접 작성한 요약만 커밋. 원본 ROM·ZIP·ARM 바이너리·추출 텍스트를 작업 브랜치에 추가하지 않음. 원격 push 없음.

## 다음 한 단위
1. 이름 테이블의 문자열 인덱스를 참조하는 ARM9/오버레이 코드를 제한적으로 조사해 종 ID와 연결 근거 확보.
2. `dwc/utility.bin`은 첫 바이트 0x10만으로 LZ 압축이라고 판단하지 말 것. 첫 부분에 내부 파일 목록과 Wi-Fi UI 이름이 보이므로 육성 테이블 후보로 우선 확정하지 않음.
3. 진화/AP/능력치 레코드 하나의 구조를 먼저 확인하고 공략 값/여러 종/참조 코드로 교차 검증. 현재 해당 테이블은 복원하지 못함.
4. 기존 overlay19 효과 포인터(ROM 0x1ef600, load 0x0210e8a0, +0x26234, 151개) 메모 중 파일 주소/크기는 헤더로 재확인. 151포인터 의미/코드는 이번 도구가 재검증하지 않았음.
5. 그래픽/AI/진화 조건을 텍스트 파일에서 복원했다고 주장하지 말 것. 확인된 규칙만 게임에 적용.
