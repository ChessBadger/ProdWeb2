// Read-only research: paired production measures, prior-week inputs, unchanged live model.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {predictPlan,DurationModel} from '../static_source/planner.mjs';
import {visitModes,visitKey,exportAlias} from '../counting-mode.mjs';
const dir=new URL('../verification/multi-rate-2026-10-14/',import.meta.url);
const state=JSON.parse(fs.readFileSync(new URL('../verification/model-improvements-2026-10-14/state.private.json',import.meta.url)));
const raw=state.exportHistory.EmployeeProductionHistory;
const write=(n,x)=>fs.writeFileSync(new URL(n,dir),JSON.stringify(x,null,2));
const median=a=>{a=[...a].sort((x,y)=>x-y);return a.length?(a[(a.length-1)>>1]+a[a.length>>1])/2:null;};
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const id=x=>String(x??'').replace(/\.0+$/,'').padStart(4,'0');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const candidates={baseline:{sku:0,dollar:0}};
for(const strength of [.15,.3,.5]){
 candidates['sku'+strength]={sku:strength,dollar:0};
 candidates['dollar'+strength]={sku:0,dollar:strength};
 candidates['both'+strength]={sku:strength/2,dollar:strength/2};
}
const policy={selectionEndExclusive:'2026-10-12',target:'First crew arrival to last non-supervisor departure',candidates,
 method:'Adjust each actual toggle prediction by (historical store SKU/piece mix divided by planned crew SKU/piece capacity)^strength and equivalent dollar ratio. Paired positive rates only. Same account and verified mode; exclude historical supervisor and Rx rows. Personal median rates shrink toward group medians by n/(n+5). Store mix is median of last three comparable exported visits; no current outcome quantities. Ratio bounded 0.5–2. No compatible store evidence => unchanged baseline.',
 selection:'Before final scoring, select separately for each toggle: development MAE lower, within15 strictly higher, no extra >60 minute underestimates; best within15 then MAE. Final is previously explored retrospective October 12–13, not a fresh independent holdout.',
 limitations:['Actual crew/roles, not archived plans. Historical receipt times unavailable.','Store exports omit supervisor production; all workload mixes are observed crew mixes, not complete inventory totals.','SKU field may represent counted records, not unique store SKUs. Dollar throughput depends on product prices and mix.','Small post-training sample; account/size-segment findings are descriptive only.','Current toggles share unverified retained historical production. This experiment does not validate its provenance.'],
 rawHash:crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex')};
write('multirate-policy.json',policy);
const sidAccount=new Map(state.history.jobs.map(j=>[j.storeId,j.accountKey]));
const account=r=>sidAccount.get(state.history.aliases[exportAlias(r)])||String(r.AccountName).toLowerCase();
function prepare(cut,input=raw){
 const prior=input.filter(r=>String(r.DateOfInv).slice(0,10)<cut),modes=visitModes(prior,cut),groups=new Map();
 const rows=prior.map(r=>({...r,date:String(r.DateOfInv).slice(0,10),person:id(r.Employee),account:account(r),mode:modes.get(visitKey(r)),sid:state.history.aliases[exportAlias(r)]}));
 const counters=rows.filter(r=>r.person!==id(r.SupervisorNumber)&&!r.Rx&&['PiecesPerHr','SkusPerHr','DollarPerHr'].every(k=>Number.isFinite(r[k])&&r[k]>0));
 for(const r of rows){const key=visitKey(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const visits=[...groups.values()].map(rs=>{
  const valid=rs.filter(r=>[r.Total_Ext_Qty,r.Count_Record,r.Total_Ext_Price].every(v=>Number.isFinite(v)&&v>0));
  const sum=k=>valid.reduce((s,r)=>s+r[k],0),pieces=sum('Total_Ext_Qty');
  return {date:rs[0].date,sid:rs[0].sid,mode:rs[0].mode,sku:pieces?sum('Count_Record')/pieces:null,dollar:pieces?sum('Total_Ext_Price')/pieces:null};
 }).sort((a,b)=>a.date.localeCompare(b.date));
 return {cut,rows,counters,visits};
}
function features(ctx,visit,mode){
 const refs=ctx.visits.filter(r=>r.sid===visit.storeId&&r.mode===mode&&r.sku>0&&r.dollar>0).slice(-3);
 const pool=ctx.counters.filter(r=>r.account===visit.accountKey&&r.mode===mode);
 if(!refs.length||pool.length<5)return {sku:1,dollar:1,available:false,reason:!refs.length?'No earlier same-store, same-mode export':'Fewer than five comparable counter rows'};
 const fields=['PiecesPerHr','SkusPerHr','DollarPerHr'],group=fields.map(k=>median(pool.map(r=>r[k]))),cap=[0,0,0];let personal=0;
 for(const employee of new Set(visit.employees.map(id))){
  const own=pool.filter(r=>r.person===employee).sort((a,b)=>a.date.localeCompare(b.date)).slice(-5),w=own.length/(own.length+5);
  if(own.length)personal++;
  const factor=employee===id(visit.supervisor)||(visit.rx||[]).map(id).includes(employee)?.5:1;
  fields.forEach((k,i)=>cap[i]+=factor*(own.length?w*median(own.map(r=>r[k]))+(1-w)*group[i]:group[i]));
 }
 const sku=median(refs.map(r=>r.sku))*cap[0]/cap[1],dollar=median(refs.map(r=>r.dollar))*cap[0]/cap[2];
 assert.ok([...refs,...pool].every(r=>r.date<ctx.cut));
 return {sku:clamp(sku,.5,2),dollar:clamp(dollar,.5,2),rawSku:sku,rawDollar:dollar,available:true,refs:refs.length,pool:pool.length,personal,crew:visit.employees.length,latestReference:refs.at(-1).date,mode};
}
const rows=[],excluded=[];
for(const file of fs.readdirSync(dir).filter(f=>/^2026-.*\.private.json$/.test(f)).sort()){
 const {snapshot,catalog,visits}=JSON.parse(fs.readFileSync(new URL(file,dir))),ctx=prepare(snapshot.cutoff),keys=new Map(catalog.employees.map((e,i)=>[id(e.id),'p'+i]));
 for(const v of visits){
  const st=snapshot.stores.find(s=>s.key==='s'+catalog.stores.findIndex(s=>s.storeId===v.storeId));
  const countingMode=/kroger/i.test(st.name)?'modas':'default',mode=countingMode==='modas'?true:st.scenario.defaultMode;
  const p={storeKey:st.key,date:v.date,scheduleJobKey:v.id,employees:v.employees.map(i=>keys.get(id(i))),roles:{supervisor:keys.get(id(v.supervisor))||'',rx:v.rx.map(i=>keys.get(id(i))),training:[],earlyLate:[]},modes:{...DurationModel.DEFAULT_MODES,supervisor:'auto'},countingMode,notes:{},shrink:{percent:0,mode:'none',employeeIds:[]}};
  try{
   const integrated=predictPlan(snapshot,{...p,model:'integrated'}),reference=predictPlan(snapshot,{...p,model:'reference'});
   if(!integrated.mainAvailable)throw Error('Integrated model fell back');
   const f=features(ctx,v,mode),predictions={};
   for(const [model,base]of Object.entries({integrated:integrated.displayHours,reference:reference.displayHours})){
    predictions[model]=Object.fromEntries(Object.entries(candidates).map(([name,c])=>[name,base*f.sku**c.sku*f.dollar**c.dollar]));
    assert.equal(predictions[model].baseline,base);
   }
   // Poison target-week and future production: neither may alter research features.
   const poison=raw.map(r=>String(r.DateOfInv).slice(0,10)>=snapshot.cutoff?{...r,Total_Ext_Qty:1e12,Count_Record:1,Total_Ext_Price:1e15,PiecesPerHr:1e10,SkusPerHr:1,DollarPerHr:1e15,AVG_DELTA:999}:r);
   poison.push({...raw[0],DateOfInv:snapshot.cutoff,Total_Ext_Qty:1e12},{...raw[0],DateOfInv:'2099-01-01',Total_Ext_Qty:1e12});
   assert.deepEqual(features(prepare(snapshot.cutoff,poison),v,mode),f);
   // Changing the currency unit must not change the adjustment.
   const currency=features(prepare(snapshot.cutoff,raw.map(r=>({...r,Total_Ext_Price:r.Total_Ext_Price*100,DollarPerHr:r.DollarPerHr*100}))),v,mode);
   assert.ok(Math.abs(currency.dollar-f.dollar)<1e-10);
   rows.push({id:v.id,date:v.date,cutoff:snapshot.cutoff,account:v.accountKey,segment:st.scenario.segment,actual:v.crewHours,features:f,predictions});
  }catch(e){excluded.push({id:v.id,reason:e.message});}
 }
}
function score(rs,model,name){const es=rs.map(r=>60*(r.predictions[model][name]-r.actual));return {n:rs.length,maeMinutes:rs.length?mean(es.map(Math.abs)):null,within15:rs.length?es.filter(e=>Math.abs(e)<=15).length/rs.length:null,within30:rs.length?es.filter(e=>Math.abs(e)<=30).length/rs.length:null,within60:rs.length?es.filter(e=>Math.abs(e)<=60).length/rs.length:null,under60:es.filter(e=>e< -60).length};}
const metrics=rs=>Object.fromEntries(['integrated','reference'].map(m=>[m,Object.fromEntries(Object.keys(candidates).map(n=>[n,score(rs,m,n)]))]));
const dev=rows.filter(r=>r.date<policy.selectionEndExclusive),final=rows.filter(r=>r.date>=policy.selectionEndExclusive),development=metrics(dev),selected={};
for(const m of ['integrated','reference']){const b=development[m].baseline;selected[m]=Object.keys(candidates).filter(n=>development[m][n].maeMinutes<b.maeMinutes&&development[m][n].within15>b.within15&&development[m][n].under60<=b.under60).sort((a,b)=>development[m][b].within15-development[m][a].within15||development[m][a].maeMinutes-development[m][b].maeMinutes)[0]||null;}
write('selection.json',{selected,development});
const groups=rs=>Object.fromEntries([...new Set(rs.map(r=>r.account+'|'+JSON.stringify(r.segment)))].sort().map(k=>[k,metrics(rs.filter(r=>r.account+'|'+JSON.stringify(r.segment)===k))]));
const results={selected,development,final:metrics(final),developmentSegments:groups(dev),finalSegments:groups(final),featureCoverage:{development:dev.filter(r=>r.features.available).length,final:final.filter(r=>r.features.available).length,total:rows.length},excluded};
write('results.json',results);write('replay.private.json',rows);
console.log(JSON.stringify({selected,development,final:results.final,featureCoverage:results.featureCoverage,excluded},null,2));
