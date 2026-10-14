import assert from 'node:assert/strict';
import {rxLayerEstimator} from '../rx-production.mjs';
import {DurationModel,predictPlan} from '../static_source/planner.mjs';
import fs from 'node:fs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const row=(i,person='0001',store='test||Other',speed=1500)=>({key:store+'|2025-01-'+String(i).padStart(2,'0'),date:'2025-01-'+String(i).padStart(2,'0'),store,account:'test',mode:true,id:person,hours:4,quantity:speed*4,speed});
const prior=Array.from({length:10},(_,i)=>row(i+1));
const local=Array.from({length:3},(_,i)=>({...row(i+1,'0001','test||Target'),key:'test||Target|2025-02-0'+(i+1),date:'2025-02-0'+(i+1)}));
const h={people:[...prior,...local]},segments={'test||Other':'test||S3','test||Target':'test||S3'};
const estimate=rxLayerEstimator(h,segments),e=estimate('9999','test||Target','test',true,3000,'2025-03-01');
assert.equal(e.supported,true);assert.equal(e.count,0);assert.equal(e.storeCount,3);near(e.baseSpeed,1500);near(e.storeWeight,1);near(e.factor,.5); // no double 50% penalty
const noStore=estimate('9999','test||Unseen','test',true,3000,'2025-03-01');assert.equal(noStore.supported,true);assert.equal(noStore.storeCount,0);near(noStore.factor,.5);
const harder=rxLayerEstimator({people:[...prior,...local.map(r=>({...r,quantity:r.quantity/2,speed:r.speed/2}))]},segments)('9999','test||Target','test',true,3000,'2025-03-01');near(harder.storeWeight,.75);near(harder.factor,.375);
assert.equal(estimate('9999','test||Target','test',false,3000,'2025-03-01').supported,false);
assert.equal(estimate('9999','test||Target','other',true,3000,'2025-03-01').supported,false);
assert.deepEqual(rxLayerEstimator({people:[...h.people,{...row(1),date:'2099-01-01',speed:1e9,quantity:1e12}]},segments)('9999','test||Target','test',true,3000,'2025-03-01'),e);
near(DurationModel.roleFactor('p1',{roles:{training:['p1']},modes:{training:'auto'}}),.7);
near(DurationModel.roleFactor('p1',{roles:{rx:['p1']},modes:{rx:'auto'},rxContributions:{p1:{factor:.35}},rxContribution:{factor:.8}}),.35);
if(process.argv[2]){
 const s=JSON.parse(fs.readFileSync(process.argv[2])),st=s.stores.find(x=>x.name.includes('METRO #434')),ids=st.lastCrew.employees;
 const p={storeKey:st.key,date:s.cutoff,employees:ids,roles:{supervisor:ids[0],rx:ids.slice(1,3),training:[ids[3]],earlyLate:[]},modes:{supervisor:'auto',rx:'auto',training:'auto',earlyLate:'auto'},countingMode:'modas',notes:{},shrink:{percent:0,mode:'none',employeeIds:[]}};
 for(const v of Object.values(st.scenario.variants))v.rxEstimates={standard:{[ids[1]]:{factor:.35,supported:true},[ids[2]]:{factor:.65,supported:true}}};
 for(const model of ['integrated','reference']){const r=predictPlan(s,{...p,model});near(r.crew.find(x=>x.id===ids[1]).factor,.35);near(r.crew.find(x=>x.id===ids[2]).factor,.65);near(r.crew.find(x=>x.id===ids[3]).factor,.7);const manual=predictPlan(s,{...p,model,modes:{...p.modes,rx:'p70'}});near(manual.crew.find(x=>x.id===ids[1]).factor,.7);near(manual.crew.find(x=>x.id===ids[2]).factor,.7);near(manual.capacityScenario.workload,r.capacityScenario.workload);}
}
console.log('Layered Rx checks passed: unseen employees/stores, personal factors, no double penalty, store difficulty, cutoff isolation, training Auto, manual overrides and both model paths.');
