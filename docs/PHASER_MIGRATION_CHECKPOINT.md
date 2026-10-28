# Phaser transition checkpoint (2026-10-28)

Related: GitHub Issue #11. Work branch `feature/phaser-vertical-slice-20261028`.
This phase intentionally does **not** modify original-game HTML, save format,
battle rules, farm navigation logic, Digimon database, or private ROM analysis.

## Product definition (user-confirmed)
NDS Championship raising loop: obtain Digimon → cage husbandry and training →
AI-controlled automatic battle → open more evolution possibilities → repeatedly
challenge the championships. Player is the tamer/coach, not a manual move pilot.

## Architecture as of this checkpoint
- Existing pure/semipure JS modules: `src/battle-core.js` (tactics, TP),
  `src/farm-core.js` (actor navigation), `src/cage-training-core.js`,
  `src/care-core.js`, `src/evolution-core.js`,
  `src/championship-core.js`. Preserve these for migration.
- The active farm renderer is `src/hex-farm-ui.js` plus inline HTML code,
  with fixed large radial facilities; user now wants smaller NDS-like cage
  cells, initial two rows expandable by progression, and bottom navigation.
  Implement later after ROM/UI reference review; don't silently mutate saves.
- New `phaser-lab/` includes a separate Phaser 3.90.0 battle lab and a
  *small hex cage farm lab* (`farm.html`/`farm-model.js`/`farm.js`). The cage
  demo starts with two rows of 6 candidate slots and two occupied cages,
  supports purchase, row expansion, training demo, four visible bites and
  pan/zoom. Grid dimensions, prices and feeding portions are demo-only.
  No game state bridge
  or production replacement is claimed.
- `phaser-lab/logic.js` defines verified action IDs and simple independent
  rendering/math contract, also importable in Node tests.
- `tools/export-phaser-atlas.py` converts private GIFs into **local-only**
  fixed-cell PNG sprite sheets, retaining original frame durations.
- `tools/build-phaser-preview.cjs` creates strictly allowlisted deploy output
  with **no** game art or original game HTML.
- Two independent CI workflows: isolated Node/Python tests, and Pages build
  from main after merge. Pages settings and hosting success not assumed.

## Motions and gameplay evidence
- User confirms 30 = victory. Never replace with 28 randomly.
- User confirms 32 = training but it may be static; user recalls a short attack
  immediately followed by stat gain, **not** push-ups. Which attack frame belongs
  in the NDS training sequence remains to be proven by Codex/video.
- 2 = walking is a candidate from old mapping, **not ROM-verified**.
- Battle presently lacks impact, big knockback, sound, correct motion switching
  and constant sprite scale; prototype tests those effects without touching
  real damage/AI.
- Original-style food consumption should animate several bites and shrink meat.
- `index.html` loaded through Android Zipper content:// can break relative
  graphics while fully extracted/HTTP `standalone.html` works.

## Quality gates before merging Phaser into actual game
1. Test prototype with/without locally generated atlas on Chromium and Android.
2. Check that 0/2/5/7/30/32 display at consistent size and correct direction.
3. Verify win uses 30, train displays 32 + researched transition, battle
   applies actual walk while moving and full hit reaction on impact.
4. Connect existing battle simulation to Phaser **without changing outcome**,
   with regression tests that compare before/after serialized state.
5. Add save migration only if needed, JSON import/export safety, and reliable
   cache/update notices. No accidental public upload of proprietary sprite art.
6. Rework hex cage placement and feeding incrementally after NDS evidence.

## What is not done
- Full Phaser migration of the current playable game.
- Production-ready 216-Digimon animation processing or verified action mapping.
- Original NDS battle/AI/sound reverse engineering (Codex task).
- Public distribution of any extracted GIFs/ROM graphics.
- Actual GitHub Pages enablement or Android hardware QA.

## Run locally and resume
See `phaser-lab/README.md` for commands.
Run regression tests on existing game separately:
`node tests/battle-core.cjs`, `node --test tests/farm-navigation.cjs`,
`node tests/cage-training.cjs`; run browser tests if dependencies installed.
Always update this checkpoint with *actual* test and PR results, never guessed.

## Future responsibilities
Codex: NDS reverse engineering on separate branch; keep empirical frame
evidence, provenance and exact GIF action mapping.
Phaser track: renderer/atlas/tooling, mobile input, strong hit feel, small
hex cage UI, game-domain adapter, safe web preview.

