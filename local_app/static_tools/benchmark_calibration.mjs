import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {createPlannerContext,initializeData} from '../../scripts/planner-context.mjs';
import {createWorkloadContext,predictRestrained,median} from '../workload-model.mjs';
import {fitCalibration,applyCalibration,score} from '../calibration-model.mjs';
const priorDir=new URL('../verification/model-improvements-2026-10-14/',import.meta.url),dir=new URL('../verification/calibrated-model-2026-10-14/',import.meta.url);fs.mkdirSync(dir,{recursive:true});
const read=(n,d=priorDir)=>JSON.parse(fs.readFileSync(new URL(n,d))),write=(n,x)=>fs.writeFileSync(new URL(n,dir),JSON.stringify(x,null,2)),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const state=read('state.private.json'),targets=new Map(JSON.parse(fs.readFileSync(new URL('../seed/crew_targets.json',import.meta.url))).map(r=>[r.id,r]));
const records=read('records.private.json').map(r=>({...r,supervisorExtensionHours:targets.get(r.id)?.extension??null}));
const monday=date=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const configs={};for(const elasticity of [.15,.3,.5])for(const finishing of [false,true])for(const evidenceAware of [false,true])configs[`e${elasticity}_f${+finishing}_w${+evidenceAware}`]={elasticity,finishing,evidenceAware};
const names=['originalPhysical',...Object.keys(configs)],strategies=['originalPhysical','globalTuned','accountTuned','segmentTuned','baselineCorrected','segmentTunedCorrected'];
const policy={version:3,developmentStart:'2025-08-25',tuningEndExclusive:'2025-12-01',configs,training:'Earlier weekly out-of-sample predictions only. Global >=80 visits; account >=40; segment >=30. Account/segment override requires >=2-minute MAE gain without worse within-15 rate or >60-minute underestimates. Signed median residuals shrink toward parent groups; correction bounded to +/-30 minutes.',selection:'Select strategy by forward-development within-15 rate, tie-break MAE; require lower MAE, strictly higher within-15 rate, no more >60-minute underestimates or range violations than reference. Fit only from records before Dec 2025. No prior test-period error tuning.',holdoutIds:(state.importedEvents||[]).filter(e=>e.date<'2026-10-14').map(e=>e.store+'|'+e.date).sort(),dataHash:hash(records),sourceHashes:Object.fromEntries(['workload-model.mjs','calibration-model.mjs'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+n,import.meta.url))).digest('hex')])),target:'First crew arrival to last non-supervisor departure',segments:'Original S1-S4 account-size rankings, computed before each forecast week',limitations:['Actual crew/roles rather than archived previsit plans.','Event-date cutoff rather than complete historical receipt availability.','Previously explored development data; October was inspected for record quality but not previously scored.']};
const pp=new URL('policy.json',dir);if(fs.existsSync(pp))assert.deepEqual(read('policy.json',dir),policy);else write('policy.json',policy);
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
 for(const name of names)predictions[name]=predictRestrained(ctx.workload,anchor,plan,configs[name])?.hours;
 pc.plan=plan;pc.prepared=ctx.physical;const physical=vm.runInContext('FullOnsiteModel.predict(data,plan,{elasticity:.3},prepared)',pc),correction=median(own.filter(h=>h.crewHours>0).slice(-5).map(h=>h.duration-h.crewHours));
 predictions.originalPhysical=physical?Math.max(.25,physical.onSiteDuration-correction):null;
 assert.ok(anchor.latestReference<cutoff);
 return {id:j.id,date:j.date,cutoff,account:j.accountKey,segment:ctx.segments[j.storeId]||j.accountKey+'||Unclassified',actual:j.crewHours,predictions,finishingAllowanceHours:anchor.finishingAllowanceHours,finishingEvidenceCount:anchor.finishingEvidenceCount,quality:anchor.quality};
}

