import {predict} from './predictor.a30df4296dbda746729ed217a460eca1899e7ec3e854a926769f8b5070d21659.js';

export const {solveAvailability,workerAvailability}=(()=>{

// Pure clock availability. Productivity and time present remain separate factors.

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

const clockText=m=>`${String(Math.floor((m%1440)/60)).padStart(2,'0')}:${String(Math.round(m%60)).padStart(2,'0')}${m>=1440?' next day':''}`;

function readClock(value,start,end,kind){

 const s=value.toLowerCase().trim();if(s==='noon')return {minutes:start>=1080?2160:720,label:start>=1080?'12:00 next day (noon)':'12:00 (noon)'};if(s==='midnight'){const next=start>=1080||(kind==='departure'&&start>0);return {minutes:next?1440:0,label:next?'00:00 next day':'00:00'};}

 const m=s.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);if(!m)return null;

 let h=Number(m[1]),minute=Number(m[2]||0);if(minute>59||h>24||(h===24&&(minute!==0||m[3])))return null;

 const meridiem=m[3]?.replace(/\./g,'');let chosen,context=false;

 if(meridiem){if(h<1||h>12)return null;chosen=(h%12+(meridiem==='pm'?12:0))*60+minute;}

 else if(h>12||h===0||m[1].startsWith('0'))chosen=h*60+minute;

 else {context=true;const candidates=[h%12*60+minute,(h%12+12)*60+minute];chosen=candidates.find(x=>x>=start)??candidates[0]+1440;}

 // Explicit morning clocks belong to the following day only for overnight inventory.

 if(!context&&chosen<start&&start>=18*60&&(chosen+1440-start)<=18*60)chosen+=1440;

 return {minutes:chosen,label:clockText(chosen)+(context?' (resolved from scheduled start)':'')};

}

const time='(noon|midnight|\\d{1,2}(?::\\d{2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?)?)';

function workerAvailability(note,startTime,hours){

 const text=String(note||'');const arrival=new RegExp('\\b(?:after|arriv(?:e|es|al)|from|starts?)\\s*(?:at\\s+)?'+time,'ig');const departure=new RegExp('\\b(?:until|unitl|till|leav(?:e|es|ing)|departs?)\\s*(?:at\\s+)?'+time,'ig');

 const inputs=[...text.matchAll(arrival)].map(m=>({kind:'arrival',raw:m[1]})).concat([...text.matchAll(departure)].map(m=>({kind:'departure',raw:m[1]})));

 if(!inputs.length)return null;

 if(!/^\d{2}:\d{2}$/.test(startTime||''))throw Error('A scheduled start time from ScheduleFinalFull is required for clock availability.');

 const [h,m]=startTime.split(':').map(Number);if(h>23||m>59)throw Error('The ScheduleFinalFull start time is invalid.');

 if(!Number.isFinite(hours)||hours<=0)throw Error('Predicted inventory duration must be positive.');

 const start=h*60+m,end=start+hours*60;let from=start,to=end,arrivalMinutes=null,departureMinutes=null;const interpretations=[];

 for(const input of inputs){const c=readClock(input.raw,start,end,input.kind);if(!c)throw Error('Invalid clock availability: '+input.raw);if(input.kind==='arrival'){from=Math.max(from,c.minutes);arrivalMinutes=arrivalMinutes===null?c.minutes:Math.max(arrivalMinutes,c.minutes);}else {to=Math.min(to,c.minutes);departureMinutes=departureMinutes===null?c.minutes:Math.min(departureMinutes,c.minutes);}interpretations.push(input.kind+' '+c.label);}

 const minutes=Math.max(0,Math.min(end,to)-Math.max(start,from));

 return {factor:clamp(minutes/(hours*60),0,1),availableHours:minutes/60,arrivalMinutes,departureMinutes,interpretation:interpretations.join('; '),zeroInterval:to<=from};

}

function availabilityForPlan(plan,hours){

 const entries={};for(const id of [...new Set(plan.employees||[])]){const a=workerAvailability(plan.notes?.[id],plan.startTime,hours);if(a)entries[id]=a;}return entries;

}

function solveAvailability(plan,predict){

 const clockNote=text=>/\b(?:until|unitl|till|after|from|arrives?|arrival|leav(?:e|es|ing)|departs?|starts?)\s*(?:at\s+)?(?:\d|noon|midnight)/i.test(String(text||''));

 const unresolved=!/^\d{2}:\d{2}$/.test(plan.startTime||'')?(plan.employees||[]).filter(id=>clockNote(plan.notes?.[id])):[];

 if(unresolved.length){const applied={...plan,roles:{...plan.roles,earlyLate:(plan.roles?.earlyLate||[]).filter(id=>!['auto','p50'].includes(plan.modes?.earlyLate||'p50')||!unresolved.includes(id))}},initial=predict(applied);return {...initial,availabilityUnresolvedIds:unresolved,effectiveCountingHours:null,crew:initial.crew.map(p=>unresolved.includes(p.id)?{...p,availabilityUnknown:true,predictedPieces:null}:p),warnings:[...(initial.warnings||[]),'Clock notes need a matching ScheduleFinalFull start; timed availability is not applied.']};}

 const initial=predict(plan);let entries=availabilityForPlan(plan,initial.displayHours);if(!Object.keys(entries).length)return initial;

 const evaluate=hours=>{const e=availabilityForPlan(plan,hours),f=Object.fromEntries(Object.entries(e).map(([id,a])=>[id,a.factor]));if(!plan.employees.some(id=>DurationModel.roleFactor(id,{...plan,availabilityFactors:f})>0))return {result:{displayHours:19},entries:e};return {result:predict({...plan,availabilityFactors:f}),entries:e};};

 // Deterministic bisection of duration - prediction(duration), bounded to model domain.

 let lo=.25,hi=18,left=evaluate(lo),right=evaluate(hi);const residual=(h,x)=>h-x.result.displayHours;

 if(residual(lo,left)>0||residual(hi,right)<0)throw Error('Clock availability cannot support a prediction within 15 minutes to 18 hours. Review the crew or times.');

 let current,mid,iterations=0;for(let i=0;i<40;i++){iterations=i+1;mid=(lo+hi)/2;current=evaluate(mid);if(Math.abs(residual(mid,current))<=1/3600)break;if(residual(mid,current)>0)hi=mid;else lo=mid;}

 if(Math.abs(residual(mid,current))>1/60)throw Error('Clock availability prediction did not converge. Review the crew or times.');

 entries=availabilityForPlan(plan,current.result.displayHours);

 const warnings=Object.entries(entries).filter(([,a])=>a.factor===0).map(([id])=>'No available inventory time for '+id+'.');

 const laborHours=current.result.crew.reduce((s,p)=>s+(entries[p.id]?.availableHours??current.result.displayHours),0);

 const goalValue=plan.goalMode==='manhours'?laborHours:current.result.displayHours,target=Number(plan.targetValue)||0,delta=target>0?goalValue-target:null,riskBand=plan.goalMode==='manhours'?2:.5;

 return {...current.result,laborHours,delta,recommendation:delta===null?'Duration Estimate':Math.abs(delta)<=riskBand?'On Target':delta>0?'Estimate Exceeds Goal':'Ahead of Goal',availability:entries,availabilityIterations:iterations,availabilityConverged:true,warnings:[...(current.result.warnings||[]),...warnings],crew:current.result.crew.map(p=>({...p,availability:entries[p.id]||null})),scenarioRule:current.result.scenarioRule+' Clock availability is the overlap with the predicted inventory interval; clock interpretations are shown per worker.'};

}



return {solveAvailability,workerAvailability};})();

