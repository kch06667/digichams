#!/usr/bin/env python3
"""Safely install/check Phaser's real-game default entry in BOTH original HTMLs.

Only append the tagged five-script group immediately before </body>. Do not
rewrite gameplay scripts, private graphics, current save formats or other art.
--check is read-only and fails closed when any block/anchor differs.
"""
import argparse
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FILES=("index.html","standalone.html")
START="<!-- DC-PHASER-PRODUCTION-BEGIN -->"
END="<!-- DC-PHASER-PRODUCTION-END -->"
SCRIPTS=(
    "src/battle-settlement-core.js",
    "src/battle-commit-core.js",
    "src/dev-phaser-commit.js",
    "src/dev-phaser-farm-launch.js",
    "src/phaser-arena-entry-choice.js",
)
BLOCK=START+"\n"+"\n".join(
    '<script defer src="'+script+'" data-phaser-production="1"></script>'
    for script in SCRIPTS
)+"\n"+END


def expected(content, filename):
    if content.count("</body>")!=1 or content.count(
            'id="lbStart"')!=1 or content.count(
            'window.DCBattleArena={launchTournament(')!=1:
        raise ValueError(f"{filename}: original combat anchors changed")
    before=content.count(START)
    after=content.count(END)
    if (before,after)==(0,0):
        return content.replace("</body>",BLOCK+"\n</body>")
    if before!=1 or after!=1 or content.count(BLOCK)!=1:
        raise ValueError(f"{filename}: malformed Phaser production block")
    return content


def main():
    cli=argparse.ArgumentParser()
    group=cli.add_mutually_exclusive_group(required=True)
    group.add_argument("--check",action="store_true")
    group.add_argument("--write",action="store_true")
    args=cli.parse_args()
    for name in FILES:
        file=ROOT/name
        old=file.read_text(encoding="utf-8")
        new=expected(old,name)
        if args.check:
            if old.count(BLOCK)!=1:
                raise SystemExit(f"{name}: Phaser production entry is not synced")
            print(f"OK {name}: exact five-script Phaser default entry")
        elif new!=old:
            file.write_text(new,encoding="utf-8")
            print(f"ADDED {name}: production Phaser entry")
        else:
            print(f"UNCHANGED {name}")


if __name__=="__main__":
    main()
