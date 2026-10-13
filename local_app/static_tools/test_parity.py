import sys,pathlib,json,subprocess,datetime
W=pathlib.Path(__file__).resolve().parents[2];ROOT=W/'local_app';sys.path[:0]=[str(ROOT),str(ROOT/'static_tools')]
from storage import Store
from features import forecast
from export_week import build_snapshot
A=pathlib.Path(r'C:\Users\Laptop 122\Documents\Codex\2026-10-09\task-4\static_verification');A.mkdir(exist_ok=True)
latest=json.loads((ROOT/'verification/static_latest.json').read_text());snap=json.loads(pathlib.Path(latest['privatePlanningFile']).read_text());profile=pathlib.Path(latest['privatePlanningFile']).parents[1];archive=pathlib.Path.home()/'AppData/Local/EmployeePredictor/ExportHistory'/profile.name;store=Store(profile,export_dir=archive);state=store.state();cat=store.catalog();pkeys={p['id']:'p'+str(i) for i,p in enumerate(cat['employees'])};skeys={p['alias']:'s'+str(i) for i,p in enumerate(cat['stores'])};cases=[];seen=set()
for entry in cat['stores']:
 refs=[j for j in state['history']['jobs'] if j['storeId']==entry['storeId'] and j['date']<snap['cutoff']]
 if not refs or entry['accountKey'] in seen:continue
 j=max(refs,key=lambda j:j['date'])
 if not 2<=len(j['employees'])<=15:continue
 seen.add(entry['accountKey']);p={'storeKey':entry['alias'],'storeId':entry['storeId'],'accountKey':entry['accountKey'],'date':snap['cutoff'],'historyCutoff':snap['cutoff'],'employees':j['employees'],'roles':{'supervisor':j['supervisor'] if j['supervisor'] in j['employees'] else '', 'rx':[e for e in j['rx'] if e in j['employees']]}}
 cases.append(p)
 if len(seen)==3:break
p=cases[0];cases.extend([{**p,'roles':{'supervisor':'','rx':[]}},{**p,'employees':p['employees'][:1],'roles':{'supervisor':p['employees'][0],'rx':[]}},{**p,'roles':{'supervisor':p['employees'][0],'rx':p['employees'][1:2]},'date':snap['validThrough']},{**p,'employees':[e['id'] for e in cat['employees'][:21]],'roles':{'supervisor':'','rx':[]}}])
def check(snapshot,plans,keys,prefix):
 path=A/(prefix+'-private-fixture.json');path.write_text(json.dumps({'snapshot':snapshot,'plans':[{'storeKey':keys[p['storeKey']],'date':p['date'],'employees':[pkeys[e] for e in p['employees']],'roles':{'supervisor':pkeys.get(p['roles']['supervisor'],''),'rx':[pkeys[e] for e in p['roles']['rx']]}} for p in plans]}))
 script="import fs from 'node:fs';import {predict} from "+json.dumps((ROOT/'static_source/predictor.mjs').as_uri())+";const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify(d.plans.map(p=>predict(d.snapshot,p))));"
 run=subprocess.run(['node','--input-type=module','-e',script,str(path)],capture_output=True,text=True,encoding='utf8');assert run.returncode==0,run.stderr;got=json.loads(run.stdout);out=[]
 for i,(p,r) in enumerate(zip(plans,got)):
  expected=forecast(state,p);assert expected['status']==r['status'];diff={k:abs(v-r['features'][k]) for k,v in expected['features'].items()};maximum=max(diff.values());pred=abs(expected['predictedHours']-r['predictedHours']);assert maximum<1e-8 and pred<1e-8,(prefix,i,{k:v for k,v in diff.items() if v>1e-8},expected['predictedHours'],r['predictedHours']);out.append({'case':prefix+'-'+str(i),'crew':len(p['employees']),'maxFeatureDifference':maximum,'predictionDifferenceHours':pred});print(out[-1],flush=True)
 return out
# Exercise stores with additional attendance references, seasonal phases and a larger crew.
for criterion in ['attendance','seasonal','large']:
 for i,sp in enumerate(snap['stores']):
  cc=sp['context']
  if not cc:continue
  if criterion=='attendance' and not any(v['attendance']['used'] for v in cc['phases'].values()):continue
  if criterion=='seasonal' and not any(v['attendance']['phase'] for v in cc['phases'].values()):continue
  e=cat['stores'][i];refs=[j for j in state['history']['jobs'] if j['storeId']==e['storeId'] and j['date']<snap['cutoff']]
  if not refs:continue
  j=max(refs,key=lambda j:j['date'])
  if criterion=='large' and len(j['employees'])<10:continue
  cases.append({'storeKey':e['alias'],'storeId':e['storeId'],'accountKey':e['accountKey'],'date':snap['cutoff'],'historyCutoff':snap['cutoff'],'employees':j['employees'],'roles':{'supervisor':j['supervisor'] if j['supervisor'] in j['employees'] else '', 'rx':[x for x in j['rx'] if x in j['employees']]}});break
assert sum(e['active'] for e in cat['employees'])==61
new_historical=next(e['id'] for e in cat['employees'] if not e['active'] and any(identity==e['id'] for identity in {str(r['Employee']).strip().zfill(4) for r in state['exportHistory']['EmployeeProductionHistory']}))
active=next(e['id'] for e in cat['employees'] if e['active'] and e['id']!=new_historical)
cases.append({**cases[0],'employees':[active,new_historical],'roles':{'supervisor':active,'rx':[new_historical]}})
results=check(snap,cases,skeys,'weekly')
# Future week crossing a month boundary and a new store within a known account.
e=next(x for x in cat['stores'] if x['alias']==cases[0]['storeKey']);fake={**e,'alias':e['accountKey']+'||PRIVATE TEST NEW STORE','storeId':'99999998','name':'Private test new store'};small={**cat,'stores':[e,fake]};cut='2026-11-30';boundary=build_snapshot(state,small,cut);plans=[{**cases[0],'date':d,'historyCutoff':cut} for d in [cut,'2026-12-01']]+[{**cases[0],'storeKey':fake['alias'],'storeId':fake['storeId'],'date':cut,'historyCutoff':cut}];results+=check(boundary,plans,{e['alias']:'s0',fake['alias']:'s1'},'boundary-fallback')
report={'passed':True,'cases':results,'modelSha256':snap['modelSha256'],'noRetraining':True};(ROOT/'verification/static_parity.json').write_text(json.dumps(report,indent=2));print('PASS',len(results),'numerical parity cases')
