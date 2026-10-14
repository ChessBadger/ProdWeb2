import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rxHistory,rxEstimate} from '../rx-production.mjs';
import {DurationModel,predictPlan,workerAvailability} from '../static_source/planner.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const raw=(date,isRx=false,store='A',quantity=4000)=>({Employee:1,SupervisorNumber:2,AccountName:'test',StoreName:store,DateOfInv:date,TimeIn:'06:00:00',TimeOut:'10:00:00',Total_Ext_Qty:quantity,Rx:isRx,AVG_DELTA:0,GAP5_COUNT:0,GAP10_COUNT:0,GAP15_COUNT:0});
const counters=['2025-01-01','2025-01-08','2025-01-15'].map(d=>raw(d));
const visits=['2025-02-01','2025-03-01','2025-04-01'].map(d=>raw(d,true,'A',1600));
const h=rxHistory([...counters,...visits],'2025-05-01');
assert.equal(h.observations.length,3);near(h.observations[0].ratio,.4);
const est=rxEstimate(h,'test||A','test',false);near(est.factor,.45);assert.equal(est.count,3);
assert.equal(rxEstimate(h,'test||B','test',false).supported,false);
assert.equal(rxEstimate(h,'test||A','test',true).supported,false);
assert.equal(rxHistory(visits,'2025-05-01').observations.length,0);
const poisoned=[...counters,...visits,raw('2025-05-01',true,'A',999999),raw('2099-01-01',false,'A',999999)];
assert.deepEqual(rxHistory(poisoned,'2025-05-01'),h);
assert.equal(rxHistory([...counters,...visits.map(r=>({...r,Employee:2}))],'2025-05-01').observations.length,0);
const simultaneous=[...counters,...visits,raw('2025-02-01',true,'A',1600)];assert.equal(rxHistory(simultaneous,'2025-05-01').observations.length,2);
// TypeOfInv is irrelevant; telemetry mode and older non-Rx output determine comparability.
assert.deepEqual(rxHistory([...counters,...visits].map(r=>({...r,TypeOfInv:'changed account setting'})),'2025-05-01'),h);
const a=workerAvailability('until 12','06:00',8);near(a.factor,.75);
const base={employees:['p1'],roles:{rx:[],earlyLate:['p1']},modes:{earlyLate:'auto'},availabilityFactors:{p1:a.factor}};
near(DurationModel.roleFactor('p1',base),.75);
near(DurationModel.roleFactor('p1',{...base,modes:{earlyLate:'p50'}}),.375);
near(DurationModel.roleFactor('p1',{...base,modes:{earlyLate:'none'}}),0);
near(DurationModel.roleFactor('p1',{...base,availabilityFactors:{}}),.5);
near(DurationModel.roleFactor('p1',{...base,roles:{rx:['p1'],earlyLate:['p1']},modes:{rx:'auto',earlyLate:'auto'},rxContribution:est}),.45*.75);
near(workerAvailability('after 10','06:00',8).factor,.5);
near(workerAvailability('until 2am','22:00',8).factor,.5);
near(workerAvailability('until 4am','06:00',8).factor,0);
if(process.argv[2]){
 const s=JSON.parse(fs.readFileSync(process.argv[2])),store=s.stores.find(st=>st.name.includes('METRO #434'));
 const employees=store.lastCrew.employees,rx=employees[1],timed=employees[2];
 store.scenario.scheduleJobs=[{key:'role-test',date:s.cutoff,startTime:'06:00'}];
 for(const pack of Object.values(store.scenario.variants))if(pack)pack.rxEstimate=est;
 const p={storeKey:store.key,date:s.cutoff,scheduleJobKey:'role-test',employees,roles:{supervisor:employees[0],rx:[rx],training:[],earlyLate:[timed]},modes:{supervisor:'p50',rx:'auto',training:'p70',earlyLate:'auto'},countingMode:'modas',notes:{[timed]:'until 10'},shrink:{percent:0,mode:'none',employeeIds:[]}};
 for(const model of ['integrated','reference']){
  const r=predictPlan(s,{...p,model});assert.equal(r.availabilityConverged,true);near(r.crew.find(e=>e.id===rx).factor,.45);assert.ok(r.crew.find(e=>e.id===timed).availability);assert.equal(r.crew.find(e=>e.id===rx).rxContribution.count,3);
  const manual=predictPlan(s,{...p,model,modes:{...p.modes,rx:'p70'}});near(manual.crew.find(e=>e.id===rx).factor,.7);assert.ok(manual.displayHours<r.displayHours);near(manual.capacityScenario.workload,r.capacityScenario.workload);
 }
}
console.log('Passed: prior-only Rx comparison, mode/store isolation, sparse blending, duplicate rejection, clock math, manual overrides, combined roles, and both model paths.');
