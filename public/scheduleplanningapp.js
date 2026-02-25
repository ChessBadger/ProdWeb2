const state = {
  rows: [],
  jobs: [],
  stores: new Map(),
  storeSegmentByStoreKey: new Map(),
  accountSegmentStats: new Map(),
  accountTypeStats: new Map(),
  accountOfficeStats: new Map(),
  accountGlobalStats: new Map(),
  employees: new Map(),
  suggestedSupervisorByStore: new Map(),
  global: {
    avgPieces: 0,
    medianPieces: 0,
    trimmedMeanPieces: 0,
    recentWeightedPieces: 0,
    durationStdDev: 0,
    robustDurationSpread: 0,
    overheadBaseP20: 0,
    medianEmployeeSpeed: 0,
  },
  storesList: [],
  storeLastCrew: new Map(),
  storeLastSupervisor: new Map(),
  selectedStoreKey: null,
  selectedRolesByStore: {},
  roleModesByStore: {},
  selectedEmployees: new Set(),
  visibleEmployees: [],
  compareAssignment: {
    storeA: "",
    storeB: "",
    storeAInput: "",
    storeBInput: "",
    goalMode: "manhours",
    goalA: 0,
    goalB: 0,
    supervisorA: "",
    supervisorB: "",
    supervisorAInput: "",
    supervisorBInput: "",
    employeeEntryInput: "",
    roleEntryInputs: {
      rx: "",
      training: "",
      earlyLate: "",
    },
    sharedRoles: { rx: [], training: [], earlyLate: [] },
    roleModes: {
      supervisorA: "p50",
      supervisorB: "p50",
      rx: "p50",
      training: "p70",
      earlyLate: "p50",
    },
    availableEmployees: new Set(),
  },
  planningMode: "duration",
  targetValue: 0,
  baseModelTuning: {
    overheadScale: 0.25,
    effSmall: 1.0,
    effMid: 0.92,
    effLarge: 0.85,
  },
  modelTuning: {
    overheadScale: 0.25,
    effSmall: 1.0,
    effMid: 0.92,
    effLarge: 0.85,
  },
  modelTuningByAccount: new Map(),
  modelTuningByAccountType: new Map(),
  modelTuningByAccountSegment: new Map(),
  baseBaselineTuning: {
    storeMode: "median",
    contextMode: "median",
    storeShrinkK: 4,
    minStoreWeight: 0.45,
    segmentWeight: 0.45,
    typeWeight: 0.2,
    officeWeight: 0.2,
    accountWeight: 0.1,
    globalWeight: 0.05,
  },
  baselineTuning: {
    storeMode: "median",
    contextMode: "median",
    storeShrinkK: 4,
    minStoreWeight: 0.45,
    segmentWeight: 0.45,
    typeWeight: 0.2,
    officeWeight: 0.2,
    accountWeight: 0.1,
    globalWeight: 0.05,
  },
  baselineTuningByAccount: new Map(),
  baselineTuningByAccountType: new Map(),
  baselineTuningByAccountSegment: new Map(),
  residualByStore: new Map(),
  residualByAccountSegment: new Map(),
  residualByAccountType: new Map(),
  residualByAccountOffice: new Map(),
  residualByAccount: new Map(),
  residualGlobal: {
    count: 0,
    mean: 0,
    p10: 0,
    p25: 0,
    p75: 0,
    p90: 0,
    stdDev: 0,
  },
  residualByStoreCrewBand: new Map(),
  residualByStoreSupervisor: new Map(),
  residualByAccountSupervisor: new Map(),
  residualByAccountSegmentCrewBand: new Map(),
  residualByAccountTypeCrewBand: new Map(),
  residualByAccountCrewBand: new Map(),
  residualGlobalCrewBand: new Map(),
  manHourResidualByStore: new Map(),
  manHourResidualByAccountSegment: new Map(),
  manHourResidualByAccountType: new Map(),
  manHourResidualByAccountOffice: new Map(),
  manHourResidualByAccount: new Map(),
  manHourResidualGlobal: {
    count: 0,
    mean: 0,
    p10: 0,
    p25: 0,
    p75: 0,
    p90: 0,
    stdDev: 0,
  },
  manHourResidualByStoreCrewBand: new Map(),
  manHourResidualByStoreSupervisor: new Map(),
  manHourResidualByAccountSupervisor: new Map(),
  manHourResidualByAccountSegmentCrewBand: new Map(),
  manHourResidualByAccountTypeCrewBand: new Map(),
  manHourResidualByAccountCrewBand: new Map(),
  manHourResidualGlobalCrewBand: new Map(),
  uncertaintyScale: 1,
  backtestMetrics: {
    durationMae: 0,
    manHoursMae: 0,
    jobs: 0,
    splitDate: "",
  },
  accuracyCache: null,
  residualShrinkageKs: {
    account: 24,
    segment: 14,
    type: 16,
    store: 8,
  },
  residualProfilesByDensity: {
    dense: {
      ks: {
        account: 24,
        segment: 14,
        type: 16,
        office: 16,
        store: 8,
        accountSupervisor: 10,
        storeSupervisor: 6,
        globalBand: 18,
        accountBand: 14,
        segmentBand: 12,
        typeBand: 12,
        storeBand: 8,
      },
      floors: {
        minStoreWeight: 0.3,
        anchorMinShare: 0.4,
        anchorMinWeight: 0.35,
        anchorK: 8,
        anchorMaxAbsHours: 0.7,
      },
      mins: {
        storeBand: 5,
        storeSupervisor: 6,
        store: 8,
        accountSupervisor: 10,
        segmentBand: 10,
        segment: 16,
        typeBand: 12,
        type: 18,
        office: 16,
        accountBand: 16,
        account: 24,
        globalBand: 20,
      },
    },
    sparse: {
      ks: {
        account: 12,
        segment: 8,
        type: 8,
        office: 8,
        store: 5,
        accountSupervisor: 6,
        storeSupervisor: 4,
        globalBand: 12,
        accountBand: 8,
        segmentBand: 8,
        typeBand: 8,
        storeBand: 5,
      },
      floors: {
        minStoreWeight: 0.45,
        anchorMinShare: 0.55,
        anchorMinWeight: 0.45,
        anchorK: 6,
        anchorMaxAbsHours: 0.9,
      },
      mins: {
        storeBand: 3,
        storeSupervisor: 4,
        store: 5,
        accountSupervisor: 6,
        segmentBand: 6,
        segment: 8,
        typeBand: 8,
        type: 10,
        office: 8,
        accountBand: 8,
        account: 12,
        globalBand: 12,
      },
    },
  },
  manHourShrinkageKs: {
    account: 26,
    segment: 16,
    type: 18,
    store: 10,
  },
  analyticsReady: false,
  analyticsScheduled: false,
  dataFingerprint: "",
  lastDurationResidualByStore: new Map(),
  lastCrewAppliedStoreKey: null,
  isLoaded: false,
};

const STORAGE_KEY = "crew_predictor_v2";
const ANALYTICS_CACHE_KEY = "crew_predictor_analytics_v1";
const DATA_JSON_PATH = "EmployeeProductionExport.json";
const DEFAULT_EMPLOYEE_RENDER_LIMIT = 150;
const DEFAULT_COMPARE_EMPLOYEE_RENDER_LIMIT = 120;

const dom = {
  storeSearch: document.getElementById("storeSearch"),
  clearStoreSearchBtn: document.getElementById("clearStoreSearchBtn"),
  storeSelect: document.getElementById("storeSelect"),
  storeSelectMeta: document.getElementById("storeSelectMeta"),
  storeStats: document.getElementById("storeStats"),
  planningMode: document.getElementById("planningMode"),
  targetValue: document.getElementById("targetValue"),
  supervisorEmployee: document.getElementById("supervisorEmployee"),
  supervisorMode: document.getElementById("supervisorMode"),
  rxEmployee: document.getElementById("rxEmployee"),
  rxMode: document.getElementById("rxMode"),
  trainingEmployee: document.getElementById("trainingEmployee"),
  trainingMode: document.getElementById("trainingMode"),
  earlyLateEmployee: document.getElementById("earlyLateEmployee"),
  earlyLateMode: document.getElementById("earlyLateMode"),
  employeeFilter: document.getElementById("employeeFilter"),
  employeeList: document.getElementById("employeeList"),
  lastCrewBtn: document.getElementById("lastCrewBtn"),
  clearEmployeesBtn: document.getElementById("clearEmployeesBtn"),
  predDuration: document.getElementById("predDuration"),
  predManHours: document.getElementById("predManHours"),
  predBand: document.getElementById("predBand"),
  predDelta: document.getElementById("predDelta"),
  predictionMeta: document.getElementById("predictionMeta"),
  scenarioBody: document.getElementById("scenarioBody"),
  storeAccuracySummary: document.getElementById("storeAccuracySummary"),
  accuracyAccountFilter: document.getElementById("accuracyAccountFilter"),
  computeAccuracyBtn: document.getElementById("computeAccuracyBtn"),
  accuracySummary: document.getElementById("accuracySummary"),
  accuracyWorstBody: document.getElementById("accuracyWorstBody"),
  compareStoreA: document.getElementById("compareStoreA"),
  compareStoreB: document.getElementById("compareStoreB"),
  compareSection: document.getElementById("compareSection"),
  compareSectionBody: document.getElementById("compareSectionBody"),
  compareToggleBtn: document.getElementById("compareToggleBtn"),
  compareStoreOptions: document.getElementById("compareStoreOptions"),
  compareGoalMode: document.getElementById("compareGoalMode"),
  compareGoalALabel: document.getElementById("compareGoalALabel"),
  compareGoalBLabel: document.getElementById("compareGoalBLabel"),
  compareGoalA: document.getElementById("compareGoalA"),
  compareGoalB: document.getElementById("compareGoalB"),
  compareSupervisorA: document.getElementById("compareSupervisorA"),
  compareSupervisorB: document.getElementById("compareSupervisorB"),
  compareSupervisorModeA: document.getElementById("compareSupervisorModeA"),
  compareSupervisorModeB: document.getElementById("compareSupervisorModeB"),
  compareClearEmployeesBtn: document.getElementById("compareClearEmployeesBtn"),
  compareSuggestBtn: document.getElementById("compareSuggestBtn"),
  compareEmployeeFilter: document.getElementById("compareEmployeeFilter"),
  compareEmployeeList: document.getElementById("compareEmployeeList"),
  compareRxEmployee: document.getElementById("compareRxEmployee"),
  compareRxMode: document.getElementById("compareRxMode"),
  compareTrainingEmployee: document.getElementById("compareTrainingEmployee"),
  compareTrainingMode: document.getElementById("compareTrainingMode"),
  compareEarlyLateEmployee: document.getElementById("compareEarlyLateEmployee"),
  compareEarlyLateMode: document.getElementById("compareEarlyLateMode"),
  compareMeta: document.getElementById("compareMeta"),
  compareResultCard: document.getElementById("compareResultCard"),
  compareResult: document.getElementById("compareResult"),
  computeWaitOverlay: document.getElementById("computeWaitOverlay"),
  computeWaitOverlayText: document.getElementById("computeWaitOverlayText"),
};

initialize();

function initialize() {
  disableInputAutofill();
  bindEvents();
  restoreSettingsFromStorage();
  renderStoreSelect();
  renderEmployeeList();
  updateResults();
  loadJsonData();
}

function showComputeWaitOverlay(message) {
  if (!dom.computeWaitOverlay) return;
  if (dom.computeWaitOverlayText && message) {
    dom.computeWaitOverlayText.textContent = message;
  }
  dom.computeWaitOverlay.classList.remove("is-hidden");
}

function hideComputeWaitOverlay() {
  dom.computeWaitOverlay?.classList.add("is-hidden");
}

function disableInputAutofill() {
  document.querySelectorAll("input").forEach((input) => {
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("spellcheck", "false");
  });
}

function bindEvents() {
  dom.storeSearch.addEventListener("input", renderStoreSelect);
  dom.clearStoreSearchBtn.addEventListener("click", clearStoreSearch);
  dom.storeSelect.addEventListener("change", onStoreChange);
  dom.planningMode.addEventListener("change", onPlanningInputChange);
  dom.targetValue.addEventListener("input", onPlanningInputChange);
  dom.supervisorEmployee.addEventListener("change", onRoleConfigChange);
  dom.supervisorMode.addEventListener("change", onRoleConfigChange);
  dom.rxMode.addEventListener("change", onRoleConfigChange);
  dom.trainingMode.addEventListener("change", onRoleConfigChange);
  dom.earlyLateMode.addEventListener("change", onRoleConfigChange);
  dom.rxEmployee.addEventListener("change", onRoleConfigChange);
  dom.trainingEmployee.addEventListener("change", onRoleConfigChange);
  dom.earlyLateEmployee.addEventListener("change", onRoleConfigChange);
  dom.employeeFilter.addEventListener("input", renderEmployeeList);
  dom.employeeFilter.addEventListener("keydown", onEmployeeFilterKeyDown);
  dom.lastCrewBtn.addEventListener("click", selectLastCrew);
  dom.clearEmployeesBtn.addEventListener("click", clearEmployees);
  dom.accuracyAccountFilter.addEventListener("change", onAccuracyFilterChange);
  dom.computeAccuracyBtn?.addEventListener("click", onComputeAccuracyClick);
  dom.compareStoreA.addEventListener("change", onCompareInputChange);
  dom.compareStoreB.addEventListener("change", onCompareInputChange);
  dom.compareToggleBtn.addEventListener("click", toggleCompareSection);
  dom.compareGoalMode.addEventListener("change", onCompareInputChange);
  dom.compareGoalA.addEventListener("input", onCompareInputChange);
  dom.compareGoalB.addEventListener("input", onCompareInputChange);
  dom.compareSupervisorA.addEventListener("change", onCompareInputChange);
  dom.compareSupervisorB.addEventListener("change", onCompareInputChange);
  dom.compareSupervisorModeA.addEventListener("change", onCompareInputChange);
  dom.compareSupervisorModeB.addEventListener("change", onCompareInputChange);
  dom.compareEmployeeFilter.addEventListener("input", renderCompareEmployeeList);
  dom.compareEmployeeFilter.addEventListener(
    "keydown",
    onCompareEmployeeFilterKeyDown,
  );
  dom.compareRxEmployee.addEventListener("change", onCompareInputChange);
  dom.compareTrainingEmployee.addEventListener("change", onCompareInputChange);
  dom.compareEarlyLateEmployee.addEventListener("change", onCompareInputChange);
  dom.compareRxMode.addEventListener("change", onCompareInputChange);
  dom.compareTrainingMode.addEventListener("change", onCompareInputChange);
  dom.compareEarlyLateMode.addEventListener("change", onCompareInputChange);
  dom.compareClearEmployeesBtn.addEventListener("click", clearCompareEmployees);
  dom.compareSuggestBtn.addEventListener("click", suggestTwoStoreAssignment);
}

async function loadJsonData() {
  try {
    const response = await fetch(DATA_JSON_PATH, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const rawJsonText = await response.text();
    const fingerprint = buildDataFingerprintFromJsonText(rawJsonText);
    const payload = JSON.parse(rawJsonText);
    const rawRows = extractRowsFromJson(payload);
    loadRows(rawRows, fingerprint);
  } catch (error) {
    const message = error?.message || "Unknown error";
    setPredictionMeta(`Data load failed: ${message}`, "warning");
    hideComputeWaitOverlay();
  }
}

function extractRowsFromJson(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const firstArray = Object.values(payload).find((value) =>
      Array.isArray(value),
    );
    if (firstArray) {
      return firstArray;
    }
  }

  return [];
}

function loadRows(rawRows, dataFingerprint = "") {
  const normalizedRows = rawRows.map(normalizeRow).filter((r) => r.valid);

  state.rows = normalizedRows;
  state.jobs = buildJobs(normalizedRows);
  state.stores = buildStoreStats(state.jobs);
  state.storeSegmentByStoreKey = buildStoreSegments(state.stores);
  applySegmentsToStores(state.stores, state.storeSegmentByStoreKey);
  state.accountSegmentStats = buildAccountSegmentStats(state.jobs);
  state.accountTypeStats = buildAccountTypeStats(state.jobs);
  state.accountOfficeStats = buildAccountOfficeStats(state.jobs);
  state.accountGlobalStats = buildAccountGlobalStats(state.jobs);
  state.employees = buildEmployeeStats(normalizedRows);
  state.suggestedSupervisorByStore = buildStoreSupervisorMap(normalizedRows);
  state.global = buildGlobalStats(state.jobs, state.employees);
  state.storeLastCrew = buildStoreLastCrew(state.jobs);
  state.storeLastSupervisor = buildStoreLastSupervisor(normalizedRows);
  state.storesList = Array.from(state.stores.values()).sort((a, b) => {
    const left = `${a.account} ${a.storeName}`.toLowerCase();
    const right = `${b.account} ${b.storeName}`.toLowerCase();
    return left.localeCompare(right);
  });
  state.analyticsReady = false;
  state.analyticsScheduled = false;
  state.dataFingerprint = dataFingerprint || "";
  state.accuracyCache = null;
  state.isLoaded = true;

  restoreSelectionsFromStorage();
  refreshLoadedUi();
  const restored = restoreAnalyticsCache(state.dataFingerprint);
  if (restored) {
    state.analyticsReady = true;
    if (dom.computeAccuracyBtn) {
      dom.computeAccuracyBtn.disabled = true;
      dom.computeAccuracyBtn.textContent = "Accuracy Ready (Cached)";
    }
    renderAccuracyReport();
    updateResults();
    hideComputeWaitOverlay();
    return;
  }
  scheduleDeferredAnalytics();
}

function normalizeRow(row) {
  const normalized = {};
  Object.keys(row || {}).forEach((key) => {
    normalized[canonicalizeKey(key)] = row[key];
  });

  const date = normalizeDateString(firstValue(normalized, ["dateofinv"]));
  const store = cleanText(firstValue(normalized, ["storename"]));
  const account =
    cleanText(firstValue(normalized, ["account", "accountname"])) ||
    "Unknown Account";
  const employee = cleanText(firstValue(normalized, ["employee"]));
  const firstName = cleanText(firstValue(normalized, ["firstname"]));
  const lastName = cleanText(firstValue(normalized, ["lastname"]));
  const combinedName = `${firstName} ${lastName}`.trim();
  const employeeName = combinedName || employee;
  const type = normalizeInventoryType(
    cleanText(firstValue(normalized, ["typeofinv"])) || "Unknown",
  );
  const officeName = cleanText(firstValue(normalized, ["officename"])) || "Unknown";
  const role = cleanText(
    firstValue(normalized, ["role", "employeerole", "position", "jobtitle"]),
  ).toLowerCase();
  const supervisorNumber = cleanText(
    firstValue(normalized, ["supervisornumber"]),
  );

  const manHours = toNumber(
    firstValue(normalized, ["manhrs", "manhr", "expr1"]),
  );
  const totalExtQty = toNumber(firstValue(normalized, ["totalextqty"]));
  const piecesPerHr = toNumber(firstValue(normalized, ["piecesperhr"]));

  const storeKey = `${account}||${store}`;
  const jobKey = `${date}||${account}||${store}`;
  const valid = Boolean(date && store && employee);

  return {
    valid,
    date,
    account,
    store,
    storeKey,
    employee,
    employeeName,
    type,
    officeName,
    role,
    supervisorNumber,
    manHours,
    totalExtQty,
    piecesPerHr,
    jobKey,
  };
}

function buildJobs(rows) {
  const jobs = new Map();

  rows.forEach((row) => {
    if (!jobs.has(row.jobKey)) {
      jobs.set(row.jobKey, {
        date: row.date,
        account: row.account,
        storeName: row.store,
        storeKey: row.storeKey,
        typeOfInv: row.type,
        officeName: row.officeName || "Unknown",
        supervisorNumber: cleanText(row.supervisorNumber),
        supervisorCounts: new Map(),
        employees: new Set(),
        totalPieces: 0,
        totalManHours: 0,
        duration: 0,
      });
    }

    const job = jobs.get(row.jobKey);
    const supervisorId = cleanText(row.supervisorNumber);
    if (supervisorId) {
      job.supervisorCounts.set(
        supervisorId,
        (job.supervisorCounts.get(supervisorId) || 0) + 1,
      );
      if (!job.supervisorNumber) {
        job.supervisorNumber = supervisorId;
      }
    }
    if (row.officeName && row.officeName !== "Unknown") {
      job.officeName = row.officeName;
    }
    job.employees.add(row.employee);
    job.totalPieces += safeNumber(row.totalExtQty);
    job.totalManHours += safeNumber(row.manHours);
    job.duration = Math.max(job.duration, safeNumber(row.manHours));
  });

  return Array.from(jobs.values()).map((job) => ({
    ...job,
    crewSize: job.employees.size,
    employees: Array.from(job.employees),
    supervisorNumber: resolveMostFrequentKey(job.supervisorCounts, job.supervisorNumber),
    supervisorCounts: undefined,
  }));
}

