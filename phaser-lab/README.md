# Phaser rendering lab · separate from the existing game

## 지금 바로 원작 스프라이트 1대1 테스트하기 (개인 PC 전용)

프로젝트를 내려받아 압축을 해제하거나 최신 GitHub 저장소를 복제한 다음,
**프로젝트 최상위 폴더**에서 아래 명령을 실행한다. Python과 Pillow가 필요하다.

```powershell
py -m pip install Pillow
py tools/export-phaser-duel.py
py -m http.server 8000
```

`http://127.0.0.1:8000/phaser-lab/`을 열고 **아구몬 vs 가부몬 1대1** 버튼을
누르면, 기존 GIF를 변환한 아구몬·가부몬의 실제 종별 애니메이션으로
원본 웹게임 전투 AI의 자동 1대1 연습전을 볼 수 있다.

- 변환할 로컬 GIF들이 `assets/sprites/rookie/`에 이미 있어야 한다.
  `export-phaser-duel.py`는 그 소스를 **새로 내려받거나 서버에 전송하지 않는다**.
- 만든 모션 파일은 `phaser-lab/local-assets/duel-agumon/`,
  `phaser-lab/local-assets/duel-gabumon/`에 저장한다. **Git에서 제외**하며
  공개 GitHub Pages나 안전 미리보기 빌드에 포함하지 않는다.
- 1대1 버튼만 누르면 팀을 자동으로 **1대1**로 선택한다. 두 디지몬의
  파일이 모두 준비되면 양쪽 스프라이트가 자동 적용된다. 한쪽 파일이
  없어도 게임은 정상 실행되지만 그때는 **임시 그림**이다.
- `local-assets`는 브라우저가 자기 PC의 웹서버에서 읽는 경로다.
  휴대폰에서 시험하려면 같은 Wi-Fi의 PC 서버에 IP 주소로 접속해야 하며
  PC가 켜져 있어야 한다. 인터넷에 공개 업로드하지 않는다.
- 이 기능은 **별도 Phaser 1대1 연습전**이다. 원본 세이브와 실제 사육장
  출전·챔피언십 보상은 변경하지 않고, 실제 NDS ROM의 모든 모션 용도나
  기술 피해량이 일치한다는 의미도 아니다. 공개 배포 권한과 별개로
  개인 테스트 파일을 공개 저장소에 올리지 않는다.


This is a **development vertical slice**, not a replacement for index.html / standalone.html.
No main save, battle reward, evolution or ROM-backed AI logic is modified.

## Run

1. From the repository root: `python3 -m http.server 8000 --bind 127.0.0.1`
2. Open `http://127.0.0.1:8000/phaser-lab/` in a desktop browser.
3. Use the buttons: auto battle, one training action, restart, sound toggle.
4. Open `http://127.0.0.1:8000/phaser-lab/farm.html` for a separate small-hex cage prototype.
   Click/tap individual cage tiles; buy additional cages, feed across four visible
   bites, practice, expand from two rows and pan/zoom. No save data is touched.

The demo loads **Phaser 3.90.0 from a version-pinned CDN**, so the browser needs
internet access. Without exported GIF assets, the demo uses freshly drawn,
copyright-free procedural placeholder characters. Training bonus, attack damage,
AI turns and timings are **demonstration-only**, not NDS reverse-engineered.

## Test existing GIFs locally — private use only

Run from the repository root with Python and Pillow available:

```sh
python3 -m pip install Pillow
python3 tools/export-phaser-atlas.py --species 아구몬
python3 -m http.server 8000 --bind 127.0.0.1
```

Reload `http://127.0.0.1:8000/phaser-lab/`. The exporter writes:
- `phaser-lab/local-assets/manifest.json`
- `phaser-lab/local-assets/action_<index>.png`