export function onsitePlanningRange(snapshot,plan,result){
 const model=plan.model==='reference'||!result.mainAvailable?'reference':'integrated';
 const evidence=snapshot.evidence?.onsiteRange?.[model];
 if(!result.mainAvailable||model==='integrated'&&!result.crewTiming||!evidence||evidence.count<20||!(evidence.medianAbsoluteErrorHours>0)||!Number.isFinite(result.displayHours))return null;
 // Median absolute error is a compact typical-error band, not a confidence interval.
 // Reduced capacity can widen it; increased capacity must not manufacture precision.
 const scale=Math.max(1,result.capacityScenario?.ratio||1),width=evidence.medianAbsoluteErrorHours*60*scale;
 const lowerMinutes=Math.max(0,Math.floor((result.displayHours*60-width)/5)*5),upperMinutes=Math.ceil((result.displayHours*60+width)/5)*5;
 return {lowerHours:lowerMinutes/60,upperHours:upperMinutes/60,count:evidence.count,kind:'typical-error',scenario:!!result.adjusted,model};
}

export function resolveSchedulePlan(snapshot,plan){

 const store=snapshot.stores.find(s=>s.key===plan.storeKey),all=store?.scenario?.scheduleJobs||[],jobs=all.filter(j=>j.date===plan.date),explicit=plan.scheduleJobKey?all.find(j=>j.key===plan.scheduleJobKey):null,chosen=explicit||(plan.hasScheduledJob===false?null:jobs.length===1?jobs[0]:null);

 if(jobs.length>1&&!chosen)throw Error('Choose the scheduled job for this store and date.');

 if(chosen)return {...plan,date:chosen.date,startTime:chosen.startTime||'',hasScheduledJob:true,scheduleJobKey:chosen.key,startSource:'ScheduleFinalFull',scheduledJob:chosen};

 return {...plan,date:snapshot.cutoff,startTime:'',hasScheduledJob:false,scheduledJob:null,startSource:''};

}

export function departureClock(plan,hours){

 if(!/^\d{2}:\d{2}$/.test(plan.startTime||'')||!Number.isFinite(hours))return null;

 const [h,m]=plan.startTime.split(':').map(Number),minutes=h*60+m+Math.round(hours*60),day=Math.floor(minutes/1440);

 return `${String(Math.floor((minutes%1440)/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}${day?' (+'+day+' day)':''}`;

}



/* Shared, UI-independent duration model. Employee exports contain partial crews.

 * Never interpret their summed pieces or hours as complete inventory totals. */

