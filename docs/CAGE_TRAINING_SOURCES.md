# v0.19.0 시설·종족 AP 자료 출처와 구현 범위

## 원작 자료 (독립적인 ROM 수치 검증 전)
- [GameFAQs 2008 NDS Evolution Guide](https://gamefaqs.gamespot.com/ds/943756-digimon-world-championship/faqs/54306) — 시설별 주요 효과/기능 연결: 미니 화산→용족/공격/열 저항, 초원→짐승/속도, 높은 산→조류/속도, 해변→수중/냉기 저항, 숲→곤충·식물/조류/지능, 공장→기계/데이터/번개 저항, 묘지→암흑/바이러스/어둠 저항, 꽃밭→신성/백신, 연구소→데이터/지능, 마의 방→바이러스/암흑, 도장→백신/신성.
- [GameFAQs FAQ v1.8](https://gamefaqs.gamespot.com/boards/943756-digimon-world-championship/45836974) — 진화용 숨겨진 종족/속성 AP 11종과 화면상 표시되는 열·냉기·번개·빛·어둠 저항 AP는 별개의 계열. 진화 후 종족 AP 초기화. 게임 원작은 시설 안에 디지몬을 넣을 때 훈련 적용이라고 설명하므로, **지속 반복 훈련은 우리가 확정한 확장판 자동화**.
- [GameFAQs AP discussion](https://gamefaqs.gamespot.com/boards/943756-digimon-world-championship/41602538) — Dragon/Beast/Bird/Water/Insect/Machine/Darkness/Holy 및 Vaccine/Data/Virus 숨겨진 육성치.
- [DWC Wiki Cages](https://digimonworldchampionship.fandom.com/wiki/Cages) — 원작 시설 구분과 테이머 등급 조건 참고.

## v0.19 현재 적용: 확인된 범주와 임시 수치 구분
- 원작형 **시설 종류/계열 AP 증가 방향**은 위 공략을 따름. `src/cage-training-core.js`의 11개 시설을 특별 훈련장 내 구입/선택 가능한 하위 룸으로 구현.
- **주 AP +2, 보조 AP +1, 저항 +1/주기, 시설 비용, 해금 DAY/대회 승리, 이동 거리, HP 소모, 훈련 횟수와 체력 반영은 임시 밸런스**. 원작 정량치/랭크/시설 크기를 ROM에서 추출했다고 주장하지 말 것.
- 기존 중앙 훈련: 방어 공터(곤충 AP), 공격 미니 체육관(기계/데이터 AP), 속도 미니 운동장(짐승 AP) 모델은 미완성 시뮬레이션용 대응. **특별 훈련장의 체육관에서는 공격 훈련만으로 용족 AP가 증가하지 않도록 교정**.
- 육성 목표 `AP 목표 달성 시 중지`, 자동 휴식 후 반복훈련은 사용자와 합의한 **확장판 UX**. 원작과 구분.
- `evo.ap`의 11개 숨겨진 진화 수치와 `evo.resist`의 5개 속성 저항치를 분리. 별도 저항치는 지금 진화 판정에 사용하지 않음.
- 시설은 특별 훈련장 육각형에서 서브룸으로 선택함. 독립 건물 픽셀아트, NDS 실제 케이지 UI, 원작 계절 효과 정량/지능 전투 적용은 후속 작업.
- 현재 원작 그래픽 216종 및 477개 진화 경로 유지. ROM과 공략 충돌사항은 반드시 별도 검증.
