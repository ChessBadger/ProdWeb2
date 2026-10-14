export const telemetryFields=['AVG_DELTA','GAP5_COUNT','GAP10_COUNT','GAP15_COUNT'];
export function countingMode(rows){
 const values=rows.flatMap(r=>telemetryFields.map(k=>r[k]));
 const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v));
 if(values.some(v=>numeric(v)&&Number(v)!==0))return true;
 return values.length&&values.every(v=>v===null||v===undefined||String(v).trim()===''||numeric(v)&&Number(v)===0)?false:null;
}
export const exportAlias=r=>String(r.AccountName||r.Account||'').trim()+'||'+String(r.StoreName||'').trim();
export const visitKey=r=>exportAlias(r)+'|'+String(r.DateOfInv||'').slice(0,10);
export function visitModes(rows,cut='9999-12-31'){
 const groups=new Map();for(const r of rows){if(String(r.DateOfInv||'').slice(0,10)>=cut)continue;const key=visitKey(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 return new Map([...groups].map(([key,rs])=>[key,countingMode(rs)]));
}
export function historicalModes(rows,history,cut){
 const modes=visitModes(rows,cut),grouped=new Map();
 for(const [alias,sid] of Object.entries(history.aliases||{}))for(const [key,mode] of modes){if(!key.startsWith(alias+'|'))continue;const id=sid+'|'+key.slice(-10);if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(mode);}
 return new Map([...grouped].map(([id,ms])=>[id,ms.includes(true)?true:ms.every(m=>m===false)?false:null]));
}