const DurationModel = (() => {

  const VERSION = "duration-v4-weekly";

  const DEFAULT_CONFIG = Object.freeze({ baseline: "recent3", elasticity: 0.3 });

  const DEFAULT_MODES = Object.freeze({ supervisor: "p50", rx: "p50", training: "p70", earlyLate: "p50" });

  const factors = { full: 1, p70: 0.7, p50: 0.5, p30: 0.3, none: 0 };

  const unique = values => [...new Set((values || []).filter(Boolean))];

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const median = values => quantile(values, 0.5);

  function weekStart(date) {

    const d = new Date(`${date}T00:00:00Z`);

    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));

    return d.toISOString().slice(0, 10);

  }

  function quantile(values, p) {

    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);

    if (!sorted.length) return 0;

    const i = (sorted.length - 1) * p, lo = Math.floor(i);

    return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);

  }



  function createHistory(jobs = []) {

    const history = { stores: new Map(), accounts: new Map(), all: [] };

    for (const job of [...jobs].sort((a, b) => a.date.localeCompare(b.date))) addJob(history, job);

    return history;

  }

  function addJob(history, job) {

    if (!(job.duration > 0) || !Number.isFinite(job.duration)) return;

    for (const [map, key] of [[history.stores, job.storeKey], [history.accounts, job.accountKey]]) {

      if (!map.has(key)) map.set(key, []);

      map.get(key).push(job);

    }

    history.all.push(job);

  }



  function historicalPlan(job) {

    return {

      date: job.date, storeKey: job.storeKey, accountKey: job.accountKey,

      typeOfInv: job.typeOfInv, inventoryMode: job.inventoryMode ?? null,

      employees: unique(job.employees),

      roles: { supervisor: job.supervisorNumber || "", rx: job.rxEmployees || [], training: [], earlyLate: [] },

      modes: { ...DEFAULT_MODES },

    };

  }



  function roleFactor(id, plan) {

    let factor = 1;

    const modes = { ...DEFAULT_MODES, ...plan.modes }, roles = plan.roles || {};

    for (const role of Object.keys(DEFAULT_MODES)) {

      if (role === 'earlyLate' && Object.hasOwn(plan.availabilityFactors || {}, id) && (plan.modes?.earlyLate==='auto'||plan.modes?.earlyLate===undefined)) continue;

      const assigned = role === "supervisor" ? roles.supervisor === id : (roles[role] || []).includes(id);

      if (assigned) factor = Math.min(factor, role === 'supervisor' && modes.supervisor === 'auto' ? (plan.supervisorContributions?.[id]?.factor ?? .5) : role === 'rx' && modes.rx === 'auto' ? (plan.rxContributions?.[id]?.factor ?? plan.rxContribution?.factor ?? .5) : factors[modes[role]] ?? factors[DEFAULT_MODES[role]]);

    }

    if (Object.hasOwn(plan.availabilityFactors || {}, id)) factor *= clamp(plan.availabilityFactors[id], 0, 1);

    const shrink = plan.shrink || {};

    if (shrink.mode === "all" || (shrink.mode === "selected" && (shrink.employeeIds || []).includes(id))) {

      factor *= Math.max(0, 1 - clamp(Number(shrink.percent) || 0, 0, 100) / 100);

    }

    return factor;

  }



  // rateFor must be built exclusively from rows preceding the prediction date.

  function crewProfile(plan, rateFor, includeSupervisor = true) {

    const ids = unique(plan.employees).filter(id => includeSupervisor || id !== plan.roles?.supervisor);

    let speed = 0, known = 0, evidence = 0;

    for (const id of ids) {

      const source = rateFor(id, plan.accountKey, plan.inventoryMode, Boolean(plan.useRecentAccountProduction));

      const value = Number(source?.speed) || 0;

      speed += Math.max(0, value) * roleFactor(id, plan);

      if (source?.known && value > 0) known++;

      evidence += Number.isFinite(source?.evidence) ? source.evidence : source?.known ? 1 : 0;

    }

    return { ids, speed, knownShare: ids.length ? known / ids.length : 0, evidenceShare: ids.length ? evidence / ids.length : 0 };

  }



  function comparableJobs(jobs, plan) {

    const typed = jobs.filter(j => j.typeOfInv === plan.typeOfInv);

    const matching = typed.filter(j => j.inventoryMode === plan.inventoryMode);

    if (matching.length) return { jobs: matching, scope: "same store, type and counting mode" };

    if (typed.length) return { jobs: typed, scope: "same store and inventory type" };

    return { jobs, scope: "same store (other inventory types)" };

  }



  function prepare(history, plan, rateFor) {

    const crewSize = unique(plan.employees).length;

    if (!crewSize || !plan.date || !unique(plan.employees).some(id => roleFactor(id, plan) > 0)) return null;

    const prior = jobs => (jobs || []).filter(j => j.date < (plan.historyCutoff || plan.date))

      .sort((a, b) => b.date.localeCompare(a.date) || a.storeKey.localeCompare(b.storeKey));

    const storeJobs = prior(history.stores.get(plan.storeKey));

    const matched = comparableJobs(storeJobs, plan);

    let source = matched.scope, references = matched.jobs.slice(0, 5);

    const hasStoreHistory = references.length > 0;

    if (!hasStoreHistory) {

      const account = prior(history.accounts.get(plan.accountKey));

      const typed = account.filter(j => j.typeOfInv === plan.typeOfInv);

      const matching = typed.filter(j => j.inventoryMode === plan.inventoryMode);

      references = (matching.length ? matching : typed.length ? typed : account).slice(0, 20);

      source = matching.length ? "account, type and counting mode" : typed.length ? "account and inventory type" : "account";

      if (!references.length) { references = prior(history.all).slice(0, 30); source = "company history"; }

    }

    if (!references.length) return null;

    const fullCrew = crewProfile(plan, rateFor);

    const samples = references.map(job => {

      const referencePlan = historicalPlan(job);

      // When either export omits its supervisor, compare counters on BOTH sides.

      // The supervisor still counts in the planned headcount and labor hours.

      const supervisorRecord = job.employeeDetails?.find(e => e.employee === referencePlan.roles.supervisor);

      const includeSupervisor = referencePlan.employees.includes(referencePlan.roles.supervisor)

        && (!job.employeeDetails || (supervisorRecord?.pieces > 0 && supervisorRecord?.inStoreHours > 0))

        && (plan.employees || []).includes(plan.roles?.supervisor);

      const current = crewProfile(plan, rateFor, includeSupervisor);

      const previous = crewProfile(referencePlan, rateFor, includeSupervisor);

      const overlap = current.ids.filter(id => previous.ids.includes(id)).length / Math.max(1, current.ids.length);

      const compatible = job.typeOfInv === plan.typeOfInv && typeof job.inventoryMode === "boolean"

        && job.inventoryMode === plan.inventoryMode;

      const reliability = hasStoreHistory && compatible

        ? Math.min(current.knownShare, previous.knownShare) * (0.35 + 0.65 * overlap) : 0;

      return {

        date: job.date, duration: job.duration,

        ageDays: Math.max(0, (Date.parse(plan.date) - Date.parse(job.date)) / 86400000),

        evidenceReliability: hasStoreHistory && compatible ? Math.min(current.evidenceShare, previous.evidenceShare) * (0.35 + 0.65 * overlap) : 0,

        ratio: current.speed > 0 && previous.speed > 0 ? clamp(previous.speed / current.speed, 0.25, 4) : 1,

        reliability, supervisorComparable: includeSupervisor,

      };

    });

    return {

      samples, source, hasStoreHistory, crewSize, crewSpeed: fullCrew.speed,

      storeHistoryCount: storeJobs.length, matchingHistoryCount: references.length,

      lastVisit: storeJobs[0]?.duration ?? null,

      recentStore: storeJobs.length ? mean(storeJobs.slice(0, 3).map(j => j.duration)) : null,

    };

  }



  function aggregate(values, baseline, samples = [], halfLife = 0) {

    const limit = baseline === "last" ? 1 : baseline.endsWith("5") ? 5 : 3;

    const selected = values.slice(0, limit);

    if (halfLife > 0 && baseline !== "last") {

      const entries = selected.map((value, i) => ({ value, weight: Math.pow(0.5, (samples[i]?.ageDays || 0) / halfLife) * (baseline.startsWith("median") ? 1 : selected.length - i) }));

      const total = entries.reduce((sum, e) => sum + e.weight, 0);

      if (total > 0) {

        if (baseline.startsWith("median")) {

          let sum = 0;

          for (const entry of entries.sort((a, b) => a.value - b.value)) { sum += entry.weight; if (sum >= total / 2) return entry.value; }

        }

        return entries.reduce((sum, e) => sum + e.value * e.weight, 0) / total;

      }

    }

    if (baseline.startsWith("median")) return median(selected);

    if (baseline === "last") return selected[0];

    const weights = selected.map((_, i) => selected.length - i);

    return selected.reduce((sum, x, i) => sum + x * weights[i], 0) / weights.reduce((a, b) => a + b, 0);

  }



  function predictPrepared(input, config = DEFAULT_CONFIG) {

    if (!input?.samples?.length) return null;

    const baseline = config.baseline || DEFAULT_CONFIG.baseline;

    const elasticity = clamp(Number(config.elasticity) || 0, 0, 0.5);

    const durations = input.samples.map(s => s.duration);

    const baseDuration = input.hasStoreHistory ? aggregate(durations, baseline, input.samples, config.ageHalfLife) : median(durations);

    const adjusted = input.samples.map(s => s.duration * clamp(s.ratio ** (elasticity * (config.evidenceAware ? s.evidenceReliability ?? s.reliability : s.reliability)), 0.85, 1.20));

    const duration = input.hasStoreHistory ? aggregate(adjusted, baseline, input.samples, config.ageHalfLife) : baseDuration;

    return {

      onSiteDuration: duration, manHours: duration * input.crewSize, crewSize: input.crewSize,

      baseDuration, crewAdjustmentHours: duration - baseDuration,

      crewAdjustmentFactor: duration / baseDuration, crewSpeed: input.crewSpeed,

      baselineSource: input.source, baselineMethod: baseline,

      storeHistoryCount: input.storeHistoryCount, matchingHistoryCount: input.matchingHistoryCount,

      hasStoreHistory: input.hasStoreHistory,

      supervisorComparable: input.samples.every(s => s.supervisorComparable),

      config: { baseline, elasticity, ...(config.evidenceAware ? { evidenceAware: true } : {}), ...(config.ageHalfLife > 0 ? { ageHalfLife: config.ageHalfLife } : {}) },

    };

  }

  function predict(history, plan, rateFor, config) {

    return predictPrepared(prepare(history, plan, rateFor), config);

  }



  function metrics(records, valueFor = r => r.predicted) {

    const valid = records.filter(r => Number.isFinite(valueFor(r)) && r.actual > 0);

    const errors = valid.map(r => valueFor(r) - r.actual);

    return {

      jobs: valid.length, durationMae: mean(errors.map(Math.abs)), biasHours: mean(errors),

      mape: mean(valid.map((r, i) => Math.abs(errors[i]) / r.actual * 100)),

      within30Minutes: valid.length ? errors.filter(e => Math.abs(e) <= 0.5).length / valid.length : 0,

      within60Minutes: valid.length ? errors.filter(e => Math.abs(e) <= 1).length / valid.length : 0,

    };

  }



  function chooseConfig(records, options = {}) {

    if (records.length < 20) return { ...DEFAULT_CONFIG };

    // All candidates are selected BEFORE the final test period begins.

    let best = null;

    for (const baseline of ["last", "recent3", "median3", "recent5", "median5"]) {

      for (const elasticity of [0, 0.15, 0.3, 0.5]) {

        const config = { baseline, elasticity, ...options };

        const score = mean(records.map(r => Math.abs(predictPrepared(r.input, config).onSiteDuration - r.actual)));

        if (!best || score < best.score - 1e-10) best = { config, score };

      }

    }

    return best.config;

  }



  function errorSummary(records) {

    const values = records.map(r => r.actual - r.predicted).filter(Number.isFinite);

    return { count: values.length, p10: quantile(values, 0.10), p90: quantile(values, 0.90), p25: quantile(values, 0.25), p75: quantile(values, 0.75) };

  }



  function analyze(records, allJobs, options = {}) {

    const dated = [...allJobs].filter(j => j.duration > 0).sort((a, b) => a.date.localeCompare(b.date));

    const splitDate = dated.length >= 40 ? weekStart(dated[Math.floor(dated.length * 0.8)].date) : null;

    const calibrationStart = dated.length >= 40 ? weekStart(dated[Math.floor(dated.length * 0.6)].date) : null;

    const before = records.filter(r => !calibrationStart || r.date < calibrationStart);

    // Tune on the most recent half of the development period; earlier jobs supply history.

    const validationDate = before[Math.floor(before.length * 0.5)]?.date || "";

    const validation = before.filter(r => r.date >= validationDate);

    const config = chooseConfig(validation, options);

    const byAccount = {};

    const grouped = new Map();

    for (const record of validation) {

      if (!grouped.has(record.accountKey)) grouped.set(record.accountKey, []);

      grouped.get(record.accountKey).push(record);

    }

    for (const [key, group] of grouped) {

      if (group.length < 40) continue;

      const candidate = chooseConfig(group, options);

      const mae = cfg => mean(group.map(r => Math.abs(predictPrepared(r.input, cfg).onSiteDuration - r.actual)));

      if (mae(candidate) < mae(config) - 0.03) byAccount[key] = candidate;

    }

    const test = records.filter(r => splitDate && r.date >= splitDate).map(r => ({

      ...r, predicted: predictPrepared(r.input, byAccount[r.accountKey] || config).onSiteDuration,

    }));

    const calibration = records.filter(r => splitDate && r.date >= calibrationStart && r.date < splitDate).map(r => ({

      ...r, predicted: predictPrepared(r.input, byAccount[r.accountKey] || config).onSiteDuration,

    }));

    const calibrationStores = new Map(), calibrationAccounts = new Map();

    for (const record of calibration) for (const [map, key] of [[calibrationStores, record.storeKey], [calibrationAccounts, record.accountKey]]) {

      if (!map.has(key)) map.set(key, []);

      map.get(key).push(record);

    }

    const errorGlobal = errorSummary(calibration);

    const rangeFor = r => calibrationStores.get(r.storeKey)?.length >= 20 ? errorSummary(calibrationStores.get(r.storeKey))

      : calibrationAccounts.get(r.accountKey)?.length >= 40 ? errorSummary(calibrationAccounts.get(r.accountKey)) : errorGlobal;

    const intervalRows = test.filter(r => rangeFor(r).count >= 20);

    const intervalCovered = intervalRows.filter(r => {

      const e = rangeFor(r); return r.actual >= Math.max(0, r.predicted + Math.min(0, e.p10)) && r.actual <= r.predicted + Math.max(0, e.p90);

    });

    const paired = test.filter(r => Number.isFinite(r.input.lastVisit));

    const byStore = new Map(), testAccounts = new Map();

    for (const record of test) {

      for (const [map, key] of [[byStore, record.storeKey], [testAccounts, record.accountKey]]) {

        if (!map.has(key)) map.set(key, []);

        map.get(key).push(record);

      }

    }

    const allRows = [...byStore].map(([storeKey, group]) => ({

      storeKey, account: group[0].account, accountKey: group[0].accountKey, label: group[0].label,

      mae: metrics(group).durationMae, mape: metrics(group).mape,

      actualAvgDuration: mean(group.map(r => r.actual)), predictedAvgDuration: mean(group.map(r => r.predicted)),

      count: group.length, weightSum: group.length,

    }));

    const testMetrics = { ...metrics(test), splitDate: splitDate || "", attempted: dated.filter(j => splitDate && j.date >= splitDate).length };

    return {

      version: VERSION, config, byAccount, validationJobs: validation.length,

      calibrationStart: calibrationStart || "", calibrationJobs: calibration.length,

      interval: { nominalCoverage: 0.8, testedJobs: intervalRows.length, coverage: intervalRows.length ? intervalCovered.length / intervalRows.length : null },

      validationMae: validation.length ? mean(validation.map(r => Math.abs(predictPrepared(r.input, byAccount[r.accountKey] || config).onSiteDuration - r.actual))) : null,

      evaluationPolicy: "Monday weekly cutoff; assumes previous week available Monday. Retrospective retained-history simulation, not historical as-of exports.",

      validationEnd: before.at(-1)?.date || "", testMetrics,

      benchmarks: {

        pairedModel: metrics(paired), lastVisit: metrics(paired, r => r.input.lastVisit),

        recentStore: metrics(paired, r => r.input.recentStore),

        newStores: metrics(test.filter(r => !r.input.hasStoreHistory)),

      },

      errorGlobal,

      errorByStore: Object.fromEntries([...calibrationStores].map(([key, group]) => [key, errorSummary(group)])),

      errorByAccount: Object.fromEntries([...calibrationAccounts].map(([key, group]) => [key, errorSummary(group)])),

      accuracyCache: { mae: testMetrics.durationMae, mape: testMetrics.mape, counted: test.length, totalWeight: test.length, allRows },

      // These records are also useful for reproducible offline checks; they are not persisted in the browser snapshot.

      testRecords: test.map(({ input, ...r }) => ({ ...r, lastVisit: input.lastVisit, recentStore: input.recentStore })),

    };

  }



  return { VERSION, DEFAULT_CONFIG, DEFAULT_MODES, weekStart, chooseConfig, createHistory, addJob, historicalPlan,

    roleFactor, crewProfile, prepare, predictPrepared, predict, metrics, analyze };

})();



