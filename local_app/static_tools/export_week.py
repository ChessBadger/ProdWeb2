"""Local-only weekly compiler. Public output contains approved current-roster coefficients and curated latest-crew values; raw export files stay local."""
import sys,pathlib,json,datetime,collections,statistics,math,subprocess,hashlib,argparse,sqlite3,os,copy,hmac
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1];W=ROOT.parent;sys.path.insert(0,str(ROOT))
from storage import Store,atomic
from export_history import default_archive_dir
from features import week,clip,med
from crew_evidence import timing
from range_evidence import range_evidence
from schedule_source import load_schedule
shrink=lambda xs,k:sum(xs)/(len(xs)+k)
def build_snapshot(s,catalog,cut):
 hist=sorted([h for h in s['history']['jobs'] if h['date']<cut],key=lambda h:(h['date'],h['storeId']));lookup={h['id']:h for h in hist};stores=collections.defaultdict(list);accounts=collections.defaultdict(list);rates=collections.defaultdict(list);physical=collections.defaultdict(list);recent=collections.defaultdict(float);tails={g:collections.defaultdict(list) for g in ['store','account','supervisor']}
 for h in hist:
  stores[h['storeId']].append(h);accounts[h['accountKey']].append(h);mid=med([e['quantity']/e['hours'] for e in h['employeeDetails'] if e['hours']>0 and e['quantity']>0]) or 1
  for e in h['employeeDetails']:
   if e['hours']>0 and e['quantity']>0:rates[e['id']].append(clip(math.log(e['quantity']/e['hours']/mid),-2,2));physical[(h['accountKey'],e['id'])].append(e['quantity']/e['hours'])
   if (datetime.date.fromisoformat(cut)-datetime.date.fromisoformat(h['date'])).days<=7:recent[e['id']]+=e['hours']
  hs=[e['hours'] for e in h['employeeDetails'] if e['id']!=h['supervisor']];tail=h['duration']-(float(np.quantile(hs,.75)) if hs else h['duration'])
  for g,k in [('store',h['storeId']),('account',h['accountKey']),('supervisor',h['supervisor'])]:tails[g][k].append(tail)
 errors={b:{g:collections.defaultdict(list) for g in ['store','account','supervisor','employee']} for b in ['base','incumbent']}
 for h in sorted(s['paired'],key=lambda h:(h['date'],h['storeId'])):
  j=lookup.get(h['storeId']+'|'+h['date'])
  if j is None:continue
  for b,d in errors.items():
   error=h['actual']-(h['candidates']['0.3'] if b=='base' else h['incumbent'])
   for g,k in [('store',h['storeId']),('account',h['account']),('supervisor',j['supervisor'])]:d[g][k].append(error)
   for e in j['employees']:d['employee'][e].append(error)
 payload={'data':s['history'],'records':s['records'],'meta':s['meta'],'salvage':s['salvage'],'extraRates':s['extraRates'],'exportHistory':s['exportHistory'],'analytics':s['analytics'],'catalog':catalog,'cutoff':cut,'plan':{'storeId':'unused','date':cut,'historyCutoff':cut}}
 payload['schedule']=load_schedule(W)
 print('Compiling private weekly coefficients...',flush=True)
 run=subprocess.run(['node',str(ROOT/'static_tools/compile_context.mjs')],input=json.dumps(payload,allow_nan=False),encoding='utf8',text=True,capture_output=True,cwd=W,timeout=300)
 if run.returncode:raise RuntimeError(run.stderr[-3000:])
 compiled=json.loads(run.stdout);planning_run=subprocess.run(['node',str(ROOT/'static_tools/compile_planning.mjs')],input=json.dumps(payload,allow_nan=False),encoding='utf8',text=True,capture_output=True,cwd=W,timeout=300)
 if planning_run.returncode:raise RuntimeError(planning_run.stderr[-3000:])
 planning=json.loads(planning_run.stdout);persons=[]
 for e in catalog['stores']:
  planning['stores'][e['alias']]['crewTiming']=timing(s,e['storeId'],e['accountKey'],cut,ROOT)
 for i,e in enumerate(catalog['employees']):
  eid=e['id'];r={'key':'p'+str(i),'name':e['name'],'active':e['active'],'relativeSpeed':shrink(rates[eid][-12:],3),'known':bool(rates[eid]),'recentHours':recent[eid],'supervisorTail':shrink(tails['supervisor'][eid][-20:],10)}
  for b,d in errors.items():r[b+'Residual']=shrink(d['employee'][eid][-20:],10);r[b+'SupervisorResidual']=shrink(d['supervisor'][eid][-30:],10)
  persons.append(r)
 resultstores=[]
 for i,e in enumerate(catalog['stores']):
  pack=compiled['stores'][e['alias']];entry={'key':'s'+str(i),'name':e['name'],'context':pack};resultstores.append(entry)
  if not pack:continue
  sid=e['storeId'];acct=e['accountKey'];prev=stores[sid];past=prev[-1] if prev else None;posts=[h['postCountHours'] for h in prev if h['postCountHours'] is not None]
  fixed={'historyCount':len(prev),'gap':min(730,(datetime.date.fromisoformat(cut)-datetime.date.fromisoformat(past['date'])).days)/365 if past else 2,'priorDuration':past['duration'] if past else 0,'priorCrew':len(past['employees']) if past else 0,'postCount':med(posts),'storeTail':shrink(tails['store'][sid][-5:],3),'accountTail':shrink(tails['account'][acct][-40:],10)}
  for b,d in errors.items():fixed[b+'StoreResidual']=shrink(d['store'][sid][-4:],3);fixed[b+'AccountResidual']=shrink(d['account'][acct][-40:],10)
  pack['fixed']=fixed
  anchor=max([a for a in s['attendance']['anchors'] if a['store']==sid and a['date']<cut],key=lambda a:a['date'],default=None);candidates=[a for a in s['attendance']['accepted_candidates'] if a['store']==sid and a['date']<cut and anchor and a['signature']==anchor['signature'] and a['store']+'|'+a['date'] not in lookup]
  augmented=prev+[dict(date=a['date'],duration=a['duration'],employees=a['employees'],supervisor=a['supervisor'],rx=a['rx'],postCountHours=None,attendanceOnly=True) for a in candidates]
  fallback=med([med(v) for (a,eid),v in physical.items() if a==acct]) or 1
  def capacity(h):return sum(clip(med(physical.get((acct,eid),[])) or fallback,fallback*.25,fallback*4)*(.5 if eid==h['supervisor'] or eid in h['rx'] else 1) for eid in h['employees'])
  for phase in range(3):
   match=[h for h in prev if int(h['date'][5:7])%3==phase];other=[h for h in prev if int(h['date'][5:7])%3!=phase];mq=med([h['quantity'] for h in match]);oq=med([h['quantity'] for h in other]);seasonal=len(match)>=2 and len(other)>=4 and mq>0 and oq>0 and max(mq/oq,oq/mq)>=1.5;refs=sorted([h for h in augmented if not seasonal or int(h['date'][5:7])%3==phase],key=lambda h:h['date'],reverse=True)[:5];p=pack['phases'][str(phase)];p['attendance']={'count':len(candidates),'used':sum(bool(h.get('attendanceOnly')) for h in refs) if candidates else 0,'phase':int(seasonal),'kernel':None}
   if candidates and refs:
    originals=sorted(match if seasonal else prev,key=lambda h:h['date'],reverse=True)[:5] if prev else accounts[acct];expected=med([h['quantity'] for h in originals]);peers=[(med([h['quantity'] for h in hs]),med([h['duration'] for h in hs]),ss) for ss,hs in stores.items() if hs and ss!=sid and hs[0]['accountKey']==acct];peers=sorted(peers,key=lambda v:(abs(math.log1p(v[0])-math.log1p(expected)),v[2]))[:3];ownmed=med([h['duration'] for h in refs]);base=(ownmed*len(augmented)+med([q[1] for q in peers]))/(len(augmented)+1) if augmented and peers else ownmed;p['attendance']['kernel']={'base':base,'reference':med([capacity(h) for h in refs]),'overhead':clip(med([h['postCountHours'] for h in refs if h.get('postCountHours') is not None]) or .5,0,base*.5)}
 rate_sets={};rate_hashes={}
 for e in resultstores:
  inc=e['context']['incumbent'] if e['context'] else None
  if not inc:continue
  rates=inc.pop('rates');digest=hashlib.sha256(json.dumps(rates,sort_keys=True).encode()).hexdigest()
  if digest not in rate_hashes:
   key='r'+str(len(rate_sets));rate_hashes[digest]=key;rate_sets[key]=rates
  inc['rateSet']=rate_hashes[digest]
 return {'planning':planning,'incumbentRates':rate_sets,'schema':1,'modelVersion':'validated-history-unified-v1','modelSha256':s['modelHash'],'dataFingerprint':s['fingerprint'],'cutoff':cut,'validThrough':(datetime.date.fromisoformat(cut)+datetime.timedelta(days=6)).isoformat(),'persons':persons,'unassignedSupervisor':{'recentHours':recent[''],'supervisorTail':shrink(tails['supervisor'][''][-20:],10),'baseSupervisorResidual':shrink(errors['base']['supervisor'][''][-30:],10),'incumbentSupervisorResidual':shrink(errors['incumbent']['supervisor'][''][-30:],10)},'stores':resultstores,'accounts':compiled['accounts'],'model':s['model'],'privacy':'PRIVATE LOCAL FILE: employee-level derived performance, names, customer labels and reference coefficients. Do not commit or upload. Browser reads this file locally.'}
