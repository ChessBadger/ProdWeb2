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
  storeLastCrew: new Map(),
  storeLastSupervisor: new Map(),
  runs: [],
  weeks: [],
  selectedWeekKey: "",
  activeRunId: "",
  focusedDate: "",
  detailCollapsed: false,
  showEmptyDays: false,
  assignments: {},
  searchQuery: "",
  employeeFilter: "",
  modelTuning: {
    overheadScale: 0.25,
    effSmall: 1.0,
    effMid: 0.92,
    effLarge: 0.85,
  },
  modelTuningByAccount: new Map(),
  modelTuningByAccountType: new Map(),
  modelTuningByAccountSegment: new Map(),
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
  uncertaintyScale: 1,
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
  analyticsReady: false,
  dataFingerprint: "",
  lastDurationResidualByStore: new Map(),
};

const STORAGE_KEY = "schedule_board_assignments_v1";
const ANALYTICS_CACHE_KEY = "crew_predictor_analytics_v1";
const HISTORY_JSON_PATH = "data/EmployeeProductionExport.json";
const SCHEDULE_JSON_PATH = "data/ScheduleFinalFull.json";
const ALLOWED_USERS = ["lclark@badgerinventory.com"];
const firebaseConfig = {
  apiKey: "AIzaSyCYuvMZVE9aTX_95nuZrUiv_pFHbZG_5pY",
  authDomain: "employee-dashboard-aab04.firebaseapp.com",
  projectId: "employee-dashboard-aab04",
  storageBucket: "employee-dashboard-aab04.appspot.com",
  messagingSenderId: "511125736771",
  appId: "1:511125736771:web:cdb9a3dcadcdd23240b3f6",
};

const dom = {
  appHeader: document.querySelector("header.topbar"),
  appPage: document.querySelector("main.page"),
  authStatus: document.getElementById("topbarAuthStatus"),
  signOutBtn: document.getElementById("topbarSignOutBtn"),
  weekSelect: document.getElementById("weekSelect"),
  storeSearch: document.getElementById("storeSearch"),
  showEmptyDays: document.getElementById("showEmptyDays"),
  boardSummary: document.getElementById("boardSummary"),
  boardMeta: document.getElementById("boardMeta"),
  boardTopScroll: document.getElementById("boardTopScroll"),
  boardTopScrollInner: document.getElementById("boardTopScrollInner"),
  boardGrid: document.getElementById("boardGrid"),
  toggleDetailBtn: document.getElementById("toggleDetailBtn"),
  detailShell: document.querySelector("aside.detail-shell"),
  collapseDetailBtn: document.getElementById("collapseDetailBtn"),
  clearRunBtn: document.getElementById("clearRunBtn"),
  runDetailMeta: document.getElementById("runDetailMeta"),
  runPrediction: document.getElementById("runPrediction"),
  predictedDurationValue: document.getElementById("predictedDurationValue"),
  predictedManHoursValue: document.getElementById("predictedManHoursValue"),
  predictedDeltaValue: document.getElementById("predictedDeltaValue"),
  supervisorSelect: document.getElementById("supervisorSelect"),
  supervisorMode: document.getElementById("supervisorMode"),
  employeeSearch: document.getElementById("employeeSearch"),
  employeeBulkStatus: document.getElementById("employeeBulkStatus"),
  assignedSummary: document.getElementById("assignedSummary"),
  rxRoleCard: document.getElementById("rxRoleCard"),
  rxEmployee: document.getElementById("rxEmployee"),
  rxMode: document.getElementById("rxMode"),
  trainingEmployee: document.getElementById("trainingEmployee"),
  trainingMode: document.getElementById("trainingMode"),
  earlyLateEmployee: document.getElementById("earlyLateEmployee"),
  earlyLateMode: document.getElementById("earlyLateMode"),
  employeeGroups: document.getElementById("employeeGroups"),
  loadingOverlay: document.getElementById("loadingOverlay"),
};

let auth = null;
let googleProvider = null;
let initialized = false;
let syncingTopScroll = false;
let syncingBoardScroll = false;

bootstrapAuth();

function bootstrapAuth() {
  if (typeof firebase === "undefined")
    return showAuthOverlay(
      "Authentication is unavailable right now. Please refresh.",
    );
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  googleProvider = new firebase.auth.GoogleAuthProvider();
  dom.signOutBtn?.addEventListener("click", () =>
    auth?.signOut().catch(() => {}),
  );
  auth.onAuthStateChanged((user) => {
    if (user?.email && ALLOWED_USERS.includes(user.email.toLowerCase())) {
      hideAuthOverlay();
      setAuthStatus(user.email);
      if (!initialized) {
        initialized = true;
        initialize();
      }
      return;
    }
    setAuthStatus(null);
    if (user) {
      showAuthOverlay("Unauthorized access. Please contact an administrator.");
      auth.signOut().catch(() => {});
      return;
    }
    showAuthOverlay();
  });
}

function initialize() {
  bindEvents();
  restoreAssignments();
  renderBoardLayoutState();
  loadData();
}

function bindEvents() {
  dom.boardTopScroll?.addEventListener("scroll", () => {
    const target = getHorizontalScrollTarget();
    if (!target || syncingBoardScroll) return;
    syncingTopScroll = true;
    target.scrollLeft = dom.boardTopScroll.scrollLeft;
    requestAnimationFrame(() => {
      syncingTopScroll = false;
    });
  });
  window.addEventListener("resize", () => syncTopScrollbar());
  dom.showEmptyDays?.addEventListener("change", () => {
    state.showEmptyDays = Boolean(dom.showEmptyDays.checked);
    renderBoard();
  });
  dom.weekSelect?.addEventListener("change", () => {
    state.selectedWeekKey = clean(dom.weekSelect.value);
    const week = state.weeks.find((item) => item.key === state.selectedWeekKey);
    if (!week?.dates.includes(state.focusedDate)) state.focusedDate = "";
    if (!getVisibleRuns().some((run) => run.id === state.activeRunId)) {
      state.activeRunId = getVisibleRuns()[0]?.id || "";
      setEmployeeBulkStatus("");
    }
    renderBoard();
    renderDetailPanel();
  });
  dom.storeSearch?.addEventListener("input", () => {
    state.searchQuery = clean(dom.storeSearch.value).toLowerCase();
    if (!getVisibleRuns().some((run) => run.id === state.activeRunId)) {
      state.activeRunId = getVisibleRuns()[0]?.id || "";
      setEmployeeBulkStatus("");
    }
    renderBoard();
    renderDetailPanel();
  });
  dom.employeeSearch?.addEventListener("input", () => {
    state.employeeFilter = clean(dom.employeeSearch.value).toLowerCase();
    setEmployeeBulkStatus("");
    renderEmployeeGroups();
  });
  dom.employeeSearch?.addEventListener("keydown", onEmployeeSearchKeyDown);
  dom.employeeSearch?.addEventListener("paste", onEmployeeSearchPaste);
  dom.supervisorSelect?.addEventListener("change", () => {
    const run = getActiveRun();
    if (!run) return;
    setSupervisorForRun(run.id, clean(dom.supervisorSelect.value));
    syncRoleAssignmentsToCrew(run.id);
    persistAssignments();
    renderBoard();
    renderDetailPanel();
  });
  dom.supervisorMode?.addEventListener("change", onRoleConfigChange);
  dom.rxEmployee?.addEventListener("change", onRoleConfigChange);
  dom.rxMode?.addEventListener("change", onRoleConfigChange);
  dom.trainingEmployee?.addEventListener("change", onRoleConfigChange);
  dom.trainingMode?.addEventListener("change", onRoleConfigChange);
  dom.earlyLateEmployee?.addEventListener("change", onRoleConfigChange);
  dom.earlyLateMode?.addEventListener("change", onRoleConfigChange);
  dom.toggleDetailBtn?.addEventListener("click", () => toggleDetailPanel());
  dom.collapseDetailBtn?.addEventListener("click", () => toggleDetailPanel());
  dom.clearRunBtn?.addEventListener("click", () => {
    const run = getActiveRun();
    if (!run) return;
    state.assignments[run.id] = createEmptyAssignment();
    setEmployeeBulkStatus("");
    persistAssignments();
    renderBoard();
    renderDetailPanel();
  });
}

async function loadData() {
  try {
    const [historyResult, scheduleResult] = await Promise.all([
      fetchJsonResult(HISTORY_JSON_PATH),
      fetchJsonResult(SCHEDULE_JSON_PATH),
    ]);
    buildHistory(extractRows(historyResult.payload), historyResult.rawJsonText);
    buildRuns(extractRows(scheduleResult.payload));
    buildWeeks();
    state.selectedWeekKey = pickDefaultWeekKey();
    state.activeRunId = getVisibleRuns()[0]?.id || "";
    renderWeekOptions();
    renderBoard();
    renderDetailPanel();
  } catch (error) {
    setBoardMeta(
      `Data load failed: ${error?.message || "Unknown error"}`,
      true,
    );
  } finally {
    hideLoadingOverlay();
  }
}

async function fetchJsonResult(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rawJsonText = await response.text();
  return { rawJsonText, payload: JSON.parse(rawJsonText) };
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  const first = Object.values(payload || {}).find((value) =>
    Array.isArray(value),
  );
  return first || [];
}

function buildHistory(rows, rawJsonText = "") {
  const normalizedRows = rows
    .map(normalizeHistoryRow)
    .filter((row) => row.valid);
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
  state.global = buildGlobalStats(state.jobs, state.employees);
  state.storeLastCrew = buildStoreLastCrew(state.jobs);
  state.storeLastSupervisor = buildStoreLastSupervisor(normalizedRows);
  state.dataFingerprint = buildDataFingerprintFromJsonText(rawJsonText);
  restoreAnalyticsCache(state.dataFingerprint);
  state.analyticsReady = true;
}

