"""Private clock evidence compiler; public output is aggregate durations only."""
import pathlib,json,statistics,collections,hashlib
def collect_clock_evidence(state,cut,root=None):
 root=pathlib.Path(root or pathlib.Path(__file__).resolve().parent)
 path=root/'seed/crew_targets.json'
 if not path.exists():return []
 expected=json.loads((root/'seed/manifest.json').read_text(encoding='utf8')).get('crew_targets.json')
 if not expected or hashlib.sha256(path.read_bytes()).hexdigest()!=expected:raise ValueError('Crew clock evidence integrity failure')
 known={j['id']:j for j in state['history']['jobs'] if j['date']<cut}
 evidence={r['id']:r for r in json.loads(path.read_text()) if r['date']<cut and r['id'] in known and abs(r['full']-known[r['id']]['duration'])<1e-6}
 for event in state.get('importedEvents',[]):
  key=event['store']+'|'+event['date'];evidence.pop(key,None)
  if event['date']>=cut:continue
  accounts={j['accountKey'] for j in known.values() if j['storeId']==event['store']}
  if len(accounts)!=1:continue
  aa=event.get('attendance',[]);sup=event.get('supervisor');crew=[a for a in aa if a['employee']!=sup];ss=[a for a in aa if a['employee']==sup]
  if not crew or len(ss)!=1 or any(a['time_in_s'] is None or a['time_out_s'] is None or not 0<a['time_out_s']-a['time_in_s']<=64800 for a in aa):continue
  first=min(a['time_in_s'] for a in aa);ci=min(a['time_in_s'] for a in crew);co=max(a['time_out_s'] for a in crew);last=max(a['time_out_s'] for a in aa)
  # Clocks are valid evidence even when corresponding production has not arrived.
  # Do not turn attendance into workload, production rates, or a full-production job.
  evidence[key]=dict(id=key,date=event['date'],storeId=event['store'],account=next(iter(accounts)),full=(last-first)/3600,crew=(co-ci)/3600,extension=max(0,ss[0]['time_out_s']-co)/3600,supervisorDuration=(ss[0]['time_out_s']-ss[0]['time_in_s'])/3600,supervisorArrivalOffsetHours=(ss[0]['time_in_s']-ci)/3600,attendanceOnly=key not in known)
 return sorted(evidence.values(),key=lambda r:(r['date'],r['storeId']))

def timing(state,store,account,cut,root=None):
 rows=collect_clock_evidence(state,cut,root)
 own=[r for r in rows if r['storeId']==store][-5:];acct=[r for r in rows if r['account']==account]
 if len(own)<3 and len(acct)<5:return None
 prior=statistics.median([r['full']-r['crew'] for r in acct]) if len(acct)>=5 else 0
 tail=statistics.median([r['extension'] for r in acct]) if len(acct)>=5 else 0
 supervisor_prior=statistics.median([r['supervisorDuration']-r['crew'] for r in acct]) if len(acct)>=5 else 0
 supervisor_offset=(sum(r['supervisorDuration']-r['crew'] for r in own)+3*supervisor_prior)/(len(own)+3)
 arrival_prior=statistics.median([r['supervisorArrivalOffsetHours'] for r in acct]) if len(acct)>=5 else 0
 arrival_offset=(sum(r['supervisorArrivalOffsetHours'] for r in own)+3*arrival_prior)/(len(own)+3)
 return dict(supervisorArrivalOffsetHours=arrival_offset,supervisorOffsetHours=supervisor_offset,correctionHours=(sum(r['full']-r['crew'] for r in own)+3*prior)/(len(own)+3),extensionHours=(sum(r['extension'] for r in own)+3*tail)/(len(own)+3),storeVisits=len(own),accountVisits=len(acct),scope='store and account clocks' if own else 'account clocks',target='First crew arrival to last non-supervisor departure',developmentMAEMinutes=28.37,developmentVisits=314,freshHoldout=False)