function buildEmployeeLinkedUnits(allIds, baseA, baseB, constraints, nameFor=id=>id) {

  const members = Array.from(new Set(allIds || [])).filter(Boolean);

  const parent = new Map();

  members.forEach((id) => parent.set(id, id));



  const find = (id) => {

    let root = parent.get(id);

    while (root && root !== parent.get(root)) {

      root = parent.get(root);

    }

    let node = id;

    while (node && parent.get(node) !== root) {

      const next = parent.get(node);

      parent.set(node, root);

      node = next;

    }

    return root || id;

  };



  const union = (a, b) => {

    if (!parent.has(a) || !parent.has(b)) return;

    const rootA = find(a);

    const rootB = find(b);

    if (rootA !== rootB) parent.set(rootB, rootA);

  };



  (constraints?.linkedGroups || []).forEach((group) => {

    const ids = (group || []).filter((id) => parent.has(id));

    for (let i = 1; i < ids.length; i += 1) {

      union(ids[0], ids[i]);

    }

  });



  const groupsByRoot = new Map();

  members.forEach((id) => {

    const root = find(id);

    if (!groupsByRoot.has(root)) groupsByRoot.set(root, []);

    groupsByRoot.get(root).push(id);

  });



  const baseASet = new Set(baseA || []);

  const baseBSet = new Set(baseB || []);

  const lockASet = new Set(constraints?.lockedStoreA || []);

  const lockBSet = new Set(constraints?.lockedStoreB || []);

  const forcedA = new Set(baseASet);

  const forcedB = new Set(baseBSet);

  const freeUnits = [];



  for (const groupMembers of groupsByRoot.values()) {

    const hasBaseA = groupMembers.some((id) => baseASet.has(id));

    const hasBaseB = groupMembers.some((id) => baseBSet.has(id));

    const hasLockA = groupMembers.some((id) => lockASet.has(id));

    const hasLockB = groupMembers.some((id) => lockBSet.has(id));

    if ((hasBaseA || hasLockA) && (hasBaseB || hasLockB)) {

      return {

        error: `Conflicting linked/locked constraints for: ${groupMembers

          .map((id) => nameFor(id))

          .join(", ")}.`,

      };

    }

    const targetStore =

      hasBaseA || hasLockA ? "A" : hasBaseB || hasLockB ? "B" : "";

    const movableMembers = groupMembers.filter(

      (id) => !baseASet.has(id) && !baseBSet.has(id),

    );

    if (!movableMembers.length) continue;

    if (targetStore === "A") {

      movableMembers.forEach((id) => forcedA.add(id));

      continue;

    }

    if (targetStore === "B") {

      movableMembers.forEach((id) => forcedB.add(id));

      continue;

    }

    freeUnits.push(movableMembers);

  }



  const overlap = Array.from(forcedA).filter((id) => forcedB.has(id));

  if (overlap.length) {

    return {

      error: `Conflicting assignment constraints for: ${overlap

        .map((id) => nameFor(id))

        .join(", ")}.`,

    };

  }



  return {

    baseA: Array.from(forcedA),

    baseB: Array.from(forcedB),

    freeUnits,

  };

}