function normalizeHistoryRow(row) {
  const normalized = {};
  Object.keys(row || {}).forEach((key) => {
    normalized[canonicalizeKey(key)] = row[key];
  });
  const date = normalizeDateString(firstValue(normalized, ["dateofinv"]));
  const store = clean(firstValue(normalized, ["storename"]));
  const account =
    clean(firstValue(normalized, ["account", "accountname"])) ||
    "Unknown Account";
  const employee = clean(firstValue(normalized, ["employee"]));
  const firstName = clean(firstValue(normalized, ["firstname"]));
  const lastName = clean(firstValue(normalized, ["lastname"]));
  const employeeName = `${firstName} ${lastName}`.trim() || employee;
  const type = normalizeInventoryType(
    clean(firstValue(normalized, ["typeofinv"])) || "Unknown",
  );
  const officeName = clean(firstValue(normalized, ["officename"])) || "Unknown";
  const role = clean(
    firstValue(normalized, ["role", "employeerole", "position", "jobtitle"]),
  ).toLowerCase();
  const supervisorNumber = clean(firstValue(normalized, ["supervisornumber"]));
  const manHours = num(firstValue(normalized, ["manhrs", "manhr", "expr1"]));
  const totalExtQty = num(firstValue(normalized, ["totalextqty"]));
  const piecesPerHr = num(firstValue(normalized, ["piecesperhr"]));
  const storeKey = `${account}||${store}`;
  const jobKey = `${date}||${account}||${store}`;
  return {
    valid: Boolean(date && store && employee),
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
        supervisorNumber: clean(row.supervisorNumber),
        supervisorCounts: new Map(),
        employees: new Set(),
        totalPieces: 0,
        totalManHours: 0,
        duration: 0,
      });
    }
    const job = jobs.get(row.jobKey);
    const supervisorId = clean(row.supervisorNumber);
    if (supervisorId) {
      job.supervisorCounts.set(
        supervisorId,
        (job.supervisorCounts.get(supervisorId) || 0) + 1,
      );
      if (!job.supervisorNumber) job.supervisorNumber = supervisorId;
    }
    if (row.officeName && row.officeName !== "Unknown")
      job.officeName = row.officeName;
    job.employees.add(row.employee);
    job.totalPieces += safeNumber(row.totalExtQty);
    job.totalManHours += safeNumber(row.manHours);
    job.duration = Math.max(job.duration, safeNumber(row.manHours));
  });
  return Array.from(jobs.values()).map((job) => ({
    ...job,
    crewSize: job.employees.size,
    employees: Array.from(job.employees),
    supervisorNumber: resolveMostFrequentKey(
      job.supervisorCounts,
      job.supervisorNumber,
    ),
    supervisorCounts: undefined,
  }));
}

