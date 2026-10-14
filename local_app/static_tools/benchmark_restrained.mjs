// Development ablations first; October attendance is scored only after selection.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {createPlannerContext,initializeData} from '../../scripts/planner-context.mjs';
import {createWorkloadContext,predictWorkload,predictRestrained,median} from '../workload-model.mjs';
const priorDir=new URL('../verification/model-improvements-2026-10-14/',import.meta.url),dir=new URL('../verification/restrained-model-2026-10-14/',import.meta.url);fs.mkdirSync(dir,{recursive:true});
const read=(n,d=priorDir)=>JSON.parse(fs.readFileSync(new URL(n,d))),write=(n,x)=>fs.writeFileSync(new URL(n,dir),JSON.stringify(x,null,2)),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const state=read('state.private.json'),targets=new Map(JSON.parse(fs.readFileSync(new URL('../seed/crew_targets.json',import.meta.url))).map(r=>[r.id,r]));
const records=read('records.private.json').map(r=>({...r,supervisorExtensionHours:targets.get(r.id)?.extension??null})),oldPolicy=read('evaluation-policy.json');
const monday=date=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const configs={anchoredLinear:{elasticity:1,finishing:false},damped:{elasticity:.3,finishing:false},dampedFinishing:{elasticity:.3,finishing:true},dampedFinishingEvidence:{elasticity:.3,finishing:true,evidenceAware:true}};
const policy={version:2,developmentStart:oldPolicy.developmentStart,developmentEndExclusive:oldPolicy.testStart,excludedFromTuning:'2025-12-01 through 2026-06-26 (previously scored test period)',target:'First crew arrival to last non-supervisor departure',configs,selection:'Among damped candidates, require development MAE and >60-minute underestimates no worse than original physical reference; maximize within-15 fraction, then minimize MAE. No per-segment tuning on sparse samples.',holdout:'Imported October attendance dated before 2026-10-14; not used for model selection or historical workload/rates.',dataHash:hash(records),holdoutIds:(state.importedEvents||[]).filter(e=>e.date<'2026-10-14').map(e=>e.store+'|'+e.date).sort(),sourceHash:crypto.createHash('sha256').update(fs.readFileSync(new URL('../workload-model.mjs',import.meta.url))).digest('hex'),limitations:['Retrospective actual crew/roles; no archived previsit staffing.','Event-date rather than full receipt-time reconstruction.','October attendance has been inspected for data quality but has not previously been scored in these experiments.','Finishing is inferred from full post-count time minus supervisor departure extension; it is not a separate measured setup interval.']};
const policyPath=new URL('policy.json',dir);if(fs.existsSync(policyPath))assert.deepEqual(read('policy.json',dir),policy);else write('policy.json',policy);
const pc=createPlannerContext();initializeData(pc,JSON.stringify(state.exportHistory));pc.data=state.history;const contexts=new Map();
function context(cut){
 if(contexts.has(cut))return contexts.get(cut);pc.cut=cut;
 const legacy=vm.runInContext(`(()=>{const rows=state.rows.filter(r=>r.date<cut),jobs=state.jobs.filter(j=>j.date<cut),ec=buildDurationEmployeeContext(rows);ec.asOfDate=cut;return {rates:durationRateResolver(ec),segments:buildStoreSegments(buildStoreStats(jobs)),canonical:new Map([...state.employees.keys()].map(id=>[String(id).padStart(4,'0'),id]))};})()`,pc);
 const segments={};for(const [alias,value] of legacy.segments){const id=state.history.aliases[alias];if(id)segments[id]=value.segmentKey;}
 const rateOverride=(id,account,mode)=>legacy.rates(legacy.canonical.get(id)||String(Number(id)),account,mode,false);
 const workload=createWorkloadContext(records,cut,{segments,rateOverride}),physical=vm.runInContext('FullOnsiteModel.context(data,cut)',pc),ctx={workload,physical,segments};contexts.set(cut,ctx);return ctx;
}
function predictVisit(j,names){
 const cutoff=monday(j.date),ctx=context(cutoff),own=ctx.workload.history.filter(h=>h.storeId===j.storeId),prior=own.at(-1);if(!prior)return {reason:'No prior validated store visit'};
 const type=prior.typeOfInv,mode=prior.inventoryMode,anchor=ctx.workload.prepare(j.storeId,j.accountKey,type,mode);if(!anchor)return {reason:'No earlier crew-clock workload anchor'};
 const plan={storeId:j.storeId,date:j.date,historyCutoff:cutoff,accountKey:j.accountKey,employees:j.employees,roles:{supervisor:j.supervisor,rx:j.rx},modes:{supervisor:'p50',rx:'p50'}},predictions={};
 for(const name of names){if(name==='linearV1')predictions[name]=predictWorkload(ctx.workload,anchor,plan)?.hours;else predictions[name]=predictRestrained(ctx.workload,anchor,plan,configs[name])?.hours;}
 pc.plan=plan;pc.prepared=ctx.physical;const physical=vm.runInContext('FullOnsiteModel.predict(data,plan,{elasticity:.3},prepared)',pc),correction=median(own.filter(h=>h.crewHours>0).slice(-5).map(h=>h.duration-h.crewHours));
 predictions.originalPhysical=physical?Math.max(.25,physical.onSiteDuration-correction):null;
 assert.ok(anchor.latestReference<cutoff);
 return {id:j.id,date:j.date,cutoff,account:j.accountKey,segment:ctx.segments[j.storeId]||j.accountKey+'||Unclassified',actual:j.crewHours,predictions,finishingAllowanceHours:anchor.finishingAllowanceHours,finishingEvidenceCount:anchor.finishingEvidenceCount,quality:anchor.quality};
}
function metrics(rows,name){const rs=rows.filter(r=>Number.isFinite(r.predictions?.[name])),errors=rs.map(r=>(r.predictions[name]-r.actual)*60),abs=errors.map(Math.abs),n=rs.length;return {visits:n,maeMinutes:n?abs.reduce((s,x)=>s+x,0)/n:null,within15:n?abs.filter(x=>x<=15).length/n:null,within30:n?abs.filter(x=>x<=30).length/n:null,within60:n?abs.filter(x=>x<=60).length/n:null,underestimatedOver60:errors.filter(x=>x< -60).length,outsideRange:rs.filter(r=>r.predictions[name]<.25||r.predictions[name]>18).length};}
const eligible=records.filter(r=>r.crewHours>0&&r.date>=policy.developmentStart&&r.date<policy.developmentEndExclusive),dev=[],devExcluded=[];
for(const j of eligible){const result=predictVisit(j,['linearV1',...Object.keys(configs)]);(result.reason?devExcluded:dev).push({...result,...(result.reason?{id:j.id}:{})});}
const development=Object.fromEntries(['originalPhysical','linearV1',...Object.keys(configs)].map(n=>[n,metrics(dev,n)])),baseline=development.originalPhysical;
const eligibleModels=['damped','dampedFinishing','dampedFinishingEvidence'].filter(n=>development[n].maeMinutes<=baseline.maeMinutes&&development[n].underestimatedOver60<=baseline.underestimatedOver60&&development[n].outsideRange===0).sort((a,b)=>development[b].within15-development[a].within15||development[a].maeMinutes-development[b].maeMinutes);
const selected=eligibleModels[0]||null;write('selection.json',{selected,development,excludedVisits:devExcluded,policyHash:hash(policy)});write('development-replay.private.json',dev);
const holdout=[],excluded=[];
if(selected){
 // Freeze the chosen model above before inspecting October prediction errors.
 for(const e of state.importedEvents||[]){
  const id=e.store+'|'+e.date;if(!policy.holdoutIds.includes(id))continue;
  const crew=e.attendance.filter(a=>a.employee!==e.supervisor),sup=e.attendance.filter(a=>a.employee===e.supervisor),accounts=[...new Set(records.filter(r=>r.storeId===e.store&&r.date<monday(e.date)).map(r=>r.accountKey))];
  if(!crew.length||sup.length!==1||e.attendance.some(a=>!Number.isFinite(a.time_in_s)||!Number.isFinite(a.time_out_s)||a.time_out_s<=a.time_in_s)||accounts.length!==1){excluded.push({id,reason:'Separate valid crew/supervisor clocks or prior account mapping unavailable'});continue;}
  const crewHours=(Math.max(...crew.map(a=>a.time_out_s))-Math.min(...crew.map(a=>a.time_in_s)))/3600;
  const j={id,storeId:e.store,date:e.date,accountKey:accounts[0],employees:e.employees,supervisor:e.supervisor,rx:e.rx,crewHours};const result=predictVisit(j,[selected]);(result.reason?excluded:holdout).push({...result,...(result.reason?{id}:{})});
 }
}
const holdoutMetrics=selected?Object.fromEntries(['originalPhysical',selected].map(n=>[n,metrics(holdout,n)])):null;
const breakdown=(rows,names)=>Object.fromEntries([...new Set(rows.map(r=>r.segment))].sort().map(k=>[k,Object.fromEntries(names.map(n=>[n,metrics(rows.filter(r=>r.segment===k),n)]))]));
const report={policy,development,selected,developmentSegments:breakdown(dev,Object.keys(development)),developmentExcluded:devExcluded,holdoutMetrics,holdoutSegments:breakdown(holdout,selected?['originalPhysical',selected]:[]),holdoutExcluded:excluded,holdoutScored:!!selected};
write('results.json',report);if(selected)write('october-replay.private.json',holdout);
console.log(JSON.stringify({development,selected,holdoutMetrics,holdoutScored:!!selected,holdoutExcluded:excluded.length},null,2));
