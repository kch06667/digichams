# 한국판 그래픽 재현 분석 — 2026-10-28

입력 SHA-256: `2092998ee80d6646c7115ef8f008f955e72e1860c718dc8d7cbc3b8cea9f2234`.
아래 내용은 이 리비전의 실제 파일을 검사한 결과다. 일반 NDS 게임 전체에 적용되는 범용 변환기로 취급하지 않는다.
이 문서와 도구는 직접 작성한 코드/메타데이터이며, 복원한 그림과 원문 보고서는 저장소 밖에만 둔다.

## 실행과 검증 범위

Python 3 + Pillow. `tools/rom_graphics.py`는 기존 `rom-database.py`의 FAT/FNT 파서를 재사용하며 입력 해시를 검사한다.
`--output-dir`은 저장소 밖 경로만 허용한다. 생성된 PNG/APNG/JSON을 git add 하지 않는다.

```sh
python3 tools/rom_graphics.py --rom /local/game.nds --output-dir /local/private/graphics --audit
python3 tools/rom_graphics.py --rom /local/game.nds --output-dir /local/private/graphics --compare-web
python3 tools/rom_graphics.py --rom /local/game.nds --output-dir /local/private/graphics --audit-sprites --audit-backgrounds
python3 tools/rom_graphics.py --rom /local/game.nds --output-dir /local/private/graphics --sprite digimon/m201_agumon_main
python3 tools/rom_graphics.py --rom /local/game.nds --output-dir /local/private/graphics --background training/cageBG_A.nbs
python3 tools/rom_graphics.py --rom /local/game.nds --output-dir /local/private/graphics --animated-background field/field_bm03_01_anim
python3 tools/rom_scene.py --rom /local/game.nds --output-dir /local/private/graphics
python3 -m unittest discover -s tests -p 'test_rom*.py' -v
```

전체 구조 검사와 전체 그림 검증은 다르다. `--audit`은 각 파서가 파일의 내부 범위를 읽을 수 있는지 검사한다.
`--audit-sprites`는 NANR→NCER→NCGR/NCBR/NCLR 참조를 연결해 셀을 렌더링한다.
`--compare-web`은 게임에 등록된 216종의 기존 GIF와 비교한다. `--audit-backgrounds`는 NSCR/NBS 별로 정적 그림을 렌더링한다.
감사 명령은 부분 실패를 JSON `failures`에 남기며, 프로세스 종료 코드만으로 전체 성공을 판단하면 안 된다.
검사 결과는 `docs/audits/rom-graphics-v023.json`에 요약되어 있다. 이미 완료한 대량 검사는 관련 파서/자산 변경 없이 반복하지 않는다.

## Nitro 공통 헤더와 특이 값

Little-endian. 파일 헤더 16바이트, 첫 블록 헤더 8바이트, 블록 body 시작은 파일 `+0x18`.
모든 지원 파일은 BOM `0xfeff`, version `0x100`, header size `0x10`, block count 1.

| 형식 | 파일 magic / 블록 magic | 개수 | 특이점 |
|---|---|---:|---|
| NCLR | RLCN / TTLP | 1527 | BGR555 색상 |
| NCGR | RGCN / RAHC | 752 | 타일 순서 픽셀 |
| NCBR | RGCN / RAHC | 840 | OAM 그림 조각의 선형 픽셀 |
| NCER | RECN / KBEC | 1319 | 셀, OAM, 선택적 VRAM 전송 표 |
| NANR | RNAN / KNBA | 1319 | 선언 파일 크기 16, 블록 크기 0 |
| NSCR | RCSN / NRCS | 98 | 선언 파일·블록 크기가 실제보다 4바이트 큼 |
| NBS | NBSR | 100 | 별도 사용자 형식 |
| BSA | BSAR | 19 | 별도 배경 애니메이션 형식 |

NANR/NSCR의 이상한 크기 값만 예외 프로파일로 허용한다. 실제 FAT 범위·각 배열/포인터를 별도로 검증하며 임의의 잘린 파일은 허용하지 않는다.
지원된 위 5,974파일 모두 구조 검사를 통과했다. 압축 여부를 첫 바이트만으로 추측하지 않았으며, 이 파일들은 직접 인식되는 magic과 구조를 가진다.

## 팔레트와 픽셀

NCLR body: `format:u32, extended:u32, byte_size:u32, data_offset:u32`.
`data_offset`은 body 시작 기준이며, 색상은 16비트 BGR555. format 3=4bpp, 4=8bpp.

