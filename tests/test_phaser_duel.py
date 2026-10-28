"""Synthetic private-duel exporter verification: never commits original sprites."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("private_duel_export",
    ROOT / "tools" / "export-phaser-duel.py")
duel=importlib.util.module_from_spec(spec)
spec.loader.exec_module(duel)


class PrivateDuelExport(unittest.TestCase):
    def test_real_species_labels_and_distinct_local_sheets(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            assets=root / "assets"
            sprites=assets / "sprites" / "rookie"
            sprites.mkdir(parents=True)
            species={
                "아구몬":{"folder":"rookie","stem":"fake_agu"},
                "가부몬":{"folder":"rookie","stem":"fake_gabu"}
            }
            (assets / "sprite-index.json").write_text(json.dumps({
                "game_species":species
            },ensure_ascii=False),encoding="utf8")
            for name,item in species.items():
                color=(255,50,30) if name=="아구몬" else (30,100,255)
                for action in duel.atlas.DEFAULT_ACTIONS:
                    im=Image.new("RGBA",(24,24),color+(255,))
                    im.save(sprites / f"{item['stem']}_{action}.gif",
                            duration=110)
            dest=root / "local-assets"
            result=duel.export_duel(assets,dest)
            self.assertEqual([x[0] for x in result],["아구몬","가부몬"])
            files=[]
            for name,folder,n in result:
                self.assertEqual(n,len(duel.atlas.DEFAULT_ACTIONS))
                manifest=json.loads(
                    (dest/folder/"manifest.json").read_text(encoding="utf8"))
                self.assertEqual(manifest["species"],name)
                self.assertIn("37",manifest["actions"])
                self.assertIn("33",manifest["actions"])
                self.assertIn("10",manifest["actions"])
                files.append(dest/folder/"action_0.png")
            self.assertNotEqual(files[0].read_bytes(),files[1].read_bytes(),
                                "never reuse Agumon's art for Gabumon")
            self.assertFalse((dest/"manifest.json").exists(),
                             "must not overwrite legacy one-species output")

    def test_missing_species_does_not_write_a_fake_other_species_manifest(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            assets=root/"assets"
            sprites=assets/"sprites"/"rookie"
            sprites.mkdir(parents=True)
            (assets/"sprite-index.json").write_text(json.dumps({
                "game_species":{"아구몬":{"folder":"rookie","stem":"agu"},
                                "가부몬":{"folder":"rookie","stem":"gabu"}}},
                ensure_ascii=False),encoding="utf8")
            with self.assertRaises(FileNotFoundError):
                duel.export_duel(assets,root/"local-assets")
            self.assertFalse((root/"local-assets"/"duel-gabumon"/"manifest.json").exists())


if __name__=="__main__":
    unittest.main()
