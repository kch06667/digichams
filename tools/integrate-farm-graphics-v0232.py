#!/usr/bin/env python3
"""Import ONLY v0.23.2 farm CSS/WebP from a user-supplied ZIP into current GitHub source.
No ROM, JavaScript, save data or other files are copied.
"""
import argparse
import base64
from pathlib import Path
import sys
import tempfile
import zipfile

MARKER = '/* v0.23.2 map visual skin (presentation only): independent of simulation code */'
IMAGE_PATH = 'assets/farm/hex_farm_v0232.webp'

def find_unique(z, suffix):
    paths = [n for n in z.namelist() if n == suffix or n.endswith('/' + suffix)]
    if len(paths) != 1:
        raise ValueError('Expected one archive entry ending in ' + suffix)
    return z.read(paths[0])

def prepare(root, archive):
    root = Path(root)
    with zipfile.ZipFile(archive) as z:
        art = find_unique(z, IMAGE_PATH)
        style = find_unique(z, 'src/hex-farm.css').decode('utf-8')
    if len(art) > 2_000_000 or art[:4] != b'RIFF' or art[8:12] != b'WEBP':
        raise ValueError('Invalid v0.23.2 WebP file')
    if style.count(MARKER) != 1:
        raise ValueError('Archive does not contain the expected graphics patch')
    skin = style[style.index(MARKER):].rstrip() + '\n'
    if 'background-image:url("' + IMAGE_PATH + '")' not in skin:
        raise ValueError('Archive skin references unexpected image')
    css_path = root / 'src/hex-farm.css'
    css = css_path.read_text(encoding='utf-8')
    if MARKER in css:
        raise ValueError('Already integrated; refusing duplicate patch')
    if not css.startswith('/* Progressive v0.14.3 override'):
        raise ValueError('Unknown farm stylesheet; refusing integration')
    updates = {css_path: css.rstrip() + '\n\n' + skin}
    for name in ['index.html', 'standalone.html']:
        path = root / name
        html = path.read_text(encoding='utf-8')
        if MARKER in html:
            raise ValueError(name + ' already includes the patch')
        if html.count(css) != 1:
            raise ValueError(name + ' inline CSS differs from src/hex-farm.css; abort without writing')
        addition = skin
        if name == 'standalone.html':
            addition = skin.replace(IMAGE_PATH, 'data:image/webp;base64,' + base64.b64encode(art).decode('ascii'))
        updates[path] = html.replace(css, css.rstrip() + '\n\n' + addition, 1)
    image_path = root / IMAGE_PATH
    if image_path.exists() and image_path.read_bytes() != art:
        raise ValueError('Existing farm art differs; refusing overwrite')
    return updates, image_path, art

def apply(root, archive, dry_run=False):
    updates, image_path, art = prepare(root, archive)
    changed = [str(path) for path in updates] + [str(image_path)]
    if dry_run:
        return changed
    # Validate all inputs before writing any output.
    for path, contents in updates.items():
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent, delete=False) as f:
            f.write(contents)
            tmp = Path(f.name)
        tmp.replace(path)
    image_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('wb', dir=image_path.parent, delete=False) as f:
        f.write(art)
        tmp = Path(f.name)
    tmp.replace(image_path)
    return changed

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip', type=Path, required=True)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    try:
        print('\n'.join(apply(args.root, args.zip, args.dry_run)))
        print('Only visual CSS/WebP changed; verify node + browser regressions before merging.')
    except (OSError, ValueError, zipfile.BadZipFile) as e:
        sys.exit('Graphics integration blocked: ' + str(e))