NCGR/NCBR body: `height:u16, width:u16, format:u32, mapping:u32, layout:u32, size:u32, offset:u32`.
픽셀 시작 `0x18+offset`; layout bit0은 이 자료에서 선형 픽셀과 타일 순서를 구분한다.
4bpp는 한 바이트의 하위 nibble이 첫 픽셀이다. OAM의 4bpp palette bank는 16색 단위로 선택한다.

원본 정밀도 비교를 위해 PNG의 8비트 RGB와 기존 GIF를 각 채널 `>>3`으로 정규화했다.
투명 픽셀의 RGB와 그림 바깥 여백은 비교에서 제외한다. 이 비교는 원래 기준점 위치·배치 좌표를 보증하지 않는다.

## 셀과 애니메이션

NCER body: `count:u16, bank_type:u16, cell_offset:u32, mapping:u32, transfer_offset:u32, strings:u32, extended:u32`.
이 ROM에서 bank_type=1, cell record 16바이트: `oam_count:u16, flags:u16, oam_offset:u32, xmax,ymax,xmin,ymin:i16`.
OAM 배열 기준점은 cell 배열 직후. OAM 한 항목은 attr0/1/2 각 u16이며 모양/크기, signed x/y, H/V flip, tile index, 팔레트를 해석한다.
원본 52,345 OAM 항목에서 affine bit는 모두 꺼져 있었다. affine renderer는 구현하지 않는다.

전송 표가 있으면 `max_buffer_size:u32, entries_offset:u32`, 셀당 `source_offset:u32,size:u32`.
source_offset은 캐릭터 픽셀 payload 내부 위치다. 먼저 해당 셀의 전송 범위를 선택하고, OAM tile offset을 적용해야 한다.
tile byte offset은 이 프로파일의 1D mapping에 대해 `tile_index * (32 << mapping)`.
OAM 작은 인덱스를 앞에 그리며 좌표 원점을 보존한다. 추출 APNG는 모든 셀을 공통 캔버스에 놓아 크기 변경에 따른 흔들림을 줄인다.

NANR body: `sequence_count:u16, frame_count:u16, sequence_offset:u32, frame_offset:u32, content_offset:u32, strings:u32, extended:u32`.
시퀀스 16바이트: `frame_count:u16, loop_start:u16, animation_type:u32, play_mode:u32, frame_offset:u32`.
프레임 8바이트: `content_ref:u32,duration:u16,padding:u16`; content는 해당 셀 번호 u16.
읽은 모든 animation_type은 `0x10000`. 셀 번호와 시간을 복원했어도 공격/피격/기절 같은 의미는 별도 검증 대상이다.

`common/e003_giantmissile00` 시퀀스 2/프레임 0은 duration=0이다. 값을 보존하고 그 시퀀스의 APNG는 만들지 않는다.
0을 임의로 1로 고치거나 정지/건너뛰기 동작으로 확정하지 않는다.

## 기존 웹 이미지와 확인된 차이

- 216종 ×40 =8,640 애니메이션. 7,849는 모든 프레임의 정규화 픽셀과 순서 일치, 791은 차이.
- GIF duration은 모두 `floor(raw_tick*100/60)*10 ms`와 일치. 이는 GIF 제작 방식에 대한 관찰이며 원작 엔진의 정확한 시간 단위 증명은 아니다.
- 차이는 주로 #26/#27/#36/#39, 그리고 가루다몬 #9에 모인다. 팔레트 bank와 투명도가 관련되어 있지만 원작 실행 중 팔레트 교체 여부는 미검증이다.
- 유니몬 기존 `m357_unimon_main_5_1.gif`는 ROM #5와 일치. 현재 웹의 #4 대체를 고칠 근거가 확보되었으나 이번 분석 커밋은 게임 동작을 수정하지 않았다.
- 웹 kokatorimon ↔ ROM cockatrimon의 명시적 파일명 대응을 검증했다. `m326`이 내부 species ID라고 확정한 것은 아니다.
- 전체 1,319 bank 중 1,258 bank/24,602셀 렌더링. badge001..061은 NCBR가 4bpp/512바이트인데 NCER는 32×32 8bpp라 불일치한다. 런타임의 OAM 수정 여부 확인 전 자동 교정하지 않는다.

## 정적 배경 배치

NSCR body: `width_px:u16,height_px:u16,color_mode:u16,screen_format:u16,size:u32`, 뒤에 u16 entries.
entry의 low10은 타일, bit10/11은 H/V flip, high4는 4bpp palette bank.
일반 256/512크기 화면은 32×32 타일 screen-block 순서를 따른다.
`cageBG_B.nscr`는 512×128의 비표준 크기지만 1,024 entries가 모두 0이라 순서와 무관하게 동일하다. 비상수 비표준 크기는 거부한다.

