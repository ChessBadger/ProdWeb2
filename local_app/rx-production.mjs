// Derived Rx output ratios from the export only. No unverified full-visit quantities.
import {visitModes,visitKey,exportAlias} from './counting-mode.mjs';
const id=x=>String(x??'').trim().replace(/\.0+$/,'').padStart(4,'0');
const median=a=>{a=[...a].sort((x,y)=>x-y);return a.length?(a[(a.length-1)>>1]+a[a.length>>1])/2:null;};
const rx=x=>x===true||x===1||/^(true|yes|1)$/i.test(String(x));
const monday=date=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const hours=r=>{const clock=x=>{const m=String(x||'').match(/(\d{2}):(\d{2}):(\d{2})/);return m?+m[1]+m[2]/60+m[3]/3600:NaN;};const h=clock(r.TimeOut)-clock(r.TimeIn);return h>0&&h<=18?h:null;};
export function rxHistory(input,cutoff,aliases={}){
 const canonical=a=>aliases[a.trim().toLowerCase()]||(a.toLowerCase()==="mariano's"?'kroger':a.toLowerCase());
 const raw=input.filter(r=>String(r.DateOfInv||'').slice(0,10)<cutoff),modes=visitModes(raw,cutoff);
 const rows=raw.map(r=>({date:String(r.DateOfInv).slice(0,10),key:visitKey(r),store:exportAlias(r),account:canonical(String(r.AccountName||r.Account||'')),mode:modes.get(visitKey(r)),id:id(r.Employee),supervisor:id(r.Employee)===id(r.SupervisorNumber),rx:rx(r.Rx),hours:hours(r),quantity:r.Total_Ext_Qty==null?NaN:Number(r.Total_Ext_Qty)}));
 const valid=r=>r.hours>0&&Number.isFinite(r.quantity)&&r.quantity>=0;
 const counters=rows.filter(r=>valid(r)&&!r.supervisor&&!r.rx&&r.quantity>0),groups=new Map();
 for(const r of rows.filter(r=>r.rx)){if(!groups.has(r.key))groups.set(r.key,[]);groups.get(r.key).push(r);}
 const observations=[];let rejected=0;
 for(const rs of groups.values()){
  // Require every recorded Rx assignee, so partial exports do not bias a visit's ratio.
  if(rs.some(r=>!valid(r)||r.supervisor||typeof r.mode!=='boolean')||new Set(rs.map(r=>r.id)).size!==rs.length){rejected++;continue;}
  let expected=0,actual=0,ok=true;
  for(const r of rs){const prior=counters.filter(c=>c.date<monday(r.date)&&c.id===r.id&&c.account===r.account&&c.mode===r.mode).sort((a,b)=>a.date.localeCompare(b.date)).slice(-5);if(prior.length<3){ok=false;break;}expected+=median(prior.map(c=>c.quantity/c.hours))*r.hours;actual+=r.quantity;}
  if(!ok||!(expected>0)){rejected++;continue;}
  const first=rs[0];observations.push({date:first.date,store:first.store,account:first.account,mode:first.mode,ratio:Math.max(0,Math.min(1,actual/expected)),workers:rs.length});
 }
 return {observations,rejected,invalidVisits:[...groups].filter(([,rs])=>rs.some(r=>!valid(r)||r.supervisor||typeof r.mode!=='boolean')||new Set(rs.map(r=>r.id)).size!==rs.length).map(([key])=>key),people:rows.filter(r=>valid(r)&&r.rx&&!r.supervisor&&typeof r.mode==='boolean').map(r=>({...r,speed:r.quantity/r.hours}))};
}
// Personal account/segment Rx rates already include the usual Rx reduction.
// Store weight is therefore observed / expected Rx output, not a second full Rx penalty.
export function rxLayerEstimator(history,segments={}){
 const cache=new Map(),pools=new Map();
 function base(employee,account,mode,segment,before,excludeStore=''){
  const key=JSON.stringify([employee,account,mode,segment,before,excludeStore]);if(cache.has(key))return cache.get(key);
  const poolKey=JSON.stringify([account,mode,segment,before,excludeStore]);
  if(!pools.has(poolKey)){const all=(history.people||[]).filter(r=>r.date<before&&r.account===account&&r.mode===mode&&r.store!==excludeStore).sort((a,b)=>a.date.localeCompare(b.date)),seg=segment?all.filter(r=>segments[r.store]===segment):[];pools.set(poolKey,{pool:(seg.length>=5?seg:all).slice(-100),segmented:seg.length>=5});}
  const {pool,segmented}=pools.get(poolKey),own=pool.filter(r=>r.id===id(employee)).slice(-10);
  const group=pool.length>=5?median(pool.map(r=>r.speed)):null,personal=own.length?median(own.map(r=>r.speed)):null,w=own.length/(own.length+5);
  const speed=group!==null?(personal===null?group:w*personal+(1-w)*group):own.length>=3?personal:null;
  const value={speed,count:own.length,poolCount:pool.length,basis:segmented?'account/segment':'account'};cache.set(key,value);return value;
 }
 const groups=new Map();for(const r of history.people||[]){if(!groups.has(r.key))groups.set(r.key,[]);groups.get(r.key).push(r);}
 const residuals=[];
 for(const rs of groups.values()){
  if(history.invalidVisits?.includes(rs[0].key)||new Set(rs.map(r=>r.id)).size!==rs.length)continue;
  let expected=0,actual=0,valid=true;
  for(const r of rs){const b=base(r.id,r.account,r.mode,null,monday(r.date),r.store);if(!(b.speed>0)){valid=false;break;}expected+=b.speed*r.hours;actual+=r.quantity;}
  if(valid&&expected>0)residuals.push({store:rs[0].store,mode:rs[0].mode,date:rs[0].date,weight:Math.max(.25,Math.min(2,actual/expected))});
 }
 return function estimate(employee,store,account,mode,normalSpeed,cutoff){
  const segment=segments[store],b=base(employee,account,mode,segment,cutoff,store),local=residuals.filter(r=>r.store===store&&r.mode===mode&&r.date<cutoff).sort((a,b)=>a.date.localeCompare(b.date)).slice(-5);
  if(b.speed===null||!(normalSpeed>0))return {factor:.5,count:0,supported:false,scope:'50% assumption: insufficient comparable account Rx production'};
  const observed=local.length?median(local.map(r=>r.weight)):1,w=local.length/(local.length+3),storeWeight=1+(observed-1)*w;
  return {factor:Math.max(0,Math.min(1,b.speed*storeWeight/normalSpeed)),count:b.count,storeCount:local.length,poolCount:b.poolCount,baseSpeed:b.speed,storeWeight,supported:true,scope:(b.count?'Personal Rx history blended with ':'Comparable group Rx rate from ')+b.basis+' ('+b.count+' personal / '+b.poolCount+' group rows); '+(local.length?'store adjustment '+storeWeight.toFixed(2)+'× from '+local.length+' earlier visits':'neutral store adjustment (no usable earlier store comparison)')};
 };
}
export function rxEstimate(history,store,account,mode){
 account=account.toLowerCase();if(account==="mariano's")account='kroger';
 const comparable=history.observations.filter(r=>r.account===account&&typeof mode==='boolean'&&r.mode===mode).sort((a,b)=>a.date.localeCompare(b.date));
 const local=comparable.filter(r=>r.store===store).slice(-5),other=comparable.filter(r=>r.store!==store).slice(-30);
 // Without store evidence, preserve the 50% planning assumption; pharmacy sizes differ.
 if(!local.length)return {factor:.5,count:0,supported:false,scope:'50% assumption: no usable same-store Rx visits with prior normal-counting history'};
 const prior=other.length>=5?median(other.map(r=>r.ratio)):.5,weight=local.length/(local.length+3),factor=median(local.map(r=>r.ratio))*weight+prior*(1-weight);
 return {factor,referenceWorkers:median(local.map(r=>r.workers)),count:local.length,supported:true,scope:'Same-store Rx output versus prior normal counting; '+local.length+' visits, blended with '+(other.length>=5?'comparable account Rx history':'50% assumption')};
}
