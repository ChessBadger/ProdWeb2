// Private compiler: reconcile production sources without duplicating visits.
import {visitModes,visitKey,exportAlias,historicalModes} from './counting-mode.mjs';
const median=a=>{const b=a.slice().sort((x,y)=>x-y);return b.length?(b[(b.length-1)>>1]+b[b.length>>1])/2:0;};
const identity=x=>String(x??'').trim().replace(/\.0+$/,'').padStart(4,'0');
const clock=x=>{const m=String(x||'').match(/(?:T)?(\d{2}):(\d{2}):(\d{2})/);return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3]):NaN;};
export function supervisorRows(rows,cut,history={jobs:[],aliases:{}},accountAliases={}){
 const canonical=a=>{a=String(a||'').trim().toLowerCase();return accountAliases[a]||(a==="mariano's"?'kroger':a);};
 const modes=visitModes(rows,cut),hm=historicalModes(rows,history,cut),byKey=new Map(),assignments=new Map(),rawSupervisors=new Map();
 const event=r=>(history.aliases[exportAlias(r)]||exportAlias(r).toLowerCase())+'|'+String(r.DateOfInv||'').slice(0,10);
 for(const r of rows){const date=String(r.DateOfInv||'').slice(0,10);if(!date||date>=cut)continue;const key=event(r),sup=identity(r.SupervisorNumber),account=canonical(r.AccountName||r.Account);if(!rawSupervisors.has(key))rawSupervisors.set(key,new Set());rawSupervisors.get(key).add(sup);assignments.set(key+'|'+sup,{id:sup,account});}
 for(const j of history.jobs||[]){if(j.date>=cut)continue;const id=identity(j.supervisor),key=j.storeId+'|'+j.date,ss=rawSupervisors.get(key);if(ss&&(ss.size!==1||!ss.has(id)))continue;
  const account=canonical(j.accountKey),detail=j.employeeDetails?.filter(e=>identity(e.id)===id)||[];assignments.set(key+'|'+id,{id,account});if(detail.length!==1)continue;const e=detail[0];if(!Number.isFinite(e.quantity)||e.quantity<0||!Number.isFinite(e.hours)||e.hours<=0||e.hours>18)continue;
  const aliases=Object.entries(history.aliases||{}).filter(([,sid])=>sid===j.storeId).map(([a])=>a.split('||')[1]);
  byKey.set(key+'|'+id,{date:j.date,id,account,store:aliases[0]||j.storeId,stores:aliases,inventoryMode:hm.get(key)??null,speed:e.quantity/e.hours,hours:e.hours,quantity:e.quantity,source:'full-visit history'});
 }
 for(const r of rows){const date=String(r.DateOfInv||'').slice(0,10),id=identity(r.Employee),sup=identity(r.SupervisorNumber),seconds=clock(r.TimeOut)-clock(r.TimeIn),q=r.Total_Ext_Qty==null?NaN:Number(r.Total_Ext_Qty),key=event(r)+'|'+id;
  if(date>=cut||!date||id!==sup||rawSupervisors.get(event(r))?.size!==1||!Number.isFinite(q)||q<0||!(seconds>0&&seconds<=64800)||byKey.has(key))continue;
  byKey.set(key,{date,id,account:canonical(r.AccountName||r.Account),store:String(r.StoreName||'').trim(),inventoryMode:modes.get(visitKey(r))??null,speed:q/(seconds/3600),hours:seconds/3600,quantity:q,source:'production export'});
 }
 const result=[...byKey.values()];result.assignments=[...assignments.values()];return result;
}
export function supervisorEstimate(rows,id,account,store,standardSpeed,inventoryMode){
 id=identity(id);account=account.trim().toLowerCase();if(account==="mariano's")account='kroger';
 const own=rows.filter(r=>r.id===id&&r.account===account),comparable=own.filter(r=>typeof inventoryMode==='boolean'&&r.inventoryMode===inventoryMode),local=comparable.filter(r=>r.store===store||r.stores?.includes(store));let selected,scope;
 if(local.length>=3){selected=local;scope='same supervisor, store and verified counting mode';}else if(comparable.length>=3){selected=comparable;scope='same supervisor, linked account and verified counting mode';}else{
  const assignments=(rows.assignments||[]).filter(r=>r.id===id&&r.account===account).length,reason=typeof inventoryMode!=='boolean'?'historical counting mode is unknown':own.length?own.length+' supervisor-production visits available; '+comparable.length+' match '+(inventoryMode?'Modas':'non-Modas')+' (3 required)':assignments?assignments+' supervisor assignments recorded; individual production unavailable':'no individual supervisor production for this account';
  return {factor:.5,count:comparable.length,scope:'50% assumption: '+reason,supported:false};
 }
 const target=median(selected.map(r=>r.speed));if(!(standardSpeed>0))return {factor:.5,count:0,scope:'50% fallback: no comparable normal rate',supported:false};
 return {factor:Math.max(0,Math.min(1,target/standardSpeed)),count:selected.length,scope:scope+'; '+selected.filter(r=>r.source==='full-visit history').length+' full-visit records',supported:true,estimatedSpeed:Math.min(standardSpeed,target)};
}
