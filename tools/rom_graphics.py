"""Read-only Korean Championship 2D graphics analysis; never writes into checkout.

Pillow is required for rendering. Numeric animation indices are not action names.
Offsets in parser results refer to the uncompressed NitroFS file, not ARM RAM.
"""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

from PIL import Image, ImageDraw, ImageSequence

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location('rom_database', ROOT / 'tools/rom-database.py')
_rom = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_rom)
NDS = _rom.NDS


def span(data, offset, size):
    if offset < 0 or size < 0 or offset + size > len(data):
        raise ValueError(f'Range outside file: {offset:#x}+{size:#x}/{len(data):#x}')
    return data[offset:offset + size]


def unpack(data, offset, fmt):
    return struct.unpack('<' + fmt, span(data, offset, struct.calcsize('<' + fmt)))


def header(data, magic, block):
    if span(data, 0, 4) != magic or span(data, 16, 4) != block:
        raise ValueError('Unsupported graphics signature')
    bom, version, declared, size, count = unpack(data, 4, 'HHIHH')
    if (bom, version, size, count) != (0xfeff, 0x100, 16, 1):
        raise ValueError('Unsupported Nitro header')
    block_size, = unpack(data, 20, 'I')
    # This supplied revision consistently uses these nonstandard sizes.
    # Permit only the observed profile, never silently accept arbitrary truncation.
    expected = (len(data), len(data) - 16)
    if magic == b'RNAN':
        expected = (16, 0)
    elif magic == b'RCSN':
        expected = (len(data) + 4, len(data) - 12)
    if (declared, block_size) != expected:
        raise ValueError('Unexpected declared file/block size')
    return {'declared_size': declared, 'actual_size': len(data),
            'size_profile': 'standard' if declared == len(data) else 'Korean-ROM-specific'}


