// Update only derived supervisor coefficients in an existing approved snapshot.
import fs from 'node:fs';
import {supervisorRows,supervisorEstimate} from '../supervisor-production.mjs';
const [inputFile,snapshotFile,outputFile]=process.argv.slice(2);
const input=JSON.parse(fs.readFileSync(inputFile)),snapshot=JSON.parse(fs.readFileSync(snapshotFile));
if(!input.history)throw Error('Full historical production is required; use the weekly compiler to reconcile all sources.');
const rows=supervisorRows(input.rows,snapshot.cutoff,input.history,input.accountAliases||{});
for(const store of snapshot.stores){
 const entry=input.catalog.stores[Number(store.key.slice(1))];
 if(entry.name!==store.name)throw Error('Store identity mismatch');
 for(const pack of Object.values(store.scenario.variants)){
  if(!pack)continue;
  pack.supervisorEstimates=Object.fromEntries([['standard','rates'],['recent','recentRates']].map(([label,field])=>[label,Object.fromEntries(snapshot.persons.map(person=>{
   const original=input.catalog.employees[Number(person.key.slice(1))];
   if(original.name!==person.name||!original.active)throw Error('Employee identity mismatch');
   const e=supervisorEstimate(rows,original.id,entry.accountKey,entry.alias.split('||')[1],snapshot.scenarioRates[pack[field]][person.key][0],pack.inventoryMode,pack.typeOfInv);
   return [person.key,[e.factor,e.count,e.scope,e.supported]];
  }))]));
 }
}
fs.writeFileSync(outputFile,JSON.stringify(snapshot));
console.log('Updated comparable supervisor coefficients; retained existing model, roster, clocks and rates.');
