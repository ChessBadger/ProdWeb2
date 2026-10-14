from pathlib import Path
import sys,tempfile,shutil,json,subprocess,os,datetime,io,hashlib,openpyxl,threading,urllib.request,urllib.error,time
W=Path(r'C:\Users\Laptop 122\Desktop\Store Prep\06 Employee Reports\Website');sys.path[:0]=[str(W/'local_app'),str(W/'local_app/static_tools')];from owner_publish import Publisher,PublishError;from verify_export import build_public,verify_public;from storage import Store
O=Path(tempfile.mkdtemp(prefix='predictor-owner-test-'));report={'case':str(O)};package=W/'pages_export';release=json.loads((package/'release.json').read_bytes());snapshot=json.loads((package/release['files']['planning']['path']).read_bytes());tw=O/'Website';(tw/'local_app/static_source').mkdir(parents=True);shutil.copytree(W/'local_app/static_source',tw/'local_app/static_source',dirs_exist_ok=True);(tw/'local_app/static_tools').mkdir();shutil.copyfile(W/'local_app/static_tools/pages.yml',tw/'local_app/static_tools/pages.yml');shutil.copyfile(W/'local_app/static_tools/verify_export.py',tw/'local_app/static_tools/verify_export.py');build_public(tw,snapshot);repo=tw/'pages_repository';bare=O/'remote.git'
def git(path,*args,ok=True):
 r=subprocess.run(['git','-C',str(path),*args],capture_output=True,text=True)
 if ok and r.returncode:raise RuntimeError(r.stderr)
 return r
subprocess.run(['git','init','--bare',str(bare)],capture_output=True,check=True);git(repo,'init','-b','main');git(repo,'config','user.name','Owner test');git(repo,'config','user.email','owner@example.invalid');git(repo,'add','-A','--','.gitattributes','README.txt','.github/workflows/pages.yml','tools/verify_pages.py','pages_export');git(repo,'commit','-m','Test seed');git(repo,'remote','add','origin',str(bare));git(repo,'push','-u','origin','main')
class FakeStore:root=O/'data'
FakeStore.root.mkdir();messages=[]
def build():return build_public(tw,snapshot)
def publisher():return Publisher(tw,FakeStore(),messages.append,build,expected_remote=str(bare))
# Staged work is rejected unchanged.
p=repo/'README.txt';p.write_text(p.read_text()+'staged user work\n');git(repo,'add','--','README.txt');index=git(repo,'write-tree').stdout
try:publisher().publish();raise AssertionError('Accepted staged user work')
except PublishError:pass
assert git(repo,'write-tree').stdout==index;git(repo,'reset','-q','HEAD','--','README.txt');git(repo,'checkout','--','README.txt');report['stagedWorkPreserved']=True
# Wrong push destination is rejected even when fetch origin is valid.
git(repo,'remote','set-url','--push','origin',str(O/'wrong.git'))
try:publisher().publish();raise AssertionError('Accepted wrong push URL')
except PublishError:pass
git(repo,'config','--unset-all','remote.origin.pushurl');report['wrongPushDestinationRejected']=True
# Strict artifact integrity failure before any staging.
p=repo/'pages_export/bootstrap.js';original=p.read_bytes();p.write_bytes(original+b'bad')
try:publisher().publish();raise AssertionError('Accepted modified artifact')
except ValueError:pass
p.write_bytes(original);report['verificationFailureClosed']=True
# Valid code change builds, byte verifies, commits and pushes only to the temp bare repo.
p=tw/'local_app/static_source/style.css';p.write_bytes(p.read_bytes()+b'\n/* isolated owner test */\n');r=publisher().publish();assert r['status']=='pushed' and r['committed'];assert git(bare,'rev-parse','refs/heads/main').stdout.strip()==r['commit'];assert not git(repo,'status','--porcelain').stdout.strip();verify_public(repo/'pages_export');report['scopedBuildCommitPush']=True
# No fresh files/change required, and retry does not manufacture a commit.
head=r['commit'];r=publisher().publish();assert not r['committed'] and r['commit']==head;report['publishCurrentChangesIdempotent']=True
# Remote advancement is caught without a commit or force push.
other=O/'other';subprocess.run(['git','clone','-b','main',str(bare),str(other)],capture_output=True,check=True);git(other,'config','user.name','Other test');git(other,'config','user.email','other@example.invalid');p=other/'README.txt';p.write_text(p.read_text()+'remote advancement\n');git(other,'add','README.txt');git(other,'commit','-m','Remote change');git(other,'push','origin','main')
try:publisher().publish();raise AssertionError('Accepted divergent remote')
except PublishError:pass
assert git(repo,'rev-parse','HEAD').stdout.strip()==head;report['remoteAdvanceRejectedWithoutCommit']=True;git(repo,'merge','--ff-only','origin/main')
# Server-side push rejection preserves commit and can be retried.
hook=bare/'hooks/pre-receive';hook.write_bytes(b'#!/bin/sh\nexit 1\n');p=tw/'local_app/static_source/style.css';p.write_bytes(p.read_bytes()+b'\n/* rejection test */\n')
try:publisher().publish();raise AssertionError('Push rejection hidden')
except PublishError as e:assert 'preserved' in str(e)
assert not git(repo,'diff','--cached','--name-only').stdout.strip();local=git(repo,'rev-parse','HEAD').stdout.strip();assert local!=git(bare,'rev-parse','refs/heads/main').stdout.strip();hook.unlink();assert publisher().publish()['commit']==local;report['rejectedPushPreservedAndRetryable']=True
# Missing Git auth is presented without staging or committing.
class NoAuth(Publisher):
 def git(self,*args,**kwargs):
  if args[0]=='ls-remote':raise PublishError('Check your GitHub sign-in.')
  return super().git(*args,**kwargs)