## 2026-10-28 second integration checkpoint

- Site: `https://kch06667.github.io/digichams/` (asset-free Pages demo).
  The previous Pages configure 404 was resolved after owner enabled Pages;
  successful workflow rerun: `40586958965`.
- Feature track: `feature/phaser-legacy-core-adapter-20261028`.
- New `phaser-lab/domain-bridge.js` executes original project battle
  tactics/TP core, care seasons and championship requirements, rather than
  independently reimplementing these rules in the lab.
- `phaser-lab/index.html` can read a JSON game export to preview the real
  Digimon roster and cup eligibility. This is read-only and doesn't modify
  gameplay or stored saves.
- The preview generator copies only three JavaScript rules files into
  `engine-core/`; never add ROM extracts or copyrighted sprite art to Pages.
- Remaining critical: original `index.html` arena combat time/AI/damage
  and real player save mutation/compatibility are still NOT integrated.
- **Visibility warning:** repository metadata reported a public repository
  after the Pages change. The source tree already contains `assets/rom` and
  `assets/rom_images` among other extracted-looking image files. The owner
  should review whether these belong in any public repository and change
  visibility / history exposure as appropriate. Our Pages preview explicitly
  does not deploy these assets; that does not hide files already public in Git.

## Asset-free PWA checkpoint

- `phaser-lab/manifest.webmanifest`, `icon.svg`, `pwa.js` and `sw.js`
  provide install/update behavior for the **safe Phaser demo only**.
- Public Pages build uses an explicit allowlist, includes pinned Phaser 3.90
  distribution with MIT license, and omits original art. Versioned service
  worker caches only safe known paths and offers a reload button after an
  update; no hidden automatic in-progress game reload.
- Service worker never intercepts or caches uploaded JSON files or paths
  outside the allowlist; no live save writes.
- Tests must prove offline load of the bundle, training and farm on desktop;
  Android device install still requires owner QA.
- Repository visibility is a separate consideration: public source metadata
  has already shown extracted-looking files in the main tree. Pages allowlist
  does not protect public Git contents. Avoid assuming this fixes copyright
  or private-development concerns.

## 2026-10-28 read-only roster vertical slice

Track: `feature/phaser-roster-battle-farm-readonly-20261028`.

- Both independent Phaser scenes accept user-exported JSON saves and display
  *copied, validated* actual Digimon records without modifying localStorage
  or the in-game save.
- The battle lab permits choosing one eligible active Digimon; its copied
  name/HP/attack/defense/speed/TP are passed into the lab's `newEncounter()`.
  Existing TP and targeting functions still decide special versus normal.
  This is **not** the legacy arena's full AI/damage rules and does **not**
  apply the demonstration battle outcome to the original save.
- The farm lab projects up to 30 active monsters into small hex cages,
  shows real HP/name/hunger, and disables all mutation controls in
  read-only mode. It excludes storage/lost monsters and does not claim the
  slot allocation reflects NDS cages.
- Save previews are transient browser-only data. No cross-page persistence
  or server upload. To inspect both scenes, select the JSON file separately.
- Added unit tests for invalid roster eligibility and no mutation, 30-slot
  clipping, and Chromium desktop/mobile import and selection.
- Still needed: isolate the **full actual** legacy arena logic (some inline
  in the original HTML), separate world state mutation from renderer,
  implement game-event replay in Phaser without changing win/loss outcomes,
  and build real save-backed integration after those rules stabilize.

## 2026-10-28 correction — Phaser turn demo was NOT our desired combat

Owner observed two unrelated placeholder figures trading one hit each,
revealing the earlier Phaser prototype used `turn % 2`. That was a design
mistake, not a required Phaser limitation.

Correct baseline already exists in old `index.html` under the main
`DCBattleArena` implementation: multi-fighter real-time AI `think(f,dt)`,
`advanceSpecial`, `beginMelee`, 2D chase/strafe/disengage/dodge, dynamic
targeting, knockback, cast/projectiles, KO, victory pose and owned-match
settlement. Codex ROM analysis is separate; do NOT conflate original-game
JS simulation with ROM-verified NDS mechanics.

