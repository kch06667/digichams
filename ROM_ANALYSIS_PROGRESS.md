## 2026-10-28 후속: NBS 확장 타일 인코딩 수정

- 구조 파싱 성공을 실제 그림 의미 검증으로 과대 해석하지 않는다. 최초 도구의 NBS (2,1) 렌더링은 일반 Nitro10bit index/bit10·11 flip을 적용해 큰 맵의 타일 일부를 잘못 골랐다.
- (2,1) 89개에 `entry_encoding=nbs14`: low14 tile, bit14 H, bit15 V를 분리. variant0의5개와 flags+tile 변형6개는 nitro16 유지. 모두8bpp인 확장형만 지원.
- **검증 근거:** 100파일의 참조 범위 검사 통과. 38개가1,024타일 초과 NCGR를 사용. `ui/opening_txt.nbs` → 같은 이름 NSCR의768칸/수평반전21칸이 정확 일치. 새 --verify-nbs에 해시·파일ID·오프셋과 대조를 재현.
- **미확정:** bit15 V-flip 해석은 INFERRED(해당 대조에는 V-flip0개). 원작 실행·로더는 미추적. 데이터에 없는 높은 타일 번호 범위는 검증하지 않음.
- 198개 정적 배경 중194개 렌더링. 수정 전 대비49개 NBS 그림 변경/145개 동일. 기존 PNG와57일치/67차이. 수치 감소는 예전 PNG와 도구가 같은 잘못된 해석을 공유했을 수 있음을 보여주며 PNG 전체 오류 확정은 아님.
- 대표 `field/field_bm07_01`과 `training/cageBG416` 그림을 시각 확인. 저장소 밖 graphics-nbs14에만 보관. 게임 이미지/소스/세이브 자동 교체 없음.
- 공유NSCR4개는 여전히 보류. FAT IDs5658..5661, 후보NCGR5656/NCLR5657. ARM9 및22 overlay에서 정확한 cageBG416 문자열/해당 연속u16·u32 ID 패턴은 발견되지 않음. 참조가 없다고 단정할 수 없고 다른 인코딩/로더 분석 필요.
- 합성 회귀35/35. 관련 도구만 변경해 전체 스프라이트/브라우저 검사를 반복하지 않음.

```sh
python3 tools/rom_graphics.py --rom /path/game.nds --output-dir /outside/graphics-nbs14 --verify-nbs --audit-backgrounds
```

## 게임 적용 체크포인트 — 2026-10-28 유니몬

- 기존 저장소 자산 `assets/sprites/champion/m357_unimon_main_5_1.gif`와 ROM #5의 픽셀/순서/시간 변환 일치 결과를 실제 게임에 반영.
- index.html은 해당 파일을 사용하며 standalone.html 슬롯5도 동일 파일 바이트로 교체. 이전 #4 대체는 제거. ROM에서 새 이미지를 추출해 게임에 추가한 변경이 아님.
- 스프라이트 감사8,640개 오류0, 일반/단독 HTML 및 PC/모바일 로딩 검증 완료. #5의 원작 실행 중 사용 의미는 추가 검증 대상이며 기존 웹의 hit 슬롯 이름은 유지.
- 아래 분석 집계의 missing_expected_path=1은 표준 `_5.gif` 파일명 부재를 가리킨 과거 분석 값이다. 현재 런타임과 감사 도구는 `_5_1.gif` 예외를 명시적으로 사용한다.

## 2026-10-28 최종 체크포인트 — BSA 추가 복원

- BSA 배경 애니메이션 **19파일 모두 구조 및 타일 참조 범위 검증**. 17개는 2프레임, 2개는 3프레임. BSAR 헤더 → 시간값 → 격자의 lookup 행 번호 → 행별 프레임 타일 참조 표 구조.
- `field/field_bm03_01_anim`의 용암 배경과 `training/field_cm09_01_anim`의 물/해안 그래픽을 프레임 PNG/APNG로 복원하고 시각 확인. 미리보기 시간은 60Hz 가정, 팔레트 index0 투명 가정; 실제 레이어 합성과 엔진 시간 단위는 미확정.
- 전체 구조 파서 대상은 이제 **5,974파일**, 실패 0. 이것은 게임 규칙이나 전체 ROM 코드의 복원율을 뜻하지 않음. 앞 단계 sprite-bank 61개 / 배경 공유 참조 4개의 렌더링 예외는 계속 남아 있음.
- 최종 합성 회귀 **33/33 통과**(database 6 + graphics 19 + scene 8). 게임 파일·세이브·기존 이미지 변경 없음.
- 포맷 상세: `ROM_ANALYSIS/GRAPHICS_FORMATS.md`. 집계: `docs/audits/rom-graphics-v023.json`. 원본·추출 이미지·원문 데이터는 Git에 새로 추가하지 않음.
- 다음은 유니몬의 검증된 기존 #5_1 연결 수정, 팔레트 변화 모션의 원작 실행 검증, badge61 색 심도/공유배경4 예외 또는 ARM9 참조 분석 중 한 단위를 선택.

