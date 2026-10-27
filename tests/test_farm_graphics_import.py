"""Safety tests for the v0.23.2 CSS/asset-only importer. No actual ROM/graphics ZIP needed."""
import hashlib
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "import-farm-graphics-v0232.py"
spec = importlib.util.spec_from_file_location("farm_graphics_import", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

ORIGINAL = "/* Progressive v0.14.3 override of legacy horizontal corridor */\n.old{color:red}\n"
SKIN = mod.MARKER + '\n#farmPanel .farmWorld{background-image:url("assets/farm/hex_farm_v0232.webp")}\n'
JS = '<script id="hex-farm-v0143">window.existingGame = true;</script>'


class ImportSafety(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "src").mkdir()
        (self.root / "src/hex-farm.css").write_text(ORIGINAL, encoding="utf-8")
        self.html = '<!doctype html><style id="hex-farm-style-v0143">' + ORIGINAL + '</style>' + JS
        for page in mod.HTML_FILES:
            (self.root / page).write_text(self.html, encoding="utf-8")
        self.art = b"RIFF\x01\x02\x03\x04WEBP" + bytes(range(10))
        self.zip = self.root / "art.zip"
        with zipfile.ZipFile(self.zip, "w") as z:
            z.writestr(mod.CSS_FILE, ORIGINAL + SKIN)
            z.writestr(mod.ASSET_FILE, self.art)
        self.old_hash = mod.EXPECTED_SHA256
        mod.EXPECTED_SHA256 = hashlib.sha256(self.art).hexdigest()
        self.addCleanup(lambda: setattr(mod, "EXPECTED_SHA256", self.old_hash))

    def test_css_only_import_preserves_both_game_scripts_and_is_idempotent(self):
        changed, size = mod.import_skin(self.root, self.zip)
        self.assertEqual(set(changed), {"src/hex-farm.css", "assets/farm/hex_farm_v0232.webp", *mod.HTML_FILES})
        self.assertEqual(size, len(self.art))
        self.assertEqual((self.root / mod.ASSET_FILE).read_bytes(), self.art)
        for page in mod.HTML_FILES:
            html = (self.root / page).read_text()
            self.assertIn(JS, html)
            self.assertIn(".old{color:red}", html)
            self.assertEqual(html.count(mod.MARKER), 1)
            if page == "index.html":
                self.assertIn('url("assets/farm/hex_farm_v0232.webp")', html)
            else:
                self.assertIn("data:image/webp;base64,", html)
        self.assertEqual(mod.import_skin(self.root, self.zip)[0], [])

    def test_invalid_image_makes_no_changes(self):
        mod.EXPECTED_SHA256 = "invalid"
        with self.assertRaises(ValueError):
            mod.import_skin(self.root, self.zip)
        self.assertFalse((self.root / mod.ASSET_FILE).exists())
        self.assertEqual((self.root / "index.html").read_text(), self.html)

    def test_missing_second_css_block_makes_no_changes(self):
        (self.root / "standalone.html").write_text(JS)
        with self.assertRaises(ValueError):
            mod.import_skin(self.root, self.zip)
        self.assertFalse((self.root / mod.ASSET_FILE).exists())
        self.assertEqual((self.root / "index.html").read_text(), self.html)


if __name__ == "__main__":
    unittest.main()
