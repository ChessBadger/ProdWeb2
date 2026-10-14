import {rxHistory,rxEstimate,rxLayerEstimator} from '../rx-production.mjs';
import {curateLastCrew} from '../last-crew.mjs';

import crypto from 'node:crypto';

import {supervisorRows,supervisorEstimate} from '../supervisor-production.mjs';

// Local build only. Reuse the original planner's normalization, rates and reference selection.

import fs from 'node:fs';import vm from 'node:vm';

import {createPlannerContext,initializeData} from '../../scripts/planner-context.mjs';

const input=JSON.parse(fs.readFileSync(0,'utf8')),pc=createPlannerContext();initializeData(pc,JSON.stringify(input.exportHistory));pc.cut=input.cutoff;pc.ids=input.catalog.employees.filter(p=>p.active).map(p=>p.id);

const keys=Object.fromEntries(input.catalog.employees.map((p,i)=>[p.id,'p'+i]));

vm.runInContext(`const canonical=new Map([...state.employees.keys()].map(x=>[String(x).padStart(4,'0'),x]));const canon=x=>canonical.get(String(x).padStart(4,'0'))||String(Number(x));const history=DurationModel.createHistory(state.jobs.filter(j=>j.date<cut));const ec=buildDurationEmployeeContext(state.rows.filter(r=>r.date<cut));ec.asOfDate=cut;const ratesFor=durationRateResolver(ec);const segmentStores=buildStoreStats(state.jobs.filter(j=>j.date<cut));const segmentMap=buildStoreSegments(segmentStores);`,pc);

pc.inputValidThrough=new Date(Date.parse(input.cutoff+'T00:00:00Z')+6*86400000).toISOString().slice(0,10);const stores={},supervisorHistory=supervisorRows(input.exportHistory.EmployeeProductionHistory,input.cutoff,input.data,vm.runInContext(`Object.fromEntries([...new Set(state.rows.map(r=>r.account))].map(a=>[a.trim().toLowerCase(),getLinkedAccountKey(a)]))`,pc));

const rxEvidence=rxHistory(input.exportHistory.EmployeeProductionHistory,input.cutoff,vm.runInContext(`Object.fromEntries([...new Set(state.rows.map(r=>r.account))].map(a=>[a.trim().toLowerCase(),getLinkedAccountKey(a)]))`,pc));

const estimateRx=rxLayerEstimator(rxEvidence,vm.runInContext(`Object.fromEntries([...segmentMap].map(([alias,s])=>[alias,s.segmentKey]))`,pc));

