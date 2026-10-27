# 원작 데이터 검증 계약

모든 추출 레코드는 dataset, record_id, fields, confidence, evidence를 가진다.
confidence: ROM_VERIFIED(주소와 의미 검증), GUIDE_VERIFIED(공략 직접 대조), INFERRED(추정), PLACEHOLDER(임시 구현).
evidence: source_file, rom_sha256, rom_offset, file_offset, ram_address(해당 시), layout/endianness, interpretation, validation_method, source_url(공략), tool_version.
ROM 주소와 압축 해제 후 오프셋을 혼용하지 않는다. 의미 확인 전 수치는 INFERRED. 기존 문서 출처만으로 GUIDE_VERIFIED 재검증을 주장하지 않는다.
진화 비교 키는 검증된 source_species_id/target_species_id; 웹 이름/스프라이트 stem은 ROM ID로 간주하지 않는다. 비교 결과에는 기존값/후보값/충돌/미확인을 보존한다. 자동 게임 적용은 구현하지 않았다.
