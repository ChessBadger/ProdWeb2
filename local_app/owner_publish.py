"""Explicit owner-triggered publication. Never stage the private parent repository."""
import pathlib,subprocess,os,json,sys,tempfile,hashlib,urllib.request,urllib.parse,datetime
ROOT=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'static_tools'))
from verify_export import verify_public,verify_repository_root
from storage import atomic
EXPECTED='https://github.com/ChessBadger/Production-Predictor.git'
SITE='https://chessbadger.github.io/Production-Predictor/'
ACTIONS='https://github.com/ChessBadger/Production-Predictor/actions'
SCOPED=['.gitattributes','README.txt','.github/workflows/pages.yml','tools/verify_pages.py','pages_export']
def allowed(name):return name.startswith('pages_export/') or name in SCOPED[:-1]
class PublishError(ValueError):pass
class Publisher:
 def __init__(self,website,store,progress=lambda message:None,build=None,expected_remote=EXPECTED):
  self.website=pathlib.Path(website).resolve();self.repo=self.website/'pages_repository';self.store=store;self.progress=progress;self.builder=build;self.expected_remote=expected_remote
 def git(self,*args,check=True):
  env=os.environ.copy();env.update(GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='never')
  try:r=subprocess.run(['git','-C',str(self.repo),*args],capture_output=True,text=True,encoding='utf8',errors='replace',env=env,timeout=180)
  except FileNotFoundError:raise PublishError('Git is missing. Install Git for Windows, then reopen this tool.')
  except subprocess.TimeoutExpired:raise PublishError('Git timed out. Check your connection and existing Git sign-in, then retry. Local imports are safe.')
  if check and r.returncode:
   if args[0] in ['push','fetch','ls-remote']:raise PublishError('Git could not '+args[0]+'. Check GitHub access/network and sign in with your normal Git client, then retry. Local history and any local commit remain safe. Open Actions only after a successful push.')
   raise PublishError('Git '+args[0]+' failed. Check repository status and your Git name/email configuration. This tool does not change credentials or configuration.')
  return r
 def unstaged_guard(self):
  if self.git('diff','--cached','--name-only').stdout.strip():raise PublishError('The publishing folder has staged changes. Preserve or unstage them in your Git client before using this tool; they were not overwritten.')
 def preflight(self):
  verify_repository_root(self.repo);self.unstaged_guard()
  if hasattr(self.store,'db'):
   with self.store.db() as db:
    if db.execute("SELECT count(*) FROM operations WHERE status IN ('queued','running') AND kind!='publish verified planner'").fetchone()[0]:raise PublishError('Wait for other local imports to finish before publishing.')
  if self.git('branch','--show-current').stdout.strip()!='main':raise PublishError('Open the publishing repository on main before publishing. No branch was changed.')
  origin=self.git('remote','get-url','origin').stdout.strip()
  accepted={self.expected_remote}
  if self.expected_remote==EXPECTED:accepted|={'git@github.com:ChessBadger/Production-Predictor.git','https://github.com/ChessBadger/Production-Predictor'}
  push_urls=self.git('remote','get-url','--push','--all','origin').stdout.splitlines()
  if len(push_urls)!=1 or push_urls[0] not in accepted:raise PublishError('Wrong push destination. Review origin push settings; only ChessBadger/Production-Predictor is permitted.')
  if origin not in accepted:raise PublishError('Wrong origin. The owner tool only publishes the separate pages_repository to ChessBadger/Production-Predictor. No remote was changed.')
  upstream=self.git('rev-parse','--symbolic-full-name','@{upstream}',check=False)
  if upstream.returncode==0 and upstream.stdout.strip()!='refs/remotes/origin/main':raise PublishError('main tracks a different remote branch. Review the publishing repository before proceeding.')
  if (self.repo/'PUBLICATION_HOLD.txt').exists():raise PublishError('Publication is on hold. Finish the local release review first.')
  paths={p.relative_to(self.repo).as_posix() for p in self.repo.rglob('*') if p.is_file() and '.git' not in p.parts}
  if any(not allowed(n) for n in paths):raise PublishError('Unexpected files exist in pages_repository. Remove private/unrelated files from this clean publishing folder before proceeding.')
  verify_public(self.repo/'pages_export')
  self.progress('Checking remote main and existing Git authentication.')
  ref=self.git('ls-remote','--heads','origin','refs/heads/main').stdout.strip()
  if ref:
   self.git('fetch','--no-tags','origin','main')
   if self.git('merge-base','--is-ancestor','FETCH_HEAD','HEAD',check=False).returncode:raise PublishError('Remote main has newer or divergent changes. Reconcile main in your Git client, then retry. Nothing was committed or force-pushed; imports are preserved.')
 def build(self):
  if self.builder:return self.builder()
  from export_week import build_snapshot,public_snapshot
  from verify_export import build_public,inspect_private
  from features import week
  self.store.refresh();state=self.store.state();catalog=self.store.catalog();cut=week(datetime.date.today().isoformat());snapshot=build_snapshot(state,catalog,cut)
  private=self.store.root/'weekly_private';out=private/('planning-'+cut+'-'+state['fingerprint'][:12]+'.json');atomic(out,json.dumps(snapshot,allow_nan=False,separators=(',',':')).encode())
  private_report=inspect_private(snapshot);private_report.update(classification='PRIVATE FULL HISTORICAL REFERENCE - NOT PUBLISHED',privateFile=str(out),sha256=hashlib.sha256(out.read_bytes()).hexdigest());atomic(private/'LATEST.json',json.dumps(private_report,indent=2).encode())
  release=build_public(self.website,public_snapshot(snapshot,state,catalog));report={'staticDirectory':str(self.website/'pages_export'),'privatePlanningFile':str(out),'publicPlanningFile':str(self.website/'pages_export'/release['files']['planning']['path']),'releaseVersion':release['version'],'cutoff':cut,'validThrough':snapshot['validThrough'],'activeRosterCount':sum(p['active'] for p in catalog['employees']),'publicContainsCompanyData':True,'publicScope':'Approved current employee names and derived prediction data only'};atomic(ROOT/'verification/static_latest.json',json.dumps(report,indent=2).encode());return release
 def verify_staged_bytes(self):
  # Verify the actual Git blob bytes, including line-ending conversions, before committing.
  with tempfile.TemporaryDirectory(prefix='owner-release-check-') as td:
   dest=pathlib.Path(td)/'pages_export';dest.mkdir()
   paths=self.git('ls-files','--','pages_export').stdout.splitlines()
   for name in paths:
    if pathlib.PurePosixPath(name).parent!=pathlib.PurePosixPath('pages_export'):raise PublishError('Unexpected nested publishing artifact.')
    data=subprocess.run(['git','-C',str(self.repo),'show',':'+name],capture_output=True,check=True).stdout;(dest/pathlib.PurePosixPath(name).name).write_bytes(data)
   verify_public(dest)
 def publish(self):
  self.preflight();lock=self.repo/'.git/employee-predictor-owner.lock'
  try:fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
  except FileExistsError:raise PublishError('Another owner publication is running. Wait for it to finish. If it was interrupted, review repository status before removing its owner lock file.')
  os.close(fd);own_tree=None;committed=False
  try:
   self.progress('Building the current week from retained local history. No new input files are required.');release=self.build();verify_public(self.repo/'pages_export');self.unstaged_guard();self.progress('Verifying and staging only reviewed public files.')
   self.git('add','-A','--',*SCOPED);staged=self.git('diff','--cached','--name-only').stdout.splitlines()
   if any(not allowed(n) for n in staged):raise PublishError('Unrelated staged changes appeared during publication. Stopped without committing them; review Git status.')
   own_tree=self.git('write-tree').stdout.strip();self.verify_staged_bytes()
   if staged:
    self.progress('Committing the verified weekly release locally.');self.git('commit','-m','Update crew planner '+release['cutoff']+' release '+release['version'][:12]);committed=True
   sha=self.git('rev-parse','HEAD').stdout.strip();self.progress('Pushing main. A successful push is not yet a completed Pages deployment.')
   push=self.git('push','origin','HEAD:refs/heads/main',check=False)
   if push.returncode:
    raise PublishError('Push failed or was rejected. Your verified local commit and imported history are preserved. Check authentication/network or reconcile newer remote main changes in your Git client, then retry Publish current changes. No force push was attempted.')
   result={'status':'pushed','commit':sha,'committed':committed,'releaseVersion':release['version'],'actionsUrl':ACTIONS,'siteUrl':SITE,'message':'Pushed successfully. GitHub Pages deployment is pending; check Actions before expecting the online update.'};atomic(self.store.root/'owner_publish.json',json.dumps(result,indent=2).encode());return result
  except Exception:
   if own_tree and not committed and self.git('write-tree',check=False).stdout.strip()==own_tree:
    self.git('reset','-q','HEAD','--',*SCOPED,check=False)
   raise
  finally:lock.unlink(missing_ok=True)
