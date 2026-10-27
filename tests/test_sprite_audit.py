import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image

spec=importlib.util.spec_from_file_location('sprite_audit',Path(__file__).resolve().parents[1]/'tools/audit-sprites.py')
audit_module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)

class SpriteAuditTests(unittest.TestCase):
    def test_decoding_missing_and_corrupt_frames_are_distinguished(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            folder=root/'assets/sprites/test'
            folder.mkdir(parents=True)
            (root/'assets/species-catalog.json').write_text(json.dumps({'entries':[{'name':'fixture','folder':'test','stem':'fixture'}]}))
            (root/'assets/sprite-action-map.json').write_text(json.dumps({'sprite_actions':{'idle':0,'walk':1,'hit':2,'ko':3}}))
            Image.new('RGB',(8,8),'red').save(folder/'fixture_0.gif')
            Image.new('RGB',(8,8),'red').save(folder/'fixture_1.gif',save_all=True,append_images=[Image.new('RGB',(8,8),'blue')],duration=100)
            (folder/'fixture_3.gif').write_bytes(b'GIF89a broken')
            result=audit_module.audit(root)
            self.assertEqual(result['checked_assets'],2)
            self.assertEqual(result['single_frame_by_species'],{'fixture':[0]})
            self.assertEqual(len(result['errors']),2)
            self.assertTrue(any(e['path'].endswith('_2.gif') for e in result['errors']))
            self.assertTrue(any(e['path'].endswith('_3.gif') for e in result['errors']))
            self.assertIn('INFERRED',result['semantic_status'])

if __name__=='__main__':unittest.main()