for(const entry of input.catalog.stores){pc.entry=entry;pc.analytics=input.analytics.durationAnalytics;

 const compiled=vm.runInContext(`(()=>{

  const prior=[...(history.stores.get(entry.alias)||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];

  function pack(inventoryMode){

   const p={date:cut,historyCutoff:cut,storeKey:entry.alias,accountKey:entry.accountKey,typeOfInv:prior?.typeOfInv||'Unknown',inventoryMode,employees:ids.map(canon),roles:{supervisor:'',rx:[]}};

   const select=jobs=>(jobs||[]).filter(j=>j.date<cut).sort((a,b)=>b.date.localeCompare(a.date)||a.storeKey.localeCompare(b.storeKey));const own=select(history.stores.get(p.storeKey)),typed=own,matching=typed.filter(j=>j.inventoryMode===p.inventoryMode);let refs=(matching.length?matching:typed.length?typed:own).slice(0,5),source=matching.length?'same store and verified counting mode':typed.length?'same store; counting-mode fallback':'same store (other inventory types)',hasStoreHistory=refs.length>0;

   if(!hasStoreHistory){const account=select(history.accounts.get(p.accountKey)),t=account,m=t.filter(j=>j.inventoryMode===p.inventoryMode);refs=(m.length?m:t.length?t:account).slice(0,20);source=m.length?'account and verified counting mode':t.length?'account; counting-mode fallback':'account';if(!refs.length){refs=select(history.all).slice(0,30);source='company history';}}

   if(!refs.length)return null;

   const rates=Object.fromEntries(ids.map(id=>[id,ratesFor(canon(id),p.accountKey,p.inventoryMode,false)])),recentRates=Object.fromEntries(ids.map(id=>[id,ratesFor(canon(id),p.accountKey,p.inventoryMode,true)]));

   const kernels=refs.map(j=>{const rp=DurationModel.historicalPlan(j),sr=j.employeeDetails?.find(e=>e.employee===rp.roles.supervisor),eligible=rp.employees.includes(rp.roles.supervisor)&&(!j.employeeDetails||(sr?.pieces>0&&sr?.inStoreHours>0));const profile=include=>{const r=DurationModel.crewProfile(rp,ratesFor,include);return {speed:r.speed,known:r.knownShare,evidence:r.evidenceShare,members:r.ids.map(id=>String(id).padStart(4,'0'))}};return {duration:j.duration,ageWeight:1,compatible:typeof j.inventoryMode==='boolean'&&j.inventoryMode===p.inventoryMode,eligible,full:profile(true),counter:profile(false)};});

   const storeErrors=analytics?.errorByStore?.[p.storeKey],accountErrors=analytics?.errorByAccount?.[p.accountKey],error=storeErrors?.count>=20?storeErrors:accountErrors?.count>=40?accountErrors:analytics?.errorGlobal;

   const row=analytics?.accuracyCache?.allRows?.find(r=>r.storeKey===p.storeKey);

   return {rates,recentRates,kernels,hasStoreHistory,source,inventoryMode,typeOfInv:p.typeOfInv,historyCount:own.length,matchingCount:refs.length,config:analytics?.byAccount?.[p.accountKey]||analytics?.config||{baseline:'median5',elasticity:.3},calibration:error?{count:error.count,p10:error.p10,p90:error.p90}:null,accuracy:row?{count:row.count,mae:row.mae,mape:row.mape,actualAvgDuration:row.actualAvgDuration,predictedAvgDuration:row.predictedAvgDuration}:null};

  }

  const assignment=segmentMap.get(entry.alias),segment=assignment?{id:assignment.segmentId,count:Math.max(...[...segmentMap.values()].filter(s=>s.segmentKey.split('||')[0]===assignment.segmentKey.split('||')[0]).map(s=>Number(s.segmentId.slice(1))))}:null;
  return {segment,defaultMode:prior?.inventoryMode??null,variants:{default:pack(prior?.inventoryMode??null),regular:pack(false),modas:pack(true)}};

 })()`,pc);

 const latest=vm.runInContext(`Object.fromEntries(ids.map(id=>{const value=ec.employees.get(canon(id))?.accountStats?.[getLinkedAccountKey(entry.accountKey)]?.mostRecentPiecesPerHr;return [id,Number.isFinite(value)&&value>0?value:null]}))`,pc);compiled.recentAccountProduction=Object.fromEntries(Object.entries(latest).map(([id,value])=>[keys[id],value]));

 for(const pack of Object.values(compiled.variants)){if(!pack)continue;pack.rxEstimate=rxEstimate(rxEvidence,entry.alias,entry.accountKey,pack.inventoryMode);pack.rxEstimates=Object.fromEntries([['standard','rates'],['recent','recentRates']].map(([label,field])=>[label,Object.fromEntries(input.catalog.employees.filter(p=>p.active).map(p=>[keys[p.id],estimateRx(p.id,entry.alias,entry.accountKey,pack.inventoryMode,pack[field][p.id].speed,input.cutoff)]))]));pack.supervisorEstimates=Object.fromEntries([['standard','rates'],['recent','recentRates']].map(([label,field])=>[label,Object.fromEntries(input.catalog.employees.filter(p=>p.active).map(p=>{const e=supervisorEstimate(supervisorHistory,p.id,entry.accountKey,entry.alias.split('||')[1],pack[field][p.id].speed,pack.inventoryMode,pack.typeOfInv);return [keys[p.id],[e.factor,e.count,e.scope,e.supported]]}))]));for(const field of ['rates','recentRates'])pack[field]=Object.fromEntries(Object.entries(pack[field]).map(([id,r])=>[keys[id],[r.speed,!!r.known,r.evidence]]));for(const k of pack.kernels)for(const field of ['full','counter'])k[field].members=k[field].members.map(id=>keys[id]).filter(Boolean);}

 pc.scheduleInput=input.schedule?.ScheduleFinalFull||[];pc.scheduleCatalog=input.catalog.stores;const schedule=vm.runInContext(`(()=>{const all=scheduleInput.filter(r=>!r.Canceled).map(raw=>({...normalizeScheduleRow(raw),scheduleAccount:String(raw.AccountName||'').trim().toLowerCase(),scheduleCustomer:String(raw.CustomerNumber1||'').padStart(8,'0')})).filter(r=>r.valid),key=canonicalizeStoreName(entry.alias.split('||')[1]),account=entry.alias.split('||')[0].trim().toLowerCase(),catalogMatches=scheduleCatalog.filter(e=>canonicalizeStoreName(e.alias.split('||')[1])===key&&e.alias.split('||')[0].trim().toLowerCase()===account),matches=all.filter(r=>r.canonicalStoreName===key&&r.scheduleAccount===account&&(catalogMatches.length===1||String(entry.storeId)===r.scheduleCustomer));return {jobs:matches.filter(r=>r.date>=cut&&r.date<=inputValidThrough).map(r=>({date:r.date,startTime:Number.isFinite(parseScheduleTimeToMinutes(r.startTimeText))?String(Math.floor(parseScheduleTimeToMinutes(r.startTimeText)/60)).padStart(2,'0')+':'+String(parseScheduleTimeToMinutes(r.startTimeText)%60).padStart(2,'0'):'',typeOfInv:r.typeOfInv,plannedDurationHours:r.plannedDurationHours,plannedCrewSize:r.plannedCrewSize,details:Object.fromEntries(['customerNumber','address','city','stateCode','zipcode','phone','mapLink','dateScheduled','storeNotes','notes','runName','meetTimeText'].map(k=>[k,String(r[k]||'')]))})),latestDate:all.map(r=>r.date).sort().at(-1)||null}})()`,pc);compiled.scheduleJobs=[...new Map(schedule.jobs.map(j=>[JSON.stringify(Object.fromEntries(Object.entries(j).filter(([k])=>k!=='details'))),j])).values()].map((j,i)=>({...j,key:crypto.createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(j).filter(([k])=>k!=='details')))).digest('hex').slice(0,24)}));compiled.scheduleSource={name:'ScheduleFinalFull',latestDate:schedule.latestDate};compiled.lastCrew=vm.runInContext(`(()=>{const last=[...(history.stores.get(entry.alias)||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];if(!last)return {employees:[],supervisor:'',rx:[]};return {inventoryDate:last.date,inventoryType:last.typeOfInv,employees:last.employees.map(id=>String(id).padStart(4,'0')),supervisor:String(last.supervisorNumber||'').padStart(4,'0'),rx:(last.rxEmployees||[]).map(id=>String(id).padStart(4,'0'))}})()`,pc);compiled.lastCrew.rows=curateLastCrew(input.exportHistory.EmployeeProductionHistory,entry.alias,compiled.lastCrew.inventoryDate,compiled.lastCrew.inventoryType,compiled.lastCrew.employees,input.catalog.employees,keys);delete compiled.lastCrew.inventoryDate;delete compiled.lastCrew.inventoryType;compiled.lastCrew.employees=compiled.lastCrew.employees.map(i=>keys[i]).filter(Boolean);compiled.lastCrew.supervisor=keys[compiled.lastCrew.supervisor]||'';compiled.lastCrew.rx=compiled.lastCrew.rx.map(i=>keys[i]).filter(Boolean);stores[entry.alias]=compiled;

}