function constraintsSatisfiedForAssignment(constraints, crewA, crewB) {

  const setA = new Set(crewA || []);

  const setB = new Set(crewB || []);

  if ((constraints?.lockedStoreA || []).some((id) => !setA.has(id)))

    return false;

  if ((constraints?.lockedStoreB || []).some((id) => !setB.has(id)))

    return false;

  for (const group of constraints?.linkedGroups || []) {

    const inA = group.some((id) => setA.has(id));

    const inB = group.some((id) => setB.has(id));

    if (inA && inB) return false;

  }

  return true;

}





export {DurationModel,buildEmployeeLinkedUnits,constraintsSatisfiedForAssignment};



const unique=a=>[...new Set(a||[])],clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function referencePrediction(snapshot,plan,variant='default'){

 const store=snapshot.stores.find(s=>s.key===plan.storeKey),pack=store?.scenario?.variants[variant];if(!pack)return null;

 const rates=snapshot.scenarioRates[plan.useRecentAccountProduction?pack.recentRates:pack.rates];

 const rateFor=id=>{const r=rates[id];return {speed:r?.[0]||0,known:!!r?.[1],evidence:r?.[2]||0}};

 if(!plan.employees?.length||!plan.employees.some(id=>DurationModel.roleFactor(id,plan)>0))return null;

 const full=DurationModel.crewProfile(plan,rateFor),hasSup=plan.employees.includes(plan.roles?.supervisor);

 const samples=pack.kernels.map(k=>{const include=k.eligible&&hasSup,current=DurationModel.crewProfile(plan,rateFor,include),prior=include?k.full:k.counter,overlap=current.ids.filter(id=>prior.members.includes(id)).length/Math.max(1,current.ids.length),reliability=pack.hasStoreHistory&&k.compatible?(0.35+0.65*overlap):0;return {duration:k.duration,ageDays:0,ratio:current.speed>0&&prior.speed>0?clamp(prior.speed/current.speed,.25,4):1,reliability:reliability*Math.min(current.knownShare,prior.known),evidenceReliability:reliability*Math.min(current.evidenceShare,prior.evidence),supervisorComparable:include};});

 const r=DurationModel.predictPrepared({samples,hasStoreHistory:pack.hasStoreHistory,crewSize:unique(plan.employees).length,crewSpeed:full.speed,source:pack.source,storeHistoryCount:pack.historyCount,matchingHistoryCount:pack.matchingCount},pack.config);

 return {...r,rates,pack};

}

export function scenarioActive(plan){return Object.keys(plan.availabilityFactors||{}).length>0||(plan.countingMode&&plan.countingMode!=='default')||!!plan.useRecentAccountProduction||Object.entries(plan.modes||{}).some(([k,v])=>v!==DurationModel.DEFAULT_MODES[k])||(plan.roles?.training?.length>0)||(plan.roles?.earlyLate?.length>0)||(Number(plan.shrink?.percent)>0&&plan.shrink?.mode!=='none');}

export function predictPlan(snapshot,plan){

 plan=resolveSchedulePlan(snapshot,{...plan,employees:unique(plan.employees)});

 const store=snapshot.stores.find(s=>s.key===plan.storeKey),v=store?.scenario?.variants[plan.countingMode||'default'],estimates=v?.supervisorEstimates?.[plan.useRecentAccountProduction?'recent':'standard']||{};

 const source=estimates[plan.roles?.supervisor],supervisorContributions=source?{[plan.roles.supervisor]:{factor:source[0],count:source[1],scope:source[2],supported:source[3]}}:{};

 const rxEvidence=v?.rxEstimate||{factor:.5,count:0,supported:false,scope:'50% assumption: Rx history unavailable'},rxCount=unique(plan.roles?.rx||[]).length;
 const rxContribution=rxEvidence.supported&&rxCount?{...rxEvidence,factor:Math.max(0,Math.min(1,1-(1-rxEvidence.factor)*(rxEvidence.referenceWorkers||1)/rxCount)),scope:rxEvidence.scope+'; shared across '+rxCount+' assigned Rx worker'+(rxCount===1?'':'s')}:rxEvidence;
 const result=solveAvailability({...plan,supervisorContributions,rxContribution,rxContributions:v?.rxEstimates?.[plan.useRecentAccountProduction?'recent':'standard']||{}},p=>predictPlanCore(snapshot,p));
 result.onsiteRange=onsitePlanningRange(snapshot,plan,result);

 if(!Number.isFinite(result.displayHours)||result.displayHours>18)throw Error('The selected counting capacity requires more than 18 hours. Add capacity or review contributions.');

 let supervisorOnsiteHours=plan.employees.includes(plan.roles?.supervisor)?(result.crewTiming&&Number.isFinite(result.crewTiming.supervisorOffsetHours)?Math.max(.25,result.displayHours+result.crewTiming.supervisorOffsetHours):plan.employees.length===1?result.displayHours:null):null;

 let supervisorArrivalOffsetHours=result.crewTiming?.supervisorArrivalOffsetHours||0;
 if(supervisorOnsiteHours!==null&&/^\d{2}:\d{2}$/.test(plan.startTime||'')){const bounds=workerAvailability(plan.notes?.[plan.roles.supervisor],plan.startTime,Math.max(.25,supervisorOnsiteHours));if(bounds){const [h,m]=plan.startTime.split(':').map(Number),crewStart=h*60+m,predictedStart=crewStart+(result.crewTiming?.supervisorArrivalOffsetHours||0)*60,predictedEnd=predictedStart+supervisorOnsiteHours*60,arrival=bounds.arrivalMinutes??predictedStart,departure=Math.min(predictedEnd,bounds.departureMinutes??predictedEnd);supervisorOnsiteHours=Math.max(0,(departure-arrival)/60);supervisorArrivalOffsetHours=(arrival-crewStart)/60;}}

 const supervisorTimeUnavailableReason=supervisorOnsiteHours>18?'outside the 18-hour planning range':null;
 if(supervisorTimeUnavailableReason)supervisorOnsiteHours=null;
 return {...result,hasScheduledJob:plan.hasScheduledJob,scheduledDate:plan.hasScheduledJob?plan.date:null,supervisorOnsiteHours,supervisorTimeUnavailableReason,startTime:plan.startTime,startSource:plan.startSource,scheduledJob:plan.scheduledJob,crewDeparture:departureClock(plan,result.displayHours),supervisorDeparture:supervisorOnsiteHours===null?null:departureClock(plan,supervisorArrivalOffsetHours+supervisorOnsiteHours),warnings:[...(result.warnings||[]),...(supervisorTimeUnavailableReason?['Supervisor time exceeds the 18-hour planning range; review crew capacity or availability.']:[]),...(plan.scheduleWarning?[plan.scheduleWarning]:[])]};

}

