"""Exercise the local planner with a fresh headless browser profile.

Uses the converter's existing browser/DevTools helpers. Auth is bypassed only
inside this disposable local test page by calling initialize() directly.
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from convert_xl_to_json import (  # noqa: E402
    find_headless_browser, run_local_http_server, find_free_port,
    wait_for_devtools_target, connect_websocket, websocket_send_text,
    websocket_recv_text, terminate_process_tree,
)

EXPRESSION = r"""(async () => {
  for (let i=0; i<200 && typeof initialize !== 'function'; i++) await new Promise(r=>setTimeout(r,50));
  if (typeof initialize !== 'function') throw Error('Planner scripts did not load');
  if (!appInitialized) { initialize(); appInitialized=true; }
  hideAuthOverlay();
  for (let i=0; i<500 && !state.analyticsReady; i++) await new Promise(r=>setTimeout(r,100));
  if (!state.analyticsReady) throw Error('Analytics never became ready');
  if (JSON.stringify(state.jobs)!==JSON.stringify(buildJobs(state.rows))) throw Error('History differs from the production export');
  const store = state.storesList.find(s=>s.accountKey==='kroger' && s.jobCount>=2 && !isRxRoleRequiredForStore(s));
  const last=state.jobs.filter(j=>j.storeKey===store.storeKey).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const crew=last.employees;
  state.selectedStoreKey=store.storeKey; state.selectedEmployees=new Set(crew);
  state.selectedRolesByStore[store.storeKey]={supervisor:crew[0],rx:[],training:[],earlyLate:[]};
  state.roleModesByStore[store.storeKey]={supervisor:'none'};
  state.scheduleByStoreKey.set(store.storeKey,[{date:'2099-01-01',startTimeText:'8:00 AM',typeOfInv:store.primaryType}]);
  renderRoleSelectors();renderEmployeeList();updateResults();toggleDetailedView();
  const first=predict();
  if(!first || first.crewSize!==crew.length || !(first.onSiteDuration>0)) throw Error('Live preview or headcount failed');
  if(/NaN|undefined/.test(dom.predictionMeta.textContent+dom.predDuration.textContent+dom.detailBackgroundContent.textContent)) throw Error('Invalid displayed prediction');
  dom.useModas.checked=false;dom.useModas.dispatchEvent(new Event('change'));
  const regular=predict();
  if(regular.plan.inventoryMode!==false) throw Error('Counting mode toggle failed');
  const b=state.storesList.find(s=>s.accountKey!=='kroger' && s.jobCount>=2 && !isRxRoleRequiredForStore(s));
  const crewB=state.jobs.find(j=>j.storeKey===b.storeKey).employees;
  const rolesB={supervisor:crewB[0],rx:[],training:[],earlyLate:[]};
  const assignedBefore=predictForAssignedCrew(b.storeKey,crewB,rolesB,{});
  state.selectedStoreKey=b.storeKey;
  const assignedAfter=predictForAssignedCrew(b.storeKey,crewB,rolesB,{});
  if(assignedBefore.onSiteDuration!==assignedAfter.onSiteDuration) throw Error('Two-store prediction depends on selected store');
  state.selectedStoreKey=store.storeKey;updateResults();
  await new Promise(r=>setTimeout(r,1600));
  if(readSavedForecasts().length<1) throw Error('Automatic forecast save failed');
  const logged=readSavedForecasts().length;
  saveCurrentForecast();
  if(readSavedForecasts().length!==logged) throw Error('Identical forecast was duplicated');
  const snap=buildAnalyticsSnapshot(state.dataFingerprint);
  applyAnalyticsSnapshot(JSON.parse(JSON.stringify(snap)));updateResults();renderAccuracyReport();
  return {ready:true,snapshotVersion:snap.version,headcount:crew.length,displayedDuration:dom.predDuration.textContent,
    sourceJobs:state.jobs.length,productionExportOnly:true,
    testJobs:state.backtestMetrics.jobs,accuracyRows:dom.accuracyWorstBody.children.length,
    twoStoreModeIsolation:true,automaticForecasts:logged,detailsRendered:dom.detailBackgroundContent.textContent.includes('duration')};
})()"""


def main():
    browser = find_headless_browser()
    if not browser:
        raise RuntimeError("Install Edge or Chrome to run the browser smoke check.")
    server, port = run_local_http_server(ROOT)
    debug = find_free_port()
    site_dir = "docs" if "--built" in sys.argv else "public"
    url = f"http://127.0.0.1:{port}/{site_dir}/scheduleplanning.html?smoke=1"
    profile = tempfile.TemporaryDirectory(prefix="planner-smoke-", ignore_cleanup_errors=True)
    process = None
    try:
        process = subprocess.Popen([
            str(browser), "--headless=new", "--disable-gpu", "--no-first-run",
            "--no-default-browser-check", "--remote-debugging-address=127.0.0.1",
            f"--remote-debugging-port={debug}", f"--user-data-dir={profile.name}", url,
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for attempt in range(3):
            ws = wait_for_devtools_target(debug, url, 30)
            sock = connect_websocket(ws)
            sock.settimeout(65)
            try:
                websocket_send_text(sock, json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {
                    "expression": EXPRESSION, "awaitPromise": True, "returnByValue": True, "timeout": 60000,
                }}))
                while True:
                    result = json.loads(websocket_recv_text(sock))
                    if result.get("id") == 1:
                        break
            finally:
                sock.close()
            if "context was destroyed" in str(result.get("error", {})).lower() and attempt < 2:
                time.sleep(1)
                continue
            if result.get("error") or result.get("result", {}).get("exceptionDetails"):
                raise RuntimeError(json.dumps(result))
            print(json.dumps(result["result"]["result"].get("value"), indent=2))
            break
    finally:
        if process:
            terminate_process_tree(process)
        server.shutdown()
        server.server_close()
        profile.cleanup()


if __name__ == "__main__":
    main()
