// Private chronological experiment. Split policy is saved before computing scores.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {createPlannerContext,initializeData} from '../../scripts/planner-context.mjs';
import {createWorkloadContext,predictWorkload,median} from '../workload-model.mjs';
const dir=new URL('../verification/model-improvements-2026-10-14/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,dir))),write=(n,x)=>fs.writeFileSync(new URL(n,dir),JSON.stringify(x,null,2));
const records=read('records.private.json'),state=read('state.private.json'),eligible=records.filter(r=>r.crewHours>0).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
const pc=createPlannerContext();initializeData(pc,JSON.stringify(state.exportHistory));
const monday=date=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const developmentStart=monday(eligible[Math.floor(eligible.length*.6)].date),testStart=monday(eligible[Math.floor(eligible.length*.8)].date);
const policy={version:1,developmentStart,testStart,cutoff:'Monday before each forecast; no target-week outcomes',selection:'Choose between original rates and comparable recency/shrinkage rates by development mean absolute error; report segment within-15 rates. Final period evaluated once after selection.',target:'First crew arrival to last non-supervisor departure',segments:'Original buildStoreSegments/buildStoreStats functions, rebuilt from prior records each week',limitations:['Actual historical crew and roles are used; archived planned staffing is unavailable.','Historical receipt availability cannot be reconstructed for all records.','The source history was explored previously; this is a reserved chronological test, not a newly collected prospective holdout.'],dataHash:crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex')};
const policyPath=new URL('evaluation-policy.json',dir);if(fs.existsSync(policyPath))assert.deepEqual(read('evaluation-policy.json'),policy);else write('evaluation-policy.json',policy);
const aliases=state.history.aliases,reverse={};for(const [alias,id] of Object.entries(aliases))(reverse[id]??=[]).push(alias);
const contexts=new Map();
function getContext(cut){
 if(contexts.has(cut))return contexts.get(cut);pc.cut=cut;
 const legacy=vm.runInContext(`(()=>{const rows=state.rows.filter(r=>r.date<cut),jobs=state.jobs.filter(j=>j.date<cut),ec=buildDurationEmployeeContext(rows);ec.asOfDate=cut;return {rates:durationRateResolver(ec),segments:buildStoreSegments(buildStoreStats(jobs)),canonical:new Map([...state.employees.keys()].map(id=>[String(id).padStart(4,'0'),id]))};})()`,pc);
 const segments={};for(const [alias,value] of legacy.segments){const id=aliases[alias];if(id)segments[id]=value.segmentKey;}
 const rateOverride=(id,account,mode)=>legacy.rates(legacy.canonical.get(id)||String(Number(id)),account,mode,false);
 const improved=createWorkloadContext(records,cut,{segments}),original=createWorkloadContext(records,cut,{segments,rateOverride});
 pc.data=state.history;pc.cut=cut;const physical=vm.runInContext('FullOnsiteModel.context(data,cut)',pc);
 const ctx={improved,original,physical,segments};contexts.set(cut,ctx);return ctx;
}
const rows=[];for(const [i,j] of eligible.entries()){
 if(j.date<developmentStart)continue;const cut=monday(j.date),ctx=getContext(cut),own=ctx.improved.history.filter(h=>h.storeId===j.storeId),prior=own.at(-1);if(!prior)continue;
 // Mode/type come from the preceding visit, never the outcome being predicted.
 const plan={storeId:j.storeId,date:j.date,historyCutoff:cut,accountKey:j.accountKey,employees:j.employees,roles:{supervisor:j.supervisor,rx:j.rx},modes:{supervisor:'p50',rx:'p50'}},type=prior.typeOfInv,mode=prior.inventoryMode;
 const a=ctx.improved.prepare(j.storeId,j.accountKey,type,mode),b=ctx.original.prepare(j.storeId,j.accountKey,type,mode);if(!a||!b)continue;
 const improved=predictWorkload(ctx.improved,a,plan),original=predictWorkload(ctx.original,b,plan);if(!improved||!original)continue;
 const clocks=own.filter(h=>h.crewHours>0).slice(-5),correction=median(clocks.map(h=>h.duration-h.crewHours));pc.plan=plan;pc.prepared=ctx.physical;
 const originalPhysical=vm.runInContext('FullOnsiteModel.predict(data,plan,{elasticity:.3},prepared)',pc);
 const predictions={comparableRates:improved.hours,originalRates:original.hours,originalPhysical:originalPhysical?Math.max(.25,originalPhysical.onSiteDuration-correction):null,storeMedian:median(clocks.map(h=>h.crewHours))};
 rows.push({id:j.id,date:j.date,cutoff:cut,account:j.accountKey,segment:ctx.segments[j.storeId]||j.accountKey+'||Unclassified',mode:j.inventoryMode===true?'Modas':j.inventoryMode===false?'Regular':'Unknown',quality:a.quality,actual:j.crewHours,predictions,workload:a.workload,latestReference:a.latestReference});
 assert.ok(a.latestReference<cut);assert.equal(a.workload,ctx.improved.prepare(j.storeId,j.accountKey,type,mode).workload);
 if(i%200===0)console.log('Evaluated '+i+' / '+eligible.length);
}
function metrics(rs,name){const pairs=rs.filter(r=>Number.isFinite(r.predictions[name])).map(r=>({error:(r.predictions[name]-r.actual)*60,pred:r.predictions[name]})),errors=pairs.map(r=>r.error),abs=errors.map(Math.abs);return {visits:errors.length,maeMinutes:abs.reduce((s,x)=>s+x,0)/Math.max(1,abs.length),biasMinutes:errors.reduce((s,x)=>s+x,0)/Math.max(1,errors.length),within15:abs.filter(x=>x<=15).length/Math.max(1,abs.length),within30:abs.filter(x=>x<=30).length/Math.max(1,abs.length),within60:abs.filter(x=>x<=60).length/Math.max(1,abs.length),underestimatedOver30:errors.filter(x=>x< -30).length,underestimatedOver60:errors.filter(x=>x< -60).length,outsidePlanningRange:pairs.filter(r=>r.pred<.25||r.pred>18).length};}
const dev=rows.filter(r=>r.date<testStart),test=rows.filter(r=>r.date>=testStart),names=['comparableRates','originalRates','originalPhysical','storeMedian'];
const development=Object.fromEntries(names.map(n=>[n,metrics(dev,n)]));const selected=['comparableRates','originalRates'].sort((a,b)=>development[a].maeMinutes-development[b].maeMinutes)[0];
// Selection uses development only. No iteration based on reserved-test scores.
write('selected-candidate.json',{selected,development,dataHash:policy.dataHash});
const testMetrics=Object.fromEntries(names.map(n=>[n,metrics(test,n)])),breakdown={};for(const field of ['segment','account','mode','quality'])breakdown[field]=Object.fromEntries([...new Set(test.map(r=>r[field]))].sort().map(key=>[key,Object.fromEntries(names.map(n=>[n,metrics(test.filter(r=>r[field]===key),n)]))]));
const report={policy,eligibleVisits:eligible.length,evaluatedVisits:rows.length,development,selected,reservedTest:testMetrics,breakdown};write('benchmark-results.json',report);write('replay.private.json',rows);console.log(JSON.stringify({selected,development,reservedTest:testMetrics,segments:Object.keys(breakdown.segment).length},null,2));
