"""Synthetic-only tests for all-216 private atlas exporter.

The tests never publish or upload generated artwork.
"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "batch_private_atlas",ROOT/"tools"/"export-phaser-roster.py")
batch=importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)


class TestPrivateRoster(unittest.TestCase):
    def make_assets(self,root):
        root=Path(root)
        assets=root/"assets"
        (assets/"sprites"/"rookie").mkdir(parents=True)
        entries=[]
        for i in range(216):
            name="유니몬" if i==215 else f"테스트{i:03d}몬"
            stem="m357_unimon_main" if i==215 else f"m{i+1:03d}_synthetic_main"
            entries.append({"name":name,"stem":stem,"folder":"rookie"})
        (assets/"species-catalog.json").write_text(
            json.dumps({"entries":entries},ensure_ascii=False),encoding="utf-8")
        (assets/"sprite-index.json").write_text(
            json.dumps({"game_species":{}}),encoding="utf-8")
        return assets,entries

    def source(self,assets,entry,action):
        filename=(entry["stem"]+"_"+("5_1" if entry["name"]=="유니몬" and
                  action==5 else str(action))+".gif")
        file=assets/"sprites"/"rookie"/filename
        Image.new("RGB",(8,12),(100,50,180)).save(file,duration=110)

    def test_all_216_is_indexed_only_and_does_not_write_on_verify(self):
        with tempfile.TemporaryDirectory() as tmp:
            assets,entries=self.make_assets(tmp)
            for entry in entries:self.source(assets,entry,0)
            out=Path(tmp)/"private"
            scanned=batch.export_roster(assets,out,actions=(0,),
                                        verify_only=True)
            self.assertEqual(scanned["species"],216)
            self.assertEqual(scanned["actions"],216)
            self.assertFalse(out.exists())
            result=batch.export_roster(assets,out,actions=(0,))
            self.assertEqual(result["species"],216)
            self.assertEqual(result["total"],216)
            cat=json.loads((out/"catalog.json").read_text(encoding="utf-8"))
            self.assertEqual(cat["format"],batch.CATALOG_FORMAT)
            self.assertEqual(len(cat["entries"]),216)
            self.assertEqual(len(list((out/"species").glob("*/action_0.png"))),216)

    def test_missing_gif_fails_before_any_index_or_png_is_written(self):
        with tempfile.TemporaryDirectory() as tmp:
            assets,entries=self.make_assets(tmp)
            self.source(assets,entries[0],0)
            out=Path(tmp)/"no-partial"
            with self.assertRaises(FileNotFoundError):
                batch.export_roster(assets,out,actions=(0,))
            self.assertFalse(out.exists())

    def test_unimon_specific_5_1_and_incremental_species_catalog(self):
        with tempfile.TemporaryDirectory() as tmp:
            assets,entries=self.make_assets(tmp)
            first,unimon=entries[0],entries[-1]
            self.source(assets,first,0)
            self.source(assets,unimon,5)
            result=batch.export_roster(assets,Path(tmp)/"private",
                                       species=[first["name"]],actions=(0,))
            self.assertEqual(result["total"],1)
            result=batch.export_roster(assets,Path(tmp)/"private",
                                       species=["유니몬"],actions=(5,))
            self.assertEqual(result["total"],2)
            self.assertTrue((Path(tmp)/"private"/"species"/
                "m357_unimon_main"/"action_5.png").is_file())
            cat=json.loads((Path(tmp)/"private"/"catalog.json").read_text(encoding="utf-8"))
            self.assertSetEqual(set(cat["entries"]),{first["name"],"유니몬"})

    def test_reject_unknown_and_duplicate_catalog_stems(self):
        with tempfile.TemporaryDirectory() as tmp:
            assets,entries=self.make_assets(tmp)
            with self.assertRaises(ValueError):
                batch.export_roster(assets,Path(tmp)/"out",
                                    species=["존재하지 않는 디지몬"],actions=(0,))
            entries[1]["stem"]=entries[0]["stem"]
            (assets/"species-catalog.json").write_text(
                json.dumps({"entries":entries},ensure_ascii=False),encoding="utf-8")
            with self.assertRaises(ValueError):
                batch.source_entries(assets)

    def test_bad_action_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            assets,_=self.make_assets(tmp)
            for actions in [(0,0),(-1,),(40,),()]:
                with self.assertRaises(ValueError):
                    batch.export_roster(assets,Path(tmp)/"out",actions=actions,
                                        verify_only=True)


if __name__=="__main__":
    unittest.main()
