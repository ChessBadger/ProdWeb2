import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
const input=JSON.parse(fs.readFileSync(0,'utf8'));const read=f=>f.includes('FullAttendanceHistory')?input.data:f.includes('paired-development')?[{storeId:input.plan.storeId,date:input.plan.date,cutoff:input.plan.historyCutoff}]:f.includes('accepted_job_record')?input.records:input.meta;
const data=read('website_model_work/FullAttendanceHistory.json'),paired=read('incumbent_feature_audit/expanded_training/paired-development-records.json'),recordFeatures=read('production_coverage_audit/accepted_job_record_features.json'),meta=read('incumbent_feature_audit/historical_job_metadata.json');
const salvage=input.salvage;
const extraRates=input.extraRates;
const source=fs.readFileSync(new URL('../public/durationmodel.js',import.meta.url),'utf8');
const c=vm.createContext({});vm.runInContext(source.replace('Boolean(plan.useRecentAccountProduction));','Boolean(plan.useRecentAccountProduction), plan);'),c);const M=c.DurationModel;
const median=a=>quantile(a,.5),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));function quantile(a,p){a=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return 0;const i=(a.length-1)*p,lo=Math.floor(i);return a[lo]+(a[Math.ceil(i)]-a[lo])*(i-lo);}
const metadata=new Map();for(const j of meta.jobs){const store=data.aliases[j.storeKey];if(!store)continue;const key=store+'|'+j.date;if(!metadata.has(key))metadata.set(key,[]);metadata.get(key).push(j);}
const jobs=data.jobs.map(j=>{const ms=metadata.get(j.id)||[];const types=[...new Set(ms.map(x=>x.typeOfInv))],modes=[...new Set(ms.map(x=>x.inventoryMode))];const counter=j.employeeDetails.filter(e=>e.id!==j.supervisor&&e.hours>0);const proxy=counter.length?quantile(counter.map(e=>e.hours),.75):j.duration;return {...j,storeKey:j.storeId,typeOfInv:types.length===1?types[0]:'Unknown',inventoryMode:modes.length===1?modes[0]:null,supervisorNumber:j.supervisor,rxEmployees:j.rx,employeeDetails:j.employeeDetails.map(e=>({...e,employee:e.id,pieces:e.quantity,inStoreHours:e.hours,records:recordFeatures[j.id].employeeRecords[e.id]??0})),counterProxy:proxy,tail:j.duration-proxy};});
const lookup=new Map(jobs.map(j=>[j.id,j]));
const configs=[];for(const baseline of ['last','recent3','median3','recent5','median5'])for(const elasticity of [0,.15,.3,.5])configs.push({baseline,elasticity,evidenceAware:true});
const families=['full_incumbent_pooled','hierarchical_pieces','hierarchical_records','hierarchical_pieces_seasonal','hierarchical_records_seasonal','hierarchical_counter_tail'];
const contexts=new Map();const role=(id,j)=>id===(j.supervisorNumber??j.roles?.supervisor)?'S':(j.rxEmployees??j.roles?.rx??[]).includes(id)?'R':'C';const mode=j=>j.inventoryMode===true?'M':j.inventoryMode===false?'N':'U';
function buildContext(cut){
 const hist=jobs.filter(j=>j.date<cut),history=M.createHistory(hist);const rows=[];
 for(const j of hist)for(const e of j.employeeDetails)if(e.hours>0)rows.push({date:j.date,account:j.accountKey,employee:e.id,role:role(e.id,j),mode:mode(j),hours:e.hours,pieces:e.quantity,records:e.records});
 for(const e of salvage)if(e.date<cut)rows.push({date:e.date,account:e.accountKey||'unmapped-store:'+e.storeId,employee:e.employee,role:e.supervisor?'S':e.rx?'R':'C',mode:'U',hours:e.physicalHours,pieces:e.quantity,records:e.records??null});
 for(const e of extraRates)if(e.date<cut)rows.push({date:e.date,account:e.accountKey||'unmapped-export:'+e.globalSkillGroup,employee:e.employee,role:e.supervisor?'S':e.rx?'R':'C',mode:mode(e),hours:e.physicalHours,pieces:e.quantity,records:e.records??null});
 const rateCache={};for(const metric of ['pieces','records']){
  const valid=rows.filter(r=>Number.isFinite(r[metric]));const grouped=new Map(),skills=new Map(),local=new Map();
  for(const r of valid){r.weight=Math.pow(.5,(Date.parse(cut)-Date.parse(r.date))/86400000/120);const k=r.account+'|'+r.role;if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(r);}
  const bases=new Map([...grouped].map(([k,rs])=>[k,median(rs.map(r=>r[metric]/r.hours))||1]));
  function add(map,key,value,weight){const a=map.get(key)||{sum:0,w:0,n:0};a.sum+=value*weight;a.w+=weight;a.n++;map.set(key,a);}
  for(const r of valid){const base=bases.get(r.account+'|'+r.role),speed=clamp(r[metric]/r.hours,0,base*4);add(skills,r.employee+'|'+r.role,clamp(speed/base,.05,4),r.weight*r.hours);add(local,r.employee+'|'+r.account+'|'+r.role,speed,r.weight*r.hours);add(local,r.employee+'|'+r.account+'|'+r.role+'|'+r.mode,speed,r.weight*r.hours);}
  rateCache[metric]={bases,skills,local};
 }
 const pooled=new Map();for(const j of hist)for(const e of j.employeeDetails)if(e.hours>0&&e.quantity>0){const k=e.id+'|'+j.accountKey;if(!pooled.has(k))pooled.set(k,[]);pooled.get(k).push(e.quantity/e.hours);}
 return {hist,history,rateCache,pooled};
}
function resolver(ctx,metric,pooled=false){return (id,account,inventoryMode,recent,plan)=>{
 if(pooled){const xs=ctx.pooled.get(id+'|'+account)||[],all=[...ctx.pooled].filter(([k])=>k.endsWith('|'+account)).map(([,v])=>median(v));return {speed:median(xs)||median(all)||1,known:xs.length>0,evidence:xs.length/(xs.length+3)};}
 const r=role(id,plan),cache=ctx.rateCache[metric];const baseline=cache.bases.get(account+'|'+r)||cache.bases.get(account+'|C')||median([...cache.bases.values()])||1;
 const skill=cache.skills.get(id+'|'+r),skillValue=skill?(skill.sum/skill.w*skill.n+5)/(skill.n+5):1;
 const all=cache.local.get(id+'|'+account+'|'+r),specific=cache.local.get(id+'|'+account+'|'+r+'|'+mode({inventoryMode}));const evidence=specific?.n>=3?specific:all;const prior=baseline*clamp(skillValue,.25,4);const speed=evidence?(evidence.sum/evidence.w*evidence.n+prior*3)/(evidence.n+3):prior;
 // Rates are conditioned on observed role. Undo fixed roleFactor here so it is not applied twice.
 const factor=r==='C'?1:.5;return {speed:speed/factor,known:!!(evidence||skill),evidence:evidence?evidence.n/(evidence.n+3):(skill?skill.n/(2*(skill.n+5)):0)};
 };}
