import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {weeklyDataStatus} from '../static_source/app.mjs';
import {predictPlan,migrateDraft} from '../static_source/planner.mjs';
const root=new URL('../../pages_export/',import.meta.url),release=JSON.parse(fs.readFileSync(new URL('release.json',root))),bytes=fs.readFileSync(new URL(release.files.planning.path,root)),s=JSON.parse(release.files.planning.path.endsWith('.gz')?gunzipSync(bytes):bytes);
const dates=['2026-10-22','2026-11-01','2026-12-01'];let checks=0;
for(const date of dates){assert.equal(weeklyDataStatus(s,new Date(date+'T12:00:00')).valid,true);assert.equal(weeklyDataStatus(s).message,'Last updated: '+s.cutoff);
 for(const store of s.stores){const rates=s.scenarioRates[store.scenario.variants.default.rates],ids=s.persons.map(p=>p.key).sort((a,b)=>rates[b][0]-rates[a][0]).slice(0,12);
  for(const model of ['integrated','reference']){const plan={storeKey:store.key,date,employees:ids,roles:{supervisor:ids[0],rx:[],training:[],earlyLate:[]},modes:{supervisor:'auto',rx:'auto',training:'auto',earlyLate:'auto'},countingMode:'default',model,notes:{}};
   assert.ok(Number.isFinite(predictPlan(s,plan).displayHours));checks++;
  }
 }
}
assert.equal(migrateDraft({date:'2026-12-01',stableEmployees:[]},s).date,'2026-12-01');
const source=fs.readFileSync(new URL('../static_source/app.mjs',import.meta.url),'utf8');assert.ok(!source.includes('This planning package has expired'));assert.ok(!source.includes('.max=snapshot.validThrough'));
console.log({passed:true,predictions:checks,dates,lastUpdated:s.cutoff,futureDraftPreserved:true});
