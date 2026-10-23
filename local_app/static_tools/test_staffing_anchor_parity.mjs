import fs from 'node:fs';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {predictPlan} from '../static_source/planner.mjs';
import {predictPlan as candidate} from '../verification/staffing-regression-2026-10-15/restrained-full-crew-candidate.mjs';
const dir=new URL('../verification/large-crews-2026-10-14/',import.meta.url);let parity=0,removals=0;
for(const file of fs.readdirSync(dir).filter(f=>/^2026-.*\.private.json$/.test(f))){const {snapshot:s,catalog,visits}=JSON.parse(fs.readFileSync(new URL(file,dir))),keys=new Map(catalog.employees.map((p,i)=>[p.id,'p'+i]));
 const run=spawnSync(process.execPath,[new URL('./compile_staffing_anchors.mjs',import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1').replaceAll('%20',' ')],{input:JSON.stringify(s),encoding:'utf8',maxBuffer:100*1024*1024});assert.equal(run.status,0,run.stderr);const anchors=JSON.parse(run.stdout);for(const st of s.stores)st.staffingAnchors=anchors[st.key];
 for(const v of visits){const st=s.stores.find(x=>x.key==='s'+catalog.stores.findIndex(x=>x.storeId===v.storeId));for(const model of ['integrated','reference']){
 const p={storeKey:st.key,date:v.date,scheduleJobKey:v.id,employees:v.employees.map(id=>keys.get(id)),roles:{supervisor:keys.get(v.supervisor)||'',rx:v.rx.map(id=>keys.get(id)),training:[],earlyLate:[]},modes:{supervisor:'auto',rx:'auto',training:'auto',earlyLate:'auto'},countingMode:/kroger/i.test(st.name)?'modas':'default',notes:{},model};
 const expected=candidate(s,p),actual=predictPlan(s,p);assert.ok(Math.abs(expected.displayHours-actual.displayHours)<1e-8,st.name);parity++;
 for(const id of p.employees){const employees=p.employees.filter(k=>k!==id);if(!employees.length)continue;const reduced=predictPlan(s,{...p,employees,roles:{...p.roles,supervisor:p.roles.supervisor===id?'':p.roles.supervisor,rx:p.roles.rx.filter(k=>k!==id)}});assert.ok(reduced.displayHours>=actual.displayHours-1e-8);removals++;}
 }}
}
console.log({parity,removals});
