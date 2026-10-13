// Offline experiment: choose optional changes on development only, then score once.
// Usage: node scripts/weekly-experiment.mjs <null-preserving input.json> <original-repo>
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPlannerContext,initializeData} from './planner-context.mjs';
const raw=readFileSync(process.argv[2],'utf8');
const context=createPlannerContext();initializeData(context,raw);
const run=(s,c=context)=>vm.runInContext(s,c);
context.records=await run('buildDurationReplayRecords(state.rows,state.jobs)');
const model=context.DurationModel;
const jobs=run('state.jobs');
const options=[{}, {evidenceAware:true}, {ageHalfLife:180}, {evidenceAware:true,ageHalfLife:180}];
const candidates=options.map(option=>({name:JSON.stringify(option),option,result:model.analyze(context.records,jobs,option)}));
const rx=createPlannerContext();initializeData(rx,raw);
// Experimental attendance-denominator alternative ONLY. Never silently deploy it.
run('inferSpeed = row => row.isRx && row.manHours > 0 ? row.totalExtQty / row.manHours : row.piecesPerHr > 0 ? row.piecesPerHr : row.manHours > 0 ? row.totalExtQty / row.manHours : 0',rx);
const rxRecords=await run('buildDurationReplayRecords(state.rows,state.jobs)',rx);
candidates.push({name:'RX attendance denominator',option:{},result:model.analyze(rxRecords,jobs),rx:true});
const core=candidates[0];
const best=[...candidates].sort((a,b)=>a.result.validationMae-b.result.validationMae)[0];
// Prespecified materiality threshold: at least 0.03 hours development improvement.
const selected=best.result.validationMae < core.result.validationMae-.03 ? best : core;
const report={selectionRule:'Development MAE only; optional change requires >=0.03h improvement. No test metrics used to select.',development:candidates.map(x=>({name:x.name,validationMae:x.result.validationMae,config:x.result.config,byAccount:x.result.byAccount})),selected:selected.name,
selectedOptions:selected.option,selectedRxAttendance:Boolean(selected.rx),
validationEnd:selected.result.validationEnd,calibrationStart:selected.result.calibrationStart,calibrationJobs:selected.result.calibrationJobs,
test:selected.result.testMetrics,benchmarks:selected.result.benchmarks,interval:selected.result.interval};
if(process.argv[3]){
  const old=vm.createContext({window:{location:{search:'?precomputeAnalytics=1'}},document:{getElementById:()=>null,querySelector:()=>null},URLSearchParams,console,setTimeout,clearTimeout,performance});
  for(const file of ['durationmodel.js','scheduleplanningapp.js'])vm.runInContext(readFileSync(process.argv[3]+'/public/'+file,'utf8').replace('bootstrapAuth();',''),old);
  initializeData(old,raw);
  old.DurationModel.weekStart=model.weekStart;
  vm.runInContext(run('buildDurationReplayRecords.toString()'),old);
  const oldRecords=await run('buildDurationReplayRecords(state.rows,state.jobs)',old);
  const oldAnalytics=model.analyze(oldRecords,run('state.jobs',old));
  report.legacyUnderSameWeeklyProtocol={test:oldAnalytics.testMetrics,config:oldAnalytics.config,byAccount:oldAnalytics.byAccount};
}
const rawRows=Object.values(JSON.parse(raw)).find(Array.isArray);
const time=s=>{const m=String(s).match(/^(\d\d):(\d\d):(\d\d)/);return m?+m[1]+m[2]/60+m[3]/3600:null};
const clocks=new Map();for(const r of rawRows){const k=[String(r.DateOfInv).slice(0,10),r.AccountName.trim(),r.StoreName.trim()].join('||');if(!clocks.has(k))clocks.set(k,[]);clocks.get(k).push(r)}
const differences=[];for(const j of jobs){const rs=clocks.get([j.date,j.account,j.storeName].join('||'));if(!rs||rs.some(r=>time(r.TimeIn)===null||time(r.TimeOut)===null||time(r.TimeOut)<time(r.TimeIn)))continue;differences.push(Math.max(...rs.map(r=>time(r.TimeOut)))-Math.min(...rs.map(r=>time(r.TimeIn)))-j.duration)}
differences.sort((a,b)=>a-b);report.observedAttendanceSpanMinusCurrentTarget={jobs:differences.length,meanHours:differences.reduce((a,b)=>a+b,0)/differences.length,medianHours:differences[Math.floor(differences.length*.5)],p90Hours:differences[Math.floor(differences.length*.9)],maxHours:differences.at(-1),note:'Descriptive target discrepancy only: observed crew span is also incomplete. Current on-site target retained.'};
writeFileSync(new URL('../weekly-experiment-results.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
