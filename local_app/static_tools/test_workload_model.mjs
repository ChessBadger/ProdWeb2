import assert from 'node:assert/strict';
import {createWorkloadContext,predictWorkload} from '../workload-model.mjs';
const jobs=Array.from({length:8},(_,i)=>({id:'store|'+i,date:`2026-09-${String(i+1).padStart(2,'0')}`,storeId:'store',accountKey:'account',typeOfInv:'SCAN',inventoryMode:true,quantity:12000,crewHours:4,employees:['1','2','3'],supervisor:'1',rx:[],employeeDetails:[{id:'1',quantity:2000,hours:4},{id:'2',quantity:5000,hours:4},{id:'3',quantity:5000,hours:4}]}));
const cut='2026-10-12',ctx=createWorkloadContext(jobs,cut),anchor=ctx.prepare('store','account','SCAN',true),plan={employees:['1','2','3'],roles:{supervisor:'1',rx:[]},modes:{supervisor:'p50'}};
const original=predictWorkload(ctx,anchor,plan),added=predictWorkload(ctx,anchor,{...plan,employees:[...plan.employees,'4']});
assert.ok(added.hours<original.hours);assert.equal(added.workload,original.workload);assert.equal(predictWorkload(ctx,anchor,{...plan,employees:[...plan.employees,'3']}).hours,original.hours);
const future={...jobs[0],id:'future',date:cut,quantity:1e9,crewHours:17,employeeDetails:jobs[0].employeeDetails.map(e=>({...e,quantity:1e9}))};
const contaminated=createWorkloadContext([...jobs,future],cut);assert.deepEqual(contaminated.prepare('store','account','SCAN',true),anchor);assert.deepEqual(contaminated.rate('2','account','SCAN',true),ctx.rate('2','account','SCAN',true));
assert.equal(ctx.supervisor('1','account','SCAN',true).supported,false); // no comparable non-supervisor evidence
const sparse=createWorkloadContext([{...jobs[0],employeeDetails:[{id:'4',quantity:1e6,hours:1},...jobs[0].employeeDetails]}],cut).rate('4','account','SCAN',true);assert.ok(sparse.personalWeight<.2);assert.ok(sparse.speed<1e6);
assert.equal(predictWorkload(ctx,anchor,{employees:['1'],roles:{supervisor:'1'},modes:{supervisor:'none'}}),null);
assert.throws(()=>predictWorkload(createWorkloadContext(jobs,'2026-10-19'),anchor,plan),/Matching frozen/);
console.log('Workload invariants passed: crew-independent anchor, monotonic positive capacity, duplicate IDs, same-week leakage, sparse-rate shrinkage, supervisor evidence, zero capacity, cutoff mismatch.');
