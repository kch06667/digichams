"""Synthetic fixtures only: no ROM, extracted art, or network required."""
import struct
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import rom_graphics as g


def nitro(magic, block, body):
    size = 24 + len(body)
    declared, block_size = size, size - 16
    if magic == b'RNAN':
        declared, block_size = 16, 0
    elif magic == b'RCSN':
        declared, block_size = size + 4, size - 12
    return magic + struct.pack('<HHIHH', 0xfeff, 0x100, declared, 16, 1) + block + struct.pack('<I', block_size) + body


def anim_fixture():
    # One sequence, two frames; elements refer to cell 0 and 1.
    body = struct.pack('<HHIIIII', 1, 2, 24, 40, 56, 0, 0)
    body += struct.pack('<HHIII', 2, 0, 0x10000, 2, 0)
    body += struct.pack('<IHHIHHHH', 0, 31, 0xbeef, 2, 7, 0xbeef, 0, 1)
    return nitro(b'RNAN', b'KNBA', body)


def cell_fixture():
    body = struct.pack('<HHIIIII', 1, 1, 24, 1, 46, 0, 0)
    body += struct.pack('<HHIhhhh', 1, 0, 0, 7, 7, -1, -1)
    body += struct.pack('<HHH', 255, 511, 0x1000)  # (-1,-1), palette 1
    body += struct.pack('<IIII', 32, 8, 32, 32)  # maximum, table offset, source, bytes
    return nitro(b'RECN', b'KBEC', body)


