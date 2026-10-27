"""Assert that the verified v0.23.2 art is present and identical in both builds.

This is an integration-only guard. Do not run it on older checkpoints without
assets/farm/hex_farm_v0232.webp.
"""
import base64
import hashlib
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "assets/farm/hex_farm_v0232.webp"
EXPECTED_SHA256 = "67f92692d36b8cedae3db3abe6293c2e757799d57600acb6eac0eb96cc8ebccc"
MARKER = "/* v0.23.2 map visual skin (presentation only): independent of simulation code */"
STYLE = re.compile(r'<style id="hex-farm-style-v0143">(.*?)</style>', re.S)

class FarmGraphicsIntegration(unittest.TestCase):
    def test_verified_asset_and_canonical_css(self):
        art = (ROOT / IMAGE).read_bytes()
        self.assertEqual(len(art), 106788)
        self.assertEqual(hashlib.sha256(art).hexdigest(), EXPECTED_SHA256)
        self.assertEqual(art[:4], b'RIFF')
        self.assertEqual(art[8:12], b'WEBP')
        css = (ROOT / 'src/hex-farm.css').read_text(encoding='utf-8')
        self.assertEqual(css.count(MARKER), 1)
        self.assertIn('background-image:url("' + IMAGE + '")', css)

    def test_index_and_standalone_style_only(self):
        art = (ROOT / IMAGE).read_bytes()
        css = (ROOT / 'src/hex-farm.css').read_text(encoding='utf-8')
        inline_url = "data:image/webp;base64," + base64.b64encode(art).decode('ascii')
        for page, expected_css in (
            ('index.html', css),
            ('standalone.html', css.replace(IMAGE, inline_url)),
        ):
            with self.subTest(page=page):
                source = (ROOT / page).read_text(encoding='utf-8')
                matches = STYLE.findall(source)
                self.assertEqual(len(matches), 1, 'farm CSS block missing or duplicated')
                self.assertEqual(matches[0], expected_css, 'game HTML farm style is out of sync')
                self.assertIn('id="farm-core-v0143"', source)
                self.assertIn('id="hex-farm-v0143"', source)

if __name__ == '__main__':
    unittest.main()