function predictPlanCore(snapshot,plan){

 const main=predict(snapshot,plan),mainAvailable=main.status==='ok';

 const roleKeys=['rx','training','earlyLate'];if(roleKeys.some(k=>(plan.roles?.[k]||[]).some(id=>!plan.employees.includes(id))))throw Error('All roles must belong to the selected crew.');

 if(Object.entries(plan.modes||{}).some(([k,v])=>!(k in DurationModel.DEFAULT_MODES)||!['full','p70','p50','p30','none',...(['supervisor','rx','training','earlyLate'].includes(k)?['auto']:[])].includes(v)))throw Error('Invalid contribution mode.');

 const shrink=Number(plan.shrink?.percent)||0;if(shrink<0||shrink>100)throw Error('Production shrink must be between 0 and 100%.');

 if((plan.shrink?.employeeIds||[]).some(id=>!plan.employees.includes(id)))throw Error('Shrink selections must belong to the selected crew.');

 const baselinePlan={...plan,availabilityFactors:{},supervisorContributions:{},roles:{supervisor:plan.roles?.supervisor||'',rx:plan.roles?.rx||[],training:[],earlyLate:[]},modes:{...DurationModel.DEFAULT_MODES},shrink:{percent:0,mode:'none',employeeIds:[]},useRecentAccountProduction:false};

 const referenceBase=referencePrediction(snapshot,baselinePlan),reference=referencePrediction(snapshot,plan,plan.countingMode||'default');if(!reference||!referenceBase)throw Error('No counting contribution or reference evidence supports this plan.');

 // Anchor workload to the frozen model and default role contributions in the selected mode.

 // Historical compatibility continues to govern mode adjustments, never manual capacity changes.

 const neutralReference=referencePrediction(snapshot,baselinePlan,plan.countingMode||'default');

 const historicalFullOnsiteHours=plan.model==='reference'||!mainAvailable?neutralReference.onSiteDuration:Math.max(.25,main.predictedHours+neutralReference.onSiteDuration-referenceBase.onSiteDuration);

 const timing=mainAvailable&&plan.model!=='reference'&&plan.employees.some(id=>id!==plan.roles?.supervisor)?snapshot.stores.find(s=>s.key===plan.storeKey)?.scenario?.crewTiming:null;

 const historicalCrewHours=timing?Math.max(.25,historicalFullOnsiteHours-timing.correctionHours):historicalFullOnsiteHours;

 const capacity=(p,rates)=>p.employees.reduce((total,id)=>total+Math.max(0,rates[id]?.[0]||0)*DurationModel.roleFactor(id,p),0);

 const baselineCapacity=capacity(baselinePlan,neutralReference.rates),currentCapacity=capacity(plan,reference.rates);

 if(!(baselineCapacity>0&&currentCapacity>0))throw Error('No counting capacity supports this plan.');

 const capacityRatio=baselineCapacity/currentCapacity,adjusted=!!scenarioActive(plan);

 const displayHours=Math.max(.25,historicalCrewHours*capacityRatio),fullOnsiteHours=displayHours+(historicalFullOnsiteHours-historicalCrewHours),supervisorExtensionHours=timing&&plan.employees.includes(plan.roles?.supervisor)?timing.extensionHours:null;

 const capacityScenario={baselineCapacity,currentCapacity,ratio:capacityRatio,workload:historicalCrewHours*baselineCapacity,historicalCrewHours,historicalFullOnsiteHours};

 const crew=plan.employees.map(id=>{const person=snapshot.persons.find(p=>p.key===id),factor=DurationModel.roleFactor(id,plan),standard=snapshot.scenarioRates[reference.pack.rates][id],recent=snapshot.scenarioRates[reference.pack.recentRates][id],speed=reference.rates[id][0];return {id,name:person.name,factor,rxContribution:(plan.roles?.rx||[]).includes(id)&&plan.modes?.rx==='auto'?(plan.rxContributions?.[id]||plan.rxContribution):null,supervisorContribution:id===plan.roles?.supervisor&&plan.modes?.supervisor==='auto'?(plan.supervisorContributions?.[id]||{factor:.5,count:0,scope:'50% fallback: sparse supervisor production',supported:false}):null,speed,standardSpeed:standard[0],recentSpeed:recent[0],recentObservedSpeed:snapshot.stores.find(s=>s.key===plan.storeKey)?.scenario?.recentAccountProduction?.[id]??null,known:reference.rates[id][1],effectiveSpeed:speed*factor,predictedPieces:speed*factor*displayHours};}).sort((a,b)=>b.effectiveSpeed-a.effectiveSpeed||a.name.localeCompare(b.name));

 const target=Number(plan.targetValue)||0;if(target<0)throw Error('Target must not be negative.');const laborHours=displayHours*crew.length,goalValue=plan.goalMode==='manhours'?laborHours:displayHours,delta=target>0?goalValue-target:null,riskBand=plan.goalMode==='manhours'?2:.5;

 return {...main,status:'ok',mainAvailable,crewSize:crew.length,main,reference,referenceBase,capacityScenario,displayHours,fullOnsiteHours,crewTiming:timing,supervisorExtensionHours,laborHours,effectiveCountingHours:displayHours*crew.reduce((a,p)=>a+p.factor,0),adjusted,crew,delta,recommendation:delta===null?'Duration Estimate':Math.abs(delta)<=riskBand?'On Target':delta>0?'Estimate Exceeds Goal':'Ahead of Goal',estimateKind:Math.abs(capacityRatio-1)>1e-9?'Fixed-workload capacity scenario':timing?'Crew estimate from prior clocks':!mainAvailable?'Original reference fallback — no mapped full history':plan.model==='reference'?'Original attendance-proxy reference':'Integrated full-onsite model',scenarioRule:'Fixed-workload scenario: the historical crew estimate is anchored to this crew at default contributions (supervisor/RX 50%, other counters 100%) and standard production in the selected counting mode. Time scales by baseline/current effective pieces per hour. The entire crew window is assumed to scale; separate counting-only time is unavailable. Supervisor time outside the crew window is retained. Scenario accuracy is not separately validated.',historicalCalibration:reference.pack.calibration};

}



export function resolveNames(text,people,available=people.map(p=>p.key)){

 const allowed=new Set(available),resolved=[];for(const token of String(text||'').split(/[,\n;+]/).map(s=>s.trim()).filter(Boolean)){const query=token.toLowerCase();let matches=people.filter(p=>p.name.toLowerCase()===query);if(!matches.length)matches=people.filter(p=>{const parts=p.name.toLowerCase().split(/\s+/);return parts[0]===query||parts.length>1&&parts[0]+' '+parts.at(-1)[0]===query;});if(matches.length!==1)throw Error((matches.length?'Ambiguous':'Unknown')+' employee name: '+token+'. Use the full name.');if(!allowed.has(matches[0].key))throw Error('Employee is not selected as available: '+token);resolved.push(matches[0].key);}return unique(resolved);

}



