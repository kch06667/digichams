#!/usr/bin/env python3
"""Synchronize the offline evolution route table into core JS and both HTML builds.
Use after editing assets/evolution-routes.json. No network required.
"""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parent.parent
payload=json.loads((root/'assets/evolution-routes.json').read_text())['data']
js='const KNOWN='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';'
for name in ['src/evolution-core.js','index.html','standalone.html']:
 path=root/name;source=path.read_text()
 updated,count=re.subn(r'const KNOWN=.*?;(?=\n// Provisional only:)',js,source,count=1,flags=re.S)
 if count!=1:raise SystemExit(f'unable to locate KNOWN table in {name}')
 if updated!=source:path.write_text(updated)
 print('synced',name)
