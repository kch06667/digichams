"""Synthetic spatial/scene records, without original assets."""
import struct
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import rom_scene as s


def string(value):
    raw = value.encode('ascii')
    return struct.pack('<I', len(raw)) + raw + bytes((-len(raw)) % 4)


class SceneTests(unittest.TestCase):
    def test_grids_preserve_values_and_source_offsets(self):
        for version in (1, 2):
            raw = b'DATR' + struct.pack('<III', version, 2, 2) + bytes([0, 2, 4, 6])
            parsed = s.grid(raw, 'atr')
            self.assertEqual(parsed['values'], [0, 2, 4, 6])
            self.assertEqual(parsed['data_offset'], 16)
            self.assertEqual(parsed['histogram'], {0: 1, 2: 1, 4: 1, 6: 1})
        self.assertEqual(s.grid(bytes([1, 2, 1, 3, 7]), 'col')['values'], [3, 7])
        self.assertEqual(s.grid(struct.pack('<BHHBB', 1, 2, 1, 14, 15), 'esc')['values'], [14, 15])

    def test_grid_dimensions_must_explain_full_payload(self):
        for raw in [bytes([1, 2, 2, 0]), bytes([1, 0, 0]), bytes([1, 1, 1, 0, 1])]:
            with self.assertRaises(ValueError):
                s.grid(raw, 'col')

    def test_string_exact_multiple_of_four_has_no_extra_terminator(self):
        raw = string('four') + string('other')
        name, end = s.aligned_string(raw, 0)
        self.assertEqual((name, end), ('four', 8))
        self.assertEqual(s.aligned_string(raw, end), ('other', len(raw)))

    def test_scene_records_and_sentinel_reference_preserved(self):
        raw = b'NXSR' + struct.pack('<III', 1, 1, 1) + string('bank') + string('item')
        raw += struct.pack('<iiffffffI', -1, 2, 12, -3, 0, 0, 1, 1, 0xffffffff)
        parsed = s.scene(raw)
        self.assertEqual(parsed['resources'], ['bank'])
        row = parsed['records'][0]
        self.assertEqual(row['resource_index_candidate'], -1)
        self.assertEqual(row['float_fields'][:2], [12, -3])
        with self.assertRaises(ValueError):
            s.scene(raw + bytes(4))

    def test_opm_packed_flags_remain_separate_from_candidate_index(self):
        raw = b'OPMD' + struct.pack('<I', 4) + bytes([3]) + b'obj' + bytes(4)
        raw += struct.pack('<I', 1) + struct.pack('<Hhhhff', 0x6002, -10, 20, -1, 1, 0)
        parsed = s.objects(raw)
        row = parsed['records'][0]
        self.assertEqual(row['packed_index'], 0x6002)
        self.assertEqual(row['animation_index_candidate'], 2)
        self.assertEqual(row['high_flags'], 0x6000)
        self.assertEqual(row['position_candidates'], [-10, 20, -1])
        with self.assertRaises(ValueError):
            s.objects(raw[:-1])

    def test_nonfinite_transform_is_rejected(self):
        raw = b'NXSR' + struct.pack('<III', 1, 1, 0) + string('bad')
        raw += struct.pack('<iiffffffI', -1, 0, float('nan'), 0, 0, 0, 1, 1, 0)
        with self.assertRaises(ValueError):
            s.scene(raw)

    def test_distance_hypothesis_reports_counterexamples(self):
        # A 5x5 square with zero border and distance two in its center.
        values = [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 2, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]
        grid = {'width': 5, 'height': 5, 'values': values}
        self.assertEqual(s.distance_model(grid)['mismatch_count'], 0)
        grid['values'][12] = 7
        self.assertEqual(s.distance_model(grid)['mismatches'], [{'x': 2, 'y': 2, 'actual': 7, 'model': 2}])

    def test_distance_hypothesis_includes_zero_outside_boundary(self):
        grid = {'width': 3, 'height': 3, 'values': [1, 1, 1, 1, 2, 1, 1, 1, 1]}
        self.assertEqual(s.distance_model(grid)['mismatch_count'], 0)


if __name__ == '__main__':
    unittest.main()
