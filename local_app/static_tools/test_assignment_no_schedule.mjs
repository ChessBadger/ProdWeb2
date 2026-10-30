import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';import {allocate,resolveSchedulePlan} from '../static_source/planner.mjs';
const root=new URL('../../pages_export/',import.meta.url),r=JSON.parse(fs.readFileSync(new URL('release.json',root))),s=JSON.parse(gunzipSync(fs.readFileSync(new URL(r.files.planning.path,root)))),stores=s.stores.filter(x=>!x.needsRx&&x.context?.incumbent).slice(0,2),ids=s.persons.slice(0,6).map(p=>p.key),date=s.cutoff;
const config={storeA:stores[0].key,storeB:stores[1].key,date,available:ids,supervisorA:ids[0],supervisorB:ids[1],supervisorModeA:'auto',supervisorModeB:'auto',goalA:4,goalB:4,goalMode:'duration',sharedRoles:{rx:[],training:[],earlyLate:[]},constraints:{linkedGroups:[],lockedStoreA:[],lockedStoreB:[]},plan:{model:'integrated',roles:{},modes:{},shrink:{percent:0,mode:'none',employeeIds:[]}}};
const first=await allocate(s,config);
for(const st of stores)st.scenario.scheduleJobs=[{key:'stale',date,startTime:'13:00'},{key:'another',date,startTime:'09:00'}];
const second=await allocate(s,{...config,startTimeA:'13:00',startTimeB:'13:00',scheduleJobKeyA:'stale',scheduleJobKeyB:'stale',plan:{...config.plan,hasScheduledJob:true,scheduleJobKey:'stale',startTime:'13:00'}});
assert.deepEqual(second.crewA,first.crewA);assert.deepEqual(second.crewB,first.crewB);assert.equal(second.A.displayHours,first.A.displayHours);assert.equal(second.B.displayHours,first.B.displayHours);
const manual=resolveSchedulePlan(s,{storeKey:stores[0].key,date,hasScheduledJob:false});assert.equal(manual.hasScheduledJob,false);assert.equal(manual.startTime,'');
console.log('PASS: assignment results ignore stored job keys/start times and duplicate scheduled jobs');
