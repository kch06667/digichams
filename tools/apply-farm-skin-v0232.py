#!/usr/bin/env python3
"""Apply a presentation-only farm skin to both HTML builds. Keeps all JS untouched."""
from pathlib import Path
import base64,hashlib,json
root=Path(__file__).resolve().parents[1]
css=root/'src'/'hex-farm.css'
photo=root/'assets'/'farm'/'hex_farm_v0232.webp'
assert photo.exists()
start='/* v0.23.2 map visual skin (presentation only): independent of simulation code */'
assert start not in css.read_text(), 'Already applied'
new=r'''
/* v0.23.2 map visual skin (presentation only): independent of simulation code */
#farmPanel .farmIntro h2{color:#d7fbff;text-shadow:0 0 13px #35bcfb58;letter-spacing:.025em;}
#farmPanel .farmScrollFrame{border:1px solid #4da4c5;border-radius:13px;overflow:hidden;box-shadow:0 7px 28px #0008,0 0 0 1px #193954 inset;}
#farmPanel .farmViewport{background:#082438;scrollbar-color:#80d9eb #163750;}
#farmPanel .farmWorld{
  background-color:#09283f;
  background-image:url("assets/farm/hex_farm_v0232.webp");
  background-size:920px 690px;
  background-position:center center;
  background-repeat:no-repeat;
}
#farmPanel .hexTile{
 background:transparent!important;
 border:0!important;
 opacity:1;
 filter:none;
 transition:filter .16s ease;
}
#farmPanel .hexTile.locked{background:rgba(1,15,31,.26)!important;opacity:1;}
#farmPanel .hexTile.core{background:transparent!important;}
#farmPanel .hexTile:hover{filter:brightness(1.18) drop-shadow(0 0 6px #52dafa);}
#farmPanel .hexTile.selected{filter:drop-shadow(0 0 10px #65f9ff);}
#farmPanel .hexTile .hexInner{
 width:97%;height:97%;background:transparent;
 border:2px solid transparent;
 display:flex;flex-direction:column;justify-content:flex-end;align-items:center;
 gap:2px;padding:4px 8px 17px;
 clip-path:inherit;
}
#farmPanel .hexTile:hover .hexInner,
#farmPanel .hexTile:focus-visible .hexInner{border:2px solid #b9faff;}
#farmPanel .hexTile.selected .hexInner{border:2px solid #ffe99d;}
#farmPanel .hexTile .hexInner b{display:none;}
#farmPanel .hexTile.locked .hexInner b{
 display:block;position:absolute;top:18px;right:34px;font-size:22px;
 background:#04172bdd;border:1px solid #5da5ba;border-radius:50%;
 width:37px;height:37px;line-height:34px;text-align:center;
}
#farmPanel .hexTile .hexInner strong{
 font-size:13px;font-weight:800;line-height:1.15;color:#f9fcff;
 background:linear-gradient(120deg,#082a46e8,#063450ed);
 padding:4px 9px;border:1px solid #65c9dabc;border-radius:7px;
 text-shadow:0 1px 3px #000;
 box-shadow:0 3px 7px #001b2e9c;
}
#farmPanel .hexTile .hexInner small{
 color:#e6f7ff;background:#001322cf;padding:2px 7px;
 border-radius:6px;font-size:10px;line-height:1.2;
}
#farmPanel .hexTile.locked .hexInner strong{color:#deeafa;}
#farmPanel .hexTile.selected .hexInner strong{border-color:#ffe695;color:#ffeaa5;}
#farmPanel .hexActor{z-index:8;}
#farmPanel .hexActor img{filter:drop-shadow(0 2px 2px #031221) drop-shadow(0 0 3px #85f4eb60);}
#farmPanel .hexActor span{background:#031e33e6;color:#fff7de;border:1px solid #5ac7d57f;padding:2px 5px;}
#farmPanel .hexFood{z-index:7;filter:drop-shadow(0 2px 3px #031321);}
#farmPanel .farmWorld.foodPlacement{cursor:crosshair;}
#farmPanel .farmWorld.foodPlacement .hexTile{filter:brightness(.92);}
#farmPanel .hexControls{background:linear-gradient(180deg,#11334a,#0b243e);border-color:#427d9c;}
#farmPanel .farmNav button{border-color:#397eaa;}
@media(prefers-reduced-motion:reduce){#farmPanel .hexTile{transition:none;}}
'''
old=css.read_text()
css.write_text(old+new)
reports={}
for file in ['index.html','standalone.html']:
    f=root/file
    h=f.read_text()
    assert old in h, f'Missing original inline source CSS in {file}'
    if file=='standalone.html':
        data=base64.b64encode(photo.read_bytes()).decode('ascii')
        replacement=new.replace('assets/farm/hex_farm_v0232.webp','data:image/webp;base64,'+data)
    else:replacement=new
    updated=h.replace(old,old+replacement,1)
    assert updated!=h
    f.write_text(updated)
    reports[file]={'before_length':len(h),'after_length':len(updated),'embedded_art':file=='standalone.html'}
print(json.dumps(reports,ensure_ascii=False,indent=2))
