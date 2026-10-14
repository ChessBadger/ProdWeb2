"""Build and verify only the explicitly approved current-roster derived Pages release."""
import pathlib,json,hashlib,re,subprocess,math
H=lambda b:hashlib.sha256(b).hexdigest()
# Generated UTF-8 assets have canonical LF bytes before content addressing.
def asset_bytes(path):
 return pathlib.Path(path).read_text(encoding='utf8').encode('utf8')

GIT_ATTRIBUTES='* text=auto eol=lf\n/pages_export/** -text\n'

RAW={'TimeIn','TimeOut','FirstName','LastName','Employee','EmployeeProductionHistory','EmployeeProductionExport','employeeDetails','jobs','accepted_candidates','anchors','sourceHash','sourceFile','raw','receipts','token','password','apiKey','supervisorNumber','arrivalLocal','publicationSalt'}
def inspect_private(s):
 def visit(v):
  if isinstance(v,dict):
   if RAW.intersection(v):raise ValueError('Raw field in planning data: '+str(RAW.intersection(v)))
   for x in v.values():visit(x)
  elif isinstance(v,list):
   for x in v:visit(x)
 visit(s)
 return {'schema':2,'classification':'APPROVED PUBLIC DERIVED PLANNING DATA','scope':'Current active roster only; original-reference scenario/diagnostic statistics','employeeCount':len(s['persons']),'storeCount':len(s['stores']),'exposed':['Current employee display names and opaque package keys','Current employee speed, evidence, recent weekly hours and residual summaries','Role-conditioned account productivity, participation and experience for current employees','Supported account/store display choices and opaque account keys','Selected-week scheduled visit dates, times, customer number, address, contact, map and schedule notes','Aggregate visit workload, duration, crew size, seasonal/attendance and residual summaries','Limited incumbent reference duration/capacity/evidence/age weights and current-employee overlap membership required for numeric parity','Current members of latest store crew and selected latest-inventory production totals/export hours/recorded clocks when unambiguous','Current-employee regular/Modas and most-recent-account rate variants; aggregate original reference profiles and archived accuracy/error summaries','Frozen model trees, thresholds and feature names; cutoff/version/fingerprint'],'excluded':['Former employee identities and selectable former staff','Employee numbers and raw export/attendance records','Raw workbooks, bulk historical visits, visit dates and complete timesheet/export rows','Databases, source receipts, archives and backups','Local paths, credentials, tokens and source file hashes'],'warning':'Anyone with the site URL can inspect the approved names and derived planning coefficients. This is not access-controlled data.'}

