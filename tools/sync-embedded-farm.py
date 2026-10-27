#!/usr/bin/env python3
"""Sync canonical farm JS/CSS into the two HTML entry pages without modifying game state.

Use --check in CI to reject stale bundled sources. This only replaces explicit
farm script/style ID blocks, never the legacy game, sprites or save data.
"""
from __future__ import annotations
import argparse
import base64
from pathlib import Path
import re
import sys

SLOTS = {
    'js': ('script', 'hex-farm-v0143', Path('src/hex-farm-ui.js')),
    'css': ('style', 'hex-farm-style-v0143', Path('src/hex-farm.css')),
}
ASSET_PATH = 'assets/farm/hex_farm_v0232.webp'


def sync(root: Path, check: bool = False) -> list[str]:
    canonical = {key: (root / source).read_text(encoding='utf-8')
                 for key, (_, _, source) in SLOTS.items()}
    modified = []
    replacements = {}
    # Verify both HTML files completely before writing either one.
    for name in ('index.html', 'standalone.html'):
        source = (root / name).read_text(encoding='utf-8')
        revised = source
        for key, (element, ident, _) in SLOTS.items():
            pattern = re.compile(r'(<%s\s+id=["\x27]%s["\x27]>)(.*?)(</%s>)' % (element, re.escape(ident), element), re.S | re.I)
            matches = list(pattern.finditer(revised))
            if len(matches) != 1:
                raise ValueError(f'{name}: expected exactly one {ident} block; found {len(matches)}')
            old = matches[0].group(2)
            if key == 'js' and not old.lstrip().startswith('/* v0.15.1 hex farm UI'):
                raise ValueError(f'{name}: unexpected farm JS block content')
            if key == 'css' and not old.lstrip().startswith('/* Progressive v0.14.3'):
                raise ValueError(f'{name}: unexpected farm CSS block content')
            value = canonical[key]
            if key == 'css' and name == 'standalone.html' and ASSET_PATH in value:
                asset = root / ASSET_PATH
                if not asset.is_file():
                    raise ValueError(f'{name}: standalone asset not found: {asset}')
                uri = 'data:image/webp;base64,' + base64.b64encode(asset.read_bytes()).decode('ascii')
                value = value.replace(ASSET_PATH, uri)
            revised = revised[:matches[0].start(2)] + value + revised[matches[0].end(2):]
        if source != revised:
            modified.append(name)
            replacements[name] = revised
    if not check:
        for name, value in replacements.items():
            (root / name).write_text(value, encoding='utf-8')
    return modified


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--check', action='store_true', help='fail if bundles are out of sync, no writes')
    args = parser.parse_args()
    try:
        modified = sync(args.root, args.check)
    except (ValueError, OSError) as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        return 2
    if args.check and modified:
        print('OUT OF SYNC:', ', '.join(modified))
        return 1
    print('IN SYNC' if not modified else ('Updated: ' + ', '.join(modified)))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