function buildStoreStats(jobs) {
  const grouped = new Map();
  jobs.forEach((job) => {
    if (!grouped.has(job.storeKey))
      grouped.set(job.storeKey, {
        storeKey: job.storeKey,
        account: job.account,
        storeName: job.storeName,
        jobs: [],
        typeCounts: new Map(),
      });
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
    byAccount
      .get(store.account)
      .push({ storeKey, sizeSignal: getStoreSizeSignal(store) });
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
  return buildScopedJobStats(
    jobs,
    (job) => state.storeSegmentByStoreKey.get(job.storeKey)?.segmentKey || "",
  );
}
function buildAccountTypeStats(jobs) {
  return buildScopedJobStats(
    jobs,
    (job) => `${job.account}||${job.typeOfInv || "Unknown"}`,
  );
}
function buildAccountOfficeStats(jobs) {
  return buildScopedJobStats(
    jobs,
    (job) => `${job.account}||${job.officeName || "Unknown"}`,
  );
}
function buildAccountGlobalStats(jobs) {
  return buildScopedJobStats(jobs, (job) => job.account || "");
}

function buildScopedJobStats(jobs, keyFn) {
  const grouped = new Map();
  jobs.forEach((job) => {
    const key = keyFn(job);
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(job);
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

function buildEmployeeStats(rows) {
  const grouped = new Map();
  const maxRowTimestamp = (rows || [])
    .map((row) => Date.parse(row.date || ""))
    .filter((ts) => Number.isFinite(ts))
    .reduce((max, ts) => Math.max(max, ts), 0);
  const referenceTimestamp = maxRowTimestamp > 0 ? maxRowTimestamp : Date.now();
  rows.forEach((row) => {
    const isSupervisorRunRow =
      clean(row.employee).toLowerCase() !== "" &&
      clean(row.supervisorNumber).toLowerCase() !== "" &&
      clean(row.employee).toLowerCase() ===
        clean(row.supervisorNumber).toLowerCase();
    if (isSupervisorRunRow) return;
    if (!grouped.has(row.employee))
      grouped.set(row.employee, {
        employee: row.employee,
        weightedSpeedSumGlobal: 0,
        weightSumGlobal: 0,
        recentWeightedSpeedSumGlobal: 0,
        recentWeightSumGlobal: 0,
        jobKeysGlobal: new Set(),
        accountBuckets: new Map(),
        nameCounts: new Map(),
        officeCounts: new Map(),
      });
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
    if (!bucket.accountBuckets.has(row.account))
      bucket.accountBuckets.set(row.account, {
        weightedSpeedSum: 0,
        weightSum: 0,
        recentWeightedSpeedSum: 0,
        recentWeightSum: 0,
        jobKeys: new Set(),
      });
    const accountBucket = bucket.accountBuckets.get(row.account);
    if (speed > 0 && weight > 0) {
      accountBucket.weightedSpeedSum += speed * weight;
      accountBucket.weightSum += weight;
      accountBucket.recentWeightedSpeedSum += speed * recencyWeight;
      accountBucket.recentWeightSum += recencyWeight;
    }
    accountBucket.jobKeys.add(row.jobKey);
    if (row.employeeName)
      bucket.nameCounts.set(
        row.employeeName,
        (bucket.nameCounts.get(row.employeeName) || 0) + 1,
      );
    if (row.officeName)
      bucket.officeCounts.set(
        row.officeName,
        (bucket.officeCounts.get(row.officeName) || 0) + 1,
      );
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
            ? accountBucket.recentWeightedSpeedSum /
              accountBucket.recentWeightSum
            : 0,
        jobCount: accountBucket.jobKeys.size,
      };
    });
    stats.set(employee, {
      employee,
      displayName,
      officeName: mostFrequent(bucket.officeCounts) || "Unknown",
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

function buildGlobalStats(jobs, employees) {
  const summary = summarizeJobGroup(jobs);
  const speeds = Array.from(employees.values())
    .map((employee) => employee.avgPiecesPerHrGlobal)
    .filter((value) => value > 0);
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
    if (!map.has(job.storeKey)) map.set(job.storeKey, job.employees);
  });
  return map;
}

function buildStoreLastSupervisor(rows) {
  const latestByStore = new Map();
  (rows || []).forEach((row) => {
    const storeKey = row.storeKey;
    const supervisor = clean(row.supervisorNumber);
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
    if (currentDate === prev.date)
      prev.counts.set(supervisor, (prev.counts.get(supervisor) || 0) + 1);
  });
  const result = new Map();
  latestByStore.forEach((entry, storeKey) => {
    const best = resolveMostFrequentKey(entry.counts, "");
    if (best) result.set(storeKey, best);
  });
  return result;
}

function buildRuns(rows) {
  const storeIndex = new Map();
  state.stores.forEach((store, key) => {
    const name = canon(store.storeName);
    if (!storeIndex.has(name)) storeIndex.set(name, []);
    storeIndex.get(name).push(key);
  });

  const preparedStops = rows
    .map((row, sourceIndex) => {
      const storeName = clean(row.StoreName);
      const date = stamp(row.ScheduleDateOfInv);
      if (!storeName || !date) return null;
      const matchedKeys = storeIndex.get(canon(storeName)) || [];
      const storeKey =
        matchedKeys
          .map((key) => state.stores.get(key))
          .sort((a, b) => (b?.jobCount || 0) - (a?.jobCount || 0))[0]
          ?.storeKey || "";
      const store = state.stores.get(storeKey);
      const runName = clean(row.RunName);
      const hints = parseHints(runName);
      return {
        id: [
          date,
          canon(storeName),
          clean(row.CustomerNumber1),
          sourceIndex,
        ].join("||"),
        date,
        runName,
        runOrderNumber: runOrderValue(row.RunOrderNumber),
        sourceIndex,
        storeName,
        account: store?.account || "Unmatched Store",
        storeKey,
        historyMatched: Boolean(store),
        historyInventoryCount: Math.max(0, safeNumber(store?.jobCount)),
        matchCount: store ? 1 : 0,
        stopCount: 1,
        isGrouped: false,
        meetTime: sched(row.MeetTime),
        startTime: sched(row.Expr1 || row.TimeOfInv),
        typeOfInv: clean(row.TypeOfInv),
        address: clean(row.StoreAddress),
        mapLink: clean(row.MapLink),
        phone: clean(row.StorePhoneNumber),
        notes: sched(row.Notes),
        storeNotes: sched(row.StoreNotes),
        customerNumber: clean(row.CustomerNumber1),
        officeLabel: scheduleOffice(row),
        plannedDurationHours: hints.hours,
        plannedCrewSize: hints.crew,
      };
    })
    .filter(Boolean);

  const groupedRunKeys = new Set();
  preparedStops.forEach((stop) => {
    if (stop.runName && num(stop.runOrderNumber) > 0) {
      groupedRunKeys.add(`${stop.date}||${stop.runName}`);
    }
  });

  const grouped = new Map();
  preparedStops.forEach((stop) => {
    const groupKey = groupedRunKeys.has(`${stop.date}||${stop.runName}`)
      ? `${stop.date}||${stop.runName}`
      : stop.id;
    if (!grouped.has(groupKey)) grouped.set(groupKey, []);
    grouped.get(groupKey).push(stop);
  });

  state.runs = Array.from(grouped.values())
    .map((stops) => {
      const orderedStops = [...stops].sort((a, b) => {
        const byOrder =
          runOrderSortValue(a.runOrderNumber) -
          runOrderSortValue(b.runOrderNumber);
        if (byOrder !== 0) return byOrder;
        const byTime = timeMinutes(a.startTime) - timeMinutes(b.startTime);
        if (byTime !== 0) return byTime;
        return (
          a.sourceIndex - b.sourceIndex ||
          a.storeName.localeCompare(b.storeName)
        );
      });
      const primary = orderedStops[0];
      const uniqueAccounts = Array.from(
        new Set(orderedStops.map((stop) => stop.account).filter(Boolean)),
      );
      const uniqueOffices = Array.from(
        new Set(orderedStops.map((stop) => stop.officeLabel).filter(Boolean)),
      );
      const uniqueTypes = Array.from(
        new Set(orderedStops.map((stop) => stop.typeOfInv).filter(Boolean)),
      );
      const matchCount = orderedStops.filter(
        (stop) => stop.historyMatched,
      ).length;
      const historyInventoryCount = orderedStops.reduce(
        (sum, stop) =>
          sum + Math.max(0, safeNumber(stop.historyInventoryCount)),
        0,
      );
      return {
        id:
          orderedStops.length > 1
            ? `group||${primary.date}||${canon(primary.runName)}`
            : primary.id,
        date: primary.date,
        runName: primary.runName,
        runOrderNumber: primary.runOrderNumber,
        sourceIndex: primary.sourceIndex,
        storeName: primary.storeName,
        account:
          uniqueAccounts.length === 1
            ? uniqueAccounts[0]
            : `${uniqueAccounts.length} accounts`,
        primaryAccount:
          uniqueAccounts.find(
            (account) => account && account !== "Unmatched Store",
          ) ||
          uniqueAccounts[0] ||
          "",
        storeKey: primary.storeKey,
        historyMatched: matchCount === orderedStops.length,
        historyInventoryCount,
        matchCount,
        stopCount: orderedStops.length,
        isGrouped: orderedStops.length > 1,
        stops: orderedStops,
        meetTime: firstScheduledValue(
          orderedStops.map((stop) => stop.meetTime),
        ),
        startTime: firstScheduledValue(
          orderedStops
            .map((stop) => stop.startTime)
            .sort((left, right) => timeMinutes(left) - timeMinutes(right)),
        ),
        typeOfInv:
          uniqueTypes.length === 1
            ? uniqueTypes[0]
            : uniqueTypes.length
              ? "Mixed"
              : "",
        address: primary.address,
        mapLink: primary.mapLink,
        phone: primary.phone,
        notes: primary.notes,
        storeNotes: primary.storeNotes,
        customerNumber: primary.customerNumber,
        officeLabel:
          uniqueOffices.length === 1
            ? uniqueOffices[0]
            : uniqueOffices.length
              ? "Multiple"
              : "Unknown",
        plannedDurationHours: primary.plannedDurationHours,
        plannedCrewSize: primary.plannedCrewSize,
        sortOrder: runOrderSortValue(primary.runOrderNumber),
      };
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        timeMinutes(a.startTime) - timeMinutes(b.startTime) ||
        a.sortOrder - b.sortOrder ||
        a.sourceIndex - b.sourceIndex ||
        displayRunTitle(a).localeCompare(displayRunTitle(b)),
    );
}

function buildWeeks() {
  const map = new Map();
  state.runs.forEach((run) => {
    const key = weekStart(run.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(run);
  });
  state.weeks = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, runs]) => ({
      key,
      label: `${fmtLong(key)} - ${fmtLong(addDays(key, 6))}`,
      dates: Array.from({ length: 7 }, (_, i) => addDays(key, i)),
      runs,
    }));
}

function pickDefaultWeekKey() {
  const today = localStamp();
  return (
    state.weeks.find((week) => week.dates.includes(today))?.key ||
    state.weeks[0]?.key ||
    ""
  );
}

function renderWeekOptions() {
  dom.weekSelect.innerHTML = "";
  state.weeks.forEach((week) => {
    const option = document.createElement("option");
    option.value = week.key;
    option.textContent = week.label;
    option.selected = week.key === state.selectedWeekKey;
    dom.weekSelect.appendChild(option);
  });
}

function getVisibleRuns() {
  const week = state.weeks.find((item) => item.key === state.selectedWeekKey);
  const runs = week?.runs || [];
  if (!state.searchQuery) return runs;
  return runs.filter((run) => {
    const haystack = [
      run.account,
      run.runName,
      run.storeName,
      run.customerNumber,
      run.notes,
      run.storeNotes,
      run.address,
      ...run.stops.map(
        (stop) =>
          `${stop.storeName} ${stop.account} ${stop.customerNumber} ${stop.notes} ${stop.storeNotes} ${stop.address}`,
      ),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(state.searchQuery);
  });
}

function toggleDetailPanel(forceValue = null) {
  state.detailCollapsed =
    typeof forceValue === "boolean" ? forceValue : !state.detailCollapsed;
  renderBoardLayoutState();
}

function renderBoardLayoutState() {
  dom.appPage?.classList.toggle("is-detail-collapsed", state.detailCollapsed);
  dom.detailShell?.classList.toggle("is-collapsed", state.detailCollapsed);
  if (dom.toggleDetailBtn)
    dom.toggleDetailBtn.textContent = state.detailCollapsed
      ? "Show Details"
      : "Hide Details";
  if (dom.collapseDetailBtn)
    dom.collapseDetailBtn.textContent = state.detailCollapsed
      ? "Show Panel"
      : "Hide Panel";
  if (dom.showEmptyDays) dom.showEmptyDays.checked = state.showEmptyDays;
  requestAnimationFrame(() => syncTopScrollbar());
}

function getHorizontalScrollTarget() {
  return state.focusedDate
    ? dom.boardGrid?.querySelector(".run-list")
    : dom.boardGrid;
}

function syncTopScrollbar() {
  const target = getHorizontalScrollTarget();
  if (!dom.boardTopScroll || !dom.boardTopScrollInner || !target) return;
  dom.boardTopScrollInner.style.width = `${target.scrollWidth}px`;
  const hasOverflow = target.scrollWidth > target.clientWidth + 1;
  dom.boardTopScroll.classList.toggle("is-hidden", !hasOverflow);
  if (!syncingTopScroll) {
    syncingBoardScroll = true;
    dom.boardTopScroll.scrollLeft = target.scrollLeft;
    requestAnimationFrame(() => {
      syncingBoardScroll = false;
    });
  }
  target.onscroll = () => {
    if (syncingTopScroll) return;
    syncingBoardScroll = true;
    dom.boardTopScroll.scrollLeft = target.scrollLeft;
    requestAnimationFrame(() => {
      syncingBoardScroll = false;
    });
  };
}

function renderBoard() {
  const week = state.weeks.find((item) => item.key === state.selectedWeekKey);
  if (!week) {
    dom.boardGrid.innerHTML =
      '<div class="empty-state">No scheduled runs available.</div>';
    dom.boardTopScroll?.classList.add("is-hidden");
    return;
  }
  if (state.focusedDate && !week.dates.includes(state.focusedDate))
    state.focusedDate = "";
  const visible = getVisibleRuns();
  const stopCount = visible.reduce((sum, run) => sum + run.stopCount, 0);
  const datesToRender = state.focusedDate
    ? [state.focusedDate]
    : week.dates.filter((date) => {
        if (state.showEmptyDays) return true;
        return visible.some((run) => run.date === date);
      });
  dom.boardGrid.classList.toggle("is-focus-day", Boolean(state.focusedDate));
  dom.boardSummary.textContent = `${visible.length} card(s) | ${stopCount} store stop(s)${state.focusedDate ? ` | Focused ${weekday(state.focusedDate)}` : ""}`;
  setBoardMeta(
    state.focusedDate
      ? `${fmtLong(state.focusedDate)} focused. Click the day header again to return to the full week.${state.detailCollapsed ? " Details panel hidden." : ""}`
      : `${state.showEmptyDays ? "Showing all week days." : "Empty days hidden by default."} Click a day header or empty space in a column to focus that day.${state.detailCollapsed ? " Details panel hidden." : ""}`,
  );
  if (!datesToRender.length) {
    dom.boardGrid.innerHTML =
      '<div class="empty-state">No run days match the current filters.</div>';
    dom.boardTopScroll?.classList.add("is-hidden");
    return;
  }
  dom.boardGrid.innerHTML = datesToRender
    .map((date) => {
      const runs = visible.filter((run) => run.date === date);
      const dayStopCount = runs.reduce((sum, run) => sum + run.stopCount, 0);
      return `<section class="day-column ${state.focusedDate === date ? "is-focused" : ""}" data-day-date="${escapeHtml(date)}"><button type="button" class="day-header" data-focus-date="${escapeHtml(date)}"><div class="day-header-copy"><h3>${escapeHtml(weekday(date))}</h3><p>${escapeHtml(fmtLong(date))} | ${runs.length} card(s) | ${dayStopCount} stop(s)</p></div><span class="day-header-action">${state.focusedDate === date ? "Show Full Week" : "Focus Day"}</span></button><div class="run-list">${runs.length ? runs.map(renderRunCard).join("") : '<div class="empty-state">No runs scheduled.</div>'}</div></section>`;
    })
    .join("");
  dom.boardGrid.querySelectorAll("[data-focus-date]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const date = clean(button.dataset.focusDate);
      state.focusedDate = state.focusedDate === date ? "" : date;
      renderBoard();
    });
  });
  dom.boardGrid
    .querySelectorAll(".day-column[data-day-date]")
    .forEach((column) => {
      column.addEventListener("click", (event) => {
        if (
          event.target.closest("[data-run-id]") ||
          event.target.closest("[data-focus-date]")
        )
          return;
        const date = clean(column.dataset.dayDate);
        state.focusedDate = state.focusedDate === date ? "" : date;
        renderBoard();
      });
    });
  dom.boardGrid.querySelectorAll("[data-run-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      state.activeRunId = card.dataset.runId;
      state.employeeFilter = "";
      dom.employeeSearch.value = "";
      setEmployeeBulkStatus("");
      renderBoard();
      renderDetailPanel();
    });
  });
  dom.boardGrid.querySelectorAll("[data-run-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });
  requestAnimationFrame(() => syncTopScrollbar());
}

