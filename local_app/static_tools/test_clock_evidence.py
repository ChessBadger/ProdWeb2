import sys,pathlib,json,copy
root=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(root))
from crew_evidence import collect_clock_evidence,timing
s=json.loads((root/'verification/model-improvements-2026-10-14/state.private.json').read_text(encoding='utf8'));cut='2026-10-12'
rows=collect_clock_evidence(s,cut);recovered=[r for r in rows if r.get('attendanceOnly')]
assert len(recovered)==22
assert all(r['date']<cut for r in rows)
assert all(r['id'] not in {j['id'] for j in s['history']['jobs']} for r in recovered)
e=next(e for e in s['importedEvents'] if e['store']+'|'+e['date']==recovered[0]['id'])
t=copy.deepcopy(s);t['importedEvents']=[{**e,'date':cut}]
assert all(r['date']<cut for r in collect_clock_evidence(t,cut))
t=copy.deepcopy(s);bad=copy.deepcopy(e);bad['attendance'][0]['time_out_s']=None;t['importedEvents']=[bad]
assert e['store']+'|'+e['date'] not in {r['id'] for r in collect_clock_evidence(t,cut)}
assert s['history']['jobs']==json.loads((root/'verification/model-improvements-2026-10-14/state.private.json').read_text(encoding='utf8'))['history']['jobs']
print('Clock evidence passed: 22 recovered visits, no fabricated production, strict weekly cutoff, invalid clocks rejected, history unchanged.')