**Do not commit or share those outputs.** The folder is ignored by Git.
This conversion preserves every GIF frame and its source GIF duration and pads
**all actions to one shared canvas size** to avoid pose-dependent scale jumps.
Each invocation exports one Digimon. Species names resolve through the legacy
13-name index first (preserving aliases), then the full 216-species
`assets/species-catalog.json`. For example, `--species 유니몬` now works;
action 5 uses the existing ROM-compared `m357_unimon_main_5_1.gif`.
The input GIFs remain untouched. This does not verify every action's meaning.
For several species, use a different `--output` directory per invocation,
then select each directory's manifest and PNGs in the browser's local art input.
Not every GIF contains multiple frames (notably training action 32 can be static).

Action 30 is user-confirmed **victory**, 32 is user-confirmed **training**.
The short attack motion adjacent to original training remains unverified.
The demo temporarily plays 32 followed by attack 7 to test the choreography,
not to assert that this is the ROM's exact training sequence.

## Tests

```sh
node --test tests/phaser-lab.cjs tests/phaser-preview.cjs
python3 -m unittest discover -s tests -p test_phaser_atlas.py -v
```

The farm model has additional offline regression coverage in `node --test tests/phaser-farm.cjs`.
The first tests run offline. The synthetic GIF conversion test needs Pillow.
Full Phaser WebGL/Canvas rendering on physical Android still needs manual
verification. The original DOM game and save format have not been migrated yet.

## Web delivery — art-free preview only

```sh
node tools/build-phaser-preview.cjs
```

Produces only three allowlisted Phaser demo files and build-info.json under
`dist/phaser-preview`. This **intentionally excludes original game pages,
sprites, ROM art, and generated local GIF sheets**. A GitHub Pages workflow is
provided for merging into main after review. Pages must be configured in repo
settings for deployment to work. Browser updates happen on reload/revisit,
not by replacing active JavaScript mid-game. This preview has no save data.

## Next integration steps

- Verify 0–39 sprite meanings using Codex's separate ROM analysis.
- Use a shared render contract (pose, orientation, position) and a spritesheet
  manifest without coupling game rules to Phaser.
- Replace one existing battle renderer behind a feature flag only after
  comparing full battle outcomes and old-save roundtrips.
- Keep handling of owner-provided copyrighted artwork private; obtain proper
  authorization before any public game release.

## Step 3 — real rule-module bridge (read-only)

`domain-bridge.js` now delegates **existing** Javascript engine functions:

- `src/battle-core.js`: existing tactic selection, targeting policy, TP skill
  threshold/cost, bounded TP updates. The prototype still uses demo-only
  damage (36 skill / 18 normal), encounter scheduling and knockback; those are
  **NOT** equivalent to the full original arena embedded in `index.html`.
- `src/care-core.js`: seasonal training gain. Values remain earlier project
  extension balance, not yet ROM-verified.
- `src/championship-core.js`: real project cup availability rules. Click
  **대회 조건** to view conditions for a *sample roster*.
- Optional **세이브 JSON 읽기** reads a user-selected export, validates its
  safe subset in browser memory, and shows a roster summary and actual cup
  eligibility. It never writes localStorage, never overwrites original game
  files, never sends this file to the public preview server, and never changes
  the original game's active save. The import is *preview only*, not live
  battle save integration.

The safe preview copies only these three allowlisted JS rule modules into
`engine-core/` and rewrites their relative script URLs. No ROM graphics or
binary files are included. Browser smoke tests cover both the unbundled and
deployment builds (subject to CI settings).

## Safe PWA installation and automatic web updates

The `phaser-lab` preview now provides `manifest.webmanifest`, an original
icon, `sw.js` and an opt-in update prompt. The site can be opened on PC or
Android; when the browser supports installation, use **Install app** or
**Add to Home screen**. Installation affordances vary by browser and platform.

For CI-deployed GitHub Pages only, the build includes a pinned, MIT-licensed
`phaser@3.90.0` under `vendor/` plus its license. After **one successful
online visit and service worker installation**, the **safe lab** should reopen
offline (battle/farm demos only). The source tree still references the CDN for
unbundled development; offline capability is verified on the generated Pages
bundle, not promised for every local setup.

When a new commit reaches Pages, service worker cache names change using the
build SHA. Existing cached JS is reused within that version, and a button
invites the user to activate a waiting update; it never silently replaces
game JS mid-battle. A full backup plan for the real game saves is still needed.
Original Digimon graphics are intentionally **excluded** from all public Pages
builds, even if present in repository history.

