#!/usr/bin/env python3
"""One-command PRIVATE local game start: local original GIF conversion + HTTP.

Run from a checkout:  py tools/play_local.py
No public uploads, ZIP, ROM extraction, save edits, or automatic game reset.
By default the HTTP server binds to 127.0.0.1; --lan requires explicit opt-in.
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
from urllib.parse import unquote, urlsplit

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/"assets"
LOCAL=ROOT/"phaser-lab"/"local-assets"
ACTIONS=(0,2,3,5,7,10,14,28,30,31,32,33,37)

# Local server must not accidentally serve the user's Git metadata, saves,
# ROM files, hidden secrets or source/test folders, especially with --lan.
# Game-facing assets/src/Phaser paths remain available.
DENIED_FOLDERS=frozenset({
    ".git",".github",".dev-generated","__pycache__","node_modules",
    "rom-private","rom-output","test-output","tools","tests","docs",
    "references","dist",
})
DENIED_EXTENSIONS=frozenset({
    ".nds",".sav",".srm",".srl",".zip",".7z",".rar",".py",".pyc",
    ".env",".key",".pem",
})


class GameFileHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path=unquote(urlsplit(self.path).path).replace("\\","/")
        parts=[item for item in path.split("/") if item]
        if any(item.startswith(".") or item.lower() in DENIED_FOLDERS or
               Path(item).suffix.lower() in DENIED_EXTENSIONS for item in parts):
            self.send_error(404,"File not available from local game server")
            return None
        return super().send_head()




def missing_art(entries, local_root=LOCAL):
    """List species with missing/incomplete local motion sheets in index order.

    Use ONLY the local catalog's indexed species folder, never arbitrary
    user-provided paths from the manifest. Existing valid atlases are left
    alone, so an interrupted conversion doesn't redo all 216 on PC.
    """
    if len(entries)!=216:
        raise ValueError("expected exactly 216 indexed Digimon")
    names=[entry["name"] for entry in entries]
    if len(set(names))!=216:
        raise ValueError("ambiguous local species names")
    local_root=Path(local_root)
    index=local_root/"catalog.json"
    if not index.is_file():
        return names
    try:
        source=json.loads(index.read_text(encoding="utf-8"))
    except (ValueError,OSError) as err:
        raise ValueError("Local sprite catalog is unreadable; inspect "
                         "phaser-lab/local-assets/catalog.json before retrying") from err
    if (not isinstance(source,dict) or
        source.get("format")!="digi-phaser-local-species-catalog-v1" or
        not isinstance(source.get("entries"),dict)):
        raise ValueError("Unrecognized local sprite catalog format; "
                         "existing private files were not overwritten")
    converted=source["entries"]
    missing=[]
    for entry in entries:
        name,stem=entry["name"],entry["stem"]
        if not re.fullmatch(r"m[A-Za-z0-9_-]+",stem):
            raise ValueError("Invalid indexed species stem: "+str(name))
        record=converted.get(name)
        if (not isinstance(record,dict) or
            record.get("folder")!="species/"+stem):
            missing.append(name)
            continue
        folder=local_root/"species"/stem
        try:
            manifest=json.loads((folder/"manifest.json").read_text(
                encoding="utf-8"))
            if (not isinstance(manifest,dict) or
                manifest.get("species")!=name or
                manifest.get("format")!="digi-phaser-local-atlas-v1"):
                missing.append(name)
                continue
            actions=manifest.get("actions")
            if not isinstance(actions,dict):
                missing.append(name)
                continue
            if any(
                not isinstance(actions.get(str(action)),dict) or
                actions[str(action)].get("file")!=f"action_{action}.png" or
                not (folder/f"action_{action}.png").is_file() or
                (folder/f"action_{action}.png").stat().st_size==0
                for action in ACTIONS):
                missing.append(name)
        except (ValueError,OSError,TypeError,KeyError,AttributeError):
            missing.append(name)
    return missing


def catalog_ready(entries, local_root=LOCAL):
    """Backward-compatible all-species readiness check (read-only)."""
    try:
        return not missing_art(entries,local_root)
    except (ValueError,OSError,KeyError,TypeError):
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
    needs=missing_art(entries)
    if not needs:
        print("Original 216-species Phaser sprites: ready, reusing all files.")
        return
    print(f"Preparing only {len(needs)} missing/incomplete Digimon "
          f"of 216 × {len(ACTIONS)} battle motions locally.",flush=True)
    module.export_roster(asset_root=ASSETS,output_root=LOCAL,species=needs,
                         actions=ACTIONS)
    remaining=missing_art(entries)
    if remaining:
        raise RuntimeError(f"Sprite conversion incomplete: {len(remaining)} "
                           "species still need repair. No files were uploaded.")
    print("Original 216-species sprite catalog ready. Unchanged sheets reused.")


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port",type=int,default=8000)
    parser.add_argument("--skip-art",action="store_true",
                        help="start without private sprite conversion (placeholders possible)")
    parser.add_argument("--no-browser",action="store_true",help="do not open browser")
    parser.add_argument("--lan",action="store_true",
                        help="explicitly share playable files/art on your trusted Wi-Fi (no authentication)")
    args=parser.parse_args(argv)
    if not 1<=args.port<=65535:
        parser.error("port must be 1..65535")
    try:
        prepare_art(args.skip_art)
    except (OSError,ValueError,RuntimeError) as err:
        parser.exit(1,"Could not prepare playable art: "+str(err)+"\n")
    handler=functools.partial(GameFileHandler,directory=str(ROOT))
    try:
        server=http.server.ThreadingHTTPServer(("0.0.0.0" if args.lan else "127.0.0.1",args.port),handler)
    except OSError as err:
        parser.exit(1,f"Could not bind localhost:{args.port}: {err}\n")
    url=f"http://127.0.0.1:{server.server_port}/index.html"
    print("Play the original PC game (Phaser battle default): "+url,flush=True)
    if args.lan:
        print("WARNING: --lan exposes original graphics to devices on your network; trusted Wi-Fi only.",flush=True)
        print("On your phone, use http://<PC-LAN-IP>:"+str(args.port)+"/index.html (different browser saves).",flush=True)
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
