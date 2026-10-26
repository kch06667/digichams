# v0.16.0 evolution provenance

Sources (community reverse-engineering; not independently verified against ROM):
- https://gamefaqs.gamespot.com/boards/943756-digimon-world-championship/45154090 — species-specific routes (Koromon → Agumon 3 fights; Agumon → Greymon 6; Greymon → MetalGreymon 10; Patamon → Angemon 6; Kunemon → Kuwagamon insect AP 20; Gabumon → Garurumon passing time).
- https://www.speedrun.com/ko-KR/digimon_world_championship/guides/736ou — hidden AP is recalculated per evolution, battle counts persist.
- https://nhoko.xxxxxxxx.jp/champ-first.html — battle counts include losses; egg revert rule for 10 battles below ultimate stage; no stat floor/cage cap confirmed yet.
- https://gamefaqs.gamespot.com/boards/943756-digimon-world-championship/45325515 — evolving resets stage lifespan and Mega egg revert after about three months.
- https://m.namu.moe/w/디지몬%20챔피언십 — training cages change stats and species AP in different directions; no complete AP tables presently validated.

**Engine implementation**
- Verified structural behavior: distinct species routes, per-mon battle/wins counter, rollover of battle totals on evolution, AP+penalty reset, egg reverts, per-stage day aging, storage freezes aging.
- **Unverified balance**: stage-day numbers 5/15/28/45/65/90, time-evolution delay 5 days, per-training AP +2, mapping of basic attack/defense/speed to machine/insect/beast, purchased training plot to dragon; partial stat inheritance after hatch, fallback to Koromon. All are marked temporary and editable in src/evolution-core.js.
- **Safety change**: original permadeath / lost is not enabled yet; if lifespan expires without the battle/seniority criteria, the Digimon is warned and not silently deleted (avoid erasing existing save data). To be decided after ROM check.
- **Coverage**: only routes with target species already defined in SPECIES have effects; no invented sprite-less entries, no unseen routes or "random" evolutions. Future data may affect tie-breaking and rank caps.
- **Migration**: pre-v0.16 individual past battles cannot be inferred from global wins/losses; counters initialize 0, but existing stats/levels remain.


## v0.18.0 lineage expansion
- Core source: https://gamefaqs.gamespot.com/ds/943756-digimon-world-championship/faqs/54306 (2008-10-04 hemlock86 community guide). 179 non-Mega evolution starting species, 477 links matched to local 216-species sprite catalog.
- Guide is user-generated, not a complete cartridge decompile. Correct any transcription/spelling ambiguity by checking ROM.
- Original source includes apparent stage inconsistencies: Blue Meramon placed in Perfect section of guide while existing sprite classification says Champion; and a few same-stage paths. Keep flagged, do not silently invent stages.
- Target selection and automatic branch tie priority are new expansion UX/game-balance choices, not asserted original mechanics. Rank gating thresholds and time delay remain unverified.
