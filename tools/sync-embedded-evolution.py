#!/usr/bin/env python3
"""Sync read-only evolution diagnostics into the original two playable HTMLs.

Safely updates ONE existing embedded original evolution-core script, then adds
one small UI/style extension at the end of each game. No ROM/sprite handling.
"""
import argparse
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
CORE_START = '/* Digimon World Championship reproduction, data-backed evolution framework.'
CORE_END = "root.DCEvolution=api;\n})(typeof globalThis!=='undefined'?globalThis:this);"
STYLE_ID = 'evolution-guide-style-v1'
UI_ID = 'evolution-guide-ui-v1'


def sync(root=ROOT, check=False):
    core = (root/'src/evolution-core.js').read_text(encoding='utf-8')
    css = (root/'src/evolution-goal-style.css').read_text(encoding='utf-8')
    ui = (root/'src/evolution-goal-ui.js').read_text(encoding='utf-8')
    if not core.startswith(CORE_START) or CORE_END not in core:
        raise ValueError('unexpected evolution module boundaries')
    if not ui.startswith('/* Evolution 477-route diagnostics'):
        raise ValueError('unexpected UI script')
    if not css.startswith('/* Read-only evolution route diagnostics'):
        raise ValueError('unexpected CSS source')
    updated = {}
    for name in ('index.html', 'standalone.html'):
        original = (root/name).read_text(encoding='utf-8')
        revised = original
        if revised.count(CORE_START) != 1:
            raise ValueError(f'{name}: original evolution script was not unique')
        start = revised.index(CORE_START)
        opening = revised.rfind('<script', 0, start)
        opener_end = revised.find('>', opening)
        closing = revised.find('</script>', start)
        if opening < 0 or opener_end < 0 or closing < 0:
            raise ValueError(f'{name}: missing original evolution tags')
        if revised[opener_end+1:start].strip():
            raise ValueError(f'{name}: evolution source is not at the start of its script')
        old = revised[start:closing].rstrip()
        if CORE_END not in old or not old.endswith(CORE_END):
            raise ValueError(f'{name}: unexpected evolution source end')
        revised = revised[:start]+core.rstrip()+'\n'+revised[closing:]
        # Replace known extensions in place; the file must have 0 or 1 of each.
        for ident, tag, payload in [
            (STYLE_ID, 'style', css), (UI_ID, 'script', ui)
        ]:
            pat = re.compile(r'<'+tag+r' id="'+re.escape(ident)+r'">.*?</'+tag+r'>', re.S)
            matches = list(pat.finditer(revised))
            if len(matches) > 1:
                raise ValueError(f'{name}: duplicate {ident}')
            replacement = f'<{tag} id="{ident}">\n{payload.rstrip()}\n</{tag}>'
            if matches:
                m = matches[0]
                revised = revised[:m.start()]+replacement+revised[m.end():]
            else:
                end = revised.rfind('</body>')
                if end < 0 or revised.count('</body>') != 1:
                    raise ValueError(f'{name}: invalid document tail')
                revised = revised[:end]+replacement+'\n'+revised[end:]
        if revised != original:
            updated[name] = revised
    if not check:
        for name, data in updated.items():
            (root/name).write_text(data, encoding='utf-8')
    return list(updated)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        changed = sync(args.root, args.check)
    except (ValueError, OSError) as exc:
        print('ERROR:', exc, file=sys.stderr)
        return 2
    if args.check and changed:
        print('OUT OF SYNC:', ', '.join(changed))
        return 1
    print('IN SYNC' if not changed else 'Updated: '+', '.join(changed))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
