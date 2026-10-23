"""Private replay of the actual public compiler; never publishes a release."""
import json, pathlib, sys, hashlib
from export_week import build_snapshot, public_snapshot
from features import week
from crew_evidence import collect_clock_evidence
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'verification/large-crews-2026-10-14';OUT.mkdir(exist_ok=True)
from storage import Store
from collections import defaultdict
s=Store().state()
(OUT/'state.private.json').write_text(json.dumps(s),encoding='utf8')
start=s['model']['training_end_exclusive']
# Inventory headcount is distinct recorded employees plus the assigned supervisor.
# Union overlapping sources instead of counting the same visit twice.
groups=defaultdict(set);names={}
for alias,sid in s['history']['aliases'].items():names.setdefault(sid,alias.replace('||',' / '))
for r in s['exportHistory']['EmployeeProductionHistory']:
 date=str(r['DateOfInv'])[:10]
 if date>='2026-10-14':continue
 alias=str(r.get('AccountName','')).strip()+'||'+str(r.get('StoreName','')).strip();sid=s['history']['aliases'].get(alias,alias);names.setdefault(sid,alias.replace('||',' / '))
 for value in [r.get('Employee'),r.get('SupervisorNumber')]:
  if value is not None and str(value).strip():groups[(sid,date)].add(str(value).removesuffix('.0').zfill(4))
for j in s['history']['jobs']:
 if j['date']<'2026-10-14':groups[(j['storeId'],j['date'])].update(j['employees']+[j['supervisor']])
for e in s['importedEvents']:
 if e['date']<'2026-10-14':groups[(e['store'],e['date'])].update(e['employees']+[e['supervisor']])
def avg(sid,cut):
 sizes=[len(ids) for (key,date),ids in groups.items() if key==sid and date<cut]
 return sum(sizes)/len(sizes) if sizes else 0
clocks={r['id']:r for r in collect_clock_evidence(s,'2026-10-14',ROOT)}
known={j['id']:dict(j) for j in s['history']['jobs']}
for e in s['importedEvents']:
 key=e['store']+'|'+e['date'];known[key]=dict(id=key,date=e['date'],storeId=e['store'],employees=e['employees'],supervisor=e['supervisor'],rx=e['rx'],accountKey=clocks.get(key,{}).get('account'))
visits=[];excluded=[]
for key,j in known.items():
 if not start<=j['date']<'2026-10-14':continue
 average=avg(j['storeId'],week(j['date']))
 if average<8:continue
 if key not in clocks:
  excluded.append(dict(id=key,storeId=j['storeId'],reason='No verified separate crew-clock outcome',averageCrew=average));continue
 visits.append(dict(id=key,date=j['date'],storeId=j['storeId'],accountKey=clocks[key]['account'],employees=j['employees'],supervisor=j['supervisor'],rx=j.get('rx',[]),crewHours=clocks[key]['crew'],averageCrew=average))
cohort=[dict(storeId=sid,name=names[sid],averageCrew=avg(sid,'2026-10-14'),inventories=sum(key==sid for key,date in groups),eligibleClockVisits=sum(v['storeId']==sid for v in visits)) for sid in names if avg(sid,'2026-10-14')>=8]
(OUT/'cohort.json').write_text(json.dumps(cohort,indent=2),encoding='utf8')
print('Stores averaging >=8:',len(cohort),'scorable visits:',len(visits),'training end:',start,flush=True)
policy=dict(trainingEndExclusive=start,selectionEndExclusive='2026-10-12',finalEndExclusive='2026-10-14',target='First crew arrival to last non-supervisor departure',minimumAverageCrew=8,learning='None; compare the current two toggles with all contribution roles set to Auto.',selection='No tuning. Report paired errors across all eligible post-training visits.',limitations=['Only 11 measured crew targets after frozen model training in the older history; March-June visits without separate clocks excluded.', 'Actual crew and roles, not archived planned crew. Historical receipt availability unavailable.', 'Retrospective current code and model selection; not a prospective holdout.', 'Reference toggle is an attendance proxy; corrected variants learn crew-target error only from prior visits.'],sourceHashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'static_source/planner.mjs',ROOT/'static_source/predictor.mjs',ROOT/'static_tools/export_week.py',ROOT/'static_tools/compile_context.mjs',ROOT/'static_tools/compile_planning.mjs']})
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
