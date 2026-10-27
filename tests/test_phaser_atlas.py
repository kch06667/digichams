"""Synthetic-only conversion smoke tests: NEVER writes extracted ROM artwork."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("export_phaser_atlas", ROOT / "tools" / "export-phaser-atlas.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class TestAtlas(unittest.TestCase):
    def test_two_actions_use_same_cell_and_preserve_frame_counts(self):
        with tempfile.TemporaryDirectory() as scratch:
            base = Path(scratch)
            assets = base / "assets"
            sprite_dir = assets / "sprites" / "rookie"
            sprite_dir.mkdir(parents=True)
            catalog = {"game_species": {"테스트": {"folder": "rookie", "stem": "synthetic"}}}
            (assets / "sprite-index.json").write_text(json.dumps(catalog), encoding="utf-8")
            a = Image.new("RGBA", (16, 24), (255, 0, 0, 255))
            b = Image.new("RGBA", (16, 24), (0, 0, 255, 255))
            a.save(sprite_dir / "synthetic_30.gif", save_all=True, append_images=[b],
                   duration=[160, 610], loop=0, disposal=2)
            c = Image.new("RGBA", (32, 28), (255, 255, 0, 255))
            c.save(sprite_dir / "synthetic_32.gif", save_all=True, duration=110)
            out = base / "out"
            m = mod.export("테스트", assets, out, [30, 32])
            self.assertEqual(m["actions"]["30"]["frames"], 2)
            self.assertEqual(m["actions"]["32"]["frames"], 1)
            self.assertEqual(m["actions"]["30"]["frameWidth"], 32)
            self.assertEqual(m["actions"]["32"]["frameHeight"], 28)
            with Image.open(out / "action_30.png") as sheet:
                self.assertEqual(sheet.size, (64, 28))
            self.assertTrue((out / "manifest.json").exists())
            self.assertEqual(json.loads((out / "manifest.json").read_text(encoding="utf-8"))["species"], "테스트")

    def test_index_path_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as scratch:
            assets = Path(scratch) / "assets"
            assets.mkdir()
            (assets / "sprite-index.json").write_text(
                json.dumps({"game_species":{"bad":{"folder":"../private","stem":"file"}}}), encoding="utf-8")
            with self.assertRaises(ValueError):
                mod.export("bad", assets, Path(scratch) / "out", [30])


if __name__ == "__main__":
    unittest.main()
