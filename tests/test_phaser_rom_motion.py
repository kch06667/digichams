"""ROM battle graphics audit: no ROM/sprite files published or written."""
import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "battle_rom_audit",ROOT/"tools"/"audit-phaser-rom-battle.py")
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class BattleRomAuditTests(unittest.TestCase):
    def test_all_indexed_gifs_have_real_frame_timing_and_action_provenance(self):
        proof=audit.inspect_gifs(ROOT/"assets")
        self.assertEqual(proof["species"],216)
        self.assertEqual(proof["gifFiles"],8640)
        self.assertGreaterEqual(proof["frames"],8640)
        self.assertGreater(proof["animatedGifFiles"],0)
        self.assertGreater(proof["tenMsFrames"],0)
        self.assertEqual(proof["userConfirmed"],{30:"victory",32:"training"})
        for action in (5,31,37):
            self.assertEqual(proof["byAction"][str(action)]["files"],216)
        self.assertEqual(proof["byAction"]["30"]["animated"],216)
        # Specific project source data, not an imagined NDS skill table.
        self.assertEqual(proof["byAction"]["37"]["animated"],0)

    def test_overlay_pointer_strings_can_be_verified_without_inventing_skill_ids(self):
        contents=bytearray(14000)
        rom_offset=512
        ram_base=0x02100000
        table_offset=0x100
        entries=[]
        for i in range(1,152):
            name=f"e003_mock{i:03d}"
            pointer=ram_base+0x800+i*32
            pos=rom_offset+table_offset+(i-1)*4
            contents[pos:pos+4]=pointer.to_bytes(4,"little")
            string_pos=rom_offset+pointer-ram_base
            contents[string_pos:string_pos+len(name)+1]=name.encode()+b"\0"
            entries.append({"effect_index":i,
              "table_offset":hex(table_offset+(i-1)*4),
              "name_pointer":hex(pointer),"name":name})
        registry={"rom_sha256":hashlib.sha256(contents).hexdigest(),
            "rom_offset":hex(rom_offset),"load_ram":hex(ram_base),
            "table_overlay_offset":hex(table_offset),"entries":entries,
            "named_effect_entries":151}
        result=audit.verify_rom_registry(contents,registry)
        self.assertEqual(result["verifiedNamePointers"],151)
        self.assertFalse(result["techniqueToEffectMappingVerified"])
        tampered=bytearray(contents)
        tampered[rom_offset+table_offset]^=1
        with self.assertRaisesRegex(ValueError,"SHA-256"):
            audit.verify_rom_registry(tampered,registry)
        bad=json.loads(json.dumps(registry))
        bad["entries"][0]["name"]="different"
        with self.assertRaisesRegex(ValueError,"Unexpected name"):
            audit.verify_rom_registry(contents,bad)


if __name__=="__main__":
    unittest.main()