Run `node tools/build-phaser-preview.cjs` after installing Phaser locally for
an offline-capable safe bundle. `node --test tests/phaser-preview.cjs` checks
the preview allowlist. Chromium smoke tests additionally verify offline
navigations on CI.

## Player roster preview in both Phaser scenes

Use the original game's **Save export** to obtain a JSON file. In the battle
lab, open it with the JSON picker and choose an eligible, alive, non-stored
Digimon from **출전 디지몬**. The local Phaser simulation now copies that
Digimon's name, HP, ATK/DEF/SPD and TP into the **temporary auto-sparring
encounter**. The legacy TP/tactic functions continue to choose skills.
**The damage constants (36/18) and turn timing are still just a demo.**
The original save is never changed, and winning this exhibition gives no
reward or permanent stat change.

On `farm.html`, choose the same exported JSON to see the *active* Digimon
laid out in small hexagonal cages with their name, HP and hunger displayed.
The preview shows up to 30 farm Digimon (the existing game's storage Digimon
are not considered active cages), and reports extra undisplayed creatures.
Purchase, training, feeding and expansion controls are disabled in the
read-only view; selecting hexes and panning/zooming still work. **초기화**
returns to the separate simulation. This is a visual projection, **not**
migration of the legacy game's actual cage layout or save format.

The JSON file is parsed entirely in the user's browser. Only an allowlisted
subset (name, vital stats, day, cups) is held in transient page memory.
It is never uploaded to Pages or stored via localStorage, IndexedDB or
service-worker cache. File size is limited to 3 MiB, and source data
is validated before display.

## Why we replaced the old turn-taking Phaser demonstration

The first Phaser test scene was a **misleading scripted alternating attack
sandbox**, and its two placeholder characters did not represent the game's
planned auto-combat. The **original playable `index.html` arena already has**
asynchronous AI-driven 2D movement, approach/flank/disengage, dynamic targets,
dodge, guard, melee and ranged signature attacks, knockback and multimon
team battles. We should have audited and reused that logic first.

The default Phaser battle page now uses `realtime-core.js`, a pure deterministic
fixed-step **concurrent autonomous AI** simulator **inspired by those existing
arena behaviors**. Every actor independently chooses targets, walks/strifes
and can simultaneously wind up/attack; 1v1 / 2v2 / **3v3 default**, different
attack cooldowns, defensive reactions, orbiting, actual projectiles, damage,
hit effects and victory. There is **no global alternating turn scheduler** in
the active Phaser battle view. Node tests explicitly check simultaneous
windups and 3v3 2D motion; desktop+touch browser tests verify the animation
path and automatic outcome.

This is still NOT the exact, already implemented original `index.html`
arena logic ported into Phaser. The original has more detailed unit control,
battle save settlement, AI variability, and species-specific technique/sprite
systems. The current public web preview still uses distinct *original
procedural test sprites*, not redistributed copyrighted Digimon imagery.
User-provided private sprite sheets may be tested locally using the atlas
export script. Never describe this lab as the finished game.

**Next major goal:** extract existing original battle simulation as a
renderer-independent production module (target behavior, cooldowns, attack
outcomes, state transitions, championship settlement), replace
`realtime-core.js` prototype rules with the production module in Phaser,
add equivalence tests before writing any player save.

## 2026-10-28 — species identity + local sprite pack, no public image upload

The Phaser battle lab now imports **existing game technique metadata**
from `arena-techniques.js`: the same named skills and costs currently defined
in the older `index.html` arena for Agumon, Gabumon, Patamon, WarGreymon,
MetalGarurumon and other registered species. For example Agumon uses
`화염 공격`, Gabumon uses `블루 블래스터` and WarGreymon has
a 36 TP cost. **These are extension-era game data, not verified ROM
technique IDs or NDS battle balance.** The energy gate, guarded TP cost,
windup, cooldown and knockback are closer to the existing HTML arena.

