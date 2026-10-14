"""Private replay of the actual public compiler; never publishes a release."""
import json, pathlib, sys, hashlib
from export_week import build_snapshot, public_snapshot
from features import week
from crew_evidence import collect_clock_evidence
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'verification/toggle-blend-2026-10-14';OUT.mkdir(exist_ok=True)
s=json.loads((ROOT/'verification/model-improvements-2026-10-14/state.private.json').read_text())
records=json.loads((ROOT/'verification/model-improvements-2026-10-14/records.private.json').read_text())
start=s['model']['training_end_exclusive']
visits=[r for r in records if r['date']>=start and r.get('crewHours')]
excluded=[]
clocks={r['id']:r for r in collect_clock_evidence(s,'2026-10-14',ROOT)}
for e in s['importedEvents']:
 key=e['store']+'|'+e['date']
 if not start<=e['date']<'2026-10-14':continue
 c=clocks.get(key)
 if not c:excluded.append({'id':key,'reason':'Valid separate crew clocks or unambiguous prior account missing'});continue
 visits.append(dict(id=key,date=e['date'],storeId=e['store'],accountKey=c['account'],employees=e['employees'],supervisor=e['supervisor'],rx=e['rx'],crewHours=c['crew']))
policy=dict(trainingEndExclusive=start,selectionEndExclusive='2026-10-12',finalEndExclusive='2026-10-14',target='First crew arrival to last non-supervisor departure',fixedIntegratedWeights=[0,.25,.5,.75,1],learning='Minimize prior MAE on 0.05 grid; global requires 8 visits, account requires 12 and shrinks by 20, segment requires 8 and shrinks by 20. Default weight 1. Reference bias correction requires 8 prior visits, shrinks by 20, bounded to 30 minutes.',selection='Development lower MAE and higher within15 than integrated, no extra underestimates over60; best within15 then MAE. Final records opened only after selection.',limitations=['Only 11 measured crew targets after frozen model training in the older history; March-June visits without separate clocks excluded.', 'Actual crew and roles, not archived planned crew. Historical receipt availability unavailable.', 'Retrospective current code and model selection; not a prospective holdout.', 'Reference toggle is an attendance proxy; corrected variants learn crew-target error only from prior visits.'],sourceHashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'static_source/planner.mjs',ROOT/'static_source/predictor.mjs',ROOT/'static_tools/export_week.py',ROOT/'static_tools/compile_context.mjs',ROOT/'static_tools/compile_planning.mjs']})
(OUT/'policy.json').write_text(json.dumps(policy,indent=2))
mapped=set(s['history']['aliases'].values())
excluded.extend(dict(id=r['id'],reason='No original store alias for actual toggle replay') for r in visits if r['storeId'] not in mapped)
visits=[r for r in visits if r['storeId'] in mapped]
ids=sorted({i for r in s['history']['jobs'] for i in r['employees']}|{i for r in visits for i in r['employees']})
for cut in sorted({week(r['date']) for r in visits}):
 rows=[r for r in visits if week(r['date'])==cut];stores=[]
 for sid in sorted({r['storeId'] for r in rows}):
  aliases=sorted(a for a,v in s['history']['aliases'].items() if v==sid)
  if not aliases:raise ValueError('Missing store alias '+sid)
  alias=aliases[0];acct=next(r['accountKey'] for r in rows if r['storeId']==sid)
  stores.append(dict(alias=alias,storeId=sid,accountKey=acct,name=alias.replace('||',' / ')))
 catalog=dict(employees=[dict(id=i,name='Employee '+i,active=True) for i in ids],stores=stores)
 dest=OUT/(cut+'.private.json')
 if dest.exists():continue
 snapshot=public_snapshot(build_snapshot(s,catalog,cut),s,catalog)
 # Synthetic schedule contains only known forecast date/start, never outcome or duration.
 for n,st in enumerate(stores):
  pub=next(x for x in snapshot['stores'] if x['key']=='s'+str(n))
  pub['scenario']['scheduleJobs']=[dict(key=r['id'],date=r['date'],startTime='06:00') for r in rows if r['storeId']==st['storeId']]
 dest.write_text(json.dumps(dict(snapshot=snapshot,catalog=catalog,visits=rows),separators=(',',':')))
 print(cut,len(rows),'visits',flush=True)
(OUT/'excluded.json').write_text(json.dumps(excluded,indent=2))
print('Ready',len(visits),'eligible visits;',len(excluded),'excluded')
