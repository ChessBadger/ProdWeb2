"""Loopback-only local inventory website. No cloud, credentials, or publishing."""
import argparse,json,pathlib,os,sys,threading,concurrent.futures,urllib.parse,urllib.request,secrets,datetime,traceback,webbrowser,mimetypes,hashlib
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from storage import Store,atomic
from features import forecast,week,identity
class App:
 def __init__(self,store):self.store=store;self.token=secrets.token_urlsafe(32);self.worker=concurrent.futures.ThreadPoolExecutor(max_workers=1);self.predictions={};self.lock=threading.RLock()
 def submit(self,kind,fn):
  oid=self.store.operation(kind)
  def run():
   self.store.op(oid,'running','Processing locally; raw originals and prior committed history are preserved.')
   try:
    result=fn();self.store.op(oid,'complete',json.dumps(result))
   except Exception as e:self.store.op(oid,'failed',str(e))
  self.worker.submit(run);return {'operation':oid}
 def prediction(self,p):
  if not isinstance(p,dict):raise ValueError('Plan must be an object.')
  catalog=self.store.catalog();entry=next((x for x in catalog['stores'] if x['alias']==p.get('storeKey')),None)
  if not entry:raise ValueError('Choose a known store.')
  ids=list(dict.fromkeys(identity(x) for x in p.get('employees',[])));known={x['id'] for x in catalog['employees']}
  if not ids or len(ids)>50 or not set(ids)<=known:raise ValueError('Choose 1-50 known employees.')
  date=str(p.get('date',''));datetime.date.fromisoformat(date)
  if date<catalog['today']:raise ValueError('Use today or a future planning date.')
  roles=p.get('roles') or {};sup=identity(roles['supervisor']) if roles.get('supervisor') else '';rx=list(dict.fromkeys(identity(x) for x in roles.get('rx',[])))
  if sup and sup not in ids or not set(rx)<=set(ids):raise ValueError('Roles must belong to the selected crew.')
  plan={'storeKey':entry['alias'],'storeId':entry['storeId'],'accountKey':entry['accountKey'],'date':date,'historyCutoff':week(date),'employees':ids,'roles':{'supervisor':sup,'rx':rx}}
  if not entry['storeId']:return {'status':'no_history','message':'This export store is not yet linked to a numeric timesheet customer. Use Imports to map it; no history is fabricated.'},plan
  key=hashlib.sha256(json.dumps([plan,catalog['fingerprint']],sort_keys=True).encode()).hexdigest()
  with self.lock:
   if key not in self.predictions:
    result=forecast(self.store.state(),plan);self.predictions={key:result}
   result=self.predictions[key]
  return result,plan