def project_last_crew(employees,supervisor,rx,rows,people):
 # Historical display includes former staff; selection uses the separate current roster.
 selected=list(dict.fromkeys(i for i in employees if i in people))
 supervisor=supervisor if supervisor in people else ''
 return {'employees':selected,'supervisor':supervisor,
         'supervisorStatus':'recorded' if supervisor else 'missing',
         'names':{i:people[i] for i in dict.fromkeys(selected+([supervisor] if supervisor else []))},
         'rx':[i for i in rx if i in selected],
         'rows':[r for r in rows if r['key'] in selected]}

def public_snapshot(snapshot,state,catalog,_anchors=True):
 staffing_anchors=None
 if _anchors:
  full=copy.deepcopy(snapshot);full_catalog=copy.deepcopy(catalog)
  for person in full['persons']:person['active']=True
  for person in full_catalog['employees']:person['active']=True
  full_public=public_snapshot(full,state,full_catalog,False)
  run=subprocess.run(['node',str(ROOT/'static_tools/compile_staffing_anchors.mjs')],input=json.dumps(full_public,allow_nan=False),text=True,encoding='utf8',capture_output=True,cwd=W,timeout=300)
  if run.returncode:raise RuntimeError(run.stderr[-3000:])
  staffing_anchors=json.loads(run.stdout)
 result=copy.deepcopy(snapshot);planning=result.pop('planning');result.pop('privacy',None);result['publicationScope']='current-roster-derived'
 result['persons']=[p for p in result['persons'] if p['active']];stable=lambda value:hmac.new(bytes.fromhex(state['publicationSalt']),value.encode(),hashlib.sha256).hexdigest()[:24]
 for person in result['persons']:person['stableKey']=stable('person:'+catalog['employees'][int(person['key'][1:])]['id'])
 ids={p['key'] for p in result['persons']}
 historical_names={p['key']:p['name'] for p in snapshot['persons']}
 keys={p['id']:'p'+str(i) for i,p in enumerate(catalog['employees'])}
 result['stores']=[st for i,st in enumerate(result['stores']) if (st['context'] and st['context']['incumbent']) or planning['stores'].get(catalog['stores'][i]['alias'],{}).get('variants',{}).get('default')]
 aliases={s['alias']:s for s in catalog['stores']}
 bykey={'s'+str(i):s for i,s in enumerate(catalog['stores'])}
 for s in result['stores']:
  s['stableKey']=stable('store:'+bykey[s['key']]['alias']);s['scenario']=planning['stores'][bykey[s['key']]['alias']];s['needsRx']=bool(__import__('re').search(r'\brx\b',s['name'],__import__('re').I))
  prior=max([j for j in state['history']['jobs'] if j['storeId']==bykey[s['key']]['storeId'] and j['date']<snapshot['cutoff']],key=lambda j:j['date'],default=None)
  exported=s['scenario'].get('lastCrew',{})
  if exported.get('employees'):
   selected=exported['employees'];sup=exported.get('supervisor','')
   s['lastCrew']=project_last_crew(selected,sup,exported.get('rx',[]),exported.get('rows',[]),historical_names)
  else:
   selected=[keys[e] for e in prior['employees'] if keys.get(e) in historical_names] if prior else [];sup=keys.get(prior['supervisor'],'') if prior else ''
   s['lastCrew']=project_last_crew(selected,sup,[keys[e] for e in prior['rx'] if keys.get(e) in historical_names] if prior else [],[],historical_names)
  s['lastCrew']['date']=exported.get('date') or (prior['date'] if prior else '')
  s['lastCrewVisits']=[dict(project_last_crew(v['employees'],v.get('supervisor',''),v.get('rx',[]),v.get('rows',[]),historical_names),date=v['date']) for v in s['scenario'].pop('lastCrewVisits',[]) if v['date']<datetime.date.today().isoformat()]
  if not s['lastCrewVisits'] and s['lastCrew']['date']:s['lastCrewVisits']=[copy.deepcopy(s['lastCrew'])]
  if staffing_anchors is not None:s['staffingAnchors']=staffing_anchors[s['key']]
  s['scenario'].pop('lastCrew',None)
  s['scenario']['recentAccountProduction']={k:v for k,v in s['scenario'].get('recentAccountProduction',{}).items() if k in ids}
  for k in (s['context']['incumbent']['kernels'] if s['context'] else []):
   for field in ['full','counter']:k[field]['members']=[i for i in k[field]['members'] if i in ids]
 scenario_rates={};rate_ids={}
 for st in result['stores']:
  for pack in st['scenario']['variants'].values():
   if not pack:continue
   for field in ['rates','recentRates']:
    rates={k:v for k,v in pack[field].items() if k in ids};digest=hashlib.sha256(json.dumps(rates,sort_keys=True).encode()).hexdigest()
    if digest not in rate_ids:rate_ids[digest]='q'+str(len(scenario_rates));scenario_rates[rate_ids[digest]]=rates
    pack[field]=rate_ids[digest]
   for kernel in pack['kernels']:
    for field in ['full','counter']:kernel[field]['members']=[i for i in kernel[field]['members'] if i in ids]
 result['scenarioRates']=scenario_rates
 accounts={s['context']['account'] for s in result['stores'] if s['context']};mapping={a:'a'+str(i) for i,a in enumerate(sorted(accounts))}
 result['accounts']={mapping[a]:{'people':{k:v for k,v in result['accounts'][a]['people'].items() if k in ids}} for a in sorted(accounts)}
 for s in result['stores']:
  if s['context']:s['context']['account']=mapping[s['context']['account']]
 refs={s['context']['incumbent']['rateSet'] for s in result['stores'] if s['context']}
 result['incumbentRates']={k:{i:v for i,v in rates.items() if i in ids} for k,rates in result['incumbentRates'].items() if k in refs}
 result['evidence']=copy.deepcopy(planning['evidence']);result['evidence']['legacyAccountMetrics']={}
 result['evidence']['onsiteRange']=range_evidence(snapshot['cutoff'],snapshot['modelSha256'])
 for accountKey,values in planning['evidence']['legacyAccountMetrics'].items():
  for original,opaque in mapping.items():
   if original.split('|')[0]==accountKey:result['evidence']['legacyAccountMetrics'][opaque]=values
 result['model']={k:result['model'][k] for k in ['feature_names','edges','trees','learning_rate']}
 return result

