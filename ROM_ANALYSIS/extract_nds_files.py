#!/usr/bin/env python3
"""Local-only NitroFS extractor. Usage: python extract_nds_files.py game.nds output_dir"""
import sys,struct,pathlib
if len(sys.argv)!=3:raise SystemExit('Usage: python extract_nds_files.py game.nds output_dir')
rom=pathlib.Path(sys.argv[1]).read_bytes();dst=pathlib.Path(sys.argv[2]);dst.mkdir(parents=True,exist_ok=True)
def h16(p):return struct.unpack_from('<H',rom,p)[0]
def h32(p):return struct.unpack_from('<I',rom,p)[0]
fnt=h32(0x40);fat=h32(0x48);count=h32(0x4c)//8
records={0xf000+i:(h32(fnt+8*i),h16(fnt+8*i+4)) for i in range(h16(fnt+6))}
names={};seen=set()
def walk(did,prefix='',depth=0):
 if did in seen or did not in records or depth>32:return
 seen.add(did);off,fid=records[did];pos=fnt+off
 for _ in range(20000):
  n=rom[pos];pos+=1
  if n==0:break
  name=rom[pos:pos+(n&127)].decode('shift_jis','replace');pos+=n&127
  if name in ('.','..') or '/' in name or '\\' in name:raise ValueError('unsafe filename')
  if n&128:sub=h16(pos);pos+=2;walk(sub,prefix+name+'/',depth+1)
  else:names[fid]=prefix+name;fid+=1
walk(0xf000)
for i in range(count):
 s,e=struct.unpack_from('<II',rom,fat+i*8)
 if s>e or e>len(rom):raise ValueError('invalid FAT entry')
 path=dst/names.get(i,f'__unnamed/{i:05d}');path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(rom[s:e])
print('Extracted',count,'files into',dst)