New branch `fix/phaser-autonomous-realtime-battle-20261028` implements a
**temporary but concurrent** fixed-step 2D simulation in
`phaser-lab/realtime-core.js` and plugs it into `phaser-lab/game.js`.
Default mode 3v3; 1v1/2v2 optional, no user attack controls. The rendering
still uses noncopyrighted placeholders publicly or private local converted
GIF atlas. Training and user JSON save previews remain read-only.

This is NOT final simulation parity with original `DCBattleArena`; next
task is extracting original production AI/simulation logic and replay
events through Phaser. Keep save settlement entirely disabled in the
independent prototype until regression equivalence tests verify outcomes.

## 2026-10-28 — first real sprite identity/technique bridge

Feature branch: `feature/phaser-combat-parity-20261028`.

- New `phaser-lab/arena-techniques.js` contains a documented transcription
  of the `TECHNIQUES` table from the existing production `index.html`
  arena. The Phaser demo uses actual matching names, elements/colors,
  melee/ranged forms, TP costs and explicit unverified-data provenance.
- Fixed a graphical identity bug: one local Agumon atlas was displayed for
  EVERY battler. Now local private sprites are rendered **only if the
  actor's Digimon species name matches the atlas species**. Other combatants
  retain distinct generated placeholders.
- Added `phaser-lab/private-art-loader.js` and a browser file chooser for
  locally generated `manifest.json` + `action_*.png` files. The loader
  validates species, animation lengths and filenames, caps file sizes,
  uses temporary object URLs, revokes them on replacement and does NOT
  upload files to GitHub, Pages or cloud storage.
- The autonomous Phaser prototype's attack windup, guarded damage factor,
  energy/TP gate, signature cooldown, projectile palette and knockback
  are tuned toward values already present in the original game's
  v0.23.2 arena. **Not exact simulation parity yet.**
- CI adds private-art validation, species cost guards and Chromium
  mouse/touch import checks using ephemeral local Agumon sheets.
- Public safe Pages build still allowlists only JS/HTML/license/manifest/
  original placeholder icon, not Digimon artwork.
- NEXT: formally extract original production `DCBattleArena` to a shared
  DOM-free simulation, compare deterministic trace outcomes, then replace
  the lab's provisional combat logic with the actual game simulation.

## Original arena locomotion kernel extraction — 2026-10-28

Branch `feature/arena-legacy-motion-20261028` extracts the exact
**movement equations** (not the full arena AI state machine) from
`index.html`'s `DCBattleArena.think()` into
`src/arena-navigation-core.js`. Phaser's `realtime-core.js`
now calls `DCArenaNavigation.advance()` rather than maintaining
its own forward/orbit/avoidance geometry. It preserves the original
600×405 motion world with calculated mapping into the Phaser viewport;
runtime actor visual directions and walking/running GIF poses use
the resulting motion state. Safe Pages deployment includes this
new **JavaScript-only** module in the allowlist.

Still missing: the original attack/skill/battle-settlement logic
is still embedded in the old large HTML. This migration preserves
the original HTML and current saves intact, and is an incremental
path to full renderer-independent combat parity. Separate NDS ROM
analysis remains ongoing with Codex.

## 2026-10-28 — original-combat calculation functions reused

Project request: "재사용" — prioritize true reuse over inventing a new AI.

Branch `feature/original-arena-engine-reuse-20261028`.
A new `src/arena-original-core.js` contains the **unchanged verbatim
function bodies** from the playable index HTML combat simulator:
`alive`, `chooseTarget`, `emit`, `hit`, `projectile`,
`beginMelee`, `beginSkill`, `advanceSpecial`, `think`, and
`update`. The script supplies equivalent original constants,
fighter runtime fields, real project battle-core functions, existing
technique registry and DOM-free rendering/persistence no-ops, with
a deterministic isolated random generator for repeatable verification.

`phaser-lab/game.js` now runs this actual extracted calculation module,
not `phaser-lab/realtime-core.js` simulation. The old prototype file
stays for separate regression comparison; it is not the active game
simulation. Original combat positions are projected to Phaser dimensions
and changes in actual HP/skill/simulation status become render events.

Regression checks compare **all ten extracted function bodies with their
exact original HTML text** on CI, test deterministic state evolution and
ensure imported Digimon records are never mutated. The same PC/mobile
Playwright smoke tests exercise the Phaser scene.