def deployment_status(store):
 p=store.root/'owner_publish.json'
 if not p.exists():return {'status':'not-published','message':'No publication has been initiated from this owner tool.','actionsUrl':ACTIONS,'siteUrl':SITE}
 result=json.loads(p.read_bytes())
 try:
  req=urllib.request.Request('https://api.github.com/repos/ChessBadger/Production-Predictor/actions/runs?head_sha='+urllib.parse.quote(result['commit'])+'&per_page=10',headers={'User-Agent':'EmployeePredictor-local-owner','Accept':'application/vnd.github+json'})
  with urllib.request.urlopen(req,timeout=10) as response:runs=json.load(response).get('workflow_runs',[])
  run=next((r for r in runs if r.get('name')=='Publish shared crew planner' and r.get('head_sha')==result['commit']),None)
  if not run:return {**result,'status':'pending','message':'Pushed; waiting for the Pages workflow to appear. Check Actions.'}
  url=run.get('html_url',ACTIONS)
  if not url.startswith('https://github.com/ChessBadger/Production-Predictor/'):url=ACTIONS
  if run.get('status')!='completed':return {**result,'status':'deploying','actionsUrl':url,'message':'Pushed; Pages workflow is '+run.get('status','pending')+'.'}
  ok=run.get('conclusion')=='success';return {**result,'status':'deployed' if ok else 'deployment-failed','actionsUrl':url,'message':'Pages workflow succeeded. Open the site to view the release.' if ok else 'Push succeeded, but Pages deployment '+str(run.get('conclusion'))+'. Open Actions for the error; the online site may still show the previous release.'}
 except Exception:return {**result,'status':'unknown','message':'Push recorded; deployment status could not be checked. Open Actions to confirm success or failure.'}