const replay=[],excluded=[];
for(const j of records.filter(j=>j.crewHours>0&&j.date<policy.tuningEndExclusive).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))){const row=predictVisit(j,Object.keys(configs));if(row.reason||!names.every(n=>Number.isFinite(row.predictions[n]))){excluded.push({id:j.id,reason:row.reason||'No common model coverage'});continue;}replay.push(row);}
const dev=[],fits=[];for(const row of replay.filter(r=>r.date>=policy.developmentStart)){
 const fit=fitCalibration(replay,row.cutoff,names,row);assert.ok(!fit.latestTrainingDate||fit.latestTrainingDate<row.cutoff);
 dev.push({...row,predictions:applyCalibration(row,fit)});fits.push({id:row.id,account:row.account,segment:row.segment,...fit});
}
const development=Object.fromEntries(strategies.map(n=>[n,score(dev,n)])),b=development.originalPhysical;
const candidates=strategies.filter(n=>n!=='originalPhysical'&&development[n].maeMinutes<b.maeMinutes&&development[n].within15>b.within15&&development[n].underestimatedOver60<=b.underestimatedOver60&&development[n].outsideRange===0).sort((a,c)=>development[c].within15-development[a].within15||development[a].maeMinutes-development[c].maeMinutes);
const selected=candidates[0]||null;
write('selection.json',{selected,development,policyHash:hash(policy)});write('training-replay.private.json',replay);write('development-replay.private.json',dev);write('weekly-fits.private.json',fits);
const holdout=[],holdoutExcluded=[];
if(selected){for(const e of state.importedEvents||[]){
 const id=e.store+'|'+e.date;if(!policy.holdoutIds.includes(id))continue;
 const crew=e.attendance.filter(a=>a.employee!==e.supervisor),sup=e.attendance.filter(a=>a.employee===e.supervisor),accounts=[...new Set(records.filter(r=>r.storeId===e.store&&r.date<monday(e.date)).map(r=>r.accountKey))];
 if(!crew.length||sup.length!==1||e.attendance.some(a=>!Number.isFinite(a.time_in_s)||!Number.isFinite(a.time_out_s)||a.time_out_s<=a.time_in_s)||accounts.length!==1){holdoutExcluded.push({id,reason:'Separate valid clocks or prior account mapping unavailable'});continue;}
 const crewHours=(Math.max(...crew.map(a=>a.time_out_s))-Math.min(...crew.map(a=>a.time_in_s)))/3600;
 const row=predictVisit({id,storeId:e.store,date:e.date,accountKey:accounts[0],employees:e.employees,supervisor:e.supervisor,rx:e.rx,crewHours},Object.keys(configs));if(row.reason){holdoutExcluded.push({id,reason:row.reason});continue;}
 const fit=fitCalibration(replay,row.cutoff,names,row),predictions=applyCalibration(row,fit);holdout.push({...row,predictions:{originalPhysical:predictions.originalPhysical,[selected]:predictions[selected]},calibration:fit});
}}
const group=(rows,ns)=>Object.fromEntries([...new Set(rows.map(r=>r.segment))].sort().map(s=>[s,Object.fromEntries(ns.map(n=>[n,score(rows.filter(r=>r.segment===s),n)]))]));
const report={policy,trainingPredictions:replay.length,development,selected,developmentSegments:group(dev,strategies),excluded,overrideCounts:{account:fits.filter(f=>f.models.account!==f.models.global).length,segment:fits.filter(f=>f.models.segment!==f.models.account).length},holdoutScored:!!selected,holdoutMetrics:selected?Object.fromEntries(['originalPhysical',selected].map(n=>[n,score(holdout,n)])):null,holdoutSegments:group(holdout,selected?['originalPhysical',selected]:[]),holdoutExcluded};
write('results.json',report);if(selected)write('october-replay.private.json',holdout);
console.log(JSON.stringify({trainingPredictions:replay.length,development,selected,overrideCounts:report.overrideCounts,holdoutMetrics:report.holdoutMetrics,holdoutExcluded:holdoutExcluded.length},null,2));