try:NoAuth(tw,FakeStore(),build=build,expected_remote=str(bare)).publish();raise AssertionError('Auth failure hidden')
except PublishError:pass
report['authFailureNoMutation']=True
# Real production workbook on an isolated pre-backfill archive.
pre=Path(json.loads((W/'local_app/verification/backfill_live.json').read_bytes())['verifiedRestore'])/'export_archive';archive=O/'archive';shutil.copytree(pre,archive);store=Store(O/'history',O/'timesheets',archive,True);before=store.state();oldRows=len(before['exportHistory']['EmployeeProductionHistory']);roster=before['exportHistory']['_meta']['latestEmployeeIds'];raw=(W/'EmployeeProductionExportLashaunfull.xlsx').read_bytes();r=store.import_production('same.xlsx',raw,import_mode='historical_backfill',publish_parent=False);assert not r['duplicate'];assert store.import_production('same.xlsx',raw,import_mode='historical_backfill',publish_parent=False)['duplicate'];assert store.state()['exportHistory']['_meta']['latestEmployeeIds']==roster;assert len(store.state()['exportHistory']['EmployeeProductionHistory'])==18277;report['realFullExportBackfillIdempotentRosterPreserved']=True
sid=next(iter(store.seed['history']['aliases'].values()));day=(datetime.date.today()-datetime.timedelta(days=1));name=sid[:4]+'-'+sid[4:]+' '+day.strftime('%y%m%d')+' OWNER TEST Timesheet.xlsx'
def timesheet(end='09:00'):
 b=openpyxl.Workbook();m=b.active;m.append(['CustomerNumber','DateOfInv','SupervisorNumber','TimeFinishedCounting']);m.append([int(sid),day,9991,'08:45']);a=b.create_sheet('Attendance');a.append(['CustomerNumber','DateOfInv','EmployeeNumber','TimeIn','TimeOut','Rx']);a.append([int(sid),day,9991,'06:00',end,0]);a.append([int(sid),day,9992,'06:00',end,0]);o=io.BytesIO();b.save(o);return o.getvalue()
t1=timesheet();t2=timesheet('10:00');assert not store.import_timesheet_bytes(name,t1)['duplicate'];assert store.import_timesheet_bytes(name,t1)['duplicate'];assert store.import_timesheet_bytes(name,t2)['revision'];assert store.import_timesheet_bytes(name,t1)['duplicate'];assert store.catalog()['counts']['attendanceVersions']==2
try:store.import_timesheet_bytes('wrong.xlsx',t2+b'x');raise AssertionError('Bad filename accepted')
except ValueError:pass
report['uploadedTimesheetValidationDuplicateAndSameNameCorrection']=True
backup=store.backup();restore=store.restore_copy(backup);restarted=Store(restore,O/'timesheets',None,True);assert restarted.catalog()['counts']==store.catalog()['counts'];report['backupAndRestartRecovery']=True
# Local HTTP mutation defenses and backup prerequisite.
from server import App,Handler,ThreadingHTTPServer
http=ThreadingHTTPServer(('127.0.0.1',0),Handler);http.app=App(store);threading.Thread(target=http.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(http.server_port)
def post(path,data,headers={}):
 req=urllib.request.Request(base+path,data=data,headers=headers,method='POST')
 try:
  with urllib.request.urlopen(req) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
assert post('/api/owner/begin-import',b'{}')[0]==403;assert post('/api/owner/begin-import',b'{}',{'X-Local-Token':http.app.token,'Origin':'https://evil.invalid'})[0]==403;headers={'X-Local-Token':http.app.token,'X-Filename':name};assert post('/api/owner/import-timesheet',t1,headers)[0]==400;assert post('/api/owner/publish',b'{}',{'X-Local-Token':http.app.token})[0]==400
report['loopbackCsrfAndBackupGuards']=True
code,task=post('/api/owner/begin-import',b'{}',{'X-Local-Token':http.app.token});assert code==202
def wait_operation(task):
 for _ in range(300):
  with store.db() as db:r=db.execute('SELECT * FROM operations WHERE id=?',(task['operation'],)).fetchone()
  if r['status']=='failed':raise AssertionError(r['message'])
  if r['status']=='complete':return json.loads(r['message'])
  time.sleep(.1)
 raise AssertionError('Operation timeout')
batch=wait_operation(task);headers['X-Import-Batch']=batch['id'];code,task=post('/api/owner/import-timesheet',t1,headers);assert code==202;assert wait_operation(task)['duplicate'];report['positiveHttpUploadUsesRealImporter']=True
# Full exports always define today's roster, even from an older cached UI sending backfill.
production_headers={'X-Local-Token':http.app.token,'X-Filename':'full.xlsx','X-Import-Batch':batch['id'],'X-Import-Mode':'historical_backfill'}
code,task=post('/api/owner/import-production',raw,production_headers);assert code==202
outcome=wait_operation(task);assert outcome['rosterReclassified'] and outcome['activeEmployeeCount']==115
assert len(store.state()['exportHistory']['EmployeeProductionHistory'])==18277
production_headers.pop('X-Import-Mode');code,task=post('/api/owner/import-production',raw,production_headers);assert code==202;assert wait_operation(task)['duplicate']
assert len(store.state()['exportHistory']['_meta']['latestEmployeeIds'])==115
report['fullExportDefinesRosterWithoutModeChoice']=True
http.shutdown();http.server_close();http.app.worker.shutdown(wait=True);report['passed']=True;Path('owner_workflow_tests.json').write_bytes(json.dumps(report,indent=2).encode());print(json.dumps(report,indent=2))
