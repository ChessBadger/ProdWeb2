import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const W='C:/Users/Laptop 122/Desktop/Store Prep/06 Employee Reports/Website';
const label=process.argv[2]||'before';
const r=JSON.parse(fs.readFileSync(W+'/pages_export/release.json'));
const source=fs.readFileSync(W+'/local_app/static_tools/test_comparison_blur_fix.mjs','utf8');
const mock=source.match(/const mock=`([\s\S]*?)`;/)[1];
const t=await(await fetch('http://127.0.0.1:9238/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
const ev=async expression=>(await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value;
await call('Page.enable');await call('Page.addScriptToEvaluateOnNewDocument',{source:mock});await call('Storage.clearDataForOrigin',{origin:'http://127.0.0.1:8792',storageTypes:'local_storage'});await call('Page.navigate',{url:'http://127.0.0.1:8792/pages_export/'});
for(let i=0;i<200;i++){if(await ev(`document.documentElement.dataset.release===${JSON.stringify(r.version)}`))break;await new Promise(r=>setTimeout(r,100))}

const snapshot=JSON.parse(fs.readFileSync(W+'/pages_export/'+r.files.planning.path));
for(const modulePath of [W+'/local_app/static_source/planner.mjs',W+'/pages_export/'+r.files.planner.path]){
 const engine=await import(pathToFileURL(modulePath));
 for(const [minutes,expected] of [[416,'6h 56m (6.93 hrs)'],[25,'0h 25m (0.42 hrs)'],[60,'1h 00m (1.00 hrs)'],[59.49,'0h 59m (0.98 hrs)'],[59.5,'1h 00m (1.00 hrs)'],[416.49,'6h 56m (6.93 hrs)'],[416.5,'6h 57m (6.95 hrs)']])assert.equal(engine.formatOnsiteDuration(minutes/60),expected);
 const pasted=engine.parseCrewText('Bri\t@ Store, Equip\nReina\tDo not apply\nGael\tRX\nKim\tAfter Aurora',snapshot.persons,'06:00',{partial:true});assert.equal(pasted.length,3);assert.equal(pasted.warnings.length,1);assert.match(pasted.warnings[0],/Unknown employee name: Reina/);assert.equal(pasted[0].note,'@ Store, Equip');assert.equal(pasted[1].rx,true);assert.equal(pasted[2].note,'After Aurora');
 const ambiguous=engine.parseCrewText('Jane\tRX\nJohn Doe\tLead',[{key:'a',name:'Jane Smith'},{key:'b',name:'Jane Jones'},{key:'c',name:'John Doe'}],'06:00',{partial:true});assert.equal(ambiguous.length,1);assert.match(ambiguous.warnings[0],/Ambiguous/);
}
assert.equal(await ev("!!document.getElementById('addNames')||!!document.getElementById('copyCrew')"),false);
assert.equal(await ev("document.querySelectorAll('input[type=file]').length"),0);
const sample='| Bri | @ Store, Equip |\n| --- | --- |\n| Reina | Do not apply |\n| Gael | RX |\n| Kim | After Aurora |';
async function paste(id){await ev(`{const e=new Event('paste',{cancelable:true});Object.defineProperty(e,'clipboardData',{value:{getData:()=>${JSON.stringify(sample)}}});document.getElementById(${JSON.stringify(id)}).dispatchEvent(e)}`)}
await ev(`document.getElementById('store').value=${JSON.stringify(snapshot.stores.find(s=>s.context&&!s.needsRx).key)};document.getElementById('store').dispatchEvent(new Event('change'))`);
await paste('employeeFilter');assert.equal(await ev("document.querySelectorAll('#crew input:checked').length"),3);assert.match(await ev("document.getElementById('notice').textContent"),/Added 3 crew members.*Unknown employee name: Reina/);
const expected=snapshot.persons.filter(p=>/BRIANNA HENTHORN|GAEL |KIM /i.test(p.name));
const notes=await ev("Object.fromEntries([...document.querySelectorAll('#crew textarea[data-note]')].map(t=>[t.dataset.note,t.value]))");assert.ok(Object.values(notes).includes('@ Store, Equip'));assert.ok(Object.values(notes).includes('After Aurora'));assert.ok(!Object.values(notes).includes('Do not apply'));assert.equal(await ev("document.getElementById('rx').selectedOptions.length"),1);
await ev("location.hash='compare'");await paste('compareEmployeeFilter');assert.equal(await ev("document.querySelectorAll('#compareEmployees input:checked').length"),3);assert.match(await ev("document.getElementById('allocationStatus').textContent"),/Added 3 available employees.*Unknown employee name: Reina/);await ev("location.hash='plan'");
await call('Page.reload');for(let i=0;i<200;i++){if(await ev("!!document.getElementById('crew')"))break;await new Promise(r=>setTimeout(r,100))}assert.equal(await ev("document.querySelectorAll('#crew input:checked').length"),3);assert.equal(await ev("document.getElementById('rx').selectedOptions.length"),1);
for(let i=0;i<200;i++){if(await ev("!!document.querySelector('#prediction .big')"))break;await new Promise(r=>setTimeout(r,100))}assert.match(await ev("document.querySelector('#prediction .big').textContent"),/h \d\dm\(\d+\.\d{2} hrs\)/);
console.log('Exact Reina partial paste, per-row notes/RX, comparison paste, removed controls, duration boundaries, built/source, and reload passed');


for(const path of [W+'/local_app/static_source/app.mjs',W+'/pages_export/'+r.files.app.path]){
 const {rankedSearch}=await import(pathToFileURL(path));
 const people=[{key:'a',name:'Jane Doe'},{key:'b',name:'John Smith'},{key:'c',name:'Jane Smith'}];
 assert.deepEqual(rankedSearch(people,'Doe Jane').map(p=>p.key),['a']);assert.deepEqual(rankedSearch(people,'j d').map(p=>p.key),['a']);assert.equal(rankedSearch(people,'smith john')[0].key,'b');assert.equal(rankedSearch(people,' Jane   Doe ')[0].key,'a');assert.equal(rankedSearch(people,'nobody').length,0);
 const stores=[{key:'x',name:'Account / 114 Main'},{key:'y',name:'Account / 14 Main'},{key:'z',name:'Other / West Center'}];assert.equal(rankedSearch(stores,'14')[0].key,'y');assert.deepEqual(rankedSearch(stores,'center west').map(p=>p.key),['z']);
}
async function type(id,value){await ev(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(value)};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('input',{bubbles:true}))`)}
await ev("document.getElementById('storeSearch').focus()");await type('storeSearch','middleton');assert.ok(await ev("document.querySelectorAll('#storeChoices [role=option]').length>0"));assert.equal(await ev("document.getElementById('storeSearch').getAttribute('aria-expanded')"),'true');
await ev("document.getElementById('storeSearch').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))");assert.ok(await ev("document.getElementById('storeSearch').getAttribute('aria-activedescendant')"));await ev("document.getElementById('storeSearch').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))");assert.match(await ev("document.getElementById('storeSearch').value"),/MIDDLETON/i);assert.ok(await ev("document.getElementById('store').value"));assert.equal(await ev("document.getElementById('storeSearch').getAttribute('aria-expanded')"),'false');
await type('storeSearch','nothing-matches-this-store');assert.equal(await ev("document.querySelectorAll('#storeChoices [role=option]').length"),0);assert.match(await ev("document.getElementById('storeChoices').textContent"),/No matching stores/);await ev("document.getElementById('storeSearch').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");assert.equal(await ev("document.getElementById('storeChoices').hidden"),true);
await ev(`document.getElementById('storeSearch').value=${JSON.stringify(snapshot.stores.find(s=>/MIDDLETON/i.test(s.name)).name)};document.getElementById('storeSearch').dispatchEvent(new Event('change'))`);
await type('employeeFilter','henthorn bri');assert.equal(await ev("document.querySelectorAll('#crew input[type=checkbox]').length"),1);await ev("document.getElementById('employeeFilter').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))");assert.equal(await ev("document.activeElement.type"),'checkbox');await ev("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");assert.equal(await ev('document.activeElement.id'),'employeeFilter');await ev("document.getElementById('employeeFilter').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))");assert.ok(await ev("document.querySelectorAll('#crew input:checked').length>0"));
assert.equal(await ev("document.querySelector('header p')"),null);assert.equal(await ev("!!document.querySelector('.form-intro')"),false);
await type('employeeFilter','');await ev("document.getElementById('storeSearch').focus()");await type('storeSearch','middleton');
await call('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await ev("document.getElementById('storeSearch').scrollIntoView({block:'center'})");fs.writeFileSync('search-suggestions-laptop.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await ev("document.getElementById('storeSearch').scrollIntoView({block:'start'})");assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'));fs.writeFileSync('search-suggestions-mobile.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
await ev("document.getElementById('storeSearch').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));document.getElementById('storeSearch').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))");
console.log('Ranked store suggestions, number/name tokens, name order/initials, keyboard selection/Escape, no-match state, annotation cleanup, source and built passed');

assert.equal(await ev("!!document.getElementById('recommendation')||!!document.getElementById('delta')||!!document.querySelector('.recommendation')"),false);assert.ok(await ev("document.getElementById('planForm').contains(document.getElementById('suggestStaffing'))"));
const metrics=[];
for(const [name,width,height] of [['laptop',1366,900],['mobile',390,844],['narrow',320,844]]){
 await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
 assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'),'Viewport overflow');await ev('scrollTo(0,0)');await new Promise(r=>setTimeout(r,150));
 fs.writeFileSync(`${label}-${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 metrics.push(await ev(`({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].map(b=>b.textContent),release:document.documentElement.dataset.release})`));
}
await call('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
await ev(`document.getElementById('store').value=${JSON.stringify(JSON.parse(fs.readFileSync(W+'/pages_export/'+r.files.planning.path)).stores.find(s=>s.context&&!s.needsRx).key)};document.getElementById('store').dispatchEvent(new Event('change'));document.getElementById('lastCrew').click()`);
await new Promise(r=>setTimeout(r,500));await ev('scrollTo(0,0)');fs.writeFileSync(`${label}-results.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
fs.writeFileSync(`${label}-layout.json`,JSON.stringify(metrics,null,2));for(const width of [390,320]){await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await ev("document.querySelector('.result').scrollIntoView({block:'start'})");assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'));fs.writeFileSync(`${label}-result-${width}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));await ev("document.querySelector('.edit-plan').click()");assert.equal(await ev('document.activeElement.id'),'storeSearch');}
await call('Page.close');ws.close();console.log(label+' screenshots captured');
