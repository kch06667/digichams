#!/usr/bin/env python3
"""Convert indexed Digimon GIFs for private, lazy Phaser loading.

Examples:
  py tools/export-phaser-roster.py --all
  py tools/export-phaser-roster.py --all --all-actions
  py tools/export-phaser-roster.py --species 아구몬 --species 가부몬
  py tools/export-phaser-roster.py --all --verify-only

Only LOCAL, explicitly indexed GIF files are read. The images, manifests and
catalog are written under phaser-lab/local-assets (Git-ignored); never commit
or publish that directory. The Phaser browser downloads a species only when
it actually enters the match, not all 216 sheets at startup.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "phaser-lab" / "local-assets"
CATALOG_FORMAT = "digi-phaser-local-species-catalog-v1"
spec = importlib.util.spec_from_file_location("digi_private_atlas",
                                                ROOT / "tools" / "export-phaser-atlas.py")
atlas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(atlas)


def source_entries(asset_root):
    file = Path(asset_root) / "species-catalog.json"
    data = json.loads(file.read_text(encoding="utf-8"))
    items = data["entries"]
    if not isinstance(items, list) or len(items) != 216:
        raise ValueError("expected exactly 216 indexed Digimon species")
    names = [x["name"] for x in items]
    stems = [x["stem"] for x in items]
    if len(set(names)) != 216 or len(set(stems)) != 216:
        raise ValueError("ambiguous or duplicate Digimon species")
    for item in items:
        if not isinstance(item["name"], str) or not item["name"] or not isinstance(item["stem"], str):
            raise ValueError("invalid Digimon record")
        folder, stem = atlas.resolve_species(item["name"], Path(asset_root))
        if stem != item["stem"] or folder != item["folder"] or not stem.startswith("m") or not all(
            c.isascii() and (c.isalnum() or c in "_-") for c in stem
        ):
            raise ValueError("unsafe or inconsistent species entry")
    return items


def gif_path(asset_root, item, action):
    # The Unimon action-5_1 GIF is the existing ROM-compared replacement.
    stem = item["stem"]
    suffix = "5_1" if stem == "m357_unimon_main" and action == 5 else str(action)
    return Path(asset_root) / "sprites" / item["folder"] / f"{stem}_{suffix}.gif"


def export_roster(asset_root=ROOT / "assets", output_root=OUTPUT,
                  species=None, actions=None, verify_only=False):
    asset_root, output_root = Path(asset_root), Path(output_root)
    all_entries = source_entries(asset_root)
    names = {entry["name"] for entry in all_entries}
    requested = set(species) if species else names
    if not requested or not requested <= names:
        raise ValueError(f"unknown species: {sorted(requested-names)}")
    actions = tuple(atlas.DEFAULT_ACTIONS if actions is None else actions)
    if not actions or any(not isinstance(i, int) or i < 0 or i > 39 for i in actions) or (
        len(actions) != len(set(actions))
    ):
        raise ValueError("actions must be unique slots in 0..39")
    selected = [entry for entry in all_entries if entry["name"] in requested]

    # Check all source images before writing ANY output or changing the catalog.
    absent = [(item["name"], action) for item in selected for action in actions
              if not gif_path(asset_root, item, action).is_file()]
    if absent:
        raise FileNotFoundError(f"missing indexed GIFs (first 5): {absent[:5]}")
    if verify_only:
        return {"species": len(selected), "actions": len(selected)*len(actions),
                "entries": {entry["name"]: {
                    "folder": "species/" + entry["stem"],
                    "actions": len(actions)
                } for entry in selected}}

    index_path = output_root / "catalog.json"
    prior = {}
    if index_path.is_file():
        existing = json.loads(index_path.read_text(encoding="utf-8"))
        if existing.get("format") != CATALOG_FORMAT or not isinstance(existing.get("entries"), dict):
            raise ValueError("unrecognized existing local species catalog")
        prior = existing["entries"]
        if any(name not in names or not isinstance(record, dict) or
               record.get("folder") != "species/" + next(item["stem"] for item in all_entries if item["name"] == name)
               for name, record in prior.items()):
            raise ValueError("unsafe existing species catalog")
    converted = {}
    for number, item in enumerate(selected, 1):
        name, stem = item["name"], item["stem"]
        folder = "species/" + stem
        manifest = atlas.export(name, asset_root, output_root / folder, actions)
        converted[name] = {"folder": folder, "actions": len(manifest["actions"])}
        print(f"[{number}/{len(selected)}] {name}: {len(actions)} actions", flush=True)
    result = {"format": CATALOG_FORMAT, "entries": {**prior, **converted}}
    output_root.mkdir(parents=True, exist_ok=True)
    temporary = index_path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")
    os.replace(temporary, index_path)
    return {"species": len(selected), "actions": len(selected)*len(actions),
            "entries": converted, "total": len(result["entries"])}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--all", action="store_true", help="export all 216 Digimon")
    p.add_argument("--species", action="append", help="species name, repeat for multiple names")
    p.add_argument("--all-actions", action="store_true",
                   help="all 40 motions per Digimon (large files, slower)")
    p.add_argument("--verify-only", action="store_true",
                   help="verify all indexed GIFs without creating any output")
    p.add_argument("--asset-root", type=Path, default=ROOT / "assets")
    p.add_argument("--output-root", type=Path, default=OUTPUT)
    args = p.parse_args()
    if args.all == bool(args.species):
        p.error("choose exactly one of --all or --species NAME")
    result = export_roster(args.asset_root, args.output_root, args.species,
                           range(40) if args.all_actions else None, args.verify_only)
    print(f"Ready: {result['species']} species / {result['actions']} motions; "
          "all artwork remains on your PC, excluded from the GitHub repository.")


if __name__ == "__main__":
    main()
