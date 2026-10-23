import fs from 'node:fs';
import {predict} from '../static_source/predictor.mjs';
import {referencePrediction,DurationModel} from '../static_source/planner.mjs';
const unique=a=>[...new Set(a||[])];
export function workloadAnchorPlan(snapshot,plan){
 const store=snapshot.stores.find(s=>s.key===plan.storeKey),known=new Set(snapshot.persons.map(p=>p.key));
 const last=store.lastCrew||{},members=unique([...(last.employees||[]),last.supervisor].filter(id=>known.has(id)));
 const pack=store.scenario.variants[plan.countingMode||'default']||store.scenario.variants.default;
 const rates=snapshot.scenarioRates[pack.rates];
 const historicalMembers=unique(pack.kernels.flatMap(k=>k.full.members)).filter(id=>known.has(id));
 const fallbackCount=Math.max(1,Math.min(50,Math.round(store.context?.fixed.priorCrew||historicalMembers.length||8)));
 const fallback=historicalMembers.length?historicalMembers:snapshot.persons.map(p=>p.key).sort((a,b)=>(rates[b]?.[0]||0)-(rates[a]?.[0]||0)||a.localeCompare(b));
 const employees=(members.length?members:fallback.slice(0,fallbackCount)).slice(0,50);
 return {...plan,employees,availabilityFactors:{},supervisorContributions:{},rxContributions:{},notes:{},roles:{supervisor:employees.includes(last.supervisor)?last.supervisor:'',rx:(last.rx||[]).filter(id=>employees.includes(id)),training:[],earlyLate:[]},modes:{...DurationModel.DEFAULT_MODES},shrink:{percent:0,mode:'none',employeeIds:[]},useRecentAccountProduction:false};
}


const snapshot=JSON.parse(fs.readFileSync(0,'utf8')),output={};
const dates=[...new Set(Array.from({length:7},(_,i)=>new Date(Date.parse(snapshot.cutoff+'T00:00:00Z')+i*86400000).toISOString().slice(0,10)))];
for(const store of snapshot.stores){const variants={};for(const mode of Object.keys(store.scenario.variants)){if(!store.scenario.variants[mode])continue;const phases={};for(const date of dates){const phase=Number(date.slice(5,7))%3;if(phases[phase])continue;
const anchor=workloadAnchorPlan(snapshot,{storeKey:store.key,date,countingMode:mode});const main=predict(snapshot,anchor),base=referencePrediction(snapshot,anchor),neutral=referencePrediction(snapshot,anchor,mode);if(!base||!neutral)throw Error('Missing full crew anchor '+store.name);
const capacity=anchor.employees.reduce((n,id)=>n+(neutral.rates[id]?.[0]||0)*DurationModel.roleFactor(id,anchor),0),available=main.status==='ok';const full=available?Math.max(.25,main.predictedHours+neutral.onSiteDuration-base.onSiteDuration):neutral.onSiteDuration;
const timing=available&&anchor.employees.some(id=>id!==anchor.roles.supervisor)?store.scenario.crewTiming:null;
phases[phase]={capacity,mainAvailable:available,mainHours:available?main.predictedHours:null,referenceHours:neutral.onSiteDuration,integratedFullHours:full,integratedCrewHours:timing?Math.max(.25,full-timing.correctionHours):full,hasTiming:!!timing};
}variants[mode]=phases;}output[store.key]=variants;}
process.stdout.write(JSON.stringify(output));
