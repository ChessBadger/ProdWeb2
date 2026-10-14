import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {rxHistory,rxEstimate} from '../rx-production.mjs';
import {createPlannerContext,initializeData} from '../../scripts/planner-context.mjs';
const state=JSON.parse(fs.readFileSync(new URL('../verification/model-improvements-2026-10-14/state.private.json',import.meta.url)));
const pc=createPlannerContext();initializeData(pc,JSON.stringify(state.exportHistory));
const aliases=vm.runInContext(`Object.fromEntries([...new Set(state.rows.map(r=>r.account))].map(a=>[a.trim().toLowerCase(),getLinkedAccountKey(a)]))`,pc);
const h=rxHistory(state.exportHistory.EmployeeProductionHistory,'2026-10-12',aliases),samples=[];
for(const o of h.observations){
 const d=new Date(o.date+'T00:00:00Z');d.setUTCDate(d.getUTCDay()?d.getUTCDate()-(d.getUTCDay()+6)%7:d.getUTCDate()-6);const cut=d.toISOString().slice(0,10);
 const prior=h.observations.filter(x=>x.date<cut),e=rxEstimate({observations:prior},o.store,o.account,o.mode);
 assert.ok(prior.every(x=>x.date<cut));
 if(e.supported)samples.push({date:o.date,cutoff:cut,account:o.account,store:o.store,mode:o.mode,actual:o.ratio,estimated:Math.max(0,Math.min(1,1-(1-e.factor)*(e.referenceWorkers||1)/o.workers)),baseline:.5,count:e.count});
}
const score=rs=>({n:rs.length,autoMAEpercentagePoints:rs.length?rs.reduce((s,r)=>s+Math.abs(r.estimated-r.actual)*100,0)/rs.length:null,assumed50MAEpercentagePoints:rs.length?rs.reduce((s,r)=>s+Math.abs(.5-r.actual)*100,0)/rs.length:null});
const summary={target:'Bounded Rx output ratio versus own earlier comparable non-Rx counting rate; not finish-time error or measured pharmacy time',method:'Weekly forward replay. Each Rx observation uses at least three earlier normal-counter visits per assignee. Store ratios blend with earlier account Rx ratios; total reduction shared by assigned Rx headcount. No TypeOfInv filter. Actual historical telemetry mode and Rx assignments used.',limitations:['Retrospective reused data, not a fresh holdout.','Ratios are bounded 0–100%; output above normal counting is not modeled as an Rx productivity boost.','Only Kroger-linked accounts currently have enough comparable Rx evidence for scored predictions.','No overall arrival-to-departure accuracy claim.'],usableRxVisits:h.observations.length,rejected:h.rejected,all:score(samples),earlier:score(samples.filter(r=>r.date<'2026-03-09')),later:score(samples.filter(r=>r.date>='2026-03-09')),byAccount:Object.fromEntries([...new Set(samples.map(r=>r.account))].map(a=>[a,score(samples.filter(r=>r.account===a))])),kroger434:[false,true].map(mode=>rxEstimate(h,'KROGER||METRO #434 +RX, COTTAGE GROVE','kroger',mode))};
const dir=new URL('../verification/role-contributions-2026-10-14/',import.meta.url);fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(new URL('rx-validation.json',dir),JSON.stringify(summary,null,2));fs.writeFileSync(new URL('rx-replay.private.json',dir),JSON.stringify(samples,null,2));console.log(JSON.stringify(summary,null,2));