class Handler(BaseHTTPRequestHandler):
 def log_message(self,fmt,*args):pass
 def send(self,status,obj):
  data=json.dumps(obj,allow_nan=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',len(data));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
 def valid_host(self):return self.headers.get('Host') in [f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}']
 def do_GET(self):
  if not self.valid_host():return self.send(403,{'error':'Local host only.'})
  try:
   path=urllib.parse.urlsplit(self.path);q=urllib.parse.parse_qs(path.query);app=self.server.app
   if path.path=='/api/status':return self.send(200,{**app.store.catalog(),'token':app.token})
   if path.path=='/api/forecasts':return self.send(200,{'forecasts':app.store.forecasts()})
   if path.path=='/api/operations':
    with app.store.db() as db:rows=[dict(r) for r in db.execute('SELECT * FROM operations ORDER BY created DESC LIMIT 30')]
    return self.send(200,{'operations':rows})
   if path.path=='/api/timesheets':
    text=q.get('q',[''])[0].casefold();found=[]
    # Metadata-only search of the user-owned copy; no workbook read or shared-source scan.
    for dp,ds,files in os.walk(app.store.timesheet_root):
     for n in files:
      if pathlib.Path(n).suffix.lower() in ['.xls','.xlsx','.xlsm'] and text in n.casefold():
       rel=str((pathlib.Path(dp)/n).relative_to(app.store.timesheet_root));found.append(rel)
       if len(found)>=100:break
     if len(found)>=100:break
    return self.send(200,{'files':found,'limit':100})
   if path.path=='/api/download-backup':
    name=q.get('name',[''])[0];p=(app.store.root/'backups'/name).resolve()
    if p.parent!=(app.store.root/'backups').resolve() or not p.is_file():return self.send(404,{'error':'Backup not found.'})
    return self.file(p,download=True)
   if path.path=='/':return self.file(ROOT/'web/index.html')
   if path.path in ['/app.js','/style.css']:return self.file(ROOT/'web'/path.path[1:])
   return self.send(404,{'error':'Not found'})
  except Exception as e:return self.send(400,{'error':str(e)})
 def file(self,p,download=False):
  data=p.read_bytes();self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(p.name)[0] or 'application/octet-stream');self.send_header('Content-Length',len(data));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
  if download:self.send_header('Content-Disposition','attachment; filename="'+p.name+'"')
  self.end_headers();self.wfile.write(data)
 def do_POST(self):
  if not self.valid_host():return self.send(403,{'error':'Local host only.'})
  app=self.server.app
  if self.headers.get('X-Local-Token')!=app.token:return self.send(403,{'error':'Refresh this local page before making changes.'})
  origin=self.headers.get('Origin')
  if origin and origin not in [f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}']:return self.send(403,{'error':'Unexpected origin.'})
  try:
   size=int(self.headers.get('Content-Length','0'));path=urllib.parse.urlsplit(self.path).path;limit=2*1024**3 if path=='/api/restore' else 50*1024**2
   if not 0<size<=limit:raise ValueError('Request is empty or too large.')
   raw=self.rfile.read(size)
   if path=='/api/import-production':
    name=urllib.parse.unquote(self.headers.get('X-Filename','EmployeeProductionExport.xlsx'))
    def importing():r=app.store.import_production(name,raw,import_mode=self.headers.get('X-Import-Mode','current'));return {**r,**app.store.refresh()}
    return self.send(202,app.submit('production import',importing))
   if path=='/api/restore':
    _,p=app.store.raw('restore_uploads','backup.zip',raw)
    def restoring():
     dest=app.store.restore_copy(p);return {'restoredDirectory':str(dest),'message':'Restored to a new copy; current history unchanged. Launch StartLocalSite.cmd with this directory to use it.'}
    return self.send(202,app.submit('restore to new copy',restoring))
   body=json.loads(raw)
   if path=='/api/predict':r,p=app.prediction(body);return self.send(200,r)
   if path=='/api/forecast':
    r,p=app.prediction(body['plan'])
    if r['status']!='ok':raise ValueError('A supported prediction is required before saving.')
    return self.send(200,app.store.save_forecast(p,r,body['scheduledStart']))
   if path=='/api/import-timesheets':
    files=body.get('files',[])
    if not files or len(files)>100:raise ValueError('Choose 1-100 copied timesheets per import.')
    def importing():
     results=[]
     for relative in files:
      try:results.append({'file':relative,**app.store.import_timesheet(relative)})
      except Exception as e:results.append({'file':relative,'error':str(e)})
     return {'files':results,**app.store.refresh()}
    return self.send(202,app.submit('timesheet import',importing))
   if path=='/api/map':app.store.map_store(body['store'],body['alias']);return self.send(202,app.submit('refresh mapped history',app.store.refresh))
   if path=='/api/backup':
    def backing():p=app.store.backup();return {'file':p.name,'path':str(p),'download':'/api/download-backup?name='+urllib.parse.quote(p.name)}
    return self.send(202,app.submit('backup',backing))
   return self.send(404,{'error':'Not found'})
  except Exception as e:return self.send(400,{'error':str(e)})
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--port',type=int,default=8765);ap.add_argument('--data-dir');ap.add_argument('--timesheet-root');ap.add_argument('--export-dir');ap.add_argument('--isolated',action='store_true');ap.add_argument('--open-browser',action='store_true');a=ap.parse_args()
 namespace=hashlib.sha256(str(ROOT.parent.resolve()).casefold().encode()).hexdigest()[:12];expected=pathlib.Path(a.data_dir or pathlib.Path(os.environ.get('LOCALAPPDATA',str(pathlib.Path.home())))/'EmployeePredictor'/'SiteHistory'/namespace).resolve()
 # Reopening the launcher should reuse this profile, not interrupt its active imports.
 for port in range(a.port,a.port+10):
  try:
   with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/status',timeout=.5) as response:existing=json.load(response)
   if pathlib.Path(existing.get('dataDirectory','')).resolve()==expected and existing.get('modelSha256'):
    url=f'http://127.0.0.1:{port}/';print('Inventory Planner already running: '+url,flush=True)
    if a.open_browser:webbrowser.open(url)
    return
  except Exception:pass
 store=Store(a.data_dir,a.timesheet_root,a.export_dir,a.isolated);app=App(store)
 for port in range(a.port,a.port+10):
  try:server=ThreadingHTTPServer(('127.0.0.1',port),Handler);break
  except OSError:
   if port==a.port+9:raise
 server.app=app;url=f'http://127.0.0.1:{server.server_port}/';print('Inventory Planner: '+url+'\nPersistent data: '+str(store.root),flush=True)
 if a.open_browser:webbrowser.open(url)
 try:server.serve_forever()
 finally:server.server_close();app.worker.shutdown(wait=True)
if __name__=='__main__':main()
