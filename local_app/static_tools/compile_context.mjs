import {historicalModes,visitModes} from '../counting-mode.mjs';
import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
const input=JSON.parse(fs.readFileSync(0,'utf8'));const read=f=>f.includes('FullAttendanceHistory')?input.data:f.includes('paired-development')?[{storeId:input.plan.storeId,date:input.plan.date,cutoff:input.plan.historyCutoff}]:f.includes('accepted_job_record')?input.records:input.meta;
const data=read('website_model_work/FullAttendanceHistory.json'),paired=read('incumbent_feature_audit/expanded_training/paired-development-records.json'),recordFeatures=read('production_coverage_audit/accepted_job_record_features.json'),meta=read('incumbent_feature_audit/historical_job_metadata.json');
const verifiedModes=historicalModes(input.exportHistory.EmployeeProductionHistory,data,input.cutoff);
const exportModes=visitModes(input.exportHistory.EmployeeProductionHistory,input.cutoff);
const salvage=input.salvage;
const extraRates=input.extraRates.map(r=>({...r,inventoryMode:verifiedModes.get(r.storeId+'|'+r.date)??exportModes.get(r.storeAlias+'|'+r.date)??null}));
const source=fs.readFileSync(new URL('../../public/durationmodel.js',import.meta.url),'utf8');
const c=vm.createContext({});vm.runInContext(source.replace('Boolean(plan.useRecentAccountProduction));','Boolean(plan.useRecentAccountProduction), plan);'),c);const M=c.DurationModel;
const median=a=>quantile(a,.5),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));function quantile(a,p){a=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return 0;const i=(a.length-1)*p,lo=Math.floor(i);return a[lo]+(a[Math.ceil(i)]-a[lo])*(i-lo);}
const metadata=new Map();for(const j of meta.jobs){const store=data.aliases[j.storeKey];if(!store)continue;const key=store+'|'+j.date;if(!metadata.has(key))metadata.set(key,[]);metadata.get(key).push(j);}
const jobs=data.jobs.map(j=>{const ms=metadata.get(j.id)||[];const types=[...new Set(ms.map(x=>x.typeOfInv))],modes=[...new Set(ms.map(x=>x.inventoryMode))];const counter=j.employeeDetails.filter(e=>e.id!==j.supervisor&&e.hours>0);const proxy=counter.length?quantile(counter.map(e=>e.hours),.75):j.duration;return {...j,storeKey:j.storeId,typeOfInv:types.length===1?types[0]:'Unknown',inventoryMode:verifiedModes.get(j.id)??null,supervisorNumber:j.supervisor,rxEmployees:j.rx,employeeDetails:j.employeeDetails.map(e=>({...e,employee:e.id,pieces:e.quantity,inStoreHours:e.hours,records:recordFeatures[j.id].employeeRecords[e.id]??0})),counterProxy:proxy,tail:j.duration-proxy};});
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

