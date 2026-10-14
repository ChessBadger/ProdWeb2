// Chronological configuration selection and shrinkage of earlier forecast errors.
export const CALIBRATION_VERSION='weekly-account-segment-calibration-v1';
const median=xs=>{const a=xs.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?(a[(a.length-1)>>1]+a[a.length>>1])/2:0;};
export function score(rows,name,offset=0){
 const rs=rows.filter(r=>Number.isFinite(r.predictions[name])),errors=rs.map(r=>(r.predictions[name]+offset-r.actual)*60),n=rs.length;
 return {visits:n,maeMinutes:n?errors.reduce((s,e)=>s+Math.abs(e),0)/n:null,within15:n?errors.filter(e=>Math.abs(e)<=15).length/n:null,within30:n?errors.filter(e=>Math.abs(e)<=30).length/n:null,within60:n?errors.filter(e=>Math.abs(e)<=60).length/n:null,underestimatedOver60:errors.filter(e=>e< -60).length,outsideRange:rs.filter(r=>r.predictions[name]+offset<.25||r.predictions[name]+offset>18).length};
}
function choose(rows,names,parent,minCount,margin){
 if(rows.length<minCount)return parent;
 const base=score(rows,parent),candidates=names.map(name=>({name,...score(rows,name)})).filter(s=>s.visits===rows.length&&s.outsideRange===0&&s.maeMinutes<=base.maeMinutes-margin&&s.within15>=base.within15&&s.underestimatedOver60<=base.underestimatedOver60);
 return candidates.sort((a,b)=>b.within15-a.within15||a.maeMinutes-b.maeMinutes||a.name.localeCompare(b.name))[0]?.name||parent;
}
export function fitCalibration(replay,cutoff,names,{account='',segment=''}={}){
 if(!cutoff)throw Error('A historical cutoff is required.');
 const prior=replay.filter(r=>r.date<cutoff&&r.cutoff<=r.date&&Number.isFinite(r.actual)&&names.every(n=>Number.isFinite(r.predictions[n])));
 const accountRows=prior.filter(r=>r.account===account),segmentRows=accountRows.filter(r=>r.segment===segment);
 const global=choose(prior,names,'originalPhysical',80,0),accountModel=choose(accountRows,names,global,40,2),segmentModel=choose(segmentRows,names,accountModel,30,2);
 function correction(model){
  const offset=rs=>median(rs.map(r=>r.actual-r.predictions[model]));
  const globalCorrection=prior.length>=40?offset(prior)*prior.length/(prior.length+20):0;
  const accountCorrection=accountRows.length>=8?(offset(accountRows)*accountRows.length+globalCorrection*20)/(accountRows.length+20):globalCorrection;
  const segmentCorrection=segmentRows.length>=8?(offset(segmentRows)*segmentRows.length+accountCorrection*20)/(segmentRows.length+20):accountCorrection;
  return Math.max(-.5,Math.min(.5,segmentCorrection));
 }
 return {version:CALIBRATION_VERSION,cutoff,counts:{global:prior.length,account:accountRows.length,segment:segmentRows.length},models:{global,account:accountModel,segment:segmentModel},corrections:{baseline:correction('originalPhysical'),segment:correction(segmentModel)},latestTrainingDate:prior.map(r=>r.date).sort().at(-1)||null};
}
export function applyCalibration(row,fit){
 if(row.cutoff!==fit.cutoff)throw Error('Calibration cutoff mismatch.');
 const p=row.predictions;
 return {originalPhysical:p.originalPhysical,globalTuned:p[fit.models.global],accountTuned:p[fit.models.account],segmentTuned:p[fit.models.segment],baselineCorrected:p.originalPhysical+fit.corrections.baseline,segmentTunedCorrected:p[fit.models.segment]+fit.corrections.segment};
}
