import importlib.util
from pathlib import Path
import struct
import unittest
spec=importlib.util.spec_from_file_location('rom_database',Path(__file__).resolve().parents[1]/'tools/rom-database.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def fixture():
    data=bytearray(0x300)
    struct.pack_into('<4I',data,0x40,0x180,32,0x1c0,8)
    struct.pack_into('<IHH',data,0x180,8,0,1)
    data[0x188:0x192]=b'\x08test.dat\0'
    struct.pack_into('<II',data,0x1c0,0x200,0x204)
    data[0x200:0x204]=b'TEST'
    return data

class DatabaseTests(unittest.TestCase):
    def test_header_fnt_fat_and_hash(self):
        nds=m.NDS(bytes(fixture()));file=nds.file('test.dat')
        self.assertEqual(file['rom_offset'],0x200);self.assertEqual(file['size'],4)
        self.assertEqual(len(file['sha256']),64)
    def test_truncated_and_out_of_bounds_rom(self):
        with self.assertRaises(ValueError):m.NDS(b'short')
        data=fixture();struct.pack_into('<II',data,0x1c0,0x200,0x400)
        with self.assertRaises(ValueError):m.NDS(data)
    def test_unsafe_name_and_directory_cycle(self):
        data=fixture();data[0x188:0x192]=b'\x08../a.dat\0'
        with self.assertRaises(ValueError):m.NDS(data)
        data=fixture();data[0x188:0x18d]=b'\x81a\x00\xf0\0'
        with self.assertRaises(ValueError):m.NDS(data)
    def test_mixed_encoding_preserves_byte_offsets(self):
        strings=['테스트','A<>B',''];payload=b'utf-16<>\n3<>\n'+b''.join(s.encode('utf-16le')+b'<>\n' for s in strings)+b'<END>\n'
        rows=m.decode_database(payload)
        self.assertEqual([r['text'] for r in rows],strings)
        for r in rows:self.assertEqual(payload[r['file_offset']:r['file_offset']+r['byte_length']],r['text'].encode('utf-16le'))
    def test_reject_wrong_count_encoding_and_footer(self):
        for raw in [b'utf-16<>\n2<>\nA\0<>\n<END>\n',b'utf-16<>\n1<>\nA<>\n<END>\n',b'utf-16<>\n0<>\n']:
            with self.assertRaises((ValueError,UnicodeError)):m.decode_database(raw)
    def test_overlay_reference_bounds(self):
        data=fixture();struct.pack_into('<II',data,0x50,0x220,32);struct.pack_into('<I',data,0x220+24,9)
        with self.assertRaises(ValueError):m.NDS(data).inventory()

if __name__=='__main__':unittest.main()