function buildStoreStats(jobs) {
  const grouped = new Map();

  jobs.forEach((job) => {
    if (!grouped.has(job.storeKey)) {
      grouped.set(job.storeKey, {
        storeKey: job.storeKey,
        account: job.account,
        storeName: job.storeName,
        jobs: [],
        typeCounts: new Map(),
      });
    }

    const bucket = grouped.get(job.storeKey);
    bucket.jobs.push(job);
    bucket.typeCounts.set(
      job.typeOfInv,
      (bucket.typeCounts.get(job.typeOfInv) || 0) + 1,
    );
  });

  const stores = new Map();
  grouped.forEach((bucket, storeKey) => {
    const primaryType =
      Array.from(bucket.typeCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0] || "Unknown";
    const summary = summarizeJobGroup(bucket.jobs);

    stores.set(storeKey, {
      storeKey,
        account: bucket.account,
        storeName: bucket.storeName,
        officeName: bucket.jobs[0]?.officeName || "Unknown",
        avgPieces: summary.avgPieces,
      medianPieces: summary.medianPieces,
      trimmedMeanPieces: summary.trimmedMeanPieces,
      recentWeightedPieces: summary.recentWeightedPieces,
      avgDuration: summary.avgDuration,
      medianDuration: summary.medianDuration,
      avgManHours: summary.avgManHours,
      durationStdDev: summary.durationStdDev,
      robustDurationSpread: summary.robustDurationSpread,
      overheadBaseP20: summary.overheadBaseP20,
      jobCount: bucket.jobs.length,
      primaryType,
    });
  });

  return stores;
}

function buildStoreSegments(stores) {
  const byAccount = new Map();
  stores.forEach((store, storeKey) => {
    if (!byAccount.has(store.account)) byAccount.set(store.account, []);
    byAccount.get(store.account).push({
      storeKey,
      sizeSignal: getStoreSizeSignal(store),
    });
  });

  const storeToSegment = new Map();
  byAccount.forEach((entries, account) => {
    const sorted = [...entries].sort((a, b) => a.sizeSignal - b.sizeSignal);
    const segmentCount = resolveSegmentCount(sorted.length);
    sorted.forEach((item, idx) => {
      const bucket = Math.min(
        segmentCount - 1,
        Math.floor((idx * segmentCount) / Math.max(1, sorted.length)),
      );
      const segmentId = `S${bucket + 1}`;
      const segmentKey = `${account}||${segmentId}`;
      storeToSegment.set(item.storeKey, { segmentId, segmentKey });
    });
  });
  return storeToSegment;
}

function getStoreSizeSignal(store) {
  const robust = chooseRobustBaseline(store);
  if (robust > 0) return robust;
  if (store?.medianPieces > 0) return store.medianPieces;
  if (store?.avgPieces > 0) return store.avgPieces;
  return 0;
}

function resolveSegmentCount(storeCount) {
  if (storeCount >= 18) return 4;
  if (storeCount >= 9) return 3;
  if (storeCount >= 4) return 2;
  return 1;
}

function applySegmentsToStores(stores, storeSegmentByStoreKey) {
  stores.forEach((store, storeKey) => {
    const segment = storeSegmentByStoreKey.get(storeKey) || {
      segmentId: "S1",
      segmentKey: `${store.account}||S1`,
    };
    store.segmentId = segment.segmentId;
    store.segmentKey = segment.segmentKey;
  });
}

function buildAccountSegmentStats(jobs) {
  const grouped = new Map();
  jobs.forEach((job) => {
    const segmentKey = state.storeSegmentByStoreKey.get(job.storeKey)?.segmentKey;
    if (!segmentKey) return;
    if (!grouped.has(segmentKey)) grouped.set(segmentKey, []);
    grouped.get(segmentKey).push(job);
  });

  const stats = new Map();
  grouped.forEach((jobGroup, key) => {
    const summary = summarizeJobGroup(jobGroup);
    stats.set(key, {
      avgPieces: summary.avgPieces,
      medianPieces: summary.medianPieces,
      trimmedMeanPieces: summary.trimmedMeanPieces,
      recentWeightedPieces: summary.recentWeightedPieces,
      avgDuration: summary.avgDuration,
      robustDurationSpread: summary.robustDurationSpread,
      overheadBaseP20: summary.overheadBaseP20,
      jobCount: summary.jobCount,
    });
  });
  return stats;
}

function buildAccountTypeStats(jobs) {
  const map = new Map();

  jobs.forEach((job) => {
    const key = `${job.account}||${job.typeOfInv || "Unknown"}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(job);
  });

  const stats = new Map();
  map.forEach((jobGroup, key) => {
    const summary = summarizeJobGroup(jobGroup);
    stats.set(key, {
      avgPieces: summary.avgPieces,
      medianPieces: summary.medianPieces,
      trimmedMeanPieces: summary.trimmedMeanPieces,
      recentWeightedPieces: summary.recentWeightedPieces,
      avgDuration: summary.avgDuration,
      robustDurationSpread: summary.robustDurationSpread,
      overheadBaseP20: summary.overheadBaseP20,
      jobCount: summary.jobCount,
    });
  });
  return stats;
}

function buildAccountOfficeStats(jobs) {
  const map = new Map();

  jobs.forEach((job) => {
    const key = `${job.account}||${job.officeName || "Unknown"}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(job);
  });

  const stats = new Map();
  map.forEach((jobGroup, key) => {
    const summary = summarizeJobGroup(jobGroup);
    stats.set(key, {
      avgPieces: summary.avgPieces,
      medianPieces: summary.medianPieces,
      trimmedMeanPieces: summary.trimmedMeanPieces,
      recentWeightedPieces: summary.recentWeightedPieces,
      avgDuration: summary.avgDuration,
      robustDurationSpread: summary.robustDurationSpread,
      overheadBaseP20: summary.overheadBaseP20,
      jobCount: summary.jobCount,
    });
  });
  return stats;
}

function buildAccountGlobalStats(jobs) {
  const map = new Map();

  jobs.forEach((job) => {
    if (!map.has(job.account)) map.set(job.account, []);
    map.get(job.account).push(job);
  });

  const stats = new Map();
  map.forEach((jobGroup, account) => {
    const summary = summarizeJobGroup(jobGroup);
    stats.set(account, {
      avgPieces: summary.avgPieces,
      medianPieces: summary.medianPieces,
      trimmedMeanPieces: summary.trimmedMeanPieces,
      recentWeightedPieces: summary.recentWeightedPieces,
      avgDuration: summary.avgDuration,
      robustDurationSpread: summary.robustDurationSpread,
      overheadBaseP20: summary.overheadBaseP20,
      jobCount: summary.jobCount,
    });
  });
  return stats;
}

function buildEmployeeStats(rows) {
  const grouped = new Map();
  const maxRowTimestamp = (rows || [])
    .map((row) => Date.parse(row.date || ""))
    .filter((ts) => Number.isFinite(ts))
    .reduce((max, ts) => Math.max(max, ts), 0);
  const referenceTimestamp =
    maxRowTimestamp > 0 ? maxRowTimestamp : Date.now();

  rows.forEach((row) => {
    // Exclude rows where the employee was the listed supervisor for that inventory.
    // This keeps supervisor-assignment days from biasing counter productivity history.
    const isSupervisorRunRow =
      cleanText(row.employee).toLowerCase() !== "" &&
      cleanText(row.supervisorNumber).toLowerCase() !== "" &&
      cleanText(row.employee).toLowerCase() ===
        cleanText(row.supervisorNumber).toLowerCase();
    if (isSupervisorRunRow) {
      return;
    }

    if (!grouped.has(row.employee)) {
      grouped.set(row.employee, {
        employee: row.employee,
        weightedSpeedSumGlobal: 0,
        weightSumGlobal: 0,
        recentWeightedSpeedSumGlobal: 0,
        recentWeightSumGlobal: 0,
        jobKeysGlobal: new Set(),
        accountBuckets: new Map(),
        nameCounts: new Map(),
      });
    }

    const speed = inferSpeed(row);
    const weight = inferWeight(row);
    const rowTimestamp = Date.parse(row.date || "");
    const ageDays = Number.isFinite(rowTimestamp)
      ? Math.max(0, (referenceTimestamp - rowTimestamp) / 86400000)
      : 0;
    const recencyWeight = weight * recencyDecayWeight(ageDays);
    const bucket = grouped.get(row.employee);

    if (speed > 0 && weight > 0) {
      bucket.weightedSpeedSumGlobal += speed * weight;
      bucket.weightSumGlobal += weight;
      bucket.recentWeightedSpeedSumGlobal += speed * recencyWeight;
      bucket.recentWeightSumGlobal += recencyWeight;
    }

    bucket.jobKeysGlobal.add(row.jobKey);

    if (!bucket.accountBuckets.has(row.account)) {
      bucket.accountBuckets.set(row.account, {
        weightedSpeedSum: 0,
        weightSum: 0,
        recentWeightedSpeedSum: 0,
        recentWeightSum: 0,
        jobKeys: new Set(),
      });
    }
    const accountBucket = bucket.accountBuckets.get(row.account);
    if (speed > 0 && weight > 0) {
      accountBucket.weightedSpeedSum += speed * weight;
      accountBucket.weightSum += weight;
      accountBucket.recentWeightedSpeedSum += speed * recencyWeight;
      accountBucket.recentWeightSum += recencyWeight;
    }
    accountBucket.jobKeys.add(row.jobKey);

    if (row.employeeName) {
      bucket.nameCounts.set(
        row.employeeName,
        (bucket.nameCounts.get(row.employeeName) || 0) + 1,
      );
    }
  });

  const stats = new Map();
  grouped.forEach((bucket, employee) => {
    const displayName = getMostFrequentName(bucket.nameCounts, employee);
    const accountStats = {};
    bucket.accountBuckets.forEach((accountBucket, account) => {
      accountStats[account] = {
        avgPiecesPerHr:
          accountBucket.weightSum > 0
            ? accountBucket.weightedSpeedSum / accountBucket.weightSum
            : 0,
        avgPiecesPerHrRecent:
          accountBucket.recentWeightSum > 0
            ? accountBucket.recentWeightedSpeedSum / accountBucket.recentWeightSum
            : 0,
        jobCount: accountBucket.jobKeys.size,
      };
    });

    stats.set(employee, {
      employee,
      displayName,
      avgPiecesPerHrGlobal:
        bucket.weightSumGlobal > 0
          ? bucket.weightedSpeedSumGlobal / bucket.weightSumGlobal
          : 0,
      avgPiecesPerHrRecentGlobal:
        bucket.recentWeightSumGlobal > 0
          ? bucket.recentWeightedSpeedSumGlobal / bucket.recentWeightSumGlobal
          : 0,
      globalJobCount: bucket.jobKeysGlobal.size,
      accountStats,
    });
  });

  return stats;
}

function buildStoreSupervisorMap(rows) {
  const byStore = new Map();

  rows.forEach((row) => {
    if (!byStore.has(row.storeKey)) {
      byStore.set(row.storeKey, new Map());
    }

    const counts = byStore.get(row.storeKey);
    const supervisorId = cleanText(row.supervisorNumber).toLowerCase();
    if (supervisorId) {
      counts.set(supervisorId, (counts.get(supervisorId) || 0) + 1);
    }

    if (isSupervisorRole(row.role)) {
      const roleBasedId = cleanText(row.employee).toLowerCase();
      if (roleBasedId) {
        counts.set(roleBasedId, (counts.get(roleBasedId) || 0) + 1);
      }
    }
  });

  const result = new Map();
  byStore.forEach((counts, storeKey) => {
    let bestId = "";
    let bestCount = -1;
    counts.forEach((count, id) => {
      if (count > bestCount) {
        bestId = id;
        bestCount = count;
      }
    });
    if (bestId) {
      result.set(storeKey, bestId);
    }
  });

  return result;
}

function buildGlobalStats(jobs, employees) {
  const summary = summarizeJobGroup(jobs);
  const speeds = Array.from(employees.values())
    .map((e) => e.avgPiecesPerHrGlobal)
    .filter((v) => v > 0);

  return {
    avgPieces: summary.avgPieces,
    medianPieces: summary.medianPieces,
    trimmedMeanPieces: summary.trimmedMeanPieces,
    recentWeightedPieces: summary.recentWeightedPieces,
    durationStdDev: summary.durationStdDev,
    robustDurationSpread: summary.robustDurationSpread,
    overheadBaseP20: summary.overheadBaseP20,
    medianEmployeeSpeed: median(speeds),
  };
}

function buildStoreLastCrew(jobs) {
  const sorted = [...jobs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const map = new Map();

  sorted.forEach((job) => {
    if (!map.has(job.storeKey)) {
      map.set(job.storeKey, job.employees);
    }
  });

  return map;
}

function buildStoreLastSupervisor(rows) {
  const latestByStore = new Map();
  (rows || []).forEach((row) => {
    const storeKey = row.storeKey;
    const supervisor = cleanText(row.supervisorNumber);
    if (!storeKey || !supervisor) return;
    const prev = latestByStore.get(storeKey);
    const currentDate = row.date || "";
    if (!prev || currentDate > prev.date) {
      latestByStore.set(storeKey, {
        date: currentDate,
        counts: new Map([[supervisor, 1]]),
      });
      return;
    }
    if (currentDate === prev.date) {
      prev.counts.set(supervisor, (prev.counts.get(supervisor) || 0) + 1);
    }
  });

  const result = new Map();
  latestByStore.forEach((entry, storeKey) => {
    let bestSupervisor = "";
    let bestCount = -1;
    entry.counts.forEach((count, supervisor) => {
      if (count > bestCount) {
        bestSupervisor = supervisor;
        bestCount = count;
      }
    });
    if (bestSupervisor) result.set(storeKey, bestSupervisor);
  });
  return result;
}

function refreshLoadedUi() {
  renderStoreSelect();
  renderRoleSelectors();
  renderAccuracyAccountFilter();
  syncAccuracyFilterToSelectedStore();
  renderEmployeeList();
  renderComparePlanner();
  updateResults();
  renderAccuracyReport();
}

function createUiYieldController(maxSliceMs = 12) {
  const now = () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  let last = now();
  return async function maybeYield(force = false) {
    const current = now();
    if (force || current - last >= maxSliceMs) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      last = now();
    }
  };
}

async function scheduleDeferredAnalytics() {
  if (state.analyticsReady || state.analyticsScheduled || !state.jobs.length) {
    hideComputeWaitOverlay();
    renderAccuracyReport();
    return;
  }
  state.analyticsScheduled = true;
  showComputeWaitOverlay(
    "Please wait while we compute the initial accuracy snapshot. This first run may take a few minutes.",
  );
  if (dom.computeAccuracyBtn) {
    dom.computeAccuracyBtn.disabled = true;
    dom.computeAccuracyBtn.textContent = "Computing...";
  }
  dom.accuracySummary.textContent = "Computing accuracy snapshot...";
  dom.storeAccuracySummary.textContent = "Computing selected store accuracy...";
  try {
    await calibrateModelParameters();
    await buildResidualStats(state.jobs);
    state.accuracyCache = await buildAccuracyCache(state.jobs);
    persistAnalyticsCache(state.dataFingerprint);
    state.analyticsReady = true;
    if (dom.computeAccuracyBtn) {
      dom.computeAccuracyBtn.disabled = true;
      dom.computeAccuracyBtn.textContent = "Accuracy Ready";
    }
    renderAccuracyReport();
    updateResults();
  } catch (_error) {
    state.analyticsReady = false;
    if (dom.computeAccuracyBtn) {
      dom.computeAccuracyBtn.disabled = false;
      dom.computeAccuracyBtn.textContent = "Retry Accuracy";
    }
    dom.accuracySummary.textContent =
      "Accuracy processing failed. Predictions remain available.";
    dom.storeAccuracySummary.textContent =
      "Accuracy details are unavailable right now.";
  } finally {
    state.analyticsScheduled = false;
    hideComputeWaitOverlay();
  }
}

function onAccuracyFilterChange() {
  renderAccuracyReport();
}

function onComputeAccuracyClick() {
  scheduleDeferredAnalytics();
}

function renderAccuracyAccountFilter() {
  const previous = dom.accuracyAccountFilter.value || "__all__";
  const accounts = Array.from(
    new Set(state.storesList.map((s) => s.account)),
  ).sort((a, b) => a.localeCompare(b));

  dom.accuracyAccountFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "__all__";
  allOption.textContent = "All Accounts";
  dom.accuracyAccountFilter.appendChild(allOption);

  accounts.forEach((account) => {
    const opt = document.createElement("option");
    opt.value = account;
    opt.textContent = account;
    dom.accuracyAccountFilter.appendChild(opt);
  });

  const validValues = new Set(["__all__", ...accounts]);
  dom.accuracyAccountFilter.value = validValues.has(previous)
    ? previous
    : "__all__";
}

function renderStoreSelect() {
  const previousStoreKey = state.selectedStoreKey;
  const query = (dom.storeSearch.value || "").trim().toLowerCase();
  const filtered = state.storesList.filter((s) =>
    `${s.account} ${s.storeName}`.toLowerCase().includes(query),
  );

  dom.storeSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Select Store --";
  dom.storeSelect.appendChild(placeholder);

  filtered.forEach((store) => {
    const option = document.createElement("option");
    option.value = store.storeKey;
    option.textContent = `${store.account} | ${store.storeName} | ${store.jobCount} jobs | ${formatNumber(store.medianPieces, 0)} pcs`;
    option.title = `${store.account} | ${store.storeName}`;
    option.selected = store.storeKey === state.selectedStoreKey;
    dom.storeSelect.appendChild(option);
  });

  if (
    state.selectedStoreKey &&
    !filtered.some((f) => f.storeKey === state.selectedStoreKey)
  ) {
    state.selectedStoreKey = null;
  }

  const storeChanged = state.selectedStoreKey !== previousStoreKey;
  if (storeChanged) {
    resetPlanInputsForNewStore();
  }

  dom.storeSelect.value = state.selectedStoreKey || "";
  const selected = state.stores.get(state.selectedStoreKey);
  dom.storeSelectMeta.textContent = selected
    ? `Showing ${filtered.length} of ${state.storesList.length} stores. Selected: ${selected.account} | ${selected.storeName}`
    : `Showing ${filtered.length} of ${state.storesList.length} stores.`;
  if (!storeChanged) renderStoreStats();
}

function onStoreChange() {
  const previousStoreKey = state.selectedStoreKey;
  state.selectedStoreKey = dom.storeSelect.value || null;
  if (state.selectedStoreKey !== previousStoreKey) {
    resetPlanInputsForNewStore();
  }
  syncAccuracyFilterToSelectedStore();
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  persistToStorage();
  renderEmployeeList();
  updateResults();
  renderAccuracyReport();
}

function resetPlanInputsForNewStore() {
  state.selectedEmployees.clear();
  state.visibleEmployees = [];
  dom.employeeFilter.value = "";

  state.planningMode = "duration";
  state.targetValue = 0;
  dom.planningMode.value = state.planningMode;
  dom.targetValue.value = "";

  if (
    dom.accuracyAccountFilter &&
    Array.from(dom.accuracyAccountFilter.options).some(
      (opt) => opt.value === "__all__",
    )
  ) {
    dom.accuracyAccountFilter.value = "__all__";
  }

  state.selectedRolesByStore = {};
  state.roleModesByStore = {};
  if (state.selectedStoreKey) {
    state.selectedRolesByStore[state.selectedStoreKey] = {
      supervisor: "",
      rx: [],
      training: [],
      earlyLate: [],
    };
    state.roleModesByStore[state.selectedStoreKey] = {
      supervisor: "p50",
      rx: "p50",
      training: "p70",
      earlyLate: "p50",
    };
  }

  clearAllCardsAndPreview();
}

function clearStoreSearch() {
  const previousStoreKey = state.selectedStoreKey;
  dom.storeSearch.value = "";
  state.selectedStoreKey = null;
  if (previousStoreKey !== state.selectedStoreKey) {
    resetPlanInputsForNewStore();
  }
  renderStoreSelect();
  persistToStorage();
  renderEmployeeList();
}

function clearAllCardsAndPreview() {
  dom.predDuration.textContent = "-";
  dom.predManHours.textContent = "-";
  dom.predBand.textContent = "-";
  dom.predDelta.textContent = "-";
  setPredictionMeta(
    state.selectedStoreKey
      ? "Store changed. Re-select crew and roles to view a new plan."
      : "Select a store to begin.",
  );
  dom.scenarioBody.innerHTML =
    '<tr><td colspan="3" class="muted">No staffing ranking available yet.</td></tr>';
  dom.storeAccuracySummary.textContent =
    "Select a store and configure a crew to view store accuracy.";
  dom.accuracySummary.textContent =
    "Select a store and configure a crew to view the accuracy snapshot.";
  dom.accuracyWorstBody.innerHTML = "";
  dom.storeStats.textContent = state.selectedStoreKey
    ? "Store selected. Configure crew and roles to view plan cards."
    : "Select a store to view historical context.";
}

function toggleCompareSection() {
  const collapsed = dom.compareSection.classList.toggle("is-collapsed");
  dom.compareToggleBtn.textContent = collapsed ? "Expand" : "Collapse";
  renderComparePlanner();
}

