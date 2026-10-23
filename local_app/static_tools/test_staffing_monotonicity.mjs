import fs from 'node:fs';import assert from 'node:assert/strict';
import {predictPlan} from '../static_source/planner.mjs';
const release=JSON.parse(fs.readFileSync(new URL('../../pages_export/release.json',import.meta.url))),snapshot=JSON.parse(fs.readFileSync(new URL('../../pages_export/'+release.files.planning.path,import.meta.url)));
const old=await import(new URL('../../pages_export/'+release.files.planner.path,import.meta.url));
let comparisons=0,oldFailures=0,unsupported=0;const examples=[];
for(const store of snapshot.stores)for(const model of ['integrated','reference']){
 const rates=snapshot.scenarioRates[store.scenario.variants.default.rates];
 const ids=snapshot.persons.map(p=>p.key).sort((a,b)=>(rates[b]?.[0]||0)-(rates[a]?.[0]||0)).slice(0,12);
 const plan={storeKey:store.key,date:snapshot.cutoff,hasScheduledJob:false,employees:ids,roles:{supervisor:ids[0],rx:[],training:[],earlyLate:[]},modes:{supervisor:'auto',rx:'auto',training:'auto',earlyLate:'auto'},notes:{},model,countingMode:'default',shrink:{percent:0,mode:'none',employeeIds:[]}};
 const smaller={...plan,employees:ids.slice(0,-2)};
 try{
 const full=predictPlan(snapshot,plan),reduced=predictPlan(snapshot,smaller);
 assert.ok(reduced.displayHours+1e-7>=full.displayHours,store.name+' '+model);
 assert.ok(Math.abs(full.capacityScenario.workload-reduced.capacityScenario.workload)<1e-6);
 const zero={...plan,employees:ids.slice(0,-1),roles:{...plan.roles,training:[ids.at(-2)]},modes:{...plan.modes,training:'none'}};
 const zeroRemoved={...zero,employees:ids.slice(0,-2),roles:{...zero.roles,training:[]}};
 assert.ok(Math.abs(predictPlan(snapshot,zero).displayHours-predictPlan(snapshot,zeroRemoved).displayHours)<1e-7);
 comparisons++;
 try{const a=old.predictPlan(snapshot,plan),b=old.predictPlan(snapshot,smaller);if(b.displayHours<a.displayHours-1e-7){oldFailures++;if(examples.length<3)examples.push({store:store.name,model,before:[a.displayHours,b.displayHours],after:[full.displayHours,reduced.displayHours]});}}catch{}
 }catch(e){if(/18 hours|No counting|No supported/.test(e.message)){unsupported++;continue}throw e;}
}
assert.ok(comparisons>1000);
console.log(JSON.stringify({comparisons,oldFailures,unsupported,examples},null,2));
