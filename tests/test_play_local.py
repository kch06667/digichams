"""Local 1.0 launcher tests: no ROM, sprites or browser network needed."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "playable_quickstart",ROOT/"tools"/"play_local.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class LocalQuickstartTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.entries=[{"name":f"시험종{i:03}","stem":f"m{i:03}_test"}
                      for i in range(216)]

    def create_fake_sheets(self):
        records={}
        for entry in self.entries:
            folder=self.root/"species"/entry["stem"]
            folder.mkdir(parents=True)
            actions={}
            for n in mod.ACTIONS:
                path=folder/f"action_{n}.png"
                path.write_bytes(b"not genuine art - metadata-only test")
                actions[str(n)]={"file":path.name}
            (folder/"manifest.json").write_text(json.dumps({
                "species":entry["name"],"actions":actions
            }),encoding="utf-8")
            records[entry["name"]]={"folder":"species/"+entry["stem"],
                                     "actions":len(mod.ACTIONS)}
        (self.root/"catalog.json").write_text(json.dumps({
            "format":"digi-phaser-local-species-catalog-v1",
            "entries":records
        }),encoding="utf-8")

    def test_empty_private_cache_requires_conversion(self):
        self.assertFalse(mod.catalog_ready(self.entries,self.root))

    def test_complete_216_species_cache_is_reused_without_changing_files(self):
        self.create_fake_sheets()
        file=self.root/"catalog.json"
        original=file.read_bytes()
        self.assertTrue(mod.catalog_ready(self.entries,self.root))
        self.assertEqual(file.read_bytes(),original)

    def test_missing_single_action_and_bad_identity_require_rebuild(self):
        self.create_fake_sheets()
        (self.root/"species"/"m214_test"/"action_37.png").unlink()
        self.assertFalse(mod.catalog_ready(self.entries,self.root))
        (self.root/"species"/"m214_test"/"action_37.png").write_bytes(b"stub")
        manifest=self.root/"species"/"m100_test"/"manifest.json"
        data=json.loads(manifest.read_text(encoding="utf-8"))
        data["species"]="wrong species"
        manifest.write_text(json.dumps(data),encoding="utf-8")
        self.assertFalse(mod.catalog_ready(self.entries,self.root))

    def test_invalid_port_refused_before_network_or_art_access(self):
        with self.assertRaises(SystemExit) as error:
            mod.main(["--port","0","--skip-art","--no-browser"])
        self.assertEqual(error.exception.code,2)


if __name__=="__main__":
    unittest.main()
