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

    def test_full_catalog_unimon_uses_corrected_hit_not_surprise(self):
        with tempfile.TemporaryDirectory() as scratch:
            base = Path(scratch)
            assets = base / "assets"
            sprites = assets / "sprites/champion"
            sprites.mkdir(parents=True)
            (assets / "sprite-index.json").write_text(json.dumps({"game_species": {}}))
            item = {"name": "유니몬", "folder": "champion", "stem": "m357_unimon_main"}
            (assets / "species-catalog.json").write_text(json.dumps({"entries": [item]}))
            Image.new("RGB", (8, 8), "red").save(sprites / "m357_unimon_main_4.gif", duration=610)
            Image.new("RGB", (8, 8), "blue").save(sprites / "m357_unimon_main_5_1.gif", duration=110)
            result = mod.export("유니몬", assets, base / "out", [4, 5])
            self.assertEqual(result["actions"]["5"]["durationsMs"], [110])
            with Image.open(base / "out/action_5.png") as hit:
                self.assertEqual(hit.getpixel((0, 0)), (0, 0, 255, 255))
            with Image.open(base / "out/action_4.png") as surprise:
                self.assertEqual(surprise.getpixel((0, 0)), (255, 0, 0, 255))

    def test_legacy_index_takes_precedence_and_unknown_species_still_rejected(self):
        with tempfile.TemporaryDirectory() as scratch:
            assets = Path(scratch)
            (assets / "sprite-index.json").write_text(json.dumps({"game_species": {
                "same": {"folder": "rookie", "stem": "legacy"}}}))
            (assets / "species-catalog.json").write_text(json.dumps({"entries": [
                {"name": "same", "folder": "mega", "stem": "different"}]}))
            self.assertEqual(mod.resolve_species("same", assets), ("rookie", "legacy"))
            with self.assertRaises(ValueError):
                mod.resolve_species("missing", assets)

    def test_catalog_rejects_ambiguous_names_and_unsafe_paths(self):
        with tempfile.TemporaryDirectory() as scratch:
            assets = Path(scratch)
            (assets / "sprite-index.json").write_text(json.dumps({"game_species": {}}))
            item = {"name": "new", "folder": "rookie", "stem": "valid"}
            for entries in [[item, item], [dict(item, folder="../private")]]:
                (assets / "species-catalog.json").write_text(json.dumps({"entries": entries}))
                with self.assertRaises(ValueError):
                    mod.resolve_species("new", assets)


if __name__ == "__main__":
    unittest.main()
