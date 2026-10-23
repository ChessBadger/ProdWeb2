"""Versioned local storage. Raw receipts are immutable; SQLite commits effective state."""
from contextlib import contextmanager,closing
import os,sys,json,sqlite3,pathlib,hashlib,datetime,threading,uuid,gzip,zipfile,tempfile,shutil,re,copy
ROOT=pathlib.Path(__file__).resolve().parent;WEBSITE=ROOT.parent
sys.path.insert(0,str(WEBSITE))
from export_history import archive_lock,archive_export,default_archive_dir,load_manifest,latest_payload,verify_archive,json_bytes
from convert_xl_to_json import read_excel_payload
from timesheet_parser import audit,clock
from features import identity,week
from counting_mode import counting_mode
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest()
def signature(path):
 s=pathlib.PureWindowsPath(path).stem.upper();s=re.sub(r'(?<!\d)\d{4}[- ]\d{4}(?!\d)',' ',s);s=re.sub(r'(?<!\d)(?:20\d{6}|\d{6})(?!\d)',' ',s);s=re.sub(r'\b(?:TIMESHEET|TIMESHEETS|TIME SHEET|TS|COPY|FINAL|REVISED)\b',' ',s);return ' '.join(re.findall(r'[A-Z0-9]+',s))
def filename_key(path):
 s=pathlib.PureWindowsPath(path).stem;codes=re.findall(r'(?<!\d)(\d{4})[- ](\d{4})(?!\d)',s);dates=[]
 for d in re.findall(r'(?<!\d)(20\d{6}|\d{6})(?!\d)',s):
  try:dates.append(datetime.datetime.strptime(d,'%Y%m%d' if len(d)==8 else '%y%m%d').date().isoformat())
  except ValueError:pass
 return (''.join(codes[0]),dates[0]) if len(codes)==1 and len(set(dates))==1 else None