NBS: `NBSR,u32 format_word,width_tiles,height_tiles,variant_word`.
`(format_word,variant_word)`이 (2,0)/(2,1)/(1,0)이면 u16 entries; (1,1)이면 `flags:u16,tile:u16` entries.
후자의 flags=4는 NSCR 0x400과 일치하는 H flip이다. 다른 flag 의미는 추측하지 않는다.
A/C/D/E 네 배경은 NBS 영역 전체가 대응 NSCR 영역과 일치한다. B의 NBS는 실내 이미지지만 NSCR는 빈 배치이므로 두 파일을 동등하게 취급하지 않는다.

198개 중 194개 렌더링. 공유 캐릭터 후보만 있는 `cageBG416_000..003.nscr` 네 개는 연결 미검증으로 보류.
동일 stem의 NSCR/NBS가 모두 있으면 기본 CLI는 NSCR를 선택한다. `.nbs`나 `.nscr`까지 지정하면 명시적으로 선택할 수 있다.
기존 PNG 124건 비교의 58차이는 검토 대상이며 자동 교체 대상 목록으로 간주하지 않는다.

## 움직이는 배경 BSA

`BSAR,u32(2,1,frame_count,1)`, u32 시간값 배열, u32 width/height, u16 격자, u32 lookup_rows, u16 lookup[rows][frame_count].
격자 값은 타일 번호가 아니라 lookup의 행 번호다. 각 행에 프레임별 타일 참조가 있으며 flip 비트도 유지한다.
19개 전부 바이트 크기와 참조 범위를 검증했다. 17개 2프레임, 2개 3프레임.
`field_bm03_01_anim`의 용암과 `field_cm09_01_anim`의 물/해안을 복원하고 시각 확인했다.
APNG의 60Hz, 반복 재생, 투명 index0은 검토용 가정이다. 카메라, 실제 레이어 순서, 배경과 오브젝트의 최종 화면 합성은 아직 구현하지 않았다.

## 공간 격자와 배치 레코드

`rom_scene.py` 출력에는 source 파일/ROM 오프셋/해시, 레코드별 파일 오프셋을 기록한다.

| 파일 | 구조 | 검사 수 |
|---|---|---:|
| ATR | DATR + u32 version/width/height + u8 grid | 120 |
| COL | u8 version/width/height + u8 grid | 40 |
| ESC | u8 version + u16 width/height + u8 grid | 30 |
| NXR | NXSR + count/resource names + 가변 이름/36바이트 레코드 | 96 /1,366레코드 |
| OPM | OPMD v4 + 자산 이름 + count +16바이트 레코드 | 75 /1,537레코드 |

NXR 이름은 u32 길이 뒤 ASCII bytes, 4바이트 정렬. 길이가 4의 배수면 추가 NUL을 소비하면 안 된다.
레코드는 `i32 resource_candidate,i32 animation_candidate,6*f32,u32 flags`. resource=-1인 314개도 그대로 보존한다.
OPM 레코드는 `u16 packed,i16 x/y/z_candidate,f32/f32`. low13bits는 연결한 NANR 시퀀스 범위 안에 1,537개 모두 들어간다.
highflags 0x2000/0x4000의 flip 의미, 좌표축·기준점은 여전히 INFERRED. 자산명 한 개는 대소문자 차이가 있다.

COL은 0 영역/외곽까지의 8방향 거리 모델과 39/40파일이 완전 일치했다. cm29의 24칸만 모델과 달랐다.
4방향 거리 모델은 완전 일치 파일이 0개였다. 이 수학적 관계는 검증 가능하지만 실제 충돌/시설 배치 알고리즘은 복원하지 않았다.
ATR/COL은 같은 40시설에서 크기가 일치하나 서로 다른 값 분포를 가지므로 같은 데이터로 대체하면 안 된다.
ESC 숫자를 도주 확률로, ATR 숫자를 AP나 통행 가능 플래그로 임의 지정하지 않는다.

## 남은 범위

원작 실행 중 팔레트/색 심도 변경, 움직임과 모션의 호출 관계, 충돌 규칙, 공유 배경 연결, 지도 합성/카메라는 미검증이다.
진화/AP/기술 수치·능력치·수명 테이블은 이 그래픽 분석에서 복원하지 않았다.
도구는 허용된 좁은 형식만 해석한다. 다른 리비전, affine OAM, 3D NSBMD/애니메이션, 폰트 NFTR/사운드는 별도 작업이다.