Default sparring team members now have actual Digimon names and their own
techniques. The freely distributed art is still **procedurally generated,
non-original placeholder art**; naming real monsters does not magically
supply their licensed graphics.

### Put your existing sprites on YOUR device without publishing them

1. Convert one species' already-owned local GIFs to sprite sheets with
   `python3 tools/export-phaser-atlas.py --species 아구몬` on a PC.
2. Open the safe web lab. Under **내 PC·휴대폰의 변환된 디지몬 모션 파일
   적용**, select **manifest.json and every action_*.png** together from
   `phaser-lab/local-assets`.
3. When that species appears in battle, the lab draws only that species
   using the selected sprite sheets. Other species retain placeholders.

The chosen images are read **only inside the current browser tab** using
short-lived `blob:` URLs. They are not sent to GitHub Pages, put in
`localStorage`, committed to Git, or cached by the service worker.
Selection must be repeated on tab reload; this is intentional. Package
limits: 45 files, 32MiB total, 8MiB per file. Only valid local
manifest+PNG file combinations are accepted. To create multi-species
graphics, a later version needs explicit per-species atlas manifests.
Do not select or publish NDS ROM files.

**Implementation boundary:** This remains a Phaser development lab,
not the original game's complete simulation. Main gameplay and save
settlement remain in the original playable `index.html`; do not treat
the lab's temporary combat statistics as permanent results.

## Original arena navigation extraction (next fidelity milestone)

The Phaser real-time practice fighters now use
`src/arena-navigation-core.js` for their 2D **movement**, instead of
the separate imitation movement code that was originally written for
the prototype. This kernel transcribes the already-playable
`index.html` arena's `think()` locomotion segment: approach/flank/
disengage decisions, target-relative forward + sideways vectors,
tactic weights, actor avoidance, edge repulsion, arena recentering
and speed-dependent walking/running. It runs in the original 600×405
logical coordinate system and projects into the 800×450 Phaser field.
The old `index.html` and its standalone copy remain unchanged.

This is **movement fidelity**, not full battle-engine migration:
hit/skill timing, decision trees, victory and tournament settlement
are still partly separate in Phaser. `tests/arena-navigation-core.cjs`
and existing browser smoke tests check the shared movement kernel.
A production parity effort must next extract attack/skill/dodge
judgment and state transitions from `DCBattleArena` and confirm
matching outcomes across both renderers.

## Production-battle-function reuse — original engine now drives the scene

The Phaser scene's engine selection was switched from the separately
invented `DigiRealTimeCore` prototype to **`DCOriginalArenaCore`**.
The shared `src/arena-original-core.js` mechanically contains the *exact
ten original function bodies* (from `index.html` v0.23.2):
`alive`, `chooseTarget`, `emit`, `hit`, `projectile`,
`beginMelee`, `beginSkill`, `advanceSpecial`, `think`, and
`update`. The source-function byte comparisons are checked in CI
against the still-playable `index.html`, so future changes that
silently fork their AI/impact/damage logic fail tests.

The extraction executes the **same old combat decisions and formulas**
under a controlled DOM-free dependency environment. Specifically,
`syncBattleHP`, `settleMatch`, and UI helpers are no-ops so this
Phaser-only **practice battle** never mutates or uploads real saves.
Original variables, existing TP/tactic rules and species technique
data are supplied to the extracted functions. A deterministic local
seed is injected only into the original Math.random calls for repeatable
regression tests; battle calculations themselves remain unchanged.
Phaser projects original 600×405 simulation coordinates to its
800×450 visual world. Impact/skill events are derived *from the
original engine's state changes*, not independently re-determined.
The original `index.html` gameplay remains the save authority.

Limits: this is shared **battle calculation**, not yet the complete
owned-battle integration. The original 6MB HTML still owns persistent
HP, win/loss counters, experience, evolution history and championship
settlement. Practice does not write any of those. Chromium tests
check the new battle in PC/touch, and pure Node tests compare the ten
extracted functions byte-for-byte to original source. Sprite mapping
and ROM verification remain separate.


## 2026-10-29 — 기존 사육장 → Phaser 연습전 (개발용 읽기 전용 연결)