def atomic(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
 with tmp.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 os.replace(tmp,path)
class Store:
 def __init__(self,data_dir=None,timesheet_root=None,export_dir=None,isolated=False):
  namespace=sha(str(WEBSITE.resolve()).casefold().encode())[:12];self.root=pathlib.Path(data_dir or pathlib.Path(os.environ.get('LOCALAPPDATA',str(pathlib.Path.home())))/'EmployeePredictor'/'SiteHistory'/namespace).resolve();self.root.mkdir(parents=True,exist_ok=True);self.timesheet_root=pathlib.Path(timesheet_root or r'C:\Users\Laptop 122\Desktop\Store Prep\Timesheets History').resolve();self.export_dir=pathlib.Path(export_dir or (self.root/'export_archive' if (self.root/'export_archive').exists() or isolated else default_archive_dir(WEBSITE)));self.isolated=isolated;self.lock=threading.RLock();self.cached=None;self.generation=0;self.dbpath=self.root/'history.sqlite3'
  with self.db() as db:
   db.executescript('''CREATE TABLE IF NOT EXISTS receipts(hash TEXT PRIMARY KEY,kind TEXT,name TEXT,received TEXT,raw TEXT,payload TEXT);CREATE TABLE IF NOT EXISTS event_versions(event_key TEXT,receipt TEXT,received TEXT,payload TEXT,PRIMARY KEY(event_key,receipt));CREATE TABLE IF NOT EXISTS events(event_key TEXT PRIMARY KEY,receipt TEXT,payload TEXT);CREATE TABLE IF NOT EXISTS forecasts(id TEXT PRIMARY KEY,signature TEXT UNIQUE,saved TEXT,payload TEXT);CREATE TABLE IF NOT EXISTS mappings(store TEXT PRIMARY KEY,alias TEXT,received TEXT);CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,kind TEXT,status TEXT,message TEXT,created TEXT,updated TEXT);CREATE TABLE IF NOT EXISTS residuals(event_key TEXT PRIMARY KEY,payload TEXT);CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);''');db.execute("UPDATE operations SET status='interrupted',message='Application stopped before completion. Raw receipts and committed history are preserved; retry the import.',updated=? WHERE status IN ('queued','running')",(now(),))
  self.seed={}
  for k,n in [('history','history.json'),('records','records.json'),('meta','metadata.json'),('attendance','attendance.json'),('paired','paired.json'),('model','model.json'),('analytics','analytics.json')]:self.seed[k]=json.loads((ROOT/'seed'/n).read_text(encoding='utf8'))
  for k,n in [('salvage','salvage.jsonl'),('extraRates','extra_rates.jsonl')]:self.seed[k]=[json.loads(l) for l in (ROOT/'seed'/n).read_text(encoding='utf8').splitlines() if l]
  manifest=json.loads((ROOT/'seed/manifest.json').read_text())
  for name,digest in manifest.items():
   if sha((ROOT/'seed'/name).read_bytes())!=digest:raise ValueError('Model/history seed integrity failure: '+name)
  self.seed['modelHash']=sha((ROOT/'seed/model.json').read_bytes());self.recover_exports()
  if not isolated and not self.timesheet_root.is_relative_to(pathlib.Path(r'C:\Users\Laptop 122\Desktop\Store Prep\Timesheets History').resolve()):raise ValueError('Timesheets must come from the local copied folder.')
  with self.db() as db:
   if not db.execute("SELECT 1 FROM settings WHERE key='publication_identity_salt'").fetchone():db.execute('INSERT INTO settings VALUES(?,?)',('publication_identity_salt',os.urandom(32).hex()))
   if not db.execute("SELECT 1 FROM settings WHERE key='initial_export_hashes'").fetchone():
    payload=json.loads(db.execute("SELECT value FROM settings WHERE key='export_payload'").fetchone()[0]);db.execute('INSERT INTO settings VALUES(?,?)',('initial_export_hashes',json.dumps({r['_history']['rowSha256']:True for r in payload['EmployeeProductionHistory'] if r.get('_history')})))
 @contextmanager
 def db(self):
  db=sqlite3.connect(self.dbpath,timeout=30);db.row_factory=sqlite3.Row;db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA synchronous=FULL')
  try:
   yield db;db.commit()
  except Exception:
   db.rollback();raise
  finally:db.close()
 def operation(self,kind):
  oid=uuid.uuid4().hex
  with self.db() as db:db.execute('INSERT INTO operations(id,kind,status,message,created,updated) VALUES(?,?,?,?,?,?)',(oid,kind,'queued','Waiting',now(),now()))
  return oid
 def op(self,oid,status,message):
  with self.db() as db:db.execute('UPDATE operations SET status=?,message=?,updated=? WHERE id=?',(status,message,now(),oid))
 def invalidate(self):self.cached=None;self.generation+=1
 def recover_exports(self):
  # Archive manifest is committed before derived site state. Recover publication on startup.
  if (self.export_dir/'manifest.json').exists():
   manifest=load_manifest(self.export_dir);payload=latest_payload(self.export_dir,manifest)
   if payload.get('_meta'):
    with self.db() as db:db.execute('INSERT OR REPLACE INTO settings VALUES(?,?)',('export_payload',json.dumps(payload)))
  else:
   with self.db() as db:
    if not db.execute("SELECT 1 FROM settings WHERE key='export_payload'").fetchone():db.execute('INSERT INTO settings VALUES(?,?)',('export_payload',(WEBSITE/'EmployeeProductionHistory.json').read_text(encoding='utf8')))
 def raw(self,kind,name,data):
  digest=sha(data);ext=pathlib.Path(name).suffix.lower();p=self.root/'raw'/kind/(digest+ext);p.parent.mkdir(parents=True,exist_ok=True)
  if p.exists():
   if sha(p.read_bytes())!=digest:raise ValueError('Archived raw receipt hash mismatch')
  else:
   with p.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
  return digest,p
 def import_timesheet(self,relative,fail_before_commit=False):
  with self.lock:
   source=(self.timesheet_root/relative).resolve()
   if not source.is_relative_to(self.timesheet_root) or not source.is_file():raise ValueError('Choose a file inside the verified local Timesheets History copy.')
   if source.suffix.lower() not in ['.xls','.xlsx','.xlsm']:raise ValueError('Choose an Excel timesheet.')
   before=source.stat()
   if before.st_size>30*1024*1024:raise ValueError('Timesheet exceeds 30MB limit.')
   raw=source.read_bytes();after=source.stat()
   if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):raise ValueError('Timesheet changed while reading; retry after it is saved.')
   return self.import_timesheet_bytes(source.name,raw,fail_before_commit)
 def import_timesheet_bytes(self,name,raw,fail_before_commit=False):
  with self.lock:
   source=pathlib.Path(pathlib.PureWindowsPath(name).name)
   if source.suffix.lower() not in ['.xls','.xlsx','.xlsm']:raise ValueError('Choose an Excel timesheet.')
   if not raw or len(raw)>30*1024*1024:raise ValueError('Choose a nonempty timesheet no larger than 30MB.')
   digest,path=self.raw('timesheets',source.name,raw)
   with self.db() as db:
    if db.execute('SELECT 1 FROM receipts WHERE hash=?',(digest,)).fetchone():return {'duplicate':True,'hash':digest,'message':'Identical timesheet already imported; effective history unchanged.'}
   st=path.stat();parsed=audit({'local_path':str(path),'relative':source.name,'sha256':digest,'bytes':st.st_size,'local_mtime_ns':st.st_mtime_ns})
   if parsed['status']!='ok':raise ValueError('Cannot parse timesheet: '+parsed.get('error','unknown error'))
   aa=parsed['attendance'];keys={(a['store'],a['date']) for a in aa};mm={(a['store'],a['date']) for a in parsed['metadata']}
   if len(keys)!=1 or mm!=keys or not aa:raise ValueError('Timesheet must contain one consistent customer/date and attendance table.')
   key=next(iter(keys));fk=filename_key(source.name)
   if fk!=key:raise ValueError('Filename customer/date must match the workbook tables (for example 1234-5678 261013 Store Timesheet.xlsx).')
   if len({a['employee'] for a in aa})!=len(aa):raise ValueError('Duplicate employee rows need review; nothing merged.')
   for a in aa:
    if not re.fullmatch(r'\d{8}',a['store'] or '') or not re.fullmatch(r'\d{4}',a['employee'] or ''):raise ValueError('Invalid customer/employee identifier.')
    if a['time_in_s'] is None or a['time_out_s'] is None or not 0<(a['time_out_s']-a['time_in_s'])/3600<=18:raise ValueError('Missing, overnight or invalid attendance interval needs review.')
   duration=(max(a['time_out_s'] for a in aa)-min(a['time_in_s'] for a in aa))/3600
   if not 0<duration<=18:raise ValueError('Full visit span is outside the validated same-day range.')
   supervisors={m['supervisor'] for m in parsed['metadata'] if m['supervisor']};finishes={m['count_finished_s'] for m in parsed['metadata'] if m['count_finished_s'] is not None}
   if len(supervisors)>1:raise ValueError('Conflicting supervisor identities.')
   if datetime.date.fromisoformat(key[1])>datetime.date.today()+datetime.timedelta(days=1):raise ValueError('Future completed attendance cannot be imported.')
   event={'store':key[0],'date':key[1],'duration':duration,'employees':[a['employee'] for a in aa],'supervisor':next(iter(supervisors),'') ,'rx':[a['employee'] for a in aa if a['rx'] is True],'signature':signature(source.name),'attendance':aa,'postCountHours':(max(a['time_out_s'] for a in aa)-next(iter(finishes)))/3600 if len(finishes)==1 else None,'sourceName':source.name,'sourceHash':digest,'receivedAt':now()}
   if event['postCountHours'] is not None and not 0<=event['postCountHours']<=duration:event['postCountHours']=None
   eid='|'.join(key)
   previous_state=self.state();previous_job=next((j for j in previous_state['history']['jobs'] if j['id']==eid),None)
   if previous_job and set(previous_job['employees'])==set(event['employees']):event['previousProduction']={'job':previous_job,'records':previous_state['records'][eid]}
   if fail_before_commit:raise RuntimeError('Injected interruption before commit; raw receipt retained.')
   with self.db() as db:
    prior=db.execute('SELECT receipt FROM events WHERE event_key=?',(eid,)).fetchone();payload=json.dumps(event);db.execute('INSERT INTO receipts VALUES(?,?,?,?,?,?)',(digest,'timesheet',source.name,event['receivedAt'],str(path.relative_to(self.root)),payload));db.execute('INSERT INTO event_versions VALUES(?,?,?,?)',(eid,digest,event['receivedAt'],payload));db.execute('INSERT OR REPLACE INTO events VALUES(?,?,?)',(eid,digest,payload))
   self.invalidate();return {'duplicate':False,'revision':bool(prior),'event':eid,'hash':digest,'message':'Timesheet archived; attendance and model eligibility refreshed. Unmatched production remains attendance-only.'}
 def import_production(self,name,data,fail_after_archive=False,import_mode="historical_backfill",publish_parent=True):
  with self.lock:
   if pathlib.Path(name).suffix.lower() not in ['.xlsx','.xlsm','.xls']:raise ValueError('Choose an EmployeeProduction Excel workbook.')
   
   if not (self.export_dir/'manifest.json').exists():raise ValueError('Production archive is missing. Restore it before importing; retained history has not been replaced.')
   digest,path=self.raw('production_uploads',pathlib.Path(name).name,data);captured,payload=read_excel_payload(path);result=archive_export(pathlib.Path(pathlib.Path(name).name),payload,self.export_dir,WEBSITE,source_bytes=captured,import_mode=import_mode)
   if fail_after_archive:raise RuntimeError('Injected interruption after archive commit. Restart/retry recovers publication.')
   result['payload']=json.loads(json_bytes(result['payload']))
   with self.db() as db:db.execute('INSERT OR REPLACE INTO settings VALUES(?,?)',('export_payload',json.dumps(result['payload'])))
   # Existing importer archive is the source of truth; publish only derived JSON, never replace source workbook.
   if publish_parent and not self.isolated and import_mode=="current" and not result.get("rosterReclassified"):
    history=result['payload'];meta=history['_meta'];current=[{k:v for k,v in r.items() if k!='_history'} for r in history['EmployeeProductionHistory'] if r['_history']['sourceSha256']==meta['latestExportSha256']]
    for directory in [WEBSITE,WEBSITE/'public/data',WEBSITE/'docs/data',WEBSITE/'data']:
     atomic(directory/'EmployeeProductionHistory.json',json_bytes(history));atomic(directory/'EmployeeProductionExport.json',json_bytes({'EmployeeProductionExport':current}))
   self.invalidate();return {'duplicate':result['duplicate'],'rosterReclassified':result.get('rosterReclassified',False),'snapshot':result['payload']['_meta']['snapshotId'],'historyRows':len(result['payload']['EmployeeProductionHistory']),'importMode':import_mode,'activeEmployeeCount':len(result['payload']['_meta']['latestEmployeeIds']),'archive':str(self.export_dir),'message':('Identical workbook data retained; explicit current-roster reclassification applied without changing production revisions.' if result.get('rosterReclassified') else 'Production history archived and reconciled; earlier employees/jobs remain retained. Scheduling roster unchanged.' if import_mode=='historical_backfill' else 'Production history and explicitly supplied current roster updated.')}
 def update_roster(self,employee_ids):
  from export_history import update_roster
  with self.lock:
   backup=self.backup();payload=update_roster(self.export_dir,employee_ids)
   with self.db() as db:db.execute('INSERT OR REPLACE INTO settings VALUES(?,?)',('export_payload',json.dumps(payload)))
   self.invalidate();return {'activeEmployeeCount':len(payload['_meta']['latestEmployeeIds']),'backup':str(backup),'message':'Scheduling roster updated; all production history preserved.'}
 def map_store(self,store,alias):
  if not re.fullmatch(r'\d{8}',store):raise ValueError('Numeric customer ID must have eight digits.')
  aliases={s['alias'] for s in self.catalog()['stores']}
  if alias not in aliases:raise ValueError('Choose a known export account/store.')
  with self.lock,self.db() as db:db.execute('INSERT OR REPLACE INTO mappings VALUES(?,?,?)',(store,alias,now()));self.invalidate()
 def state(self):
  with self.lock:
   manifest=self.export_dir/'manifest.json';signature=(manifest.stat().st_mtime_ns,manifest.stat().st_size) if manifest.exists() else None
   if getattr(self,'archiveSignature',None)!=signature:
    self.recover_exports();self.cached=None;self.archiveSignature=signature
   if self.cached is not None:return self.cached
   s=copy.deepcopy(self.seed)
   with self.db() as db:
    s['publicationSalt']=db.execute("SELECT value FROM settings WHERE key='publication_identity_salt'").fetchone()[0];s['exportHistory']=json.loads(db.execute("SELECT value FROM settings WHERE key='export_payload'").fetchone()[0]);events=[json.loads(r[0]) for r in db.execute('SELECT payload FROM events ORDER BY event_key')];mappings={r['store']:r['alias'] for r in db.execute('SELECT * FROM mappings')};residuals=[json.loads(r[0]) for r in db.execute('SELECT payload FROM residuals')];initial_hashes=json.loads(db.execute("SELECT value FROM settings WHERE key='initial_export_hashes'").fetchone()[0])
   aliases=s['history']['aliases'];aliases.update({v:k for k,v in mappings.items()});jobs={j['id']:j for j in s['history']['jobs']};rows=s['exportHistory']['EmployeeProductionHistory'];bykey=collections_default();accountkeys={alias.split('||')[0]:next((j['accountKey'] for j in jobs.values() if j['storeId']==sid),alias.split('||')[0].strip().lower()) for alias,sid in aliases.items()}
   for r in rows:
    alias=str(r.get('AccountName') or r.get('Account') or '').strip()+'||'+str(r.get('StoreName') or '').strip();bykey.setdefault((alias,str(r.get('DateOfInv',''))[:10]),{})[identity(r['Employee'])]=r
   # Refresh derived mode metadata from visit telemetry, never from account-level TypeOfInv.
   mode_by_visit={key:counting_mode(list(prod.values())) for key,prod in bykey.items()}
   for metadata in s['meta']['jobs']:
    key=(metadata.get('storeKey'),metadata.get('date'))
    metadata['inventoryMode']=mode_by_visit.get(key)
   # Newly received changed production rows update matching seed evidence only when physical hours and identifiers agree.
   production_changed_ids=set();production_review=[];corroborated=0;supplemental_overlap_skipped=0
   for alias,sid in list(aliases.items()):
    for (key,day),prod in bykey.items():
     if key!=alias:continue
     eid=sid+'|'+day;j=jobs.get(eid)
     if not j:continue
     details={e['id']:e for e in j['employeeDetails']}
     for emp,r in prod.items():
      if r.get('_history',{}).get('rowSha256') in initial_hashes or emp not in details:continue
      try:
       hours=(clock(r.get('TimeOut'))-clock(r.get('TimeIn')))/3600;q=float(r['Total_Ext_Qty']);count=float(r['Count_Record']);assert abs(hours-details[emp]['hours'])<1/3600 and q>=0 and count>=0 and count.is_integer()
      except (ValueError,TypeError,KeyError,AssertionError):continue
      prior_count=s['records'][eid]['employeeRecords'].get(emp)
      if r.get('_history',{}).get('revision',1)<=1:
       if abs(q-details[emp]['quantity'])>1e-6 or prior_count!=int(count):
        production_review.append({'event':eid,'employee':emp,'reason':'Newly observed export disagrees with retained scan quantities/records; retained scan evidence preserved.'});continue
       corroborated+=1;continue
      details[emp]['quantity']=q;s['records'][eid]['employeeRecords'][emp]=int(count);production_changed_ids.add(eid)
     if eid in production_changed_ids:
      j['quantity']=sum(e['quantity'] for e in j['employeeDetails']);s['records'][eid]['totalAttributedRecords']=sum(s['records'][eid]['employeeRecords'].values())
   # Add newly observed individual rates without manufacturing missing whole-job totals.
   full_rate_keys={(j['storeId'],j['date'],e['id']) for j in jobs.values() for e in j['employeeDetails']}
   salvage_keys={(x.get('storeId'),x['date'],x['employee']) for x in s['salvage']}
   for (alias,day),prod in bykey.items():
    sid=aliases.get(alias);acct=accountkeys.get(alias.split('||')[0]);group=alias
    for emp,r in prod.items():
     if r.get('_history',{}).get('rowSha256') in initial_hashes or (sid,day,emp) in full_rate_keys:continue
     if sid is not None and (sid,day,emp) in salvage_keys:
      supplemental_overlap_skipped+=1;continue
     try:
      hours=(clock(r.get('TimeOut'))-clock(r.get('TimeIn')))/3600;q=float(r['Total_Ext_Qty']);assert 0<hours<=18 and q>=0
     except (ValueError,TypeError,KeyError,AssertionError):continue
     s['extraRates']=[x for x in s['extraRates'] if not (x['date']==day and x['employee']==emp and x.get('storeId')==sid and (sid is not None or x.get('storeAlias')==alias))]
     s['extraRates'].append({'date':day,'storeId':sid,'accountKey':acct,'globalSkillGroup':group,'employee':emp,'quantity':q,'physicalHours':hours,'supervisor':identity(r.get('SupervisorNumber',''))==emp,'rx':bool(r.get('Rx')),'inventoryMode':counting_mode(list(prod.values())),'typeOfInv':r.get('TypeOfInv','Unknown'),'storeAlias':alias,'records':float(r['Count_Record']) if r.get('Count_Record') is not None else None})
   pending=[];candidates={r['store']+'|'+r['date']:r for r in s['attendance']['accepted_candidates']};anchors={(r['store'],r['date']):r for r in s['attendance']['anchors']}
   for a in events:
    eid=a['store']+'|'+a['date'];known=[k for k,v in aliases.items() if v==a['store']];alias=mappings.get(a['store']) or (known[0] if len(known)==1 else next((k for k in known if (k,a['date']) in bykey),None));old=jobs.get(eid) or a.get('previousProduction',{}).get('job');acct=old['accountKey'] if old else accountkeys.get(alias.split('||')[0],alias.split('||')[0].strip().lower()) if alias else None;prod=bykey.get((alias,a['date']),{}) if alias else {};details=[];records={};valid=bool(alias) and set(prod)==set(a['employees'])
    if valid:
     for ar in a['attendance']:
      r=prod[ar['employee']]
      try:q=float(r['Total_Ext_Qty']);n=float(r['Count_Record']);assert q>=0 and n>=0 and n.is_integer();assert abs(clock(r.get('TimeIn'))-ar['time_in_s'])<1 and abs(clock(r.get('TimeOut'))-ar['time_out_s'])<1
      except (KeyError,ValueError,TypeError,AssertionError):valid=False;break
      details.append({'id':ar['employee'],'hours':(ar['time_out_s']-ar['time_in_s'])/3600,'quantity':q});records[ar['employee']]=int(n)
    if not valid and old and set(old['employees'])==set(a['employees']):
     quantities={e['id']:e['quantity'] for e in old['employeeDetails']};details=[{'id':ar['employee'],'hours':(ar['time_out_s']-ar['time_in_s'])/3600,'quantity':quantities[ar['employee']]} for ar in a['attendance']];records=(s['records'].get(eid) or a.get('previousProduction',{}).get('records',{}))['employeeRecords'];valid=True
    if valid:
     jobs[eid]={'id':eid,'storeId':a['store'],'date':a['date'],'accountKey':acct,'duration':a['duration'],'quantity':sum(e['quantity'] for e in details),'employees':a['employees'],'supervisor':a['supervisor'],'rx':a['rx'],'employeeDetails':details,'postCountHours':a['postCountHours'],'arrivalLocal':a['date']+'T'+str(datetime.timedelta(seconds=int(min(x['time_in_s'] for x in a['attendance'])))).zfill(8),'mappingConfidence':'explicit_user_mapping' if a['store'] in mappings else 'retained_alias','revisionPolicy':'latest_received_validated_timesheet','sourceHash':a['sourceHash']};s['records'][eid]={'employeeRecords':records,'totalAttributedRecords':sum(records.values())};anchors[(a['store'],a['date'])]={'store':a['store'],'date':a['date'],'signature':a['signature'],'mapping':jobs[eid]['mappingConfidence']};candidates.pop(eid,None)
     if prod:
      types={r.get('TypeOfInv','Unknown') for r in prod.values()};modes={counting_mode(list(prod.values()))};s['meta']['jobs']=[m for m in s['meta']['jobs'] if not (m.get('storeKey')==alias and m['date']==a['date'])]+[{'storeKey':alias,'date':a['date'],'typeOfInv':next(iter(types)) if len(types)==1 else 'Unknown','inventoryMode':next(iter(modes)) if len(modes)==1 else None}]
    else:
     jobs.pop(eid,None);candidates[eid]=a;pending.append({'event':eid,'sourceName':a['sourceName'],'store':a['store'],'reason':'Map customer to an export store.' if not alias else 'Attendance retained; complete matching production/clock evidence is not yet available.'})
   fullkeys={(j['storeId'],j['date'],e['id']) for j in jobs.values() for e in j['employeeDetails']};s['extraRates']=[e for e in s['extraRates'] if (e.get('storeId'),e['date'],e['employee']) not in fullkeys];s['salvage']=[e for e in s['salvage'] if (e.get('storeId'),e['date'],e['employee']) not in fullkeys];s['history']['jobs']=sorted(jobs.values(),key=lambda j:(j['date'],j['storeId']));s['attendance']['accepted_candidates']=list(candidates.values());s['attendance']['anchors']=list(anchors.values());changed_ids={a['store']+'|'+a['date'] for a in events}|production_changed_ids;paired={r['storeId']+'|'+r['date']:r for r in s['paired']}
   for r in residuals:paired[r['storeId']+'|'+r['date']]=r
   for eid in changed_ids:
    if eid in paired and eid in jobs:paired[eid]={**paired[eid],'actual':jobs[eid]['duration']}
   s['paired']=list(paired.values());s['changedIds']=list(changed_ids);s['pending']=pending;s['importedEvents']=events;s['productionReview']={'corroboratedSeedEmployeeRows':corroborated,'conflictingSeedEmployeeRows':production_review,'supplementalOverlapSkipped':supplemental_overlap_skipped};s['fingerprint']=sha(json.dumps({'jobs':s['history']['jobs'],'events':events,'export':s['exportHistory'].get('_meta',{}),'model':s['modelHash'],'planningRules':'four-field-mode-supervisors-and-layered-rx-v4'},sort_keys=True).encode());self.cached=s;return s
 def refresh(self):
  from features import bridge
  self.invalidate();s=self.state();seed_ids={r['storeId']+'|'+r['date'] for r in self.seed['paired']};existing={r['storeId']+'|'+r['date'] for r in s['paired']};todo=[j for j in s['history']['jobs'] if (j.get('sourceHash') or j['id'] in s.get('changedIds',[])) and j['id'] not in existing];count=0
  for j in todo:
   alias=next((k for k,v in s['history']['aliases'].items() if v==j['storeId']),None)
   if not alias:continue
   p={'storeId':j['storeId'],'storeKey':alias,'accountKey':j['accountKey'],'date':j['date'],'historyCutoff':week(j['date']),'employees':j['employees'],'roles':{'supervisor':j['supervisor'],'rx':j['rx']}}
   if not any(h['accountKey']==j['accountKey'] and h['date']<p['historyCutoff'] for h in s['history']['jobs']):continue
   o=bridge(s,p)
   if o.get('base') is None or o.get('incumbent') is None:continue
   r={'storeId':j['storeId'],'date':j['date'],'cutoff':p['historyCutoff'],'account':j['accountKey'],'actual':j['duration'],'incumbent':o['incumbent'],'candidates':{'0.3':o['base']}}
   with self.db() as db:db.execute('INSERT OR REPLACE INTO residuals VALUES(?,?)',(j['id'],json.dumps(r)))
   count+=1
  self.invalidate();return {'refreshed':True,'newResidualReferences':count,'completeVisits':len(self.state()['history']['jobs']),'pending':len(self.state()['pending'])}
 def catalog(self):
  s=self.state();rows=s['exportHistory']['EmployeeProductionHistory'];active={identity(x) for x in s['exportHistory'].get('_meta',{}).get('latestEmployeeIds',[])};people={};stores={};byid={j['storeId']:j for j in s['history']['jobs']}
  for r in rows:
   eid=identity(r['Employee']);people[eid]={'id':eid,'name':(' '.join(str(r.get(k) or '') for k in ['FirstName','LastName'])).strip() or eid,'active':eid in active};alias=str(r.get('AccountName') or r.get('Account') or '').strip()+'||'+str(r.get('StoreName') or '').strip();sid=s['history']['aliases'].get(alias);acct=byid.get(sid,{}).get('accountKey',alias.split('||')[0].strip().lower());stores[alias]={'alias':alias,'storeId':sid,'accountKey':acct,'name':alias.replace('||',' / ')}
  historical_ids={eid for j in s['history']['jobs'] for eid in j['employees']}|{eid for j in s['attendance']['accepted_candidates'] for eid in j['employees']}
  for eid in historical_ids:people.setdefault(eid,{'id':eid,'name':'Employee '+eid,'active':eid in active})
  with self.db() as db:forecasts=db.execute('SELECT COUNT(*) FROM forecasts').fetchone()[0];revisions=db.execute('SELECT COUNT(*) FROM event_versions').fetchone()[0];receipts=db.execute('SELECT COUNT(*) FROM receipts').fetchone()[0]
  return {'stores':sorted(stores.values(),key=lambda x:x['name']),'employees':sorted(people.values(),key=lambda x:x['name']),'counts':{'productionRows':len(rows),'historicalEmployees':len(people),'activeEmployees':sum(p['active'] for p in people.values()),'completeVisits':len(s['history']['jobs']),'attendanceReferences':len(s['attendance']['accepted_candidates']),'importedTimesheets':receipts,'attendanceVersions':revisions,'forecasts':forecasts},'pending':s['pending'],'dataDirectory':str(self.root),'timesheetDirectory':str(self.timesheet_root),'exportArchive':str(self.export_dir),'fingerprint':s['fingerprint'],'modelSha256':s['modelHash'],'today':datetime.date.today().isoformat()}
 def save_forecast(self,plan,result,start):
  when=datetime.datetime.fromisoformat(start.replace('Z','+00:00'))
  if when.date().isoformat()!=plan['date']:raise ValueError('Scheduled start must match the inventory date.')
  if when.tzinfo is None or when<=datetime.datetime.now(datetime.timezone.utc):raise ValueError('Save a forecast before its scheduled start, including timezone.')
  payload={'plan':plan,'prediction':result,'scheduledStart':start,'savedAt':now(),'dataFingerprint':self.state()['fingerprint']};digest=sha(json.dumps({'plan':plan,'result':result,'start':start,'data':payload['dataFingerprint']},sort_keys=True).encode());fid=uuid.uuid4().hex
  with self.db() as db:
   found=db.execute('SELECT id FROM forecasts WHERE signature=?',(digest,)).fetchone()
   if found:return {'id':found[0],'duplicate':True}
   db.execute('INSERT INTO forecasts VALUES(?,?,?,?)',(fid,digest,payload['savedAt'],json.dumps(payload)))
  return {'id':fid,'duplicate':False}
 def forecasts(self):
  with self.db() as db:return [{'id':r['id'],**json.loads(r['payload'])} for r in db.execute('SELECT * FROM forecasts ORDER BY saved DESC LIMIT 500')]
 def backup(self):
  with self.lock,archive_lock(self.export_dir):
   target=self.root/'backups'/('inventory-backup-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6]+'.zip');target.parent.mkdir(exist_ok=True)
   with tempfile.TemporaryDirectory(dir=self.root) as temp:
    snap=pathlib.Path(temp)/'history.sqlite3'
    with self.db() as src,closing(sqlite3.connect(snap)) as dest:src.backup(dest)
    files={'site/history.sqlite3':snap}
    for base,prefix in [(self.root/'raw','site/raw'),(self.export_dir,'exports')]:
     if base.exists():
      for p in base.rglob('*'):
       if p.is_file() and p.name!='.import.lock':files[prefix+'/'+p.relative_to(base).as_posix()]=p
    manifest={'schema':1,'created':now(),'modelHash':self.seed['modelHash'],'files':{k:sha(p.read_bytes()) for k,p in files.items()}}
    with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED) as z:
     for k,p in files.items():z.write(p,k)
     z.writestr('manifest.json',json.dumps(manifest))
   return target
 def restore_copy(self,path):
  with zipfile.ZipFile(path) as z:
   infos=z.infolist();names=[i.filename for i in infos]
   if len(names)!=len(set(names)) or sum(i.file_size for i in infos)>2*1024**3:raise ValueError('Invalid or oversized backup.')
   manifest=json.loads(z.read('manifest.json'))
   if manifest.get('schema')!=1 or set(names)!=(set(manifest['files'])|{'manifest.json'}):raise ValueError('Backup manifest mismatch.')
   for name,digest in manifest['files'].items():
    parts=pathlib.PurePosixPath(name)
    if parts.is_absolute() or '..' in parts.parts or '\\' in name or ':' in name or parts.parts[0] not in ['site','exports']:raise ValueError('Unsafe backup path.')
    if sha(z.read(name))!=digest:raise ValueError('Backup hash mismatch.')
   destination=self.root.parent/('restored-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]);destination.mkdir(exist_ok=False)
   for name in manifest['files']:
    parts=pathlib.PurePosixPath(name);relative=pathlib.Path(*parts.parts[1:]) if parts.parts[0]=='site' else pathlib.Path('export_archive',*parts.parts[1:]);p=destination/relative;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(name))
  with closing(sqlite3.connect(destination/'history.sqlite3')) as db:
   if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Restored database failed integrity check.')
  (destination/'RESTORE_INFO.txt').write_text('Restored side-by-side. Original data unchanged.\nLaunch with StartLocalSite.cmd "'+str(destination)+'"\n',encoding='utf8');return destination

def collections_default():return {}
