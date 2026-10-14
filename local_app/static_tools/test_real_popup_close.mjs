import fs from 'node:fs';
if(process.argv[2])process.chdir(process.argv[2]);
const target=await(await fetch('http://127.0.0.1:9238/json/new?about:blank',{method:'PUT'})).json(),ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const callbacks=new Map(),logs=[],requests=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const cb=callbacks.get(m.id);callbacks.delete(m.id);m.error?cb.reject(Error(JSON.stringify(m.error))):cb.resolve(m.result)}else if(m.method==='Log.entryAdded')logs.push(m.params.entry);else if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url)};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;callbacks.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});async function ev(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error('Runtime check failed');return r.result.value}
await call('Log.enable');await call('Network.enable');await call('Runtime.enable');await call('Page.navigate',{url:'http://127.0.0.1:8778/pages_export/'});
for(let i=0;i<200;i++){if(await ev(`!!globalThis.firebase?.auth&&!!document.getElementById('authSignIn')`))break;await new Promise(r=>setTimeout(r,100))}
const sdk=await ev(`!!globalThis.firebase?.auth`);if(!sdk)throw Error('Real Firebase SDK did not initialize');
// Exercise the actual Firebase popup lifecycle without choosing an account.
await ev(`firebase.auth().signOut()`);await call('Page.reload');
for(let i=0;i<150;i++){if(await ev(`!!globalThis.firebase?.auth&&!!document.getElementById('authSignIn')`))break;await new Promise(r=>setTimeout(r,100))}
await ev(`document.getElementById('authSignIn').click()`);
let popup;for(let i=0;i<150;i++){const targets=(await call('Target.getTargets')).targetInfos;popup=targets.find(x=>x.type==='page'&&x.openerId===target.id);if(popup)break;await new Promise(r=>setTimeout(r,100))}if(!popup)throw Error('Actual Firebase popup did not open');
if(await ev(`!!document.getElementById('calculate')||!!document.querySelector('nav')`))throw Error('Planner open while popup pending');await call('Target.closeTarget',{targetId:popup.targetId});
let closed=false;for(let i=0;i<200;i++){closed=await ev(`document.getElementById('authMessage')?.textContent.includes('popup-closed-by-user')`);if(closed)break;await new Promise(r=>setTimeout(r,100))}if(!closed)throw Error('Popup-close error not observed');
await ev(`location.hash='compare'`);if(await ev(`!!document.getElementById('calculate')||!!document.querySelector('nav')||firebase.auth().currentUser!==null`))throw Error('Signed-out popup cancellation exposed planner');
await call('Page.reload');for(let i=0;i<150;i++){if(await ev(`!!document.getElementById('authSignIn')&&!!globalThis.firebase?.auth`))break;await new Promise(r=>setTimeout(r,100))}if(await ev(`!!document.getElementById('calculate')`))throw Error('Reload bypass');
const report={passed:true,realFirebaseSDK:true,actualPopupOpened:true,actualPopupClosed:true,closedErrorObserved:true,plannerLockedDuringAndAfter:true,reloadLocked:true,noAccountChosen:true,noProviderChanges:true};fs.writeFileSync('real_popup_close.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));ws.close();