function renderRunCard(run) {
  const assignment = getAssignment(run.id);
  const prediction = predictRun(run);
  const crewIds = assignedIds(run.id);
  const alertState = getRunAlertState(run, prediction);
  const plannerHref = buildPlannerHref(run, assignment);
  return `<article class="run-card ${run.id === state.activeRunId ? "is-active" : ""} ${run.historyMatched ? "" : "is-unmatched"} ${alertState ? `is-${alertState}` : ""}" data-run-id="${escapeHtml(run.id)}">
    <div class="run-card-top"><div><h4 class="run-store">${escapeHtml(displayRunTitle(run))}</h4><p class="run-account">${escapeHtml(run.isGrouped ? `${run.stopCount} stores` : run.account)}</p></div><div class="run-time">${escapeHtml(run.startTime || "Start TBD")}</div></div>
    <div class="run-grid">
      ${item("Type", run.typeOfInv || "Unknown")}
      ${item("Match", historyMatchedLabel(run))}
      ${item("Planned", run.plannedDurationHours > 0 ? `${fmt(run.plannedDurationHours, 2)} hr goal` : "No goal in run name")}
    </div>
    ${renderRunStops(run)}
    <div class="run-stats">
      <div class="mini-stat"><div class="mini-stat-label">Crew</div><div class="mini-stat-value">${crewIds.length}${run.plannedCrewSize > 0 ? ` / ${run.plannedCrewSize}` : ""}</div></div>
      <div class="mini-stat ${alertState ? `is-${alertState}` : ""}"><div class="mini-stat-label">Predicted</div><div class="mini-stat-value">${prediction ? `${fmt(prediction.onSiteDuration, 2)} hr` : "-"}</div></div>
      <div class="mini-stat"><div class="mini-stat-label">Delta</div><div class="mini-stat-value">${prediction?.deltaAvailable ? signed(prediction.deltaHours, 2) : "-"}</div></div>
    </div>
    <div class="run-card-actions">${plannerHref ? `<a class="btn subtle run-details-btn" href="${escapeHtml(plannerHref)}" data-run-link="true">Full Details</a>` : '<span class="run-details-disabled">Planner details unavailable</span>'}</div>
    ${renderCardCrew(run, assignment)}
  </article>`;
}

function item(label, value, html = false) {
  return `<div class="run-item"><div class="run-item-label">${escapeHtml(label)}</div><div class="run-item-value">${html ? value : escapeHtml(String(value || "Not listed"))}</div></div>`;
}

function renderRunStops(run) {
  return `<div class="run-stops">${run.stops
    .map((stop, index) => {
      const startLabel = stop.startTime || "Start TBD";
      const address = stop.mapLink
        ? `<a class="run-link" href="${escapeHtml(stop.mapLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(stop.address || "Open map")}</a>`
        : escapeHtml(stop.address || "Not listed");
      return `<article class="run-stop">
      <div class="run-stop-head">
        <div class="run-stop-order">${run.isGrouped ? `Stop ${index + 1}` : "Store"}</div>
        <div class="run-stop-time">${escapeHtml(startLabel)}</div>
      </div>
      <div class="run-stop-store">${escapeHtml(stop.storeName)}</div>
      <div class="run-stop-meta">${escapeHtml(`${stop.account} | ${customer(stop.customerNumber)} | ${stop.typeOfInv || "Unknown"}`)}</div>
      <div class="run-stop-address">${address}</div>
      ${stop.notes || stop.storeNotes ? `<div class="run-stop-notes">${stop.notes ? `<div><strong>Notes:</strong> ${escapeHtml(stop.notes)}</div>` : ""}${stop.storeNotes ? `<div><strong>Store Notes:</strong> ${escapeHtml(stop.storeNotes)}</div>` : ""}</div>` : ""}
    </article>`;
    })
    .join("")}</div>`;
}

function renderDetailPanel() {
  const run = getActiveRun();
  if (!run) {
    dom.runDetailMeta.textContent = "Select a run card to assign a crew.";
    dom.runPrediction.classList.add("is-hidden");
    dom.supervisorSelect.innerHTML =
      '<option value="">Select supervisor</option>';
    if (dom.supervisorMode) dom.supervisorMode.value = "p50";
    dom.assignedSummary.textContent = "No crew assigned yet.";
    renderRoleSelectors(null);
    dom.employeeGroups.innerHTML = "";
    setEmployeeBulkStatus("");
    return;
  }
  const assignment = getAssignment(run.id);
  const prediction = predictRun(run);
  dom.runDetailMeta.textContent = `${fmtLong(run.date)} | ${displayRunTitle(run)} | ${run.stopCount} store${run.stopCount === 1 ? "" : "s"} | ${historyMatchedLabel(run)}`;
  renderRoleSelectors(run);
  dom.runPrediction.classList.toggle("is-hidden", !prediction);
  dom.predictedDurationValue.textContent = prediction
    ? `${fmt(prediction.onSiteDuration, 2)} hrs`
    : "-";
  dom.predictedManHoursValue.textContent = prediction
    ? `${fmt(prediction.manHours, 2)} man-hours`
    : "-";
  dom.predictedDeltaValue.textContent = prediction?.deltaAvailable
    ? `${signed(prediction.deltaHours, 2)} hrs`
    : "No goal";
  dom.assignedSummary.textContent = buildAssignmentSummary(
    run,
    assignment,
    prediction,
  );
  renderEmployeeGroups();
}

function renderEmployeeGroups() {
  const run = getActiveRun();
  if (!run) return;
  const assignment = getAssignment(run.id);
  const groups = groupByOffice(filteredEmployees());
  dom.employeeGroups.innerHTML = groups.length
    ? groups
        .map(
          ([office, employees]) =>
            `<section class="employee-group"><div class="employee-group-head">${escapeHtml(office)} (${employees.length})</div><div class="employee-list">${employees.map((employee) => row(employee, assignment)).join("")}</div></section>`,
        )
        .join("")
    : '<div class="empty-state">No employees match this filter.</div>';
  dom.employeeGroups
    .querySelectorAll("[data-employee-id]")
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const a = getAssignment(run.id);
        const ids = new Set(a.employeeIds);
        if (checkbox.checked) ids.add(checkbox.dataset.employeeId);
        else ids.delete(checkbox.dataset.employeeId);
        a.employeeIds = Array.from(ids).sort((aId, bId) =>
          nameOf(aId).localeCompare(nameOf(bId)),
        );
        syncRoleAssignmentsToCrew(run.id);
        persistAssignments();
        renderBoard();
        renderDetailPanel();
      });
    });
}

function onEmployeeSearchKeyDown(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const run = getActiveRun();
  if (!run) return;
  const rawText = clean(dom.employeeSearch?.value);
  if (!rawText) return;
  const bulk = resolveBulkEmployeeSelection(
    rawText,
    Array.from(state.employees.keys()),
  );
  if (bulk.entries.length > 1) {
    applyBulkEmployeeSelection(run, bulk);
    return;
  }
  const firstMatch = filteredEmployees()[0];
  if (!firstMatch) return;
  addEmployeeToRun(run.id, firstMatch.employee);
  dom.employeeSearch.value = "";
  state.employeeFilter = "";
  setEmployeeBulkStatus("");
  renderBoard();
  renderDetailPanel();
}

function onEmployeeSearchPaste(event) {
  const run = getActiveRun();
  if (!run) return;
  const rawText = event?.clipboardData?.getData("text") || "";
  const bulk = resolveBulkEmployeeSelection(
    rawText,
    Array.from(state.employees.keys()),
  );
  if (bulk.entries.length <= 1) return;
  event.preventDefault();
  applyBulkEmployeeSelection(run, bulk);
}

function applyBulkEmployeeSelection(run, bulk) {
  bulk.matchedIds.forEach((id) => addEmployeeToRun(run.id, id));
  const assignedSupervisor = assignFirstBulkSupervisorForRun(
    run.id,
    bulk.matchedIds,
  );
  applyBulkRoleHintsToRun(run.id, bulk);
  persistAssignments();
  dom.employeeSearch.value = "";
  state.employeeFilter = "";
  renderBoard();
  renderDetailPanel();
  setEmployeeBulkStatus(
    `${formatBulkSelectionMessage(bulk, "names")}${assignedSupervisor ? " First pasted name set as supervisor." : ""}`,
    bulk.ambiguousEntries.length || bulk.unmatchedEntries.length
      ? "warning"
      : "success",
  );
}

function addEmployeeToRun(runId, employeeId) {
  const assignment = getAssignment(runId);
  if (!employeeId || assignment.supervisorId === employeeId) return;
  if (!assignment.employeeIds.includes(employeeId)) {
    assignment.employeeIds = [...assignment.employeeIds, employeeId].sort(
      (aId, bId) => nameOf(aId).localeCompare(nameOf(bId)),
    );
    syncRoleAssignmentsToCrew(runId);
    persistAssignments();
  }
}

function createEmptyAssignment() {
  return {
    supervisorId: "",
    employeeIds: [],
    rxIds: [],
    trainingIds: [],
    earlyLateIds: [],
    roleModes: {
      supervisor: "p50",
      rx: "p50",
      training: "p70",
      earlyLate: "p50",
    },
  };
}

function normalizeAssignmentShape(assignment) {
  const current = assignment || {};
  return {
    supervisorId: clean(current.supervisorId),
    employeeIds: uniqueStrings(current.employeeIds || []),
    rxIds: normalizeRoleArray(current.rxIds),
    trainingIds: normalizeRoleArray(current.trainingIds),
    earlyLateIds: normalizeRoleArray(current.earlyLateIds),
    roleModes: {
      supervisor: parseContributionMode(current.roleModes?.supervisor || "p50"),
      rx: parseContributionMode(current.roleModes?.rx || "p50"),
      training: parseContributionMode(current.roleModes?.training || "p70"),
      earlyLate: parseContributionMode(current.roleModes?.earlyLate || "p50"),
    },
  };
}

function setSupervisorForRun(runId, employeeId) {
  const assignment = getAssignment(runId);
  assignment.supervisorId = clean(employeeId);
  assignment.employeeIds = assignment.employeeIds.filter(
    (id) => id !== assignment.supervisorId,
  );
  syncRoleAssignmentsToCrew(runId);
}

function assignFirstBulkSupervisorForRun(runId, employeeIds) {
  const firstId = clean((employeeIds || []).find(Boolean));
  if (!firstId) return false;
  setSupervisorForRun(runId, firstId);
  return true;
}

function applyBulkRoleHintsToRun(runId, bulk) {
  const assignment = getAssignment(runId);
  const assignedSet = new Set(assignedIds(runId));
  assignment.rxIds = filterToAssigned(
    [...assignment.rxIds, ...(bulk?.rxIds || [])],
    assignedSet,
  );
  assignment.earlyLateIds = filterToAssigned(
    [...assignment.earlyLateIds, ...(bulk?.earlyLateIds || [])],
    assignedSet,
  );
}

function onRoleConfigChange() {
  const run = getActiveRun();
  if (!run) return;
  const assignment = getAssignment(run.id);
  assignment.rxIds = getRoleChecklistValues(dom.rxEmployee);
  assignment.trainingIds = getRoleChecklistValues(dom.trainingEmployee);
  assignment.earlyLateIds = getRoleChecklistValues(dom.earlyLateEmployee);
  assignment.roleModes = {
    supervisor: parseContributionMode(dom.supervisorMode?.value || "p50"),
    rx: parseContributionMode(dom.rxMode?.value || "p50"),
    training: parseContributionMode(dom.trainingMode?.value || "p70"),
    earlyLate: parseContributionMode(dom.earlyLateMode?.value || "p50"),
  };
  syncRoleAssignmentsToCrew(run.id);
  persistAssignments();
  renderBoard();
  renderDetailPanel();
}

function renderRoleSelectors(run) {
  const assignment = run ? getAssignment(run.id) : createEmptyAssignment();
  const selectedIds = run ? assignedIds(run.id) : [];
  const sortedSelected = selectedIds
    .map((id) => ({ id, name: nameOf(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const showRxRole = runNeedsRxRole(run);

  if (!showRxRole && assignment.rxIds.length) {
    assignment.rxIds = [];
  }

  dom.supervisorSelect.innerHTML =
    '<option value="">Select supervisor</option>' +
    sortedSelected
      .map(
        (employee) =>
          `<option value="${escapeHtml(employee.id)}" ${employee.id === assignment.supervisorId ? "selected" : ""}>${escapeHtml(employee.name)}</option>`,
      )
      .join("");

  if (dom.supervisorMode)
    dom.supervisorMode.value = assignment.roleModes.supervisor;
  dom.rxRoleCard?.classList.toggle("is-hidden", !showRxRole);
  renderRoleChecklist(
    dom.rxEmployee,
    sortedSelected,
    assignment.rxIds,
    "No RX role",
  );
  renderRoleChecklist(
    dom.trainingEmployee,
    sortedSelected,
    assignment.trainingIds,
    "No training role",
  );
  renderRoleChecklist(
    dom.earlyLateEmployee,
    sortedSelected,
    assignment.earlyLateIds,
    "No early/late role",
  );
  if (dom.rxMode) dom.rxMode.value = assignment.roleModes.rx;
  if (dom.trainingMode) dom.trainingMode.value = assignment.roleModes.training;
  if (dom.earlyLateMode)
    dom.earlyLateMode.value = assignment.roleModes.earlyLate;
}

function renderRoleChecklist(containerEl, options, selectedValues, emptyLabel) {
  if (!containerEl) return;
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
    containerEl?.querySelectorAll('input[type="checkbox"]:checked') || [],
  )
    .map((el) => el.value)
    .filter(Boolean);
}

function normalizeRoleArray(value) {
  if (Array.isArray(value)) return uniqueStrings(value);
  if (typeof value === "string" && value) return [value];
  return [];
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function filterToAssigned(values, assignedSet) {
  return uniqueStrings(values).filter((id) => assignedSet.has(id));
}

function syncRoleAssignmentsToCrew(runId) {
  const assignment = getAssignment(runId);
  const assignedSet = new Set(assignedIds(runId));
  const run = state.runs.find((entry) => entry.id === runId);
  if (!assignedSet.has(assignment.supervisorId)) assignment.supervisorId = "";
  assignment.rxIds = runNeedsRxRole(run)
    ? filterToAssigned(assignment.rxIds, assignedSet)
    : [];
  assignment.trainingIds = filterToAssigned(
    assignment.trainingIds,
    assignedSet,
  );
  assignment.earlyLateIds = filterToAssigned(
    assignment.earlyLateIds,
    assignedSet,
  );
}

function getContributionFactorForAssignedEmployee(employeeId, assignment) {
  let factor = 1;
  if (assignment.supervisorId === employeeId)
    factor = Math.min(
      factor,
      getContributionFactor(assignment.roleModes.supervisor),
    );
  if (assignment.rxIds.includes(employeeId))
    factor = Math.min(factor, getContributionFactor(assignment.roleModes.rx));
  if (assignment.trainingIds.includes(employeeId))
    factor = Math.min(
      factor,
      getContributionFactor(assignment.roleModes.training),
    );
  if (assignment.earlyLateIds.includes(employeeId))
    factor = Math.min(
      factor,
      getContributionFactor(assignment.roleModes.earlyLate),
    );
  return factor;
}

function row(employee, assignment) {
  const isSupervisor = assignment.supervisorId === employee.employee;
  const checked = assignment.employeeIds.includes(employee.employee);
  const run = getActiveRun();
  return `<div class="employee-row"><label><input type="checkbox" data-employee-id="${escapeHtml(employee.employee)}" ${checked ? "checked" : ""} ${isSupervisor ? "disabled" : ""} /><div><div class="employee-name">${escapeHtml(employee.displayName)}${isSupervisor ? " (Supervisor)" : ""}</div><div class="employee-meta">${escapeHtml(`${employee.officeName} | ${fmt(displaySpeed(employee, run?.account || ""), 1)} pieces/hr`)}</div></div></label></div>`;
}

function renderCardCrew(run, assignment) {
  const supervisor = assignment.supervisorId
    ? nameOf(assignment.supervisorId)
    : "Unassigned";
  const grouped = new Map();
  assignment.employeeIds.forEach((id) => {
    const employee = state.employees.get(id);
    const office = employee?.officeName || "Unknown";
    if (!grouped.has(office)) grouped.set(office, []);
    grouped.get(office).push(employee?.displayName || id);
  });
  const groups = Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([office, names]) =>
        `<div class="card-crew-group"><div class="card-crew-office">${escapeHtml(office)}</div><div class="card-crew-names">${escapeHtml(names.sort((a, b) => a.localeCompare(b)).join(", "))}</div></div>`,
    )
    .join("");
  return `<div class="card-crew">
    <div class="card-crew-supervisor"><span>Supervisor</span><strong>${escapeHtml(supervisor)}</strong></div>
    ${groups || `<div class="card-crew-empty">${run.plannedCrewSize > 1 ? "Add employees to build out the rest of the crew." : "No additional crew assigned yet."}</div>`}
  </div>`;
}

function predictRun(run) {
  const ids = assignedIds(run.id);
  if (!ids.length) return null;
  const assignment = getAssignment(run.id);
  const effectiveRxIds = runNeedsRxRole(run) ? assignment.rxIds : [];
  const roles = {
    supervisor: assignment.supervisorId,
    rx: effectiveRxIds,
    training: assignment.trainingIds,
    earlyLate: assignment.earlyLateIds,
  };
  const modes = assignment.roleModes;
  const stopPredictions = run.stops
    .map((stop) =>
      predictForAssignedCrewExact(stop.storeKey, ids, roles, modes),
    )
    .filter(Boolean);
  if (stopPredictions.length !== run.stops.length) return null;
  const onSiteDuration = stopPredictions.reduce(
    (sum, prediction) => sum + prediction.onSiteDuration,
    0,
  );
  const manHours = stopPredictions.reduce(
    (sum, prediction) => sum + prediction.manHours,
    0,
  );
  return {
    onSiteDuration,
    manHours,
    deltaAvailable: run.plannedDurationHours > 0,
    deltaHours:
      run.plannedDurationHours > 0
        ? onSiteDuration - run.plannedDurationHours
        : 0,
  };
}

function buildAssignmentSummary(run, assignment, prediction) {
  const ids = assignedIds(run.id);
  const officeSummary = Array.from(
    ids
      .reduce((map, id) => {
        const office = state.employees.get(id)?.officeName || "Unknown";
        map.set(office, (map.get(office) || 0) + 1);
        return map;
      }, new Map())
      .entries(),
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([office, count]) => `${office} ${count}`)
    .join(", ");
  const effectiveRxIds = runNeedsRxRole(run) ? assignment.rxIds : [];
  const roleSummary = [
    effectiveRxIds.length ? `RX ${effectiveRxIds.length}` : "",
    assignment.trainingIds.length
      ? `Training ${assignment.trainingIds.length}`
      : "",
    assignment.earlyLateIds.length
      ? `Early/Late ${assignment.earlyLateIds.length}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");
  return [
    `Supervisor: ${assignment.supervisorId ? nameOf(assignment.supervisorId) : "Not assigned"}.`,
    `${run.stopCount} store${run.stopCount === 1 ? "" : "s"} on this card.`,
    `Assigned crew: ${ids.length}${run.plannedCrewSize > 0 ? ` of planned ${run.plannedCrewSize}` : ""}.`,
    officeSummary ? `Offices: ${officeSummary}.` : "",
    roleSummary ? `Roles: ${roleSummary}.` : "",
    prediction
      ? `Prediction ready.`
      : "Assign a crew to generate a prediction.",
  ]
    .filter(Boolean)
    .join(" ");
}