```sh
python3 tools/rom_graphics.py --rom /path/game.nds --output-dir /outside/graphics --animated-background field/field_bm03_01_anim
```

이하 단계별 과거 기록이며 수치가 충돌하면 위 최종 체크포인트가 우선한다.

## 2026-10-28 추가 분석 완료 (이 항목이 아래 1차 수치보다 우선)

- 전체 2D 그래픽 구조 **5,955파일 파싱, 0 구조 오류**. NANR의 0 tick 1건은 원문 그대로 보존하고 해당 시퀀스 APNG를 생성하지 않음 (`common/e003_giantmissile00`, 시퀀스 2/프레임 0). 의미는 미확정.
- 전체 애니메이션 묶음 1,319개 중 **1,258개/24,602셀 실제 렌더링**. 남은 61개는 `database/item_badge001..061`: NCER 8bpp 지정 vs NCBR 4bpp/512바이트 불일치. 추측으로 강제 교정하지 않음.
- NSCR/NBS **198개 구조 해석**, 그중 **194개 배경 렌더링**. 4개 `training/cageBG416_000..003.nscr`는 같은 stem의 캐릭터 파일 없음. 공유 `cageBG416.ncgr/nclr` 후보가 있지만 연결 미확정.
- 기존 배경 이미지와 124건 대조: 66 일치 / 58 차이(서로 다른 NBS/NSCR 경로가 동일 PNG에 대응할 수 있어 고유 이미지 수가 아님). 4바이트 NBS를 2바이트로 오해하면 격자 형태로 깨지는 사례 확인.
- NBS `(format_word,variant_word)=(1,1)` 6파일은 `flags:u16,tile:u16`. flags=4 → NSCR 0x400 좌우 반전과 A/C 맵에서 교차 일치. A/C/D/E 영역은 대응 NSCR과 전체 항목 일치. 다른 flag는 미지원. B의 NSCR은 512×128 전체 0으로 NBS와 별도 내용.
- `tools/rom_scene.py`: **NXR 96(1,366레코드), OPM 75(1,537레코드), ATR 120, COL 40, ESC 30** 전체 구조 파싱, 0 오류. OPM 자산 이름(1개 대소문자 차이 포함) 75개와 low-13-bit 후보 인덱스 1,537개 모두 대응 NANR 범위 내. 좌표·회전·flip의 실행 의미는 INFERRED.
- COL 40파일/20,100칸의 값에 대해 8방향 거리 모델 시험: **39파일 완전 일치**, cm29의 24칸만 불일치. 4방향 거리 모델은 완전 일치 0파일. 따라서 단순 boolean 통행 표로 해석하지 말 것. 수학적 일치는 원작 충돌 알고리즘 복원을 뜻하지 않는다.
- 216종/8,640 GIF 비교 결과는 동일: 7,849 일치 / 791 차이. 세부 집계 및 실패 범위는 `docs/audits/rom-graphics-v023.json`. 원작 실행 중 팔레트 재설정 가능성이 있어 차이 전체를 GIF 버그로 확정하지 않음.
- 합성 회귀 **31/31 통과**(database 6 + graphics 17 + scene 8). 게임 코드/세이브 변경 없음.
- 다음 단위: BSA 19개의 배경 애니메이션 구조 탐색. 관찰상 프레임 수 2/3, tilemap + 시퀀스별 타일 참조 표 후보이며 아직 파서/테스트로 확정 전. 유니몬 연결 수정과 팔레트 재현은 별도 적용 작업.

실행 추가:
```sh
python3 tools/rom_graphics.py --rom /path/game.nds --output-dir /outside/graphics --audit-sprites --audit-backgrounds
python3 tools/rom_scene.py --rom /path/game.nds --output-dir /outside/graphics
python3 -m unittest discover -s tests -p 'test_rom*.py' -v
```