export async function allocate(snapshot,config,{onProgress=()=>{},cancelled=()=>false}={}){

 const ids=unique(config.available||[]),known=new Set(snapshot.persons.map(p=>p.key));if(ids.length<2||ids.length>snapshot.persons.length||ids.some(id=>!known.has(id)))throw Error('Choose at least two current available employees.');if(!snapshot.stores.some(st=>st.key===config.storeA)||!snapshot.stores.some(st=>st.key===config.storeB))throw Error('Choose two stores.');if(config.storeA===config.storeB)throw Error('Choose two different stores.');if(!config.supervisorA||!config.supervisorB||config.supervisorA===config.supervisorB||![config.supervisorA,config.supervisorB].every(id=>ids.includes(id)))throw Error('Choose two distinct available supervisors.');if(!(Number(config.goalA)>0&&Number(config.goalB)>0))throw Error('Set a positive goal for both stores.');

 const constraints=config.constraints||{linkedGroups:[],lockedStoreA:[],lockedStoreB:[]};if([...constraints.lockedStoreA,...constraints.lockedStoreB,...constraints.linkedGroups.flat()].some(id=>!ids.includes(id)))throw Error('All linked/locked employees must be available.');

 const names=id=>snapshot.persons.find(p=>p.key===id)?.name||id,units=buildEmployeeLinkedUnits(ids,[config.supervisorA],[config.supervisorB],constraints,names);if(units.error)throw Error(units.error);let best=null,evaluated=0;const memo=new Map();

 function score(a,b){if(cancelled())throw Error('Assignment cancelled because inputs changed.');if(!a.length||!b.length||a.length>50||b.length>50||!constraintsSatisfiedForAssignment(constraints,a,b))return null;function prediction(crew,which){const selected=new Set(crew),st=which==='A'?config.storeA:config.storeB,store=snapshot.stores.find(s=>s.key===st),roles={supervisor:which==='A'?config.supervisorA:config.supervisorB,rx:(config.sharedRoles?.rx||[]).filter(i=>selected.has(i)),training:(config.sharedRoles?.training||[]).filter(i=>selected.has(i)),earlyLate:(config.sharedRoles?.earlyLate||[]).filter(i=>selected.has(i))};if(store.needsRx&&!roles.rx.length)return null;const override=which==='A'?config.countingModeA:config.countingModeB;const countingMode=override&&override!=='default'?override:(/\bkroger\b/i.test(store.name)?'modas':'default');const p={...config.plan,notes:Object.fromEntries(crew.map(id=>[id,config.notes?.[id]||''])),startTime:which==='A'?(config.startTimeA||''):(config.startTimeB||''),scheduleJobKey:which==='A'?config.scheduleJobKeyA:config.scheduleJobKeyB,hasScheduledJob:!!(which==='A'?config.scheduleJobKeyA:config.scheduleJobKeyB),countingMode,storeKey:st,date:config.date,employees:crew,roles,modes:{...DurationModel.DEFAULT_MODES,...config.modes,supervisor:which==='A'?config.supervisorModeA:config.supervisorModeB},targetValue:which==='A'?config.goalA:config.goalB,goalMode:config.goalMode,shrink:{...config.plan?.shrink,employeeIds:(config.plan?.shrink?.employeeIds||[]).filter(i=>selected.has(i))}};const key=JSON.stringify([which,[...crew].sort()]);if(!memo.has(key)){try{memo.set(key,predictPlan(snapshot,p))}catch{memo.set(key,null)}}return memo.get(key);}

  const A=prediction(a,'A'),B=prediction(b,'B');if(!A||!B)return null;const valueA=config.goalMode==='manhours'?A.laborHours:A.displayHours,valueB=config.goalMode==='manhours'?B.laborHours:B.displayHours,errA=Math.abs(valueA-config.goalA),errB=Math.abs(valueB-config.goalB);return {crewA:[...a],crewB:[...b],A,B,valueA,valueB,score:errA+errB,maxErr:Math.max(errA,errB)};}

 function consider(a,b){evaluated++;const r=score(a,b);if(r&&(!best||r.score<best.score-1e-10||Math.abs(r.score-best.score)<1e-10&&r.maxErr<best.maxErr))best=r;}

 const n=units.freeUnits.length,exact=n<=12;

 if(exact){const total=2**n;for(let mask=0;mask<total;mask++){const a=[...units.baseA],b=[...units.baseB];for(let i=0;i<n;i++)(mask&(1<<i)?a:b).push(...units.freeUnits[i]);consider(a,b);if(mask%32===0){onProgress(mask,total);await new Promise(r=>setTimeout(r,0));}}}

 else{const rx=new Set(config.sharedRoles?.rx||[]),needsA=snapshot.stores.find(st=>st.key===config.storeA).needsRx&&!units.baseA.some(id=>rx.has(id)),needsB=snapshot.stores.find(st=>st.key===config.storeB).needsRx&&!units.baseB.some(id=>rx.has(id)),rxUnits=units.freeUnits.map((u,i)=>({u,i})).filter(v=>v.u.some(id=>rx.has(id))).slice(0,6);let seeds=needsA&&needsB?rxUnits.flatMap(a=>rxUnits.filter(b=>a.i!==b.i).map(b=>({A:[a.i],B:[b.i]}))):needsA?rxUnits.map(a=>({A:[a.i],B:[]})):needsB?rxUnits.map(b=>({A:[],B:[b.i]})):[{A:[],B:[]},{A:[],B:[]},{A:[],B:[]},{A:[],B:[]}];for(const [seed,forced] of seeds.entries()){const aa=[...units.baseA],bb=[...units.baseB],assigned=[];for(const i of forced.A){aa.push(...units.freeUnits[i]);assigned.push({u:units.freeUnits[i],side:'A'})}for(const i of forced.B){bb.push(...units.freeUnits[i]);assigned.push({u:units.freeUnits[i],side:'B'})}const rest=units.freeUnits.filter((u,i)=>!forced.A.includes(i)&&!forced.B.includes(i));for(let i=0;i<rest.length;i++){const u=rest[seed%2?rest.length-1-i:i];const ra=score([...aa,...u],bb),rb=score(aa,[...bb,...u]);const side=ra&&rb?(ra.score<=rb.score?'A':'B'):ra?'A':rb?'B':i%2?'A':'B';(side==='A'?aa:bb).push(...u);assigned.push({u,side});}consider(aa,bb);for(let round=0;round<2;round++)for(const item of assigned){const a=aa.filter(id=>!item.u.includes(id)),b=bb.filter(id=>!item.u.includes(id)),candidate=item.side==='A'?score(a,[...b,...item.u]):score([...a,...item.u],b),current=score(aa,bb);if(candidate&&(!current||candidate.score<current.score)){aa.splice(0,aa.length,...candidate.crewA);bb.splice(0,bb.length,...candidate.crewB);item.side=item.side==='A'?'B':'A';}consider(aa,bb);}onProgress(seed+1,seeds.length);await new Promise(r=>setTimeout(r,0));}}

 if(!best)throw Error('No feasible assignment satisfies the supervisors, linked/locked groups and required RX roles.');return {...best,exact,evaluated,method:exact?'Exhaustive constrained search':'Greedy multi-seed constrained search (not guaranteed optimal)'};

}