사육 중인 디지몬으로 Phaser **1대1 연습전**에 바로 진입하는 개발용 연결이 추가됐다.
원본 `index.html`, `standalone.html`은 변경되지 않으며 저장 결과 반영은 **없다**.

```sh
node tools/build-dev-page.cjs
python3 -m http.server 8000 --bind 127.0.0.1
```

`http://127.0.0.1:8000/index.dev.html?phaserBridge=1`에서 기존 게임을 실행하고
하단 **내 디지몬으로 Phaser 연습전** 버튼을 누른다. 현재 사육 중인 정상 디지몬이
최소 한 마리 필요하다. 새 브라우저 탭이 열리면 자동으로 첫 출전 가능 디지몬이
선택되고, **실시간 자동 전투 시작**을 누르면 실제 HTML 전투 계산 코어의 1대1을 진행한다.
다른 디지몬으로 바꾸려면 전투 전 출전 디지몬 선택 메뉴를 이용한다.

- 기존 세이브 전체를 옮기지 않는다. 클릭 당시의 종 이름·전투 능력치·상태 등
  일부 속성만 허용 목록으로 전달하고, 대상 탭이 다시 검증한다.
- URL에는 무작위 연결 토큰만 넣고 세이브·이름·HP를 포함하지 않는다.
  브라우저 탭 사이에 동일 출처 `postMessage`를 사용하며 저장소에 쓰지 않는다.
- 진입한 전투의 보상, 경험치, HP/TP 등은 **읽기 전용 미리보기**라서 원본 게임에 적용되지 않는다.
- 공개 GitHub Pages의 safe preview에는 기존 사육장/원본 스프라이트나 개발용 실행 스크립트가 포함되지 않는다.
- 기존 본게임 자체의 전투 진입 경로 교체와 원자적 세이브 정산은 향후 별도 단계다.
- 검증: `node --test tests/build-dev-page.cjs tests/phaser-domain-bridge.cjs`,
  `python3 tests/phaser-farm-handoff-browser.py` (Playwright/Chromium, PC/터치).


## 2026-10-29 — 개발용 실제 Phaser 1대1 결과 저장 (선택 사항)

기존 `index.dev.html?phaserBridge=1` 사육장에서 연습전 탭을 열고,
1대1 원본 HTML AI 전투가 정상 종료되면 원래 사육장 탭에
**전투 결과 저장 (개발용 · 백업 필수)** 버튼이 나타난다.
기본적으로 **자동 저장하지 않으며**, 사용자가 직접 클릭할 때만 적용을 시도한다.

- 전투 탭에는 원본 세이브 전체와 개체 ID를 보내지 않는다. 전투가 끝난 뒤
  검증된 HP·TP·승패와 원본 시뮬레이션 결과만 동일 출처의 원래 탭에 전달한다.
- 원래 탭은 출전 개체 ID, 출전 당시 HP·TP·능력치, 전투 종료 결과, 현재
  사육장 상태가 모두 일치하는지 확인한다. 출전 개체가 바뀌었거나 기존 저장 상태와
  현재 메모리가 다르면 거부한다.
- 기존 `src/battle-commit-core.js`의 클론 정산을 그대로 사용한다.
  검증된 상태를 저장하기 전 첫 번째/최신 백업을 별도 키에 남기고 읽어 검증한다.
  세이브에는 한 번만 쓰며, 정상 확인 뒤 새로고침해 저장된 상태를 채택한다.
  중복 적용이나 다른 탭의 새로운 세이브를 덮어쓰지 않는다.
- **여전히 실험용 기능이다.** 대회 경기나 정식 본게임의 전투 버튼에는
  연결하지 않았다. 실제 사용 전 JSON 백업을 권장한다.
- 검증: `node --test tests/phaser-owned-settlement.cjs` 및
  `python3 tests/phaser-farm-handoff-browser.py` (Chromium PC/터치).


## 2026-10-29 — 원래 본게임 전투 시작 버튼에서 엔진 선택 (별도 시험판)