function getActiveRun() {
  return state.runs.find((run) => run.id === state.activeRunId) || null;
}

function getAssignment(runId) {
  if (!state.assignments[runId])
    state.assignments[runId] = createEmptyAssignment();
  state.assignments[runId] = normalizeAssignmentShape(state.assignments[runId]);
  return state.assignments[runId];
}

function assignedIds(runId) {
  const a = getAssignment(runId);
  return Array.from(
    new Set([a.supervisorId, ...a.employeeIds].filter(Boolean)),
  );
}

function restoreAssignments() {
  try {
    state.assignments =
      JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch (_error) {
    state.assignments = {};
  }
}

function persistAssignments() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.assignments));
}

function sortedEmployees() {
  return Array.from(state.employees.values()).sort(
    (a, b) =>
      a.officeName.localeCompare(b.officeName) ||
      a.displayName.localeCompare(b.displayName),
  );
}

function filteredEmployees() {
  return !state.employeeFilter
    ? sortedEmployees()
    : sortedEmployees().filter((employee) =>
        matchesEmployeeQuery(
          employee.employee,
          state.employeeFilter,
          `${employee.displayName} ${employee.officeName}`,
        ),
      );
}

function displayRunTitle(run) {
  if (!run?.isGrouped) return run?.storeName || "Store";
  const label = clean(run.runName).replace(/^\d+/, "").trim();
  if (
    !label ||
    /^length of store\b/i.test(label) ||
    /^crew size of\b/i.test(label)
  ) {
    return `${run.stopCount} Store Run`;
  }
  return label;
}

function encodeBoardPrefill(value) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
  } catch (_error) {
    return "";
  }
}

