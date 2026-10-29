"""Local 1.0 launcher tests: no ROM, sprites or browser network needed."""
import importlib.util
import json
import tempfile
import unittest
import functools
import http.server
import threading
from contextlib import redirect_stdout
from io import StringIO
from unittest import mock
from PIL import Image
from urllib.error import HTTPError
from urllib.request import urlopen
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
                "format":"digi-phaser-local-atlas-v1",
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

    def test_fixes_only_the_species_with_missing_sheet_or_bad_manifest(self):
        self.create_fake_sheets()
        healthy=self.root/"species"/"m007_test"/"action_0.png"
        healthy.write_bytes(b"KEEP THIS HEALTHY ORIGINAL")
        damaged=self.root/"species"/"m001_test"/"action_10.png"
        damaged.unlink()
        stale_manifest=self.root/"species"/"m002_test"/"manifest.json"
        manifest=json.loads(stale_manifest.read_text(encoding="utf-8"))
        manifest["species"]="wrong"  # corrupt identity
        stale_manifest.write_text(json.dumps(manifest),encoding="utf-8")
        self.assertEqual(mod.missing_art(self.entries,self.root),
                         ["시험종001","시험종002"])

        # Only these two names need input GIFs. Source catalog has all
        # 216 entries and all 216 names are still explicitly validated.
        assets=self.root/"assets"
        (assets/"sprites"/"rookie").mkdir(parents=True)
        entries=[{**entry,"folder":"rookie"} for entry in self.entries]
        (assets/"species-catalog.json").write_text(
            json.dumps({"entries":entries},ensure_ascii=False),
            encoding="utf-8")
        (assets/"sprite-index.json").write_text(
            json.dumps({"game_species":{}}),encoding="utf-8")
        for index in [1,2]:
            entry=self.entries[index]
            for action in mod.ACTIONS:
                Image.new("RGB",(8,12),(40,80,120)).save(
                    assets/"sprites"/"rookie"/
                    f"{entry['stem']}_{action}.gif",
                    duration=110)
        with mock.patch.object(mod,"ASSETS",assets),mock.patch.object(
                mod,"LOCAL",self.root):
            with redirect_stdout(StringIO()) as text:
                mod.prepare_art()
            self.assertIn("only 2 missing/incomplete",text.getvalue())
            self.assertEqual(mod.missing_art(self.entries,self.root),[])
            self.assertEqual(healthy.read_bytes(),b"KEEP THIS HEALTHY ORIGINAL")
            one=(self.root/"species"/"m001_test"/"action_10.png")
            self.assertGreater(one.stat().st_size,50)
            previous=one.read_bytes()
            with redirect_stdout(StringIO()) as repeated:
                mod.prepare_art()
            self.assertIn("reusing all files",repeated.getvalue())
            self.assertEqual(one.read_bytes(),previous)

    def test_empty_atlas_file_and_bad_catalog_detected_without_overwrite(self):
        self.create_fake_sheets()
        empty=self.root/"species"/"m039_test"/"action_30.png"
        empty.write_bytes(b"")
        self.assertEqual(mod.missing_art(self.entries,self.root),
                         ["시험종039"])
        index=self.root/"catalog.json"
        index.write_text("not json",encoding="utf-8")
        self.assertFalse(mod.catalog_ready(self.entries,self.root))
        with self.assertRaisesRegex(ValueError,"unreadable"):
            mod.missing_art(self.entries,self.root)
        self.assertEqual(empty.read_bytes(),b"")
        
    def test_local_server_never_serves_rom_saves_git_or_hidden_files(self):
        (self.root/"index.html").write_text("safe game",encoding="utf-8")
        (self.root/"secret.nds").write_bytes(b"private ROM")
        (self.root/".git").mkdir()
        (self.root/".git"/"config").write_text("private token",encoding="utf-8")
        (self.root/"tools").mkdir()
        (self.root/"tools"/"internal.py").write_text("secret",encoding="utf-8")
        handler=functools.partial(mod.GameFileHandler,directory=str(self.root))
        server=http.server.ThreadingHTTPServer(("127.0.0.1",0),handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        self.addCleanup(lambda:(server.shutdown(),server.server_close(),
                                thread.join(timeout=2)))
        base=f"http://127.0.0.1:{server.server_port}"
        with urlopen(base+"/index.html",timeout=3) as response:
            self.assertEqual(response.read(),b"safe game")
        for path in ["/secret.nds","/.git/config","/%2Egit/config",
                     "/tools/internal.py"]:
            with self.subTest(path=path),self.assertRaises(HTTPError) as error:
                urlopen(base+path,timeout=3)
            self.assertEqual(error.exception.code,404)

    def test_windows_double_click_launcher_stays_private_and_uses_real_game(self):
        text=(ROOT/"PLAY_ON_PC.bat").read_text(encoding="utf-8")
        self.assertIn('cd /d "%~dp0"',text)
        self.assertIn('py -3 tools\\play_local.py',text)
        self.assertNotIn('--lan',text)
        self.assertNotIn('--skip-art',text)
        self.assertNotIn('format c:',text.lower())

    def test_invalid_port_refused_before_network_or_art_access(self):
        with self.assertRaises(SystemExit) as error:
            mod.main(["--port","0","--skip-art","--no-browser"])
        self.assertEqual(error.exception.code,2)


if __name__=="__main__":
    unittest.main()