function onCompareInputChange() {
  state.compareAssignment.storeAInput = cleanText(dom.compareStoreA.value || "");
  state.compareAssignment.storeBInput = cleanText(dom.compareStoreB.value || "");
  state.compareAssignment.storeA = resolveStoreKeyFromInput(
    state.compareAssignment.storeAInput,
  );
  state.compareAssignment.storeB = resolveStoreKeyFromInput(
    state.compareAssignment.storeBInput,
  );
  state.compareAssignment.goalMode =
    dom.compareGoalMode.value === "duration" ? "duration" : "manhours";
  state.compareAssignment.goalA = Math.max(0, toNumber(dom.compareGoalA.value));
  state.compareAssignment.goalB = Math.max(0, toNumber(dom.compareGoalB.value));
  state.compareAssignment.supervisorA = cleanText(dom.compareSupervisorA.value || "");
  state.compareAssignment.supervisorB = cleanText(dom.compareSupervisorB.value || "");
  state.compareAssignment.roleModes.supervisorA = parseContributionMode(
    dom.compareSupervisorModeA.value,
  );
  state.compareAssignment.roleModes.supervisorB = parseContributionMode(
    dom.compareSupervisorModeB.value,
  );
  state.compareAssignment.roleModes.rx = parseContributionMode(dom.compareRxMode.value);
  state.compareAssignment.roleModes.training = parseContributionMode(
    dom.compareTrainingMode.value,
  );
  state.compareAssignment.roleModes.earlyLate = parseContributionMode(
    dom.compareEarlyLateMode.value,
  );
  state.compareAssignment.sharedRoles.rx = getRoleChecklistValues(dom.compareRxEmployee);
  state.compareAssignment.sharedRoles.training = getRoleChecklistValues(
    dom.compareTrainingEmployee,
  );
  state.compareAssignment.sharedRoles.earlyLate = getRoleChecklistValues(
    dom.compareEarlyLateEmployee,
  );
  renderComparePlanner();
}

function renderComparePlanner() {
  const cfg = state.compareAssignment;
  const stores = state.storesList || [];
  const storeValues = new Set(stores.map((s) => s.storeKey));
  if (!storeValues.has(cfg.storeA)) cfg.storeA = "";
  if (!storeValues.has(cfg.storeB)) cfg.storeB = "";

  renderStoreOptionList(dom.compareStoreOptions, stores);
  dom.compareGoalMode.value = cfg.goalMode;
  dom.compareGoalA.value = cfg.goalA > 0 ? cfg.goalA : "";
  dom.compareGoalB.value = cfg.goalB > 0 ? cfg.goalB : "";
  dom.compareStoreA.value = cfg.storeA
    ? getStoreDisplayLabel(state.stores.get(cfg.storeA))
    : cfg.storeAInput || "";
  dom.compareStoreB.value = cfg.storeB
    ? getStoreDisplayLabel(state.stores.get(cfg.storeB))
    : cfg.storeBInput || "";

  const available = getCompareAvailableEmployeeIds(cfg.storeA, cfg.storeB);
  const availableSet = new Set(available);
  cfg.availableEmployees = new Set(
    Array.from(cfg.availableEmployees || []).filter((id) => availableSet.has(id)),
  );
  cfg.sharedRoles.rx = filterToSelected(cfg.sharedRoles.rx, cfg.availableEmployees);
  cfg.sharedRoles.training = filterToSelected(
    cfg.sharedRoles.training,
    cfg.availableEmployees,
  );
  cfg.sharedRoles.earlyLate = filterToSelected(
    cfg.sharedRoles.earlyLate,
    cfg.availableEmployees,
  );
  if (!cfg.availableEmployees.has(cfg.supervisorA)) {
    cfg.supervisorA = "";
  }
  if (!cfg.availableEmployees.has(cfg.supervisorB)) {
    cfg.supervisorB = "";
  }

  const sortedSelected = Array.from(cfg.availableEmployees)
    .map((id) => ({ id, name: getEmployeeDisplayName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  renderRoleEmployeeSelect(
    dom.compareSupervisorA,
    sortedSelected,
    true,
    cfg.supervisorA,
    "Select supervisor A",
    false,
  );
  renderRoleEmployeeSelect(
    dom.compareSupervisorB,
    sortedSelected,
    true,
    cfg.supervisorB,
    "Select supervisor B",
    false,
  );
  dom.compareSupervisorModeA.value = cfg.roleModes.supervisorA;
  dom.compareSupervisorModeB.value = cfg.roleModes.supervisorB;
  dom.compareRxMode.value = cfg.roleModes.rx;
  dom.compareTrainingMode.value = cfg.roleModes.training;
  dom.compareEarlyLateMode.value = cfg.roleModes.earlyLate;
  renderRoleChecklist(
    dom.compareRxEmployee,
    sortedSelected,
    cfg.sharedRoles.rx,
    "No RX role",
  );
  renderRoleChecklist(
    dom.compareTrainingEmployee,
    sortedSelected,
    cfg.sharedRoles.training,
    "No training role",
  );
  renderRoleChecklist(
    dom.compareEarlyLateEmployee,
    sortedSelected,
    cfg.sharedRoles.earlyLate,
    "No early/late role",
  );
  updateCompareGoalLabels(cfg.goalMode);
  const compareCollapsed = dom.compareSection?.classList.contains("is-collapsed");
  const hasActiveCompareState =
    cfg.availableEmployees.size > 0 ||
    cleanText(dom.compareEmployeeFilter?.value || "").length > 0;
  if (compareCollapsed && !hasActiveCompareState) {
    dom.compareEmployeeList.innerHTML =
      '<div class="muted">Expand this section to load available employees.</div>';
  } else {
    renderCompareEmployeeList();
  }
  dom.compareResult.textContent = "";
  setCompareResultVisible(false);

  const plannerStatus = getComparePlannerStatus(cfg);
  if (!state.analyticsReady) {
    dom.compareSuggestBtn.disabled = true;
    setCompareMeta(
      state.analyticsScheduled
        ? "Model calibration is running. Suggested assignment unlocks when it completes."
        : "Model calibration is not ready. Click Compute Accuracy to retry.",
      state.analyticsScheduled ? "info" : "warning",
    );
    return;
  }
  dom.compareSuggestBtn.disabled = !plannerStatus.canSuggest;
  if (plannerStatus.canSuggest) {
    setCompareMeta(
      `${plannerStatus.storeALabel} and ${plannerStatus.storeBLabel} ready. ${plannerStatus.selectedCount} available employees selected.`,
      "success",
    );
    return;
  }
  setCompareMeta(plannerStatus.metaMessage, plannerStatus.metaTone);
  if (!plannerStatus.canSuggest) {
    dom.compareResult.textContent = "";
    setCompareResultVisible(false);
  }
}

function updateCompareGoalLabels(goalMode) {
  const usingDuration = goalMode === "duration";
  const suffix = usingDuration ? "(hrs)" : "(man-hours)";
  dom.compareGoalALabel.textContent = `Goal A ${suffix}`;
  dom.compareGoalBLabel.textContent = `Goal B ${suffix}`;
}

function getComparePlannerStatus(cfg) {
  const goalMode = cfg.goalMode === "duration" ? "duration" : "manhours";
  const goalA = Math.max(0, safeNumber(cfg.goalA));
  const goalB = Math.max(0, safeNumber(cfg.goalB));
  const storeA = state.stores.get(cfg.storeA);
  const storeB = state.stores.get(cfg.storeB);
  const hasTwoStores = Boolean(storeA && storeB);
  const storesDifferent = hasTwoStores && cfg.storeA !== cfg.storeB;
  const selected = Array.from(cfg.availableEmployees || []);
  const selectedSet = new Set(selected);
  const selectedCount = selected.length;
  const supA = cleanText(cfg.supervisorA);
  const supB = cleanText(cfg.supervisorB);
  const supervisorsSelected = Boolean(supA && supB);
  const supervisorsDifferent = supervisorsSelected && supA !== supB;
  const supervisorsInPool =
    supervisorsSelected && selectedSet.has(supA) && selectedSet.has(supB);
  const goalsSet = goalA > 0 && goalB > 0;
  const sharedRoles = {
    rx: filterToSelected(cfg.sharedRoles.rx, selectedSet),
    training: filterToSelected(cfg.sharedRoles.training, selectedSet),
    earlyLate: filterToSelected(cfg.sharedRoles.earlyLate, selectedSet),
  };
  const rxRequiredCount =
    (isRxRoleRequiredForStore(storeA) ? 1 : 0) + (isRxRoleRequiredForStore(storeB) ? 1 : 0);
  const rxAssignedCount = sharedRoles.rx.length;
  const rxAssignmentsEnough = rxAssignedCount >= rxRequiredCount;
  const canSuggest =
    storesDifferent &&
    goalsSet &&
    selectedCount > 0 &&
    supervisorsDifferent &&
    supervisorsInPool &&
    rxAssignmentsEnough;

  let metaMessage = "Choose two stores to begin.";
  let metaTone = "info";
  if (!hasTwoStores) {
    metaMessage = "Choose Store A and Store B to start.";
  } else if (!storesDifferent) {
    metaMessage = "Select two different stores.";
    metaTone = "warning";
  } else if (!goalsSet) {
    metaMessage = "Enter goal values for both stores.";
    metaTone = "warning";
  } else if (selectedCount <= 0) {
    metaMessage = "Add available employees for assignment.";
    metaTone = "warning";
  } else if (!supervisorsSelected) {
    metaMessage = "Select supervisors for both stores.";
    metaTone = "warning";
  } else if (!supervisorsDifferent) {
    metaMessage = "Supervisors must be different across the two stores.";
    metaTone = "warning";
  } else if (!supervisorsInPool) {
    metaMessage = "Both supervisors must be included in available employees.";
    metaTone = "warning";
  } else if (!rxAssignmentsEnough) {
    metaMessage =
      rxRequiredCount === 2
        ? "Both stores require RX. Assign at least two employees to shared RX role."
        : "At least one RX role assignment is required.";
    metaTone = "warning";
  }

  return {
    goalA,
    goalB,
    goalMode,
    goalUnit: goalMode === "duration" ? "hrs" : "man-hours",
    hasTwoStores,
    storesDifferent,
    goalsSet,
    selectedCount,
    supervisorsDifferent,
    supervisorsInPool,
    supervisorALabel: getEmployeeDisplayName(supA),
    supervisorBLabel: getEmployeeDisplayName(supB),
    rxRequiredCount,
    rxAssignedCount,
    rxAssignmentsEnough,
    canSuggest,
    sharedRoles,
    storeA,
    storeB,
    storeALabel: getStoreDisplayLabel(storeA),
    storeBLabel: getStoreDisplayLabel(storeB),
    supA,
    supB,
    metaMessage,
    metaTone,
  };
}

function setCompareMeta(message, tone = "info") {
  if (!dom.compareMeta) return;
  dom.compareMeta.classList.remove("meta-warning", "meta-success");
  if (tone === "warning") dom.compareMeta.classList.add("meta-warning");
  else if (tone === "success") dom.compareMeta.classList.add("meta-success");
  dom.compareMeta.textContent = message;
}

function setCompareResultVisible(visible) {
  if (!dom.compareResultCard) return;
  dom.compareResultCard.classList.toggle("is-hidden", !visible);
}

function renderStoreOptionList(dataListEl, stores) {
  dataListEl.innerHTML = "";
  stores.forEach((store) => {
    const opt = document.createElement("option");
    opt.value = getStoreDisplayLabel(store);
    dataListEl.appendChild(opt);
  });
}

function getCompareAvailableEmployeeIds(storeA, storeB) {
  if (!state.isLoaded) return [];
  return Array.from(state.employees.keys());
}

function clearCompareEmployees() {
  state.compareAssignment.availableEmployees = new Set();
  state.compareAssignment.sharedRoles = { rx: [], training: [], earlyLate: [] };
  state.compareAssignment.supervisorA = "";
  state.compareAssignment.supervisorB = "";
  dom.compareResult.textContent = "";
  setCompareResultVisible(false);
  if (dom.compareEmployeeFilter) {
    dom.compareEmployeeFilter.value = "";
  }
  renderComparePlanner();
}

function renderCompareEmployeeList() {
  const cfg = state.compareAssignment;
  const filter = (dom.compareEmployeeFilter.value || "").trim().toLowerCase();
  const storeA = state.stores.get(cfg.storeA);
  const storeB = state.stores.get(cfg.storeB);
  const speedAccount = storeA?.account || storeB?.account || "";
  const available = getCompareAvailableEmployeeIds(cfg.storeA, cfg.storeB);
  const employees = available
    .map((id) => state.employees.get(id))
    .filter(Boolean)
    .sort(
      (a, b) =>
        displayEmployeeSpeed(b, speedAccount) - displayEmployeeSpeed(a, speedAccount),
    )
    .filter((emp) => {
      const name = getEmployeeDisplayName(emp.employee).toLowerCase();
      const id = emp.employee.toLowerCase();
      return name.includes(filter) || id.includes(filter);
    });

  const limited =
    !filter && employees.length > DEFAULT_COMPARE_EMPLOYEE_RENDER_LIMIT;
  const renderEmployees = limited
    ? employees.slice(0, DEFAULT_COMPARE_EMPLOYEE_RENDER_LIMIT)
    : employees;

  dom.compareEmployeeList.innerHTML = "";
  if (!employees.length) {
    dom.compareEmployeeList.innerHTML =
      '<div class="muted">No employees match this search.</div>';
    return;
  }

  if (limited) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = `Showing top ${DEFAULT_COMPARE_EMPLOYEE_RENDER_LIMIT} of ${employees.length} employees. Type in search to narrow.`;
    dom.compareEmployeeList.appendChild(note);
  }

  const fragment = document.createDocumentFragment();
  renderEmployees.forEach((emp) => {
    const employeeId = emp.employee;
    const row = document.createElement("div");
    row.className = "employee-item";
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = cfg.availableEmployees.has(employeeId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) cfg.availableEmployees.add(employeeId);
      else cfg.availableEmployees.delete(employeeId);
      if (!cfg.availableEmployees.has(cfg.supervisorA)) cfg.supervisorA = "";
      if (!cfg.availableEmployees.has(cfg.supervisorB)) cfg.supervisorB = "";
      cfg.sharedRoles.rx = cfg.sharedRoles.rx.filter((id) => cfg.availableEmployees.has(id));
      cfg.sharedRoles.training = cfg.sharedRoles.training.filter((id) =>
        cfg.availableEmployees.has(id),
      );
      cfg.sharedRoles.earlyLate = cfg.sharedRoles.earlyLate.filter((id) =>
        cfg.availableEmployees.has(id),
      );
      renderComparePlanner();
    });

    const text = document.createElement("span");
    let badges = "";
    if (cfg.supervisorA === employeeId) {
      badges += ' <span class="sup-tag">Supervisor A</span>';
    }
    if (cfg.supervisorB === employeeId) {
      badges += ' <span class="sup-tag">Supervisor B</span>';
    }
    text.innerHTML = `${escapeHtml(getEmployeeDisplayName(employeeId))}${badges} (${formatNumber(displayEmployeeSpeed(emp, speedAccount), 1)} pieces/hr)`;
    label.appendChild(checkbox);
    label.appendChild(text);
    row.appendChild(label);
    fragment.appendChild(row);
  });
  dom.compareEmployeeList.appendChild(fragment);
}

function onCompareEmployeeFilterKeyDown(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const query = (dom.compareEmployeeFilter.value || "").trim().toLowerCase();
  if (!query) return;
  const cfg = state.compareAssignment;
  const available = getCompareAvailableEmployeeIds(cfg.storeA, cfg.storeB);
  const matches = available.filter((id) => {
    const name = getEmployeeDisplayName(id).toLowerCase();
    return name.includes(query) || id.toLowerCase().includes(query);
  });
  const exact = matches.find((id) => {
    const name = getEmployeeDisplayName(id).toLowerCase();
    return name === query || id.toLowerCase() === query;
  });
  const chosen = exact || matches[0];
  if (!chosen) return;
  cfg.availableEmployees.add(chosen);
  dom.compareEmployeeFilter.value = "";
  renderComparePlanner();
}

function suggestTwoStoreAssignment() {
  if (!state.analyticsReady) {
    setCompareMeta(
      state.analyticsScheduled
        ? "Model calibration is still running. Please wait."
        : "Model calibration is not ready. Click Compute Accuracy to retry.",
      "warning",
    );
    dom.compareSuggestBtn.disabled = true;
    return;
  }

  const cfg = state.compareAssignment;
  const plannerStatus = getComparePlannerStatus(cfg);
  if (!plannerStatus.canSuggest) {
    setCompareMeta(plannerStatus.metaMessage, "warning");
    dom.compareSuggestBtn.disabled = true;
    return;
  }
  const goalMode = plannerStatus.goalMode;
  const goalA = plannerStatus.goalA;
  const goalB = plannerStatus.goalB;
  const storeA = plannerStatus.storeA;
  const storeB = plannerStatus.storeB;
  const selected = Array.from(cfg.availableEmployees || []);
  const supA = plannerStatus.supA;
  const supB = plannerStatus.supB;
  const sharedRoles = plannerStatus.sharedRoles;
  const fixedA = new Set([supA]);
  const fixedB = new Set([supB]);
  const free = selected.filter((id) => id !== supA && id !== supB);
  const result =
    free.length <= 18
      ? solveTwoStoreByBruteForce({
        storeA,
        storeB,
        baseA: Array.from(fixedA),
        baseB: Array.from(fixedB),
        supervisorA: supA,
        supervisorB: supB,
        sharedRoles,
        roleModes: cfg.roleModes,
        free,
        goalMode,
        goalA,
        goalB,
      })
      : solveTwoStoreGreedy({
        storeA,
        storeB,
        baseA: Array.from(fixedA),
        baseB: Array.from(fixedB),
        supervisorA: supA,
        supervisorB: supB,
        sharedRoles,
        roleModes: cfg.roleModes,
        free,
        goalMode,
        goalA,
        goalB,
      });

  if (!result) {
    setCompareMeta(
      "No valid assignment found with the selected crew and supervisors.",
      "warning",
    );
    setCompareResultVisible(false);
    return;
  }
  setCompareMeta(
    `Suggested assignment ready (${selected.length} employees evaluated).`,
    "success",
  );
  renderCompareResult(result, goalMode, goalA, goalB);
  setCompareResultVisible(true);
}

function solveTwoStoreByBruteForce(config) {
  const { free, baseA, baseB } = config;
  let best = null;
  const total = 1 << free.length;
  for (let mask = 0; mask < total; mask += 1) {
    const crewA = [...baseA];
    const crewB = [...baseB];
    for (let i = 0; i < free.length; i += 1) {
      if (mask & (1 << i)) crewA.push(free[i]);
      else crewB.push(free[i]);
    }
    const scored = scoreTwoStoreAssignment(config, crewA, crewB);
    if (!scored) continue;
    if (
      !best ||
      scored.score < best.score ||
      (scored.score === best.score && scored.maxErr < best.maxErr)
    ) {
      best = scored;
    }
  }
  return best;
}

