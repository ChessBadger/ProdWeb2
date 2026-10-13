/* Full physical attendance model. Historical mappings/revisions retain audit limitations. */
globalThis.FullOnsiteModel = (() => {
  const VERSION = 'full-onsite-v1-development';
  const TARGET = 'physical-first-arrival-last-departure-v1';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const median = xs => { const a=xs.filter(Number.isFinite).sort((a,b)=>a-b), n=a.length; return n ? (a[Math.floor((n-1)/2)]+a[Math.ceil((n-1)/2)])/2 : 0; };
  const id = x => /^\d+$/.test(String(x)) ? String(x).padStart(4,'0') : String(x || '');
  function validate(data) {
    if (data?.schemaVersion!==1 || data.target!==TARGET || !Array.isArray(data.jobs) || !data.aliases || !data.fingerprint) throw new Error('Unsupported full-attendance history');
    const keys=new Set();
    for(const j of data.jobs) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(j.date) || !(j.duration>0 && j.duration<=18) || !Number.isFinite(j.quantity) || !Array.isArray(j.employeeDetails) || !j.employees?.length || !j.storeId || keys.has(j.id)) throw new Error('Invalid or duplicate full-attendance visit');
      keys.add(j.id);
    }
    return data;
  }
  function context(data, cutoff) {
    const jobs=data.jobs.filter(j=>j.date<cutoff), stores=new Map(), accounts=new Map(), rates=new Map();
    for(const j of jobs) {
      for(const [map,key] of [[stores,j.storeId],[accounts,j.accountKey]]) { if(!map.has(key))map.set(key,[]);map.get(key).push(j); }
      for(const e of j.employeeDetails) if(e.hours>0 && e.quantity>0) {const key=j.accountKey+'|'+id(e.id);if(!rates.has(key))rates.set(key,[]);rates.get(key).push(e.quantity/e.hours);}
    }
    return {jobs,stores,accounts,rates,cutoff};
  }
  function predict(data, plan, config={}, prepared=null) {
    const cutoff=plan.historyCutoff || plan.date;
    const c=prepared || context(data,cutoff);
    if(c.cutoff!==cutoff)throw new Error('History cutoff mismatch');
    const storeId=plan.storeId || data.aliases[plan.storeKey];
    const own=c.stores.get(storeId)||[], account=c.accounts.get(plan.accountKey)||[];
    const refs=own.length ? [...own].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5) : account;
    if(!refs.length)return null;
    const expectedQuantity=median(refs.map(j=>j.quantity));
    const peers=[...c.stores].filter(([s,js])=>s!==storeId && js[0].accountKey===plan.accountKey).map(([s,js])=>({s,quantity:median(js.map(j=>j.quantity)),duration:median(js.map(j=>j.duration))})).sort((a,b)=>Math.abs(Math.log1p(a.quantity)-Math.log1p(expectedQuantity))-Math.abs(Math.log1p(b.quantity)-Math.log1p(expectedQuantity)) || a.s.localeCompare(b.s)).slice(0,3);
    const ownMedian=median(refs.map(j=>j.duration)), peerMedian=median(peers.map(j=>j.duration));
    const base=own.length && peers.length ? (ownMedian*own.length+peerMedian)/(own.length+1) : ownMedian;
    const accountRates=[...c.rates].filter(([key])=>key.startsWith(plan.accountKey+'|')).map(([,values])=>median(values));
    const fallbackRate=median(accountRates) || 1;
    const roles=plan.roles||{}, modes={supervisor:'p50',rx:'p50',training:'p70',earlyLate:'p50',...plan.modes};
    const factors={full:1,p70:.7,p50:.5,p30:.3,none:0};
    const currentIds=[...new Set((plan.employees||[]).map(id))];
    const factor=(employee,r,ms,shrink={})=>{
      let value=1;
      for(const role of ['supervisor','rx','training','earlyLate'])if(role==='supervisor'?id(r.supervisor)===employee:(r[role]||[]).map(id).includes(employee))value=Math.min(value,factors[ms[role]]??1);
      if(shrink.mode==='all'||shrink.mode==='selected'&&(shrink.employeeIds||[]).map(id).includes(employee))value*=1-clamp(Number(shrink.percent)||0,0,100)/100;
      return value;
    };
    const speed=employee=>clamp(median(c.rates.get(plan.accountKey+'|'+employee)||[])||fallbackRate,fallbackRate*.25,fallbackRate*4);
    const currentCapacity=currentIds.reduce((sum,e)=>sum+speed(e)*factor(e,roles,modes,plan.shrink),0);
    if(!currentIds.length || !(currentCapacity>0))return null;
    const referenceCapacity=median(refs.map(j=>j.employees.reduce((sum,e)=>sum+speed(id(e))*factor(id(e),{supervisor:j.supervisor,rx:j.rx},{supervisor:'p50',rx:'p50'}),0)));
    const elasticity=config.elasticity ?? .15;
    const adjustment=clamp(Math.pow(referenceCapacity/currentCapacity,elasticity),.65,1.6);
    const overhead=clamp(median(refs.map(j=>j.postCountHours).filter(Number.isFinite)) || .5,0,base*.5);
    // Optional known-at-planning-time workload override only. Actual job quantity is never passed here.
    const workload=Number.isFinite(plan.workloadPieces)&&plan.workloadPieces>0&&expectedQuantity>0 ? clamp(plan.workloadPieces/expectedQuantity,.5,2) : 1;
    const duration=clamp(overhead+Math.max(0,base-overhead)*workload*adjustment,.25,18);
    const uncertainty=config.uncertainty || data.calibration || {};
    const low=Number.isFinite(uncertainty.p10)?Math.min(0,uncertainty.p10):-Math.max(.5,duration*.3);
    const high=Number.isFinite(uncertainty.p90)?Math.max(0,uncertainty.p90):Math.max(.5,duration*.3);
    return {modelVersion:VERSION,target:TARGET,plan,config:{elasticity},onSiteDuration:duration,baseDuration:base,manHours:duration*currentIds.length,crewSize:currentIds.length,crewSpeed:currentCapacity,crewAdjustmentHours:duration-base,crewAdjustmentFactor:adjustment,baselineMethod:'prior workload peers and physical attendance',baselineSource:own.length?'full-attendance store history':'full-attendance account fallback',storeHistoryCount:own.length,matchingHistoryCount:refs.length,hasStoreHistory:!!own.length,confidenceLow:Math.max(0,duration+low),confidenceHigh:duration+high,rangeSampleCount:uncertainty.n||0,rangeMethod:uncertainty.n?'rolling-development-residuals':'sparse-history-heuristic',dataFingerprint:data.fingerprint,features:{cutoff,storeId,expectedQuantity,peerStores:peers.map(p=>p.s),referenceCapacity,currentCapacity,overhead,workload,knownEmployeeCount:currentIds.filter(e=>c.rates.has(plan.accountKey+'|'+e)).length,mappingConfidence:[...new Set(refs.map(j=>j.mappingConfidence))]},warning:'Historical development estimate; ±15-minute accuracy is not established.'};
  }
  return {VERSION,TARGET,validate,context,predict};
})();