**Not yet reused:** persistent battle settlement and actual controlled
match save mutation, integrated species GIFs (owner-local only),
evolution/championship progression event dispatch, ROM-exact values and
a standalone production entry point. Do NOT claim complete NDS port
or persistent gameplay before save roundtrip equivalence is proven.
Existing `index.html` and `standalone.html` remain untouched.

## 2026-10-28 — 다종 디지몬 로컬 전투 그래픽 1차

Branch: `feature/multi-species-private-battle-art-20261028`.

- Phaser 실시간 자동전투는 기존의 `src/arena-original-core.js` 원작 HTML 전투 계산을 그대로 사용하고, 플레이어의 원본 저장 데이터에 쓰지 않는다.
- 기존에는 하나의 `manifest.json`만 유지하여 신규 아틀라스 업로드 시 이전 종을 대체했다. 이제 같은 브라우저 탭에서 서로 다른 종의 아틀라스를 **최대 6종**까지 순차 등록할 수 있다.
- 새 종 추가는 기존 종 모션을 덮어쓰지 않는다. 모션 텍스처/애니메이션 키와 포즈 선택을 종별로 분리했다. 같은 종의 재등록만 해당 종을 교체한다.
- 파일은 브라우저 임시 `blob:` URL로만 처리하고 서버·GitHub·게임 세이브에 넣지 않는다. 탭 사용 메모리 보호를 위해 총 입력 48MB 제한, 종 6개를 넘으면 가장 먼저 등록한 종을 해제한다.
- Browser QA: 별도 로컬 생성 시트로 아구몬·가부몬 이름의 두 세트를 순차 등록하고, 3v3에서 둘 모두 각각 전용 텍스처를 유지하는지 확인하도록 테스트 추가. 테스트용 가부몬 데이터는 그림 자체가 가부몬임을 증명하지 않는다.
- 미완료: **실제 216종 전체 모션 검증**, 모바일 Android 실기 메모리·프레임 측정, 원작 대회 전투의 저장/보상 연결, 원본 ROM 수치 검증.
- GitHub 저장소 공개 이력의 추출 자산 관리 문제는 별도 해결 사항. 이 변경에는 자산 파일을 넣지 않는다.

## 2026-10-28 — 전투 결과 → 본게임 연결 준비 1차 (읽기 전용)

Branch: `feature/battle-result-readonly-bridge-20261028`.

- 기존 `src/arena-original-core.js`의 10개 원본 판정 함수와 HP/TP/전투 RNG는 **전혀 바꾸지 않았다**.
- `phaser-lab/domain-bridge.js`에 `previewBattleResult()`를 추가해, **종료된** 원본 전투의 승패·시간·아군 HP/TP 전후 변화만 검증된 읽기 전용 객체로 만든다.
- 출전 명단의 인덱스를 원본 내보낸 JSON의 `team` 배열 인덱스에 연결한다. 같은 이름·같은 종을 여러 마리 가진 경우에도 각 마리의 전후 변화를 혼동하지 않도록 인덱스 중복, 누락, 이름·시작 HP 불일치를 거부한다. 이 인덱스는 **불변 인스턴스 ID가 아니므로** 앞으로 본게임 저장에 그대로 사용하지 않는다.
- 실제 JSON에서 디지몬을 선택해 시연을 마쳤을 때 화면에 HP·TP 변화 요약을 표시하고, JS QA API `DigiPhaserLab.battleResultPreview()`로 같은 객체의 사본을 확인한다.
- 시연 도중/완료 후에도 **localStorage, 실제 세이브, 포획·육성, 승리 횟수, 대회 결과, 보상은 변경하지 않는다.** 기본 시연팀에는 JSON 대응 명단이 없으므로 결과 미리보기를 생성하지 않는다.
- Node 회귀: 미완료 판정 거부, 2vs2 실전 계산 완료, 중복 종의 개별 HP/TP, 잘못된 인덱스·HP 거부, 호출자 세이브 불변 검증. Chromium PC·터치: JSON 등록 → 전투 → 결과 표시 → 세이브 불변 → 초기화 확인.
- 차후 실제 정산 연결 전에는 저장 데이터의 안정적인 개체 ID, 전투 원복/취소, 결산 중복 방지, 이전 세이브 호환성과 기존 본게임 `settleMatch()`의 결과 일치 테스트가 필요하다. 이번 변경은 **전투 본게임 통합 완료가 아니다**.