def main():
 ap=argparse.ArgumentParser();dates=ap.add_mutually_exclusive_group();dates.add_argument('--week',help='Explicit historical Monday cutoff for research/replay');dates.add_argument('--as-of',help='Use completed history before this date (default: today)');ap.add_argument('--data-dir');args=ap.parse_args();cut=args.as_of or args.week or datetime.date.today().isoformat()
 datetime.date.fromisoformat(cut)
 if args.week and week(cut)!=cut:raise ValueError('--week must be a Monday YYYY-MM-DD')
 namespace=hashlib.sha256(str(W.resolve()).casefold().encode()).hexdigest()[:12];canonical=pathlib.Path(os.environ.get('LOCALAPPDATA',str(pathlib.Path.home())))/'EmployeePredictor';root=pathlib.Path(args.data_dir or canonical/'SiteHistory'/namespace);archive=(root/'export_archive') if (root/'export_archive').exists() else default_archive_dir(W)
 if (root/'history.sqlite3').exists():
  with sqlite3.connect(root/'history.sqlite3') as db:
   if db.execute("SELECT count(*) FROM operations WHERE status IN ('queued','running')").fetchone()[0]:raise RuntimeError('Finish local import operations before exporting.')
 store=Store(root,export_dir=archive);store.refresh();s=store.state();catalog=store.catalog();snapshot=build_snapshot(s,catalog,cut)
 private=store.root/'weekly_private';private.mkdir(exist_ok=True);out=private/('planning-'+cut+'-'+s['fingerprint'][:12]+'.json');atomic(out,json.dumps(snapshot,allow_nan=False,separators=(',',':')).encode())
 from verify_export import build_public,inspect_private
 private_report=inspect_private(snapshot);private_report.update(classification='PRIVATE FULL HISTORICAL REFERENCE - NOT PUBLISHED',scope='Full historical reference retained locally',privateFile=str(out),sha256=hashlib.sha256(out.read_bytes()).hexdigest(),bytes=out.stat().st_size);atomic(private/'LATEST.json',json.dumps(private_report,indent=2).encode());release=build_public(W,public_snapshot(snapshot,s,catalog))
 report={'staticDirectory':str(W/'pages_export'),'privatePlanningFile':str(out),'publicPlanningFile':str(W/'pages_export'/release['files']['planning']['path']),'releaseVersion':release['version'],'cutoff':cut,'validThrough':snapshot['validThrough'],'privateDataReport':str(private/'LATEST.json'),'publicContainsCompanyData':True,'publicScope':'Current planning roster and derived predictions; complete latest-visit historical crew display','activeRosterCount':sum(p['active'] for p in catalog['employees'])};atomic(ROOT/'verification/static_latest.json',json.dumps(report,indent=2).encode());print(json.dumps(report,indent=2))
if __name__=='__main__':main()