function buildPlannerHref(run, assignment) {
  const primaryStop = run?.stops?.[0];
  const storeKey = clean(primaryStop?.storeKey || run?.storeKey);
  if (!storeKey) return "";
  const payload = {
    storeKey,
    account: clean(primaryStop?.account || run?.primaryAccount || run?.account),
    storeName: clean(primaryStop?.storeName || run?.storeName),
    plannedDurationHours: safeNumber(run?.plannedDurationHours),
    employeeIds: assignedIds(run?.id || ""),
    supervisorId: clean(assignment?.supervisorId),
    roleIds: {
      rx: normalizeRoleArray(assignment?.rxIds),
      training: normalizeRoleArray(assignment?.trainingIds),
      earlyLate: normalizeRoleArray(assignment?.earlyLateIds),
    },
    roleModes: {
      supervisor: parseContributionMode(
        assignment?.roleModes?.supervisor || "p50",
      ),
      rx: parseContributionMode(assignment?.roleModes?.rx || "p50"),
      training: parseContributionMode(assignment?.roleModes?.training || "p70"),
      earlyLate: parseContributionMode(
        assignment?.roleModes?.earlyLate || "p50",
      ),
    },
    sourceRun: {
      title: displayRunTitle(run),
      date: clean(run?.date),
      stopCount: Math.max(1, Math.round(safeNumber(run?.stopCount) || 1)),
    },
  };
  const encoded = encodeBoardPrefill(payload);
  return encoded
    ? `scheduleplanning.html?boardPrefill=${encodeURIComponent(encoded)}`
    : "";
}

function historyMatchedLabel(run) {
  const count = Math.max(0, Math.round(safeNumber(run?.historyInventoryCount)));
  return `${count}/${count} history matched`;
}

function getRunAlertState(run, prediction) {
  if (!prediction) return "";
  const predictedHours = safeNumber(prediction.onSiteDuration);
  if (!(predictedHours > 0)) return "";
  const plannedHours = safeNumber(run?.plannedDurationHours);
  if (plannedHours > 0) {
    const overBy = predictedHours - plannedHours;
    if (overBy > 2) return "danger";
    if (overBy > 1) return "warning";
    return "";
  }
  if (predictedHours >= 8) return "danger";
  if (predictedHours >= 7) return "warning";
  return "";
}

function parseContributionMode(value) {
  if (
    value === "full" ||
    value === "none" ||
    value === "p70" ||
    value === "p50" ||
    value === "p30"
  )
    return value;
  return "p50";
}

function getContributionFactor(mode) {
  if (mode === "none") return 0;
  if (mode === "full") return 1;
  if (mode === "p30") return 0.3;
  if (mode === "p50") return 0.5;
  return 0.7;
}

