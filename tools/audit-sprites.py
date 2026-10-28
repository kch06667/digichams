"""Audit existing GIF assets without inferring animation semantics. Requires Pillow."""
import argparse
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

def audit(root):
    catalog = json.loads((root / 'assets/species-catalog.json').read_text())['entries']
    mapping = json.loads((root / 'assets/sprite-action-map.json').read_text())
    errors, static, sizes, overrides = [], {}, [], []
    total = 0
    for species in catalog:
        for action, index in mapping['sprite_actions'].items():
            # Existing asset matches ROM animation #5; see ROM_ANALYSIS_PROGRESS.md.
            suffix = '5_1' if species['stem'] == 'm357_unimon_main' and index == 5 else str(index)
            relative = Path('assets/sprites') / species['folder'] / f"{species['stem']}_{suffix}.gif"
            if suffix != str(index):
                overrides.append({'stem': species['stem'], 'index': index, 'path': str(relative)})
            path = root / relative
            try:
                with Image.open(path) as im:
                    dimensions = im.size
                    frames = im.n_frames
                    for frame in range(frames):
                        im.seek(frame)
                        im.load()  # Decode every frame; a valid header alone is insufficient.
                    total += 1
                    if frames == 1:
                        static.setdefault(species['name'], []).append(index)
                    if dimensions[0] > 256 or dimensions[1] > 256:
                        sizes.append({'path':str(relative),'size':dimensions})
            except (OSError, ValueError) as exc:
                errors.append({'path':str(relative),'error':str(exc)})
    return {'species_count':len(catalog),'checked_assets':total,'errors':errors,'asset_overrides':overrides,
            'single_frame_by_species':static, 'single_frame_count':sum(map(len, static.values())),'large_canvases':sizes,
            'semantic_status':'INFERRED: existing mapping is community-guessed; successful decoding does not verify action meaning.',
            'unverified_indices':[6,27,36,38,39]}

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    report=audit(ROOT)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['species_count','checked_assets','errors','unverified_indices']},ensure_ascii=False))
    print('Single-frame assets:',report['single_frame_count'],'Large canvases:',len(report['large_canvases']))
    raise SystemExit(bool(report['errors']))
