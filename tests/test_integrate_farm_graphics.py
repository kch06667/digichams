"""Regression for source-safe v0.23.2 CSS and WebP import."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

TOOL = Path(__file__).resolve().parents[1] / 'tools' / 'integrate-farm-graphics-v0232.py'
spec = importlib.util.spec_from_file_location('farm_skin_import', TOOL)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class FarmGraphicsIntegration(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'src').mkdir()
        self.css = '/* Progressive v0.14.3 override */\n#farmPanel{display:block}\n'
        (self.root / 'src/hex-farm.css').write_text(self.css)
        for n in ('index.html', 'standalone.html'):
            (self.root / n).write_text('<style>' + self.css + '</style><script>gameEngine()</script>')
        self.archive = self.root / 'graphics.zip'
        self.art = b'RIFF\x04\x00\x00\x00WEBPtest'
        with zipfile.ZipFile(self.archive, 'w') as z:
            z.writestr('assets/farm/hex_farm_v0232.webp', self.art)
            z.writestr('src/hex-farm.css', self.css + module.MARKER + '\n#farmPanel .farmWorld{background-image:url("' + module.IMAGE_PATH + '");}')

    def test_skin_only_and_duplicate_protection(self):
        changed = module.apply(self.root, self.archive)
        self.assertEqual(len(changed), 4)
        self.assertEqual((self.root / module.IMAGE_PATH).read_bytes(), self.art)
        for n in ('index.html', 'standalone.html'):
            html = (self.root / n).read_text()
            self.assertIn('<script>gameEngine()</script>', html)
            self.assertEqual(html.count(module.MARKER), 1)
        self.assertIn('data:image/webp;base64,', (self.root / 'standalone.html').read_text())
        self.assertNotIn('data:image/webp;base64,', (self.root / 'index.html').read_text())
        with self.assertRaisesRegex(ValueError, 'Already integrated'):
            module.apply(self.root, self.archive)

    def test_mismatch_blocks_all_writes(self):
        original = (self.root / 'index.html').read_bytes()
        (self.root / 'standalone.html').write_text('out of sync')
        with self.assertRaisesRegex(ValueError, 'inline CSS differs'):
            module.apply(self.root, self.archive)
        self.assertEqual((self.root / 'index.html').read_bytes(), original)
        self.assertFalse((self.root / module.IMAGE_PATH).exists())

    def test_dry_run_is_read_only(self):
        module.apply(self.root, self.archive, dry_run=True)
        self.assertEqual((self.root / 'src/hex-farm.css').read_text(), self.css)
        self.assertFalse((self.root / module.IMAGE_PATH).exists())

if __name__ == '__main__':
    unittest.main()
