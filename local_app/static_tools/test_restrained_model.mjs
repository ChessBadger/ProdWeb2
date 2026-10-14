import assert from 'node:assert/strict';
import {createWorkloadContext,predictRestrained} from '../workload-model.mjs';
const rows=Array.from({length:5},(_,i)=>({id:'store|'+i,date:`2026-09-${String(i+1).padStart(2,'0')}`,storeId:'store',accountKey:'account',typeOfInv:'SCAN',inventoryMode:true,quantity:10000,crewHours:4,postCountHours:1.25,supervisorExtensionHours:.5,employees:['1','2','3'],supervisor:'1',rx:[],employeeDetails:[{id:'1',quantity:2000,hours:4.5},{id:'2',quantity:4000,hours:4},{id:'3',quantity:4000,hours:4}]}));
const cut='2026-10-12',ctx=createWorkloadContext(rows,cut),anchor=ctx.prepare('store','account','SCAN',true),plan={employees:['1','2','3'],roles:{supervisor:'1',rx:[]},modes:{supervisor:'p50'}},config={elasticity:.3,finishing:true};
assert.equal(anchor.finishingAllowanceHours,.75);assert.equal(anchor.finishingEvidenceCount,5);
const base=predictRestrained(ctx,anchor,plan,config),more=predictRestrained(ctx,anchor,{...plan,employees:['1','2','3','4']},config),none=predictRestrained(ctx,anchor,{...plan,modes:{supervisor:'none'}},config);
assert.ok(more.hours<base.hours);assert.ok(none.hours>base.hours);assert.equal(more.finishingAllowanceHours,.75);assert.equal(more.workload,base.workload);assert.equal(more.expectedPieces,base.expectedPieces);
const linear=predictRestrained(ctx,anchor,{...plan,employees:['1','2','3','4']},{elasticity:1,finishing:true});assert.ok(more.hours>linear.hours);assert.ok(more.hours>.75);
assert.equal(predictRestrained(ctx,anchor,{...plan,employees:[...plan.employees,'3']},config).hours,base.hours);
assert.equal(predictRestrained(ctx,anchor,{employees:['1'],roles:{supervisor:'1'},modes:{supervisor:'none'}},config),null);
const unknown=createWorkloadContext(rows.map(r=>({...r,postCountHours:null})),cut).prepare('store','account','SCAN',true);assert.equal(unknown.finishingAllowanceHours,0);assert.equal(unknown.finishingEvidenceCount,0);
const zero=createWorkloadContext(rows.map(r=>({...r,postCountHours:.25})),cut).prepare('store','account','SCAN',true);assert.equal(zero.finishingAllowanceHours,0);
const future=createWorkloadContext([...rows,{...rows[0],date:cut,quantity:1e9,crewHours:17,postCountHours:10}],cut);assert.deepEqual(future.prepare('store','account','SCAN',true),anchor);
const weak=predictRestrained(ctx,{...anchor,comparableFraction:0},plan,{...config,evidenceAware:true});assert.equal(weak.effectiveElasticity,.15);
assert.throws(()=>predictRestrained(ctx,anchor,plan,{elasticity:0}),/Elasticity/);
assert.throws(()=>predictRestrained(createWorkloadContext(rows,'2026-10-19'),anchor,plan,config),/Matching frozen/);
const long=predictRestrained(ctx,{...anchor,referenceHours:100},plan,config);assert.equal(long.outsidePlanningRange,true);assert.ok(long.hours>18); // never silently clip research errors
console.log('Restrained candidate passed: fixed anchor, monotonic staffing, separate finishing, departure extension removed, missing/zero evidence, conservative response, leakage, invalid domains.');
