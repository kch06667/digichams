# Digimon Championship v0.20.0 — 테스트 및 출처 보고서

## 새 기능
- 계절: 봄/여름/가을/겨울. 여름 능력치 증가 우세·감소 완화, 겨울 반대. 30일/계절 및 배율 수치는 **임시값**, 실제 NDS ROM 검증 전.
- 기존 훈련 시설과 종족 AP를 계절 효과에 연동. 숨겨진 진화 AP와 보이는 저항치 구분은 유지.
- 과도한 훈련 중 부상, 치료하지 않은 부상의 질병 진행, 극심한 공복 후 질병. 발생 확률과 날짜는 **임시값**.
- 진화용 육성 패널티는 부상 발생 시 +1, 질병 발생 시 +2. 치료 후에도 이전 패널티는 남고 진화 시 초기화.
- 붕대 30 Bit, 약 50 Bit, 치료 에리어 완치+HP회복 80 Bit(모두 임시 가격).
- 부상·질병 동안 훈련 시간 및 HP 소모 증가 (임시 확장 밸런스).
- 기존 단계별 임시 수명, 디지에그 환생, 영구 삭제 방지 보호 장치 유지.
- 보관소에 둔 디지몬의 생애/건강/배고픔 변동 없음.
- `src` 및 두 HTML의 인라인 소스 동기화, JS 구문 검사.

## 검증
- `node tests/farm-core.cjs`: 30개 통과.
- `node tests/evolution-core.cjs`: 12개 통과.
- `node tests/evolution-tree.cjs`: 18개 통과.
- `node tests/sprite-catalog.cjs`: 9개 통과.
- `node tests/cage-training.cjs`: 16개 통과.
- `node tests/care-seasons.cjs`: 11개 통과.
- 핵심 자동 테스트 **96/96** 통과.
- `python tests/care-browser.py`: index/standalone 각 1개, PC/모바일 Chromium 실제 클릭 및 치료·세이브 검사 통과.
- `python tests/cage-browser.py`: index/standalone 각 1개, 시설 구매/용족 AP 목표 달성 통과.
- `python tests/evolution-browser.py`: index/standalone 각 1개, 전투/시간 진화·저장 검사 통과.
- `index.html`, `standalone.html`: 각각 인라인 JS 11개 구문 검사 통과.

## 원작 자료와 한계
- GameFAQs: https://gamefaqs.gamespot.com/boards/943756-digimon-world-championship/45836974
- Neoseeker: https://www.neoseeker.com/digimon-world-championship/faqs/176244-aidenrocks247.html
- 원작에서 확인된 것은 '계절의 훈련 효율 방향' 및 '부상 +1, 질병 +2 패널티' 등에 관한 공략 기록임.
- 30일/계절, 게임 내 수명/환생 날짜, 훈련 배율, 부상 확률, 치료비와 HP 추가 소모는 ROM으로 검증되지 않음.
- 디지몬 영구 소실을 자동 발동시키지 않음. ROM 데이터/공략 출처가 충분히 검증되기 전까지 세이브 보호를 우선함.
- 안드로이드 실기 테스트는 사용자가 확인 필요.
