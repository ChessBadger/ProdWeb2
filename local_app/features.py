"""Faithful previsit feature generation for the fixed validated-history model."""
import json,math,statistics,subprocess,pathlib,datetime,collections,hashlib
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parent
med=lambda xs:float(np.median(xs)) if len(xs) else 0.
clip=lambda x,a,b:max(a,min(b,x))
def week(d):
 t=datetime.date.fromisoformat(d);return (t-datetime.timedelta(days=t.weekday())).isoformat()
def identity(v):return str(v).strip().zfill(4)
def tree_predict(model,features,baseline):
 x=[features[n] for n in model['feature_names']]
 if not all(math.isfinite(float(v)) for v in x):raise ValueError('Nonfinite predictor input')
 bins=[int(np.searchsorted(edge,v,side='right')) for edge,v in zip(model['edges'],x)];value=0
 for node in model['trees']:
  while 'value' not in node:node=node['left'] if bins[node['feature']]<=node['bin'] else node['right']
  value+=model['learning_rate']*node['value']
 return clip(baseline+clip(value,-2.5,2.5),.25,18)
def bridge(state,plan):
 j={'id':plan['storeId']+'|'+plan['date'],'storeId':plan['storeId'],'date':plan['date'],'accountKey':plan['accountKey'],'employees':plan['employees'],'supervisor':plan['roles']['supervisor'],'rx':plan['roles']['rx'],'employeeDetails':[],'quantity':0,'duration':0,'postCountHours':None}
 data={**state['history'],'jobs':[h for h in state['history']['jobs'] if h['id']!=j['id']]+[j]}
 payload={'plan':plan,'data':data,'records':state['records'],'meta':state['meta'],'salvage':state['salvage'],'extraRates':state['extraRates'],'exportHistory':state['exportHistory'],'analytics':state['analytics']}
 p=subprocess.run(['node',str(ROOT/'bridge.mjs')],input=json.dumps(payload,allow_nan=False),text=True,encoding='utf8',capture_output=True,cwd=ROOT.parent,timeout=90)
 if p.returncode:raise RuntimeError('Prediction engine failed: '+p.stderr[-1000:])
 return json.loads(p.stdout)
def estimate(j,refs,own_n,hist,stores,accounts,rates):
 acct=j['accountKey'];own=stores[j['storeId']];phase=lambda d:int(d[5:7])%3;match=[h for h in own if phase(h['date'])==phase(j['date'])];other=[h for h in own if phase(h['date'])!=phase(j['date'])];mq=med([h['quantity'] for h in match]);oq=med([h['quantity'] for h in other]);seasonal=len(match)>=2 and len(other)>=4 and mq>0 and oq>0 and max(mq/oq,oq/mq)>=1.5
 originalrefs=sorted(match if seasonal else own,key=lambda h:h['date'],reverse=True)[:5] if own else accounts[acct];expected=med([h['quantity'] for h in originalrefs]);peers=[(med([h['quantity'] for h in hs]),med([h['duration'] for h in hs]),s) for s,hs in stores.items() if hs and s!=j['storeId'] and hs[0]['accountKey']==acct];peers=sorted(peers,key=lambda p:(abs(math.log1p(p[0])-math.log1p(expected)),p[2]))[:3];ownmed=med([h['duration'] for h in refs]);peermed=med([p[1] for p in peers]);base=(ownmed*own_n+peermed)/(own_n+1) if own_n and peers else ownmed;fallback=med([med(v) for (a,i),v in rates.items() if a==acct]) or 1
 def cap(h):return sum(clip(med(rates.get((acct,i),[])) or fallback,fallback*.25,fallback*4)*(.5 if i==h['supervisor'] or i in h['rx'] else 1) for i in h['employees'])
 current=cap(j);reference=med([cap(h) for h in refs]);adjust=clip((reference/current)**.3,.65,1.6);overhead=clip(med([h.get('postCountHours') for h in refs if h.get('postCountHours') is not None]) or .5,0,base*.5)
 return clip(overhead+max(0,base-overhead)*adjust,.25,18),seasonal

