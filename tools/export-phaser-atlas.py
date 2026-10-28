#!/usr/bin/env python3
"""Convert *locally held* sprite GIFs to Phaser spritesheets.

Do not commit the resulting images. Input is provided private game art; generated
output remains local and is intentionally gitignored. No ROM unpacking here.
"""
import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "phaser-lab" / "local-assets"
DEFAULT_ACTIONS = (0, 2, 3, 5, 7, 10, 14, 28, 30, 31, 32, 33, 37)


def export(species, asset_root, output, actions=DEFAULT_ACTIONS):
    catalog = json.loads((asset_root / "sprite-index.json").read_text(encoding="utf-8"))
    item = catalog["game_species"].get(species)
    if not item:
        raise ValueError(f"unknown species: {species!r}. Check assets/sprite-index.json")
    folder, stem = item["folder"], item["stem"]
    # Only use explicitly indexed GIFs, do not take arbitrary filesystem paths.
    if not all(x and "/" not in x and "\\" not in x and ".." not in x
               for x in (folder, stem)):
        raise ValueError("unsafe sprite index path")
    files = []
    for action in actions:
        if not 0 <= action <= 39:
            raise ValueError(f"action out of range: {action}")
        path = asset_root / "sprites" / folder / f"{stem}_{action}.gif"
        if not path.is_file():
            raise FileNotFoundError(f"missing GIF: {path}")
        with Image.open(path) as gif:
            if gif.n_frames > 300:
                raise ValueError(f"too many GIF frames: {path}")
            frames, durations = [], []
            for j in range(gif.n_frames):
                gif.seek(j)
                frames.append(gif.convert("RGBA").copy())
                durations.append(max(20, int(gif.info.get("duration") or 100)))
            files.append((action, frames, durations))

    # Common canvas dimensions for all actions: prevent hit/victory scale jumps.
    width = max(img.width for _, frames, _ in files for img in frames)
    height = max(img.height for _, frames, _ in files for img in frames)
    if width > 512 or height > 512:
        raise ValueError("unexpectedly large input frame (>512px)")
    output.mkdir(parents=True, exist_ok=True)
    metadata = {}
    for action, frames, durations in files:
        filename = f"action_{action}.png"
        sheet = Image.new("RGBA", (width * len(frames), height))
        for i, frame in enumerate(frames):
            x = (width - frame.width) // 2
            y = height - frame.height  # Feet align across all poses.
            sheet.alpha_composite(frame, (i * width + x, y))
        sheet.save(output / filename, optimize=True)
        metadata[str(action)] = {
            "file": filename, "frameWidth": width, "frameHeight": height,
            "frames": len(frames), "durationsMs": durations
        }
    manifest = {
        "format": "digi-phaser-local-atlas-v1", "species": species,
        "source": "local indexed GIF files; never redistribute without authorization",
        "actions": metadata
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--species", default="아구몬", help="species key in assets/sprite-index.json")
    p.add_argument("--asset-root", type=Path, default=ROOT / "assets")
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    p.add_argument("--actions", default=",".join(map(str, DEFAULT_ACTIONS)))
    args = p.parse_args()
    actions = [int(x.strip()) for x in args.actions.split(",") if x.strip()]
    if not actions or len(set(actions)) != len(actions):
        p.error("supply distinct action numbers")
    result = export(args.species, args.asset_root, args.output, actions)
    print(f"created {len(result['actions'])} local sprite sheets for {args.species} in {args.output}")
    for action, data in result["actions"].items():
        print(f"  {action:>2}  {data['frames']} frames, "
              f"{data['frameWidth']}x{data['frameHeight']}, "
              f"{sum(data['durationsMs'])}ms")


if __name__ == "__main__":
    main()
