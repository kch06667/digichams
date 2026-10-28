# 원작 데이터 검증 계약

모든 추출 레코드는 dataset, record_id, fields, confidence, evidence를 가진다.
confidence: ROM_VERIFIED(주소와 의미 검증), GUIDE_VERIFIED(공략 직접 대조), INFERRED(추정), PLACEHOLDER(임시 구현).
evidence: source_file, rom_sha256, rom_offset, file_offset, ram_address(해당 시), layout/endianness, interpretation, validation_method, source_url(공략), tool_version.
ROM 주소와 압축 해제 후 오프셋을 혼용하지 않는다. 의미 확인 전 수치는 INFERRED. 기존 문서 출처만으로 GUIDE_VERIFIED 재검증을 주장하지 않는다.
진화 비교 키는 검증된 source_species_id/target_species_id; 웹 이름/스프라이트 stem은 ROM ID로 간주하지 않는다. 비교 결과에는 기존값/후보값/충돌/미확인을 보존한다. 자동 게임 적용은 구현하지 않았다.

## 도감 텍스트 추출 프로파일
`tools/rom-database.py`의 names 항목: `text_index`, `file_offset`, `rom_offset`, `byte_length`, `text`.
상위 레코드에 ROM SHA-256, source_file(ID/오프셋/크기/해시), record_count, text_decoding, name_block_interpretation, comparison 보존.
UTF-16LE 디코딩 자체와 문자열 위치는 ROM_VERIFIED. 첫 216항목의 종 대응은 INFERRED. `text_index`를 species_id로 바꾸지 않는다.
전체 원문/추출 텍스트는 저장소 밖 로컬 분석 산출물에 보관. 저장소에는 도구·테스트·요약만 유지.

## 그래픽 복원 구조 (2026-10-28)
`tools/rom_graphics.py`: source마다 NitroFS 경로/FAT ID/ROM 오프셋/크기/SHA-256 기록. NCER cell_index/file_offset/bounds/objects(x,y,width,height,tile,palette,bpp,flip)/transfer(source_offset,size)와 NANR animation_index/file_offset/loop_start/play_mode/frames(cell_index,duration_ticks,content_offset) 보존. NCER transfer.source_offset은 NCGR/NCBR 픽셀 payload 상대 오프셋이며 ROM 절대 오프셋이 아니다.
프레임/좌표/팔레트 구조와 픽셀 대조는 ROM_VERIFIED 근거. action 이름과 미관찰 엔진 tick 속도는 INFERRED. 추출 PNG/APNG 및 전체 메타데이터는 저장소 밖에만 저장. GIF 비교는 여백 제거/BGR555 양자화 기준이며 기준점 위치와 게임 내 사용 의미를 검증하지 않는다.