def build_features(state,plan,outputs=None):
 cut=plan['historyCutoff'];hist=sorted([h for h in state['history']['jobs'] if h['date']<cut],key=lambda h:(h['date'],h['storeId']));j={'storeId':plan['storeId'],'date':plan['date'],'accountKey':plan['accountKey'],'employees':plan['employees'],'supervisor':plan['roles']['supervisor'],'rx':plan['roles']['rx']};stores=collections.defaultdict(list);rates=collections.defaultdict(list);recent=collections.defaultdict(float);ts=collections.defaultdict(list);ta=collections.defaultdict(list);tu=collections.defaultdict(list);physical_rates=collections.defaultdict(list)
 for h in hist:
  stores[h['storeId']].append(h);valid=[e['quantity']/e['hours'] for e in h['employeeDetails'] if e['hours']>0 and e['quantity']>0];mid=statistics.median(valid) if valid else 1;age=(datetime.date.fromisoformat(cut)-datetime.date.fromisoformat(h['date'])).days
  for e in h['employeeDetails']:
   if e['hours']>0 and e['quantity']>0:rates[e['id']].append(clip(math.log(e['quantity']/e['hours']/mid),-2,2));physical_rates[(h['accountKey'],e['id'])].append(e['quantity']/e['hours'])
   if age<=7:recent[e['id']]+=e['hours']
  hours=[e['hours'] for e in h['employeeDetails'] if e['id']!=h['supervisor']];tail=h['duration']-(float(np.quantile(hours,.75)) if hours else h['duration']);ts[h['storeId']].append(tail);ta[h['accountKey']].append(tail);tu[h['supervisor']].append(tail)
 if not hist or not any(h['accountKey']==j['accountKey'] for h in hist):return None
 out=outputs or bridge(state,plan)
 if out.get('incumbent') is None or out.get('base') is None:return None
 base=out['base'];rf=out['rich'];seasonal=rf['seasonal_base'];errors={b:{g:collections.defaultdict(list) for g in ['store','account','supervisor','employee']} for b in ['base','incumbent']};lookup={h['id']:h for h in hist}
 for h in sorted(state['paired'],key=lambda h:(h['date'],h['storeId'])):
  if h['date']>=cut or h['storeId']+'|'+h['date'] not in lookup:continue
  hj=lookup[h['storeId']+'|'+h['date']]
  for b in errors:
   error=h['actual']-(h['candidates']['0.3'] if b=='base' else h['incumbent']);d=errors[b];d['store'][h['storeId']].append(error);d['account'][h['account']].append(error);d['supervisor'][hj['supervisor']].append(error)
   for eid in hj['employees']:d['employee'][eid].append(error)
 prev=stores[j['storeId']];past=prev[-1] if prev else None;crew=j['employees'];n=len(crew);shrink=lambda xs,k:sum(xs)/(len(xs)+k);speed=[shrink(rates[e][-12:],3) for e in crew];posts=[h['postCountHours'] for h in prev if h['postCountHours'] is not None]
 f={'base_hours':base,'log_crew':math.log(n),'store_history_count':math.log1p(len(prev)),'store_gap_days':min(730,(datetime.date.fromisoformat(cut)-datetime.date.fromisoformat(past['date'])).days)/365 if past else 2,'prior_store_duration_minus_base':past['duration']-base if past else 0,'crew_change_log':math.log(n/len(past['employees'])) if past else 0,'team_relative_speed':float(np.mean(speed)),'team_speed_spread':float(np.std(speed)),'team_known_fraction':sum(bool(rates[e]) for e in crew)/n,'team_recent_hours':sum(recent[e] for e in crew)/n,'supervisor_recent_hours':recent[j['supervisor']],'historical_postcount':statistics.median(posts) if posts else 0,'rx_fraction':len(j['rx'])/n,'incumbent_minus_seasonal':out['incumbent']-seasonal,'base_minus_seasonal':base-seasonal,'store_attendance_remainder':shrink(ts[j['storeId']][-5:],3),'account_attendance_remainder':shrink(ta[j['accountKey']][-40:],10),'supervisor_attendance_remainder':shrink(tu[j['supervisor']][-20:],10),'large_crew':max(n-5,0)/5,'no_store_log_crew':math.log(n) if not prev else 0,'crew_change_duration':math.log(n/len(past['employees']))*seasonal if past else 0}
 for b,d in errors.items():
  f[b+'_store_residual']=shrink(d['store'][j['storeId']][-4:],3);f[b+'_account_residual']=shrink(d['account'][j['accountKey']][-40:],10);f[b+'_supervisor_residual']=shrink(d['supervisor'][j['supervisor']][-30:],10);f[b+'_crew_residual']=sum(shrink(d['employee'][e][-20:],10) for e in crew)/n
 for k,v in rf.items():
  if k not in ['storeId','date','cutoff','seasonal_base']:f[k]=v-seasonal if k.endswith('_hours') else v
 f['pieces_records_prediction_gap']=rf['pieces_presence_adjusted_hours']-rf['records_presence_adjusted_hours'];accounts=collections.defaultdict(list)
 for h in hist:accounts[h['accountKey']].append(h)
 phase=lambda d:int(d[5:7])%3;match=[h for h in prev if phase(h['date'])==phase(j['date'])];other=[h for h in prev if phase(h['date'])!=phase(j['date'])];mq=med([h['quantity'] for h in match]);oq=med([h['quantity'] for h in other]);seasonalflag=len(match)>=2 and len(other)>=4 and mq>0 and oq>0 and max(mq/oq,oq/mq)>=1.5
 anchors=[a for a in state['attendance']['anchors'] if a['store']==j['storeId'] and a['date']<cut];anchor=max(anchors,key=lambda a:a['date']) if anchors else None;candidates=[a for a in state['attendance']['accepted_candidates'] if a['store']==j['storeId'] and a['date']<cut and anchor and a['signature']==anchor['signature'] and a['store']+'|'+a['date'] not in lookup];augmented=prev+[dict(id=a['store']+'|'+a['date'],storeId=a['store'],date=a['date'],duration=a['duration'],employees=a['employees'],supervisor=a['supervisor'],rx=a['rx'],postCountHours=None,attendanceOnly=True) for a in candidates];refs=sorted([h for h in augmented if not seasonalflag or phase(h['date'])==phase(j['date'])],key=lambda h:h['date'],reverse=True)[:5];newbase=estimate(j,refs,len(augmented),hist,stores,accounts,physical_rates)[0] if candidates and refs else seasonal;used=[h for h in refs if h.get('attendanceOnly')] if candidates else []
 f.update(validated_attendance_baseline_minus_seasonal=newbase-seasonal,validated_attendance_log_count=math.log1p(len(candidates)),validated_attendance_new_reference_fraction=len(used)/5,validated_attendance_phase_flag=int(seasonalflag))
 return {'features':f,'baseline':newbase,'original_seasonal':seasonal,'incumbent':out['incumbent'],'base':base,'reference_count':len(prev),'added_reference_count':len(used),'cutoff':cut}

def forecast(state,plan):
 model=state['model'];built=build_features(state,plan)
 if built is None:return {'status':'no_history','message':'No supported prior forecast for this store/account yet. Import matching attendance and production history, or use a store with prior records.'}
 predicted=tree_predict(model,built['features'],built['baseline']);return {'status':'ok','predictedHours':predicted,'originalHours':built['incumbent'],'baselineHours':built['baseline'],'modelVersion':'validated-history-unified-v1','modelSha256':state['modelHash'],'target':'full physical onsite duration, including review and recounts','crewSize':len(plan['employees']),'historyCutoff':built['cutoff'],'priorScanVisits':built['reference_count'],'addedAttendanceReferences':built['added_reference_count'],'features':built['features'],'baseForecastHours':built['base'],'notice':'Research estimate. 29.05-minute chronological training MAE; no fresh holdout score. The 19-minute accuracy goal is not met.','warnings':(['Crew size exceeds the evaluated 1-20 range.'] if len(plan['employees'])>20 else [])}
