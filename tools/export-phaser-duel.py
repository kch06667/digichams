#!/usr/bin/env python3
"""Private, on-device Agumon vs Gabumon Phaser spritesheet conversion.

Run from a local checkout with its existing indexed GIF files. Files under
phaser-lab/local-assets are PRIVATE build outputs, never gittracked/deployed.
No ROM extraction, network requests or image assets committed by this tool.
"""
import argparse
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "phaser-lab" / "local-assets"
DUEL = (("아구몬", "duel-agumon"), ("가부몬", "duel-gabumon"))

module_spec = importlib.util.spec_from_file_location(
    "digi_private_atlas", ROOT / "tools" / "export-phaser-atlas.py"
)
atlas = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(atlas)


def export_duel(asset_root=ROOT / "assets", output_root=DEFAULT_OUTPUT):
    output_root = Path(output_root)
    if output_root.exists() and not output_root.is_dir():
        raise ValueError("duel output root must be a directory")
    results = []
    for species, folder in DUEL:
        # Single-species atlas exporter preserves GIF frames, source frame
        # durations, species identity and normalised canvas dimensions.
        manifest = atlas.export(species, Path(asset_root),
                                output_root / folder)
        if manifest["species"] != species:
            raise ValueError("mismatched sprite species")
        results.append((species, folder, len(manifest["actions"])))
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset-root", type=Path, default=ROOT / "assets")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    result = export_duel(args.asset_root, args.output_root)
    for species, folder, actions in result:
        print(f"{species}: {actions} local animations → {args.output_root / folder}")
    print("Private duel art is ready. Start a local web server, visit "
          "/phaser-lab/ and click '아구몬 vs 가부몬 1대1'. "
          "Do not publish the local-assets directory.")


if __name__ == "__main__":
    main()
