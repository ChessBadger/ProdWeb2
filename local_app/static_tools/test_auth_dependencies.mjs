import fs from 'node:fs';
if(process.argv[2])process.chdir(process.argv[2]);
const target=await(await fetch('http://127.0.0.1:9238/json/new?about:blank',{method:'PUT'})).json(),ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const callbacks=new Map(),logs=[],requests=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const cb=callbacks.get(m.id);callbacks.delete(m.id);m.error?cb.reject(Error(JSON.stringify(m.error))):cb.resolve(m.result)}else if(m.method==='Log.entryAdded')logs.push(m.params.entry);else if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url)};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;callbacks.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});async function ev(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error('Runtime check failed');return r.result.value}
await call('Log.enable');await call('Network.enable');await call('Runtime.enable');await call('Page.navigate',{url:'http://127.0.0.1:8778/pages_export/'});
for(let i=0;i<200;i++){if(await ev(`!!globalThis.firebase?.auth&&!!document.getElementById('authSignIn')`))break;await new Promise(r=>setTimeout(r,100))}
const sdk=await ev(`!!globalThis.firebase?.auth`);if(!sdk)throw Error('Real Firebase SDK did not initialize');
// Exercise only the public loader used by Firebase. No sign-in/account selection or grant.
const result=await ev(`new Promise(resolve=>{const s=document.createElement('script');s.src='https://apis.google.com/js/api.js';s.onload=()=>resolve({loaded:true,gapiPresent:!!globalThis.gapi});s.onerror=()=>resolve({loaded:false,gapiPresent:false});document.head.append(s);})`);
const blocked=logs.filter(e=>/violates.*Content Security Policy|Refused to load/i.test(e.text||'')&&/apis\.google\.com|gstatic\.com/.test(e.text||''));
if(!result.loaded||!result.gapiPresent||blocked.length)throw Error('Google loader still blocked or failed');
const report={passed:true,realFirebaseSDKLoaded:sdk,realGoogleApiLoaderLoaded:true,noGoogleLoaderCspViolation:true,noAccountChosen:true,noProviderChanges:true,liveCompletedGoogleSignInTested:false,dependencyHosts:[...new Set(requests.filter(u=>/^https:\/\//.test(u)).map(u=>new URL(u).hostname))]};fs.writeFileSync('real_firebase_dependency_result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));ws.close();