const cut=input.cutoff,ctx=buildContext(cut),ids=input.catalog.employees.map(e=>e.id),keys=Object.fromEntries(ids.map((id,i)=>[id,'p'+i]));
const phys=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../seed/baseline.js',import.meta.url),'utf8'),phys);const seas=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../seed/seasonal.js',import.meta.url),'utf8'),seas);const bc=phys.FullOnsiteModel.context(data,cut),sc=seas.FullOnsiteModel.context(data,cut);
const {createPlannerContext,initializeData}=await import('../../scripts/planner-context.mjs');const pc=createPlannerContext();initializeData(pc,JSON.stringify(input.exportHistory));pc.cut=cut;pc.ids=ids;
vm.runInContext(`const canonical=new Map(Array.from(state.employees.keys()).map(x=>[String(x).padStart(4,'0'),x]));const canon=x=>canonical.get(String(x).padStart(4,'0'))||String(Number(x));const hist=DurationModel.createHistory(state.jobs.filter(j=>j.date<cut));const ec=buildDurationEmployeeContext(state.rows.filter(r=>r.date<cut));ec.asOfDate=cut;const rate=durationRateResolver(ec);`,pc);
const accountPacks={},storePacks={};
for(const entry of input.catalog.stores){
 const sid=entry.storeId,acct=entry.accountKey;if(!sid||!ctx.hist.some(j=>j.accountKey===acct)){storePacks[entry.alias]=null;continue;}
 const prior=[...(ctx.history.stores.get(sid)||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];const im=prior?.inventoryMode??null;
 const ak=acct+'|'+mode({inventoryMode:im});
 if(!accountPacks[ak]){
  const participation=new Map(),rolePresence=new Map(),experience=new Map();for(const h of ctx.hist)if(h.accountKey===acct)for(const e of h.employeeDetails){const rk=role(e.id,h),k=e.id+'|'+rk;if(!participation.has(k))participation.set(k,[]);participation.get(k).push(e.hours/h.duration);if(!rolePresence.has(rk))rolePresence.set(rk,[]);rolePresence.get(rk).push(e.hours/h.duration);experience.set(e.id,(experience.get(e.id)||0)+1);}
  const fallback=median([...bc.rates].filter(([k])=>k.startsWith(acct+'|')).map(([,v])=>median(v)))||1;
  const people={};for(const id of ids){const rows={};for(const rk of ['C','S','R']){const plan={roles:{supervisor:rk==='S'?id:'',rx:rk==='R'?[id]:[]}};const ps=participation.get(id+'|'+rk)||[],presence=clamp((ps.reduce((a,b)=>a+b,0)+(median(rolePresence.get(rk)||[])||1)*3)/(ps.length+3),.1,1);rows[rk]=['pieces','records'].map(metric=>{const r=resolver(ctx,metric)(id,acct,im,false,plan);return [r.speed*(rk==='C'?1:.5),presence,!!r.known]});}people[keys[id]]={physicalSpeed:clamp(median(bc.rates.get(acct+'|'+id)||[])||fallback,fallback*.25,fallback*4),experience:experience.get(id)||0,roles:rows};}
  accountPacks[ak]={people};
 }
 pc.entry=entry;pc.config=input.analytics.durationAnalytics;
 const inc=vm.runInContext(`(()=>{const prior=[...(hist.stores.get(entry.alias)||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];const p={date:cut,historyCutoff:cut,storeKey:entry.alias,accountKey:entry.accountKey,typeOfInv:prior?.typeOfInv||'Unknown',inventoryMode:prior?.inventoryMode??null,employees:ids.map(canon),roles:{supervisor:'',rx:[]}};const select=jobs=>(jobs||[]).filter(j=>j.date<cut).sort((a,b)=>b.date.localeCompare(a.date)||a.storeKey.localeCompare(b.storeKey));const own=select(hist.stores.get(p.storeKey));const typed=own,match=typed.filter(j=>j.inventoryMode===p.inventoryMode);let refs=(match.length?match:typed.length?typed:own).slice(0,5);const has=refs.length>0;if(!has){const a=select(hist.accounts.get(p.accountKey)),t=a,m=t.filter(j=>j.inventoryMode===p.inventoryMode);refs=(m.length?m:t.length?t:a).slice(0,20);if(!refs.length)refs=select(hist.all).slice(0,30);}if(!refs.length)return null;const rates=Object.fromEntries(ids.map(id=>[id,rate(canon(id),p.accountKey,p.inventoryMode,false)]));const kernels=refs.map(j=>{const rp=DurationModel.historicalPlan(j),sr=j.employeeDetails?.find(e=>e.employee===rp.roles.supervisor);const eligible=rp.employees.includes(rp.roles.supervisor)&&(!j.employeeDetails||(sr?.pieces>0&&sr?.inStoreHours>0));const profile=include=>{const r=DurationModel.crewProfile(rp,rate,include);return {speed:r.speed,known:r.knownShare,evidence:r.evidenceShare,members:r.ids.map(id=>String(id).padStart(4,'0'))}};return {duration:j.duration,weightAgeDays:Math.max(0,(Date.parse(cut)-Date.parse(j.date))/86400000),compatible:typeof j.inventoryMode==='boolean'&&j.inventoryMode===p.inventoryMode,eligible,full:profile(true),counter:profile(false)}});return {rates,kernels,hasStoreHistory:has,config:config?.byAccount?.[p.accountKey]||config?.config||{baseline:'median5',elasticity:.3}};})()`,pc);
 if(inc){inc.rates=Object.fromEntries(Object.entries(inc.rates).map(([id,r])=>[keys[id],[r.speed,!!r.known,r.evidence]]));for(const k of inc.kernels){for(const f of ['full','counter'])k[f].members=k[f].members.map(id=>keys[id]).filter(Boolean);k.ageWeight=inc.config.ageHalfLife>0?Math.pow(.5,k.weightAgeDays/inc.config.ageHalfLife):1;delete k.weightAgeDays;}}
 const phases={};for(let phase=0;phase<3;phase++){
  const date='2027-'+String(phase===0?3:phase).padStart(2,'0')+'-01',plan={date,historyCutoff:cut,storeKey:sid,storeId:sid,accountKey:acct,employees:[ids[0]],roles:{supervisor:'',rx:[]}};
  const kernel=r=>r?{base:r.baseDuration,reference:r.features.referenceCapacity,overhead:r.features.overhead}:null;
  const sh=seasonalHistory(ctx,{storeId:sid},date),own=sh.stores.get(sid)||[],refs=[...(own.length?own:ctx.history.accounts.get(acct)||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,own.length?5:20);
  phases[phase]={plain:kernel(phys.FullOnsiteModel.predict(data,plan,{elasticity:.3},bc)),seasonal:kernel(seas.FullOnsiteModel.predict(data,plan,{elasticity:.3},sc)),rich:{pieces:median(refs.map(h=>h.quantity)),records:median(refs.map(h=>recordFeatures[h.id].totalAttributedRecords)),presence:median(refs.map(h=>h.employeeDetails.reduce((s,e)=>s+e.hours,0)/(h.employees.length*h.duration))),units:Math.log1p(median(refs.map(h=>h.quantity/Math.max(recordFeatures[h.id].totalAttributedRecords,1)))),supervisorFraction:median(refs.map(h=>{const e=h.employeeDetails.find(e=>e.id===h.supervisor);return e?e.quantity/Math.max(h.quantity,1):0;}))}};
 }
 storePacks[entry.alias]={account:ak,incumbent:inc,phases};
}
process.stdout.write(JSON.stringify({accounts:accountPacks,stores:storePacks}));
