"""Inspect spatial grids and scene/object records; field meanings stay provisional.

Raw rows and source offsets are reproducible. Candidate animation/position fields
do not establish collision rules, walkability, camera composition or game AI.
"""
import argparse
from collections import Counter, deque
import json
import math
from pathlib import Path

from rom_graphics import GraphicsROM, animations, destination, span, unpack


def grid(data, kind):
    if kind == 'atr':
        if span(data, 0, 4) != b'DATR':
            raise ValueError('ATR signature missing')
        version, width, height = unpack(data, 4, 'III')
        start = 16
        if version not in (1, 2):
            raise ValueError('Unsupported ATR version')
    elif kind == 'col':
        version, width, height = unpack(data, 0, 'BBB')
        start = 3
        if version != 1:
            raise ValueError('Unsupported COL version')
    elif kind == 'esc':
        version, width, height = unpack(data, 0, 'BHH')
        start = 5
        if version != 1:
            raise ValueError('Unsupported ESC version')
    else:
        raise ValueError('Unknown grid type')
    if not (0 < width <= 512 and 0 < height <= 512) or len(data) != start + width * height:
        raise ValueError('Grid dimensions/payload mismatch')
    payload = span(data, start, width * height)
    return {'version': version, 'width': width, 'height': height, 'data_offset': start,
            'values': list(payload), 'histogram': dict(Counter(payload)),
            'confidence': {'layout': 'ROM_VERIFIED', 'value_meanings': 'INFERRED'}}


def aligned_string(data, pos):
    length, = unpack(data, pos, 'I')
    start = pos + 4
    value = span(data, start, length).decode('ascii')
    end = (start + length + 3) & ~3
    if any(span(data, start + length, end - start - length)):
        raise ValueError('Nonzero string padding')
    return value, end


def scene(data):
    if span(data, 0, 4) != b'NXSR':
        raise ValueError('NXR signature missing')
    version, count, resource_count = unpack(data, 4, 'III')
    if version != 1 or count > 4096 or resource_count > 4096:
        raise ValueError('Unsupported scene size/version')
    pos, resources, rows = 16, [], []
    for i in range(resource_count):
        name, pos = aligned_string(data, pos)
        resources.append(name)
    for i in range(count):
        name, pos = aligned_string(data, pos)
        resource, sequence, x, y, z, angle, sx, sy, flags = unpack(data, pos, 'iiffffffI')
        numbers = [x, y, z, angle, sx, sy]
        if not all(math.isfinite(v) for v in numbers):
            raise ValueError('Nonfinite scene transform candidate')
        rows.append({'record_index': i, 'name': name, 'file_offset': pos,
                     'resource_index_candidate': resource, 'animation_index_candidate': sequence,
                     'float_fields': numbers, 'raw_flags': flags})
        pos += 36
    if pos != len(data):
        raise ValueError('Unparsed scene tail')
    return {'version': version, 'resources': resources, 'records': rows,
            'confidence': {'layout': 'ROM_VERIFIED', 'field_meanings': 'INFERRED'}}


def objects(data):
    if span(data, 0, 4) != b'OPMD':
        raise ValueError('OPM signature missing')
    version, length = unpack(data, 4, 'IB')
    if version != 4:
        raise ValueError('Unsupported OPM version')
    resource = span(data, 9, length).decode('ascii')
    pos = (9 + length + 4) & ~3
    if any(span(data, 9 + length, pos - 9 - length)):
        raise ValueError('Nonzero OPM name padding')
    count, = unpack(data, pos, 'I')
    pos += 4
    if pos + count * 16 != len(data):
        raise ValueError('OPM record count mismatch')
    rows = []
    for i in range(count):
        at = pos + i * 16
        packed, x, y, z, scale, angle = unpack(data, at, 'Hhhhff')
        if not math.isfinite(scale) or not math.isfinite(angle):
            raise ValueError('Nonfinite OPM transform candidate')
        rows.append({'record_index': i, 'file_offset': at, 'packed_index': packed,
                     'animation_index_candidate': packed & 0x1fff,
                     'high_flags': packed & 0xe000, 'position_candidates': [x, y, z],
                     'float_fields': [scale, angle]})
    return {'version': version, 'resource': resource, 'records': rows,
            'confidence': {'layout': 'ROM_VERIFIED', 'field_meanings': 'INFERRED'},
            'note': 'High-bit flip meanings and coordinate origin remain unverified.'}


def distance_model(grid_data, diagonals=True):
    """Test a mathematical model, NOT a recovered game collision algorithm."""
    w, h, values = grid_data['width'], grid_data['height'], grid_data['values']
    distances, queue = [w + h + 1] * (w * h), deque()
    for i, value in enumerate(values):
        if value == 0:
            distances[i] = 0
            queue.append(i)
    for i, value in enumerate(values):
        if value and (i % w in (0, w - 1) or i // w in (0, h - 1)):
            distances[i] = 1
            queue.append(i)
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    if diagonals:
        directions += [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    while queue:
        i = queue.popleft()
        x, y = i % w, i // w
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if distances[j] > distances[i] + 1:
                    distances[j] = distances[i] + 1
                    queue.append(j)
    mismatches = [{'x': i % w, 'y': i // w, 'actual': value, 'model': distances[i]}
                  for i, value in enumerate(values) if value != distances[i]]
    return {'algorithm': '8-neighbor distance to zero/outside' if diagonals else '4-neighbor distance to zero/outside',
            'mismatch_count': len(mismatches), 'mismatches': mismatches,
            'interpretation_confidence': 'INFERRED: mathematical match does not prove runtime meaning'}


def analyze(rom, output):
    rows, failures, counts = [], [], Counter()
    paths_by_lower = {}
    for path in rom.paths:
        paths_by_lower.setdefault(path.lower(), []).append(path)
    for path in sorted(rom.paths):
        kind = Path(path).suffix[1:]
        if kind not in ('atr', 'col', 'esc', 'nxr', 'opm'):
            continue
        try:
            b = rom.read(path)
            result = scene(b) if kind == 'nxr' else objects(b) if kind == 'opm' else grid(b, kind)
            result['source'] = rom.evidence(path)
            if kind == 'col':
                result['distance_models'] = [distance_model(result, True), distance_model(result, False)]
            if kind == 'opm':
                target = str(Path(path).parent / result['resource']) + '.nanr'
                candidates = paths_by_lower.get(target.lower(), [])
                result['bank_candidates'] = candidates
                if len(candidates) == 1:
                    anim = animations(rom.read(candidates[0]))
                    n = len(anim['sequences'])
                    result['bank_sequence_count'] = n
                    result['out_of_range_candidate_indices'] = [o['record_index'] for o in result['records'] if o['animation_index_candidate'] >= n]
            rows.append(result)
            counts[kind] += 1
        except (ValueError, UnicodeError) as error:
            failures.append({'path': path, 'error': str(error)})
    report = {'rom_sha256': rom.nds.sha256, 'parsed': dict(counts), 'failures': failures,
              'note': 'Raw structure extraction; collision, escape and gameplay semantics are not verified.',
              'files': rows}
    (output / 'scene-spatial-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'parsed': dict(counts), 'failures': failures,
                      'opm_records': sum(len(r['records']) for r in rows if r['source']['path'].endswith('.opm')),
                      'nxr_records': sum(len(r['records']) for r in rows if r['source']['path'].endswith('.nxr'))}))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--rom', required=True, type=Path)
    p.add_argument('--output-dir', required=True, type=Path)
    args = p.parse_args()
    output = destination(args.output_dir)
    analyze(GraphicsROM(args.rom), output)


if __name__ == '__main__':
    main()
