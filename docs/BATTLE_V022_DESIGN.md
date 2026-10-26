# v0.22 Combat Fidelity / Provenance

- **Original supplied assets:** 216 sprite species and 40 action GIF indices; battle arena graphics from previous prototype. Existing action mappings are retained, not re-researched in this upgrade.
- **User-approved expansion:** director-style AI presets; no manual action buttons required.
- **Provisional, unverified gameplay math:** TP max from speed; skill TP cost (20–36) and energy threshold; TP regen during rest/hit; combat damage, cooldown and focus heuristics. None are asserted to be decoded from NDS ROM.
- **Signature-move names:** a small hand-curated set inspired by Digimon franchise names, not proof of the NDS game skill table or exact localization. Other species use explicit '기본 필살기(임시)'.
- **Behavior:** five ally tactics; enemies use balanced; target focus chooses lowest relative HP within distance-weighted score; offensive/defensive change movement and defense/dodge; conserve reserves 1.65× the move's TP cost before casting.
- **Backward compatibility:** pre-TP Digimon saves receive TP when first placed in battle; TP is persisted during battle and restored through farm rest. Stored Digimon remain frozen.
- **Future fidelity work:** ROM move definitions, correct per-species skill/motion, AI/TP/damage constants and 1v1/3v3 tournament rules. Verify in emulator against original hardware recordings.
