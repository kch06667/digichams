from pathlib import Path
import zipfile,shutil,json,hashlib,re,tempfile,subprocess,os
root=Path(__file__).resolve().parents[1]
base_zip=Path('/mnt/data/Digimon_Championship_v0.23.1_Tournament_Expansion.zip')
base=zipfile.ZipFile(base_zip)
new_css=(root/'src/hex-farm.css').read_text()
marker='/* v0.23.2 map visual skin (presentation only): independent of simulation code */'
art_css=new_css[new_css.index(marker):]
art_name='hex_farm_v0232.webp'
# Verify preexisting JS is unchanged byte for byte, including both independently playable builds.
comparison={}
for name in ['index.html','standalone.html']:
    old=base.read(name).decode()
    new=(root/name).read_text()
    extract=lambda h:re.findall(r'<script\b[^>]*>(.*?)</script>',h,re.I|re.S)
    scriptsold=extract(old); scriptsnew=extract(new)
    assert scriptsold==scriptsnew, f'Unexpected JavaScript change in {name}'
    comparison[name]={'script_elements':len(scriptsold),'same_js':True,'before_sha256':hashlib.sha256(old.encode()).hexdigest()[:16],'after_sha256':hashlib.sha256(new.encode()).hexdigest()[:16]}
# Version and documentation changes for separate full release; merge patch will not touch these.
pkg=root/'package.json'
a=json.loads(pkg.read_text());a['version']='0.23.2';a['scripts']['test:farm-graphics']='python tests/farm-graphics-browser.py';pkg.write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
ck=root/'CHECKPOINT.json';c=json.loads(ck.read_text());c.update({'checkpoint':'19','version':'0.23.2','based_on':'v0.23.1','feature':'pixellike hex farm artwork skin, unchanged game engine, HTML independent and standalone embedded art','tests':'TEST_REPORT_v0.23.2.md','provenance':'original generated art, no ROM graphics extracted for this map'});ck.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
readme=root/'README.md';txt=readme.read_text().replace('Prototype v0.23.1','Prototype v0.23.2')
txt+='''\n\n### v0.23.2 — playable farm graphics skin\n- Added a self-contained 920x690 pixel-styled facility map using derived original generated artwork, in `assets/farm/hex_farm_v0232.webp`. All 7 old hex coordinates and facility click areas are preserved.\n- Existing Digimon sprite animation, collision/feeding/navigation, cages/AP, tournaments and saved game state remain driven by their existing modules. This is a visual skin, not a new simulator.\n- The individual zones have visible selected/locked states, with improved UI labels, contrast, and actor name styling. Food placement continues to use the real game map.\n- `index.html` references the included WebP; `standalone.html` embeds its own copy. The full ZIP does not include Codex's unpublished local movement changes.\n- For merging into Codex's newer branch, use the separate graphics-only patch to avoid replacing JavaScript or player saves.\n'''
readme.write_text(txt)
notes=root/'TEST_REPORT_v0.23.2.md';notes.write_text('''# v0.23.2 — 사육장 그래픽 실제 적용 및 테스트 (2026-10-28)\n\n## 변경 사항\n- 원본 아트 참고 시안에서 시설 그래픽을 추출·재구성한 웹 전용 이미지 `assets/farm/hex_farm_v0232.webp` (920×690, 약 105KB).\n- 7개 시설의 실측 좌표 및 DOM 선택 버튼 그대로 보존. CSS만 변경하여 이미지/건설 잠김/선택/캐릭터/먹이 레이어 구분.\n- `src/hex-farm.css`와 `index.html` 내장 CSS, `standalone.html` 내장 CSS 동기화. 단독 HTML은 WebP 데이터 URI 포함.\n- 이동/회피/먹이/전투/진화/세이브 관련 JS는 **v0.23.1 기준으로 변경 없음**. 원본과 HTML 스크립트 블록을 byte-for-byte 비교 확인.\n- 기존 캐릭터 스프라이트는 이미지에 굽혀 넣지 않고 동적 DOM 액터를 사용함.\n\n## 실제 실행 검증\n- 11종 Node 테스트 묶음 각각 통과: farm-core, evolution-core, evolution-tree, sprite-catalog, cage-training, care-seasons, hunt-core, battle-core, battle-rest, championship-core, championship-bracket-expansion.\n- Chromium `tests/hex-browser.py`: 기본 사육장/훈련/먹이/휴식/시간·속도/배틀·구역 이동/모바일 스크롤 8 PASS, 페이지 JS 오류 없음.\n- Chromium `tests/championship-v0231-browser.py`: index, standalone 모두 8팀 월드컵 진행·3라운드·저장·보상 통과.\n- Chromium 신규 `tests/farm-graphics-browser.py`: index/standalone 모두 아트 로딩·7개 타일·액터·먹이 배치·먹이 취소 무차감, 페이지 JS 오류 없음. 파일 URL은 보안 정책으로 금지돼 페이지 HTML+아트 data URI 인메모리 테스트로 대체.\n- 실제 Android 실기 장시간 플레이 및 Codex 로컬 작업 상태 병합은 **아직 미검증**.\n\n## 병합 주의\n- 이 릴리스 전체 게임은 v0.23.1 기반이므로 Codex의 Esc 취소, 이동 회피/양보/통로 상태 등 최신 로컬 수정이 들어 있지 않음.\n- Codex 작업 브랜치를 절대 본 전체 ZIP으로 덮어쓰지 말고 `Digimon_v0232_Farm_Graphics_Only_Patch.zip`의 스크립트로 CSS/아트만 적용.\n- 새로운 이미지 예시는 원작 ROM 스크린샷을 그대로 붙인 것이 아니라 참고용 생성 이미지의 데코레이션을 재구성한 것.\n''')
merging=root/'MERGE_GUIDE_FARM_GRAPHICS.md';merging.write_text('''# v0.23.2 사육장 그래픽을 Codex 최신 코드에 병합하기\n\n1. Codex `improve/farm-movement-v023` 브랜치를 GitHub에 보관한다. 이 그래픽 패치는 그 작업을 대체하지 않는다.\n2. 게임 프로젝트 최상위와 별개 디렉터리에 `Digimon_v0232_Farm_Graphics_Only_Patch.zip`를 푼다.\n3. 프로젝트에서 `git switch -c feature/farm-graphics-v0232` (기존 Codex 브랜치를 부모로).\n4. 패치 디렉터리에서 `python apply-farm-graphics-v0232.py /absolute/path/to/digichams` 실행.\n5. `git diff`에서 `src/hex-farm.css`, `index.html`, `standalone.html`의 CSS 및 신규 `assets/farm/` 파일만 변경됐는지 확인. JS 변경이 있으면 병합 취소.\n6. 이동 회피/먹이 선택/대회 테스트 및 브라우저 수동 테스트 후에만 커밋/PR. 저장 상태는 변경하지 않는다.\n\n### 안내\n- `index.html`은 상대 경로의 WebP 파일을 읽기 때문에 폴더 구조를 유지해야 한다.\n- `standalone.html`은 WebP data URI를 인라인하고 있어 단독 실행이 가능하다.\n- 이 작업에서 포함된 건물 모양은 시안 기반 시각 표현이며 구매/잠금/맵 좌표는 게임 엔진의 기존 값에 종속된다.\n''')
patch_dir=Path('/mnt/data/digimon_graphics_v0232_graphics_patch')
if patch_dir.exists():shutil.rmtree(patch_dir)
patch_dir.mkdir()
(patch_dir/'farm_graphics_skin.css').write_text(art_css)
(patch_dir/'assets'/'farm').mkdir(parents=True)
shutil.copy2(root/'assets/farm'/art_name,patch_dir/'assets'/'farm'/art_name)
shutil.copy2(merging,patch_dir/'MERGE_GUIDE_FARM_GRAPHICS.md')
script=r'''#!/usr/bin/env python3
"""Apply only cosmetic farm CSS/image to an existing newer Digimon project."""
from pathlib import Path
import re,sys,base64,shutil
PATCH=Path(__file__).resolve().parent
TARGET=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path.cwd()
MARKER='/* v0.23.2 map visual skin (presentation only): independent of simulation code */'
CSS=(PATCH/'farm_graphics_skin.css').read_text()
IMAGE=PATCH/'assets/farm/hex_farm_v0232.webp'
required=[TARGET/'index.html',TARGET/'standalone.html',TARGET/'src/hex-farm.css']
for p in required:
    if not p.is_file():raise SystemExit(f'Required game file is missing: {p}')
    src=p.read_text()
    if MARKER in src:raise SystemExit(f'Already applied in {p}; refusing duplicate. No files changed.')
    if p.suffix=='.html':
        # The farm CSS lives in a style element; never touch a script element.
        if not re.search(r'<style[^>]*>[^<]*#farmPanel \.hexTile[^<]*</style>',src,re.S):
            raise SystemExit(f'Farm style container not found in {p}; no files changed.')
    elif '#farmPanel .hexTile' not in src:raise SystemExit('CSS module has no hex farm styles; no files changed.')
# Prepare all content in memory; patch is CSS-only and keeps every JS block verbatim.
updates={}
for p in required:
    src=p.read_text();css=CSS
    if p.name=='standalone.html':
        uri='data:image/webp;base64,'+base64.b64encode(IMAGE.read_bytes()).decode('ascii')
        css=css.replace('assets/farm/hex_farm_v0232.webp',uri)
    if p.suffix=='.html':
        pattern=r'(<style[^>]*>)([^<]*#farmPanel \.hexTile[^<]*)(</style>)'
        m=re.search(pattern,src,re.S)
        assert m
        modified=src[:m.end(2)]+'\n'+css+'\n'+src[m.end(2):]
        assert re.findall(r'<script\b[^>]*>(.*?)</script>',modified,re.S)==re.findall(r'<script\b[^>]*>(.*?)</script>',src,re.S)
        updates[p]=modified
    else:updates[p]=src+'\n'+css+'\n'
# No original JS/asset deletion. Write the new background only after successful validation.
new=TARGET/'assets'/'farm'/IMAGE.name
new.parent.mkdir(parents=True,exist_ok=True)
shutil.copy2(IMAGE,new)
for p,v in updates.items():p.write_text(v)
print(f'Applied farm visuals to {TARGET}: 3 CSS-bearing files updated and {new} copied. JavaScript unchanged.')
'''
(patch_dir/'apply-farm-graphics-v0232.py').write_text(script)
# Validate patch against an unpacked clean original, not our already patched release.
with tempfile.TemporaryDirectory() as temp:
    demo=Path(temp)/'game';demo.mkdir()
    for file in ('index.html','standalone.html','src/hex-farm.css'):
        p=demo/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(base.read(file))
    # inject marker into JS source to mimic Codex's unpublished farm fixes; ensure unchanged after patch
    f=demo/'index.html';s=f.read_text();s=s.replace('foodPlacement=false','foodPlacement=false/* UNPUBLISHED CODEX TEST */',1);f.write_text(s)
    src=f.read_text()
    rv=subprocess.run(['python',str(patch_dir/'apply-farm-graphics-v0232.py'),str(demo)],capture_output=True,text=True)
    assert rv.returncode==0,rv.stderr+rv.stdout
    assert '/* UNPUBLISHED CODEX TEST */' in f.read_text()
    assert src.count('/* UNPUBLISHED CODEX TEST */')==f.read_text().count('/* UNPUBLISHED CODEX TEST */')
    assert 'data:image/webp;base64,' in (demo/'standalone.html').read_text()
    assert (demo/'assets/farm'/art_name).read_bytes()==(root/'assets/farm'/art_name).read_bytes()
    print('Codex-safe merge patch verified:',rv.stdout.strip())
# Build slim patch and playable full copy, avoiding ROM root ZIP.
for out,path in [(Path('/mnt/data/Digimon_v0232_Farm_Graphics_Only_Patch.zip'),patch_dir),(Path('/mnt/data/Digimon_Championship_v0.23.2_Graphics_Playable.zip'),root)]:
    with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for f in path.rglob('*'):
            if not f.is_file():continue
            if '__pycache__' in str(f) or f.name.endswith('.pyc'):continue
            z.write(f,f.relative_to(path))
    print(out,'size=',out.stat().st_size)
print(json.dumps(comparison,ensure_ascii=False,indent=2))