def verify_planning(s):
 inspect_private(s)
 expected={'scenarioRates','evidence','incumbentRates','schema','modelVersion','modelSha256','dataFingerprint','cutoff','validThrough','persons','unassignedSupervisor','stores','accounts','model','publicationScope'}
 if set(s)!=expected or s['publicationScope']!='current-roster-derived':raise ValueError('Unexpected planning fields or scope')
 ids={p['key'] for p in s['persons']}
 if not ids or len(ids)!=len(s['persons']) or any(p['active'] is not True for p in s['persons']):raise ValueError('Planning roster must contain current employees only')
 person_fields={'stableKey','key','name','active','relativeSpeed','known','recentHours','supervisorTail','baseResidual','baseSupervisorResidual','incumbentResidual','incumbentSupervisorResidual'}
 if any(set(p)!=person_fields for p in s['persons']):raise ValueError('Unexpected employee fields')
 for a in s['accounts'].values():
  if set(a)!= {'people'} or set(a['people'])!=ids:raise ValueError('Historical person leaked into account coefficients')
 for r in [*s['incumbentRates'].values(),*s['scenarioRates'].values()]:
  if set(r)!=ids:raise ValueError('Historical person leaked into incumbent rates')
 for store in s['stores']:
  if set(store)!={'key','name','context','lastCrew','stableKey','scenario','needsRx'} or not store['scenario']['variants']['default']:raise ValueError('Unexpected store fields')
  for j in store['scenario'].get('scheduleJobs',[]):
   if set(j)!={'key','date','startTime','typeOfInv','plannedDurationHours','plannedCrewSize','details'} or not s['cutoff']<=j['date']<=s['validThrough'] or (j['startTime'] and not re.fullmatch(r'\d{2}:\d{2}',j['startTime'])):raise ValueError('Unexpected scheduled-job fields or date')
   if set(j['details'])!={'customerNumber','address','city','stateCode','zipcode','phone','mapLink','dateScheduled','storeNotes','notes','runName','meetTimeText'} or any(not isinstance(v,str) for v in j['details'].values()):raise ValueError('Unexpected schedule details')
  last=store['lastCrew']
  if set(last)-{'employees','supervisor','supervisorStatus','rx','rows'}:raise ValueError('Unexpected last-crew metadata')
  if last.get('supervisorStatus','recorded' if last['supervisor'] else 'missing') not in ['recorded','not-current','missing']:raise ValueError('Invalid last-crew supervisor status')
  if 'supervisorStatus' in last and (last['supervisorStatus']=='recorded')!=bool(last['supervisor']):raise ValueError('Inconsistent last-crew supervisor status')
  for row in last.get('rows',[]):
   if row.get('support') not in ['recorded','missing','ambiguous','unconfirmed']:raise ValueError('Unexpected curated last-crew support label')
   if set(row)!={'key','piecesPerHr','inStoreHours','pieces','recordedIn','recordedOut','support'} or row['key'] not in ids or row['key'] not in last['employees']:raise ValueError('Unexpected last-crew fields or identity')
   for field in ['recordedIn','recordedOut']:
    if row[field] is not None and not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?',row[field]):raise ValueError('Invalid recorded clock')

  if not set(last['employees'])<=ids or (last['supervisor'] and last['supervisor'] not in ids) or not set(last['rx'])<=set(last['employees']):raise ValueError('Invalid current last crew')
  for k in (store['context']['incumbent']['kernels'] if store['context'] else []):
   for f in ['full','counter']:
    if not set(k[f]['members'])<=ids:raise ValueError('Former employee reference leaked')
 for store in s['stores']:
  recent=store['scenario'].get('recentAccountProduction',{})
  if set(recent)!=ids or any(v is not None and (not isinstance(v,(int,float)) or not math.isfinite(v) or v<=0) for v in recent.values()):raise ValueError('Invalid recent account production')
  for pack in store['scenario']['variants'].values():
   if not pack:continue
   if any(set(v)!=ids for v in pack.get('supervisorEstimates',{}).values()):raise ValueError('Historical supervisor identity leaked')
   if any(len(e)!=4 or not 0<=e[0]<=1 or not isinstance(e[1],int) or e[1]<0 or not isinstance(e[2],str) or not isinstance(e[3],bool) for v in pack.get('supervisorEstimates',{}).values() for e in v.values()):raise ValueError('Invalid supervisor coefficient')
   if pack['rates'] not in s['scenarioRates'] or pack['recentRates'] not in s['scenarioRates']:raise ValueError('Missing scenario rates')
   for kernel in pack['kernels']:
    if 'ageDays' in kernel or 'date' in kernel:raise ValueError('Unnecessary historical visit date exposed')
    for field in ['full','counter']:
     if not set(kernel[field]['members'])<=ids:raise ValueError('Historical person leaked into scenarios')
 if any(not re.fullmatch('[a-f0-9]{24}',p['stableKey']) for p in s['persons']+s['stores']):raise ValueError('Invalid opaque persistence identity')
 return True

def verify_public(out):
 out=pathlib.Path(out);release=json.loads((out/'release.json').read_text(encoding='utf8'));m=json.loads((out/'export-allowlist.json').read_text(encoding='utf8'))
 if set(release['files'])!={'app','predictor','planner','auth','style','planning'}:raise ValueError('Unexpected release assets')
 expected={'index.html','bootstrap.js','.nojekyll','release.json','export-allowlist.json'}|{v['path'] for v in release['files'].values()}
 actual={p.relative_to(out).as_posix() for p in out.rglob('*') if p.is_file()}
 if actual!=expected or {x['path'] for x in m['files']}!=expected:raise ValueError('Public file list differs from exact release allowlist')
 if release.get('schema')!=3 or release.get('authPolicy')!='existing-client-ui-gate-public-data':raise ValueError('Unexpected login/public-data policy')
 if m.get('rawCompanyDataIncluded') is not False:raise ValueError('Raw company-data release is not authorized')
 if m.get('containsPersonalData') is not True or m.get('containsModelWeights') is not True:raise ValueError('Approved exposure declaration mismatch')
 for f in m['files']:
  if 'sha256' in f and H((out/f['path']).read_bytes())!=f['sha256']:raise ValueError('Artifact hash mismatch '+f['path'])
 for role,f in release['files'].items():
  if not re.fullmatch(role+r'\.[a-f0-9]{64}\.'+('json' if role=='planning' else 'css' if role=='style' else 'js'),f['path']) or H((out/f['path']).read_bytes())!=f['sha256']:raise ValueError('Release filename/hash mismatch')
 if H(json.dumps({k:release[k] for k in ['files','shellSha256','bootstrapSha256']},sort_keys=True,separators=(',',':')).encode())!=release['version']:raise ValueError('Release version mismatch')
 if H((out/'index.html').read_bytes())!=release['shellSha256'] or H((out/'bootstrap.js').read_bytes())!=release['bootstrapSha256']:raise ValueError('Shell/bootstrap hash mismatch')
 verify_planning(json.loads((out/release['files']['planning']['path']).read_text(encoding='utf8')))
 for path in [out/'index.html',out/release['files']['app']['path']]:
  text=path.read_text(encoding='utf8')
  if re.search(r'type=["\x27]file|planningFile|forecastFile|readFile\(',text):raise ValueError('Visitor file input/import found')
 for f in [release['files']['app']['path'],release['files']['predictor']['path'],release['files']['planner']['path']]:
  text=(out/f).read_text(encoding='utf8')
  if re.search(r'https?://|localhost|127\.0\.0\.1|/api/|XMLHttpRequest|sendBeacon|WebSocket',text):raise ValueError('Unexpected external or local API reference')
 for name in [release['files']['app']['path'],release['files']['planner']['path'],release['files']['auth']['path']]:
  text=(out/name).read_text(encoding='utf8')
  if re.search(r'Schedule Board|scheduleMatches|scheduleFilter|boardFilter|BOARD_ALLOWED_USERS|view-schedule|data-view=[\"\']schedule',text):raise ValueError('Deprecated schedule code remains')
 return True

