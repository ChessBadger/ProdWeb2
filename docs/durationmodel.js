/* Shared, UI-independent duration model. Employee exports contain partial crews.
 * Never interpret their summed pieces or hours as complete inventory totals. */
globalThis.DurationModel = (() => {
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
      const assigned = role === "supervisor" ? roles.supervisor === id : (roles[role] || []).includes(id);
      if (assigned) factor = Math.min(factor, factors[modes[role]] ?? factors[DEFAULT_MODES[role]]);
    }
    const shrink = plan.shrink || {};
    if (shrink.mode === "all" || (shrink.mode === "selected" && (shrink.employeeIds || []).includes(id))) {
      factor *= Math.max(0.01, 1 - clamp(Number(shrink.percent) || 0, 0, 100) / 100);
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