function solveTwoStoreGreedy(config) {
  const { free, baseA, baseB } = config;
  const crewA = [...baseA];
  const crewB = [...baseB];
  free.forEach((id) => {
    const scoredA = scoreTwoStoreAssignment(config, [...crewA, id], crewB);
    const scoredB = scoreTwoStoreAssignment(config, crewA, [...crewB, id]);
    if (!scoredA && !scoredB) return;
    if (!scoredB || (scoredA && scoredA.score <= scoredB.score)) crewA.push(id);
    else crewB.push(id);
  });
  let best = scoreTwoStoreAssignment(config, crewA, crewB);
  if (!best) return null;
  let improved = true;
  let guard = 0;
  while (improved && guard < 4) {
    improved = false;
    guard += 1;
    for (let i = 0; i < crewA.length; i += 1) {
      for (let j = 0; j < crewB.length; j += 1) {
        if (baseA.includes(crewA[i]) || baseB.includes(crewB[j])) continue;
        const nextA = [...crewA];
        const nextB = [...crewB];
        const temp = nextA[i];
        nextA[i] = nextB[j];
        nextB[j] = temp;
        const candidate = scoreTwoStoreAssignment(config, nextA, nextB);
        if (candidate && candidate.score < best.score) {
          crewA.splice(0, crewA.length, ...nextA);
          crewB.splice(0, crewB.length, ...nextB);
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

function scoreTwoStoreAssignment(config, crewA, crewB) {
  const setA = new Set(crewA);
  const setB = new Set(crewB);
  const rolesA = {
    supervisor: config.supervisorA,
    rx: (config.sharedRoles.rx || []).filter((id) => setA.has(id)),
    training: (config.sharedRoles.training || []).filter((id) => setA.has(id)),
    earlyLate: (config.sharedRoles.earlyLate || []).filter((id) => setA.has(id)),
  };
  const rolesB = {
    supervisor: config.supervisorB,
    rx: (config.sharedRoles.rx || []).filter((id) => setB.has(id)),
    training: (config.sharedRoles.training || []).filter((id) => setB.has(id)),
    earlyLate: (config.sharedRoles.earlyLate || []).filter((id) => setB.has(id)),
  };
  if (isRxRoleRequiredForStore(config.storeA) && rolesA.rx.length === 0) return null;
  if (isRxRoleRequiredForStore(config.storeB) && rolesB.rx.length === 0) return null;
  const modesA = {
    supervisor: config.roleModes.supervisorA,
    rx: config.roleModes.rx,
    training: config.roleModes.training,
    earlyLate: config.roleModes.earlyLate,
  };
  const modesB = {
    supervisor: config.roleModes.supervisorB,
    rx: config.roleModes.rx,
    training: config.roleModes.training,
    earlyLate: config.roleModes.earlyLate,
  };
  const predA = predictForAssignedCrew(
    config.storeA.storeKey,
    crewA,
    rolesA,
    modesA,
  );
  const predB = predictForAssignedCrew(
    config.storeB.storeKey,
    crewB,
    rolesB,
    modesB,
  );
  if (!predA || !predB) return null;
  const valueA = config.goalMode === "duration" ? predA.onSiteDuration : predA.manHours;
  const valueB = config.goalMode === "duration" ? predB.onSiteDuration : predB.manHours;
  const errA = Math.abs(valueA - config.goalA);
  const errB = Math.abs(valueB - config.goalB);
  return {
    crewA,
    crewB,
    predA,
    predB,
    valueA,
    valueB,
    errA,
    errB,
    score: errA + errB,
    maxErr: Math.max(errA, errB),
  };
}

function predictForAssignedCrew(storeKey, crewIds, rolesConfig, modesConfig) {
  const store = state.stores.get(storeKey);
  const roles = {
    supervisor: cleanText(rolesConfig?.supervisor),
    rx: uniqueStrings(rolesConfig?.rx || []),
    training: uniqueStrings(rolesConfig?.training || []),
    earlyLate: uniqueStrings(rolesConfig?.earlyLate || []),
  };
  const modes = {
    supervisor: parseContributionMode(modesConfig?.supervisor || "p50"),
    rx: parseContributionMode(modesConfig?.rx || "p50"),
    training: parseContributionMode(modesConfig?.training || "p70"),
    earlyLate: parseContributionMode(modesConfig?.earlyLate || "p50"),
  };
  const crew = uniqueStrings(crewIds || []);
  if (!store || !roles.supervisor || !crew.includes(roles.supervisor)) return null;
  if (!roles.rx.every((id) => crew.includes(id))) return null;
  if (!roles.training.every((id) => crew.includes(id))) return null;
  if (!roles.earlyLate.every((id) => crew.includes(id))) return null;
  const tuningCtx = getTuningForStore(store);
  const baselineTuningCtx = getBaselineTuningForStore(store);
  const tuning = tuningCtx.tuning;
  const baseline = resolveBaselinePieces(
    store,
    baselineTuningCtx.tuning,
    store.primaryType,
  );
  const overhead = resolveOverheadHours(store, tuning.overheadScale);
  const crewSpeeds = crew
    .map((id) =>
      effectiveEmployeeSpeedForRoles(
        state.employees.get(id),
        store.account,
        id,
        roles,
        modes,
      ),
    )
    .filter((v) => v > 0);
  const crewSpeedRaw = crewSpeeds.reduce((sum, n) => sum + n, 0);
  const crewSize = crewSpeeds.length;
  if (!(baseline.value > 0) || !(crewSpeedRaw > 0) || crewSize <= 0) return null;
  const crewEfficiency = getCrewEfficiencyFactor(crewSize, tuning);
  const rawOnSiteDuration = overhead.value + baseline.value / (crewSpeedRaw * crewEfficiency);
  const residualAdjustment = resolveResidualAdjustmentForStore(
    store,
    crewSize,
    roles.supervisor,
  );
  const overlap = getLastCrewOverlapRate(storeKey, crew);
  const lastResidual = state.lastDurationResidualByStore.get(storeKey);
  const lastCrewBias =
    overlap > 0 && Number.isFinite(lastResidual?.durationResidual)
      ? overlap * 0.15 * safeNumber(lastResidual.durationResidual)
      : 0;
  const onSiteDuration = Math.max(
    0,
    rawOnSiteDuration + residualAdjustment.biasHours + lastCrewBias,
  );
  const fallbackBand = resolveDurationBand(store) * 0.7;
  const lowOffset =
    residualAdjustment.rangeCount > 0
      ? residualAdjustment.lowOffset * state.uncertaintyScale
      : -fallbackBand;
  const highOffset =
    residualAdjustment.rangeCount > 0
      ? residualAdjustment.highOffset * state.uncertaintyScale
      : fallbackBand;
  const rangeCandidates = [
    onSiteDuration + lowOffset,
    onSiteDuration + highOffset,
    onSiteDuration,
  ];
  const confidenceLow = Math.max(0, Math.min(...rangeCandidates));
  const confidenceHigh = Math.max(confidenceLow, Math.max(...rangeCandidates));
  return {
    onSiteDuration,
    manHours: onSiteDuration * crewSize,
    crewSize,
    confidenceLow,
    confidenceHigh,
  };
}

function effectiveEmployeeSpeedForRoles(
  employee,
  account,
  employeeId,
  roles,
  modes,
) {
  const baseSpeed = displayEmployeeSpeed(employee, account);
  if (!employee) return baseSpeed;
  let factor = 1;
  if (roles.supervisor === employeeId) {
    factor = Math.min(factor, getContributionFactor(modes.supervisor));
  }
  if ((roles.rx || []).includes(employeeId)) {
    factor = Math.min(factor, getContributionFactor(modes.rx));
  }
  if ((roles.training || []).includes(employeeId)) {
    factor = Math.min(factor, getContributionFactor(modes.training));
  }
  if ((roles.earlyLate || []).includes(employeeId)) {
    factor = Math.min(factor, getContributionFactor(modes.earlyLate));
  }
  return baseSpeed * factor;
}

function renderCompareResult(result, goalMode, goalA, goalB) {
  const unit = goalMode === "duration" ? "hrs" : "man-hours";
  const deltaA = result.valueA - goalA;
  const deltaB = result.valueB - goalB;
  const cfg = state.compareAssignment;
  const storeA = state.stores.get(cfg.storeA);
  const storeB = state.stores.get(cfg.storeB);
  const rolesA = {
    supervisor: cfg.supervisorA,
    rx: (cfg.sharedRoles.rx || []).filter((id) => result.crewA.includes(id)),
    training: (cfg.sharedRoles.training || []).filter((id) =>
      result.crewA.includes(id),
    ),
    earlyLate: (cfg.sharedRoles.earlyLate || []).filter((id) =>
      result.crewA.includes(id),
    ),
  };
  const rolesB = {
    supervisor: cfg.supervisorB,
    rx: (cfg.sharedRoles.rx || []).filter((id) => result.crewB.includes(id)),
    training: (cfg.sharedRoles.training || []).filter((id) =>
      result.crewB.includes(id),
    ),
    earlyLate: (cfg.sharedRoles.earlyLate || []).filter((id) =>
      result.crewB.includes(id),
    ),
  };
  const modesA = {
    supervisor: cfg.roleModes.supervisorA,
    rx: cfg.roleModes.rx,
    training: cfg.roleModes.training,
    earlyLate: cfg.roleModes.earlyLate,
  };
  const modesB = {
    supervisor: cfg.roleModes.supervisorB,
    rx: cfg.roleModes.rx,
    training: cfg.roleModes.training,
    earlyLate: cfg.roleModes.earlyLate,
  };
  const rankedA = buildCompareStaffingRankRows(storeA, result.crewA, rolesA, modesA);
  const rankedB = buildCompareStaffingRankRows(storeB, result.crewB, rolesB, modesB);
  dom.compareResult.innerHTML = `<div class="compare-result">
    <article class="compare-store-block">
      <h4 class="compare-store-title">${escapeHtml(getStoreDisplayLabel(storeA) || "Store A")}</h4>
      <div class="cards compare-store-cards">
        <article class="card">
          <h3>Estimated In-Store Time</h3>
          <p class="value">${formatNumber(result.predA.onSiteDuration, 2)} hrs</p>
        </article>
        <article class="card">
          <h3>Estimated Man-Hours</h3>
          <p class="value">${formatNumber(result.predA.manHours, 2)} man-hours</p>
        </article>
        <article class="card">
          <h3>Likely On-Site Range</h3>
          <p class="value">${formatNumber(result.predA.confidenceLow, 2)} - ${formatNumber(result.predA.confidenceHigh, 2)} hrs</p>
        </article>
        <article class="card">
          <h3>Difference From Goal</h3>
          <p class="value">${formatSigned(deltaA, 2)} ${unit}</p>
        </article>
      </div>
      <table class="compare-rank-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Employee</th>
            <th>Predicted Production (pieces/hr)</th>
          </tr>
        </thead>
        <tbody>${renderCompareRankRows(rankedA)}</tbody>
      </table>
    </article>
    <article class="compare-store-block">
      <h4 class="compare-store-title">${escapeHtml(getStoreDisplayLabel(storeB) || "Store B")}</h4>
      <div class="cards compare-store-cards">
        <article class="card">
          <h3>Estimated In-Store Time</h3>
          <p class="value">${formatNumber(result.predB.onSiteDuration, 2)} hrs</p>
        </article>
        <article class="card">
          <h3>Estimated Man-Hours</h3>
          <p class="value">${formatNumber(result.predB.manHours, 2)} man-hours</p>
        </article>
        <article class="card">
          <h3>Likely On-Site Range</h3>
          <p class="value">${formatNumber(result.predB.confidenceLow, 2)} - ${formatNumber(result.predB.confidenceHigh, 2)} hrs</p>
        </article>
        <article class="card">
          <h3>Difference From Goal</h3>
          <p class="value">${formatSigned(deltaB, 2)} ${unit}</p>
        </article>
      </div>
      <table class="compare-rank-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Employee</th>
            <th>Predicted Production (pieces/hr)</th>
          </tr>
        </thead>
        <tbody>${renderCompareRankRows(rankedB)}</tbody>
      </table>
    </article>
  </div>`;
}

function buildCompareStaffingRankRows(store, crewIds, roles, modes) {
  if (!store) return [];
  return (crewIds || [])
    .map((id) => ({
      id,
      speed: effectiveEmployeeSpeedForRoles(
        state.employees.get(id),
        store.account,
        id,
        roles,
        modes,
      ),
    }))
    .filter((row) => row.speed > 0)
    .sort((a, b) => b.speed - a.speed);
}

function renderCompareRankRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="3" class="muted">No valid speed data for assigned crew.</td></tr>';
  }
  return rows
    .map(
      (row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(getEmployeeDisplayName(row.id))}</td>
        <td>${formatNumber(row.speed, 1)}</td>
      </tr>`,
    )
    .join("");
}

function syncAccuracyFilterToSelectedStore() {
  const store = state.stores.get(state.selectedStoreKey);
  const account = store?.account;
  if (!account) return;
  const hasOption = Array.from(dom.accuracyAccountFilter.options || []).some(
    (opt) => opt.value === account,
  );
  if (hasOption) {
    dom.accuracyAccountFilter.value = account;
  }
}

function onRoleConfigChange() {
  if (!state.selectedStoreKey) return;
  const storeKey = state.selectedStoreKey;
  state.selectedRolesByStore[storeKey] = {
    supervisor: dom.supervisorEmployee.value || "",
    rx: getRoleChecklistValues(dom.rxEmployee),
    training: getRoleChecklistValues(dom.trainingEmployee),
    earlyLate: getRoleChecklistValues(dom.earlyLateEmployee),
  };
  state.roleModesByStore[storeKey] = {
    supervisor: parseContributionMode(dom.supervisorMode.value),
    rx: parseContributionMode(dom.rxMode.value),
    training: parseContributionMode(dom.trainingMode.value),
    earlyLate: parseContributionMode(dom.earlyLateMode.value),
  };
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  persistToStorage();
  renderEmployeeList();
  updateResults();
}

function renderRoleSelectors() {
  const selectedIds = Array.from(state.selectedEmployees).filter(Boolean);
  const sortedSelected = selectedIds
    .map((id) => ({ id, name: getEmployeeDisplayName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const storeKey = state.selectedStoreKey;
  const roles = getRoleSelectionForStore(storeKey);
  const modes = getRoleModesForStore(storeKey);

  renderRoleEmployeeSelect(
    dom.supervisorEmployee,
    sortedSelected,
    true,
    roles.supervisor,
    "Select supervisor",
    false,
  );
  renderRoleChecklist(dom.rxEmployee, sortedSelected, roles.rx, "No RX role");
  renderRoleChecklist(
    dom.trainingEmployee,
    sortedSelected,
    roles.training,
    "No training role",
  );
  renderRoleChecklist(
    dom.earlyLateEmployee,
    sortedSelected,
    roles.earlyLate,
    "No early/late role",
  );

  dom.supervisorMode.value = modes.supervisor;
  dom.rxMode.value = modes.rx;
  dom.trainingMode.value = modes.training;
  dom.earlyLateMode.value = modes.earlyLate;

  syncRoleAssignmentsToSelectedCrew();
}

function renderRoleEmployeeSelect(
  selectEl,
  options,
  allowNone,
  selectedValue,
  noneLabel,
  multi,
) {
  selectEl.multiple = Boolean(multi);
  if (multi) {
    selectEl.size = Math.min(6, Math.max(3, options.length || 3));
    selectEl.classList.add("role-multi");
  } else {
    selectEl.size = 1;
    selectEl.classList.remove("role-multi");
  }

  selectEl.innerHTML = "";
  if (allowNone && !multi) {
    const none = document.createElement("option");
    none.value = "";
    none.textContent = noneLabel;
    selectEl.appendChild(none);
  }

  options.forEach((emp) => {
    const opt = document.createElement("option");
    opt.value = emp.id;
    opt.textContent = emp.name;
    selectEl.appendChild(opt);
  });

  if (multi) {
    const selectedSet = new Set(
      Array.isArray(selectedValue) ? selectedValue : [],
    );
    Array.from(selectEl.options).forEach((opt) => {
      opt.selected = selectedSet.has(opt.value);
    });
  } else {
    const hasSelected =
      selectedValue && options.some((o) => o.id === selectedValue);
    if (hasSelected) {
      selectEl.value = selectedValue;
    } else {
      selectEl.value = "";
    }
  }
}

function renderRoleChecklist(containerEl, options, selectedValues, emptyLabel) {
  containerEl.innerHTML = "";
  const selected = new Set(normalizeRoleArray(selectedValues));
  if (!options.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = emptyLabel;
    containerEl.appendChild(empty);
    return;
  }

  options.forEach((opt) => {
    const row = document.createElement("label");
    row.className = "role-check-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = opt.id;
    checkbox.checked = selected.has(opt.id);
    const text = document.createElement("span");
    text.textContent = opt.name;
    row.appendChild(checkbox);
    row.appendChild(text);
    containerEl.appendChild(row);
  });
}

function getRoleChecklistValues(containerEl) {
  return Array.from(
    containerEl.querySelectorAll('input[type="checkbox"]:checked'),
  )
    .map((el) => el.value)
    .filter(Boolean);
}

function normalizeRoleArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value) return [value];
  return [];
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function filterToSelected(values, selectedSet) {
  return uniqueStrings(values).filter((id) => selectedSet.has(id));
}

function getRoleSelectionForStore(storeKey) {
  const current = state.selectedRolesByStore[storeKey] || {};
  return {
    supervisor: current.supervisor || "",
    rx: normalizeRoleArray(current.rx),
    training: normalizeRoleArray(current.training),
    earlyLate: normalizeRoleArray(current.earlyLate),
  };
}

function syncRoleAssignmentsToSelectedCrew() {
  const storeKey = state.selectedStoreKey;
  if (!storeKey) return;

  const selectedSet = new Set(Array.from(state.selectedEmployees));
  const roles = getRoleSelectionForStore(storeKey);

  if (!selectedSet.has(roles.supervisor)) {
    roles.supervisor = "";
  }

  roles.rx = filterToSelected(roles.rx, selectedSet);
  roles.training = filterToSelected(roles.training, selectedSet);
  roles.earlyLate = filterToSelected(roles.earlyLate, selectedSet);

  state.selectedRolesByStore[storeKey] = roles;
  state.roleModesByStore[storeKey] = getRoleModesForStore(storeKey);
}

function getContributionFactorForEmployee(employeeId, storeKey) {
  const roles = getRoleSelectionForStore(storeKey);
  const modes = getRoleModesForStore(storeKey);
  let factor = 1;

  if (roles.supervisor === employeeId) {
    factor = Math.min(factor, getContributionFactor(modes.supervisor));
  }
  if (roles.rx.includes(employeeId)) {
    factor = Math.min(factor, getContributionFactor(modes.rx));
  }
  if (roles.training.includes(employeeId)) {
    factor = Math.min(factor, getContributionFactor(modes.training));
  }
  if (roles.earlyLate.includes(employeeId)) {
    factor = Math.min(factor, getContributionFactor(modes.earlyLate));
  }

  return factor;
}

function isSupervisorEmployee(employee, storeKey) {
  if (!employee) return false;

  const effectiveStoreKey = storeKey || state.selectedStoreKey;
  const selectedId = cleanText(
    getRoleSelectionForStore(effectiveStoreKey).supervisor,
  ).toLowerCase();
  return Boolean(selectedId && employee.employee.toLowerCase() === selectedId);
}

function parseContributionMode(value) {
  if (
    value === "full" ||
    value === "none" ||
    value === "p70" ||
    value === "p30" ||
    value === "p50"
  )
    return value;
  if (value === "exclude") return "none";
  if (value === "reduced") return "p50";
  return "p70";
}

function getContributionFactor(mode) {
  if (mode === "none") return 0;
  if (mode === "full") return 1;
  if (mode === "p30") return 0.3;
  if (mode === "p50") return 0.5;
  return 0.7;
}

function getRoleModesForStore(storeKey) {
  const current = state.roleModesByStore[storeKey] || {};
  return {
    supervisor: parseContributionMode(current.supervisor || "p50"),
    rx: parseContributionMode(current.rx || "p50"),
    training: parseContributionMode(current.training || "p70"),
    earlyLate: parseContributionMode(current.earlyLate || "p50"),
  };
}

function getContributionModeLabel(mode) {
  if (mode === "full") return "Full contribution";
  if (mode === "none") return "No contribution (0%)";
  if (mode === "p30") return "Reduced contribution (30%)";
  if (mode === "p50") return "Reduced contribution (50%)";
  return "Reduced contribution (70%)";
}

function renderStoreStats() {
  const store = state.stores.get(state.selectedStoreKey);
  if (!store) {
    dom.storeStats.textContent = "Select a store to see store history.";
    return;
  }

  dom.storeStats.innerHTML = [
    `Account: ${store.account}`,
    `Store: ${store.storeName}`,
    `Account Segment: ${store.segmentId || "S1"}`,
    `Past jobs: ${store.jobCount}`,
    `Typical pieces: ${formatNumber(store.medianPieces, 0)} pieces`,
    `Average on-site time: ${formatNumber(store.avgDuration, 2)} hrs`,
    `Average Man-Hours: ${formatNumber(store.avgManHours, 2)} man-hours`,
  ].join("<br>");
}

function renderEmployeeList() {
  const filter = (dom.employeeFilter.value || "").trim().toLowerCase();
  const selectedAccount = getSelectedAccount();
  const employees = Array.from(state.employees.values())
    .sort(
      (a, b) =>
        displayEmployeeSpeed(b, selectedAccount) -
        displayEmployeeSpeed(a, selectedAccount),
    )
    .filter((e) => {
      const name = getEmployeeDisplayName(e.employee).toLowerCase();
      const id = e.employee.toLowerCase();
      return name.includes(filter) || id.includes(filter);
    });

  state.visibleEmployees = employees.map((e) => e.employee);
  const limited = !filter && employees.length > DEFAULT_EMPLOYEE_RENDER_LIMIT;
  const renderEmployees = limited
    ? employees.slice(0, DEFAULT_EMPLOYEE_RENDER_LIMIT)
    : employees;

  dom.employeeList.innerHTML = "";
  if (employees.length === 0) {
    dom.employeeList.innerHTML = `<div class="muted">No employees match this search.</div>`;
    return;
  }

  if (limited) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = `Showing top ${DEFAULT_EMPLOYEE_RENDER_LIMIT} of ${employees.length} employees. Type in search to narrow.`;
    dom.employeeList.appendChild(note);
  }

  const fragment = document.createDocumentFragment();
  renderEmployees.forEach((emp) => {
    const row = document.createElement("div");
    row.className = "employee-item";

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selectedEmployees.has(emp.employee);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedEmployees.add(emp.employee);
      else state.selectedEmployees.delete(emp.employee);
      syncRoleAssignmentsToSelectedCrew();
      renderRoleSelectors();
      persistToStorage();
      updateResults();
    });

    const text = document.createElement("span");
    const isSupervisor = isSupervisorEmployee(emp, state.selectedStoreKey);
    const supervisorBadge = isSupervisor
      ? ' <span class="sup-tag">Supervisor</span>'
      : "";
    text.innerHTML = `${escapeHtml(getEmployeeDisplayName(emp.employee))}${supervisorBadge} (${formatNumber(displayEmployeeSpeed(emp, selectedAccount), 1)} pieces/hr)`;

    label.appendChild(checkbox);
    label.appendChild(text);
    row.appendChild(label);
    fragment.appendChild(row);
  });
  dom.employeeList.appendChild(fragment);
}

function onEmployeeFilterKeyDown(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();

  const query = (dom.employeeFilter.value || "").trim().toLowerCase();
  if (!query || state.visibleEmployees.length === 0) return;

  const exactMatch = state.visibleEmployees.find((id) => {
    const name = getEmployeeDisplayName(id).toLowerCase();
    return name === query || id.toLowerCase() === query;
  });
  const chosen = exactMatch || state.visibleEmployees[0];
  if (!chosen) return;

  state.selectedEmployees.add(chosen);
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  persistToStorage();
  renderEmployeeList();
  updateResults();

  dom.employeeFilter.value = "";
  renderEmployeeList();
}

function onPlanningInputChange() {
  state.planningMode =
    dom.planningMode.value === "manhours" ? "manhours" : "duration";
  state.targetValue = Math.max(0, toNumber(dom.targetValue.value));
  persistToStorage();
  updateResults();
}

function clearEmployees() {
  state.selectedEmployees.clear();
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  persistToStorage();
  renderEmployeeList();
  updateResults();
}

function selectVisibleEmployees() {
  state.visibleEmployees.forEach((name) => state.selectedEmployees.add(name));
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  persistToStorage();
  renderEmployeeList();
  updateResults();
}

function selectLastCrew() {
  const crew = state.storeLastCrew.get(state.selectedStoreKey) || [];
  const supervisor = cleanText(
    state.storeLastSupervisor.get(state.selectedStoreKey),
  );
  const selected = new Set(crew);
  if (supervisor) selected.add(supervisor);
  state.selectedEmployees = selected;

  const storeKey = state.selectedStoreKey;
  if (storeKey) {
    const currentRoles = getRoleSelectionForStore(storeKey);
    state.selectedRolesByStore[storeKey] = {
      ...currentRoles,
      supervisor: supervisor || currentRoles.supervisor || "",
    };
  }
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  persistToStorage();
  renderEmployeeList();
  updateResults();
}

function predict() {
  if (!state.analyticsReady) return null;

  const store = state.stores.get(state.selectedStoreKey);
  const roles = getRoleSelectionForStore(state.selectedStoreKey);
  const rxRequired = isRxRoleRequiredForStore(store);
  const hasRequiredRx =
    !rxRequired ||
    normalizeRoleArray(roles.rx).some((id) => state.selectedEmployees.has(id));
  if (
    !store ||
    state.selectedEmployees.size === 0 ||
    !roles.supervisor ||
    !state.selectedEmployees.has(roles.supervisor) ||
    !hasRequiredRx
  ) {
    return null;
  }

  const tuningCtx = getTuningForStore(store);
  const baselineTuningCtx = getBaselineTuningForStore(store);
  const tuning = tuningCtx.tuning;
  const baseline = resolveBaselinePieces(
    store,
    baselineTuningCtx.tuning,
    store.primaryType,
  );
  const overhead = resolveOverheadHours(store, tuning.overheadScale);
  const selectedRaw = Array.from(state.selectedEmployees);
  const crewSpeeds = selectedRaw
    .map((name) =>
      effectiveEmployeeSpeed(
        state.employees.get(name),
        state.selectedStoreKey,
        store.account,
      ),
    )
    .filter((v) => v > 0);

  const crewSpeedRaw = crewSpeeds.reduce((sum, n) => sum + n, 0);
  const crewSize = crewSpeeds.length;
  const crewEfficiency = getCrewEfficiencyFactor(crewSize, tuning);
  const crewSpeed = crewSpeedRaw * crewEfficiency;

  if (!(baseline.value > 0) || !(crewSpeed > 0) || crewSize === 0) return null;

  const rawOnSiteDuration = overhead.value + baseline.value / crewSpeed;
  const residualAdjustment = resolveResidualAdjustmentForStore(
    store,
    crewSize,
    roles.supervisor,
  );
  const overlap = getLastCrewOverlapRate(state.selectedStoreKey, selectedRaw);
  const lastResidual = state.lastDurationResidualByStore.get(state.selectedStoreKey);
  const lastCrewBias =
    overlap > 0 && Number.isFinite(lastResidual?.durationResidual)
      ? overlap * 0.15 * safeNumber(lastResidual.durationResidual)
      : 0;
  const onSiteDuration = Math.max(
    0,
    rawOnSiteDuration + residualAdjustment.biasHours + lastCrewBias,
  );
  const manHours = Math.max(0, onSiteDuration * crewSize);
  const fallbackBand = resolveDurationBand(store) * 0.7;
  const lowOffset =
    residualAdjustment.rangeCount > 0
      ? residualAdjustment.lowOffset * state.uncertaintyScale
      : -fallbackBand;
  const highOffset =
    residualAdjustment.rangeCount > 0
      ? residualAdjustment.highOffset * state.uncertaintyScale
      : fallbackBand;
  const rangeCandidates = [
    onSiteDuration + lowOffset,
    onSiteDuration + highOffset,
    onSiteDuration,
  ];
  const confidenceLow = Math.max(0, Math.min(...rangeCandidates));
  const confidenceHigh = Math.max(confidenceLow, Math.max(...rangeCandidates));
  const delta = computeDelta(onSiteDuration, manHours);

  return {
    account: store.account,
    storeName: store.storeName,
    crewSize,
    selectedEmployeesDisplay: selectedRaw.map(getEmployeeDisplayName),
    selectedEmployeeRates: selectedRaw.map((id) => ({
      name: getEmployeeDisplayName(id),
      piecesPerHr: effectiveEmployeeSpeed(
        state.employees.get(id),
        state.selectedStoreKey,
        store.account,
      ),
    })),
    baselinePieces: baseline.value,
    baselineSource: baseline.source,
    baselineMode: baseline.modeLabel,
    baselineBlend: baseline.blendLabel,
    overheadHours: overhead.value,
    overheadSource: overhead.source,
    tuningScope: tuningCtx.scope,
    tuningLabel: tuningCtx.label,
    tuning,
    baselineTuningScope: baselineTuningCtx.scope,
    baselineTuningLabel: baselineTuningCtx.label,
    baselineTuning: baselineTuningCtx.tuning,
    crewSpeedRaw,
    crewEfficiency,
    crewSpeed,
    rawOnSiteDuration,
    biasAdjustmentHours: residualAdjustment.biasHours,
    manHourBiasAdjustment: 0,
    onSiteDuration,
    manHours,
    confidenceLow,
    confidenceHigh,
    residualRangeScope: residualAdjustment.rangeScope,
    residualRangeCount: residualAdjustment.rangeCount,
    lastCrewOverlap: overlap,
    lastStoreResidualHours: lastResidual?.durationResidual || 0,
    roleModes: getRoleModesForStore(state.selectedStoreKey),
    roleAssignments: roles,
    delta,
  };
}

function computeDelta(inStoreDuration, manHours) {
  if (!(state.targetValue > 0))
    return { available: false, mode: state.planningMode, value: 0 };

  const value =
    state.planningMode === "manhours"
      ? manHours - state.targetValue
      : inStoreDuration - state.targetValue;

  return { available: true, mode: state.planningMode, value };
}

function resolveBaselinePieces(
  store,
  baselineTuning = state.baselineTuning,
  typeOverride = null,
) {
  const storeMode = baselineTuning?.storeMode || "median";
  const contextMode = baselineTuning?.contextMode || "median";
  const storeCandidate = pickBaselineCandidate(store, storeMode);
  const segmentKey =
    state.storeSegmentByStoreKey.get(store.storeKey)?.segmentKey ||
    `${store.account}||S1`;
  const segmentStats = state.accountSegmentStats.get(segmentKey);
  const typeKey = `${store.account}||${typeOverride || store.primaryType || "Unknown"}`;
  const typeStats = state.accountTypeStats.get(typeKey);
  const officeKey = `${store.account}||${store.officeName || "Unknown"}`;
  const officeStats = state.accountOfficeStats.get(officeKey);
  const accountStats = state.accountGlobalStats.get(store.account);
  const context = resolveContextBaseline(
    segmentStats,
    typeStats,
    officeStats,
    accountStats,
    contextMode,
    baselineTuning,
  );

  if (storeCandidate > 0 && context.value > 0) {
    const n = Math.max(0, safeNumber(store.jobCount));
    const shrinkK = Math.max(1, safeNumber(baselineTuning?.storeShrinkK));
    const rawStoreWeight = n / (n + shrinkK);
    const minStoreWeight = Math.max(
      0,
      Math.min(0.9, safeNumber(baselineTuning?.minStoreWeight) || 0.45),
    );
    const storeWeight = n > 0 ? Math.max(rawStoreWeight, minStoreWeight) : rawStoreWeight;
    return {
      value: storeWeight * storeCandidate + (1 - storeWeight) * context.value,
      source: `store ${storeMode} + ${context.source}`,
      modeLabel: `store=${storeMode}, context=${contextMode}`,
      blendLabel: `store weight ${formatNumber(storeWeight, 2)} (raw ${formatNumber(rawStoreWeight, 2)})`,
    };
  }

  if (storeCandidate > 0) {
    return {
      value: storeCandidate,
      source: `store ${storeMode}`,
      modeLabel: `store=${storeMode}, context=${contextMode}`,
      blendLabel: "store-only",
    };
  }

  return {
    value: context.value,
    source: context.source,
    modeLabel: `store=${storeMode}, context=${contextMode}`,
    blendLabel: "context-only",
  };
}

function resolveBaselinePiecesForJob(job, store, baselineTuning) {
  return resolveBaselinePieces(
    store,
    baselineTuning,
    job?.typeOfInv || store?.primaryType || "Unknown",
  );
}

function pickBaselineCandidate(stats, mode = "median") {
  if (!stats) return 0;
  if (mode === "trimmed" && stats.trimmedMeanPieces > 0)
    return stats.trimmedMeanPieces;
  if (mode === "recent" && stats.recentWeightedPieces > 0)
    return stats.recentWeightedPieces;
  if (mode === "avg" && stats.avgPieces > 0) return stats.avgPieces;
  if (stats.medianPieces > 0) return stats.medianPieces;
  if (stats.trimmedMeanPieces > 0) return stats.trimmedMeanPieces;
  if (stats.recentWeightedPieces > 0) return stats.recentWeightedPieces;
  return stats.avgPieces > 0 ? stats.avgPieces : 0;
}

function resolveContextBaseline(
  segmentStats,
  typeStats,
  officeStats,
  accountStats,
  contextMode,
  baselineTuning,
) {
  const globalStats = {
    avgPieces: state.global.avgPieces,
    medianPieces: state.global.medianPieces,
    trimmedMeanPieces: state.global.trimmedMeanPieces,
    recentWeightedPieces: state.global.recentWeightedPieces,
  };

  const candidates = [
    {
      key: "account segment",
      value: pickBaselineCandidate(segmentStats, contextMode),
      weight: safeNumber(baselineTuning?.segmentWeight),
    },
    {
      key: "account type",
      value: pickBaselineCandidate(typeStats, contextMode),
      weight: safeNumber(baselineTuning?.typeWeight),
    },
    {
      key: "account global",
      value: pickBaselineCandidate(accountStats, contextMode),
      weight: safeNumber(baselineTuning?.accountWeight),
    },
    {
      key: "account office",
      value: pickBaselineCandidate(officeStats, contextMode),
      weight: safeNumber(baselineTuning?.officeWeight),
    },
    {
      key: "global",
      value: pickBaselineCandidate(globalStats, contextMode),
      weight: safeNumber(baselineTuning?.globalWeight),
    },
  ].filter((item) => item.value > 0 && item.weight > 0);

  if (!candidates.length) {
    return { value: 0, source: "no context baseline" };
  }

  const sumW = candidates.reduce((sum, c) => sum + c.weight, 0);
  const value = candidates.reduce((sum, c) => sum + c.value * c.weight, 0) / sumW;
  const source = candidates.map((c) => c.key).join(" + ");
  return { value, source };
}

function resolveOverheadHours(
  store,
  overheadScale = state.modelTuning.overheadScale,
) {
  if (store?.overheadBaseP20 > 0)
    return {
      value: Math.max(0, store.overheadBaseP20 * overheadScale),
      source: "store overhead",
    };

  const segmentKey =
    state.storeSegmentByStoreKey.get(store.storeKey)?.segmentKey ||
    `${store.account}||S1`;
  const segmentStats = state.accountSegmentStats.get(segmentKey);
  if (segmentStats?.overheadBaseP20 > 0)
    return {
      value: Math.max(0, segmentStats.overheadBaseP20 * overheadScale),
      source: "account segment overhead",
    };

  const typeKey = `${store.account}||${store.primaryType || "Unknown"}`;
  const typeStats = state.accountTypeStats.get(typeKey);
  if (typeStats?.overheadBaseP20 > 0)
    return {
      value: Math.max(0, typeStats.overheadBaseP20 * overheadScale),
      source: "account type overhead",
    };

  const officeKey = `${store.account}||${store.officeName || "Unknown"}`;
  const officeStats = state.accountOfficeStats.get(officeKey);
  if (officeStats?.overheadBaseP20 > 0)
    return {
      value: Math.max(0, officeStats.overheadBaseP20 * overheadScale),
      source: "account office overhead",
    };

  const accountStats = state.accountGlobalStats.get(store.account);
  if (accountStats?.overheadBaseP20 > 0)
    return {
      value: Math.max(0, accountStats.overheadBaseP20 * overheadScale),
      source: "account overhead",
    };

  return {
    value: Math.max(
      0,
      safeNumber(state.global.overheadBaseP20) * overheadScale,
    ),
    source: "global overhead",
  };
}

function resolveDurationBand(store) {
  if (store.robustDurationSpread > 0) return store.robustDurationSpread;
  if (store.durationStdDev > 0) return store.durationStdDev;
  if (state.global.robustDurationSpread > 0)
    return state.global.robustDurationSpread;
  return safeNumber(state.global.durationStdDev);
}

function computePredictionForJob(job, store, options = {}) {
  const tuning = options.tuning || getTuningForJob(job, store);
  const baselineTuning =
    options.baselineTuning || getBaselineTuningForJob(job, store);
  const baseline = resolveBaselinePiecesForJob(job, store, baselineTuning);
  if (!(baseline.value > 0)) return null;

  const overhead = resolveOverheadHours(store, tuning.overheadScale);
  const crewSize = Math.max(1, safeNumber(job.crewSize));
  const crewSpeedRaw = (job.employees || [])
    .map((id) =>
      effectiveEmployeeSpeed(
        state.employees.get(id),
        job.storeKey,
        store.account,
      ),
    )
    .filter((v) => v > 0)
    .reduce((sum, n) => sum + n, 0);
  if (!(crewSpeedRaw > 0)) return null;

  const efficiency = getCrewEfficiencyFactor(crewSize, tuning);
  const rawOnSiteDuration = overhead.value + baseline.value / (crewSpeedRaw * efficiency);
  const durationAdj = options.applyResiduals
    ? resolveResidualAdjustmentForStore(store, crewSize, job.supervisorNumber).biasHours
    : 0;
  const onSiteDuration = Math.max(0, rawOnSiteDuration + durationAdj);
  const manHours = Math.max(0, onSiteDuration * crewSize);

  return {
    onSiteDuration,
    manHours,
    rawOnSiteDuration,
    crewSize,
    baseline,
    overhead,
    efficiency,
    crewSpeedRaw,
  };
}

function updateResults() {
  const store = state.stores.get(state.selectedStoreKey);
  const roleSelection = getRoleSelectionForStore(state.selectedStoreKey);
  const missingSupervisor =
    state.selectedEmployees.size > 0 &&
    (!roleSelection.supervisor ||
      !state.selectedEmployees.has(roleSelection.supervisor));
  const rxRequired = isRxRoleRequiredForStore(store);
  const missingRxRole =
    state.selectedEmployees.size > 0 &&
    rxRequired &&
    !normalizeRoleArray(roleSelection.rx).some((id) =>
      state.selectedEmployees.has(id),
    );

  if (!state.analyticsReady) {
    dom.predDuration.textContent = "-";
    dom.predManHours.textContent = "-";
    dom.predBand.textContent = "-";
    dom.predDelta.textContent = "-";
    const waitMessage = !state.isLoaded
      ? "Loading data..."
      : state.analyticsScheduled
        ? "Calibrating model and store accuracy. Predictions will appear automatically when complete."
        : "Model calibration is not ready. Click Compute Accuracy to retry.";
    setPredictionMeta(waitMessage, state.analyticsScheduled ? "info" : "warning");
    renderScenarios(null);
    return;
  }

  const prediction = predict();

  if (!prediction) {
    dom.predDuration.textContent = "-";
    dom.predManHours.textContent = "-";
    dom.predBand.textContent = "-";
    dom.predDelta.textContent = "-";
    const metaMessage = !state.isLoaded
      ? "Loading data..."
      : !state.selectedStoreKey
        ? "Select a store to begin."
        : missingSupervisor && missingRxRole
          ? "Assign a supervisor and at least one RX role to view the plan preview."
          : missingSupervisor
            ? "Assign a supervisor to view the plan preview."
            : missingRxRole
              ? "Assign at least one RX role to view the plan preview."
              : "Choose your crew to view the plan preview.";
    const needsAttention = missingSupervisor || missingRxRole;
    setPredictionMeta(metaMessage, needsAttention ? "warning" : "info");
    renderScenarios(null);
    dom.storeAccuracySummary.textContent =
      "Select a store and configure a crew to view store accuracy.";
    dom.accuracySummary.textContent =
      "Select a store and configure a crew to view the accuracy snapshot.";
    dom.accuracyWorstBody.innerHTML = "";
    return;
  }

  dom.predDuration.textContent = `${formatNumber(prediction.onSiteDuration, 2)} hrs`;
  dom.predManHours.textContent = `${formatNumber(prediction.manHours, 2)} man-hours`;
  dom.predBand.textContent = `${formatNumber(prediction.confidenceLow, 2)} - ${formatNumber(prediction.confidenceHigh, 2)} hrs`;
  dom.predDelta.textContent = formatDelta(prediction.delta);

  const baselineWeights = prediction.baselineTuning
    ? `w[s/t/o/a/g]=${formatNumber(prediction.baselineTuning.segmentWeight, 2)}/${formatNumber(prediction.baselineTuning.typeWeight, 2)}/${formatNumber(prediction.baselineTuning.officeWeight, 2)}/${formatNumber(prediction.baselineTuning.accountWeight, 2)}/${formatNumber(prediction.baselineTuning.globalWeight, 2)}`
    : "";
  setPredictionMeta(
    `In-store ${formatNumber(prediction.onSiteDuration, 2)} hrs | Crew speed ${formatNumber(prediction.crewSpeed, 1)} pieces/hr (eff ${formatNumber(prediction.crewEfficiency, 2)}) | Duration bias ${formatSigned(prediction.biasAdjustmentHours, 2)} hrs | Man-hour bias ${formatSigned(prediction.manHourBiasAdjustment, 2)} | Baseline ${prediction.baselineMode} (${prediction.baselineBlend}) ${baselineWeights} | Error band source ${prediction.residualRangeScope} (${prediction.residualRangeCount} jobs)`,
    "info",
  );
  renderScenarios(prediction);
}

function setPredictionMeta(message, tone = "info") {
  dom.predictionMeta.textContent = message || "";
  const isWarning = tone === "warning";
  dom.predictionMeta.classList.toggle("meta-warning", isWarning);
}

function getStoreDisplayLabel(store) {
  if (!store) return "";
  return `${store.account} | ${store.storeName}`;
}

function resolveStoreKeyFromInput(inputValue) {
  const raw = cleanText(inputValue);
  if (!raw) return "";
  if (state.stores.has(raw)) return raw;
  const byExactLabel = state.storesList.find(
    (store) => getStoreDisplayLabel(store).toLowerCase() === raw.toLowerCase(),
  );
  if (byExactLabel) return byExactLabel.storeKey;
  const byStoreName = state.storesList.filter(
    (store) => cleanText(store.storeName).toLowerCase() === raw.toLowerCase(),
  );
  if (byStoreName.length === 1) return byStoreName[0].storeKey;
  const contains = state.storesList.filter((store) =>
    getStoreDisplayLabel(store).toLowerCase().includes(raw.toLowerCase()),
  );
  if (contains.length === 1) return contains[0].storeKey;
  return "";
}

function getEmployeeInputLabel(employeeId) {
  return `${getEmployeeDisplayName(employeeId)} (${employeeId})`;
}

function resolveEmployeeIdFromInput(inputValue, allowedIds = []) {
  const raw = cleanText(inputValue);
  if (!raw) return "";
  const allowed = new Set(allowedIds || []);
  const inAllowed = (id) => (allowed.size === 0 ? true : allowed.has(id));
  if (inAllowed(raw) && state.employees.has(raw)) return raw;

  const paren = raw.match(/\(([^)]+)\)\s*$/);
  if (paren) {
    const id = cleanText(paren[1]);
    if (inAllowed(id) && state.employees.has(id)) return id;
  }

  const matches = (allowedIds || []).filter(
    (id) => getEmployeeDisplayName(id).toLowerCase() === raw.toLowerCase(),
  );
  if (matches.length === 1) return matches[0];
  return "";
}

function renderScenarios(prediction) {
  dom.scenarioBody.innerHTML = "";

  if (!prediction) {
    dom.scenarioBody.innerHTML = `<tr><td colspan="3" class="muted">No staffing ranking available yet.</td></tr>`;
    return;
  }

  const poolRaw = Array.from(state.selectedEmployees);

  const ranked = poolRaw
    .map((id) => ({
      id,
      speed: effectiveEmployeeSpeed(
        state.employees.get(id),
        state.selectedStoreKey,
        getSelectedAccount(),
      ),
    }))
    .filter((item) => item.speed > 0)
    .sort((a, b) => b.speed - a.speed);

  if (ranked.length === 0) {
    dom.scenarioBody.innerHTML = `<tr><td colspan="3" class="muted">No valid speed data for selected crew.</td></tr>`;
    return;
  }

  ranked.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = [
      `<td>${index + 1}</td>`,
      `<td>${escapeHtml(getEmployeeDisplayName(item.id))}</td>`,
      `<td>${formatNumber(item.speed, 1)}</td>`,
    ].join("");
  dom.scenarioBody.appendChild(tr);
  });
}

async function buildAccuracyCache(jobsSubset) {
  const maybeYield = createUiYieldController(10);
  const jobs = jobsSubset || [];
  if (!jobs.length) return null;

  const storeAgg = new Map();
  let totalAbs = 0;
  let totalPct = 0;
  let totalWeight = 0;
  let counted = 0;
  const maxJobTimestamp = jobs
    .map((job) => Date.parse(job.date || ""))
    .filter((ts) => Number.isFinite(ts))
    .reduce((max, ts) => Math.max(max, ts), 0);
  const referenceTimestamp = maxJobTimestamp > 0 ? maxJobTimestamp : Date.now();

  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    const store = state.stores.get(job.storeKey);
    if (!store || !(job.duration > 0)) {
      if (i % 25 === 0) await maybeYield();
      continue;
    }

    const predicted = computePredictionForJob(job, store, {
      applyResiduals: true,
    });
    if (!predicted) {
      if (i % 25 === 0) await maybeYield();
      continue;
    }

    const durationPred = predicted.onSiteDuration;
    const manPred = predicted.manHours;
    const actual = job.duration;
    const absErr = Math.abs(durationPred - actual);
    const pctErr = actual > 0 ? (absErr / actual) * 100 : 0;
    const jobTimestamp = Date.parse(job.date || "");
    const ageDays = Number.isFinite(jobTimestamp)
      ? Math.max(0, (referenceTimestamp - jobTimestamp) / 86400000)
      : 0;
    const weight = recencyDecayWeight(ageDays, 180);

    totalAbs += absErr * weight;
    totalPct += pctErr * weight;
    totalWeight += weight;
    counted += 1;

    if (!storeAgg.has(job.storeKey)) {
      storeAgg.set(job.storeKey, {
        storeKey: job.storeKey,
        account: job.account,
        label: `${job.account} | ${job.storeName}`,
        absErrWeightedSum: 0,
        pctErrWeightedSum: 0,
        actualDurationWeightedSum: 0,
        predictedDurationWeightedSum: 0,
        actualManHoursWeightedSum: 0,
        predictedManHoursWeightedSum: 0,
        weightSum: 0,
        count: 0,
      });
    }
    const bucket = storeAgg.get(job.storeKey);
    bucket.absErrWeightedSum += absErr * weight;
    bucket.pctErrWeightedSum += pctErr * weight;
    bucket.actualDurationWeightedSum += actual * weight;
    bucket.predictedDurationWeightedSum += durationPred * weight;
    bucket.actualManHoursWeightedSum += safeNumber(job.totalManHours) * weight;
    bucket.predictedManHoursWeightedSum += manPred * weight;
    bucket.weightSum += weight;
    bucket.count += 1;

    if (i % 25 === 0) await maybeYield();
  }

  const allRows = Array.from(storeAgg.values()).map((b) => ({
    storeKey: b.storeKey,
    account: b.account,
    label: b.label,
    mae: b.weightSum > 0 ? b.absErrWeightedSum / b.weightSum : 0,
    mape: b.weightSum > 0 ? b.pctErrWeightedSum / b.weightSum : 0,
    actualAvgDuration:
      b.weightSum > 0 ? b.actualDurationWeightedSum / b.weightSum : 0,
    predictedAvgDuration:
      b.weightSum > 0 ? b.predictedDurationWeightedSum / b.weightSum : 0,
    actualAvgManHours:
      b.weightSum > 0 ? b.actualManHoursWeightedSum / b.weightSum : 0,
    predictedAvgManHours:
      b.weightSum > 0 ? b.predictedManHoursWeightedSum / b.weightSum : 0,
    weightSum: b.weightSum,
    count: b.count,
  }));

  return {
    mae: totalWeight > 0 ? totalAbs / totalWeight : 0,
    mape: totalWeight > 0 ? totalPct / totalWeight : 0,
    totalWeight,
    counted,
    allRows,
  };
}

function renderAccuracyReport() {
  if (!state.analyticsReady) {
    if (state.analyticsScheduled) {
      dom.accuracySummary.textContent =
        "Computing accuracy snapshot from historical jobs...";
      dom.storeAccuracySummary.textContent =
        "Selected store accuracy will appear when processing completes.";
    } else {
      dom.accuracySummary.textContent =
        "Accuracy is not available yet. Click Compute Accuracy to retry.";
      dom.storeAccuracySummary.textContent =
        "Store accuracy is not computed yet.";
    }
    dom.accuracyWorstBody.innerHTML = "";
    return;
  }

  if (!state.jobs.length) {
    dom.accuracySummary.textContent = "Load data to view model accuracy.";
    dom.storeAccuracySummary.textContent =
      "Choose a store to view its historical prediction error.";
    dom.accuracyWorstBody.innerHTML = "";
    return;
  }

  const accuracy = state.accuracyCache;
  if (!accuracy || !(accuracy.counted > 0)) {
    dom.accuracySummary.textContent =
      "Not enough valid history to compute accuracy.";
    dom.storeAccuracySummary.textContent =
      "No valid historical jobs found for store accuracy.";
    dom.accuracyWorstBody.innerHTML = "";
    return;
  }

  const mae = safeNumber(accuracy.mae);
  const mape = safeNumber(accuracy.mape);
  const selectedAccount = dom.accuracyAccountFilter.value || "__all__";
  const allRows = accuracy.allRows || [];

  const filteredRows =
    selectedAccount === "__all__"
      ? allRows
      : allRows.filter((r) => r.account === selectedAccount);

  const filteredWeight = filteredRows.reduce(
    (sum, row) => sum + safeNumber(row.weightSum),
    0,
  );
  const filteredMae =
    filteredWeight > 0
      ? filteredRows.reduce(
        (sum, row) => sum + safeNumber(row.mae) * safeNumber(row.weightSum),
        0,
      ) / filteredWeight
      : 0;
  const filteredMape =
    filteredWeight > 0
      ? filteredRows.reduce(
        (sum, row) => sum + safeNumber(row.mape) * safeNumber(row.weightSum),
        0,
      ) / filteredWeight
      : 0;
  const filteredStoreCount = filteredRows.length;
  const filteredJobCount = filteredRows.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const backtestText =
    state.backtestMetrics.jobs > 0
      ? ` | Holdout MAE: ${formatNumber(state.backtestMetrics.durationMae, 2)} hrs / ${formatNumber(state.backtestMetrics.manHoursMae, 2)} man-hours (${state.backtestMetrics.jobs} jobs since ${state.backtestMetrics.splitDate || "split"})`
      : "";
  dom.accuracySummary.textContent = `View: ${selectedAccount === "__all__" ? "All Accounts" : selectedAccount} | Average Store MAE: ${formatNumber(filteredMae || mae, 2)} hrs | Average Store MAPE: ${formatNumber(filteredMape || mape, 1)}% | Stores included: ${filteredStoreCount} | Jobs evaluated: ${filteredJobCount || safeNumber(accuracy.counted)}${backtestText}`;

  const selectedStoreKey = state.selectedStoreKey;
  const selectedStoreRow = allRows.find((r) => r.storeKey === selectedStoreKey);
  if (selectedStoreRow) {
    const durationDelta =
      selectedStoreRow.predictedAvgDuration - selectedStoreRow.actualAvgDuration;
    const manHoursDelta =
      selectedStoreRow.predictedAvgManHours - selectedStoreRow.actualAvgManHours;
    const trend = classifyAccuracyTrend(durationDelta);
    const durationDiffClass = `accuracy-diff-${trend.key}`;
    const manTrend = classifyAccuracyTrend(manHoursDelta, 0.75);
    const manDiffClass = `accuracy-diff-${manTrend.key}`;
    dom.storeAccuracySummary.innerHTML = [
      `<span class="accuracy-status accuracy-status-${trend.key}">${escapeHtml(trend.label)}</span>`,
      `<strong>Store:</strong> ${escapeHtml(selectedStoreRow.label)}`,
      `<strong>Based On:</strong> Recency-weighted averages across ${selectedStoreRow.count} past inventories`,
      `<strong>Avg In-Store Time</strong> | Actual: ${formatNumber(selectedStoreRow.actualAvgDuration, 2)} hrs | Predicted: ${formatNumber(selectedStoreRow.predictedAvgDuration, 2)} hrs | Difference: <span class="accuracy-diff ${durationDiffClass}">${formatSigned(durationDelta, 2)} hrs</span>`,
      `<strong>Avg Man-Hours</strong> | Actual: ${formatNumber(selectedStoreRow.actualAvgManHours, 2)} | Predicted: ${formatNumber(selectedStoreRow.predictedAvgManHours, 2)} | Difference: <span class="accuracy-diff ${manDiffClass}">${formatSigned(manHoursDelta, 2)}</span>`,
    ].join("<br>");
  } else {
    dom.storeAccuracySummary.textContent =
      "Selected store does not have enough valid historical jobs yet.";
  }

  dom.accuracyWorstBody.innerHTML = "";
  if (!filteredRows.length) {
    dom.accuracyWorstBody.innerHTML = `<tr><td colspan="4" class="muted">No store history available for this account filter.</td></tr>`;
    return;
  }

  const tr = document.createElement("tr");
  tr.innerHTML = [
    `<td>${escapeHtml(selectedAccount === "__all__" ? "All Accounts (Avg Across Stores)" : `${selectedAccount} (Avg Across Stores)`)}</td>`,
    `<td>${formatNumber(filteredMae || mae, 2)}</td>`,
    `<td>${formatNumber(filteredMape || mape, 1)}%</td>`,
    `<td>${filteredJobCount}</td>`,
  ].join("");
  dom.accuracyWorstBody.appendChild(tr);
}

async function calibrateModelParameters() {
  if (!state.jobs.length) return;
  const maybeYield = createUiYieldController(10);

  state.modelTuningByAccount = new Map();
  state.modelTuningByAccountType = new Map();
  state.modelTuningByAccountSegment = new Map();
  state.baselineTuningByAccount = new Map();
  state.baselineTuningByAccountType = new Map();
  state.baselineTuningByAccountSegment = new Map();

  const globalBundle = await calibrateParameterBundleForJobs(
    state.jobs,
    state.baseModelTuning,
    state.baseBaselineTuning,
    maybeYield,
  );
  state.modelTuning = globalBundle.modelTuning;
  state.baselineTuning = globalBundle.baselineTuning;

  const jobsByAccount = new Map();
  const jobsByAccountType = new Map();
  const jobsByAccountSegment = new Map();
  for (let i = 0; i < state.jobs.length; i += 1) {
    const job = state.jobs[i];
    if (!jobsByAccount.has(job.account)) jobsByAccount.set(job.account, []);
    jobsByAccount.get(job.account).push(job);

    const typeKey = `${job.account}||${job.typeOfInv || "Unknown"}`;
    if (!jobsByAccountType.has(typeKey)) jobsByAccountType.set(typeKey, []);
    jobsByAccountType.get(typeKey).push(job);

    const segmentKey = state.storeSegmentByStoreKey.get(job.storeKey)?.segmentKey;
    if (segmentKey) {
      if (!jobsByAccountSegment.has(segmentKey)) jobsByAccountSegment.set(segmentKey, []);
      jobsByAccountSegment.get(segmentKey).push(job);
    }
    if (i % 150 === 0) await maybeYield();
  }

  for (const [account, jobs] of jobsByAccount.entries()) {
    if (jobs.length < 40) continue;
    const tuned = await calibrateParameterBundleForJobs(
      jobs,
      state.modelTuning,
      state.baselineTuning,
      maybeYield,
    );
    state.modelTuningByAccount.set(account, tuned.modelTuning);
    state.baselineTuningByAccount.set(account, tuned.baselineTuning);
    await maybeYield();
  }

  for (const [key, jobs] of jobsByAccountSegment.entries()) {
    if (jobs.length < 28) continue;
    const account = key.split("||")[0];
    const accountModel = state.modelTuningByAccount.get(account) || state.modelTuning;
    const accountBaseline =
      state.baselineTuningByAccount.get(account) || state.baselineTuning;
    const tuned = await calibrateParameterBundleForJobs(
      jobs,
      accountModel,
      accountBaseline,
      maybeYield,
    );
    state.modelTuningByAccountSegment.set(key, tuned.modelTuning);
    state.baselineTuningByAccountSegment.set(key, tuned.baselineTuning);
    await maybeYield();
  }

  for (const [key, jobs] of jobsByAccountType.entries()) {
    if (jobs.length < 20) continue;
    const account = key.split("||")[0];
    const accountModel = state.modelTuningByAccount.get(account) || state.modelTuning;
    const accountBaseline =
      state.baselineTuningByAccount.get(account) || state.baselineTuning;
    const tuned = await calibrateParameterBundleForJobs(
      jobs,
      accountModel,
      accountBaseline,
      maybeYield,
    );
    state.modelTuningByAccountType.set(key, tuned.modelTuning);
    state.baselineTuningByAccountType.set(key, tuned.baselineTuning);
    await maybeYield();
  }
}

async function calibrateParameterBundleForJobs(
  jobsSubset,
  seedModelTuning,
  seedBaselineTuning,
  maybeYield = async () => {},
) {
  const split = splitJobsForBacktest(jobsSubset);
  const evalJobs = split.holdout.length >= 8 ? split.holdout : split.train;
  const modelTuning = await calibrateTuningForJobs(
    split.train,
    evalJobs,
    seedModelTuning,
    seedBaselineTuning,
    maybeYield,
  );
  const baselineTuning = await calibrateBaselineForJobs(
    split.train,
    evalJobs,
    modelTuning,
    seedBaselineTuning,
    maybeYield,
  );
  return { modelTuning, baselineTuning };
}

function splitJobsForBacktest(jobsSubset) {
  const sorted = [...(jobsSubset || [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  if (sorted.length < 16) return { train: sorted, holdout: [] };
  const splitIndex = Math.max(8, Math.floor(sorted.length * 0.8));
  return {
    train: sorted.slice(0, splitIndex),
    holdout: sorted.slice(splitIndex),
  };
}

async function calibrateTuningForJobs(
  _trainJobs,
  evalJobs,
  seedTuning,
  baselineTuning,
  maybeYield = async () => {},
) {
  const overheadCandidates = [0.1, 0.2, 0.25, 0.3, 0.4, 0.5];
  const midCandidates = [0.86, 0.9, 0.92, 0.95, 1.0];
  const largeCandidates = [0.76, 0.82, 0.85, 0.9, 0.94];
  let best = {
    score: Number.POSITIVE_INFINITY,
    overheadScale: seedTuning.overheadScale,
    effSmall: 1.0,
    effMid: seedTuning.effMid,
    effLarge: seedTuning.effLarge,
  };

  for (const overheadScale of overheadCandidates) {
    for (const effMid of midCandidates) {
      for (const effLarge of largeCandidates) {
        if (effLarge > effMid) continue;

        const tuning = { overheadScale, effSmall: 1.0, effMid, effLarge };
        const score = await replayScoreForParameters(
          evalJobs,
          tuning,
          baselineTuning,
          maybeYield,
        );
        if (score < best.score) {
          best = { score, ...tuning };
        }
        await maybeYield();
      }
    }
  }

  return {
    overheadScale: best.overheadScale,
    effSmall: best.effSmall,
    effMid: best.effMid,
    effLarge: best.effLarge,
  };
}

async function calibrateBaselineForJobs(
  _trainJobs,
  evalJobs,
  modelTuning,
  seedBaselineTuning,
  maybeYield = async () => {},
) {
  const storeModes = ["median", "trimmed", "recent"];
  const contextModes = ["median", "trimmed", "recent"];
  const storeKs = [2, 4, 6, 8];
  const contextProfiles = [
    {
      segmentWeight: 0.45,
      typeWeight: 0.25,
      officeWeight: 0.2,
      accountWeight: 0.05,
      globalWeight: 0.05,
    },
    {
      segmentWeight: 0.4,
      typeWeight: 0.2,
      officeWeight: 0.25,
      accountWeight: 0.1,
      globalWeight: 0.05,
    },
    {
      segmentWeight: 0.3,
      typeWeight: 0.3,
      officeWeight: 0.2,
      accountWeight: 0.1,
      globalWeight: 0.1,
    },
  ];

  let best = {
    score: Number.POSITIVE_INFINITY,
    ...seedBaselineTuning,
  };

  for (const storeMode of storeModes) {
    for (const contextMode of contextModes) {
      for (const storeShrinkK of storeKs) {
        for (const profile of contextProfiles) {
          const candidate = {
            storeMode,
            contextMode,
            storeShrinkK,
            ...profile,
          };
          const score = await replayScoreForParameters(
            evalJobs,
            modelTuning,
            candidate,
            maybeYield,
          );
          if (score < best.score) best = { score, ...candidate };
          await maybeYield();
        }
      }
    }
  }

  return {
    storeMode: best.storeMode,
    contextMode: best.contextMode,
    storeShrinkK: best.storeShrinkK,
    minStoreWeight: safeNumber(seedBaselineTuning?.minStoreWeight) || 0.45,
    segmentWeight: best.segmentWeight,
    typeWeight: best.typeWeight,
    officeWeight: best.officeWeight,
    accountWeight: best.accountWeight,
    globalWeight: best.globalWeight,
  };
}

async function replayScoreForParameters(
  jobsSubset,
  modelTuning,
  baselineTuning,
  maybeYield = async () => {},
) {
  let durationAbs = 0;
  let manHoursAbs = 0;
  let count = 0;

  const jobs = jobsSubset || [];
  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    const store = state.stores.get(job.storeKey);
    if (!store || !(job.duration > 0)) {
      if (i % 25 === 0) await maybeYield();
      continue;
    }

    const predicted = computePredictionForJob(job, store, {
      tuning: modelTuning,
      baselineTuning,
      applyResiduals: false,
    });
    if (!predicted) {
      if (i % 25 === 0) await maybeYield();
      continue;
    }

    const durationErr = Math.abs(predicted.onSiteDuration - safeNumber(job.duration));
    const manErr = Math.abs(predicted.manHours - safeNumber(job.totalManHours));
    if (!Number.isFinite(durationErr) || !Number.isFinite(manErr)) {
      if (i % 25 === 0) await maybeYield();
      continue;
    }
    durationAbs += clipOutlierError(durationErr, 12);
    manHoursAbs += clipOutlierError(manErr, 60);
    count += 1;
    if (i % 25 === 0) await maybeYield();
  }

  if (!(count > 0)) return Number.POSITIVE_INFINITY;
  const durationMae = durationAbs / count;
  const manHoursMae = manHoursAbs / count;
  return durationMae * 0.75 + manHoursMae * 0.25;
}

function clipOutlierError(value, cap) {
  const n = safeNumber(value);
  if (n <= 0) return 0;
  return Math.min(n, Math.max(1, safeNumber(cap)));
}

async function buildResidualStats(jobsSubset) {
  const maybeYield = createUiYieldController(10);
  const byStore = new Map();
  const byAccountSegment = new Map();
  const byAccountType = new Map();
  const byAccountOffice = new Map();
  const byAccount = new Map();
  const byStoreCrewBand = new Map();
  const byStoreSupervisor = new Map();
  const byAccountSupervisor = new Map();
  const byAccountSegmentCrewBand = new Map();
  const byAccountTypeCrewBand = new Map();
  const byAccountCrewBand = new Map();
  const globalCrewBand = new Map();
  const globalResiduals = [];
  const manByStore = new Map();
  const manByAccountSegment = new Map();
  const manByAccountType = new Map();
  const manByAccountOffice = new Map();
  const manByAccount = new Map();
  const manByStoreCrewBand = new Map();
  const manByStoreSupervisor = new Map();
  const manByAccountSupervisor = new Map();
  const manByAccountSegmentCrewBand = new Map();
  const manByAccountTypeCrewBand = new Map();
  const manByAccountCrewBand = new Map();
  const manGlobalCrewBand = new Map();
  const manGlobalResiduals = [];
  const latestByStore = new Map();

  const jobs = jobsSubset || [];
  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    const store = state.stores.get(job.storeKey);
    if (!store || !(job.duration > 0)) {
      if (i % 25 === 0) await maybeYield();
      continue;
    }

    const predicted = computePredictionForJob(job, store, {
      applyResiduals: false,
    });
    if (!predicted) {
      if (i % 25 === 0) await maybeYield();
      continue;
    }

    const residual = safeNumber(job.duration) - predicted.onSiteDuration;
    if (!Number.isFinite(residual)) {
      if (i % 25 === 0) await maybeYield();
      continue;
    }
    const manResidual = safeNumber(job.totalManHours) - predicted.manHours;

    const segmentKey = state.storeSegmentByStoreKey.get(job.storeKey)?.segmentKey;
    const typeKey = `${job.account}||${job.typeOfInv || "Unknown"}`;
    const officeKey = `${job.account}||${job.officeName || "Unknown"}`;
    const supervisorKey = cleanText(job.supervisorNumber || "").toLowerCase();
    const crewBand = getCrewBand(Math.max(1, safeNumber(job.crewSize)));
    const storeCrewKey = `${job.storeKey}||${crewBand}`;
    const segmentCrewKey = `${segmentKey || `${job.account}||S1`}||${crewBand}`;
    const typeCrewKey = `${typeKey}||${crewBand}`;
    const accountCrewKey = `${job.account}||${crewBand}`;

    pushResidual(byStore, job.storeKey, residual);
    pushResidual(byStoreCrewBand, storeCrewKey, residual);
    if (supervisorKey) {
      pushResidual(
        byStoreSupervisor,
        `${job.storeKey}||${supervisorKey}`,
        residual,
      );
      pushResidual(
        byAccountSupervisor,
        `${job.account}||${supervisorKey}`,
        residual,
      );
    }
    if (segmentKey) pushResidual(byAccountSegment, segmentKey, residual);
    if (segmentKey) pushResidual(byAccountSegmentCrewBand, segmentCrewKey, residual);
    pushResidual(byAccountType, typeKey, residual);
    pushResidual(byAccountOffice, officeKey, residual);
    pushResidual(byAccountTypeCrewBand, typeCrewKey, residual);
    pushResidual(byAccount, job.account, residual);
    pushResidual(byAccountCrewBand, accountCrewKey, residual);
    pushResidual(globalCrewBand, crewBand, residual);
    globalResiduals.push(residual);

    if (Number.isFinite(manResidual)) {
      pushResidual(manByStore, job.storeKey, manResidual);
      pushResidual(manByStoreCrewBand, storeCrewKey, manResidual);
      if (supervisorKey) {
        pushResidual(
          manByStoreSupervisor,
          `${job.storeKey}||${supervisorKey}`,
          manResidual,
        );
        pushResidual(
          manByAccountSupervisor,
          `${job.account}||${supervisorKey}`,
          manResidual,
        );
      }
      if (segmentKey) pushResidual(manByAccountSegment, segmentKey, manResidual);
      if (segmentKey)
        pushResidual(manByAccountSegmentCrewBand, segmentCrewKey, manResidual);
      pushResidual(manByAccountType, typeKey, manResidual);
      pushResidual(manByAccountOffice, officeKey, manResidual);
      pushResidual(manByAccountTypeCrewBand, typeCrewKey, manResidual);
      pushResidual(manByAccount, job.account, manResidual);
      pushResidual(manByAccountCrewBand, accountCrewKey, manResidual);
      pushResidual(manGlobalCrewBand, crewBand, manResidual);
      manGlobalResiduals.push(manResidual);
    }

    const stamp = new Date(job.date).getTime();
    const previous = latestByStore.get(job.storeKey);
    if (!previous || stamp > previous.stamp) {
      latestByStore.set(job.storeKey, {
        stamp,
        durationResidual: residual,
        manHoursResidual: manResidual,
      });
    }
    if (i % 25 === 0) await maybeYield();
  }

  state.residualByStore = summarizeResidualMap(byStore);
  state.residualByAccountSegment = summarizeResidualMap(byAccountSegment);
  state.residualByAccountType = summarizeResidualMap(byAccountType);
  state.residualByAccountOffice = summarizeResidualMap(byAccountOffice);
  state.residualByAccount = summarizeResidualMap(byAccount);
  state.residualByStoreCrewBand = summarizeResidualMap(byStoreCrewBand);
  state.residualByStoreSupervisor = summarizeResidualMap(byStoreSupervisor);
  state.residualByAccountSupervisor = summarizeResidualMap(byAccountSupervisor);
  state.residualByAccountSegmentCrewBand = summarizeResidualMap(
    byAccountSegmentCrewBand,
  );
  state.residualByAccountTypeCrewBand = summarizeResidualMap(byAccountTypeCrewBand);
  state.residualByAccountCrewBand = summarizeResidualMap(byAccountCrewBand);
  state.residualGlobalCrewBand = summarizeResidualMap(globalCrewBand);
  state.residualGlobal = summarizeResiduals(globalResiduals);
  state.manHourResidualByStore = summarizeResidualMap(manByStore);
  state.manHourResidualByAccountSegment = summarizeResidualMap(manByAccountSegment);
  state.manHourResidualByAccountType = summarizeResidualMap(manByAccountType);
  state.manHourResidualByAccountOffice = summarizeResidualMap(manByAccountOffice);
  state.manHourResidualByAccount = summarizeResidualMap(manByAccount);
  state.manHourResidualByStoreCrewBand = summarizeResidualMap(manByStoreCrewBand);
  state.manHourResidualByStoreSupervisor = summarizeResidualMap(
    manByStoreSupervisor,
  );
  state.manHourResidualByAccountSupervisor = summarizeResidualMap(
    manByAccountSupervisor,
  );
  state.manHourResidualByAccountSegmentCrewBand = summarizeResidualMap(
    manByAccountSegmentCrewBand,
  );
  state.manHourResidualByAccountTypeCrewBand = summarizeResidualMap(
    manByAccountTypeCrewBand,
  );
  state.manHourResidualByAccountCrewBand = summarizeResidualMap(
    manByAccountCrewBand,
  );
  state.manHourResidualGlobalCrewBand = summarizeResidualMap(manGlobalCrewBand);
  state.manHourResidualGlobal = summarizeResiduals(manGlobalResiduals);
  state.lastDurationResidualByStore = latestByStore;
  state.backtestMetrics = await computeHoldoutBacktestMetrics(jobsSubset, maybeYield);
  const inSampleMae = await replayScoreForParameters(
    jobsSubset,
    state.modelTuning,
    state.baselineTuning,
    maybeYield,
  );
  const holdoutDurationMae = safeNumber(state.backtestMetrics.durationMae);
  const ratio = holdoutDurationMae > 0 && inSampleMae > 0
    ? holdoutDurationMae / inSampleMae
    : 1;
  state.uncertaintyScale = Math.max(0.85, Math.min(1.5, ratio));
}

function pushResidual(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function summarizeResidualMap(map) {
  const result = new Map();
  map.forEach((values, key) => {
    result.set(key, summarizeResiduals(values));
  });
  return result;
}

function summarizeResiduals(values) {
  const clean = [...(values || [])].map(safeNumber).filter(Number.isFinite);
  if (!clean.length)
    return { count: 0, mean: 0, p10: 0, p25: 0, p75: 0, p90: 0, stdDev: 0 };
  return {
    count: clean.length,
    mean: mean(clean),
    p10: percentile(clean, 10),
    p25: percentile(clean, 25),
    p75: percentile(clean, 75),
    p90: percentile(clean, 90),
    stdDev: stdDev(clean),
  };
}

function blendResidualTowards(target, prior, n, k) {
  if (!(n > 0)) return prior;
  const w = n / (n + k);
  return prior + w * (target - prior);
}

function resolveResidualAdjustmentForStore(store, crewSize, supervisorId = "") {
  return resolveScopedResidualAdjustment({
    store,
    crewSize,
    supervisorId,
    globalStats: state.residualGlobal,
    byStore: state.residualByStore,
    bySegment: state.residualByAccountSegment,
    byType: state.residualByAccountType,
    byOffice: state.residualByAccountOffice,
    byAccount: state.residualByAccount,
    byStoreCrewBand: state.residualByStoreCrewBand,
    byStoreSupervisor: state.residualByStoreSupervisor,
    byAccountSupervisor: state.residualByAccountSupervisor,
    bySegmentCrewBand: state.residualByAccountSegmentCrewBand,
    byTypeCrewBand: state.residualByAccountTypeCrewBand,
    byAccountCrewBand: state.residualByAccountCrewBand,
    byGlobalCrewBand: state.residualGlobalCrewBand,
    shrinkageKs: state.residualShrinkageKs,
    profilesByDensity: state.residualProfilesByDensity,
  });
}

function resolveManHourAdjustmentForStore(store, crewSize, supervisorId = "") {
  return resolveScopedResidualAdjustment({
    store,
    crewSize,
    supervisorId,
    globalStats: state.manHourResidualGlobal,
    byStore: state.manHourResidualByStore,
    bySegment: state.manHourResidualByAccountSegment,
    byType: state.manHourResidualByAccountType,
    byOffice: state.manHourResidualByAccountOffice,
    byAccount: state.manHourResidualByAccount,
    byStoreCrewBand: state.manHourResidualByStoreCrewBand,
    byStoreSupervisor: state.manHourResidualByStoreSupervisor,
    byAccountSupervisor: state.manHourResidualByAccountSupervisor,
    bySegmentCrewBand: state.manHourResidualByAccountSegmentCrewBand,
    byTypeCrewBand: state.manHourResidualByAccountTypeCrewBand,
    byAccountCrewBand: state.manHourResidualByAccountCrewBand,
    byGlobalCrewBand: state.manHourResidualGlobalCrewBand,
    shrinkageKs: state.manHourShrinkageKs,
    profilesByDensity: state.residualProfilesByDensity,
  });
}

function resolveScopedResidualAdjustment(config) {
  const store = config.store;
  const crewBand = getCrewBand(crewSizeOrDefault(config.crewSize));
  const globalStats = config.globalStats || {
    count: 0,
    mean: 0,
    p10: 0,
    p25: 0,
    p75: 0,
    p90: 0,
    stdDev: 0,
  };
  const segmentKey =
    state.storeSegmentByStoreKey.get(store.storeKey)?.segmentKey ||
    `${store.account}||S1`;
  const typeKey = `${store.account}||${store.primaryType || "Unknown"}`;
  const officeKey = `${store.account}||${store.officeName || "Unknown"}`;
  const accountKey = store.account;
  const storeKey = store.storeKey;
  const supervisorKey = cleanText(config.supervisorId || "").toLowerCase();
  const profileDensity = getResidualProfileDensity(store);
  const profile =
    config.profilesByDensity?.[profileDensity] ||
    config.profilesByDensity?.dense ||
    null;

  const scoped = {
    account: config.byAccount?.get(accountKey),
    segment: config.bySegment?.get(segmentKey),
    type: config.byType?.get(typeKey),
    office: config.byOffice?.get(officeKey),
    store: config.byStore?.get(storeKey),
    supervisor:
      supervisorKey && config.byStoreSupervisor
        ? config.byStoreSupervisor.get(`${storeKey}||${supervisorKey}`)
        : null,
    accountSupervisor:
      supervisorKey && config.byAccountSupervisor
        ? config.byAccountSupervisor.get(`${accountKey}||${supervisorKey}`)
        : null,
    accountBand: config.byAccountCrewBand?.get(`${accountKey}||${crewBand}`),
    segmentBand: config.bySegmentCrewBand?.get(`${segmentKey}||${crewBand}`),
    typeBand: config.byTypeCrewBand?.get(`${typeKey}||${crewBand}`),
    storeBand: config.byStoreCrewBand?.get(`${storeKey}||${crewBand}`),
    globalBand: config.byGlobalCrewBand?.get(crewBand),
  };

  const ks = config.shrinkageKs || {};
  const profileKs = profile?.ks || {};
  const profileMins = profile?.mins || {};
  const kOf = (key, fallback) => {
    if (Number.isFinite(profileKs[key])) return profileKs[key];
    if (Number.isFinite(ks[key])) return ks[key];
    return fallback;
  };
  const minOf = (key, fallback) => {
    if (Number.isFinite(profileMins[key])) return profileMins[key];
    return fallback;
  };
  const floorOf = (key, fallback = 0) => {
    const floors = profile?.floors || {};
    if (Number.isFinite(floors[key])) return floors[key];
    return fallback;
  };
  let biasHours = safeNumber(globalStats.mean);
  biasHours = blendFromScope(scoped.account, biasHours, kOf("account", 24));
  biasHours = blendFromScope(scoped.segment, biasHours, kOf("segment", 14));
  biasHours = blendFromScope(scoped.type, biasHours, kOf("type", 16));
  biasHours = blendFromScope(scoped.office, biasHours, kOf("office", 16));
  biasHours = blendFromScope(
    scoped.store,
    biasHours,
    kOf("store", 8),
    floorOf("minStoreWeight", 0.3),
    (scoped.store?.count || 0) <= 2 ? 0.6 : Number.POSITIVE_INFINITY,
  );
  biasHours = blendFromScope(
    scoped.accountSupervisor,
    biasHours,
    kOf("accountSupervisor", 10),
  );
  biasHours = blendFromScope(
    scoped.supervisor,
    biasHours,
    kOf("storeSupervisor", 6),
  );
  biasHours = blendFromScope(scoped.globalBand, biasHours, kOf("globalBand", 18));
  biasHours = blendFromScope(scoped.accountBand, biasHours, kOf("accountBand", 14));
  biasHours = blendFromScope(scoped.segmentBand, biasHours, kOf("segmentBand", 12));
  biasHours = blendFromScope(scoped.typeBand, biasHours, kOf("typeBand", 12));
  biasHours = blendFromScope(scoped.storeBand, biasHours, kOf("storeBand", 8));

  // Keep final bias direction anchored to known store tendency (high/low)
  // so live estimates reflect the Selected Store Accuracy trend more clearly.
  const storeCount = Math.max(0, safeNumber(scoped.store?.count));
  const storeMean = safeNumber(scoped.store?.mean);
  const anchorShare = Math.max(
    0,
    Math.min(1, floorOf("anchorMinShare", profileDensity === "sparse" ? 0.55 : 0.4)),
  );
  const anchorWeightFloor = Math.max(
    0,
    Math.min(
      1,
      floorOf("anchorMinWeight", profileDensity === "sparse" ? 0.45 : 0.35),
    ),
  );
  const anchorK = Math.max(
    1,
    floorOf("anchorK", profileDensity === "sparse" ? 6 : 8),
  );
  const anchorMaxAbs = Math.max(
    0,
    floorOf("anchorMaxAbsHours", profileDensity === "sparse" ? 0.9 : 0.7),
  );
  if (storeCount > 0 && Math.abs(storeMean) > 0) {
    const desiredRaw = storeMean * anchorShare;
    const desired = Math.max(-anchorMaxAbs, Math.min(anchorMaxAbs, desiredRaw));
    const needsAnchor =
      Math.sign(biasHours) !== Math.sign(desired) ||
      Math.abs(biasHours) < Math.abs(desired);
    if (needsAnchor) {
      const anchorWeight = Math.max(
        anchorWeightFloor,
        storeCount / (storeCount + anchorK),
      );
      biasHours = biasHours + anchorWeight * (desired - biasHours);
    }
  }

  const rangeCandidates = [
    { scope: "store+crew-band", stats: scoped.storeBand, min: minOf("storeBand", 5) },
    {
      scope: "store+supervisor",
      stats: scoped.supervisor,
      min: minOf("storeSupervisor", 6),
    },
    { scope: "store", stats: scoped.store, min: minOf("store", 8) },
    {
      scope: "account+supervisor",
      stats: scoped.accountSupervisor,
      min: minOf("accountSupervisor", 10),
    },
    {
      scope: "account+segment+crew-band",
      stats: scoped.segmentBand,
      min: minOf("segmentBand", 10),
    },
    { scope: "account+segment", stats: scoped.segment, min: minOf("segment", 16) },
    {
      scope: "account+type+crew-band",
      stats: scoped.typeBand,
      min: minOf("typeBand", 12),
    },
    { scope: "account+type", stats: scoped.type, min: minOf("type", 18) },
    { scope: "account+office", stats: scoped.office, min: minOf("office", 16) },
    {
      scope: "account+crew-band",
      stats: scoped.accountBand,
      min: minOf("accountBand", 16),
    },
    { scope: "account", stats: scoped.account, min: minOf("account", 24) },
    {
      scope: "global+crew-band",
      stats: scoped.globalBand,
      min: minOf("globalBand", 20),
    },
  ];
  let chosen = { scope: "global", stats: globalStats };
  rangeCandidates.some((item) => {
    if ((item.stats?.count || 0) >= item.min) {
      chosen = item;
      return true;
    }
    return false;
  });

  return {
    biasHours,
    // "Likely" range uses central quartiles instead of 10/90 to reduce interval width.
    lowOffset: safeNumber(chosen.stats?.p25),
    highOffset: safeNumber(chosen.stats?.p75),
    rangeScope: chosen.scope,
    rangeCount: safeNumber(chosen.stats?.count),
    profileDensity,
  };
}

function blendFromScope(
  scopeStats,
  prior,
  k,
  minWeight = 0,
  maxDeltaAbs = Number.POSITIVE_INFINITY,
) {
  if (!(scopeStats?.count > 0)) return prior;
  const n = scopeStats.count;
  const rawWeight = n / (n + k);
  const weight = Math.max(Math.min(1, rawWeight), Math.max(0, minWeight));
  const target = safeNumber(scopeStats.mean);
  const delta = target - prior;
  const limitedDelta = Number.isFinite(maxDeltaAbs)
    ? Math.max(-Math.abs(maxDeltaAbs), Math.min(Math.abs(maxDeltaAbs), delta))
    : delta;
  return prior + weight * limitedDelta;
}

function getResidualProfileDensity(store) {
  const n = Math.max(0, safeNumber(store?.jobCount));
  return n < 10 ? "sparse" : "dense";
}

function crewSizeOrDefault(value) {
  const n = Math.round(safeNumber(value));
  return n > 0 ? n : 4;
}

function getCrewBand(crewSize) {
  const n = Math.max(1, Math.round(safeNumber(crewSize)));
  if (n <= 2) return "C1_2";
  if (n <= 4) return "C3_4";
  if (n <= 6) return "C5_6";
  return "C7P";
}

async function computeHoldoutBacktestMetrics(
  jobsSubset,
  maybeYield = async () => {},
) {
  const split = splitJobsForBacktest(jobsSubset || []);
  const holdout = split.holdout.length >= 8 ? split.holdout : [];
  if (!holdout.length) {
    return { durationMae: 0, manHoursMae: 0, jobs: 0, splitDate: "" };
  }

  let durationAbs = 0;
  let manAbs = 0;
  let count = 0;
  for (let i = 0; i < holdout.length; i += 1) {
    const job = holdout[i];
    const store = state.stores.get(job.storeKey);
    if (!store || !(job.duration > 0)) {
      if (i % 25 === 0) await maybeYield();
      continue;
    }
    const predicted = computePredictionForJob(job, store, { applyResiduals: true });
    if (!predicted) {
      if (i % 25 === 0) await maybeYield();
      continue;
    }
    durationAbs += Math.abs(predicted.onSiteDuration - safeNumber(job.duration));
    manAbs += Math.abs(predicted.manHours - safeNumber(job.totalManHours));
    count += 1;
    if (i % 25 === 0) await maybeYield();
  }

  return {
    durationMae: count > 0 ? durationAbs / count : 0,
    manHoursMae: count > 0 ? manAbs / count : 0,
    jobs: count,
    splitDate: holdout[0]?.date || "",
  };
}

function getLastCrewOverlapRate(storeKey, selectedCrew) {
  const lastCrew = state.storeLastCrew.get(storeKey) || [];
  if (!lastCrew.length || !(selectedCrew || []).length) return 0;
  const selectedSet = new Set((selectedCrew || []).filter(Boolean));
  const overlap = lastCrew.filter((id) => selectedSet.has(id)).length;
  return overlap / Math.max(1, selectedSet.size);
}

function getTuningForStore(store) {
  if (!store) {
    return {
      tuning: state.modelTuning,
      scope: "global",
      label: "Global tuned parameters",
    };
  }

  const segmentKey =
    state.storeSegmentByStoreKey.get(store.storeKey)?.segmentKey ||
    `${store.account}||S1`;
  if (state.modelTuningByAccountSegment.has(segmentKey)) {
    return {
      tuning: state.modelTuningByAccountSegment.get(segmentKey),
      scope: "account_segment",
      label: `Account+Segment tuned (${segmentKey})`,
    };
  }

  const typeKey = `${store.account}||${store.primaryType || "Unknown"}`;
  if (state.modelTuningByAccountType.has(typeKey)) {
    return {
      tuning: state.modelTuningByAccountType.get(typeKey),
      scope: "account_type",
      label: `Account+Type tuned (${store.account} / ${store.primaryType || "Unknown"})`,
    };
  }

  if (state.modelTuningByAccount.has(store.account)) {
    return {
      tuning: state.modelTuningByAccount.get(store.account),
      scope: "account",
      label: `Account tuned (${store.account})`,
    };
  }

  return {
    tuning: state.modelTuning,
    scope: "global",
    label: "Global tuned parameters",
  };
}

function getBaselineTuningForStore(store) {
  if (!store) {
    return {
      tuning: state.baselineTuning,
      scope: "global",
      label: "Global baseline tuning",
    };
  }

  const segmentKey =
    state.storeSegmentByStoreKey.get(store.storeKey)?.segmentKey ||
    `${store.account}||S1`;
  if (state.baselineTuningByAccountSegment.has(segmentKey)) {
    return {
      tuning: state.baselineTuningByAccountSegment.get(segmentKey),
      scope: "account_segment",
      label: `Account+Segment baseline (${segmentKey})`,
    };
  }

  const typeKey = `${store.account}||${store.primaryType || "Unknown"}`;
  if (state.baselineTuningByAccountType.has(typeKey)) {
    return {
      tuning: state.baselineTuningByAccountType.get(typeKey),
      scope: "account_type",
      label: `Account+Type baseline (${typeKey})`,
    };
  }

  if (state.baselineTuningByAccount.has(store.account)) {
    return {
      tuning: state.baselineTuningByAccount.get(store.account),
      scope: "account",
      label: `Account baseline (${store.account})`,
    };
  }

  return {
    tuning: state.baselineTuning,
    scope: "global",
    label: "Global baseline tuning",
  };
}

function getTuningForJob(job, store) {
  if (!job || !store) return state.modelTuning;
  const segmentKey = state.storeSegmentByStoreKey.get(job.storeKey)?.segmentKey;
  if (segmentKey && state.modelTuningByAccountSegment.has(segmentKey))
    return state.modelTuningByAccountSegment.get(segmentKey);
  const typeKey = `${job.account}||${job.typeOfInv || "Unknown"}`;
  if (state.modelTuningByAccountType.has(typeKey))
    return state.modelTuningByAccountType.get(typeKey);
  if (state.modelTuningByAccount.has(job.account))
    return state.modelTuningByAccount.get(job.account);
  return state.modelTuning;
}

function getBaselineTuningForJob(job, store) {
  if (!job || !store) return state.baselineTuning;
  const segmentKey = state.storeSegmentByStoreKey.get(job.storeKey)?.segmentKey;
  if (segmentKey && state.baselineTuningByAccountSegment.has(segmentKey)) {
    return state.baselineTuningByAccountSegment.get(segmentKey);
  }
  const typeKey = `${job.account}||${job.typeOfInv || "Unknown"}`;
  if (state.baselineTuningByAccountType.has(typeKey)) {
    return state.baselineTuningByAccountType.get(typeKey);
  }
  if (state.baselineTuningByAccount.has(job.account)) {
    return state.baselineTuningByAccount.get(job.account);
  }
  return state.baselineTuning;
}

function persistToStorage() {
  const snapshot = readStorage();
  snapshot.selectedStoreKey = state.selectedStoreKey;
  snapshot.crews = snapshot.crews || {};
  if (state.selectedStoreKey) {
    snapshot.crews[state.selectedStoreKey] = Array.from(
      state.selectedEmployees,
    );
  }
  snapshot.settings = {
    planningMode: state.planningMode,
    targetValue: state.targetValue,
    selectedRolesByStore: state.selectedRolesByStore,
    roleModesByStore: state.roleModesByStore,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function restoreSelectionsFromStorage() {
  const snapshot = readStorage();
  const storedStoreKey = snapshot.selectedStoreKey;
  state.selectedStoreKey = state.stores.has(storedStoreKey)
    ? storedStoreKey
    : state.storesList[0]?.storeKey || null;

  const savedCrew = readSavedCrew(state.selectedStoreKey);
  state.selectedEmployees = new Set(
    savedCrew.filter((name) => state.employees.has(name)),
  );
}

function restoreSettingsFromStorage() {
  const settings = readStorage().settings || {};
  state.planningMode =
    settings.planningMode === "manhours" ? "manhours" : "duration";
  state.targetValue = Math.max(0, toNumber(settings.targetValue));
  state.selectedRolesByStore =
    settings.selectedRolesByStore &&
    typeof settings.selectedRolesByStore === "object"
      ? settings.selectedRolesByStore
      : {};
  state.roleModesByStore =
    settings.roleModesByStore && typeof settings.roleModesByStore === "object"
      ? settings.roleModesByStore
      : {};

  dom.planningMode.value = state.planningMode;
  dom.targetValue.value = state.targetValue > 0 ? state.targetValue : "";
  renderRoleSelectors();
}

function readSavedCrew(storeKey) {
  if (!storeKey) return [];
  const crews = readStorage().crews || {};
  return Array.isArray(crews[storeKey]) ? crews[storeKey] : [];
}

function readStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch (_error) {
    return {};
  }
}

function buildDataFingerprintFromJsonText(text) {
  const input = String(text || "");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return `${input.length}:${unsigned.toString(16)}`;
}

function mapToEntries(map) {
  return map instanceof Map ? Array.from(map.entries()) : [];
}

function entriesToMap(entries) {
  return new Map(Array.isArray(entries) ? entries : []);
}

function buildAnalyticsSnapshot(fingerprint) {
  return {
    version: 1,
    fingerprint: String(fingerprint || ""),
    createdAt: new Date().toISOString(),
    modelTuning: state.modelTuning,
    baselineTuning: state.baselineTuning,
    modelTuningByAccount: mapToEntries(state.modelTuningByAccount),
    modelTuningByAccountType: mapToEntries(state.modelTuningByAccountType),
    modelTuningByAccountSegment: mapToEntries(state.modelTuningByAccountSegment),
    baselineTuningByAccount: mapToEntries(state.baselineTuningByAccount),
    baselineTuningByAccountType: mapToEntries(state.baselineTuningByAccountType),
    baselineTuningByAccountSegment: mapToEntries(state.baselineTuningByAccountSegment),
    residualByStore: mapToEntries(state.residualByStore),
    residualByAccountSegment: mapToEntries(state.residualByAccountSegment),
    residualByAccountType: mapToEntries(state.residualByAccountType),
    residualByAccountOffice: mapToEntries(state.residualByAccountOffice),
    residualByAccount: mapToEntries(state.residualByAccount),
    residualGlobal: state.residualGlobal,
    residualByStoreCrewBand: mapToEntries(state.residualByStoreCrewBand),
    residualByStoreSupervisor: mapToEntries(state.residualByStoreSupervisor),
    residualByAccountSupervisor: mapToEntries(state.residualByAccountSupervisor),
    residualByAccountSegmentCrewBand: mapToEntries(
      state.residualByAccountSegmentCrewBand,
    ),
    residualByAccountTypeCrewBand: mapToEntries(state.residualByAccountTypeCrewBand),
    residualByAccountCrewBand: mapToEntries(state.residualByAccountCrewBand),
    residualGlobalCrewBand: mapToEntries(state.residualGlobalCrewBand),
    manHourResidualByStore: mapToEntries(state.manHourResidualByStore),
    manHourResidualByAccountSegment: mapToEntries(state.manHourResidualByAccountSegment),
    manHourResidualByAccountType: mapToEntries(state.manHourResidualByAccountType),
    manHourResidualByAccountOffice: mapToEntries(state.manHourResidualByAccountOffice),
    manHourResidualByAccount: mapToEntries(state.manHourResidualByAccount),
    manHourResidualGlobal: state.manHourResidualGlobal,
    manHourResidualByStoreCrewBand: mapToEntries(state.manHourResidualByStoreCrewBand),
    manHourResidualByStoreSupervisor: mapToEntries(state.manHourResidualByStoreSupervisor),
    manHourResidualByAccountSupervisor: mapToEntries(
      state.manHourResidualByAccountSupervisor,
    ),
    manHourResidualByAccountSegmentCrewBand: mapToEntries(
      state.manHourResidualByAccountSegmentCrewBand,
    ),
    manHourResidualByAccountTypeCrewBand: mapToEntries(
      state.manHourResidualByAccountTypeCrewBand,
    ),
    manHourResidualByAccountCrewBand: mapToEntries(
      state.manHourResidualByAccountCrewBand,
    ),
    manHourResidualGlobalCrewBand: mapToEntries(state.manHourResidualGlobalCrewBand),
    lastDurationResidualByStore: mapToEntries(state.lastDurationResidualByStore),
    uncertaintyScale: state.uncertaintyScale,
    backtestMetrics: state.backtestMetrics,
    accuracyCache: state.accuracyCache,
  };
}

function applyAnalyticsSnapshot(snapshot) {
  state.modelTuning = snapshot.modelTuning || state.modelTuning;
  state.baselineTuning = snapshot.baselineTuning || state.baselineTuning;
  state.modelTuningByAccount = entriesToMap(snapshot.modelTuningByAccount);
  state.modelTuningByAccountType = entriesToMap(snapshot.modelTuningByAccountType);
  state.modelTuningByAccountSegment = entriesToMap(snapshot.modelTuningByAccountSegment);
  state.baselineTuningByAccount = entriesToMap(snapshot.baselineTuningByAccount);
  state.baselineTuningByAccountType = entriesToMap(snapshot.baselineTuningByAccountType);
  state.baselineTuningByAccountSegment = entriesToMap(
    snapshot.baselineTuningByAccountSegment,
  );
  state.residualByStore = entriesToMap(snapshot.residualByStore);
  state.residualByAccountSegment = entriesToMap(snapshot.residualByAccountSegment);
  state.residualByAccountType = entriesToMap(snapshot.residualByAccountType);
  state.residualByAccountOffice = entriesToMap(snapshot.residualByAccountOffice);
  state.residualByAccount = entriesToMap(snapshot.residualByAccount);
  state.residualGlobal = snapshot.residualGlobal || state.residualGlobal;
  state.residualByStoreCrewBand = entriesToMap(snapshot.residualByStoreCrewBand);
  state.residualByStoreSupervisor = entriesToMap(snapshot.residualByStoreSupervisor);
  state.residualByAccountSupervisor = entriesToMap(snapshot.residualByAccountSupervisor);
  state.residualByAccountSegmentCrewBand = entriesToMap(
    snapshot.residualByAccountSegmentCrewBand,
  );
  state.residualByAccountTypeCrewBand = entriesToMap(
    snapshot.residualByAccountTypeCrewBand,
  );
  state.residualByAccountCrewBand = entriesToMap(snapshot.residualByAccountCrewBand);
  state.residualGlobalCrewBand = entriesToMap(snapshot.residualGlobalCrewBand);
  state.manHourResidualByStore = entriesToMap(snapshot.manHourResidualByStore);
  state.manHourResidualByAccountSegment = entriesToMap(
    snapshot.manHourResidualByAccountSegment,
  );
  state.manHourResidualByAccountType = entriesToMap(snapshot.manHourResidualByAccountType);
  state.manHourResidualByAccountOffice = entriesToMap(
    snapshot.manHourResidualByAccountOffice,
  );
  state.manHourResidualByAccount = entriesToMap(snapshot.manHourResidualByAccount);
  state.manHourResidualGlobal =
    snapshot.manHourResidualGlobal || state.manHourResidualGlobal;
  state.manHourResidualByStoreCrewBand = entriesToMap(
    snapshot.manHourResidualByStoreCrewBand,
  );
  state.manHourResidualByStoreSupervisor = entriesToMap(
    snapshot.manHourResidualByStoreSupervisor,
  );
  state.manHourResidualByAccountSupervisor = entriesToMap(
    snapshot.manHourResidualByAccountSupervisor,
  );
  state.manHourResidualByAccountSegmentCrewBand = entriesToMap(
    snapshot.manHourResidualByAccountSegmentCrewBand,
  );
  state.manHourResidualByAccountTypeCrewBand = entriesToMap(
    snapshot.manHourResidualByAccountTypeCrewBand,
  );
  state.manHourResidualByAccountCrewBand = entriesToMap(
    snapshot.manHourResidualByAccountCrewBand,
  );
  state.manHourResidualGlobalCrewBand = entriesToMap(
    snapshot.manHourResidualGlobalCrewBand,
  );
  state.lastDurationResidualByStore = entriesToMap(snapshot.lastDurationResidualByStore);
  state.uncertaintyScale = safeNumber(snapshot.uncertaintyScale) || 1;
  state.backtestMetrics = snapshot.backtestMetrics || state.backtestMetrics;
  state.accuracyCache = snapshot.accuracyCache || null;
}

function persistAnalyticsCache(fingerprint) {
  if (!fingerprint) return;
  try {
    const snapshot = buildAnalyticsSnapshot(fingerprint);
    localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(snapshot));
  } catch (_error) {
    // Ignore quota/cache write errors; compute will still work without persistence.
  }
}

function restoreAnalyticsCache(fingerprint) {
  if (!fingerprint) return false;
  try {
    const raw = localStorage.getItem(ANALYTICS_CACHE_KEY);
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    if (!snapshot || snapshot.version !== 1) return false;
    if (String(snapshot.fingerprint || "") !== String(fingerprint)) return false;
    applyAnalyticsSnapshot(snapshot);
    return true;
  } catch (_error) {
    return false;
  }
}

function displayEmployeeSpeed(employee, account = getSelectedAccount()) {
  const fallback = safeNumber(state.global.medianEmployeeSpeed);
  if (!employee) return fallback;

  const accountStat = account ? employee.accountStats?.[account] : null;
  if (accountStat && accountStat.jobCount >= 1) {
    const blended = blendRecentAndLongSpeed(
      accountStat.avgPiecesPerHrRecent,
      accountStat.avgPiecesPerHr,
      accountStat.jobCount,
    );
    return shrinkTowardFallback(blended, fallback, accountStat.jobCount, 3);
  }

  if (employee.globalJobCount >= 1) {
    const blended = blendRecentAndLongSpeed(
      employee.avgPiecesPerHrRecentGlobal,
      employee.avgPiecesPerHrGlobal,
      employee.globalJobCount,
    );
    return shrinkTowardFallback(blended, fallback, employee.globalJobCount, 4);
  }

  return fallback;
}

function recencyDecayWeight(ageDays, halfLifeDays = 120) {
  const days = Math.max(0, safeNumber(ageDays));
  const halfLife = Math.max(1, safeNumber(halfLifeDays));
  return Math.pow(0.5, days / halfLife);
}

function blendRecentAndLongSpeed(recentSpeed, longRunSpeed, jobCount) {
  const recent = safeNumber(recentSpeed);
  const longRun = safeNumber(longRunSpeed);
  const n = Math.max(0, Math.round(safeNumber(jobCount)));

  if (!(recent > 0) && !(longRun > 0)) return 0;
  if (!(longRun > 0)) return recent;
  if (!(recent > 0)) return longRun;

  const recentWeight = Math.max(0.55, 0.9 - Math.min(n, 20) * 0.02);
  return recent * recentWeight + longRun * (1 - recentWeight);
}

function shrinkTowardFallback(value, fallback, jobCount, k = 3) {
  const v = safeNumber(value);
  const base = safeNumber(fallback);
  if (!(v > 0)) return base;
  const n = Math.max(0, safeNumber(jobCount));
  const weight = n / (n + Math.max(1, safeNumber(k)));
  return v * weight + base * (1 - weight);
}

function effectiveEmployeeSpeed(
  employee,
  storeKey = state.selectedStoreKey,
  account = getSelectedAccount(),
) {
  const baseSpeed = displayEmployeeSpeed(employee, account);
  if (!employee) return baseSpeed;
  const factor = getContributionFactorForEmployee(employee.employee, storeKey);
  return baseSpeed * factor;
}

function inferSpeed(row) {
  if (row.piecesPerHr > 0) return row.piecesPerHr;
  if (row.totalExtQty > 0 && row.manHours > 0)
    return row.totalExtQty / row.manHours;
  return 0;
}

function inferWeight(row) {
  if (row.manHours > 0) return row.manHours;
  if (row.totalExtQty > 0) return row.totalExtQty;
  return 1;
}

function getSelectedAccount() {
  const store = state.stores.get(state.selectedStoreKey);
  return store?.account || "";
}

function isSupervisorRole(roleText) {
  if (!roleText) return false;
  return /supervisor|lead|manager/.test(roleText);
}

function getMostFrequentName(nameCounts, fallback) {
  let best = fallback;
  let bestCount = -1;
  nameCounts.forEach((count, name) => {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  });
  return best || fallback;
}

function resolveMostFrequentKey(counts, fallback = "") {
  if (!(counts instanceof Map) || counts.size === 0) return fallback || "";
  let bestKey = fallback || "";
  let bestCount = -1;
  counts.forEach((count, key) => {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  });
  return bestKey || fallback || "";
}

function getEmployeeDisplayName(rawId) {
  const emp = state.employees.get(rawId);
  if (emp?.displayName) return emp.displayName;
  if (/^\d+$/.test(rawId)) return `Employee ${rawId}`;
  return rawId;
}

function formatDelta(delta) {
  if (!delta.available) return "No goal";
  const unit = delta.mode === "manhours" ? "man-hours" : "hrs";
  return `${formatSigned(delta.value, 2)} ${unit}`;
}

function classifyAccuracyTrend(delta, neutralBand = 0.2) {
  const value = safeNumber(delta);
  const band = Math.max(0, safeNumber(neutralBand));
  if (value > band) {
    return { key: "high", label: "Usually Predicting High" };
  }
  if (value < -band) {
    return { key: "low", label: "Usually Predicting Low" };
  }
  return { key: "balanced", label: "Usually On Target" };
}

function formatSigned(value, decimals) {
  const n = safeNumber(value);
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${formatNumber(Math.abs(n), decimals)}`;
}

function formatNumber(value, decimals = 2) {
  return safeNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function chooseRobustBaseline(stats) {
  if (!stats) return 0;
  if (stats.jobCount >= 6 && stats.medianPieces > 0) return stats.medianPieces;
  if (stats.jobCount >= 4 && stats.trimmedMeanPieces > 0)
    return stats.trimmedMeanPieces;
  if (stats.jobCount >= 3 && stats.recentWeightedPieces > 0)
    return stats.recentWeightedPieces;
  if (stats.medianPieces > 0) return stats.medianPieces;
  if (stats.trimmedMeanPieces > 0) return stats.trimmedMeanPieces;
  return stats.avgPieces > 0 ? stats.avgPieces : 0;
}

function getCrewEfficiencyFactor(crewSize, tuning = state.modelTuning) {
  if (crewSize <= 3) return tuning.effSmall;
  if (crewSize <= 6) return tuning.effMid;
  return tuning.effLarge;
}

function summarizeJobGroup(jobGroup) {
  const jobs = Array.isArray(jobGroup) ? jobGroup : [];
  const pieces = jobs.map((j) => safeNumber(j.totalPieces));
  const trimmedPieces = trimExtremes(pieces, 0.05);
  const durations = jobs.map((j) => safeNumber(j.duration));
  const manHours = jobs.map((j) => safeNumber(j.totalManHours));
  const trimmedDurations = trimExtremes(durations, 0.05);

  return {
    jobCount: jobs.length,
    avgPieces: mean(pieces),
    medianPieces: median(pieces),
    trimmedMeanPieces: mean(trimmedPieces.length >= 2 ? trimmedPieces : pieces),
    recentWeightedPieces: recentWeightedAverage(
      jobs.map((j) => ({ date: j.date, value: safeNumber(j.totalPieces) })),
      5,
    ),
    avgDuration: mean(durations),
    medianDuration: median(durations),
    avgManHours: mean(manHours),
    durationStdDev: stdDev(
      trimmedDurations.length >= 2 ? trimmedDurations : durations,
    ),
    robustDurationSpread: robustSpread(durations),
    overheadBaseP20: Math.max(0, percentile(durations, 20)),
  };
}

function recentWeightedAverage(items, maxItems = 5) {
  const sorted = [...(items || [])]
    .filter((x) => Number.isFinite(x?.value))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, maxItems);
  if (!sorted.length) return 0;

  const weights = sorted.map((_, idx) => maxItems - idx);
  let num = 0;
  let den = 0;
  sorted.forEach((item, idx) => {
    const w = weights[idx];
    num += safeNumber(item.value) * w;
    den += w;
  });
  return den > 0 ? num / den : 0;
}

function trimExtremes(values, pct = 0.05) {
  const clean = [...(values || [])]
    .map(safeNumber)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (clean.length < 4) return clean;
  const cut = Math.floor(clean.length * pct);
  if (cut <= 0) return clean;
  return clean.slice(cut, clean.length - cut);
}

function robustSpread(values) {
  const clean = [...(values || [])].map(safeNumber).filter(Number.isFinite);
  if (clean.length < 2) return 0;
  const med = median(clean);
  const absDev = clean.map((v) => Math.abs(v - med));
  const mad = median(absDev);
  const scaled = mad * 1.4826;
  if (scaled > 0) return scaled;
  return stdDev(clean);
}

function percentile(values, pct) {
  const clean = [...(values || [])]
    .map(safeNumber)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!clean.length) return 0;
  const p = Math.max(0, Math.min(100, pct));
  const rank = (p / 100) * (clean.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return clean[low];
  const t = rank - low;
  return clean[low] + (clean[high] - clean[low]) * t;
}

function mean(values) {
  const clean = (values || []).map(safeNumber).filter(Number.isFinite);
  if (clean.length === 0) return 0;
  return clean.reduce((sum, n) => sum + n, 0) / clean.length;
}

function median(values) {
  const clean = (values || [])
    .map(safeNumber)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (clean.length === 0) return 0;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0
    ? (clean[mid - 1] + clean[mid]) / 2
    : clean[mid];
}

function stdDev(values) {
  const clean = (values || []).map(safeNumber).filter(Number.isFinite);
  if (clean.length < 2) return 0;
  const avg = mean(clean);
  const variance =
    clean.reduce((sum, n) => sum + (n - avg) ** 2, 0) / (clean.length - 1);
  return Math.sqrt(variance);
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateString(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return String(value).trim();
}

function canonicalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function firstValue(obj, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  }
  return "";
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function isRxRoleRequiredForStore(store) {
  const name = cleanText(store?.storeName);
  return /\+\s*rx\b/i.test(name);
}

function normalizeInventoryType(value) {
  const raw = cleanText(value);
  if (!raw) return "Unknown";
  const upper = raw.toUpperCase();
  if (upper.includes("DC5-FINANCIAL")) return "DC5-FINANCIAL";
  if (upper.includes("SCAN-ITEM LEVEL")) return "SCAN-ITEM LEVEL";
  if (upper.includes("MODAS-SCAN")) return "MODAS-SCAN";
  return upper;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