# 2026-10-28 그래픽 분석 체크포인트

- 새 작업 브랜치 `analysis/rom-graphics-20261028`, 기준 main `aa6db16`. 원본은 이전과 동일 SHA-256의 읽기 전용 로컬 NDS.
- `tools/rom_graphics.py`: NCLR 팔레트, NCGR 타일/NCBR 선형 픽셀, NCER 셀·OAM·VRAM 전송, NANR 애니메이션·프레임 tick, NSCR/NBS 일부 배치 해석. 새 추출 자산은 모두 저장소 밖.
- **216종 × 40 = 8,640개 애니메이션 비교 완료.** 7,849개는 투명 여백 제거·BGR555 정밀도 정규화 후 모든 프레임 픽셀/순서 일치. 791개는 차이 존재. 프레임 기준점·게임 내 동작 의미 일치까지 뜻하지 않음.
- 기존 GIF 시간은 8,640개 모두 `floor(tick*100/60)*10 ms`와 일치. 60Hz가 원작 엔진의 실제 실행 속도인지는 아직 미검증; GIF 제작 방식과 일치하는 관찰이다.
- 유니몬 표준 #5 파일 없음. 저장소의 기존 `m357_unimon_main_5_1.gif`는 ROM #5와 픽셀/순서/tick 변환 일치. 현재 게임의 #4 대체는 검증된 원작 프레임과 다름; 별도 적용 대상.
- 웹 `m326_kokatorimon_main` ↔ ROM `m326_cockatrimon_main` 명칭 차이는 명시적으로 대응, 픽셀 비교 수행. 종 ID 테이블 해독을 뜻하지 않음.
- 아구몬 직접 확인: 40시퀀스·65셀. `.nanr` ROM 11,689,984, `.ncbr` 11,691,520, `.ncer` 11,703,296, `.nclr` 11,706,368. 순서/시간/위치/팔레트 참조는 구조로 검증. #26/27/36/39 색 변환 프레임은 기존 GIF와 차이가 있어 미확정 모션 이름으로 유지.
- 특이 헤더: NANR 파일 크기 16/블록 크기 0; NSCR 선언 크기는 실제 FAT 파일보다 4바이트 큼. 프로파일 일치와 실제 범위를 별개 검사한다.
- 최초 전체 구조검사: NANR 1318, NCBR 840, NCER 1319, NCLR 1527, NCGR 752, NSCR 97, NBS 89 파싱 성공. 예외 13건(0 tick 1건, NBS 변형 11건, NSCR 비표준 크기 1건)은 보고서에 남기고 추후 분석. 이 수치는 이후 단계에서 갱신 예정.
- 훈련 `training/field_cm01_01` 96×112, 필드 `field/field_bm02_01` 416×272, 승리 배경 `battle_result/result_win_palette` 256×256을 직접 복원하고 시각 확인.
- 로컬 결과: `/workspace/scratch/digichams-private/graphics/structure-audit.json`, `web-sprite-comparison.json`, 선택한 스프라이트별 PNG/APNG·메타데이터. APNG는 검토용(60Hz 가정), 원작 실행 추적을 대신하지 않음.
- 합성 테스트 14/14 통과. 현재 게임 파일/세이브/기존 자산 수정 없음. 진화·능력치 규칙을 이번 그래픽 분석으로 복원한 것은 아님.

실행:
```sh
python3 tools/rom_graphics.py --rom /path/to/game.nds --output-dir /outside/checkout/graphics --audit --compare-web
python3 tools/rom_graphics.py --rom /path/to/game.nds --output-dir /outside/checkout/graphics --sprite digimon/m201_agumon_main --background training/field_cm01_01
python3 -m unittest discover -s tests -p test_rom_graphics.py -v
```

---

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

## 2026-10-28 최신 Phaser 작업과 호환
- main66b6011과 분석ce56624를 통합한 브랜치 integrate/rom-phaser-checkpoint-20261028, 병합커밋d5e689c.
- 기존 검증 유니몬 #5_1 연결을 Phaser 로컬 atlas 변환기에도 적용. 실제 PNG 픽셀/110ms 보존 및 PC/터치 로딩 확인. ROM 추가 분석/새 원작 규칙 검증을 수행한 것은 아님.
- 최신main의 사육장/전투정산 사본 모듈 보존. 새 추출 이미지·ROM은 커밋하지 않음. 나머지 ROM 미검증 항목은 기존 기록대로 유지.