기존 게임 전체를 포함한 루트 `index.html`을 수정하거나 배포판을 교체하지 않고,
**정식 게임 화면/사육장/전투 모달**에서 엔진을 선택하는 시험 페이지를 생성한다.

```powershell
node tools/build-phaser-optin-page.cjs
py tools/export-phaser-duel.py
py -m http.server 8000
```

`http://127.0.0.1:8000/index.phaser.html?phaserBattle=1` 접속.
기존 본게임에서 **내 디지몬 출전**(또는 라이브 전투 열기) → 전투 방식 **내 디지몬 출전** →
팀 규모 **1대1** → **전투 화면: 기존 전투 (기본) / Phaser 전투 (시험)** 선택 →
**⚔ 자동 전투 시작**을 누른다. Phaser 선택 시 실제 기존 전투 계산 코어가
새 탭에 열리고 원래 전투 모달은 닫힌다. 기존 전투가 선택되면 이전과 정확히
동일한 원래 전투 `onclick`이 실행된다.

- 최초 선택은 항상 **기존 전투**. URL `phaserBattle=1` 없는 기존
  `index.html` 및 `standalone.html`에는 선택 UI/로직을 추가하지 않는다.
- Phaser는 현재 **내 디지몬 출전 1대1**만 가로챈다. 자유 시연, 2대2/3대3은
  기존 전투 옵션을 선택해야 하며, 대회 `launchTournament`는 건드리지 않는다.
- 실제 전투 완료 후 결과는 자동 저장하지 않는다. 원래 게임 탭에서
  `전투 결과 저장 (개발용 · 백업 필수)`를 누른 경우에만 기존 정산 코어를 재사용한다.
  HP·TP·경험치·승패·진화 등 정산, 저장 상태 및 백업 검증은 PR #42의 실험용 제한을 유지한다.
- 원래 게임 파일 두 개는 그대로 보존한다. 생성되는 `index.phaser.html`은
  Git 추적에서 제외되고 개인 사육 데이터나 ROM 그래픽을 포함해 업로드하지 않는다.
  세이브 JSON은 별도로 백업 후 시험하길 권장한다.
- 검증: `node --test tests/phaser-main-entry.cjs`;
  `python3 tests/phaser-main-entry-browser.py`로 원래 전투 기본 경로와
  Phaser 전환→전체 1대1→사용자 승인→저장/재시작을 PC와 터치에서 시험한다.

**미구현:** 정식 배포판 기본 전투 교체, 2대2/3대3 Phaser 저장,
대회전/상대 팀 정확한 연동, 원작 216종 애니메이션 완전성, 다른 탭과
장시간 동시 조작 시나리오의 실기 테스트.


## 2026-10-29 — 본게임 출전 2대2·3대3 Phaser (읽기 전용 단계)

`node tools/build-phaser-optin-page.cjs`로 생성한
`index.phaser.html?phaserBattle=1`에서 기존 전투 화면의
**전투 화면 → Phaser 전투 (시험)**을 선택하면 이제
**내 디지몬 출전 1대1·2대2·3대3**에서 Phaser 자동 전투를 사용할 수 있다.

- 기존 본게임 `current()`가 가리키는 **선봉**을 우선하고 나머지는
  원래 사육장의 명단 순서대로 고른다. 시작 전 체력과 보관함·알·유실
  상태를 확인하여 선택한 규모보다 출전 가능 개체가 적으면 출전을 거부한다.
- 팀 크기, 선봉 순서, 기존 전투창의 전술을 메시지에 같이 전달하여
  Phaser 화면에서 고정한다. 팀 구성·선봉 변경에 의한 결과 혼동을 차단한다.
- **1대1만** 기존 실험용 저장/보상 승인 버튼을 제공한다.
  **2대2·3대3은 전투 자체와 각 개체의 HP·TP 결과 미리보기만 가능**하며
  원본 세이브, 승패, 보상, 경험치, 대회 진행을 절대 기록하지 않는다.
  다인전 검증이 끝나기 전에는 동일 출처 메시지에도 정산 데이터를 전달하지 않는다.
