import fs from 'node:fs';
import assert from 'node:assert/strict';
import {predictPlan} from '../static_source/planner.mjs';
import {lastCrewForDate,lastCrewSelection,weeklyDataStatus} from '../static_source/app.mjs';
const release=JSON.parse(fs.readFileSync(new URL('../../pages_export/release.json',import.meta.url)));
const s=JSON.parse(fs.readFileSync(new URL('../../pages_export/'+release.files.planning.path,import.meta.url)));
assert.equal(s.cutoff,'2026-10-14');assert.equal(s.validThrough,'2026-10-20');
const st=s.stores.find(x=>x.name.includes('METRO #434'));
assert.equal(st.lastCrew.date,'2026-10-13');assert.equal(st.lastCrew.rows.length,16);
assert.equal(st.scenario.variants.default.historyCount,5);
console.log('Matched full-visit records:',st.context.fixed.historyCount);
const last=lastCrewForDate(st,s.cutoff),sel=lastCrewSelection(s,last);
assert.equal(last.date,'2026-10-13');assert.ok(Math.abs(last.rows.reduce((sum,r)=>sum+(r.pieces||0),0)-267187.8)<.001);
for(const store of s.stores){
 for(const job of store.scenario.scheduleJobs)assert.ok(job.date>=s.cutoff&&job.date<=s.validThrough);
 for(const visit of store.lastCrewVisits)assert.ok(visit.date<s.cutoff);
}
for(const model of ['integrated','reference']){
 const p={storeKey:st.key,date:s.cutoff,employees:sel.employees,roles:{supervisor:sel.supervisor,rx:sel.rx,training:[],earlyLate:[]},modes:{supervisor:'auto',rx:'auto',training:'auto',earlyLate:'auto'},model,countingMode:'modas',notes:{},hasScheduledJob:false};
 const r=predictPlan(s,p);assert.ok(Number.isFinite(r.displayHours)&&r.displayHours>0);
 console.log(model, r.displayHours);
}
console.log('Current-date build: Oct 13 included, same-day visits excluded, five production visits, both models run');
