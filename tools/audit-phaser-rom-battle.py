#!/usr/bin/env python3
"""Audit existing *private* Digimon battle GIFs and ROM overlay effect names.

No ROM/sprite bytes are written, uploaded or committed. All 216x40 indexed
GIF frames and durations are inspected, including Unimon's corrected action 5.
ROM is optional: --rom verifies the 151 overlay-19 pointer strings against the
user's local Korean NDS, but CANNOT infer a species/technique -> effect ID map.

  py tools/audit-phaser-rom-battle.py
  py tools/audit-phaser-rom-battle.py --rom "디지몬 챔피언쉽(K).nds"
"""
import argparse
import hashlib
import importlib.util
import io
import json
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
IDX=ROOT/"ROM_effect_pointer_registry.json"
spec=importlib.util.spec_from_file_location("phaser_atlas",
                                             ROOT/"tools"/"export-phaser-atlas.py")
atlas=importlib.util.module_from_spec(spec)
spec.loader.exec_module(atlas)

# The positions below are USER-CONFIRMED (30 and 32), or current game's
# suggested map (all others); the ROM image table has NO action-name labels.
USER_CONFIRMED={30: "victory", 32: "training"}
EXISTING_CANDIDATES={0:"idle",2:"walk",3:"run",5:"hit",
                     7:"attack",8:"attack",9:"attack",10:"attack",
                     31:"guard",33:"shout",37:"ko"}

def inspect_gifs(asset_root):
    asset_root=Path(asset_root)
    entries=json.loads((asset_root/"species-catalog.json").read_text(encoding="utf-8"))["entries"]
    if len(entries)!=216 or len({e["name"] for e in entries})!=216:
        raise ValueError("expected 216 unique Digimon species")
    audit={str(i):{"files":0,"animated":0,"frames":0,"short10msFrames":0,
                   "minDurationMs":None,"maxDurationMs":None} for i in range(40)}
    short=[]
    for item in entries:
        folder,stem=atlas.resolve_species(item["name"],asset_root)
        for action in range(40):
            suffix="5_1" if stem=="m357_unimon_main" and action==5 else str(action)
            file=asset_root/"sprites"/folder/f"{stem}_{suffix}.gif"
            if not file.is_file():
                raise FileNotFoundError(str(file))
            with Image.open(file) as gif:
                if gif.n_frames>300:
                    raise ValueError("too many frames: "+str(file))
                stat=audit[str(action)]
                stat["files"]+=1
                stat["frames"]+=gif.n_frames
                stat["animated"]+=int(gif.n_frames>1)
                for f in range(gif.n_frames):
                    gif.seek(f)
                    duration=gif.info.get("duration")
                    if not isinstance(duration,(int,float)) or duration<10:
                        raise ValueError(f"missing/invalid GIF delay: {file} frame {f}")
                    duration=int(duration)
                    stat["minDurationMs"]=duration if stat["minDurationMs"] is None else min(
                        stat["minDurationMs"],duration)
                    stat["maxDurationMs"]=duration if stat["maxDurationMs"] is None else max(
                        stat["maxDurationMs"],duration)
                    if duration==10:
                        stat["short10msFrames"]+=1
                        short.append((item["name"],action,f))
    total_frames=sum(item["frames"] for item in audit.values())
    return {"species":len(entries),"gifFiles":sum(s["files"] for s in audit.values()),
      "frames":total_frames,"animatedGifFiles":sum(s["animated"] for s in audit.values()),
      "tenMsFrames":len(short),"sourceActionSlots":40,
      "userConfirmed":USER_CONFIRMED,
      "unverifiedActionCandidates":EXISTING_CANDIDATES,
      "byAction":audit}


def verify_rom_registry(rom, registry):
    """151 name-table slots can be verified; gameplay mapping cannot."""
    content=bytes(rom)
    if hashlib.sha256(content).hexdigest()!=registry["rom_sha256"]:
        raise ValueError("Wrong ROM SHA-256. Only the documented Korean ROM is supported.")
    start=int(registry["rom_offset"],0)
    ram=int(registry["load_ram"],0)
    table=int(registry["table_overlay_offset"],0)
    entries=registry["entries"]
    if len(entries)!=151 or registry["named_effect_entries"]!=151:
        raise ValueError("Unexpected overlay registry length")
    for slot,item in enumerate(entries,1):
        if item["effect_index"]!=slot or int(item["table_offset"],0)!=table+(slot-1)*4:
            raise ValueError("Effect pointer slot mismatch: "+str(slot))
        offset=start+table+(slot-1)*4
        if offset+4>len(content):raise ValueError("Pointer table exceeds ROM")
        ptr=int.from_bytes(content[offset:offset+4],"little")
        if ptr!=int(item["name_pointer"],0):
            raise ValueError("Unexpected pointer for effect "+str(slot))
        loc=start+ptr-ram
        if loc<start or loc+40>len(content):
            raise ValueError("Effect string pointer outside local ROM")
        name=content[loc:loc+40].split(b"\x00",1)[0].decode("ascii")
        if name!=item["name"]:
            raise ValueError("Unexpected name for effect "+str(slot))
    return {"sha256Matched":True,"verifiedNamePointers":len(entries),
            "techniqueToEffectMappingVerified":False}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--asset-root",type=Path,default=ROOT/"assets")
    p.add_argument("--registry",type=Path,default=IDX)
    p.add_argument("--rom",type=Path,default=None)
    args=p.parse_args()
    result=inspect_gifs(args.asset_root)
    if args.rom:
        registry=json.loads(args.registry.read_text(encoding="utf-8"))
        result["romOverlay19"]=verify_rom_registry(args.rom.read_bytes(),registry)
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
