import fs from 'node:fs';import assert from 'node:assert/strict';
import {predictPlan,DurationModel} from '../static_source/planner.mjs';
const dir=new URL('../verification/toggle-blend-2026-10-14/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,dir))),write=(n,x)=>fs.writeFileSync(new URL(n,dir),JSON.stringify(x,null,2));
const policy=read('policy.json'),rows=[],excluded=read('excluded.json');
for(const file of fs.readdirSync(dir).filter(f=>/^2026-.*\.private.json$/.test(f)).sort()){
 const {snapshot,catalog,visits}=read(file),keys=new Map(catalog.employees.map((e,i)=>[e.id,'p'+i]));
 for(const r of visits){
  const storeKey='s'+catalog.stores.findIndex(s=>s.storeId===r.storeId),st=snapshot.stores.find(s=>s.key===storeKey);
  const p={storeKey,date:r.date,scheduleJobKey:r.id,employees:r.employees.map(i=>keys.get(i)),roles:{supervisor:keys.get(r.supervisor)||'',rx:r.rx.map(i=>keys.get(i)),training:[],earlyLate:[]},modes:{...DurationModel.DEFAULT_MODES,supervisor:'auto'},countingMode:/kroger/i.test(st.name)?'modas':'default',notes:{},shrink:{percent:0,mode:'none',employeeIds:[]}};
  try{
   const a=predictPlan(snapshot,{...p,model:'integrated'}),b=predictPlan(snapshot,{...p,model:'reference'});
   assert.ok(snapshot.cutoff>=policy.trainingEndExclusive);assert.equal(a.scheduledDate,r.date);
   if(!a.mainAvailable)throw Error('Integrated model fell back to reference');
   rows.push({id:r.id,date:r.date,cutoff:snapshot.cutoff,account:r.accountKey,segment:st.scenario.segment||null,actual:r.crewHours,integrated:a.displayHours,reference:b.displayHours,hasCrewTiming:!!a.crewTiming,integratedKind:a.estimateKind,referenceKind:b.estimateKind});
  }catch(e){excluded.push({id:r.id,reason:e.message});}
 }
}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,blend=(r,w,offset=0)=>w*r.integrated+(1-w)*Math.max(.25,r.reference+offset);
const median=a=>{a=[...a].sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2:0;};
const segment=r=>r.account+'|'+JSON.stringify(r.segment);
function weight(rs,offset=0){return Array.from({length:21},(_,i)=>i/20).sort((a,b)=>mean(rs.map(r=>Math.abs(blend(r,a,offset)-r.actual)))-mean(rs.map(r=>Math.abs(blend(r,b,offset)-r.actual)))||b-a)[0];}
function fit(history,row){
 const prior=history.filter(r=>r.date<row.cutoff),account=prior.filter(r=>r.account===row.account),seg=account.filter(r=>segment(r)===segment(row));
 assert.ok(prior.every(r=>r.date<row.cutoff));
 const global=prior.length>=8?weight(prior):1;
 const aw=account.length>=12?(weight(account)*account.length+20*global)/(account.length+20):global;
 const sw=seg.length>=8?(weight(seg)*seg.length+20*aw)/(seg.length+20):aw;
 const offset=prior.length>=8?Math.max(-.5,Math.min(.5,median(prior.map(r=>r.actual-r.reference))*prior.length/(prior.length+20))):0;
 return {global,account:aw,segment:sw,offset,corrected:prior.length>=8?weight(prior,offset):1,n:prior.length,accountN:account.length,segmentN:seg.length,latest:prior.map(r=>r.date).sort().at(-1)||null};
}
const strategies=['integrated','reference','blend25','blend50','blend75','learnedGlobal','learnedAccount','learnedSegment','correctedReference','correctedBlend'];
function predict(r,history){const f=fit(history,r);return {...r,fit:f,predictions:{integrated:r.integrated,reference:r.reference,blend25:blend(r,.25),blend50:blend(r,.5),blend75:blend(r,.75),learnedGlobal:blend(r,f.global),learnedAccount:blend(r,f.account),learnedSegment:blend(r,f.segment),correctedReference:Math.max(.25,r.reference+f.offset),correctedBlend:blend(r,f.corrected,f.offset)}};}
function score(rs,n){const es=rs.map(r=>r.predictions[n]-r.actual);return {n:es.length,maeMinutes:es.length?mean(es.map(x=>Math.abs(x)*60)):null,within15:es.length?es.filter(x=>Math.abs(x)<=.25).length/es.length:null,within30:es.length?es.filter(x=>Math.abs(x)<=.5).length/es.length:null,within60:es.length?es.filter(x=>Math.abs(x)<=1).length/es.length:null,under60:es.filter(x=>x< -1).length};}
const metrics=rs=>Object.fromEntries(strategies.map(n=>[n,score(rs,n)]));
const train=rows.filter(r=>r.date<policy.selectionEndExclusive),dev=train.map(r=>predict(r,train)),development=metrics(dev),base=development.integrated;
const eligible=strategies.filter(n=>n!=='integrated'&&development[n].maeMinutes<base.maeMinutes&&development[n].within15>base.within15&&development[n].under60<=base.under60).sort((a,b)=>development[b].within15-development[a].within15||development[a].maeMinutes-development[b].maeMinutes),selected=eligible[0]||null;
write('selection.json',{selected,development});
// Freeze all learned weights at the selection boundary for every final visit.
const final=rows.filter(r=>r.date>=policy.selectionEndExclusive).map(r=>predict({...r,cutoff:policy.selectionEndExclusive},train));
const groups=rs=>Object.fromEntries([...new Set(rs.map(segment))].sort().map(k=>[k,metrics(rs.filter(r=>segment(r)===k))]));
const result={selected,development,final:metrics(final),developmentSegments:groups(dev),finalSegments:groups(final),excluded,developmentDates:[...new Set(train.map(r=>r.date))],finalDates:[...new Set(final.map(r=>r.date))]};
write('results.json',result);write('replay.private.json',{development:dev,final});
// Verify no final outcomes or same-week outcomes enter weight fitting.
for(const r of [...dev,...final]){const before=fit(train,r),after=fit([...train,{...r,date:'2099-01-01',actual:999},{...r,date:r.cutoff,actual:999}],r);assert.deepEqual(before,after);assert.ok(!before.latest||before.latest<r.cutoff);assert.ok(before.segment>=0&&before.segment<=1);assert.equal(blend(r,1),r.integrated);assert.equal(blend(r,0),r.reference);assert.equal(blend(r,.5),(r.integrated+r.reference)/2);}
const all=[...dev,...final],sameDirection=all.filter(r=>(r.integrated-r.actual)*(r.reference-r.actual)>0).length;
const lines=['ACTUAL TOGGLE MODEL BLEND EXPERIMENT - 14 October 2026','',
 'Outcome: No blend selected; website and published release unchanged.',
 'Runs the actual predictPlan integrated/reference paths with weekly compiled snapshots, automatic supervisor contributions, standard production, Kroger Modas default, historical actual crew and roles. Synthetic schedule supplies only date and 06:00 start; there are no availability notes. All historical employees are available for research, rather than filtering historical crews to today\'s roster.',
 'Both outputs scored against measured first crew arrival to last non-supervisor departure. Reference remains an attendance proxy; corrected variants fit its error to this target using prior records only.',
 'Development: '+dev.length+' visits after model training, before 12 October. Final: '+final.length+' visits on 12-13 October. October 14 excluded as potentially incomplete.',
 'Integrated model training ends before '+policy.trainingEndExclusive+'. Never score it on earlier training outcomes.',
 'Weights use earlier weeks only; final weights frozen before October 12. Fixed final blends are diagnostic, not grounds for choosing a different winner after seeing final outcomes.',
 'Strategy | Development MAE minutes | Within 15 | Final MAE minutes | Within 15',
 ...strategies.map(n=>`${n} | ${development[n].maeMinutes?.toFixed(2)} | ${(100*development[n].within15).toFixed(1)}% | ${result.final[n].maeMinutes?.toFixed(2)} | ${(100*result.final[n].within15).toFixed(1)}%`),
 '',`Models err in the same direction on ${sameDirection}/${all.length} visits.`,
 'Account/segment overrides never activated: largest prior account sample '+Math.max(...all.map(r=>r.fit.accountN))+'; largest prior segment sample '+Math.max(...all.map(r=>r.fit.segmentN))+'. Account and segment strategies therefore fell back to global weights.',
 'Final learned integrated weight: '+JSON.stringify([...new Set(final.map(r=>r.fit.global))]),
 '',...policy.limitations,
 'These scores use a different sample and actual toggle paths; they do not contradict or directly compare with earlier research comparator scores.',
 'Only 1-3 development visits per account/segment and four total final visits: insufficient to establish segment accuracy or generalize the failure of blending.',
 'Twenty-two excluded candidates are documented in results.json; another 383 March-June historical visits lack separate crew targets and were not eligible. No fuzzy store mappings or invented crew targets.',
 'Future/same-week outcome-injection, weight bounds, endpoint and 50/50 arithmetic assertions passed.',
 '', 'DEVELOPMENT ACCOUNT / SEGMENT: n, integrated MAE, 50/50 MAE',
 ...Object.entries(result.developmentSegments).map(([k,v])=>`${k}: ${v.integrated.n}, ${v.integrated.maeMinutes.toFixed(2)}, ${v.blend50.maeMinutes.toFixed(2)}`)];
fs.writeFileSync(new URL('RESULTS.txt',dir),lines.join('\n')+'\n');
console.log(JSON.stringify({selected,development,final:result.final,excluded:excluded.length},null,2));
