#!/usr/bin/env python3
"""Run v0.23.3 local regression suites and emit machine-readable results."""
import json,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
node=['farm-core','evolution-core','evolution-tree','sprite-catalog','cage-training','care-seasons','hunt-core','battle-core','battle-rest','championship-core','championship-bracket-expansion']
commands={**{f'node/{n}':['node',f'tests/{n}.cjs'] for n in node},'movement/17':['node','--test','tests/farm-navigation.cjs','tests/farm-avoidance.cjs'],'tool/rom':['python','-m','unittest','discover','-s','tests','-p','test_rom_database.py'],'tool/sprite':['python','-m','unittest','discover','-s','tests','-p','test_sprite_audit.py'],'tool/sync':['python','-m','unittest','discover','-s','tests','-p','test_bundle_sync.py']}
for n in ['hex-browser','save-browser','hunt-browser','battle-browser-logic','evolution-browser','championship-browser','championship-brackets-browser','championship-v0231-browser','v0233-merge-browser']:
 commands['browser/'+n]=['python',f'tests/{n}.py']
results=[]
for name,cmd in commands.items():
 t=time.monotonic()
 try:
  r=subprocess.run(cmd,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=110)
  good=r.returncode==0
  results.append({'name':name,'status':'PASS' if good else 'FAIL','exit_code':r.returncode,'seconds':round(time.monotonic()-t,2),'output_tail':r.stdout[-1000:] if not good else ''})
 except subprocess.TimeoutExpired as e:
  results.append({'name':name,'status':'TIMEOUT','seconds':round(time.monotonic()-t,2),'output_tail':str(e)})
 print(results[-1]['status'],name,flush=True)
(ROOT/'TEST_REPORT_v0.23.3_REGRESSION.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print('Summary:',len([r for r in results if r['status']=='PASS']),'/',len(results),'passing')
if any(r['status']!='PASS' for r in results):sys.exit(1)