const a=input.analytics.durationAnalytics;if([a.config,...Object.values(a.byAccount||{})].some(c=>c.ageHalfLife>0))throw Error('Age-decay scenario compilation needs review; no raw historical dates are exported.');const grouped={};for(const row of a.accuracyCache?.allRows||[]){const account=row.accountKey;if(!grouped[account])grouped[account]={count:0,errorSum:0,mapeSum:0};const g=grouped[account];g.count+=row.count;g.errorSum+=row.mae*row.count;g.mapeSum+=row.mape*row.count;}

const evidence={legacyVersion:a.version,legacyTestMetrics:Object.fromEntries(Object.entries(a.testMetrics).map(([k,v])=>[k==='jobs'?'visits':k,v])),legacyInterval:a.interval,legacyCalibrationStart:a.calibrationStart,legacyEvaluationPolicy:a.evaluationPolicy,legacyAccountMetrics:Object.fromEntries(Object.entries(grouped).map(([k,g])=>[k,{count:g.count,mae:g.errorSum/g.count,mape:g.mapeSum/g.count}])),integrated:{modelVersion:'validated-history-unified-v1',developmentMAEMinutes:29.05,developmentVisits:325,priorControlMAEMinutes:30.25,originalMAEMinutes:44.99,freshHoldoutAvailable:false,targetMinutes:15},warning:'Archived legacy metrics predate the full-export backfill and are not a score of this refreshed release or manual scenarios. Integrated folds were explored; no fresh holdout.'};

process.stdout.write(JSON.stringify({stores,evidence}));
