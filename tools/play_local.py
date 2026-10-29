#!/usr/bin/env python3
"""One-command PRIVATE local game start: local original GIF conversion + HTTP.

Run from a checkout:  py tools/play_local.py
No public uploads, ZIP, ROM extraction, save edits, or automatic game reset.
The HTTP server binds to 127.0.0.1 only.
"""
import argparse
import functools
import http.server
import importlib.util
import json
import re
import sys
import webbrowser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/"assets"
LOCAL=ROOT/"phaser-lab"/"local-assets"
ACTIONS=(0,2,3,5,7,10,14,28,30,31,32,33,37)


def catalog_ready(entries, local_root=LOCAL):
    """Check every needed local Phaser sheet, not just catalog existence."""
    index=Path(local_root)/"catalog.json"
    if not index.is_file() or len(entries)!=216:
        return False
    try:
        source=json.loads(index.read_text(encoding="utf-8"))
        converted=source["entries"]
        if source.get("format")!="digi-phaser-local-species-catalog-v1":
            return False
        for entry in entries:
            name,stem=entry["name"],entry["stem"]
            if not re.fullmatch(r"m[A-Za-z0-9_-]+",stem):
                return False
            record=converted.get(name)
            if not isinstance(record,dict) or record.get("folder")!="species/"+stem:
                return False
            folder=Path(local_root)/"species"/stem
            manifest=json.loads((folder/"manifest.json").read_text(encoding="utf-8"))
            if manifest.get("species")!=name:
                return False
            actions=manifest.get("actions")
            if not isinstance(actions,dict) or any(
                not isinstance(actions.get(str(action)),dict) or
                actions[str(action)].get("file")!=f"action_{action}.png" or
                not (folder/f"action_{action}.png").is_file()
                for action in ACTIONS):
                return False
        return True
    except (ValueError,KeyError,TypeError,OSError,AttributeError):
        return False


def prepare_art(skip=False):
    if skip:
        print("Private sprite conversion skipped (--skip-art).")
        return
    if not (ASSETS/"species-catalog.json").is_file():
        raise RuntimeError("assets/species-catalog.json is missing: restore your local project art first.")
    try:
        spec=importlib.util.spec_from_file_location(
            "digichamps_playable_export",ROOT/"tools"/"export-phaser-roster.py")
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        entries=module.source_entries(ASSETS)
    except ModuleNotFoundError as err:
        if err.name=="PIL":
            raise RuntimeError("Pillow is required: py -m pip install Pillow") from err
        raise
    if catalog_ready(entries):
        print("Original 216-species Phaser sprites: already prepared, reusing files.")
        return
    print("Preparing 216 Digimon × 13 battle motions locally (one-time).",flush=True)
    module.export_roster(asset_root=ASSETS,output_root=LOCAL)
    if not catalog_ready(entries):
        raise RuntimeError("Sprite conversion incomplete; local files were left for inspection.")
    print("Original 216-species sprite conversion ready. No graphics uploaded.")


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port",type=int,default=8000)
    parser.add_argument("--skip-art",action="store_true",
                        help="start without private sprite conversion (placeholders possible)")
    parser.add_argument("--no-browser",action="store_true",help="do not open browser")
    args=parser.parse_args(argv)
    if not 1<=args.port<=65535:
        parser.error("port must be 1..65535")
    try:
        prepare_art(args.skip_art)
    except (OSError,ValueError,RuntimeError) as err:
        parser.exit(1,"Could not prepare playable art: "+str(err)+"\n")
    handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT))
    try:
        server=http.server.ThreadingHTTPServer(("127.0.0.1",args.port),handler)
    except OSError as err:
        parser.exit(1,f"Could not bind localhost:{args.port}: {err}\n")
    url=f"http://127.0.0.1:{server.server_port}/index.html"
    print("Play the original PC game (Phaser battle default): "+url,flush=True)
    print("Ctrl+C to stop. Your saves remain in the browser's localStorage.",flush=True)
    try:
        if not args.no_browser:
            webbrowser.open(url)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nLocal game server closed.")
    finally:
        server.server_close()


if __name__=="__main__":
    main()