class GraphicsTests(unittest.TestCase):
    def test_palette_offsets_and_bgr555(self):
        raw = nitro(b'RLCN', b'TTLP', struct.pack('<IIIIHHH', 3, 0, 6, 16, 31, 31 << 5, 31 << 10))
        self.assertEqual(g.palette(raw)['colors'], [(255, 0, 0), (0, 255, 0), (0, 0, 255)])
        with self.assertRaises(ValueError):
            g.palette(raw[:-1])

    def test_character_payload_offset_and_layout(self):
        raw = nitro(b'RGCN', b'RAHC', struct.pack('<HHIIIII', 0xffff, 0xffff, 3, 0x100010, 0x101, 32, 24) + bytes(32))
        parsed = g.characters(raw)
        self.assertEqual(parsed['bpp'], 4)
        self.assertTrue(parsed['linear'])
        self.assertEqual(len(parsed['payload']), 32)
        damaged = bytearray(raw)
        struct.pack_into('<I', damaged, 44, 0xffff)
        with self.assertRaises(ValueError):
            g.characters(damaged)

    def test_animation_frames_duration_and_offsets(self):
        a = g.animations(anim_fixture())['sequences'][0]
        self.assertEqual([f['cell_index'] for f in a['frames']], [0, 1])
        self.assertEqual([f['duration_ticks'] for f in a['frames']], [31, 7])
        self.assertEqual(a['frames'][1]['content_offset'], 82)
        self.assertEqual(a['play_mode'], 2)

    def test_animation_rejects_range_and_element_errors(self):
        for at, value in [(60, 0xffff), (64, 0xffff), (52, 0x10001)]:
            raw = bytearray(anim_fixture())
            struct.pack_into('<I', raw, at, value)
            with self.assertRaises(ValueError):
                g.animations(raw)
        raw = bytearray(anim_fixture())
        struct.pack_into('<H', raw, 68, 0)
        parsed = g.animations(raw)
        self.assertEqual(parsed['sequences'][0]['frames'][0]['duration_ticks'], 0)
        self.assertEqual(parsed['zero_duration_frames'], [{'animation_index': 0, 'frame_index': 0, 'file_offset': 64}])

    def test_cell_signed_coordinates_and_vram_reference(self):
        c = g.cells(cell_fixture())['cells'][0]
        self.assertEqual((c['objects'][0]['x'], c['objects'][0]['y']), (-1, -1))
        self.assertEqual(c['objects'][0]['palette'], 1)
        self.assertEqual(c['transfer']['source_offset'], 32)
        self.assertEqual(c['transfer']['size'], 32)

    def test_cell_rejects_affine_and_truncation(self):
        raw = bytearray(cell_fixture())
        struct.pack_into('<H', raw, 64, 0x100)
        with self.assertRaises(ValueError):
            g.cells(raw)
        with self.assertRaises(ValueError):
            g.cells(cell_fixture()[:-4])

    def test_vram_transfer_palette_and_zero_transparency(self):
        bank = g.cells(cell_fixture())
        pal = {'colors': [(0, 0, 0)] * 17 + [(255, 0, 0)]}
        ch = {'payload': bytes(32) + bytes([0x10]) + bytes(31), 'bpp': 4, 'linear': True}
        im = g.render_cell(ch, pal, bank, bank['cells'][0], (-1, -1, 7, 7))
        self.assertEqual(im.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertEqual(im.getpixel((1, 0)), (255, 0, 0, 255))
        with self.assertRaises(ValueError):
            g.render_cell(dict(ch, payload=bytes(32)), pal, bank, bank['cells'][0])

    def test_oam_flips(self):
        bank = g.cells(cell_fixture())
        bank['cells'][0]['objects'][0].update(flip_x=True, flip_y=True)
        ch = {'payload': bytes(32) + bytes([0x10]) + bytes(31), 'bpp': 4, 'linear': True}
        pal = {'colors': [(0, 0, 0)] * 17 + [(255, 0, 0)]}
        im = g.render_cell(ch, pal, bank, bank['cells'][0], (-1, -1, 7, 7))
        self.assertEqual(im.getpixel((6, 7)), (255, 0, 0, 255))

    def test_linear_and_tiled_character_order(self):
        bank = g.cells(cell_fixture())
        cell = bank['cells'][0]
        cell['transfer'] = None
        cell['objects'][0].update(width=16, height=8, palette=0)
        raw = bytes([0x11]) * 32 + bytes([0x22]) * 32
        pal = {'colors': [(0, 0, 0), (255, 0, 0), (0, 255, 0)]}
        ch = {'payload': raw, 'bpp': 4, 'linear': False}
        tiled = g.render_cell(ch, pal, bank, cell, (-1, -1, 15, 7))
        linear = g.render_cell(dict(ch, linear=True), pal, bank, cell, (-1, -1, 15, 7))
        self.assertEqual(tiled.getpixel((10, 0)), (0, 255, 0, 255))
        self.assertEqual(linear.getpixel((10, 0)), (255, 0, 0, 255))

    def test_background_tile_flip_and_palette_bank(self):
        ch = {'payload': bytes([0x10]) + bytes(31), 'bpp': 4, 'linear': False}
        pal = {'colors': [(0, 0, 0)] * 17 + [(255, 0, 0)]}
        screen = {'width_tiles': 1, 'height_tiles': 1, 'layout': 'rows', 'entries': [0x1c00]}
        im = g.render_background(ch, pal, screen, transparent=True)
        self.assertEqual(im.getpixel((6, 7)), (255, 0, 0, 255))
        self.assertEqual(im.getpixel((7, 7))[3], 0)

    def test_background_screen_block_order(self):
        ch = {'payload': bytes([1]) * 64 + bytes([2]) * 64, 'bpp': 8, 'linear': False}
        pal = {'colors': [(0, 0, 0), (255, 0, 0), (0, 255, 0)]}
        screen = {'width_tiles': 64, 'height_tiles': 32, 'layout': 'screen-blocks', 'entries': [0] * 1024 + [1] * 1024}
        im = g.render_background(ch, pal, screen)
        self.assertEqual(im.getpixel((0, 8)), (255, 0, 0, 255))
        self.assertEqual(im.getpixel((256, 0)), (0, 255, 0, 255))

    def test_nbs_dimensions_and_nscr_size_profile(self):
        nbs = b'NBSR' + struct.pack('<IIIIH', 2, 1, 1, 1, 0)
        self.assertEqual(g.tilemap(nbs, 'nbs')['entries'], (0,))
        with self.assertRaises(ValueError):
            g.tilemap(nbs[:-1], 'nbs')
        nscr = nitro(b'RCSN', b'NRCS', struct.pack('<HHHHI', 256, 256, 1, 0, 2048) + bytes(2048))
        self.assertEqual(len(g.tilemap(nscr, 'nscr')['entries']), 1024)
        with self.assertRaises(ValueError):
            g.tilemap(nscr[:-2], 'nscr')

    def test_signature_ignores_transparent_padding_not_opaque_color(self):
        im = g.Image.new('RGBA', (3, 3))
        im.putpixel((1, 1), (248, 0, 0, 255))
        self.assertEqual(g.pixel_signature(im), g.pixel_signature(g.Image.new('RGBA', (1, 1), (255, 0, 0, 255))))
        self.assertNotEqual(g.pixel_signature(im), g.pixel_signature(g.Image.new('RGBA', (1, 1), (0, 255, 0, 255))))

    def test_wide_nbs_flags_and_tile_are_separate_words(self):
        raw = b'NBSR' + struct.pack('<IIIIHHHH', 1, 2, 1, 1, 0, 5, 4, 7)
        parsed = g.tilemap(raw, 'nbs')
        self.assertEqual(parsed['entries'], (5, 7 | 1024))
        self.assertEqual(parsed['entry_size'], 4)
        raw = bytearray(raw)
        struct.pack_into('<H', raw, 20, 8)
        with self.assertRaises(ValueError):
            g.tilemap(raw, 'nbs')

    def test_nbs_observed_short_profiles(self):
        for first, last in [(1, 0), (2, 0), (2, 1)]:
            raw = b'NBSR' + struct.pack('<IIIIH', first, 1, 1, last, 17)
            self.assertEqual(g.tilemap(raw, 'nbs')['entries'], (17,))

    def test_nonstandard_constant_screen_is_order_independent(self):
        raw = nitro(b'RCSN', b'NRCS', struct.pack('<HHHHI', 512, 128, 1, 0, 2048) + bytes(2048))
        self.assertEqual(g.tilemap(raw, 'nscr')['layout'], 'constant')
        raw = bytearray(raw)
        raw[-1] = 1
        with self.assertRaises(ValueError):
            g.tilemap(raw, 'nscr')

    def test_output_guard_and_negative_ranges(self):
        with self.assertRaises(ValueError):
            g.destination(g.ROOT / 'rom-output')
        with self.assertRaises(ValueError):
            g.span(b'123', -1, 1)

    def test_bsa_lookup_rows_are_frame_sequences_not_replacement_pairs(self):
        raw = b'BSAR' + struct.pack('<IIIIIII', 2, 1, 3, 1, 13, 12, 12)
        raw += struct.pack('<IIHHIHHHHHH', 2, 1, 1, 0, 2, 3, 4, 5, 6, 7, 8)
        p = g.background_animation(raw)
        self.assertEqual(p['duration_values'], (13, 12, 12))
        self.assertEqual([f['entries'] for f in p['frames']], [(6, 3), (7, 4), (8, 5)])
        self.assertEqual((p['map_offset'], p['lookup_offset']), (40, 48))
        with self.assertRaises(ValueError):
            g.background_animation(raw[:-2])

    def test_bsa_lookup_reference_and_flip_flags(self):
        raw = b'BSAR' + struct.pack('<IIIIII', 2, 1, 2, 1, 20, 20)
        raw += struct.pack('<IIHIHH', 1, 1, 0, 1, 4, 0x804)
        p = g.background_animation(raw)
        self.assertEqual(p['frames'][1]['entries'], (0x804,))
        broken = bytearray(raw)
        struct.pack_into('<H', broken, 36, 1)
        with self.assertRaises(ValueError):
            g.background_animation(broken)


if __name__ == '__main__':
    unittest.main()
