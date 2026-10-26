# 디지몬 챔피언십 ROM 1차 분석 결과

## 확인된 ROM 정보
- 파일: `디지몬 챔피언쉽(K).nds`
- 크기: 67,108,864 bytes (64 MiB)
- 내부 타이틀: `DIGIMONCHAMP`
- 게임 코드: `YDIK`
- ARM9 실행 코드: ROM 오프셋 `0x4000`, 크기 1,036,216 bytes
- ARM7 실행 코드: ROM 오프셋 `0x216C00`, 크기 167,292 bytes
- FNT 파일명 테이블: `0x23FA00`, 152,873 bytes
- FAT 파일 테이블: `0x265000`, 51,472 bytes
- 내부 파일 수: 6,412
- 디지몬 리소스 파일명에서 발견한 개체 수: 205 (스프라이트 NCGR 파일 기준이며 전체 도감 수라고 단정하지 않음)

## 주요 디렉터리 파일 수
- `db_digimon/`: 1,792
- `digimon/`: 1,792
- `common/`: 773
- `training/`: 589
- `field/`: 419
- `database/`: 365
- `ui/`: 287
- `battle/`: 78
- `battle_menu/`: 47
- `title_menu/`: 44
- `battle_result/`: 43
- `battle_menu_net/`: 35
- `today_window/`: 30
- `gate_select/`: 29
- `shop/`: 28
- `tamer_info/`: 16
- `help/`: 12
- `desktop/`: 7
- `cage_edit/`: 6
- `ending/`: 6

## 주요 발견
- `db_digimon/`에 `m###_이름_db_main` 및 `db_sub` 형식의 디지몬 리소스가 다수 존재한다. 이름 기반 목록은 TSV/JSON 인벤토리로 추출했다.
- `battle/`에 `battle_bg`, `battle_obj`, `battle_sub_scene` 등 전투 UI/그래픽 리소스가 있다. 이는 전투 관련 리소스의 존재를 확인한 것이지 전투 알고리즘 해독을 뜻하지는 않는다.
- `training/`에 `field_cm##` 리소스, `training_sub_scene`, `schedule_item` 등이 있다. 훈련 화면 및 맵 관련 자료가 다수다.
- `ui/txt/db_txt_list_txt.dat` (64,846 bytes), `ui/txt/txt_list_txt.dat` (54,919 bytes), `ui/txt/help_text_txt.dat` (11,901 bytes) 같은 텍스트 테이블이 있다. 파일은 UTF-16 계열 표기와 게임 고유 구분자(`< >`)를 사용하며, 일부 내용은 인코딩/포맷을 추가로 해석해야 한다.
- `dwc/utility.bin`은 929,892 bytes이며, 구조화된 바이너리 테이블처럼 보인다. 아직 레코드 구조를 해독하지 않았다.
- `sound_data.sdat`는 6,858,432 bytes다. 이번 실험 웹 빌드에는 원작 음원을 포함하지 않았다.

## 아직 확인되지 않은 것
1. 디지몬의 실제 능력치·진화 조건·기술 ID가 어느 데이터 레코드에 저장되어 있는지
2. 전투의 이동/사거리/쿨다운/기술 선택 알고리즘
3. 로프 포획 확률 및 육성 변수의 원작 공식
4. NDS 실행 바이너리를 재사용할 수 있는 브라우저 에뮬레이션 경로

## 만들어진 파일
- `digimon_championship_porting_lab.html`: ROM 리소스 파일명에서 수집한 디지몬 목록과 육성/포획/자동 전투를 시험하는 독립형 브라우저 실험. 게임 규칙은 임시 모델이며 원작의 정확한 재현은 아님.
- `rom_file_inventory.tsv`: ROM 내부 경로, 파일 ID, ROM 오프셋, 크기 목록.
- `digimon_rom_analysis.json`: 파싱한 ROM 메타데이터, 디렉터리 요약 및 디지몬 리소스 인벤토리.

## 다음 기술 단계
1. 텍스트 테이블 파서를 작성해 디지몬/기술/아이템 관련 문자열과 ID의 관계를 조사한다.
2. `dwc/utility.bin`의 헤더와 오프셋 테이블을 분석한다.
3. `ARM9` 바이너리와 오버레이의 문자열/상수/함수 참조를 조사해 데이터 로딩 경로를 찾는다.
4. 확인된 원작 규칙만 실험 빌드에 반영하고, 추측값은 추측이라고 표시한다.
