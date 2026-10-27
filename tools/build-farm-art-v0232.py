#!/usr/bin/env python3
"""Create original browser-farm backdrop from assistant-generated map-study concept art.
Source poster art is locally provided, not a Nintendo DS ROM asset.
Runtime farm navigation/actors/food are deliberately excluded from this illustration.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from pathlib import Path
import math, random
HERE=Path(__file__).resolve().parents[1]
SOURCE=Path('/mnt/data/wide_colorful_comparison_poster_screenshot_collag.png')
OUT=HERE/'assets'/'farm'/'hex_farm_v0232.webp'
OUT.parent.mkdir(parents=True,exist_ok=True)
random.seed(23)
S=3
W,H=920,690
bg=Image.new('RGB',(W*S,H*S))
pix=bg.load()
for y in range(H*S):
    Y=y/S
    for x in range(W*S):
        X=x/S
        dist=math.hypot((X-450)/760,(Y-340)/550)
        wave=math.sin(X*.037+Y*.025)*5+math.cos(X*.016-Y*.041)*4
        star=max(0,1-dist)
        pix[x,y]=(max(0,int(9+9*star+wave*.25)),max(0,int(27+38*star+wave*.5)),max(0,int(56+53*star+wave*.65)))
d=ImageDraw.Draw(bg,'RGBA')
def sc(xy):return [(int(x*S),int(y*S)) for x,y in xy]
def rect(box,fill,rad=0,outline=None,width=1):
    b=tuple(round(t*S) for t in box)
    d.rounded_rectangle(b,radius=rad*S,fill=fill,outline=outline,width=width*S)
def line(points,fill,width=1):d.line(sc(points), fill=fill,width=width*S,joint='curve')
def ellipse(box,fill,outline=None,width=1):d.ellipse(tuple(int(v*S) for v in box),fill=fill,outline=outline,width=width*S)
# Magical sky/digital sea speckles and faint grid
for i in range(900):
    x,y=random.randint(0,W),random.randint(0,H)
    a=random.choice([9,18,30,50])
    ellipse((x,y,x+random.choice([1,2,3]),y+random.choice([1,2,3])),(79,207,242,a))
for x in range(0,W,34):line([(x,0),(x,H)],(52,162,205,12))
for y in range(0,H,34):line([(0,y),(W,y)],(52,162,205,11))
# Extra clouds/reflective rings near outer edges
for k in range(18):
    cy=random.randrange(20,H-20);cx=random.choice([random.randrange(2,90),random.randrange(825,915)])
    ellipse((cx-45,cy-18,cx+50,cy+25),(28,125,154,random.randrange(8,18)))
coords=[('forest',460,552),('rest',270,446),('clinic',650,446),('garden',270,234),('track',650,234),('training',460,128),('core',460,340)]
# Walkable bridges between floating hex districts, illustrated behind islands
for a,b in [('core','training'),('core','garden'),('core','track'),('core','rest'),('core','clinic'),('core','forest')]:
    z={i:(x,y) for i,x,y in coords};x1,y1=z[a];x2,y2=z[b]
    line([(x1,y1),(x2,y2)],(4,20,39,220),36)
    line([(x1,y1),(x2,y2)],(16,178,219,130),30)
    line([(x1,y1),(x2,y2)],(195,216,198,220),22)
    line([(x1,y1),(x2,y2)],(231,216,155,185),11)
# Hex tile shapes matching live DOM target hitboxes

def hpts(cx,cy,radx=108,rady=111):
    return [(cx,cy-rady),(cx+radx,cy-rady*.5),(cx+radx,cy+rady*.5),(cx,cy+rady),(cx-radx,cy+rady*.5),(cx-radx,cy-rady*.5)]

def poly(points,fill,outline=None,width=1):d.polygon(sc(points),fill=fill);d.line(sc(points+[points[0]]),fill=outline,width=width*S,joint='curve') if outline else None
pal={'training':((32,90,60),(92,182,79)),'garden':((28,106,112),(56,171,149)), 'track':((94,66,36),(175,112,68)), 'rest':((65,114,71),(137,184,115)), 'clinic':((55,106,129),(115,177,174)), 'forest':((29,104,73),(105,163,83)), 'core':((25,92,130),(54,155,199))}
for id,cx,cy in coords:
    base,highlight=pal[id]
    shadow=hpts(cx,cy+19,108,111)
    poly(shadow,(8,25,36,255),(3,15,27,250),5)
    for i in range(5):
        poly(hpts(cx,cy+15-i*2,108-i*.5,111-i*.6),(31+i*5,55+i*5,47+i*4,255),None)
    poly(hpts(cx,cy,108,111),(15,67,73,255),(50,236,250,255),4)
    poly(hpts(cx,cy,102,105),(*base,255),(125,254,219,170),2)
    # Geometric land surface subdivided into little scenic facets
    mask=Image.new('L', bg.size,0);ImageDraw.Draw(mask).polygon(sc(hpts(cx,cy,99,100)),fill=255)
    tex=Image.new('RGBA',bg.size,(0,0,0,0)); td=ImageDraw.Draw(tex,'RGBA')
    rng=random.Random(sum(map(ord,id)))
    for i in range(250):
        xx=cx+rng.randint(-104,104);yy=cy+rng.randint(-100,100)
        if id=='core':
            size=rng.choice([7,11,15]);c=rng.choice([(84,181,233,60),(122,202,240,50),(28,75,154,65),(196,240,255,35)])
        else:
            size=rng.choice([3,4,6,7]);c=rng.choice([(160,217,97,70),(13,66,45,90),(252,225,130,70),(37,179,116,65)])
        td.ellipse((int((xx-size)*S),int((yy-size)*S),int((xx+size)*S),int((yy+size)*S)),fill=c)
    tex.putalpha(Image.composite(tex.getchannel('A'),Image.new('L',bg.size,0),mask))
    bg.paste(tex,(0,0),tex)
    # Reinstating d because paste modifies background
    d=ImageDraw.Draw(bg,'RGBA')
    if id=='core':
        # Diamond checkered floor, constrained to central hex
        tiles=Image.new('RGBA',bg.size,(0,0,0,0));t=ImageDraw.Draw(tiles,'RGBA')
        for row in range(-11,12):
            for col in range(-14,15):
                x=cx+(col+row)*20;y=cy+(row-col)*11.5
                color=(51,132,219,185) if (row+col)%2==0 else (130,210,245,145)
                t.polygon(sc([(x,y-13),(x+23,y),(x,y+13),(x-23,y)]),fill=color)
        m=Image.new('L',bg.size,0);ImageDraw.Draw(m).polygon(sc(hpts(cx,cy,98,99)),fill=255)
        tiles.putalpha(Image.composite(tiles.getchannel('A'),Image.new('L',bg.size,0),m))
        bg.paste(tiles,(0,0),tiles);d=ImageDraw.Draw(bg,'RGBA')
        ellipse((cx-31,cy-18,cx+31,cy+18),(6,84,168,65),(129,230,255,190),2)
        ellipse((cx-11,cy-6,cx+11,cy+6),(13,58,124,80),(196,247,255,220),2)
    # accent glowing light corners and small posts
    for px,py in hpts(cx,cy,102,105)[1::2]:
        ellipse((px-6,py-10,px+6,py+4),(22,82,102,245),(62,206,246,255),2)
        ellipse((px-3,py-11,px+3,py-5),(115,238,253,230))
# Crop pixel-art floating facilities from our originally generated comparison poster
poster=Image.open(SOURCE).convert('RGB')
crops={
    'training':(20,746,293,986),
    'track':(329,747,602,984),
    'rest':(638,746,908,987),
    'garden':(948,756,1212,984),
    'forest':(1246,748,1516,987),
    'clinic':(20,746,293,986)
}
for id,cx,cy in coords:
    if id=='core':continue
    cut=poster.crop(crops[id]).convert('RGBA')
    cp=cut.load()
    # Make charcoal backdrop (outside the floating island) transparent.
    for yy in range(cut.height):
        for xx in range(cut.width):
            r,g,b,_=cp[xx,yy]
            # Background in poster is near black/navy.
            intensity=max(r,g,b)
            alpha=max(0,min(255,int((intensity-20)*10)))
            # Remove nearly uniform navy from poster background even when blue channel bright
            if r<35 and g<40 and b<55:alpha=0
            cp[xx,yy]=(r,g,b,alpha)
    if id=='clinic':
        # A medical facility is represented by the same generic research building,
        # with an in-world cyan medical cross drawn above it below.
        pass
    target=(182,174) if id=='training' else (173,165) if id in ('rest','clinic') else (175,152)
    cut=cut.resize((target[0]*S,target[1]*S),Image.Resampling.LANCZOS)
    x=int(cx*S-cut.width/2); y=int((cy-7)*S-cut.height/2)
    # Each thumbnail is drawn as a decorative prop below live actors.
    bg.paste(cut,(x,y),cut)
    d=ImageDraw.Draw(bg,'RGBA')
    if id=='clinic':
        rect((cx-13,cy-62,cx+13,cy-34),(13,67,108,220),4,(107,236,255,240),2)
        rect((cx-3,cy-57,cx+3,cy-39),(230,255,250,255),1)
        rect((cx-10,cy-51,cx+10,cy-45),(230,255,250,255),1)
# Outer panel rim and tiny corner stars
rect((4,4,916,686),(0,0,0,0),17,(53,198,242,150),2)
rect((10,10,910,680),(0,0,0,0),15,(2,68,120,180),2)
for i in range(32):
    x=random.randint(18,902);y=random.choice([19,670])
    ellipse((x,y,x+2,y+2),(90,204,250,160))
OUT.parent.mkdir(parents=True,exist_ok=True)
small=bg.resize((W,H),Image.Resampling.LANCZOS).convert('RGB')
small.save(OUT,format='WEBP',quality=87,method=6)
small.save('/mnt/data/digimon_farm_v0232_background_preview.png')
print('Output:',OUT,'size:',OUT.stat().st_size)
