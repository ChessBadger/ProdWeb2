// Candidate model: only earlier validated visits; no selected-crew input to workload.
export const VERSION='fixed-store-workload-research-v1';
export const median=xs=>{const a=xs.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?(a[(a.length-1)>>1]+a[a.length>>1])/2:0;};
const key=x=>String(x??'').padStart(4,'0');
const age=(a,b)=>Math.max(0,(Date.parse(a)-Date.parse(b))/86400000);
const weighted=(rows,value,cut,halfLife,allowZero=false)=>{const a=rows.map(r=>({v:value(r),w:2**(-age(cut,r.date)/halfLife)})).filter(r=>Number.isFinite(r.v)&&(allowZero?r.v>=0:r.v>0)).sort((a,b)=>a.v-b.v),total=a.reduce((s,r)=>s+r.w,0);let sum=0;for(const r of a){sum+=r.w;if(sum>=total/2)return r.v;}return 0;};
export function createWorkloadContext(records,cutoff,{halfLife=120,priorStrength=5,rateOverride=null,segments={}}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(cutoff))throw Error('Explicit historical cutoff required.');
 const history=records.filter(r=>r.date<cutoff).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const observations=[];
 for(const j of history)for(const e of j.employeeDetails||[]){if(!(e.hours>0&&e.hours<=18&&e.quantity>=0))continue;observations.push({date:j.date,employee:key(e.id),account:j.accountKey,type:j.typeOfInv,mode:j.inventoryMode,speed:e.quantity/e.hours,supervisor:key(e.id)===key(j.supervisor),rx:(j.rx||[]).map(key).includes(key(e.id))});}
 const cache=new Map();
 function rate(employee,account,type,mode){
  employee=key(employee);const k=JSON.stringify([employee,account,type,mode]);if(cache.has(k))return cache.get(k);
  if(rateOverride){const r=rateOverride(employee,account,mode);const value={speed:r.speed,known:r.known,count:r.known?1:0,scope:'Original predictor rates'};cache.set(k,value);return value;}
  const counters=observations.filter(r=>!r.supervisor&&!r.rx&&r.speed>0),sameAccount=counters.filter(r=>r.account===account),sameType=sameAccount.filter(r=>r.type===type),comparable=sameType.filter(r=>r.mode===mode);
  const pool=comparable.length>=5?comparable:sameType.length>=5?sameType:sameAccount.length>=5?sameAccount:counters;
  const groupMedian=weighted(pool,r=>r.speed,cutoff,halfLife)||1,own=comparable.filter(r=>r.employee===employee);
  const effectiveVisits=own.reduce((s,r)=>s+2**(-age(cutoff,r.date)/halfLife),0),personal=weighted(own,r=>r.speed,cutoff,halfLife)||groupMedian,weight=effectiveVisits/(effectiveVisits+priorStrength);
  const speed=personal*weight+groupMedian*(1-weight);
  const value={speed,known:own.length>0,count:own.length,effectiveVisits,personalWeight:weight,groupMedian,scope:pool===comparable?'account, inventory type and counting mode':pool===sameType?'account and inventory type':pool===sameAccount?'account':'all validated counters'};cache.set(k,value);return value;
 }
 function supervisor(employee,account,type,mode){
  const normal=rate(employee,account,type,mode),own=observations.filter(r=>r.employee===key(employee)&&r.supervisor&&r.account===account&&r.type===type&&r.mode===mode);
  if(own.length<3||normal.count<3)return {factor:.5,count:own.length,supported:false,scope:'50% assumption; insufficient comparable supervisor and counter evidence'};
  const effective=own.reduce((s,r)=>s+2**(-age(cutoff,r.date)/halfLife),0),observed=weighted(own,r=>r.speed,cutoff,halfLife,true)/normal.speed,weight=effective/(effective+priorStrength);
  return {factor:Math.max(0,Math.min(1,observed*weight+.5*(1-weight))),count:own.length,supported:true,scope:'Comparable output per in-store hour; not measured counting-time share'};
 }
 function prepare(storeId,account,type,mode){
  const valid=history.filter(r=>r.crewHours>0&&r.quantity>0),own=valid.filter(r=>r.storeId===storeId),typed=own.filter(r=>r.typeOfInv===type),matching=typed.filter(r=>r.inventoryMode===mode);
  // Unknown/different modes remain explicitly lower-quality evidence.
  const segment=segments[storeId],accountRefs=valid.filter(r=>r.accountKey===account&&r.typeOfInv===type&&r.inventoryMode===mode&&(!segment||segments[r.storeId]===segment));
  const refs=(matching.length?matching:typed.length?typed:own.length?own:accountRefs).slice(-5);
  if(!refs.length)return null;
  const expectedPieces=weighted(refs,r=>r.quantity,cutoff,halfLife),referenceHours=weighted(refs,r=>r.crewHours,cutoff,halfLife);
  const calibration=weighted(refs,r=>r.crewHours*r.employees.reduce((s,id)=>s+rate(id,account,type,mode).speed*(key(id)===key(r.supervisor)||(r.rx||[]).map(key).includes(key(id))?.5:1),0)/r.quantity,cutoff,halfLife);
  const workload=expectedPieces*calibration;
  const referenceCapacity=weighted(refs,r=>r.employees.reduce((s,id)=>s+rate(id,account,type,mode).speed*((key(id)===key(r.supervisor)||(r.rx||[]).map(key).includes(key(id)))?.5:1),0),cutoff,halfLife);
  // Full-visit post-count time includes the supervisor's later departure. Remove
  // that extension before estimating the crew's finishing allowance.
  const finishing=refs.filter(r=>Number.isFinite(r.postCountHours)&&r.postCountHours>=0&&Number.isFinite(r.supervisorExtensionHours)&&r.supervisorExtensionHours>=0);
  const finishingAllowanceHours=Math.min(referenceHours*.5,weighted(finishing,r=>Math.max(0,r.postCountHours-r.supervisorExtensionHours),cutoff,halfLife,true));
  return {version:VERSION,cutoff,workload,expectedPieces,calibration,referenceHours,referenceCapacity,finishingAllowanceHours,finishingEvidenceCount:finishing.length,comparableFraction:refs.filter(r=>r.typeOfInv===type&&typeof mode==='boolean'&&r.inventoryMode===mode).length/refs.length,referenceCount:refs.length,latestReference:refs.at(-1).date,quality:matching.length?'same store, type and mode':typed.length?'same store and type':own.length?'same store':'account fallback',storeId,account,type,mode};
 }
 return {history,cutoff,rate,supervisor,prepare};
}

