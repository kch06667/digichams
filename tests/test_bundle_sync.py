"""Source-of-truth and both packaged HTML build synchronization checks."""
from pathlib import Path
import re, unittest
ROOT=Path(__file__).resolve().parents[1]

class BundleSync(unittest.TestCase):
 def test_code_inlining(self):
  ids={'farm-core-v0143':'farm-core.js','hex-farm-v0143':'hex-farm-ui.js'}
  for htmlname in ['index.html','standalone.html']:
   text=(ROOT/htmlname).read_text()
   for block,src in ids.items():
    m=re.search(r'<script id="'+block+r'">(.*?)</script>',text,re.S)
    self.assertIsNotNone(m,(htmlname,block))
    self.assertEqual(m.group(1).strip(),(ROOT/'src'/src).read_text().strip(),(htmlname,block))
 def test_graphics_tournament_and_codex_features(self):
  for name in ['index.html','standalone.html']:
   text=(ROOT/name).read_text()
   for required in ['v0.23.2 map visual skin','championshipBracketGrid','function validateSaveStructures','function reserveStation','function safeStride','function drawStatus','<script id="championship-core-v023">','<script id="championship-ui-v023">']:
    self.assertIn(required,text,(name,required))
   self.assertIn('hex_farm_v0232.webp' if name=='index.html' else 'data:image/webp;base64',text)
 def test_no_raw_rom_bundled(self):
  self.assertFalse(any(ROOT.rglob('*.nds')))

if __name__=='__main__':unittest.main()
