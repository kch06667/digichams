#!/usr/bin/env python3
"""Import the v0.23.2 visual farm skin from an explicitly supplied local ZIP.

Keeps latest game JS, movement avoidance, saves, ROM and sprite mappings intact.
Copies only one verified WebP, canonical farm CSS and two inlined style blocks.
The source ZIP and ROM are never copied into the repository.
"""
import argparse
import base64
from hashlib import sha256
from pathlib import Path
import re
import sys
import zipfile

CSS_FILE = "src/hex-farm.css"
ASSET_FILE = "assets/farm/hex_farm_v0232.webp"
MARKER = "/* v0.23.2 map visual skin (presentation only): independent of simulation code */"
EXPECTED_SHA256 = "67f92692d36b8cedae3db3abe6293c2e757799d57600acb6eac0eb96cc8ebccc"
HTML_FILES = ("index.html", "standalone.html")


def import_skin(root: Path, zip_path: Path):
    with zipfile.ZipFile(zip_path) as archive:
        art = archive.read(ASSET_FILE)
        css_from_zip = archive.read(CSS_FILE).decode("utf-8")
    if sha256(art).hexdigest() != EXPECTED_SHA256:
        raise ValueError("Unexpected farm image checksum: refusing incorrect graphic")
    if css_from_zip.count(MARKER) != 1:
        raise ValueError("v0.23.2 skin marker missing or duplicated")
    skin = css_from_zip[css_from_zip.index(MARKER):]
    if re.search(r"<\s*script\b|@import\b|javascript:", skin, re.I):
        raise ValueError("Unexpected executable markup in visual CSS")
    original = (root / CSS_FILE).read_text(encoding="utf-8")
    if original.count(MARKER) > 1:
        raise ValueError("Target CSS contains duplicate skin markers")
    base_css = original[:original.index(MARKER)].rstrip() if MARKER in original else original.rstrip()
    merged_css = base_css + "\n\n" + skin.rstrip() + "\n"
    output = {CSS_FILE: merged_css, ASSET_FILE: art}
    for name in HTML_FILES:
        html = (root / name).read_text(encoding="utf-8")
        pattern = re.compile(r'(<style id="hex-farm-style-v0143">)(.*?)(</style>)', re.S)
        matches = list(pattern.finditer(html))
        if len(matches) != 1 or not matches[0].group(2).lstrip().startswith("/* Progressive v0.14.3"):
            raise ValueError(f"{name}: unexpected or missing farm CSS block")
        inline = merged_css
        if name == "standalone.html":
            uri = "data:image/webp;base64," + base64.b64encode(art).decode("ascii")
            inline = inline.replace(ASSET_FILE, uri)
        m = matches[0]
        output[name] = html[:m.start(2)] + inline + html[m.end(2):]
    changes = []
    for name, content in output.items():
        target = root / name
        data = content.encode("utf-8") if isinstance(content, str) else content
        if target.is_file() and target.read_bytes() == data:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.with_name(target.name + ".v0232.tmp").write_bytes(data)
        changes.append(name)
    for name in changes:
        target = root / name
        target.with_name(target.name + ".v0232.tmp").replace(target)
    return changes, len(art)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", required=True, type=Path, help="Local v0.23.2 ZIP (not uploaded to GitHub)")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    try:
        changed, size = import_skin(args.root, args.zip)
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as exc:
        print("ERROR: " + str(exc), file=sys.stderr)
        raise SystemExit(2)
    print("Artwork:", size, "bytes. Modified:", ", ".join(changed) if changed else "nothing (up to date)")


if __name__ == "__main__":
    main()
