from pathlib import Path
import sys,tempfile,threading,json,subprocess,urllib.request
W=Path(r'C:\Users\Laptop 122\Desktop\Store Prep\06 Employee Reports\Website');sys.path.insert(0,str(W/'local_app'));from server import Handler,App,ThreadingHTTPServer,OWNER_VERSION
root=Path(tempfile.mkdtemp(prefix='owner-launcher-reuse-')).resolve()
class IdentityStore:
 seed={'modelHash':'verified-test-model'}
 def catalog(self):raise AssertionError('Launcher called expensive catalog')
s=IdentityStore();s.root=root;http=ThreadingHTTPServer(('127.0.0.1',0),Handler);http.app=App(s);threading.Thread(target=http.serve_forever,daemon=True).start();args=[sys.executable,'-B',str(W/'local_app/server.py'),'--owner','--port',str(http.server_port),'--data-dir',str(root)];r=subprocess.run(args,capture_output=True,text=True,timeout=20);assert r.returncode==0 and 'already running' in r.stdout;assert not (root/'history.sqlite3').exists();http.shutdown();http.server_close();http.app.worker.shutdown(wait=True)
class Older(Handler):
 def do_GET(self):return self.send(200,{'dataDirectory':str(root),'modelSha256':'older','ownerWorkflowVersion':'older-version'})
http=ThreadingHTTPServer(('127.0.0.1',0),Older);http.app=App(s);threading.Thread(target=http.serve_forever,daemon=True).start();args[args.index('--port')+1]=str(http.server_port);r=subprocess.run(args,capture_output=True,text=True,timeout=20);assert r.returncode!=0 and 'older local app' in r.stderr;assert not (root/'history.sqlite3').exists();http.shutdown();http.server_close();http.app.worker.shutdown(wait=True)
report={'passed':True,'currentOwnerReusedWithoutCatalogOrWrites':True,'olderOwnerRejectedBeforeHistoryConstruction':True};Path('owner_launcher_tests.json').write_bytes(json.dumps(report,indent=2).encode());print(json.dumps(report))
