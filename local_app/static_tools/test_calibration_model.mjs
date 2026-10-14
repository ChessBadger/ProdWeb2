import assert from 'node:assert/strict';
import {fitCalibration,applyCalibration,score} from '../calibration-model.mjs';
const names=['originalPhysical','candidate'];
const row=(id,account,actual,predictions,date='2025-01-08')=>({id,account,segment:account+'||S1',date,cutoff:'2025-01-06',actual,predictions});
const earlier=[...Array.from({length:100},(_,i)=>row('global'+i,'other',2,{originalPhysical:2,candidate:3})),...Array.from({length:40},(_,i)=>row('local'+i,'local',3,{originalPhysical:2,candidate:3}))];
const cutoff='2025-02-03',fit=fitCalibration(earlier,cutoff,names,{account:'local',segment:'local||S1'});
assert.equal(fit.models.global,'originalPhysical');assert.equal(fit.models.account,'candidate');assert.equal(fit.models.segment,'candidate');assert.deepEqual(fit.counts,{global:140,account:40,segment:40});
const future=[...earlier,...Array.from({length:500},(_,i)=>row('future'+i,'local',20,{originalPhysical:20,candidate:1},cutoff))];
assert.deepEqual(fitCalibration(future,cutoff,names,{account:'local',segment:'local||S1'}),fit);
const sparse=fitCalibration(earlier.filter(r=>r.id!=='local0'),cutoff,names,{account:'local',segment:'local||S1'});assert.equal(sparse.models.account,'originalPhysical'); // account minimum 40
assert.ok(Math.abs(fit.corrections.baseline)<=.5);assert.ok(Math.abs(fit.corrections.segment)<=.5);
const query={cutoff,predictions:{originalPhysical:2,candidate:3}},applied=applyCalibration(query,fit);assert.equal(applied.accountTuned,3);assert.equal(applied.originalPhysical,2);
assert.throws(()=>applyCalibration({...query,cutoff:'2025-02-10'},fit),/cutoff mismatch/);
const noData=fitCalibration([],cutoff,names,{account:'local',segment:'local||S1'});assert.equal(noData.models.global,'originalPhysical');assert.equal(noData.corrections.baseline,0);
const malformed=[...earlier,row('bad','local',3,{originalPhysical:NaN,candidate:3})];assert.deepEqual(fitCalibration(malformed,cutoff,names,{account:'local',segment:'local||S1'}),fit);
const monday=[row('monday','local',3,{originalPhysical:2,candidate:3},'2025-01-06')];assert.equal(fitCalibration(monday,cutoff,names).counts.global,1);
const metrics=score([row('1','x',3,{originalPhysical:2,candidate:3}),row('2','x',3,{originalPhysical:3,candidate:3})],'originalPhysical');assert.equal(metrics.maeMinutes,30);assert.equal(metrics.within15,.5);
console.log('Calibration tests passed: earlier-only fitting, account/segment sample gates, fallback, bounded corrections, Monday visits, missing predictions, cutoff identity and error metrics.');
