#!/usr/bin/env python3
"""Synchronize checked-in hunt JS into BOTH existing playable HTML bundles.

This is an intentionally narrow, fail-closed script replacement. It never
modifies the save key, user game-state data, graphics, or other embedded JS.
Run on private local checkout or via GitHub Actions; preserve git history.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import re
import sys

SOURCES=(
 ("hunt-v021-core","src/hunt-core.js",
  "/* Digimon World Championship inspired hunting simulation"),
 ("hunt-v021-ui","src/hunt-ui.js",
  "/* Pointer hunting UI"),
)

def sync(root:Path,check:bool=False):
 files={}
 for name in ("index.html","standalone.html"):
  original=(root/name).read_text(encoding="utf-8")
  revised=original
  for ident,path,header in SOURCES:
   script=(root/path).read_text(encoding="utf-8")
   if not script.lstrip().startswith(header):
    raise ValueError(f"{path}: unsafe or unexpected source header")
   pattern=re.compile(
    r'(<script\s+id=["\']'+re.escape(ident)+r'["\']>)(.*?)(</script>)',
    re.S|re.I)
   matches=list(pattern.finditer(revised))
   if len(matches)!=1:
    raise ValueError(f"{name}: expected exactly one {ident} script block")
   match=matches[0]
   if not match.group(2).lstrip().startswith(header):
    raise ValueError(f"{name}: unsafe existing {ident} script block")
   revised=revised[:match.start(2)]+"\n"+script+"\n"+revised[match.end(2):]
  if revised!=original:
   files[name]=revised
 if not check:
  for name,content in files.items():
   (root/name).write_text(content,encoding="utf-8")
 return list(files)

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument("--root",type=Path,default=Path(__file__).resolve().parents[1])
 p.add_argument("--check",action="store_true")
 args=p.parse_args()
 try: updated=sync(args.root,args.check)
 except (ValueError,OSError) as e:
  print("ERROR:",e,file=sys.stderr);return 2
 if args.check and updated:
  print("OUT OF SYNC:",", ".join(updated));return 1
 print("IN SYNC" if not updated else "Updated: "+", ".join(updated));return 0

if __name__=="__main__":
 raise SystemExit(main())
