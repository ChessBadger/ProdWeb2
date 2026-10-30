// Local-only curator. No raw employee identifiers, dates or source rows leave this helper.
const id=x=>String(x??'').trim().padStart(4,'0'),clean=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''),number=x=>x===null||x===undefined||String(x).trim()===''?null:Number.isFinite(Number(x))?Number(x):null;
const day=x=>{const s=String(x||''),iso=s.match(/^(\d{4}-\d{2}-\d{2})/),us=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);return iso?.[1]||(us?us[3]+'-'+us[1].padStart(2,'0')+'-'+us[2].padStart(2,'0'):'');};
export function recordedClock(value){
 if(value===null||value===undefined||String(value).trim()==='')return null;
 const s=String(value).trim().replace(/^\d{4}-\d{2}-\d{2}[T ]/,''),m=s.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?$/i);if(!m)return null;
 let h=Number(m[1]);const minute=Number(m[2]),second=Number(m[3]||0);if(minute>59||second>59||h>23||m[4]&&(h<1||h>12))return null;if(m[4])h=h%12+(/pm/i.test(m[4])?12:0);
 return String(h).padStart(2,'0')+':'+m[2]+(second?':'+String(second).padStart(2,'0'):'');
}
export function curateLastCrew(raw,alias,inventoryDate,_inventoryType,members,catalog,keys){
 // TypeOfInv is a mutable account setting, not evidence of a different visit.
 const people=new Map(catalog.map(p=>[id(p.id),p])),rows=raw.filter(r=>(String(r.AccountName||r.Account||'').trim()+'||'+String(r.StoreName||'').trim())===alias&&day(r.DateOfInv)===inventoryDate);
 return members.map(id).filter(e=>people.has(e)).map(e=>{const base={key:keys[e],piecesPerHr:null,inStoreHours:null,pieces:null,recordedIn:null,recordedOut:null,support:'missing'},candidates=rows.filter(r=>id(r.Employee)===e),unique=new Map(candidates.map(r=>[JSON.stringify([r.Total_Ext_Qty,r.Expr1,r.PiecesPerHr,r.TimeIn,r.TimeOut,r.FirstName,r.LastName]),r]));
  if(unique.size>1)return {...base,support:'ambiguous'};
  if(unique.size!==1)return base;const r=[...unique.values()][0];if(clean([r.FirstName,r.LastName].filter(Boolean).join(' '))!==clean(people.get(e).name))return {...base,support:'unconfirmed'};
  const pieces=number(r.Total_Ext_Qty),hours=number(r.Expr1),reported=number(r.PiecesPerHr),rate=pieces!==null&&pieces>=0&&hours!==null&&hours>0?pieces/hours:reported!==null&&reported>=0?reported:null;
  return {...base,pieces:pieces!==null&&pieces>=0?pieces:null,inStoreHours:hours!==null&&hours>=0?hours:null,piecesPerHr:rate,recordedIn:recordedClock(r.TimeIn),recordedOut:recordedClock(r.TimeOut),support:'recorded'};
 });
}
