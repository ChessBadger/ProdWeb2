import fs from 'node:fs';
import assert from 'node:assert/strict';
import {predictPlan,DurationModel,extractBulkEmployeeEntries} from '../static_source/planner.mjs';
import {lastCrewSelection} from '../static_source/app.mjs';
const s=JSON.parse(fs.readFileSync(new URL('../verification/deep-audit-2026-10-14/planning.json',import.meta.url))),st=s.stores.find(x=>x.name.includes('METRO #434')),ids=s.persons.slice(0,6).map(p=>p.key);
const kim=s.persons.find(p=>p.name==='KIM GROHALL');
assert.equal(st.lastCrew.supervisor,kim.key);assert.equal(st.lastCrew.supervisorStatus,'recorded');assert.equal(st.lastCrew.rows.length,9);assert.ok(!st.lastCrew.rows.some(r=>r.key===kim.key));
const selection=lastCrewSelection(s,st.lastCrew);assert.equal(selection.employees.length,10);assert.ok(selection.employees.includes(kim.key));assert.equal(selection.supervisor,kim.key);
for(const store of s.stores){const sel=lastCrewSelection(s,store.lastCrew);assert.equal(new Set(sel.employees).size,sel.employees.length);if(sel.supervisor)assert.ok(sel.employees.includes(sel.supervisor));}
const p={storeKey:st.key,date:s.cutoff,hasScheduledJob:false,employees:ids,roles:{supervisor:ids[0],rx:[ids[1]],training:[],earlyLate:[]},modes:{...DurationModel.DEFAULT_MODES},countingMode:'modas',model:'integrated'};
const a=predictPlan(s,p),b=predictPlan(s,{...p,employees:[...ids,ids[1]]});assert.equal(a.laborHours,b.laborHours);assert.equal(a.crewSize,b.crewSize);
assert.throws(()=>extractBulkEmployeeEntries('Employee\tNotes\n\tafter 7am'),/no employee name/);
const long=predictPlan(s,{...p,storeKey:'s429',employees:ids.slice(0,2),roles:{...p.roles,rx:[ids[1]]},modes:{...p.modes,supervisor:'none'},countingMode:'default'});assert.equal(long.supervisorOnsiteHours,null);assert.match(long.supervisorTimeUnavailableReason,/18-hour/);
const timed=structuredClone(s);timed.stores.find(x=>x.key===st.key).scenario.scheduleJobs=[{key:'test',date:s.cutoff,startTime:'06:00'}];
const notePlan={...p,hasScheduledJob:true,scheduleJobKey:'test',notes:{[ids[0]]:'until 10am'},goalMode:'manhours'};
const note=predictPlan(timed,notePlan);assert.equal(note.supervisorDeparture,'10:00');assert.ok(note.supervisorOnsiteHours>0);assert.equal(note.availabilityConverged,true);
const goal=predictPlan(timed,{...notePlan,targetValue:note.laborHours});assert.equal(goal.recommendation,'On Target');assert.ok(Math.abs(goal.delta)<1e-7);
console.log('Deep regressions passed: latest supervisor, separate production rows, all-store selection, duplicate crew, unnamed notes, supervisor range/departure, timed goal.');

