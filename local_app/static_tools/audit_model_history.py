"""Read-only matching audit and explicit physical-duration evaluation targets."""
import json,pathlib,collections,re
w=pathlib.Path(__file__).resolve().parents[2]
out=w/'local_app/verification/model-improvements-2026-10-14'
s=json.loads((out/'state.private.json').read_text(encoding='utf8'))
targets={r['id']:r for r in json.loads((w/'local_app/seed/crew_targets.json').read_text(encoding='utf8'))}
aliases=s['history']['aliases'];raw=s['exportHistory']['EmployeeProductionHistory'];identity=lambda x:str(x or '').strip().zfill(4)
by=collections.defaultdict(list)
for r in raw:by[(str(r.get('AccountName') or r.get('Account') or '').strip()+'||'+str(r.get('StoreName') or '').strip(),str(r.get('DateOfInv',''))[:10])].append(r)
meta={(r['storeKey'],r['date']):r for r in s['meta']['jobs']};records=[]
for j in s['history']['jobs']:
 t=targets.get(j['id']);names=[a for a,k in aliases.items() if k==j['storeId']];candidates=[meta[(a,j['date'])] for a in names if (a,j['date']) in meta];types={str(r.get('typeOfInv') or 'Unknown').upper() for r in candidates};modes={r.get('inventoryMode') for r in candidates}
 records.append({**j,'typeOfInv':next(iter(types)) if len(types)==1 else 'UNKNOWN','inventoryMode':next(iter(modes)) if len(modes)==1 else None,'crewHours':t['crew'] if t and abs(t['full']-j['duration'])<1e-6 else None,'supervisorHours':t.get('supervisorDuration') if t and abs(t['full']-j['duration'])<1e-6 else None})
norm=lambda a:re.sub(r'[^a-z0-9]','',a.lower())
index=collections.defaultdict(set)
for a,sid in aliases.items():index[norm(a)].add(sid)
unmapped=sorted({a for a,d in by if a not in aliases});exact=[];unresolved=[]
for a in unmapped:
 ids=index.get(norm(a),set())
 if len(ids)==1:exact.append({'alias':a,'storeId':next(iter(ids))})
 else:unresolved.append(a)
pending=[]
for event in s.get('importedEvents',[]):
 opts=[a for a,sid in aliases.items() if sid==event['store']];groups=[(a,by[(a,event['date'])]) for a in opts if (a,event['date']) in by];ex={identity(x) for x in event['employees']}
 for a,rs in groups:
  prod={identity(r['Employee']) for r in rs};pending.append({'event':event['store']+'|'+event['date'],'exportRows':len(rs),'attendanceRows':len(ex),'missingProduction':sorted(ex-prod),'extraProduction':sorted(prod-ex)})
 if not groups:pending.append({'event':event['store']+'|'+event['date'],'exportRows':0,'attendanceRows':len(ex),'reason':'No production visit for a known store alias on this date.'})
# A separate conservative cross-check: same date, full employee set, supervisor,
# and every employee quantity. A suggested mapping needs two independent visits.
signatures=collections.defaultdict(list)
def signature(day,supervisor,details):
 return (day,identity(supervisor),tuple(sorted((identity(e),round(float(q),4)) for e,q in details)))
for j in s['history']['jobs']:
 signatures[signature(j['date'],j['supervisor'],[(e['id'],e['quantity']) for e in j['employeeDetails']])].append(j['storeId'])
hits=collections.defaultdict(list)
for (alias,day),rs in by.items():
 if alias not in unmapped:continue
 supervisors={identity(r['SupervisorNumber']) for r in rs}
 if len(supervisors)!=1 or len({identity(r['Employee']) for r in rs})!=len(rs):continue
 ids=set(signatures.get(signature(day,next(iter(supervisors)),[(r['Employee'],r['Total_Ext_Qty']) for r in rs]),[]))
 if len(ids)==1:hits[alias].append({'date':day,'storeId':next(iter(ids))})
fingerprint_candidates=[{'alias':a,'visits':v,'storeId':v[0]['storeId']} for a,v in hits.items() if len(v)>=2 and len({r['storeId'] for r in v})==1]
report={'validatedVisits':len(records),'crewClockTargets':sum(r['crewHours'] is not None for r in records),'unmappedAliases':len(unmapped),'safeNormalizedAliasCandidates':exact,'unresolvedAliases':unresolved,'importedEventRosterComparison':pending,'policy':'No fuzzy or date-only joins. Preserve full visit, crew window, and supervisor duration as separate targets. Historical record availability is event-date based, not historical receipt-time reconstruction.'}
report['exactRosterQuantityCandidates']=fingerprint_candidates
(out/'records.private.json').write_text(json.dumps(records,separators=(',',':')),encoding='utf8');(out/'matching-audit.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps({k:v for k,v in report.items() if k!='unresolvedAliases'},indent=2))
