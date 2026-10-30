import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {curateLastCrew} from '../last-crew.mjs';
const root=new URL('../../',import.meta.url),out=new URL('../verification/',import.meta.url),rel=JSON.parse(fs.readFileSync(new URL('pages_export/release.json',root))),snapshot=JSON.parse(gunzipSync(fs.readFileSync(new URL('pages_export/'+rel.files.planning.path,root)))),history=JSON.parse(fs.readFileSync(new URL('EmployeeProductionHistory.json',root))).EmployeeProductionHistory;
const normalize=n=>n.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''),names=new Map();
for(const r of history){const n=normalize([r.FirstName,r.LastName].filter(Boolean).join(' ')),ids=names.get(n)||new Set();ids.add(String(r.Employee).padStart(4,'0'));names.set(n,ids);}
const repaired=new Map(),unmapped=[];
for(const store of snapshot.stores){for(const visit of [store.lastCrew,...store.lastCrewVisits]){if(!visit.date||!visit.rows.some(r=>r.support==='ambiguous'))continue;
 const catalog=[],keys={},members=[];
 for(const key of visit.employees){const name=visit.names[key],ids=names.get(normalize(name));if(ids?.size!==1){unmapped.push({store:store.name,date:visit.date,name});continue;}const id=[...ids][0];catalog.push({id,name});keys[id]=key;members.push(id);}
 const rows=curateLastCrew(history,store.name.replace(' / ','||'),visit.date,null,members,catalog,keys),byKey=new Map(rows.map(r=>[r.key,r]));
 visit.rows=visit.rows.map(old=>{const next=byKey.get(old.key);if(old.support==='ambiguous'&&next?.support==='recorded'){const id=store.key+'|'+visit.date;repaired.set(id,(repaired.get(id)||new Set()).add(old.key));return next;}return old;});
}}
const target=snapshot.stores.find(s=>s.name.includes("#518")&&s.name.includes('GLENVIEW')).lastCrew;
if(target.rows.filter(r=>r.support==='recorded').length!==12)throw Error('Expected 12 restored rows at Glenview');
const summary={visits:repaired.size,rows:[...repaired.values()].reduce((n,s)=>n+s.size,0),unmapped,target:{date:target.date,rows:target.rows.length,pieces:target.rows.reduce((n,r)=>n+r.pieces,0),justin:target.rows.find(r=>target.names[r.key]==='JUSTIN LEE')}};
fs.writeFileSync(new URL('last-crew-repaired-public.json',out),JSON.stringify(snapshot));fs.writeFileSync(new URL('last-crew-repair-results.json',out),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