- 대회전과 자유 시연은 그대로 **기존 본게임 전투**를 유지한다.
  이번 변경으로 216종 그래픽 적용이 완료된 것은 아니다.
  등록되지 않은 종은 안전한 임시 스프라이트로 표현한다.
- 데스크톱/터치 브라우저에서 원래 전투 버튼으로 2대2·3대3을
  각각 출전시키고, 실제 기존 자동 전투 AI로 종료한 뒤
  읽기 전용 및 저장/백업 키 미변경을 검사한다.
  `python3 tests/phaser-owned-multi-browser.py`.


## 2026-10-29 — 2대2·3대3 사용자 승인형 저장 (PR #45)

전술·출전 순서·전투 결과를 검증한 개발용 Phaser **1/2/3대전**은
전투가 끝나면 원래 사육장 탭에 **전투 결과 저장 (개발용 · 백업 필수)**
버튼을 표시한다. **저장하지 않고 종료할 수도 있다.**

- 전투 탭에서 원본 세이브나 고유 개체 ID를 받거나 저장하지 않는다.
  전투 종료 시 슬롯별 HP·TP가 포함된 검증용 패킷을 원래 사육장에만 전달한다.
- 원래 사육장이 출전 전 기록한 고유 개체 ID·선봉·출전 순서·능력치와
  결과의 모든 참여 개체를 슬롯별로 재검증한다. 누락·중복·뒤섞임이 있으면
  **모두 거부**한다. 승패·경험치·진화·HP·TP 정산에는 원래
  `src/battle-commit-core.js`와 `src/battle-settlement-core.js`를 재사용한다.
- 다른 탭이 저장했거나 사육장 상태가 저장 내용과 다르면 저장하지 않는다.
  세이브를 쓰기 전에 첫 백업과 직전 백업을 검증하고 한 번만 갱신한다.
  동일 결과 반복 적용 또는 승인되지 않은 추가 전투는 막는다.
- 직접 플레이하기 전 세이브 JSON을 따로 백업할 것을 권장한다.
  **정식 게임의 기본 index.html이나 대회전은 변경하지 않는다.**
- 검증: `node --test tests/phaser-multiteam-settlement.cjs`;
  `python3 tests/phaser-owned-multi-browser.py` (PC/모바일 터치, 저장 재접속).


## 2026-10-29 — 기존 챔피언십 → Phaser 경기·승인형 저장 (개발용)

`node tools/build-phaser-optin-page.cjs` → `py -m http.server 8000` 후
`http://127.0.0.1:8000/index.phaser.html?phaserBattle=1`에서 연다.

- **전투** 탭의 **🏆 대회 전투 화면**에서 `기존 전투 (기본)` 또는
  `Phaser 대회 전투 (시험)` 선택. 원래 대회 참가/다음 경기 버튼을 그대로 누른다.
- **지금 GitHub main의 HTML은 v0.23 대회 엔진(신인/지역/그랜드 모두 2라운드)**.
  개인 로컬 분석본에 있는 최신 4/8팀 상세 대진표 엔진은 **GitHub 본게임에 아직 반영되지 않음**.
  현재 GitHub 원본의 2라운드 일정·상금·상대 생성을 그대로 따르고,
  선택형 게임이 구형 외부 `src/championship-core.js`와
  `src/evolution-core.js`를 뒤늦게 재로드해 내장 규칙을 가리는 일은 없앤다.
- 현재 원본의 대회 상대는 첫 종만 명시한다. 원본 전투의
  `teamMembers(opponent, side=1, count)`와 **동일한 순서 계산**으로 나머지를
  선정한다. 더 풍부한 대진표 `opponentTeam` 데이터가 있으면 그 목록을 사용한다.
  상대의 HP·공격·방어·속도·TP는 원본 `SPECIES`와 `DCBattleCore`에서 전달한다.
- 전투는 기존 실시간 AI이며, **종료 시 자동 저장하지 않는다**.
  본게임 탭의 저장 승인 버튼을 눌러야 경기 ID/라운드/상대/전원
  HP·TP·고유 개체 ID와 저장 상태를 검증하고 클론 정산→백업→저장한다.
  신인 컵 준결승·결승 및 지역/그랜드 컵 진행, 포인트와 시설 Bit·우승 기록은
  원래 내장 `DCChampionship.finishMatch`에서 처리한다.