function groupByOffice(employees) {
  const grouped = new Map();
  employees.forEach((employee) => {
    const office = employee.officeName || "Unknown";
    if (!grouped.has(office)) grouped.set(office, []);
    grouped.get(office).push(employee);
  });
  return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function displaySpeed(employee, account = "") {
  return displayEmployeeSpeed(employee, account);
}

function displayEmployeeSpeed(employee, account = "") {
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

function predictForAssignedCrewExact(
  storeKey,
  crewIds,
  rolesConfig,
  modesConfig,
) {
  const store = state.stores.get(storeKey);
  const roles = {
    supervisor: clean(rolesConfig?.supervisor),
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
  if (!store || !roles.supervisor || !crew.includes(roles.supervisor))
    return null;
  if (
    isRxRoleRequiredForStore(store) &&
    !roles.rx.some((id) => crew.includes(id))
  )
    return null;
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
    .filter((value) => value > 0);
  const crewSpeedRaw = crewSpeeds.reduce((sum, value) => sum + value, 0);
  const crewSize = crewSpeeds.length;
  if (!(baseline.value > 0) || !(crewSpeedRaw > 0) || crewSize <= 0)
    return null;
  const crewEfficiency = getCrewEfficiencyFactor(crewSize, tuning);
  const rawOnSiteDuration =
    overhead.value + baseline.value / (crewSpeedRaw * crewEfficiency);
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
  return { onSiteDuration, manHours: onSiteDuration * crewSize, crewSize };
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
  if (roles.supervisor === employeeId)
    factor = Math.min(factor, getContributionFactor(modes.supervisor));
  if ((roles.rx || []).includes(employeeId))
    factor = Math.min(factor, getContributionFactor(modes.rx));
  if ((roles.training || []).includes(employeeId))
    factor = Math.min(factor, getContributionFactor(modes.training));
  if ((roles.earlyLate || []).includes(employeeId))
    factor = Math.min(factor, getContributionFactor(modes.earlyLate));
  return baseSpeed * factor;
}

function getTuningForStore(store) {
  if (!store)
    return {
      tuning: state.modelTuning,
      scope: "global",
      label: "Global tuned parameters",
    };
  const segmentKey =
    state.storeSegmentByStoreKey.get(store.storeKey)?.segmentKey ||
    `${store.account}||S1`;
  if (state.modelTuningByAccountSegment.has(segmentKey))
    return {
      tuning: state.modelTuningByAccountSegment.get(segmentKey),
      scope: "account_segment",
      label: segmentKey,
    };
  const typeKey = `${store.account}||${store.primaryType || "Unknown"}`;
  if (state.modelTuningByAccountType.has(typeKey))
    return {
      tuning: state.modelTuningByAccountType.get(typeKey),
      scope: "account_type",
      label: typeKey,
    };
  if (state.modelTuningByAccount.has(store.account))
    return {
      tuning: state.modelTuningByAccount.get(store.account),
      scope: "account",
      label: store.account,
    };
  return {
    tuning: state.modelTuning,
    scope: "global",
    label: "Global tuned parameters",
  };
}

function getBaselineTuningForStore(store) {
  if (!store)
    return {
      tuning: state.baselineTuning,
      scope: "global",
      label: "Global baseline tuning",
    };
  const segmentKey =
    state.storeSegmentByStoreKey.get(store.storeKey)?.segmentKey ||
    `${store.account}||S1`;
  if (state.baselineTuningByAccountSegment.has(segmentKey))
    return {
      tuning: state.baselineTuningByAccountSegment.get(segmentKey),
      scope: "account_segment",
      label: segmentKey,
    };
  const typeKey = `${store.account}||${store.primaryType || "Unknown"}`;
  if (state.baselineTuningByAccountType.has(typeKey))
    return {
      tuning: state.baselineTuningByAccountType.get(typeKey),
      scope: "account_type",
      label: typeKey,
    };
  if (state.baselineTuningByAccount.has(store.account))
    return {
      tuning: state.baselineTuningByAccount.get(store.account),
      scope: "account",
      label: store.account,
    };
  return {
    tuning: state.baselineTuning,
    scope: "global",
    label: "Global baseline tuning",
  };
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
    const storeWeight =
      n > 0 ? Math.max(rawStoreWeight, minStoreWeight) : rawStoreWeight;
    return {
      value: storeWeight * storeCandidate + (1 - storeWeight) * context.value,
      source: `store ${storeMode} + ${context.source}`,
      modeLabel: `store=${storeMode}, context=${contextMode}`,
      blendLabel: `store weight ${fmt(storeWeight, 2)} (raw ${fmt(rawStoreWeight, 2)})`,
    };
  }
  if (storeCandidate > 0)
    return {
      value: storeCandidate,
      source: `store ${storeMode}`,
      modeLabel: `store=${storeMode}, context=${contextMode}`,
      blendLabel: "store-only",
    };
  return {
    value: context.value,
    source: context.source,
    modeLabel: `store=${storeMode}, context=${contextMode}`,
    blendLabel: "context-only",
  };
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
      key: "account office",
      value: pickBaselineCandidate(officeStats, contextMode),
      weight: safeNumber(baselineTuning?.officeWeight),
    },
    {
      key: "account",
      value: pickBaselineCandidate(accountStats, contextMode),
      weight: safeNumber(baselineTuning?.accountWeight),
    },
    {
      key: "global",
      value: pickBaselineCandidate(globalStats, contextMode),
      weight: safeNumber(baselineTuning?.globalWeight),
    },
  ].filter((candidate) => candidate.value > 0 && candidate.weight > 0);
  if (!candidates.length)
    return {
      value: pickBaselineCandidate(globalStats, contextMode),
      source: "global",
    };
  const sumW = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  const value =
    candidates.reduce(
      (sum, candidate) => sum + candidate.value * candidate.weight,
      0,
    ) / sumW;
  return {
    value,
    source: candidates.map((candidate) => candidate.key).join(" + "),
  };
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
  const supervisorKey = clean(config.supervisorId || "").toLowerCase();
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
  const kOf = (key, fallback) =>
    Number.isFinite(profileKs[key])
      ? profileKs[key]
      : Number.isFinite(ks[key])
        ? ks[key]
        : fallback;
  const minOf = (key, fallback) =>
    Number.isFinite(profileMins[key]) ? profileMins[key] : fallback;
  const floorOf = (key, fallback = 0) =>
    Number.isFinite(profile?.floors?.[key]) ? profile.floors[key] : fallback;
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
  biasHours = blendFromScope(
    scoped.globalBand,
    biasHours,
    kOf("globalBand", 18),
  );
  biasHours = blendFromScope(
    scoped.accountBand,
    biasHours,
    kOf("accountBand", 14),
  );
  biasHours = blendFromScope(
    scoped.segmentBand,
    biasHours,
    kOf("segmentBand", 12),
  );
  biasHours = blendFromScope(scoped.typeBand, biasHours, kOf("typeBand", 12));
  biasHours = blendFromScope(scoped.storeBand, biasHours, kOf("storeBand", 8));
  const storeCount = Math.max(0, safeNumber(scoped.store?.count));
  const storeMean = safeNumber(scoped.store?.mean);
  const anchorShare = Math.max(
    0,
    Math.min(
      1,
      floorOf("anchorMinShare", profileDensity === "sparse" ? 0.55 : 0.4),
    ),
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
    const desired = Math.max(
      -anchorMaxAbs,
      Math.min(anchorMaxAbs, storeMean * anchorShare),
    );
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
    {
      scope: "store+crew-band",
      stats: scoped.storeBand,
      min: minOf("storeBand", 5),
    },
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
    {
      scope: "account+segment",
      stats: scoped.segment,
      min: minOf("segment", 16),
    },
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
  const rawWeight = scopeStats.count / (scopeStats.count + k);
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

function getLastCrewOverlapRate(storeKey, selectedCrew) {
  const lastCrew = state.storeLastCrew.get(storeKey) || [];
  if (!lastCrew.length || !(selectedCrew || []).length) return 0;
  const selectedSet = new Set((selectedCrew || []).filter(Boolean));
  const overlap = lastCrew.filter((id) => selectedSet.has(id)).length;
  return overlap / Math.max(1, selectedSet.size);
}

function getCrewEfficiencyFactor(crewSize, tuning = state.modelTuning) {
  if (crewSize <= 3) return tuning.effSmall;
  if (crewSize <= 6) return tuning.effMid;
  return tuning.effLarge;
}

function isRxRoleRequiredForStore(store) {
  return /\brx\b/i.test(clean(store?.storeName));
}

function runNeedsRxRole(run) {
  return Boolean(run?.stops?.some((stop) => isRxRoleRequiredForStore(stop)));
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

function recencyDecayWeight(ageDays, halfLifeDays = 120) {
  const days = Math.max(0, safeNumber(ageDays));
  const halfLife = Math.max(1, safeNumber(halfLifeDays));
  return Math.pow(0.5, days / halfLife);
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

function getStoreSizeSignal(store) {
  const robustBaseline = chooseRobustBaseline(store);
  if (robustBaseline > 0) return robustBaseline;
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

function summarizeJobGroup(jobGroup) {
  const jobs = Array.isArray(jobGroup) ? jobGroup : [];
  const pieces = jobs.map((job) => safeNumber(job.totalPieces));
  const trimmedPieces = trimExtremes(pieces, 0.05);
  const durations = jobs.map((job) => safeNumber(job.duration));
  const manHours = jobs.map((job) => safeNumber(job.totalManHours));
  const trimmedDurations = trimExtremes(durations, 0.05);
  return {
    jobCount: jobs.length,
    avgPieces: mean(pieces),
    medianPieces: median(pieces),
    trimmedMeanPieces: mean(trimmedPieces.length >= 2 ? trimmedPieces : pieces),
    recentWeightedPieces: recentWeightedAverage(
      jobs.map((job) => ({
        date: job.date,
        value: safeNumber(job.totalPieces),
      })),
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
    .filter((item) => Number.isFinite(item?.value))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, maxItems);
  if (!sorted.length) return 0;
  const weights = sorted.map((_, idx) => maxItems - idx);
  let numerator = 0;
  let denominator = 0;
  sorted.forEach((item, idx) => {
    const weight = weights[idx];
    numerator += safeNumber(item.value) * weight;
    denominator += weight;
  });
  return denominator > 0 ? numerator / denominator : 0;
}

function trimExtremes(values, pct = 0.05) {
  const cleanValues = [...(values || [])]
    .map(safeNumber)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (cleanValues.length < 4) return cleanValues;
  const cut = Math.floor(cleanValues.length * pct);
  if (cut <= 0) return cleanValues;
  return cleanValues.slice(cut, cleanValues.length - cut);
}

function robustSpread(values) {
  const cleanValues = [...(values || [])]
    .map(safeNumber)
    .filter(Number.isFinite);
  if (cleanValues.length < 2) return 0;
  const med = median(cleanValues);
  const absDev = cleanValues.map((value) => Math.abs(value - med));
  const mad = median(absDev);
  const scaled = mad * 1.4826;
  if (scaled > 0) return scaled;
  return stdDev(cleanValues);
}

function buildDataFingerprintFromJsonText(text) {
  const input = String(text || "");
  let hash = 2166136261;
  for (let idx = 0; idx < input.length; idx += 1) {
    hash ^= input.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  return `${input.length}:${(hash >>> 0).toString(16)}`;
}

function entriesToMap(entries) {
  return new Map(Array.isArray(entries) ? entries : []);
}

function applyAnalyticsSnapshot(snapshot) {
  state.modelTuning = snapshot.modelTuning || state.modelTuning;
  state.baselineTuning = snapshot.baselineTuning || state.baselineTuning;
  state.modelTuningByAccount = entriesToMap(snapshot.modelTuningByAccount);
  state.modelTuningByAccountType = entriesToMap(
    snapshot.modelTuningByAccountType,
  );
  state.modelTuningByAccountSegment = entriesToMap(
    snapshot.modelTuningByAccountSegment,
  );
  state.baselineTuningByAccount = entriesToMap(
    snapshot.baselineTuningByAccount,
  );
  state.baselineTuningByAccountType = entriesToMap(
    snapshot.baselineTuningByAccountType,
  );
  state.baselineTuningByAccountSegment = entriesToMap(
    snapshot.baselineTuningByAccountSegment,
  );
  state.residualByStore = entriesToMap(snapshot.residualByStore);
  state.residualByAccountSegment = entriesToMap(
    snapshot.residualByAccountSegment,
  );
  state.residualByAccountType = entriesToMap(snapshot.residualByAccountType);
  state.residualByAccountOffice = entriesToMap(
    snapshot.residualByAccountOffice,
  );
  state.residualByAccount = entriesToMap(snapshot.residualByAccount);
  state.residualGlobal = snapshot.residualGlobal || state.residualGlobal;
  state.residualByStoreCrewBand = entriesToMap(
    snapshot.residualByStoreCrewBand,
  );
  state.residualByStoreSupervisor = entriesToMap(
    snapshot.residualByStoreSupervisor,
  );
  state.residualByAccountSupervisor = entriesToMap(
    snapshot.residualByAccountSupervisor,
  );
  state.residualByAccountSegmentCrewBand = entriesToMap(
    snapshot.residualByAccountSegmentCrewBand,
  );
  state.residualByAccountTypeCrewBand = entriesToMap(
    snapshot.residualByAccountTypeCrewBand,
  );
  state.residualByAccountCrewBand = entriesToMap(
    snapshot.residualByAccountCrewBand,
  );
  state.residualGlobalCrewBand = entriesToMap(snapshot.residualGlobalCrewBand);
  state.lastDurationResidualByStore = entriesToMap(
    snapshot.lastDurationResidualByStore,
  );
  state.uncertaintyScale = safeNumber(snapshot.uncertaintyScale) || 1;
}

function restoreAnalyticsCache(fingerprint) {
  if (!fingerprint) return false;
  try {
    const raw = localStorage.getItem(ANALYTICS_CACHE_KEY);
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    if (!snapshot || snapshot.version !== 1) return false;
    if (String(snapshot.fingerprint || "") !== String(fingerprint))
      return false;
    applyAnalyticsSnapshot(snapshot);
    return true;
  } catch (_error) {
    return false;
  }
}

function mean(values) {
  const cleanVals = (values || []).map(num).filter(Number.isFinite);
  return cleanVals.length
    ? cleanVals.reduce((sum, value) => sum + value, 0) / cleanVals.length
    : 0;
}

function median(values) {
  const cleanVals = (values || [])
    .map(num)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!cleanVals.length) return 0;
  const mid = Math.floor(cleanVals.length / 2);
  return cleanVals.length % 2
    ? cleanVals[mid]
    : (cleanVals[mid - 1] + cleanVals[mid]) / 2;
}

function percentile(values, pct) {
  const cleanVals = (values || [])
    .map(num)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!cleanVals.length) return 0;
  const rank = (Math.max(0, Math.min(100, pct)) / 100) * (cleanVals.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return low === high
    ? cleanVals[low]
    : cleanVals[low] + (cleanVals[high] - cleanVals[low]) * (rank - low);
}

function stdDev(values) {
  const cleanVals = (values || []).map(safeNumber).filter(Number.isFinite);
  if (cleanVals.length < 2) return 0;
  const avg = mean(cleanVals);
  const variance =
    cleanVals.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (cleanVals.length - 1);
  return Math.sqrt(variance);
}

function trim(values) {
  const cleanVals = [...(values || [])]
    .map(num)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (cleanVals.length < 4) return cleanVals;
  const cut = Math.floor(cleanVals.length * 0.05);
  return cut > 0 ? cleanVals.slice(cut, cleanVals.length - cut) : cleanVals;
}

function num(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim(),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : num(value);
}

function stamp(value) {
  const text = clean(value);
  if (!text) return "";

  const isoLikeMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/,
  );
  if (isoLikeMatch) {
    return `${isoLikeMatch[1]}-${isoLikeMatch[2]}-${isoLikeMatch[3]}`;
  }

  const slashDateMatch = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+.*)?$/,
  );
  if (slashDateMatch) {
    const month = slashDateMatch[1].padStart(2, "0");
    const day = slashDateMatch[2].padStart(2, "0");
    return `${slashDateMatch[3]}-${month}-${day}`;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
}

function normalizeDateString(value) {
  return stamp(value);
}

function clean(value) {
  return String(value ?? "").trim();
}

function firstValue(obj, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj || {}, key)) return obj[key];
  }
  return "";
}

function sched(value) {
  const text = clean(value);
  return !text ||
    text === "0" ||
    /^#error$/i.test(text) ||
    /^false$/i.test(text)
    ? ""
    : text;
}

function canon(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function canonicalizeKey(key) {
  return canon(key);
}

function normalizeInventoryType(value) {
  const raw = clean(value);
  if (!raw) return "Unknown";
  const upper = raw.toUpperCase();
  if (upper.includes("DC5-FINANCIAL")) return "DC5-FINANCIAL";
  if (upper.includes("SCAN-ITEM LEVEL")) return "SCAN-ITEM LEVEL";
  if (upper.includes("MODAS-SCAN")) return "MODAS-SCAN";
  return upper;
}

function officeLabel(value) {
  const text = clean(value);
  return text ? `Office ${text}` : "";
}

function hasRunOrder(value) {
  const text = clean(value);
  if (!text) return false;
  return /^-?\d+(?:\.\d+)?$/.test(text);
}

function runOrderValue(value) {
  return hasRunOrder(value) ? num(value) : null;
}

function runOrderSortValue(value) {
  return value === null ? Number.POSITIVE_INFINITY : num(value);
}

function firstScheduledValue(values) {
  return (values || []).find((value) => sched(value)) || "";
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesEmployeeQuery(employeeId, query, displayName) {
  const normalizedQuery = clean(query).toLowerCase();
  if (!normalizedQuery) return true;
  const normalizedName = clean(displayName).toLowerCase();
  const normalizedId = clean(employeeId).toLowerCase();
  if (normalizedId.includes(normalizedQuery)) return true;
  const boundaryMatcher = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(normalizedQuery)}`,
  );
  return boundaryMatcher.test(normalizedName);
}

function splitBulkEmployeeEntries(rawText) {
  return String(rawText || "")
    .split(/[\r\n,;]+/)
    .map((part) => clean(part))
    .filter(Boolean);
}

function parseClipboardTable(rawText) {
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
    .map((cells) => cells.map((value) => clean(value)))
    .filter((cells) => cells.some(Boolean));
}

function extractBulkEmployeeEntries(rawText) {
  const rows = parseClipboardTable(rawText);
  const hasMultipleColumns = rows.some((cells) => cells.length > 1);
  if (hasMultipleColumns) {
    return rows
      .map((cells) => ({
        name: clean(cells[0]),
        note: clean(cells.slice(1).join(" ")),
      }))
      .filter((entry) => entry.name);
  }
  return splitBulkEmployeeEntries(rawText).map((entry) => ({
    name: entry,
    note: "",
  }));
}

function parseBulkEmployeeNoteFlags(noteText) {
  const note = clean(noteText).toLowerCase();
  return {
    rx: /\brx\b/.test(note),
    earlyLate: /\b(until|after)\b/.test(note),
  };
}

function getEmployeeNameParts(employeeId) {
  const displayName = clean(nameOf(employeeId));
  const parts = displayName.split(/\s+/).filter(Boolean);
  const first = (parts[0] || "").toLowerCase();
  const last = (parts[parts.length - 1] || "").toLowerCase();
  return { first, last };
}

function summarizeBulkEntryList(items, limit = 4) {
  const entries = Array.from(items || []).filter(Boolean);
  if (!entries.length) return "";
  if (entries.length <= limit) return entries.join(", ");
  return `${entries.slice(0, limit).join(", ")} +${entries.length - limit} more`;
}

function resolveBulkEmployeeSelection(rawText, candidateIds) {
  const structuredEntries = extractBulkEmployeeEntries(rawText);
  const entries = structuredEntries.map((entry) => entry.name);
  const pool = Array.from(candidateIds || [])
    .map((id) => clean(id))
    .filter(Boolean);
  const matchedIds = new Set();
  const rxIds = new Set();
  const earlyLateIds = new Set();
  const ambiguousEntries = [];
  const unmatchedEntries = [];

  structuredEntries.forEach((entryObj) => {
    const entry = entryObj.name;
    const normalizedEntry = clean(entry);
    const normalizedLower = normalizedEntry.toLowerCase();
    if (!normalizedLower) return;
    const noteFlags = parseBulkEmployeeNoteFlags(entryObj.note);
    const markMatched = (employeeId) => {
      matchedIds.add(employeeId);
      if (noteFlags.rx) rxIds.add(employeeId);
      if (noteFlags.earlyLate) earlyLateIds.add(employeeId);
    };

    const exactIdMatch = pool.find(
      (id) => id.toLowerCase() === normalizedLower,
    );
    if (exactIdMatch) {
      markMatched(exactIdMatch);
      return;
    }

    const queryMatches = pool.filter((id) =>
      matchesEmployeeQuery(id, normalizedLower, nameOf(id)),
    );
    if (queryMatches.length === 1) {
      markMatched(queryMatches[0]);
      return;
    }

    const tokens = normalizedLower.split(/\s+/).filter(Boolean);
    const firstNameToken = tokens[0] || "";
    const lastToken = (tokens[1] || "").replace(/[^a-z]/g, "");
    if (!firstNameToken) return;

    const firstNameCandidates = pool.filter(
      (id) => getEmployeeNameParts(id).first === firstNameToken,
    );
    if (!firstNameCandidates.length) {
      unmatchedEntries.push(entry);
      return;
    }

    if (firstNameCandidates.length === 1) {
      const single = firstNameCandidates[0];
      if (lastToken) {
        const parts = getEmployeeNameParts(single);
        if (!parts.last.startsWith(lastToken)) {
          unmatchedEntries.push(entry);
          return;
        }
      }
      markMatched(single);
      return;
    }

    if (!lastToken) {
      ambiguousEntries.push(entry);
      return;
    }

    const narrowed = firstNameCandidates.filter((id) =>
      getEmployeeNameParts(id).last.startsWith(lastToken),
    );
    if (narrowed.length === 1) {
      markMatched(narrowed[0]);
      return;
    }

    if (!narrowed.length) unmatchedEntries.push(entry);
    else ambiguousEntries.push(entry);
  });

  return {
    entries,
    matchedIds: Array.from(matchedIds),
    rxIds: Array.from(rxIds),
    earlyLateIds: Array.from(earlyLateIds),
    ambiguousEntries,
    unmatchedEntries,
  };
}

function formatBulkSelectionMessage(result, label = "employees") {
  const total = result.entries.length;
  const added = result.matchedIds.length;
  const fragments = [`Processed ${total} ${label}; added ${added}.`];
  const roleHints = [];
  if (result.rxIds?.length) roleHints.push(`RX ${result.rxIds.length}`);
  if (result.earlyLateIds?.length)
    roleHints.push(`Early/Late ${result.earlyLateIds.length}`);
  if (roleHints.length) fragments.push(`Auto roles: ${roleHints.join(", ")}.`);
  if (result.ambiguousEntries.length) {
    fragments.push(
      `Ambiguous: ${summarizeBulkEntryList(result.ambiguousEntries)} (add last initial).`,
    );
  }
  if (result.unmatchedEntries.length) {
    fragments.push(
      `No match: ${summarizeBulkEntryList(result.unmatchedEntries)}.`,
    );
  }
  return fragments.join(" ");
}

function scheduleOffice(row) {
  const officeFlags = [
    ["Fox Valley", row.FoxValley],
    ["Madison", row.Madison],
    ["Milwaukee", row.Milwaukee],
    ["Rockford", row.Rockford],
    ["Stevens Point", row.StevensPoint],
  ];
  const matched = officeFlags.find(
    ([, enabled]) =>
      enabled === true || String(enabled).toLowerCase() === "true",
  );
  return matched?.[0] || officeLabel(row.OfficeNumber) || "Unknown";
}

function parseHints(text) {
  const run = clean(text);
  const hours = num((run.match(/(\d+(?:\.\d+)?)\s*hrs?/i) || [])[1]);
  const crew = Math.round(num((run.match(/crew size of\s*(\d+)/i) || [])[1]));
  return { hours, crew };
}

function weekStart(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function localStamp() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function fmt(value, decimals = 2) {
  return num(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function signed(value, decimals = 2) {
  const number = num(value);
  return `${number >= 0 ? "+" : "-"}${fmt(Math.abs(number), decimals)}`;
}

function fmtLong(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function weekday(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString(undefined, { weekday: "long" });
}

function timeMinutes(text) {
  const match = sched(text).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return Number.POSITIVE_INFINITY;
  let hours = Number(match[1]) % 12;
  if (String(match[3]).toLowerCase() === "pm") hours += 12;
  return hours * 60 + Number(match[2] || 0);
}

function customer(value) {
  const raw = clean(value).replace(/[^A-Za-z0-9]/g, "");
  if (!raw) return "Not listed";
  const padded = raw.length >= 8 ? raw : raw.padStart(8, "0");
  return `${padded.slice(0, 4)}-${padded.slice(-4)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mostFrequent(map) {
  let best = "";
  let count = -1;
  map.forEach((value, key) => {
    if (value > count) {
      best = key;
      count = value;
    }
  });
  return best;
}

function nameOf(id) {
  return state.employees.get(id)?.displayName || id;
}

function setBoardMeta(message, warning = false) {
  dom.boardMeta.textContent = message || "";
  dom.boardMeta.style.color = warning ? "#8f1116" : "";
}

function setEmployeeBulkStatus(message, tone = "") {
  if (!dom.employeeBulkStatus) return;
  dom.employeeBulkStatus.classList.remove(
    "meta-warning",
    "meta-success",
    "is-hidden",
  );
  if (!message) {
    dom.employeeBulkStatus.textContent = "";
    dom.employeeBulkStatus.classList.add("is-hidden");
    return;
  }
  if (tone === "warning") dom.employeeBulkStatus.classList.add("meta-warning");
  if (tone === "success") dom.employeeBulkStatus.classList.add("meta-success");
  dom.employeeBulkStatus.textContent = message;
}

function showAuthOverlay(message = "") {
  let overlay = document.getElementById("authOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "authOverlay";
    overlay.className = "auth-overlay";
    overlay.innerHTML = `<div class="auth-card"><h1 class="auth-brand">BADGER</h1><p class="auth-company">INVENTORY SERVICE, INC.</p><h2>Weekly Schedule Board</h2><p class="auth-subtitle">Please sign in to continue</p><p id="authErrorText" class="auth-error is-hidden"></p><button id="authSignInBtn" type="button" class="btn auth-signin-btn">Sign In with Google</button></div>`;
    document.body.appendChild(overlay);
    document.getElementById("authSignInBtn")?.addEventListener("click", () =>
      auth?.signInWithPopup(googleProvider).catch((error) => {
        const errorText = document.getElementById("authErrorText");
        if (!errorText) return;
        errorText.textContent = `Sign-in failed: ${error.message}`;
        errorText.classList.remove("is-hidden");
      }),
    );
  }
  overlay.classList.remove("is-hidden");
  dom.appHeader?.classList.add("app-hidden");
  dom.appPage?.classList.add("app-hidden");
  dom.loadingOverlay?.classList.add("is-hidden");
  const errorText = document.getElementById("authErrorText");
  if (!errorText) return;
  errorText.textContent = message;
  errorText.classList.toggle("is-hidden", !message);
}

function hideAuthOverlay() {
  document.getElementById("authOverlay")?.classList.add("is-hidden");
  dom.appHeader?.classList.remove("app-hidden");
  dom.appPage?.classList.remove("app-hidden");
}

function setAuthStatus(email) {
  if (dom.authStatus) dom.authStatus.textContent = email || "Signed out";
  if (dom.signOutBtn) dom.signOutBtn.classList.toggle("is-hidden", !email);
}

function hideLoadingOverlay() {
  dom.loadingOverlay?.classList.add("is-hidden");
}