export function migrateDraft(draft,snapshot){if(!draft)return null;const people=new Map(snapshot.persons.map(p=>[p.stableKey,p.key])),stores=new Map(snapshot.stores.map(s=>[s.stableKey,s.key]));const map=i=>people.get(i);return {...draft,notes:Object.fromEntries(Object.entries(draft.stableNotes||{}).map(([id,note])=>[map(id),note]).filter(([id])=>id)),storeKey:stores.get(draft.stableStore)||'',employees:(draft.stableEmployees||[]).map(map).filter(Boolean),roles:{supervisor:map(draft.stableRoles?.supervisor)||'',rx:(draft.stableRoles?.rx||[]).map(map).filter(Boolean),training:(draft.stableRoles?.training||[]).map(map).filter(Boolean),earlyLate:(draft.stableRoles?.earlyLate||[]).map(map).filter(Boolean)},shrink:{...draft.shrink,employeeIds:(draft.stableShrink||[]).map(map).filter(Boolean)},date:draft.date<snapshot.cutoff?snapshot.cutoff:draft.date>snapshot.validThrough?snapshot.validThrough:draft.date};}

export function persistentDraft(plan,snapshot){const person=id=>snapshot.persons.find(p=>p.key===id)?.stableKey||'',store=snapshot.stores.find(s=>s.key===plan.storeKey);return {...plan,stableStore:store?.stableKey||'',stableEmployees:plan.employees.map(person),stableRoles:Object.fromEntries(Object.entries(plan.roles).map(([k,v])=>[k,Array.isArray(v)?v.map(person):person(v)])),stableNotes:Object.fromEntries(Object.entries(plan.notes||{}).map(([id,note])=>[person(id),note])),stableShrink:(plan.shrink?.employeeIds||[]).map(person)};}



const cleanText=value=>String(value||'').trim();

const splitBulkEmployeeEntries=text=>String(text||'').split(/[\r\n,;]+/).map(cleanText).filter(Boolean);

export function parseClipboardTable(rawText) {

  const text = String(rawText || "");

  const rows = [];

  let row = [];

  let cell = "";

  let inQuotes = false;



  for (let idx = 0; idx < text.length; idx += 1) {

    const char = text[idx];

    if (char === '"') {

      if (inQuotes && text[idx + 1] === '"') {

        cell += '"';

        idx += 1;

      } else {

        inQuotes = !inQuotes;

      }

      continue;

    }

    if (char === "\t" && !inQuotes) {

      row.push(cell);

      cell = "";

      continue;

    }

    if ((char === "\n" || char === "\r") && !inQuotes) {

      if (char === "\r" && text[idx + 1] === "\n") idx += 1;

      row.push(cell);

      rows.push(row);

      row = [];

      cell = "";

      continue;

    }

    cell += char;

  }



  if (cell.length || row.length) {

    row.push(cell);

    rows.push(row);

  }



  return rows

    .map((cells) => cells.map((value) => cleanText(value)))

    .filter((cells) => cells.some(Boolean));

}



export function extractBulkEmployeeEntries(rawText) {

  const lines=String(rawText||'').split(/\r?\n/).filter(line=>line.trim());

  const markdown=lines.some(line=>line.includes('|')&&line.split('|').map(s=>s.trim()).filter(Boolean).every(cell=>/^:?-{3,}:?$/.test(cell)));

  if(markdown){

   const entries=[];for(const line of lines){let cells=line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(cell=>cell.replaceAll('\\|','|').trim());if(cells.every(cell=>/^:?-{3,}:?$/.test(cell)))continue;if(/^(?:employee(?: name)?|name|crew member)$/i.test(cells[0])&&entries.length===0)continue;if(!cells[0]){if(cells.slice(1).some(Boolean))throw Error('A notes row has no employee name.');continue}entries.push({name:cells[0],note:cells.slice(1).join(' | ').trim()})}return entries;

  }

  const rows = parseClipboardTable(rawText).filter((cells,index)=>!(index===0&&/^(?:employee(?: name)?|name|crew member)$/i.test(cells[0])&&cells.length>1));

  const hasMultipleColumns = rows.some((cells) => cells.length > 1);
  if(rows.some(cells=>!cleanText(cells[0])&&cells.slice(1).some(Boolean)))throw Error('A notes row has no employee name.');

  if (hasMultipleColumns) {

    return rows

      .map((cells) => ({

        name: cleanText(cells[0]),

        note: cleanText(cells.slice(1).join(" ")),

      }))

      .filter((entry) => entry.name);

  }

  return splitBulkEmployeeEntries(rawText).map((entry) => ({

    name: entry,

    note: "",

  }));

}





export function parseCrewText(text,people,startTime='06:00',options={}){

 const entries=extractBulkEmployeeEntries(text),resolved=[],byId=new Map(),warnings=[];

 for(const entry of entries){const query=cleanText(entry.name).replace(/\s+/g,' ').toLowerCase();let matches=people.filter(p=>cleanText(p.name).replace(/\s+/g,' ').toLowerCase()===query);if(!matches.length){const q=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),boundary=new RegExp('(^|[^a-z0-9])'+q);matches=people.filter(p=>boundary.test(cleanText(p.name).toLowerCase()));if(matches.length!==1){const tokens=query.split(/\s+/),last=(tokens[1]||'').replace(/[^a-z]/g,'');matches=people.filter(p=>{const parts=cleanText(p.name).toLowerCase().split(/\s+/);return parts[0]===tokens[0]&&(!last||parts.at(-1).startsWith(last))})}}if(matches.length!==1){const warning=(matches.length?'Ambiguous':'Unknown')+' employee name: '+entry.name+'. Use the full name.';if(!options.partial)throw Error(warning);warnings.push(warning+' Skipped this entry.');continue;}const id=matches[0].key;if(!id)throw Error('Missing employee name.');let row=byId.get(id);if(!row){row={id,note:'',rx:false,training:false,earlyLate:false};byId.set(id,row);resolved.push(row)}if(entry.note&&!row.note.split(' | ').includes(entry.note))row.note+= (row.note?' | ':'')+entry.note;

 const note=entry.note.toLowerCase(),minutes=Number(startTime.slice(0,2))*60+Number(startTime.slice(3,5));row.rx ||= /\brx\b/.test(note);row.training ||= /\btrain|\btrainer\b|\bwork\s+(?:with|w\/)\b/.test(note);row.earlyLate ||= /\b(until|unitl|after)(?=\s|\d)/.test(note)&&!(/\b(?:until|unitl)\s+noon\b/.test(note)&&minutes<=360);}

 if(options.partial)resolved.warnings=warnings;return resolved;

}

export function formatCrewText(ids,notes,people){const quote=s=>/[\t\n\r"]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;return ids.map(id=>quote(people.find(p=>p.key===id)?.name||id)+'\t'+quote(notes[id]||'')).join('\n');}



// Display duration consistently; decimal hours use the same rounded minute count.

export function formatOnsiteDuration(value){

 const minutes=Math.round(value*60);

 return Math.floor(minutes/60)+'h '+String(minutes%60).padStart(2,'0')+'m ('+(minutes/60).toFixed(2)+' hrs)';

}