export const RESTRAINED_VERSION='fixed-workload-restrained-v2';
export function predictRestrained(context,anchor,plan,{elasticity=.3,finishing=true,evidenceAware=false}={}){
 if(!(elasticity>0&&elasticity<=1))throw Error('Elasticity must be positive and at most one.');
 const base=predictWorkload(context,anchor,plan);if(!base)return null;
 const ids=[...new Set(plan.employees.map(key))],known=ids.filter(id=>context.rate(id,anchor.account,anchor.type,anchor.mode).known).length/ids.length;
 const effectiveElasticity=elasticity*(evidenceAware?.5+.5*known*anchor.comparableFraction:1);
 const allowance=finishing?anchor.finishingAllowanceHours:0,ratio=anchor.referenceCapacity/base.capacity;
 const hours=allowance+Math.max(0,anchor.referenceHours-allowance)*ratio**effectiveElasticity;
 return {...base,version:RESTRAINED_VERSION,hours,finishingAllowanceHours:allowance,finishingEvidenceCount:anchor.finishingEvidenceCount,referenceCapacity:anchor.referenceCapacity,effectiveElasticity,outsidePlanningRange:hours<.25||hours>18};
}
export function predictWorkload(context,anchor,plan){
 if(!anchor||anchor.cutoff!==context.cutoff)throw Error('Matching frozen workload anchor required.');
 const ids=[...new Set(plan.employees.map(key))],sup=key(plan.roles?.supervisor),rx=(plan.roles?.rx||[]).map(key),training=(plan.roles?.training||[]).map(key),factors={full:1,p70:.7,p50:.5,p30:.3,none:0};
 let capacity=0;for(const id of ids){let factor=1;if(id===sup)factor=plan.modes?.supervisor==='auto'?context.supervisor(id,anchor.account,anchor.type,anchor.mode).factor:factors[plan.modes?.supervisor||'p50'];if(rx.includes(id))factor=Math.min(factor,factors[plan.modes?.rx||'p50']);if(training.includes(id))factor=Math.min(factor,factors[plan.modes?.training||'p70']);capacity+=context.rate(id,anchor.account,anchor.type,anchor.mode).speed*factor;}
 if(!(capacity>0))return null;
 return {hours:anchor.workload/capacity,capacity,workload:anchor.workload,expectedPieces:anchor.expectedPieces,quality:anchor.quality};
}