def palette(data):
    h = header(data, b'RLCN', b'TTLP')
    fmt, extended, size, off = unpack(data, 24, 'IIII')
    if fmt not in (3, 4) or size % 2 or not 0 < size <= 8192:
        raise ValueError('Unsupported palette')
    start = 24 + off
    values = unpack(data, start, 'H' * (size // 2))
    return dict(h, format=fmt, extended=extended, data_offset=start,
                colors=[tuple(((v >> s) & 31) * 255 // 31 for s in (0, 5, 10)) for v in values])


def characters(data):
    h = header(data, b'RGCN', b'RAHC')
    height, width, fmt, mapping, layout, size, off = unpack(data, 24, 'HHIIIII')
    if fmt not in (3, 4) or layout & ~0x101:
        raise ValueError('Unsupported character format')
    start = 24 + off
    payload = span(data, start, size)
    if size % (32 if fmt == 3 else 64):
        raise ValueError('Partial character tile')
    return dict(h, width_tiles=width, height_tiles=height, bpp=4 if fmt == 3 else 8,
                mapping=mapping, layout=layout, linear=bool(layout & 1),
                data_offset=start, payload=payload)


SIZES = (((8, 8), (16, 16), (32, 32), (64, 64)),
         ((16, 8), (32, 8), (32, 16), (64, 32)),
         ((8, 16), (8, 32), (16, 32), (32, 64)))


def cells(data):
    h = header(data, b'RECN', b'KBEC')
    count, bank, off, mapping, transfer, strings, extended = unpack(data, 24, 'HHIIIII')
    if bank != 1 or mapping not in (0, 1, 2) or strings or extended:
        raise ValueError('Unsupported cell bank')
    base = 24 + off
    span(data, base, count * 16)
    oam_base = base + count * 16
    transfers = None
    if transfer:
        transfer_base = 24 + transfer
        maximum, entry_off = unpack(data, transfer_base, 'II')
        transfers = []
        for i in range(count):
            src, length = unpack(data, transfer_base + entry_off + i * 8, 'II')
            if length > maximum:
                raise ValueError('VRAM transfer exceeds declared buffer')
            transfers.append({'source_offset': src, 'size': length,
                              'file_offset': transfer_base + entry_off + i * 8})
    rows = []
    for i in range(count):
        pos = base + i * 16
        num, flags, obj_off, xmax, ymax, xmin, ymin = unpack(data, pos, 'HHIhhhh')
        objects = []
        for j in range(num):
            at = oam_base + obj_off + j * 6
            a0, a1, a2 = unpack(data, at, 'HHH')
            shape = a0 >> 14
            if shape == 3 or a0 & 0x100:
                raise ValueError('Unsupported affine/prohibited OAM')
            width, height = SIZES[shape][a1 >> 14]
            x, y = a1 & 511, a0 & 255
            objects.append({'file_offset': at, 'x': x - 512 if x >= 256 else x,
                            'y': y - 256 if y >= 128 else y,
                            'width': width, 'height': height, 'tile': a2 & 1023,
                            'palette': a2 >> 12, 'bpp': 8 if a0 & 8192 else 4,
                            'flip_x': bool(a1 & 4096), 'flip_y': bool(a1 & 8192),
                            'disabled': bool(a0 & 512), 'mode': (a0 >> 10) & 3,
                            'priority': (a2 >> 10) & 3})
        rows.append({'cell_index': i, 'file_offset': pos, 'flags': flags,
                     'bounds': [xmin, ymin, xmax, ymax], 'objects': objects,
                     'transfer': transfers[i] if transfers else None})
    return dict(h, mapping=mapping, cells=rows)


def animations(data):
    h = header(data, b'RNAN', b'KNBA')
    count, total, seqoff, frameoff, contentoff, strings, extended = unpack(data, 24, 'HHIIIII')
    if strings or extended:
        raise ValueError('Unsupported extended animation bank')
    seqbase, framebase, contentbase = 24 + seqoff, 24 + frameoff, 24 + contentoff
    span(data, seqbase, count * 16)
    span(data, framebase, total * 8)
    rows = []
    for i in range(count):
        pos = seqbase + i * 16
        length, loop_start, kind, mode, off = unpack(data, pos, 'HHIII')
        if kind != 0x10000 or mode not in (1, 2, 3, 4) or off % 8:
            raise ValueError('Unsupported animation element/play mode')
        if off + length * 8 > total * 8 or not length or loop_start >= length:
            raise ValueError('Animation frame range invalid')
        frames = []
        for j in range(length):
            at = framebase + off + j * 8
            ref, duration, padding = unpack(data, at, 'IHH')
            cell, = unpack(data, contentbase + ref, 'H')
            frames.append({'frame_index': j, 'file_offset': at, 'content_offset': contentbase + ref,
                           'cell_index': cell, 'duration_ticks': duration})
        rows.append({'animation_index': i, 'file_offset': pos, 'loop_start': loop_start,
                     'play_mode': mode, 'frames': frames})
    zero_duration = [{'animation_index': seq['animation_index'], 'frame_index': frame['frame_index'],
                      'file_offset': frame['file_offset']} for seq in rows for frame in seq['frames'] if frame['duration_ticks'] == 0]
    return dict(h, declared_frame_count=total, sequences=rows, zero_duration_frames=zero_duration)


def tilemap(data, kind):
    if kind == 'nscr':
        h = header(data, b'RCSN', b'NRCS')
        w, ht, color_mode, screen_format, size = unpack(data, 24, 'HHHHI')
        if w % 8 or ht % 8 or screen_format != 0:
            raise ValueError('Unsupported affine screen map')
        width, height, start = w // 8, ht // 8, 36
        # Hardware text screen blocks are 32x32 tiles, not a flat wide array.
        layout = 'screen-blocks'
    elif kind == 'nbs':
        if span(data, 0, 4) != b'NBSR':
            raise ValueError('Unsupported NBS signature')
        format_word, width, height, variant_word = unpack(data, 4, 'IIII')
        if format_word not in (1, 2) or variant_word not in (0, 1):
            raise ValueError('Unsupported NBS profile')
        wide = (format_word, variant_word) == (1, 1)
        start, size, layout = 20, width * height * (4 if wide else 2), 'rows'
        h = {'format_word': format_word, 'variant_word': variant_word,
             'entry_size': 4 if wide else 2}
        if len(data) != start + size:
            raise ValueError('NBS dimensions do not match payload')
        if wide:
            # In six files, entry = flags:u16, tile:u16. Flag 4 is H-flip:
            # A/C/D/E entries cross-match their NSCR maps, including nine flips.
            # Other flags are deliberately unsupported until evidenced.
            entries = []
            for flags, tile in struct.iter_unpack('<HH', span(data, start, size)):
                if flags & ~4 or tile > 1023:
                    raise ValueError('Unsupported wide NBS flags/tile')
                entries.append(tile | ((flags & 4) << 8))
            if not (0 < width <= 512 and 0 < height <= 512):
                raise ValueError('Invalid tilemap size')
            return dict(h, width_tiles=width, height_tiles=height, layout=layout,
                        data_offset=start, entries=tuple(entries))
    else:
        raise ValueError('Unknown tile map kind')
    if not (0 < width <= 512 and 0 < height <= 512) or size != width * height * 2:
        raise ValueError('Invalid tilemap size')
    entries = unpack(data, start, 'H' * (size // 2))
    if layout == 'screen-blocks' and (width not in (32, 64) or height not in (32, 64)):
        if len(set(entries)) != 1:
            raise ValueError('Unsupported nonconstant text screen dimensions')
        # cageBG_B NSCR is an all-zero 512x128 map: order cannot affect pixels.
        layout = 'constant'
    return dict(h, width_tiles=width, height_tiles=height, layout=layout, data_offset=start,
                entries=entries)


def background_animation(data):
    if span(data, 0, 4) != b'BSAR':
        raise ValueError('Unsupported BSA signature')
    version, word1, count, word2 = unpack(data, 4, 'IIII')
    if (version, word1, word2) != (2, 1, 1) or not 1 <= count <= 64:
        raise ValueError('Unsupported BSA profile')
    durations = unpack(data, 20, 'I' * count)
    if not all(durations):
        raise ValueError('Zero BSA timing semantics unsupported')
    pos = 20 + 4 * count
    w, h = unpack(data, pos, 'II')
    pos += 8
    if not (0 < w <= 512 and 0 < h <= 512):
        raise ValueError('Invalid BSA dimensions')
    map_offset = pos
    indices = unpack(data, pos, 'H' * (w * h))
    pos += w * h * 2
    row_count, = unpack(data, pos, 'I')
    pos += 4
    table_offset = pos
    if not 0 < row_count <= 65536 or pos + row_count * count * 2 != len(data):
        raise ValueError('BSA lookup dimensions/payload mismatch')
    lookup = unpack(data, pos, 'H' * (row_count * count))
    if max(indices) >= row_count:
        raise ValueError('BSA map reference outside lookup')
    frames = [{'width_tiles': w, 'height_tiles': h, 'layout': 'rows',
               'entries': tuple(lookup[index * count + frame] for index in indices)} for frame in range(count)]
    return {'width_tiles': w, 'height_tiles': h, 'duration_values': durations,
            'map_offset': map_offset, 'lookup_offset': table_offset, 'lookup_rows': row_count,
            'map_indices': indices, 'lookup': lookup, 'frames': frames,
            'confidence': {'layout': 'ROM_VERIFIED', 'runtime_timing_and_layering': 'INFERRED'}}


def indexed_pixel(payload, index, bpp):
    byte = span(payload, index if bpp == 8 else index // 2, 1)[0]
    return byte if bpp == 8 else (byte >> (4 * (index % 2))) & 15


def render_cell(chars, pal, bank, cell, canvas=None):
    active = [o for o in cell['objects'] if not o['disabled']]
    if canvas is None:
        canvas = (min([o['x'] for o in active] + [0]), min([o['y'] for o in active] + [0]),
                  max([o['x'] + o['width'] for o in active] + [1]),
                  max([o['y'] + o['height'] for o in active] + [1]))
    left, top, right, bottom = canvas
    if not (0 < right - left <= 1024 and 0 < bottom - top <= 1024):
        raise ValueError('Invalid cell canvas')
    im = Image.new('RGBA', (right - left, bottom - top))
    payload = chars['payload']
    if cell['transfer']:
        payload = span(payload, cell['transfer']['source_offset'], cell['transfer']['size'])
    # Lower OAM index wins when objects overlap. Priorities relate OBJ to BG.
    for o in reversed(active):
        if o['bpp'] != chars['bpp'] or o['mode'] not in (0, 1):
            raise ValueError('Unsupported object color/mode')
        width, height, bpp = o['width'], o['height'], o['bpp']
        offset = o['tile'] * (32 << bank['mapping'])
        raw = span(payload, offset, width * height * bpp // 8)
        obj = Image.new('RGBA', (width, height))
        pixels = obj.load()
        for y in range(height):
            for x in range(width):
                pixel = y * width + x if chars['linear'] else ((y // 8) * (width // 8) + x // 8) * 64 + y % 8 * 8 + x % 8
                index = indexed_pixel(raw, pixel, bpp)
                if not index:
                    continue
                color_index = index + (o['palette'] * 16 if bpp == 4 else 0)
                if color_index >= len(pal['colors']):
                    raise ValueError('Palette index outside file')
                pixels[width - x - 1 if o['flip_x'] else x, height - y - 1 if o['flip_y'] else y] = (*pal['colors'][color_index], 255)
        im.alpha_composite(obj, (o['x'] - left, o['y'] - top))
    return im


def render_background(chars, pal, screen, transparent=False):
    if chars['linear']:
        raise ValueError('Background requires tiled characters')
    w, h = screen['width_tiles'], screen['height_tiles']
    im = Image.new('RGBA', (w * 8, h * 8))
    px = im.load()
    for y in range(h):
        for x in range(w):
            i = y * w + x if screen['layout'] in ('rows', 'constant') else ((y // 32) * (w // 32) + x // 32) * 1024 + (y % 32) * 32 + x % 32
            entry = screen['entries'][i]
            raw = span(chars['payload'], (entry & 1023) * 8 * chars['bpp'], 8 * chars['bpp'])
            for ty in range(8):
                for tx in range(8):
                    sx, sy = 7 - tx if entry & 1024 else tx, 7 - ty if entry & 2048 else ty
                    index = indexed_pixel(raw, sy * 8 + sx, chars['bpp'])
                    color = index + ((entry >> 12) * 16 if chars['bpp'] == 4 else 0)
                    if color >= len(pal['colors']):
                        raise ValueError('Background palette index outside file')
                    px[x * 8 + tx, y * 8 + ty] = (*pal['colors'][color], 0 if transparent and index == 0 else 255)
    return im


class GraphicsROM:
    def __init__(self, path):
        self.nds = NDS(Path(path).read_bytes())
        expected = json.loads((ROOT / 'ROM_ANALYSIS/rom_metadata.json').read_text())['rom_sha256']
        if self.nds.sha256 != expected:
            raise ValueError('ROM differs from documented Korean revision')
        self.paths = set(self.nds.names.values())

    def read(self, path):
        f = self.nds.file(path)
        return self.nds.span(f['rom_offset'], f['size'])

    def evidence(self, path):
        return dict(self.nds.file(path), path=path)

    def sprite(self, stem):
        ext = '.ncbr' if stem + '.ncbr' in self.paths else '.ncgr'
        ch, pal = characters(self.read(stem + ext)), palette(self.read(stem + '.nclr'))
        bank, anim = cells(self.read(stem + '.ncer')), animations(self.read(stem + '.nanr'))
        for seq in anim['sequences']:
            for frame in seq['frames']:
                if frame['cell_index'] >= len(bank['cells']):
                    raise ValueError('Animation refers to missing cell')
        return ch, pal, bank, anim


def pixel_signature(im):
    """Trim transparent margins; quantize channels to source BGR555 precision."""
    im = im.convert('RGBA')
    bounds = im.getchannel('A').getbbox()
    if not bounds:
        return (0, 0, hashlib.sha256(b'').hexdigest())
    im = im.crop(bounds)
    raw = bytearray()
    for r, g, b, a in struct.iter_unpack('BBBB', im.tobytes()):
        raw.extend((r >> 3, g >> 3, b >> 3, 1) if a else (0, 0, 0, 0))
    return (*im.size, hashlib.sha256(raw).hexdigest())


def destination(path):
    path = Path(path).resolve()
    if path == ROOT or ROOT in path.parents:
        raise ValueError('Outputs must stay outside checkout')
    path.mkdir(parents=True, exist_ok=True)
    return path


def export_sprite(rom, stem, output):
    ch, pal, bank, anim = rom.sprite(stem)
    objects = [o for cell in bank['cells'] for o in cell['objects'] if not o['disabled']]
    canvas = (min(o['x'] for o in objects), min(o['y'] for o in objects),
              max(o['x'] + o['width'] for o in objects), max(o['y'] + o['height'] for o in objects))
    rendered = [render_cell(ch, pal, bank, cell, canvas) for cell in bank['cells']]
    target = output / stem.replace('/', '__')
    target.mkdir(parents=True, exist_ok=True)
    for i, im in enumerate(rendered):
        im.save(target / f'cell-{i:03}.png')
    w, h = rendered[0].size
    sheet = Image.new('RGBA', (8 * (w + 4), ((len(rendered) + 7) // 8) * (h + 18)), '#ddd9cf')
    draw = ImageDraw.Draw(sheet)
    for i, im in enumerate(rendered):
        x, y = i % 8 * (w + 4), i // 8 * (h + 18)
        sheet.alpha_composite(im, (x, y + 14))
        draw.text((x + 2, y), str(i), fill='black')
    sheet.save(target / 'cells.png')
    for seq in anim['sequences']:
        if any(f['duration_ticks'] == 0 for f in seq['frames']):
            # Preserve raw duration; skip preview instead of inventing hold/skip semantics.
            continue
        frames = [rendered[f['cell_index']] for f in seq['frames']]
        # PNG animation for inspection only: 60Hz is an assumption, raw ticks retained.
        frames[0].save(target / f"animation-{seq['animation_index']:02}.png", save_all=True,
                       append_images=frames[1:], duration=[f['duration_ticks'] * 1000 / 60 for f in seq['frames']],
                       loop=0 if seq['play_mode'] == 2 else 1, disposal=0, blend=0)
    evidence = [rom.evidence(stem + e) for e in ('.nanr', '.ncer', '.nclr', '.ncbr' if ch['linear'] else '.ncgr')]
    report = {'rom_sha256': rom.nds.sha256, 'stem': stem, 'sources': evidence,
              'canvas': canvas, 'cell_bank': bank, 'animations': anim,
              'confidence': {'structure': 'ROM_VERIFIED', 'action_names': 'INFERRED',
                             'preview_60hz': 'INFERRED'},
              'preview_skipped_indices': sorted({f['animation_index'] for f in anim['zero_duration_frames']}),
              'note': 'Numeric animation IDs are not verified action semantics. Zero-tick sequences have no APNG preview.'}
    (target / 'metadata.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return {'stem': stem, 'cells': len(rendered), 'animations': len(anim['sequences']), 'output': str(target)}


def audit(rom, output, compare_web=False):
    parsers = {'.nclr': palette, '.ncbr': characters, '.ncgr': characters,
               '.ncer': cells, '.nanr': animations,
               '.nscr': lambda b: tilemap(b, 'nscr'), '.nbs': lambda b: tilemap(b, 'nbs'),
               '.bsa': background_animation}
    counts, failures, rows = Counter(), [], []
    for path in sorted(rom.paths):
        ext = Path(path).suffix
        if ext not in parsers:
            continue
        try:
            parsed = parsers[ext](rom.read(path))
            row = {'source': rom.evidence(path)}
            if ext == '.nanr':
                row.update(sequences=len(parsed['sequences']), frames=parsed['declared_frame_count'],
                           zero_duration_frames=parsed['zero_duration_frames'],
                           play_modes=dict(Counter(s['play_mode'] for s in parsed['sequences'])))
            elif ext == '.ncer':
                row.update(cells=len(parsed['cells']), mapping=parsed['mapping'],
                           vram_transfer=any(c['transfer'] is not None for c in parsed['cells']))
            elif ext in ('.nbs', '.nscr'):
                row.update(width_tiles=parsed['width_tiles'], height_tiles=parsed['height_tiles'])
            elif ext == '.bsa':
                ch = characters(rom.read(path[:-4] + '.ncgr'))
                tile_count = len(ch['payload']) // (ch['bpp'] * 8)
                if max(entry & 1023 for entry in parsed['lookup']) >= tile_count:
                    raise ValueError('BSA lookup references missing character tile')
                row.update(width_tiles=parsed['width_tiles'], height_tiles=parsed['height_tiles'],
                           frames=len(parsed['frames']), lookup_rows=parsed['lookup_rows'],
                           duration_values=parsed['duration_values'], tile_references_in_range=True)
            rows.append(row)
            counts[ext] += 1
        except (ValueError, struct.error) as error:
            failures.append({'path': path, 'error': str(error)})
    result = {'rom_sha256': rom.nds.sha256, 'parsed': dict(counts), 'failures': failures,
              'files': rows, 'note': 'Structural parse only; not all files visually validated.'}
    (output / 'structure-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'parsed': dict(counts), 'failures': len(failures)}), flush=True)
    if not compare_web:
        return
    catalog = json.loads((ROOT / 'assets/species-catalog.json').read_text())['entries']
    totals, comparisons, errors = Counter(), [], []
    for species in catalog:
        # Explicit filename spelling correspondence; validated by pixel comparison,
        # not interpreted as a numeric game species-ID table.
        rom_stem = {'m326_kokatorimon_main': 'm326_cockatrimon_main'}.get(species['stem'], species['stem'])
        stem = 'digimon/' + rom_stem
        try:
            ch, pal, bank, anim = rom.sprite(stem)
            images = [render_cell(ch, pal, bank, c) for c in bank['cells']]
            signatures = [pixel_signature(im) for im in images]
            entries = []
            for seq in anim['sequences']:
                index = seq['animation_index']
                path = ROOT / 'assets/sprites' / species['folder'] / f"{species['stem']}_{index}.gif"
                exists = path.exists()
                candidate = path.with_name(path.stem + '_1.gif')
                if not exists and candidate.exists():
                    path = candidate
                row = {'animation_index': index, 'file_offset': seq['file_offset'],
                       'web_file': str(path.relative_to(ROOT)), 'expected_file_exists': exists,
                       'cells': [f['cell_index'] for f in seq['frames']],
                       'duration_ticks': [f['duration_ticks'] for f in seq['frames']]}
                if not path.exists():
                    row['status'] = 'missing'
                else:
                    with Image.open(path) as im:
                        frames = [f.convert('RGBA') for f in ImageSequence.Iterator(im)]
                        times = [f.info.get('duration', 0) for f in ImageSequence.Iterator(im)]
                    actual = [pixel_signature(f) for f in frames]
                    expected = [signatures[f['cell_index']] for f in seq['frames']]
                    row.update(web_duration_ms=times, web_frame_count=len(frames),
                               status='pixel_sequence_match' if actual == expected else 'different')
                    row['timing_matches_60hz_gif_floor'] = times == [int(t * 100 / 60) * 10 for t in row['duration_ticks']]
                    if actual != expected:
                        # Separate a color/transparency issue from a different shape.
                        def mask(im):
                            bounds = im.getchannel('A').getbbox()
                            im = im.crop(bounds) if bounds else Image.new('RGBA', (1, 1))
                            return (im.size, hashlib.sha256(im.getchannel('A').tobytes()).hexdigest())
                        row['alpha_shapes_match'] = [mask(f) for f in frames] == [mask(images[f['cell_index']]) for f in seq['frames']]
                        row['palette_banks'] = sorted({o['palette'] for f in seq['frames'] for o in bank['cells'][f['cell_index']]['objects']})
                totals[row['status']] += 1
                if not exists:
                    totals['missing_expected_path'] += 1
                entries.append(row)
            comparisons.append({'stem': stem, 'sources': [rom.evidence(stem + e) for e in ('.nanr', '.ncer', '.ncbr', '.nclr')],
                                'cells': len(bank['cells']), 'animations': entries})
        except (ValueError, OSError) as error:
            errors.append({'stem': stem, 'error': str(error)})
        if (len(comparisons) + len(errors)) % 24 == 0:
            print(json.dumps({'species_compared': len(comparisons), 'errors': len(errors)}), flush=True)
    report = {'rom_sha256': rom.nds.sha256, 'summary': dict(totals), 'errors': errors,
              'comparison': 'Visible pixels after margin trim and BGR555 quantization; not anchor-position/action-meaning validation.',
              'species': comparisons}
    (output / 'web-sprite-comparison.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'comparison': dict(totals), 'errors': len(errors)}), flush=True)


def audit_backgrounds(rom, output):
    rows, failures = [], []
    for path in sorted(p for p in rom.paths if Path(p).suffix in ('.nbs', '.nscr')):
        stem, kind = path.rsplit('.', 1)
        try:
            ch, pal = characters(rom.read(stem + '.ncgr')), palette(rom.read(stem + '.nclr'))
            screen = tilemap(rom.read(path), kind)
            im = render_background(ch, pal, screen)
            row = {'path': path, 'sources': [rom.evidence(stem + e) for e in ('.ncgr', '.nclr', '.' + kind)],
                   'size': im.size, 'layout': screen['layout'], 'pixel_signature': pixel_signature(im)}
            existing = ROOT / 'assets/rom_images' / (stem.replace('/', '_') + '.png')
            if existing.exists():
                with Image.open(existing) as old:
                    row.update(existing_file=str(existing.relative_to(ROOT)), existing_size=old.size,
                               existing_pixels_match=pixel_signature(old) == pixel_signature(im))
            if kind == 'nbs' and screen.get('entry_size') == 4 and stem + '.nscr' in rom.paths:
                counterpart = tilemap(rom.read(stem + '.nscr'), 'nscr')
                w, h = screen['width_tiles'], screen['height_tiles']
                sw, sh = counterpart['width_tiles'], counterpart['height_tiles']
                row['nscr_top_left_entries_match'] = (w <= sw and h <= sh and
                    all(screen['entries'][y * w + x] == counterpart['entries'][y * sw + x] for y in range(h) for x in range(w)))
            rows.append(row)
        except (ValueError, OSError) as error:
            failures.append({'path': path, 'error': str(error)})
        if (len(rows) + len(failures)) % 20 == 0:
            print(json.dumps({'backgrounds_rendered': len(rows), 'errors': len(failures)}), flush=True)
    report = {'rom_sha256': rom.nds.sha256, 'rendered': len(rows), 'failures': failures,
              'existing_matches': sum(r.get('existing_pixels_match', False) for r in rows),
              'existing_differences': sum(r.get('existing_pixels_match') is False for r in rows),
              'note': 'Static maps only; layers, palette animation, camera and runtime compositing are not reconstructed.',
              'backgrounds': rows}
    (output / 'background-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('backgrounds', 'failures')}), flush=True)


def audit_sprite_banks(rom, output):
    rows, failures = [], []
    for path in sorted(p for p in rom.paths if p.endswith('.nanr')):
        stem = path[:-5]
        try:
            ch, pal, bank, anim = rom.sprite(stem)
            rendered = [render_cell(ch, pal, bank, cell) for cell in bank['cells']]
            rows.append({'stem': stem, 'source': rom.evidence(path),
                         'sequences': len(anim['sequences']), 'cells': len(rendered),
                         'zero_duration_frames': anim['zero_duration_frames'],
                         'objects': sum(len(c['objects']) for c in bank['cells']),
                         'largest_canvas': [max(im.width for im in rendered), max(im.height for im in rendered)]})
        except (ValueError, OSError) as error:
            failures.append({'stem': stem, 'error': str(error)})
        if (len(rows) + len(failures)) % 200 == 0:
            print(json.dumps({'sprite_banks_rendered': len(rows), 'errors': len(failures)}), flush=True)
    result = {'rom_sha256': rom.nds.sha256, 'rendered_banks': len(rows),
              'rendered_cells': sum(r['cells'] for r in rows), 'failures': failures, 'banks': rows,
              'note': 'All cells rendered and sequence references checked; not visual/gameplay validation of every bank.'}
    (output / 'sprite-bank-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'rendered_banks': len(rows), 'rendered_cells': result['rendered_cells'], 'failures': len(failures)}), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rom', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--sprite', action='append', default=[])
    parser.add_argument('--background', action='append', default=[])
    parser.add_argument('--audit', action='store_true')
    parser.add_argument('--compare-web', action='store_true')
    parser.add_argument('--audit-backgrounds', action='store_true')
    parser.add_argument('--audit-sprites', action='store_true')
    parser.add_argument('--animated-background', action='append', default=[])
    args = parser.parse_args()
    output = destination(args.output_dir)
    rom = GraphicsROM(args.rom)
    if args.audit or args.compare_web:
        audit(rom, output, args.compare_web)
    if args.audit_backgrounds:
        audit_backgrounds(rom, output)
    if args.audit_sprites:
        audit_sprite_banks(rom, output)
    for stem in args.sprite:
        print(json.dumps(export_sprite(rom, stem, output)))
    for stem in args.animated_background:
        bsa = background_animation(rom.read(stem + '.bsa'))
        ch, pal = characters(rom.read(stem + '.ncgr')), palette(rom.read(stem + '.nclr'))
        rendered = [render_background(ch, pal, frame, transparent=True) for frame in bsa['frames']]
        target = output / stem.replace('/', '__')
        target.mkdir(parents=True, exist_ok=True)
        for i, im in enumerate(rendered):
            im.save(target / f'background-frame-{i:02}.png')
        rendered[0].save(target / 'background-animation.png', save_all=True, append_images=rendered[1:],
                         duration=[v * 1000 / 60 for v in bsa['duration_values']], loop=0, disposal=0, blend=0)
        metadata = {k: v for k, v in bsa.items() if k not in ('frames', 'lookup', 'map_indices')}
        metadata.update(rom_sha256=rom.nds.sha256, sources=[rom.evidence(stem + ext) for ext in ('.bsa', '.ncgr', '.nclr')],
                        note='Preview assumes 60Hz and palette index 0 transparency. Runtime layering/speed not verified.')
        (target / 'background-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
        print(json.dumps({'stem': stem, 'frames': len(rendered), 'size': rendered[0].size, 'output': str(target)}))
    for stem in args.background:
        kind = 'nscr' if stem + '.nscr' in rom.paths else 'nbs'
        if stem.endswith(('.nscr', '.nbs')):
            stem, kind = stem.rsplit('.', 1)
        im = render_background(characters(rom.read(stem + '.ncgr')), palette(rom.read(stem + '.nclr')), tilemap(rom.read(stem + '.' + kind), kind))
        path = output / (stem.replace('/', '__') + '.' + kind + '.png')
        im.save(path)
        print(json.dumps({'stem': stem, 'size': im.size, 'output': str(path)}))


if __name__ == '__main__':
    main()
