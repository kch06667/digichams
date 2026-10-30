#!/usr/bin/env python3
"""Keep Unimon's original action-5 GIF consistent in both playable HTMLs.

The source sprite pack contains m357_unimon_main_5_1.gif (not _5.gif).
Earlier builders substituted action 4 in BOTH index.html (path) and
standalone.html (embedded base64), while the Phaser atlas loader used 5_1.
No new art, ROM edits, species, or animation meaning is introduced.

Run without --check to repair the two source HTML files, or --check in CI.
"""
from __future__ import annotations
import argparse
import base64
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
STEM = "m357_unimon_main"
FROM = "item.stem==='m357_unimon_main'&&ix===5?4:ix"
TO = "item.stem==='m357_unimon_main'&&ix===5?'5_1':ix"
ENTRY = re.compile(r'("m357_unimon_main":\[)(.*?)\]', re.S)
GIF = re.compile(r'"(R0lGOD[A-Za-z0-9+/=]+)"')


def verify(root: Path) -> list[str]:
    source = root / "assets/sprites/champion/m357_unimon_main_5_1.gif"
    true_gif = source.read_bytes()
    if len(true_gif) < 32 or true_gif[:6] not in (b"GIF87a", b"GIF89a"):
        raise ValueError("original Unimon action 5_1 GIF is missing or corrupt")
    correct_b64 = base64.b64encode(true_gif).decode("ascii")

    index_path = root / "index.html"
    standalone_path = root / "standalone.html"
    index = index_path.read_text(encoding="utf-8")
    standalone = standalone_path.read_text(encoding="utf-8")

    if index.count(FROM) + index.count(TO) != 1:
        raise ValueError("unknown canonical index.html spriteUrl expression")
    next_index = index.replace(FROM, TO)

    matches = list(ENTRY.finditer(standalone))
    if len(matches) != 1:
        raise ValueError("expected exactly one original Unimon standalone sprite array")
    block = matches[0].group(2)
    gifs = list(GIF.finditer(block))
    if len(gifs) != 40:
        raise ValueError(f"expected 40 Unimon embedded GIF poses, found {len(gifs)}")
    if not all(base64.b64decode(g.group(1), validate=True).startswith((b"GIF87a", b"GIF89a"))
               for g in gifs):
        raise ValueError("corrupted embedded Unimon original pose data")
    action5 = gifs[5]
    next_block = block[:action5.start(1)] + correct_b64 + block[action5.end(1):]
    next_standalone = standalone[:matches[0].start(2)] + next_block + standalone[matches[0].end(2):]

    changed = []
    if next_index != index:
        changed.append("index.html")
    if next_standalone != standalone:
        changed.append("standalone.html")
    return changed, {index_path: next_index, standalone_path: next_standalone}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        changed, updated = verify(args.root)
    except (OSError, ValueError) as error:
        print("ERROR:", error, file=sys.stderr)
        return 2
    if args.check and changed:
        print("OUT OF SYNC:", ", ".join(changed))
        return 1
    if not args.check:
        for path, data in updated.items():
            if path.name in changed:
                path.write_text(data, encoding="utf-8")
    print("IN SYNC" if not changed else "UPDATED "+", ".join(changed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
