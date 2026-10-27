"""Read-only NDS inventory and Korean database text extraction; outputs stay outside checkout."""
import argparse
import hashlib
import json
from pathlib import Path
import struct

ROOT=Path(__file__).resolve().parent.parent

class NDS:
    def __init__(self,data):
        self.data=data
        self.span(0,0x160)
        self.sha256=hashlib.sha256(data).hexdigest()
        self.fnt_offset,self.fnt_size=self.words(0x40,2)
        self.fat_offset,self.fat_size=self.words(0x48,2)
        self.span(self.fnt_offset,self.fnt_size)
        self.span(self.fat_offset,self.fat_size)
        if self.fat_size%8:raise ValueError('FAT size is not a multiple of 8')
        self.files=[]
        for i in range(self.fat_size//8):
            start,end=self.words(self.fat_offset+i*8,2)
            payload=self.span(start,end-start)
            self.files.append({'file_id':i,'rom_offset':start,'size':len(payload),'sha256':hashlib.sha256(payload).hexdigest()})
        self.names=self.read_names()

    def span(self,offset,size):
        if offset<0 or size<0 or offset+size>len(self.data):raise ValueError('Range outside ROM')
        return self.data[offset:offset+size]

    def words(self,offset,count):
        return struct.unpack('<'+'I'*count,self.span(offset,4*count))

    def read_names(self):
        fnt=self.span(self.fnt_offset,self.fnt_size)
        if len(fnt)<8:raise ValueError('FNT header missing')
        count=struct.unpack_from('<H',fnt,6)[0]
        if not count or count*8>len(fnt):raise ValueError('Invalid directory count')
        seen=set();names={};paths=set()
        def walk(index,prefix,depth):
            if index in seen or index<0 or index>=count or depth>32:raise ValueError('Invalid FNT directory tree')
            seen.add(index)
            pos,fid=struct.unpack_from('<IH',fnt,index*8)
            if pos<count*8:raise ValueError('Name table overlaps directory records')
            while True:
                if pos>=len(fnt):raise ValueError('Unterminated FNT directory')
                marker=fnt[pos];pos+=1
                if not marker:break
                length=marker&127
                if not length or pos+length>len(fnt):raise ValueError('Truncated FNT name')
                name=fnt[pos:pos+length].decode('shift_jis');pos+=length
                if name in ('.','..') or '/' in name or '\\' in name or '\0' in name:raise ValueError('Unsafe FNT name')
                path=prefix+name
                if marker&128:
                    if pos+2>len(fnt):raise ValueError('Truncated directory reference')
                    child=struct.unpack_from('<H',fnt,pos)[0]-0xf000;pos+=2
                    walk(child,path+'/',depth+1)
                else:
                    if fid>=len(self.files) or fid in names or path in paths:raise ValueError('Invalid/duplicate file identity')
                    names[fid]=path;paths.add(path);fid+=1
        walk(0,'',0)
        if len(seen)!=count:raise ValueError('Unreachable FNT directory')
        return names

    def file(self,path):
        matches=[self.files[i] for i,p in self.names.items() if p==path]
        if len(matches)!=1:raise ValueError('File missing or ambiguous: '+path)
        return matches[0]

    def inventory(self):
        executables={};overlays={}
        for cpu,header,table_header in [('arm9',0x20,0x50),('arm7',0x30,0x58)]:
            offset,entry,ram,size=self.words(header,4)
            executables[cpu]={'rom_offset':offset,'entry_address':entry,'ram_address':ram,'size':size,'sha256':hashlib.sha256(self.span(offset,size)).hexdigest()}
            start,length=self.words(table_header,2)
            self.span(start,length)
            if length%32:raise ValueError('Invalid overlay table length')
            rows=[]
            for pos in range(start,start+length,32):
                oid,ram,size,bss,init_start,init_end,fid,flags=self.words(pos,8)
                if fid>=len(self.files):raise ValueError('Overlay FAT reference missing')
                rows.append({'overlay_id':oid,'ram_address':ram,'ram_size':size,'bss_size':bss,'static_init_start':init_start,'static_init_end':init_end,'flags':flags,'compressed_flag':bool(flags&0x01000000),**self.files[fid]})
            overlays[cpu]=rows
        return {'rom_sha256':self.sha256,'size':len(self.data),'game_code':self.data[12:16].decode('ascii'),'executables':executables,'overlays':overlays,'files':[{**f,'path':self.names.get(f['file_id'])} for f in self.files]}


def decode_database(payload):
    """ASCII header/separators with UTF-16LE payloads, including exact byte offsets."""
    separator=b'<>\n';parts=payload.split(separator)
    if len(parts)<3 or parts[0]!=b'utf-16' or parts[-1]!=b'<END>\n':raise ValueError('Unsupported text framing')
    try:count=int(parts[1].decode('ascii'))
    except (ValueError,UnicodeError) as error:raise ValueError('Invalid record count') from error
    if count!=len(parts)-3:raise ValueError('Text count mismatch')
    offset=len(parts[0])+len(parts[1])+2*len(separator);rows=[]
    for index,raw in enumerate(parts[2:-1]):
        text=raw.decode('utf-16le',errors='strict')
        rows.append({'text_index':index,'file_offset':offset,'byte_length':len(raw),'text':text})
        offset+=len(raw)+len(separator)
    return rows


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rom',type=Path,required=True)
    parser.add_argument('--output-dir',type=Path,required=True)
    args=parser.parse_args()
    destination=args.output_dir.resolve()
    if destination==ROOT or ROOT in destination.parents:parser.error('Use an output directory outside the checkout')
    data=args.rom.read_bytes()
    expected=json.loads((ROOT/'ROM_ANALYSIS/rom_metadata.json').read_text())['rom_sha256']
    nds=NDS(data)
    if nds.sha256!=expected:raise ValueError('ROM hash differs from the documented Korean revision; investigate before applying this profile')
    inventory=nds.inventory()
    file=nds.file('ui/txt/db_txt_list_txt.dat')
    rows=decode_database(nds.span(file['rom_offset'],file['size']))
    if len(rows)!=1176:raise ValueError('Unexpected database size for this profile')
    names=[{**r,'rom_offset':file['rom_offset']+r['file_offset']} for r in rows[:216]]
    web=json.loads((ROOT/'assets/species-catalog.json').read_text())['entries']
    strings={r['text'] for r in names}
    comparison={'web_species':len(web),'exact_name_matches':sum(s['name'] in strings for s in web),'unmatched_web_names':[s['name'] for s in web if s['name'] not in strings],'warning':'Exact text comparison only. No index-to-species-ID mapping or automatic rename.'}
    report={'rom_sha256':nds.sha256,'source_file':file,'record_count':len(rows),'text_decoding':'ROM_VERIFIED','name_block_interpretation':'INFERRED: first 216 entries; species ID semantics not verified','names':names,'comparison':comparison}
    destination.mkdir(parents=True,exist_ok=True)
    for filename,obj in [('inventory.json',inventory),('database-names.json',report)]:
        (destination/filename).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'rom_sha256':nds.sha256,'fat_entries':len(nds.files),'named_files':len(nds.names),'arm9_overlays':len(inventory['overlays']['arm9']),'database_records':len(rows),'name_candidates':len(names),'exact_web_name_matches':comparison['exact_name_matches']},ensure_ascii=False))

if __name__=='__main__':main()