- 테스트: `node --test tests/phaser-championship-save.cjs`,
  `python3 tests/phaser-championship-browser.py` (Chromium PC/터치).
- **원본 `index.html`과 `standalone.html`은 변경하지 않음**.
  개인 세이브 JSON을 백업하고 시험해야 하며 실제 휴대폰 기기의 성능과
  최신 로컬 8팀 토너먼트는 별도 검증 과제다.


## 2026-10-29 — 216종 전투 GIF 로컬 일괄 변환 + 전투 인원만 자동 로딩

원작 스프라이트의 **종족 인식 범위는 전체 216종**으로 확대했다.
원본 PNG/GIF나 변환 결과는 **절대 GitHub/Pages에 업로드하지 않는다.**
`assets/species-catalog.json`과 `assets/sprite-index.json`에 이미
등록된 이미지 파일만 사용한다. 새 ROM 스프라이트 추출은 하지 않는다.

프로젝트 **최상위**에서 Python과 Pillow가 설치된 개인 PC에서 실행:

```powershell
py -m pip install Pillow
py tools/export-phaser-roster.py --all
# 특정 종만 빠르게 실험할 경우:
py tools/export-phaser-roster.py --species 아구몬 --species 가부몬
# ROM에서 의미를 아직 확인하지 않은 동작까지 40칸 전부 변환하려면:
py tools/export-phaser-roster.py --all --all-actions
# 생성 없이 216종 × 40칸의 원본 파일 존재 여부만 검증하려면:
py tools/export-phaser-roster.py --all --all-actions --verify-only
py -m http.server 8000
```

그다음 `http://127.0.0.1:8000/index.phaser.html?phaserBattle=1`의
사육장 출전→Phaser 전투를 실행하거나, 독립 연습전인
`http://127.0.0.1:8000/phaser-lab/`을 연다.
로컬 일괄 변환은 `phaser-lab/local-assets/catalog.json`에
디지몬 이름→`species/m###_xxx_main` 폴더의 **안전한 색인**을 생성한다.
각 폴더에는 그 종의 `manifest.json`과 액션별 PNG가 생성된다.

**성능 및 안전:** 시작할 때 목록 메타데이터만 읽고 **216종의 PNG를
전부 열거나 다운로드하지 않는다**. 전투 직전 실제 참가한 **최대 6종**
(아군·상대)을 읽고, 전투가 바뀌면 오래된 종의 텍스처/애니메이션을
제거한다. 등록되지 않았거나 누락된 종은 해당 캐릭터만 임시 그래픽을
쓴다. 사육·AI·공격 피해량·TP·전투 결과는 전혀 변경하지 않는다.
개인 파일로 추가로 가져온 종은 자동 변환 그래픽보다 우선한다.
자신이 가진 GIF의 장당 표시 시간과 프레임 수를 그대로 사용한다.

**확인 범위:** 216종의 소스에서 기본 40 GIF 슬롯(8,640개)의
**파일 존재 여부**를 검사할 수 있다. 유니몬 5번 동작은 ROM 비교에서
수정된 `5_1` 원본을 사용한다. 기본 `--all`은 전투 및 주요
행동에 필요한 13개 액션만 각 종에 변환하고, `--all-actions`를 주면
40개를 모두 변환한다. 모든 **216종의 기술명, 모션 의미, 스프라이트
위치/대칭/기술 이펙트까지 ROM 완전 일치했다고 검증한 것은 아니다.**
또한 파일이 많고 실제 저장 용량이 커질 수 있어 게임 서버와 모바일에
한꺼번에 로딩하지 않는다.

테스트: `python3 -m unittest tests/test_phaser_roster.py` (가짜 216종,
유니몬 보정, 누락 파일 차단) 및 CI의 6개 서로 다른 실제 종 3대3
데스크톱/터치 렌더링. 생성된 `local-assets`는 Git에서 제외한다.