function seasonalHistory(ctx,j,date){const own=ctx.history.stores.get(j.storeId)||[],p=d=>Number(d.slice(5,7))%3,match=own.filter(h=>p(h.date)===p(date)),other=own.filter(h=>p(h.date)!==p(date)),a=median(match.map(h=>h.quantity)),b=median(other.map(h=>h.quantity));if(match.length<2||other.length<4||!(a>0&&b>0)||Math.max(a/b,b/a)<1.5)return ctx.history;const stores=new Map(ctx.history.stores);stores.set(j.storeId,match);return {...ctx.history,stores};}

const seasonalContext=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('./seed/seasonal.js',import.meta.url),'utf8'),seasonalContext);const seasonalContexts=new Map();
const features=[];
for(const r of paired){const j=lookup.get(r.storeId+'|'+r.date);if(!contexts.has(r.cutoff))contexts.set(r.cutoff,buildContext(r.cutoff));const ctx=contexts.get(r.cutoff),prior=[...(ctx.history.stores.get(j.storeId)||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];const plan={date:r.date,historyCutoff:r.cutoff,storeKey:j.storeId,accountKey:j.accountKey,typeOfInv:prior?.typeOfInv||'Unknown',inventoryMode:prior?.inventoryMode??null,employees:j.employees,roles:{supervisor:j.supervisor,rx:j.rx}};
 const sh=seasonalHistory(ctx,j,r.date);const own=sh.stores.get(j.storeId)||[];const refs=[...(own.length?own:ctx.history.accounts.get(j.accountKey)||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,own.length?5:20);
 const participation=new Map(),rolePresence=new Map(),experience=new Map();
 for(const h of ctx.hist)if(h.accountKey===j.accountKey)for(const e of h.employeeDetails){const rk=role(e.id,h),key=e.id+'|'+rk;if(!participation.has(key))participation.set(key,[]);participation.get(key).push(e.hours/h.duration);if(!rolePresence.has(rk))rolePresence.set(rk,[]);rolePresence.get(rk).push(e.hours/h.duration);experience.set(e.id,(experience.get(e.id)||0)+1);}
 if(!seasonalContexts.has(r.cutoff))seasonalContexts.set(r.cutoff,seasonalContext.FullOnsiteModel.context(data,r.cutoff));const seasonalPrediction=seasonalContext.FullOnsiteModel.predict(data,{...plan,storeId:j.storeId},{elasticity:.3},seasonalContexts.get(r.cutoff)).onSiteDuration;const out={storeId:r.storeId,date:r.date,cutoff:r.cutoff,seasonal_base:seasonalPrediction};
 for(const metric of ['pieces','records']){
  const rate=resolver(ctx,metric),amount=h=>metric==='pieces'?h.quantity:recordFeatures[h.id].totalAttributedRecords;const expected=median(refs.map(amount));let capacity=0,visitCapacity=0,known=0;const speeds=[];
  for(const e of j.employees){const q=rate(e,j.accountKey,plan.inventoryMode,false,plan);const rk=role(e,plan),factor=rk==='C'?1:.5;const speed=q.speed*factor;const ps=participation.get(e+'|'+rk)||[],priorPresence=median(rolePresence.get(rk)||[])||1;const presence=clamp((ps.reduce((a,b)=>a+b,0)+priorPresence*3)/(ps.length+3),.1,1);capacity+=speed;visitCapacity+=speed*presence;known+=q.known?1:0;speeds.push(speed);}
  out[metric+'_throughput_hours']=clamp(expected/Math.max(capacity,1),0,18);out[metric+'_presence_adjusted_hours']=clamp(expected/Math.max(visitCapacity,1),0,18);out[metric+'_known_fraction']=known/j.employees.length;out[metric+'_speed_imbalance']=Math.max(...speeds)/Math.max(capacity,1);out['log_expected_'+metric]=Math.log1p(expected);
 }
 out.prior_presence_fraction=median(refs.map(h=>h.employeeDetails.reduce((s,e)=>s+e.hours,0)/(h.employees.length*h.duration)));out.prior_units_per_record=Math.log1p(median(refs.map(h=>h.quantity/Math.max(recordFeatures[h.id].totalAttributedRecords,1))));out.crew_account_experience=median(j.employees.map(e=>Math.log1p(experience.get(e)||0)));out.unseen_account_fraction=j.employees.filter(e=>!experience.has(e)).length/j.employees.length;out.prior_supervisor_fraction=median(refs.map(h=>{const e=h.employeeDetails.find(x=>x.id===h.supervisor);return e?e.quantity/Math.max(h.quantity,1):0;}));features.push(out);
}

const plain=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('./seed/baseline.js',import.meta.url),'utf8'),plain);
const p=input.plan;const base=plain.FullOnsiteModel.predict(data,{...p,roles:p.roles},{elasticity:.3});
const {createPlannerContext,initializeData}=await import('../scripts/planner-context.mjs');const pc=createPlannerContext();initializeData(pc,JSON.stringify(input.exportHistory));
pc.p=p;pc.config=input.analytics.durationAnalytics;
const incumbent=vm.runInContext(`(()=>{const canonical=new Map(Array.from(state.employees.keys()).map(x=>[String(x).padStart(4,'0'),x]));const id=x=>canonical.get(String(x).padStart(4,'0'))||String(Number(x));const history=DurationModel.createHistory(state.jobs.filter(j=>j.date<p.historyCutoff));const prior=[...(history.stores.get(p.storeKey)||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];const plan={...p,typeOfInv:prior?.typeOfInv||'Unknown',inventoryMode:prior?.inventoryMode??null,employees:p.employees.map(id),roles:{supervisor:p.roles.supervisor?id(p.roles.supervisor):'',rx:p.roles.rx.map(id),training:[],earlyLate:[]},modes:{supervisor:'p50',rx:'p50'}};const context=buildDurationEmployeeContext(state.rows.filter(r=>r.date<p.historyCutoff));context.asOfDate=p.historyCutoff;return DurationModel.predict(history,plan,durationRateResolver(context),config?.byAccount?.[p.accountKey]||config?.config||{baseline:'median5',elasticity:.3});})()`,pc);
process.stdout.write(JSON.stringify({rich:features[0],base:base?.onSiteDuration,incumbent:incumbent?.onSiteDuration,incumbentDetails:incumbent?{confidenceLow:incumbent.confidenceLow,confidenceHigh:incumbent.confidenceHigh}:null}));
