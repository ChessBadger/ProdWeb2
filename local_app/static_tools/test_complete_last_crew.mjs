import assert from 'node:assert/strict';
import {curateLastCrew} from '../last-crew.mjs';
import {lastCrewSelection,lastCrewForDate} from '../static_source/app.mjs';
const catalog=[{id:'0001',name:'Current Person',active:true},{id:'0002',name:'Former Person',active:false}];
const raw=catalog.map((p,i)=>({Employee:p.id,FirstName:p.name.split(' ')[0],LastName:'Person',AccountName:'Test',StoreName:'Store',DateOfInv:'2026-05-12',TypeOfInv:'Count',Total_Ext_Qty:100*(i+1),Expr1:2,PiecesPerHr:50*(i+1)}));
const rows=curateLastCrew(raw,'Test||Store','2026-05-12','Count',['0001','0002'],catalog,{'0001':'p1','0002':'p2'});
assert.equal(rows.length,2);assert.equal(rows.reduce((n,r)=>n+r.pieces,0),300);
assert.deepEqual(lastCrewSelection({persons:[{key:'p1'}]},{employees:['p1','p2'],supervisor:'p2',rx:['p2']}),{employees:['p1'],supervisor:'',rx:[]});
console.log('Complete historical display and current-only selection passed');

// Exercise the actual renderer with the rebuilt public data, without a login session.
import fs from 'node:fs';
import vm from 'node:vm';
const release=JSON.parse(fs.readFileSync(new URL('../../pages_export/release.json',import.meta.url)));
const snapshot=JSON.parse(fs.readFileSync(new URL('../../pages_export/'+release.files.planning.path,import.meta.url)));
const store=snapshot.stores.find(s=>s.name.includes('METRO #434'));
assert.equal(store.lastCrew.rows.length,14);
assert.ok(Math.abs(store.lastCrew.rows.reduce((n,r)=>n+r.pieces,0)-268611.86)<0.001);
const node=(tag,text='')=>({tag,text,children:[],dataset:{},append(...items){this.children.push(...items)},replaceChildren(){this.children=[]}});
const wrap=node('div');
const source=fs.readFileSync(new URL('../static_source/app.mjs',import.meta.url),'utf8');
const render=source.split('\n').find(line=>line.startsWith(' function renderLastCrew('));
vm.runInNewContext(render+';renderLastCrew(store)',{snapshot,store,lastCrewForDate,$:()=>wrap,el:node,names:ids=>ids.map(k=>snapshot.persons.find(p=>p.key===k)?.name||'Unknown').join(', ')});
const textOf=n=>n.text+' '+n.children.map(textOf).join(' '),htmlText=textOf(wrap);
assert.match(htmlText,/PAUL THUSIUS/);assert.match(htmlText,/DABRINA YOUNG/);assert.match(htmlText,/268,612/);
const selection=lastCrewSelection(snapshot,store.lastCrew);
assert.equal(selection.employees.length,8); // Seven current counters plus Kim.
assert.ok(selection.employees.every(k=>snapshot.persons.some(p=>p.key===k)));
console.log('Cottage Grove: 14 displayed rows, 268,612 pieces; only current crew selectable');

const latest=lastCrewForDate(store,'2026-10-14');
assert.equal(latest.date,'2026-10-13');assert.equal(latest.rows.length,16);
assert.ok(Math.abs(latest.rows.reduce((sum,r)=>sum+(r.pieces||0),0)-267187.8)<0.001);
assert.equal(lastCrewForDate(store,'2026-10-13').date,'2026-05-12');
assert.equal(lastCrewForDate(store,'2026-10-12').date,'2026-05-12');
assert.equal(lastCrewForDate({...store,lastCrewVisits:[]},'2026-10-14').employees.length,0);
assert.ok(lastCrewSelection(snapshot,latest).employees.every(k=>snapshot.persons.some(p=>p.key===k)));
console.log('Date-specific crew verified: Oct 14 uses Oct 13; same-day plan uses May 12');