def build_public(w,snapshot):
 verify_planning(snapshot);src=w/'local_app/static_source';out=w/'pages_export';out.mkdir(exist_ok=True)
 # Only remove files listed in the previous managed allowlist. Unknown files stop the build.
 previous=json.loads((out/'export-allowlist.json').read_text(encoding='utf8')) if (out/'export-allowlist.json').exists() else {'files':[]}
 old={f['path'] for f in previous['files']};actual={p.relative_to(out).as_posix() for p in out.rglob('*') if p.is_file()}
 if actual-old:raise ValueError('Unknown files in pages_export: '+str(actual-old))
 predictor=asset_bytes(src/'predictor.mjs');pn='predictor.'+H(predictor)+'.js';planner=(src/'planner.mjs').read_text(encoding='utf8').replace('./predictor.mjs','./'+pn).encode();en='planner.'+H(planner)+'.js'
 shell=(src/'index.html').read_text(encoding='utf8');body=shell.split('<body>',1)[1].split('</body>',1)[0]
 app=(src/'app.mjs').read_text(encoding='utf8').replace('./predictor.mjs','./'+pn).replace('./planner.mjs','./'+en).replace("throw Error('Approved sign-in required.');","throw Error('Approved sign-in required.');\ndocument.body.innerHTML="+json.dumps(body)+';').encode()
 content={'predictor':predictor,'planner':planner,'auth':asset_bytes(src/'auth.mjs'),'app':app,'style':asset_bytes(src/'style.css'),'planning':json.dumps(snapshot,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode()}
 files={role:{'path':role+'.'+H(data)+('.json' if role=='planning' else '.css' if role=='style' else '.js'),'sha256':H(data)} for role,data in content.items()}
 release={'schema':3,'authPolicy':'existing-client-ui-gate-public-data','version':H(json.dumps(files,sort_keys=True,separators=(',',':')).encode()),'cutoff':snapshot['cutoff'],'validThrough':snapshot['validThrough'],'files':files}
 index=b'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' https://www.gstatic.com https://apis.google.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.googleapis.com https://*.firebaseapp.com; script-src 'self' https://www.gstatic.com https://apis.google.com; frame-src https://*.firebaseapp.com https://accounts.google.com; style-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>Shift Crew Planner</title></head><body><main role="status" aria-live="polite"><h1>Shift Crew Planner</h1><p id="bootStatus">Loading latest shared planning data...</p><button id="retry" type="button" hidden>Retry loading</button></main><script type="module" src="./bootstrap.js?v=3"></script></body></html>'''
 bootstrap=asset_bytes(src/'bootstrap.mjs');index=index.replace(b'bootstrap.js?v=3',b'bootstrap.js?v='+H(bootstrap).encode());release.update(shellSha256=H(index),bootstrapSha256=H(bootstrap));release['version']=H(json.dumps({k:release[k] for k in ['files','shellSha256','bootstrapSha256']},sort_keys=True,separators=(',',':')).encode())
 output={'index.html':index,'bootstrap.js':bootstrap,'.nojekyll':b'','release.json':json.dumps(release,indent=2).encode(),**{files[k]['path']:v for k,v in content.items()}}
 for name in old-set(output)-{'export-allowlist.json'}:
  path=out/name
  if path.parent!=out:raise ValueError('Unsafe old artifact path')
  path.unlink()
 for n,data in output.items():(out/n).write_bytes(data)
 manifest={'schema':3,'authPolicy':'Existing Firebase/Google + client email UI gate; static planning data and UI allowlist remain public','classification':'APPROVED PUBLIC CURRENT-ROSTER DERIVED PLANNING DATA','containsPersonalData':True,'containsModelWeights':True,'rawCompanyDataIncluded':False,'selectedLastCrewHistoricalValuesIncluded':any(st.get('lastCrew',{}).get('rows') for st in snapshot['stores']),'exposure':inspect_private(snapshot),'files':[{'path':n,'sha256':H(data)} for n,data in output.items()]+[{'path':'export-allowlist.json','purpose':'Exact release allowlist and exposure inventory'}]}
 (out/'export-allowlist.json').write_text(json.dumps(manifest,indent=2),encoding='utf8',newline='\n');verify_public(out);build_clean_repository(w,out);return release

def build_clean_repository(w,out):
 repo=w/'pages_repository';previous={p.relative_to(repo/'pages_export').as_posix() for p in (repo/'pages_export').rglob('*') if p.is_file()} if (repo/'pages_export').exists() else set()
 expected={'.gitattributes','.github/workflows/pages.yml','tools/verify_pages.py','README.txt','PUBLICATION_HOLD.txt'}|{'pages_export/'+n for n in previous}
 actual={p.relative_to(repo).as_posix() for p in repo.rglob('*') if p.is_file() and '.git' not in p.parts} if repo.exists() else set()
 if (repo/'.git').exists():
  verify_repository_root(repo)
  staged=subprocess.run(['git','-C',str(repo),'diff','--cached','--name-only'],capture_output=True,text=True)
  if staged.stdout.strip():raise ValueError('Publishing repository contains staged user work. Build stopped without overwriting it; unstage or preserve that work before rebuilding.')
 if actual-expected:raise ValueError('Unknown publishing files')
 repo.mkdir(parents=True,exist_ok=True)
 (repo/'.gitattributes').write_bytes(GIT_ATTRIBUTES.encode('utf8'))
 target=repo/'pages_export';target.mkdir(parents=True,exist_ok=True)
 if previous:
  manifest=json.loads((target/'export-allowlist.json').read_text(encoding='utf8'));declared={f['path'] for f in manifest['files']};assert previous<=declared and all(n.startswith('planning.') for n in declared-previous)
 for name in previous-{p.name for p in out.iterdir()}:(target/name).unlink()
 for p in out.iterdir():(target/p.name).write_bytes(p.read_bytes())
 for n,source in {'.github/workflows/pages.yml':w/'local_app/static_tools/pages.yml','tools/verify_pages.py':w/'local_app/static_tools/verify_export.py'}.items():
  p=repo/n;p.parent.mkdir(parents=True,exist_ok=True);data=source.read_bytes()
  if n=='.github/workflows/pages.yml' and (repo/'PUBLICATION_HOLD.txt').exists():data=data.replace(b'    steps:\n',b'    steps:\n      - name: Work-in-progress publication hold\n        run: exit 1\n',1)
  p.write_bytes(data)
 (repo/'README.txt').write_text('Shared Shift Crew Planner. This clean publishing folder includes approved current employee names and derived planning statistics/model weights, enumerated in pages_export/export-allowlist.json. Raw exports, timesheets, former employee identities, databases and backups remain local. Build locally after imports; commit only this folder and push main. The Pages Actions workflow publishes automatically on main pushes. Do not copy the parent Website repository or its Git history. No visitor uploads or file selection. Existing Google sign-in and a client-side approved-email list gate the UI only; static planning data remains publicly downloadable. Do not push while PUBLICATION_HOLD.txt exists. See the local weekly guide.\n',encoding='utf8')
 verify_public(target)
def verify_repository_root(repo):
 repo=pathlib.Path(repo).resolve()
 run=subprocess.run(['git','-C',str(repo),'rev-parse','--show-toplevel'],capture_output=True,text=True)
 if run.returncode or pathlib.Path(run.stdout.strip()).resolve()!=repo:raise ValueError('Publishing folder inherits another Git repository. Initialize this folder separately and verify its root before staging or changing remotes.')
 if (repo/'EmployeeProductionExport.json').exists() or (repo/'EmployeeProductionExport.xlsx').exists():raise ValueError('This is the private parent Website repository. Use the separate clean pages_repository before staging or publishing.')
 tracked=subprocess.run(['git','-C',str(repo),'ls-files'],capture_output=True,text=True)
 if any(not (name.startswith('pages_export/') or name in ['.gitattributes','README.txt','.github/workflows/pages.yml','tools/verify_pages.py']) for name in tracked.stdout.splitlines()):raise ValueError('Publishing repository tracks files outside the reviewed generated scope. Review those files before staging/publishing.')
 return True

if __name__=='__main__':
 import sys
 target=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'pages_export');verify_public(target)
 if (target.parent/'PUBLICATION_HOLD.txt').exists():raise SystemExit('Publication is on hold while feature and login verification finishes. Do not stage/push yet.')
 if pathlib.Path(__file__).name=='verify_pages.py':verify_repository_root(target.parent)
 print('Approved derived release: allowlist, hashes, current roster and no visitor file controls passed.')
