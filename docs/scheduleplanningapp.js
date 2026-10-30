const state = {
  fullOnsiteData: null, fullOnsiteContexts: new Map(), fullOnsiteEnabled: false, fullOnsiteLoadError: null,
  durationHistory: null,
  durationAnalytics: null,
  durationContextCache: new Map(),
  rows: [],
  jobs: [],
  stores: new Map(),
  storeSegmentByStoreKey: new Map(),
  accountSegmentStats: new Map(),
  accountTypeStats: new Map(),
  accountOfficeStats: new Map(),
  accountGlobalStats: new Map(),
  employees: new Map(),
  peerAccountEstimateCache: new Map(),
  modasMedianCache: new Map(),
  activeEmployeeIds: new Set(),
  hasExplicitRoster: false,
  historyMetadata: null,
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
  scheduleRows: [],
  externalScheduleRows: [],
  scheduleByStoreKey: new Map(),
  scheduleUnmatchedRows: [],
  storeScheduleFilter: "all",
  storeLastCrew: new Map(),
  storeLastSupervisor: new Map(),
  selectedStoreKey: null,
  modasByStore: {},
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
    linkedPairsInput: "",
    lockedStoreAInput: "",
    lockedStoreBInput: "",
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
  productionShrinkPercent: 0,
  productionShrinkMode: "all",
  productionShrinkEmployeeIds: new Set(),
  useRecentAccountProduction: false,
  backtestMetrics: { jobs: 0, durationMae: 0, splitDate: "" },
  accuracyCache: null,
  analyticsReady: false,
  analyticsScheduled: false,
  dataFingerprint: "",
  lastCrewAppliedStoreKey: null,
  detailedView: false,
  isLoaded: false,
};

const FORECAST_LOG_KEY = "crew_predictor_forecasts_v1";
let forecastSaveTimer = null;

const STORAGE_KEY = "crew_predictor_v2";
const ANALYTICS_CACHE_KEY = "crew_predictor_analytics_v2";
const ANALYTICS_DB_NAME = "crew_predictor_analytics";
const ANALYTICS_DB_VERSION = 1;
const ANALYTICS_DB_STORE = "snapshots";
const ANALYTICS_DB_SNAPSHOT_ID = "latest";
const DATA_ASSET_VERSION = "20261030-155448";
const withDataAssetVersion = (path) => `${path}?v=${DATA_ASSET_VERSION}`;
const HISTORY_JSON_PATH = withDataAssetVersion("data/EmployeeProductionExport.json");
const RETAINED_HISTORY_JSON_PATH = withDataAssetVersion("data/EmployeeProductionHistory.json");
const ACTIVE_EMPLOYEE_JSON_PATH = withDataAssetVersion("data/EmployeeProductionExport.json");
const SCHEDULE_JSON_PATH = withDataAssetVersion("data/ScheduleFinalFull.json");
const PRECOMPUTED_ANALYTICS_JSON_PATH = withDataAssetVersion(
  "data/ScheduleAnalyticsSnapshot.json",
);
const runtimeConfig = window.__BADGER_RUNTIME_CONFIG__ || {};
const PRECOMPUTE_ANALYTICS_MODE = new URLSearchParams(
  window.location.search || "",
).get("precomputeAnalytics") === "1";

const ACCOUNT_GROUPS = {
  kroger: ["kroger", "mariano's"],
  "piggly wiggly": [
    "piggly wiggly",
    "piggly wiggly - franchise",
    "pigs coporate",
    "pigs dave s",
    "pigs fox brothers",
    "pigs jake b",
    "pigs malicki",
    "pigs migel",
    "pigs mike day",
    "pigs red",
    "pigs ryan o",
    "pigs stinebrinks",
    "pigs stoneridge",
    "pigs teagan counihan",
    "pigs tietz",
  ],
  "ascension rx": [
    "ascension rx",
    "ascension rx - per k",
    "ascension rx - man hr",
  ],
  "fuel on": [
    "fuel on",
    "relaince fuel, llc",
    "reliance fuel, llc",
    "schierl",
  ],
  "single c-stores": [
    "single c-stores",
    "*single c-stores $-check",
    "*single c-stores $ cash",
  ],
};

const accountGroupMap = new Map();
Object.keys(ACCOUNT_GROUPS).forEach((groupKey) => {
  ACCOUNT_GROUPS[groupKey].forEach((account) => {
    accountGroupMap.set(account.toLowerCase(), groupKey);
  });
});
const scheduleDataApiConfig = runtimeConfig.scheduleDataApi || {};
const BOARD_ALLOWED_USERS = ["lclark@badgerinventory.com"];
const DEFAULT_EMPLOYEE_RENDER_LIMIT = 150;
const DEFAULT_COMPARE_EMPLOYEE_RENDER_LIMIT = 120;
const BRUTE_FORCE_COMPARE_UNIT_LIMIT = 15;
const MAX_GREEDY_RX_SEED_CANDIDATES = 12;
const ALLOWED_USERS = [
  "jswanson@badgerinventory.com",
  "hkraemer@badgerinventory.com",
  "jfalck@badgerinventory.com",
  "spalmer@badgerinventory.com",
  "nbrock@badgerinventory.com",
  "lclark@badgerinventory.com",
  "kgrohall@badgerinventory.com",
  "files@badgerinventory.com",
  "qianabatton@gmail.com",
];
const firebaseConfig = {
  apiKey: "AIzaSyCYuvMZVE9aTX_95nuZrUiv_pFHbZG_5pY",
  authDomain: "employee-dashboard-aab04.firebaseapp.com",
  projectId: "employee-dashboard-aab04",
  storageBucket: "employee-dashboard-aab04.appspot.com",
  messagingSenderId: "511125736771",
  appId: "1:511125736771:web:cdb9a3dcadcdd23240b3f6",
};

let auth = null;
let googleProvider = null;
let appInitialized = false;

const dom = {
  appHeader: document.querySelector("header.topbar"),
  appLayout: document.querySelector("main.layout"),
  authStatus: document.getElementById("topbarAuthStatus"),
  signOutBtn: document.getElementById("topbarSignOutBtn"),
  scheduleBoardLink: document.getElementById("scheduleBoardLink"),
  storeSearch: document.getElementById("storeSearch"),
  clearStoreSearchBtn: document.getElementById("clearStoreSearchBtn"),
  storeScheduleFilter: document.getElementById("storeScheduleFilter"),
  storeSelect: document.getElementById("storeSelect"),
  useModas: document.getElementById("useModas"),
  storeSelectMeta: document.getElementById("storeSelectMeta"),
  storeStats: document.getElementById("storeStats"),
  planningMode: document.getElementById("planningMode"),
  targetValue: document.getElementById("targetValue"),
  productionShrinkPercent: document.getElementById("productionShrinkPercent"),
  productionShrinkMode: document.getElementById("productionShrinkMode"),
  productionShrinkEmployees: document.getElementById("productionShrinkEmployees"),
  productionShrinkHelp: document.getElementById("productionShrinkHelp"),
  useRecentAccountProduction: document.getElementById(
    "useRecentAccountProduction",
  ),
  goalHint: document.getElementById("goalHint"),
  supervisorEmployee: document.getElementById("supervisorEmployee"),
  supervisorMode: document.getElementById("supervisorMode"),
  rxRoleCard: document.getElementById("rxRoleCard"),
  rxEmployee: document.getElementById("rxEmployee"),
  rxMode: document.getElementById("rxMode"),
  trainingEmployee: document.getElementById("trainingEmployee"),
  trainingMode: document.getElementById("trainingMode"),
  earlyLateEmployee: document.getElementById("earlyLateEmployee"),
  earlyLateMode: document.getElementById("earlyLateMode"),
  employeeFilter: document.getElementById("employeeFilter"),
  employeeBulkStatus: document.getElementById("employeeBulkStatus"),
  selectedCrewChips: document.getElementById("selectedCrewChips"),
  employeeList: document.getElementById("employeeList"),
  lastCrewBtn: document.getElementById("lastCrewBtn"),
  clearEmployeesBtn: document.getElementById("clearEmployeesBtn"),
  predDuration: document.getElementById("predDuration"),
  predManHours: document.getElementById("predManHours"),
  predBand: document.getElementById("predBand"),
  predDelta: document.getElementById("predDelta"),
  detailModeBtn: document.getElementById("detailModeBtn"),
  detailBackgroundPanel: document.getElementById("detailBackgroundPanel"),
  detailBackgroundContent: document.getElementById("detailBackgroundContent"),
  recommendationStatus: document.getElementById("recommendationStatus"),
  predictionMeta: document.getElementById("predictionMeta"),
  scenarioBody: document.getElementById("scenarioBody"),
  storeAccuracySummary: document.getElementById("storeAccuracySummary"),
  lastCrewSummary: document.getElementById("lastCrewSummary"),
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
  compareBulkStatus: document.getElementById("compareBulkStatus"),
  compareLinkedPairs: document.getElementById("compareLinkedPairs"),
  compareLockedStoreA: document.getElementById("compareLockedStoreA"),
  compareLockedStoreB: document.getElementById("compareLockedStoreB"),
  compareEmployeeList: document.getElementById("compareEmployeeList"),
  compareRxRoleGroup: document.getElementById("compareRxRoleGroup"),
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

let pendingBoardPrefill = readBoardPrefillFromUrl();

bootstrapAuth();

function bootstrapAuth() {
  if (PRECOMPUTE_ANALYTICS_MODE) {
    initialize();
    appInitialized = true;
    return;
  }

  if (typeof firebase === "undefined") {
    console.error("Firebase SDK was not loaded.");
    showAuthOverlay("Authentication is unavailable right now. Please refresh.");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  auth = firebase.auth();
  googleProvider = new firebase.auth.GoogleAuthProvider();

  dom.signOutBtn?.addEventListener("click", () => {
    auth?.signOut().catch(() => {});
  });

  auth.onAuthStateChanged((user) => {
    if (user?.email && ALLOWED_USERS.includes(user.email.toLowerCase())) {
      hideAuthOverlay();
      setAuthStatus(user.email);
      if (!appInitialized) {
        initialize();
        appInitialized = true;
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

function ensureAuthOverlay() {
  let overlay = document.getElementById("authOverlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "authOverlay";
  overlay.className = "auth-overlay";
  overlay.innerHTML = `
    <div class="auth-card">
      <h1 class="auth-brand">BADGER</h1>
      <p class="auth-company">INVENTORY SERVICE, INC.</p>
      <h2>Shift Crew Planner</h2>
      <p class="auth-subtitle">Please sign in to continue</p>
      <p id="authErrorText" class="auth-error is-hidden"></p>
      <button id="authSignInBtn" type="button" class="btn auth-signin-btn">Sign In with Google</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const signInBtn = document.getElementById("authSignInBtn");
  signInBtn?.addEventListener("click", () => {
    if (!auth || !googleProvider) return;
    auth.signInWithPopup(googleProvider).catch((error) => {
      const authErrorText = document.getElementById("authErrorText");
      if (authErrorText) {
        authErrorText.textContent = `Sign-in failed: ${error.message}`;
        authErrorText.classList.remove("is-hidden");
      }
    });
  });

  return overlay;
}

function showAuthOverlay(errorMessage = "") {
  ensureAuthOverlay().classList.remove("is-hidden");
  dom.appHeader?.classList.add("app-hidden");
  dom.appLayout?.classList.add("app-hidden");
  dom.computeWaitOverlay?.classList.add("is-hidden");
  const authErrorText = document.getElementById("authErrorText");
  if (!authErrorText) return;
  if (errorMessage) {
    authErrorText.textContent = errorMessage;
    authErrorText.classList.remove("is-hidden");
    return;
  }
  authErrorText.textContent = "";
  authErrorText.classList.add("is-hidden");
}

function hideAuthOverlay() {
  ensureAuthOverlay().classList.add("is-hidden");
  dom.appHeader?.classList.remove("app-hidden");
  dom.appLayout?.classList.remove("app-hidden");
}

function setAuthStatus(email) {
  if (dom.authStatus) {
    dom.authStatus.textContent = email ? email : "Signed out";
  }
  if (dom.signOutBtn) {
    dom.signOutBtn.classList.toggle("is-hidden", !email);
  }
  if (dom.scheduleBoardLink) {
    const normalizedEmail = cleanText(email).toLowerCase();
    dom.scheduleBoardLink.classList.toggle(
      "is-hidden",
      !BOARD_ALLOWED_USERS.includes(normalizedEmail),
    );
  }
}

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

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function readBoardPrefillFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const encoded = cleanText(params.get("boardPrefill"));
    if (!encoded) return null;
    const jsonText = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function clearBoardPrefillFromUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("boardPrefill");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch (_error) {
    // Ignore URL cleanup failures.
  }
}

function resolveBoardPrefillStoreKey(prefill) {
  const directKey = cleanText(prefill?.storeKey);
  if (directKey && state.stores.has(directKey)) return directKey;
  const targetAccount = getLinkedAccountKey(prefill?.account);
  const targetStore = cleanText(prefill?.storeName).toLowerCase();
  if (!targetStore) return null;
  const matched = state.storesList.find((store) => {
    const sameStore = cleanText(store.storeName).toLowerCase() === targetStore;
    const sameAccount =
      !targetAccount ||
      getLinkedAccountKey(store.account) === targetAccount;
    return sameStore && sameAccount;
  });
  return matched?.storeKey || null;
}

function applyBoardPrefillIfAvailable() {
  const prefill = pendingBoardPrefill;
  if (!prefill) return false;

  const storeKey = resolveBoardPrefillStoreKey(prefill);
  if (!storeKey) {
    pendingBoardPrefill = null;
    clearBoardPrefillFromUrl();
    return false;
  }

  state.selectedStoreKey = storeKey;
  state.selectedEmployees = new Set(
    filterToSchedulableEmployees(prefill.employeeIds || []),
  );
  const selectedSet = new Set(Array.from(state.selectedEmployees));
  const supervisorId = cleanText(prefill.supervisorId);
  const roleIds = prefill.roleIds || {};
  state.selectedRolesByStore = {
    [storeKey]: {
      supervisor: selectedSet.has(supervisorId) ? supervisorId : "",
      rx: filterToSelected(normalizeRoleArray(roleIds.rx), selectedSet),
      training: filterToSelected(
        normalizeRoleArray(roleIds.training),
        selectedSet,
      ),
      earlyLate: filterToSelected(
        normalizeRoleArray(roleIds.earlyLate),
        selectedSet,
      ),
    },
  };
  const roleModes = prefill.roleModes || {};
  state.roleModesByStore = {
    [storeKey]: {
      supervisor: parseContributionMode(roleModes.supervisor || "p50"),
      rx: parseContributionMode(roleModes.rx || "p50"),
      training: parseContributionMode(roleModes.training || "p70"),
      earlyLate: parseContributionMode(roleModes.earlyLate || "p50"),
    },
  };
  state.planningMode = "duration";
  state.targetValue = Math.max(0, toNumber(prefill.plannedDurationHours));
  state.productionShrinkPercent = 0;
  state.productionShrinkMode = "all";
  state.productionShrinkEmployeeIds = new Set();
  state.useRecentAccountProduction = false;
  if (dom.planningMode) dom.planningMode.value = state.planningMode;
  if (dom.targetValue)
    dom.targetValue.value = state.targetValue > 0 ? state.targetValue : "";
  if (dom.productionShrinkPercent) dom.productionShrinkPercent.value = "";
  if (dom.productionShrinkMode) dom.productionShrinkMode.value = "all";
  if (dom.useRecentAccountProduction)
    dom.useRecentAccountProduction.checked = false;

  renderProductionShrinkEmployees();
  syncRoleAssignmentsToSelectedCrew();
  pendingBoardPrefill = null;
  clearBoardPrefillFromUrl();
  return true;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesEmployeeQuery(employeeId, query, displayName) {
  const normalizedQuery = cleanText(query).toLowerCase();
  if (!normalizedQuery) return true;
  const normalizedName = cleanText(displayName).toLowerCase();
  const normalizedId = cleanText(employeeId).toLowerCase();
  if (normalizedId.includes(normalizedQuery)) return true;
  const boundaryMatcher = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(normalizedQuery)}`,
  );
  return boundaryMatcher.test(normalizedName);
}

function splitBulkEmployeeEntries(rawText) {
  return String(rawText || "")
    .split(/[\r\n,;]+/)
    .map((part) => cleanText(part))
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
    .map((cells) => cells.map((value) => cleanText(value)))
    .filter((cells) => cells.some(Boolean));
}

function extractBulkEmployeeEntries(rawText) {
  const rows = parseClipboardTable(rawText);
  const hasMultipleColumns = rows.some((cells) => cells.length > 1);
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

function isUntilNoonEarlyStartNote(noteText, schedule) {
  const note = cleanText(noteText).toLowerCase();
  return (
    /\b(?:until|unitl)\s+noon\b/.test(note) &&
    parseScheduleTimeToMinutes(schedule?.startTimeText) <= 6 * 60
  );
}

function parseBulkEmployeeNoteFlags(noteText, schedule) {
  const note = cleanText(noteText).toLowerCase();
  return {
    rx: /\brx\b/.test(note),
    training: /\btrain|\btrainer\b|\bwork\s+(?:with|w\/)\b/.test(note),
    earlyLate:
      /\b(until|unitl|after)\b/.test(note) &&
      !isUntilNoonEarlyStartNote(note, schedule),
  };
}

function getEmployeeNameParts(employeeId) {
  const displayName = cleanText(getEmployeeDisplayName(employeeId));
  const parts = displayName.split(/\s+/).filter(Boolean);
  const first = (parts[0] || "").toLowerCase();
  const last = (parts[parts.length - 1] || "").toLowerCase();
  return { first, last };
}

function compareEmployeesByDisplayName(leftEmployeeId, rightEmployeeId) {
  const leftName = cleanText(getEmployeeDisplayName(leftEmployeeId));
  const rightName = cleanText(getEmployeeDisplayName(rightEmployeeId));
  const byName = leftName.localeCompare(rightName, undefined, {
    sensitivity: "base",
    numeric: true,
  });
  if (byName !== 0) return byName;
  return cleanText(leftEmployeeId).localeCompare(
    cleanText(rightEmployeeId),
    undefined,
    {
      sensitivity: "base",
      numeric: true,
    },
  );
}

function summarizeBulkEntryList(items, limit = 4) {
  const entries = Array.from(items || []).filter(Boolean);
  if (!entries.length) return "";
  if (entries.length <= limit) return entries.join(", ");
  return `${entries.slice(0, limit).join(", ")} +${entries.length - limit} more`;
}

function resolveBulkEmployeeSelection(rawText, candidateIds, schedule) {
  const structuredEntries = extractBulkEmployeeEntries(rawText);
  const entries = structuredEntries.map((entry) => entry.name);
  const pool = Array.from(candidateIds || [])
    .map((id) => cleanText(id))
    .filter(Boolean);
  const matchedIds = new Set();
  const rxIds = new Set();
  const trainingIds = new Set();
  const earlyLateIds = new Set();
  const ambiguousEntries = [];
  const unmatchedEntries = [];

  structuredEntries.forEach((entryObj) => {
    const entry = entryObj.name;
    const normalizedEntry = cleanText(entry);
    const normalizedLower = normalizedEntry.toLowerCase();
    if (!normalizedLower) return;
    const noteFlags = parseBulkEmployeeNoteFlags(entryObj.note, schedule);
    const markMatched = (employeeId) => {
      matchedIds.add(employeeId);
      if (noteFlags.rx) rxIds.add(employeeId);
      if (noteFlags.training) trainingIds.add(employeeId);
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
      matchesEmployeeQuery(id, normalizedLower, getEmployeeDisplayName(id)),
    );
    if (queryMatches.length === 1) {
      markMatched(queryMatches[0]);
      return;
    }

    const tokens = normalizedLower.split(/\s+/).filter(Boolean);
    const firstNameToken = tokens[0] || "";
    const lastToken = (tokens[1] || "").replace(/[^a-z]/g, "");
    if (!firstNameToken) return;

    const firstNameCandidates = pool.filter((id) => {
      const parts = getEmployeeNameParts(id);
      return parts.first === firstNameToken;
    });

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

    const narrowed = firstNameCandidates.filter((id) => {
      const parts = getEmployeeNameParts(id);
      return parts.last.startsWith(lastToken);
    });

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
    trainingIds: Array.from(trainingIds),
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
  if (result.trainingIds?.length)
    roleHints.push(`Training ${result.trainingIds.length}`);
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

function splitLinkedGroupLine(rawLine) {
  return String(rawLine || "")
    .split(/\s*(?:\+|&|\/|\||\band\b)\s*/i)
    .map((token) => cleanText(token))
    .filter(Boolean);
}

function resolveCompareConstraints(cfg, candidateIds) {
  const pool = Array.from(candidateIds || []).filter(Boolean);
  const lockAResult = resolveBulkEmployeeSelection(
    cfg.lockedStoreAInput || "",
    pool,
  );
  const lockBResult = resolveBulkEmployeeSelection(
    cfg.lockedStoreBInput || "",
    pool,
  );
  const lockASet = new Set(lockAResult.matchedIds || []);
  const lockBSet = new Set(lockBResult.matchedIds || []);
  const linkedPairGroups = [];
  const linkedIssues = [];
  const rawLines = String(cfg.linkedPairsInput || "")
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean);

  rawLines.forEach((line, lineIndex) => {
    const entries = splitLinkedGroupLine(line);
    if (entries.length < 2) return;
    const resolvedIds = [];
    const unresolved = [];
    const ambiguous = [];
    entries.forEach((entry) => {
      const resolved = resolveBulkEmployeeSelection(entry, pool);
      if (resolved.matchedIds.length === 1) {
        resolvedIds.push(resolved.matchedIds[0]);
        return;
      }
      if (resolved.ambiguousEntries.length > 0) ambiguous.push(entry);
      else unresolved.push(entry);
    });
    if (ambiguous.length || unresolved.length) {
      const parts = [];
      if (ambiguous.length) {
        parts.push(`ambiguous: ${ambiguous.join(", ")}`);
      }
      if (unresolved.length) {
        parts.push(`no match: ${unresolved.join(", ")}`);
      }
      linkedIssues.push(`line ${lineIndex + 1} (${parts.join("; ")})`);
      return;
    }
    const uniqueResolved = Array.from(new Set(resolvedIds));
    if (uniqueResolved.length >= 2) linkedPairGroups.push(uniqueResolved);
  });

  const lockedBoth = Array.from(lockASet).filter((id) => lockBSet.has(id));
  const issues = [];
  if (lockAResult.ambiguousEntries.length) {
    issues.push(
      `Store A locks ambiguous: ${summarizeBulkEntryList(lockAResult.ambiguousEntries)}.`,
    );
  }
  if (lockAResult.unmatchedEntries.length) {
    issues.push(
      `Store A locks not found: ${summarizeBulkEntryList(lockAResult.unmatchedEntries)}.`,
    );
  }
  if (lockBResult.ambiguousEntries.length) {
    issues.push(
      `Store B locks ambiguous: ${summarizeBulkEntryList(lockBResult.ambiguousEntries)}.`,
    );
  }
  if (lockBResult.unmatchedEntries.length) {
    issues.push(
      `Store B locks not found: ${summarizeBulkEntryList(lockBResult.unmatchedEntries)}.`,
    );
  }
  if (linkedIssues.length) {
    issues.push(
      `Linked groups unresolved: ${summarizeBulkEntryList(linkedIssues)}.`,
    );
  }
  if (lockedBoth.length) {
    issues.push(
      `Employees locked to both stores: ${summarizeBulkEntryList(
        lockedBoth.map((id) => getEmployeeDisplayName(id)),
      )}.`,
    );
  }

  return {
    issues,
    constraints: {
      linkedGroups: linkedPairGroups,
      lockedStoreA: Array.from(lockASet),
      lockedStoreB: Array.from(lockBSet),
    },
  };
}

function buildEmployeeLinkedUnits(allIds, baseA, baseB, constraints) {
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
          .map((id) => getEmployeeDisplayName(id))
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
        .map((id) => getEmployeeDisplayName(id))
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

function setEmployeeBulkStatus(message, tone = "info") {
  if (!dom.employeeBulkStatus) return;
  dom.employeeBulkStatus.classList.remove("meta-warning", "meta-success");
  if (!message) {
    dom.employeeBulkStatus.textContent = "";
    return;
  }
  if (tone === "warning") dom.employeeBulkStatus.classList.add("meta-warning");
  else if (tone === "success")
    dom.employeeBulkStatus.classList.add("meta-success");
  dom.employeeBulkStatus.textContent = message;
}

function setCompareBulkStatus(message, tone = "info") {
  if (!dom.compareBulkStatus) return;
  dom.compareBulkStatus.classList.remove("meta-warning", "meta-success");
  if (!message) {
    dom.compareBulkStatus.textContent = "";
    return;
  }
  if (tone === "warning") dom.compareBulkStatus.classList.add("meta-warning");
  else if (tone === "success")
    dom.compareBulkStatus.classList.add("meta-success");
  dom.compareBulkStatus.textContent = message;
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
  document.getElementById("exportForecastsBtn")?.addEventListener("click", exportSavedForecasts);
  dom.storeSearch.addEventListener("input", renderStoreSelect);
  dom.clearStoreSearchBtn.addEventListener("click", clearStoreSearch);
  dom.storeScheduleFilter?.addEventListener(
    "change",
    onStoreScheduleFilterChange,
  );
  dom.storeSelect.addEventListener("change", onStoreChange);
  dom.useModas.addEventListener("change", () => {
    if (!state.selectedStoreKey) return;
    state.modasByStore[state.selectedStoreKey] = dom.useModas.checked;
    persistToStorage();
    renderEmployeeList();
    updateResults();
  });
  dom.planningMode.addEventListener("change", onPlanningInputChange);
  dom.targetValue.addEventListener("input", onPlanningInputChange);
  dom.productionShrinkPercent?.addEventListener("input", onPlanningInputChange);
  dom.productionShrinkMode?.addEventListener("change", onPlanningInputChange);
  dom.productionShrinkEmployees?.addEventListener(
    "change",
    onPlanningInputChange,
  );
  dom.useRecentAccountProduction?.addEventListener(
    "change",
    onPlanningInputChange,
  );
  dom.detailModeBtn?.addEventListener("click", toggleDetailedView);
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
  dom.employeeFilter.addEventListener("paste", onEmployeeFilterPaste);
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
  dom.compareEmployeeFilter.addEventListener(
    "input",
    renderCompareEmployeeList,
  );
  dom.compareEmployeeFilter.addEventListener(
    "keydown",
    onCompareEmployeeFilterKeyDown,
  );
  dom.compareEmployeeFilter.addEventListener(
    "paste",
    onCompareEmployeeFilterPaste,
  );
  dom.compareLinkedPairs.addEventListener("input", onCompareInputChange);
  dom.compareLockedStoreA.addEventListener("input", onCompareInputChange);
  dom.compareLockedStoreB.addEventListener("input", onCompareInputChange);
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
    const [
      historyResult,
      activeEmployeeResult,
      scheduleResult,
      externalScheduleResult,
      precomputedAnalyticsResult,
    ] =
      await Promise.all([
        fetchHistoryJson(),
        fetchOptionalJson(ACTIVE_EMPLOYEE_JSON_PATH),
        fetchOptionalJson(SCHEDULE_JSON_PATH),
        fetchOptionalScheduleDataApi(),
        PRECOMPUTE_ANALYTICS_MODE
          ? Promise.resolve(null)
          : fetchOptionalJsonQuiet(PRECOMPUTED_ANALYTICS_JSON_PATH),
      ]);
    try {
      const full = await fetchOptionalJsonQuiet("data/FullAttendanceHistory.json");
      state.fullOnsiteData = full ? FullOnsiteModel.validate(full.payload) : null;
      state.fullOnsiteContexts.clear();
      state.fullOnsiteLoadError = state.fullOnsiteData ? null : "Full attendance history unavailable; existing predictor remains available.";
    } catch (error) { state.fullOnsiteData = null; state.fullOnsiteLoadError = error.message; }
    const fingerprint = buildDataFingerprintFromJsonText(
      historyResult.rawJsonText,
    );
    const rawRows = extractRowsFromJson(historyResult.payload);
    state.historyMetadata = historyResult.payload?._meta || null;
    const activeEmployeeRows = extractRowsFromJson(
      activeEmployeeResult?.payload,
    );
    const scheduleRows = extractRowsFromJson(scheduleResult?.payload);
    state.externalScheduleRows = extractRowsFromJson(
      externalScheduleResult?.payload,
    );
    await loadRows(
      rawRows,
      scheduleRows,
      fingerprint,
      activeEmployeeRows,
      precomputedAnalyticsResult?.payload || null,
    );
  } catch (error) {
    const message = error?.message || "Unknown error";
    setPredictionMeta(`Data load failed: ${message}`, "warning");
    hideComputeWaitOverlay();
    if (PRECOMPUTE_ANALYTICS_MODE) {
      finishAnalyticsPrecompute(false, { message });
    }
  }
}

async function fetchHistoryJson() {
  const response = await fetch(RETAINED_HISTORY_JSON_PATH, { cache: "no-store" });
  if (response.status === 404) return fetchRequiredJson(HISTORY_JSON_PATH);
  if (!response.ok) throw new Error(`Retained history unavailable (HTTP ${response.status}); refusing to silently discard older records.`);
  const rawJsonText = await response.text();
  const payload = JSON.parse(rawJsonText);
  if (payload?._meta?.schemaVersion !== 1 || !Array.isArray(payload.EmployeeProductionHistory)) {
    throw new Error("Retained history is damaged or unsupported; restore it from the local archive.");
  }
  return { payload, rawJsonText };
}

function hasScheduleDataApiConfig() {
  return Boolean(
    cleanText(scheduleDataApiConfig.url) && cleanText(scheduleDataApiConfig.apiKey),
  );
}

async function fetchOptionalScheduleDataApi() {
  if (!hasScheduleDataApiConfig()) {
    return null;
  }

  try {
    const response = await fetch(cleanText(scheduleDataApiConfig.url), {
      cache: "no-store",
      headers: {
        "x-api-key": cleanText(scheduleDataApiConfig.apiKey),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const rawJsonText = await response.text();
    return {
      rawJsonText,
      payload: JSON.parse(rawJsonText),
    };
  } catch (error) {
    console.warn("Optional schedule data API load failed:", error);
    return null;
  }
}

async function fetchRequiredJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const rawJsonText = await response.text();
  return {
    rawJsonText,
    payload: JSON.parse(rawJsonText),
  };
}

async function fetchOptionalJson(path) {
  try {
    return await fetchRequiredJson(path);
  } catch (error) {
    console.warn(`Optional data load failed for ${path}:`, error);
    return null;
  }
}

async function fetchOptionalJsonQuiet(path) {
  try {
    return await fetchRequiredJson(path);
  } catch (_error) {
    return null;
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

async function loadRows(
  rawRows,
  scheduleRawRows = [],
  dataFingerprint = "",
  activeEmployeeRawRows = [],
  precomputedAnalyticsSnapshot = null,
) {
  const normalizedRows = rawRows.map(normalizeRow).filter((r) => r.valid);

  state.rows = normalizedRows;
  state.jobs = buildJobs(normalizedRows);
  state.durationHistory = DurationModel.createHistory(state.jobs);
  state.durationContextCache = new Map();
  state.stores = buildStoreStats(state.jobs);
  state.storeSegmentByStoreKey = buildStoreSegments(state.stores);
  applySegmentsToStores(state.stores, state.storeSegmentByStoreKey);
  state.accountSegmentStats = buildAccountSegmentStats(state.jobs);
  state.accountTypeStats = buildAccountTypeStats(state.jobs);
  state.accountOfficeStats = buildAccountOfficeStats(state.jobs);
  state.accountGlobalStats = buildAccountGlobalStats(state.jobs);
  state.employees = buildEmployeeStats(normalizedRows);
  for (const isModas of [true, false]) {
    const modeStats = buildEmployeeStats(normalizedRows.filter(row => row.isModas === isModas));
    state.employees.forEach((employee, id) => {
      employee[isModas ? "modasAccountStats" : "regularAccountStats"] =
        modeStats.get(id)?.accountStats || {};
    });
  }
  state.peerAccountEstimateCache = new Map();
  state.modasMedianCache = new Map();
  state.hasExplicitRoster = Array.isArray(state.historyMetadata?.latestEmployeeIds);
  state.activeEmployeeIds = buildActiveEmployeeIds(
    state.hasExplicitRoster ? state.historyMetadata.latestEmployeeIds.map(Employee => ({ Employee })) : activeEmployeeRawRows,
    state.employees,
  );
  state.suggestedSupervisorByStore = buildStoreSupervisorMap(normalizedRows);
  state.global = buildGlobalStats(state.jobs, state.employees);
  applyScheduleRows(scheduleRawRows);
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
  applyBoardPrefillIfAvailable();
  applyScheduledGoalDefault(false);
  refreshLoadedUi();
  if (
    !PRECOMPUTE_ANALYTICS_MODE &&
    isValidAnalyticsSnapshot(precomputedAnalyticsSnapshot, state.dataFingerprint)
  ) {
    applyAnalyticsSnapshot(precomputedAnalyticsSnapshot);
    await persistAnalyticsCache(state.dataFingerprint);
    state.analyticsReady = true;
    if (dom.computeAccuracyBtn) {
      dom.computeAccuracyBtn.disabled = true;
      dom.computeAccuracyBtn.textContent = "Accuracy Ready (Precomputed)";
    }
    renderAccuracyReport();
    updateResults();
    hideComputeWaitOverlay();
    return;
  }
  const restored = await restoreAnalyticsCache(state.dataFingerprint);
  if (restored) {
    state.analyticsReady = true;
    if (dom.computeAccuracyBtn) {
      dom.computeAccuracyBtn.disabled = true;
      dom.computeAccuracyBtn.textContent = "Accuracy Ready (Cached)";
    }
    renderAccuracyReport();
    updateResults();
    hideComputeWaitOverlay();
    if (PRECOMPUTE_ANALYTICS_MODE) {
      finishAnalyticsPrecompute(
        true,
        buildAnalyticsSnapshot(state.dataFingerprint),
      );
    }
    return;
  }
  scheduleDeferredAnalytics();
}

function normalizeScheduleRow(row) {
  const normalized = {};
  Object.keys(row || {}).forEach((key) => {
    normalized[canonicalizeKey(key)] = row[key];
  });

  const date = normalizeDateString(
    firstValue(normalized, ["scheduledateofinv", "dateofinv"]),
  );
  const storeName = cleanText(firstValue(normalized, ["storename"]));
  const runName = cleanText(firstValue(normalized, ["runname"]));
  const startTimeText = cleanScheduleText(
    firstValue(normalized, ["expr1", "timeofinv"]),
  );
  const meetTimeText = cleanScheduleText(firstValue(normalized, ["meettime"]));
  const typeOfInv = normalizeInventoryType(
    cleanText(firstValue(normalized, ["typeofinv"])) || "Unknown",
  );
  const address = cleanText(firstValue(normalized, ["storeaddress"]));
  const city = cleanText(firstValue(normalized, ["storecity"]));
  const stateCode = cleanText(firstValue(normalized, ["storestate"]));
  const zipcode = cleanText(firstValue(normalized, ["storezipcode"]));
  const mapLink = cleanText(firstValue(normalized, ["maplink"]));
  const phone = cleanText(firstValue(normalized, ["storephonenumber"]));
  const storeNotes = cleanScheduleText(firstValue(normalized, ["storenotes"]));
  const notes = cleanScheduleText(firstValue(normalized, ["notes"]));
  const rateType = cleanText(firstValue(normalized, ["ratetype"]));
  const officeNumber = cleanText(firstValue(normalized, ["officenumber"]));
  const customerNumber = cleanText(firstValue(normalized, ["customernumber1"]));
  const dateScheduled = normalizeDateTimeText(
    firstValue(normalized, ["datescheduled"]),
  );
  const runHints = parseRunNameHints(runName);

  return {
    valid: Boolean(date && storeName),
    date,
    storeName,
    canonicalStoreName: canonicalizeStoreName(storeName),
    runName,
    startTimeText,
    meetTimeText,
    typeOfInv,
    address,
    city,
    stateCode,
    zipcode,
    mapLink,
    phone,
    storeNotes,
    notes,
    rateType,
    officeNumber,
    customerNumber,
    dateScheduled,
    plannedDurationHours: runHints.plannedDurationHours,
    plannedCrewSize: runHints.plannedCrewSize,
  };
}

function applyScheduleRows(rawRows) {
  const normalizedRows = (rawRows || [])
    .map(normalizeScheduleRow)
    .filter((row) => row.valid)
    .sort(compareScheduleRows);

  const storeKeyIndex = buildScheduleStoreIndex(state.stores);
  const byStoreKey = new Map();
  const unmatchedRows = [];

  state.stores.forEach((store) => {
    store.scheduleRows = [];
    store.nextScheduledJob = null;
  });

  normalizedRows.forEach((row) => {
    const storeKey = resolveScheduleStoreKey(row, storeKeyIndex);
    if (!storeKey || !state.stores.has(storeKey)) {
      unmatchedRows.push(row);
      return;
    }

    const store = state.stores.get(storeKey);
    const enriched = {
      ...row,
      storeKey,
      account: store.account,
      officeLabel:
        cleanText(store.officeName) ||
        formatOfficeNumber(row.officeNumber) ||
        "Unknown",
    };
    if (!byStoreKey.has(storeKey)) byStoreKey.set(storeKey, []);
    byStoreKey.get(storeKey).push(enriched);
  });

  byStoreKey.forEach((rows, storeKey) => {
    rows.sort(compareScheduleRows);
    const store = state.stores.get(storeKey);
    if (!store) return;
    store.scheduleRows = rows;
    store.nextScheduledJob = getPrimaryScheduleRow(rows);
  });

  state.scheduleRows = normalizedRows;
  state.scheduleByStoreKey = byStoreKey;
  state.scheduleUnmatchedRows = unmatchedRows;
}

function buildScheduleStoreIndex(stores) {
  const index = new Map();
  stores.forEach((store, storeKey) => {
    const key = canonicalizeStoreName(store.storeName);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(storeKey);
  });
  return index;
}

function resolveScheduleStoreKey(row, storeKeyIndex) {
  const candidates = storeKeyIndex.get(row.canonicalStoreName) || [];
  if (candidates.length <= 1) return candidates[0] || "";

  return (
    candidates
      .map((storeKey) => state.stores.get(storeKey))
      .filter(Boolean)
      .sort((left, right) => (right.jobCount || 0) - (left.jobCount || 0))[0]
      ?.storeKey || ""
  );
}

function compareScheduleRows(left, right) {
  const byDate = cleanText(left?.date).localeCompare(cleanText(right?.date));
  if (byDate !== 0) return byDate;
  const byTime =
    parseScheduleTimeToMinutes(left?.startTimeText) -
    parseScheduleTimeToMinutes(right?.startTimeText);
  if (byTime !== 0) return byTime;
  return cleanText(left?.storeName).localeCompare(cleanText(right?.storeName));
}

function parseRunNameHints(runName) {
  const raw = cleanText(runName);
  const durationMatch = raw.match(/(\d+(?:\.\d+)?)\s*hrs?/i);
  const crewMatch = raw.match(/crew size of\s*(\d+)/i);
  return {
    plannedDurationHours: durationMatch ? toNumber(durationMatch[1]) : 0,
    plannedCrewSize: crewMatch ? Math.round(toNumber(crewMatch[1])) : 0,
  };
}

function getPrimaryScheduleRow(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;

  const today = getLocalDateStamp(0);
  const upcoming = list.find((row) => cleanText(row.date) >= today);
  return upcoming || list[0] || null;
}

function getScheduleRowsForStore(storeKey = state.selectedStoreKey) {
  return state.scheduleByStoreKey.get(storeKey) || [];
}

function getPrimaryScheduleForStore(storeKey = state.selectedStoreKey) {
  const store = state.stores.get(storeKey);
  if (store?.nextScheduledJob) return store.nextScheduledJob;
  return getPrimaryScheduleRow(getScheduleRowsForStore(storeKey));
}

function matchesScheduleFilter(
  scheduleRows,
  filterValue = state.storeScheduleFilter,
) {
  const rows = Array.isArray(scheduleRows) ? scheduleRows : [];
  if (filterValue === "all") return true;
  if (!rows.length) return false;
  if (filterValue === "scheduled") return rows.length > 0;

  const today = getLocalDateStamp(0);
  const tomorrow = getLocalDateStamp(1);
  const weekEnd = getLocalDateStamp(6);

  return rows.some((row) => {
    const date = cleanText(row.date);
    if (!date) return false;
    if (filterValue === "today") return date === today;
    if (filterValue === "tomorrow") return date === tomorrow;
    if (filterValue === "thisweek") return date >= today && date <= weekEnd;
    return true;
  });
}

function formatScheduleFilterLabel(value) {
  if (value === "today") return "Today";
  if (value === "tomorrow") return "Tomorrow";
  if (value === "thisweek") return "This Week";
  if (value === "all") return "All History";
  return "Scheduled Stores";
}

function onStoreScheduleFilterChange() {
  state.storeScheduleFilter =
    cleanText(dom.storeScheduleFilter?.value) || "all";
  renderStoreSelect();
  refreshStoreContextPanels();
  persistToStorage();
  renderEmployeeList();
  updateResults();
}

function getStoreModasMode(storeKey = state.selectedStoreKey) {
  if (typeof state.modasByStore[storeKey] === "boolean") return state.modasByStore[storeKey];
  const store = state.stores.get(storeKey);
  return getLinkedAccountKey(store?.account || "") === "kroger" ||
    /modas/i.test(getPrimaryScheduleForStore(storeKey)?.typeOfInv || store?.primaryType || "");
}

function refreshStoreContextPanels() {
  dom.useModas.checked = getStoreModasMode();
  dom.useModas.disabled = !state.selectedStoreKey;
  renderStoreStats();
  renderGoalHint();
  renderLastCrewSummary();
}

function renderGoalHint() {
  if (!dom.goalHint) return;

  const schedule = getPrimaryScheduleForStore();
  if (!state.selectedStoreKey) {
    dom.goalHint.textContent =
      "Schedule-based duration hints will appear here when available.";
    dom.goalHint.classList.remove("meta-warning", "meta-success");
    return;
  }

  if (!schedule) {
    dom.goalHint.textContent =
      "No linked schedule row found for this store. Enter a goal manually if needed.";
    dom.goalHint.classList.remove("meta-warning", "meta-success");
    return;
  }

  const parts = [];
  if (schedule.plannedDurationHours > 0) {
    parts.push(
      `Schedule suggests ${formatNumber(schedule.plannedDurationHours, 2)} hrs from the run name.`,
    );
  } else {
    parts.push("No duration value was encoded in the schedule run name.");
  }

  dom.goalHint.textContent = parts.join(" ");
  dom.goalHint.classList.remove("meta-warning");
  dom.goalHint.classList.toggle(
    "meta-success",
    schedule.plannedDurationHours > 0,
  );
}

function applyScheduledGoalDefault(force = false) {
  const schedule = getPrimaryScheduleForStore();
  if (!schedule || !(schedule.plannedDurationHours > 0)) return false;
  if (!force && state.targetValue > 0) return false;

  state.planningMode = "duration";
  state.targetValue = schedule.plannedDurationHours;
  if (dom.planningMode) dom.planningMode.value = state.planningMode;
  if (dom.targetValue) dom.targetValue.value = state.targetValue;
  return true;
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
  const accountKey = getLinkedAccountKey(account);
  const employee = cleanText(firstValue(normalized, ["employee"]));
  const firstName = cleanText(firstValue(normalized, ["firstname"]));
  const lastName = cleanText(firstValue(normalized, ["lastname"]));
  const combinedName = `${firstName} ${lastName}`.trim();
  const employeeName = combinedName || employee;
  const type = normalizeInventoryType(
    cleanText(firstValue(normalized, ["typeofinv"])) || "Unknown",
  );
  const officeName =
    cleanText(firstValue(normalized, ["officename"])) || "Unknown";
  const role = cleanText(
    firstValue(normalized, ["role", "employeerole", "position", "jobtitle"]),
  ).toLowerCase();
  const isRx = parseBooleanFlag(
    firstValue(normalized, ["rx", "isrx", "rxvalue"]),
  );
  const supervisorNumber = cleanText(
    firstValue(normalized, ["supervisornumber"]),
  );

  const manHours = toNumber(
    firstValue(normalized, ["manhrs", "manhr", "expr1"]),
  );
  const totalExtQty = toNumber(firstValue(normalized, ["totalextqty"]));
  const piecesPerHr = toNumber(firstValue(normalized, ["piecesperhr"]));
  const telemetry = firstValue(normalized, ["avgdelta"]);
  const isModas = telemetry == null || String(telemetry).trim() === "" || !Number.isFinite(Number(telemetry))
    ? null : Number(telemetry) > 0 ? true : Number(telemetry) === 0 ? false : null;

  const storeKey = `${account}||${store}`;
  const jobKey = `${date}||${account}||${store}`;
  const valid = Boolean(date && store && employee);

  return {
    valid,
    date,
    account,
    accountKey,
    store,
    storeKey,
    employee,
    employeeName,
    type,
    officeName,
    role,
    isRx,
    supervisorNumber,
    manHours,
    totalExtQty,
    piecesPerHr,
    isModas,
    timeIn: cleanText(firstValue(normalized, ["timein"])),
    timeOut: cleanText(firstValue(normalized, ["timeout"])),
    reportedRateBasis: isRx ? "export RX-adjusted (observed Expr1 minus 2.5h; rationale unverified)" : "export attendance hours",
    provenance: row._history || null,
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
        accountKey: row.accountKey,
        storeName: row.store,
        storeKey: row.storeKey,
        typeOfInv: row.type,
        officeName: row.officeName || "Unknown",
        supervisorNumber: cleanText(row.supervisorNumber),
        supervisorCounts: new Map(),
        employees: new Set(),
        employeeStats: new Map(),
        totalPieces: 0,
        totalManHours: 0,
        duration: 0,
        durationIncludingSupervisor: 0,
        nonSupervisorDuration: 0,
        modasRows: 0,
        regularRows: 0,
        unknownModeRows: 0,
        rxEmployees: new Set(),
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
    const employeePieces = safeNumber(row.totalExtQty);
    const employeeHours = safeNumber(row.manHours);
    const employeeSpeed = safeNumber(row.piecesPerHr);
    const employeeId = cleanText(row.employee).toLowerCase();
    const isDaySupervisor =
      Boolean(supervisorId && employeeId === supervisorId.toLowerCase()) ||
      isSupervisorRole(row.role);
    if (row.isRx) job.rxEmployees.add(row.employee);
    if (!isDaySupervisor && !row.isRx) {
      if (row.isModas === true) job.modasRows++;
      else if (row.isModas === false) job.regularRows++;
      else job.unknownModeRows++;
    }
    if (!job.employeeStats.has(row.employee)) {
      job.employeeStats.set(row.employee, {
        employee: row.employee,
        pieces: 0,
        inStoreHours: 0,
        speedSamples: [],
      });
    }
    const employeeStat = job.employeeStats.get(row.employee);
    employeeStat.pieces += employeePieces;
    employeeStat.inStoreHours += employeeHours;
    if (employeeSpeed > 0) employeeStat.speedSamples.push(employeeSpeed);
    job.totalPieces += employeePieces;
    job.totalManHours += employeeHours;
    job.durationIncludingSupervisor = Math.max(
      job.durationIncludingSupervisor,
      employeeHours,
    );
    if (!isDaySupervisor) {
      job.nonSupervisorDuration = Math.max(
        job.nonSupervisorDuration,
        employeeHours,
      );
    }
  });

  return Array.from(jobs.values()).map((job) => ({
    ...job,
    duration: job.nonSupervisorDuration || job.durationIncludingSupervisor,
    crewSize: job.employees.size,
    inventoryMode: job.unknownModeRows ? null : job.modasRows && !job.regularRows ? true : job.regularRows && !job.modasRows ? false : null,
    rxEmployees: Array.from(job.rxEmployees),
    employees: Array.from(job.employees),
    employeeDetails: Array.from(job.employeeStats.values()).map((stat) => ({
      ...stat,
      piecesPerHr:
        stat.inStoreHours > 0
          ? stat.pieces / stat.inStoreHours
          : mean(stat.speedSamples),
      speedSamples: undefined,
    })),
    employeeStats: undefined,
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
    if (!grouped.has(job.storeKey)) {
      grouped.set(job.storeKey, {
        storeKey: job.storeKey,
        account: job.account,
        accountKey: job.accountKey,
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
      accountKey: bucket.accountKey,
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
    const accountKey = store.accountKey || getLinkedAccountKey(store.account);
    if (!byAccount.has(accountKey)) byAccount.set(accountKey, []);
    byAccount.get(accountKey).push({
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
      segmentKey: `${store.accountKey || getLinkedAccountKey(store.account)}||S1`,
    };
    store.segmentId = segment.segmentId;
    store.segmentKey = segment.segmentKey;
  });
}

function buildAccountSegmentStats(jobs) {
  const grouped = new Map();
  jobs.forEach((job) => {
    const segmentKey = state.storeSegmentByStoreKey.get(
      job.storeKey,
    )?.segmentKey;
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
    const key = `${job.accountKey || getLinkedAccountKey(job.account)}||${job.typeOfInv || "Unknown"}`;
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
    const key = `${job.accountKey || getLinkedAccountKey(job.account)}||${job.officeName || "Unknown"}`;
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
    const accountKey = job.accountKey || getLinkedAccountKey(job.account);
    if (!map.has(accountKey)) map.set(accountKey, []);
    map.get(accountKey).push(job);
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
  // Stable same-day tie handling for recent observations and peer iteration.
  rows = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.jobKey.localeCompare(b.jobKey) || a.employee.localeCompare(b.employee));
  const grouped = new Map();
  const maxRowTimestamp = (rows || [])
    .map((row) => Date.parse(row.date || ""))
    .filter((ts) => Number.isFinite(ts))
    .reduce((max, ts) => Math.max(max, ts), 0);
  const referenceTimestamp = maxRowTimestamp > 0 ? maxRowTimestamp : Date.now();

  rows.forEach((row) => {
    if (!grouped.has(row.employee)) {
      grouped.set(row.employee, {
        employee: row.employee,
        weightedSpeedSumGlobal: 0,
        weightSumGlobal: 0,
        recentWeightedSpeedSumGlobal: 0,
        recentWeightSumGlobal: 0,
        jobKeysGlobal: new Set(),
        accountBuckets: new Map(),
        supervisorAccountBuckets: new Map(),
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

    if (row.employeeName) {
      bucket.nameCounts.set(
        row.employeeName,
        (bucket.nameCounts.get(row.employeeName) || 0) + 1,
      );
    }

    // Exclude rows where the employee was the listed supervisor for that inventory.
    // This keeps supervisor-assignment days from biasing counter productivity history.
    const isSupervisorRunRow =
      cleanText(row.employee).toLowerCase() !== "" &&
      cleanText(row.supervisorNumber).toLowerCase() !== "" &&
      cleanText(row.employee).toLowerCase() ===
        cleanText(row.supervisorNumber).toLowerCase();
    if (isSupervisorRunRow) {
      const accountKey = row.accountKey || getLinkedAccountKey(row.account);
      if (!bucket.supervisorAccountBuckets.has(accountKey)) {
        bucket.supervisorAccountBuckets.set(accountKey, {
          jobKeys: new Set(),
          mostRecentSpeed: 0,
          mostRecentTimestamp: 0,
          mostRecentStoreName: "",
          mostRecentStoreKey: "",
          mostRecentAccount: "",
        });
      }
      const supervisorAccountBucket =
        bucket.supervisorAccountBuckets.get(accountKey);
      if (
        speed > 0 &&
        !row.isRx &&
        rowTimestamp > supervisorAccountBucket.mostRecentTimestamp
      ) {
        supervisorAccountBucket.mostRecentSpeed = speed;
        supervisorAccountBucket.mostRecentTimestamp = rowTimestamp;
        supervisorAccountBucket.mostRecentStoreName = row.store;
        supervisorAccountBucket.mostRecentStoreKey = row.storeKey;
        supervisorAccountBucket.mostRecentAccount = row.account;
      }
      supervisorAccountBucket.jobKeys.add(row.jobKey);
      return;
    }

    if (speed > 0 && weight > 0) {
      bucket.weightedSpeedSumGlobal += speed * weight;
      bucket.weightSumGlobal += weight;
      bucket.recentWeightedSpeedSumGlobal += speed * recencyWeight;
      bucket.recentWeightSumGlobal += recencyWeight;
    }

    if (speed > 0 && weight > 0) bucket.jobKeysGlobal.add(row.jobKey);

    const accountKey = row.accountKey || getLinkedAccountKey(row.account);
    if (!bucket.accountBuckets.has(accountKey)) {
      bucket.accountBuckets.set(accountKey, {
        weightedSpeedSum: 0,
        weightSum: 0,
        recentWeightedSpeedSum: 0,
        recentWeightSum: 0,
        jobKeys: new Set(),
        mostRecentSpeed: 0,
        mostRecentTimestamp: 0,
        mostRecentStoreName: "",
        mostRecentStoreKey: "",
        mostRecentAccount: "",
      });
    }
    const accountBucket = bucket.accountBuckets.get(accountKey);
    if (speed > 0 && weight > 0) {
      accountBucket.weightedSpeedSum += speed * weight;
      accountBucket.weightSum += weight;
      accountBucket.recentWeightedSpeedSum += speed * recencyWeight;
      accountBucket.recentWeightSum += recencyWeight;
    }
    if (
      speed > 0 &&
      !row.isRx &&
      rowTimestamp > accountBucket.mostRecentTimestamp
    ) {
      accountBucket.mostRecentSpeed = speed;
      accountBucket.mostRecentTimestamp = rowTimestamp;
      accountBucket.mostRecentStoreName = row.store;
      accountBucket.mostRecentStoreKey = row.storeKey;
      accountBucket.mostRecentAccount = row.account;
    }
    if (speed > 0 && weight > 0) accountBucket.jobKeys.add(row.jobKey);
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
        lastObservedDate: accountBucket.mostRecentTimestamp ? new Date(accountBucket.mostRecentTimestamp).toISOString().slice(0, 10) : "",
        mostRecentPiecesPerHr: accountBucket.mostRecentSpeed,
        mostRecentStoreName: accountBucket.mostRecentStoreName,
        mostRecentStoreKey: accountBucket.mostRecentStoreKey,
        mostRecentAccount: accountBucket.mostRecentAccount,
      };
    });
    const supervisorAccountStats = {};
    bucket.supervisorAccountBuckets.forEach((accountBucket, account) => {
      supervisorAccountStats[account] = {
        jobCount: accountBucket.jobKeys.size,
        mostRecentPiecesPerHr: accountBucket.mostRecentSpeed,
        mostRecentStoreName: accountBucket.mostRecentStoreName,
        mostRecentStoreKey: accountBucket.mostRecentStoreKey,
        mostRecentAccount: accountBucket.mostRecentAccount,
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
      supervisorAccountStats,
    });
  });

  return stats;
}

function buildActiveEmployeeIds(rows, employees) {
  const ids = uniqueStrings(
    (rows || []).map((row) => {
      const normalized = {};
      Object.keys(row || {}).forEach((key) => {
        normalized[canonicalizeKey(key)] = row[key];
      });
      return cleanText(firstValue(normalized, ["employee"]));
    }),
  ).filter((id) => employees.has(id));

  return new Set(ids.length || state.hasExplicitRoster ? ids : Array.from(employees.keys()));
}

function getSchedulableEmployeeIds() {
  if (state.hasExplicitRoster || state.activeEmployeeIds?.size > 0) {
    return Array.from(state.activeEmployeeIds).filter((id) =>
      state.employees.has(id),
    );
  }
  return Array.from(state.employees.keys());
}

function filterToSchedulableEmployees(employeeIds) {
  const allowed = new Set(getSchedulableEmployeeIds());
  return uniqueStrings(employeeIds || []).filter((id) => allowed.has(id));
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
  if (dom.storeScheduleFilter) {
    dom.storeScheduleFilter.value = state.storeScheduleFilter;
  }
  renderStoreSelect();
  renderRoleSelectors();
  renderAccuracyAccountFilter();
  syncAccuracyFilterToSelectedStore();
  renderEmployeeList();
  renderComparePlanner();
  refreshStoreContextPanels();
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

function createAnalyticsYieldController() {
  // Headless precompute has no interactive UI to keep responsive. Longer work
  // slices avoid thousands of zero-delay timers while still letting DevTools
  // observe progress and completion.
  return createUiYieldController(PRECOMPUTE_ANALYTICS_MODE ? 250 : 10);
}

async function scheduleDeferredAnalytics() {
  if (state.analyticsReady || state.analyticsScheduled || !state.jobs.length) {
    hideComputeWaitOverlay();
    renderAccuracyReport();
    if (PRECOMPUTE_ANALYTICS_MODE && state.analyticsReady) {
      finishAnalyticsPrecompute(
        true,
        buildAnalyticsSnapshot(state.dataFingerprint),
      );
    }
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
    await calibrateDurationModel();
    await persistAnalyticsCache(state.dataFingerprint);
    state.analyticsReady = true;
    if (dom.computeAccuracyBtn) {
      dom.computeAccuracyBtn.disabled = true;
      dom.computeAccuracyBtn.textContent = "Accuracy Ready";
    }
    renderAccuracyReport();
    updateResults();
    if (PRECOMPUTE_ANALYTICS_MODE) {
      finishAnalyticsPrecompute(
        true,
        buildAnalyticsSnapshot(state.dataFingerprint),
      );
    }
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
    if (PRECOMPUTE_ANALYTICS_MODE) {
      finishAnalyticsPrecompute(false, {
        message: _error?.message || "Accuracy processing failed.",
      });
    }
  } finally {
    state.analyticsScheduled = false;
    hideComputeWaitOverlay();
  }
}

function finishAnalyticsPrecompute(ok, payload) {
  const body = document.body || document.documentElement;
  const output = {
    ok: Boolean(ok),
    payload: payload || null,
  };
  body.innerHTML = `<pre id="analyticsPrecomputeOutput">${escapeHtml(
    JSON.stringify(output),
  )}</pre>`;
  window.__ANALYTICS_PRECOMPUTE_DONE__ = output;
}

function buildDurationEmployeeContext(rows) {
  const employees = buildEmployeeStats(rows);
  for (const mode of [true, false]) {
    const stats = buildEmployeeStats(rows.filter(row => row.isModas === mode));
    for (const [id, employee] of employees) {
      employee[mode ? "modasAccountStats" : "regularAccountStats"] = stats.get(id)?.accountStats || {};
    }
  }
  return {
    employees,
    global: { medianEmployeeSpeed: median(Array.from(employees.values()).map(e => e.avgPiecesPerHrGlobal).filter(v => v > 0)) },
    peerAccountEstimateCache: new Map(), modasMedianCache: new Map(),
  };
}

function durationRateResolver(context) {
  const cache = new Map();
  return (id, account, inventoryMode, useRecentAccountProduction = false) => {
    const key = JSON.stringify([id, account, inventoryMode, useRecentAccountProduction]);
    if (cache.has(key)) return cache.get(key);
    const employee = context.employees.get(id);
    const source = getEmployeePlanningSpeedSource(employee, account, inventoryMode, context);
    const direct = typeof inventoryMode === "boolean" ? employee?.[inventoryMode ? "modasAccountStats" : "regularAccountStats"]?.[getLinkedAccountKey(account)] : null;
    const ageDays = direct?.lastObservedDate && context.asOfDate ? Math.max(0, (Date.parse(context.asOfDate) - Date.parse(direct.lastObservedDate)) / 86400000) : 0;
    const result = {
      speed: resolveEmployeePlanningBaseSpeed(employee, account, { inventoryMode, useRecentAccountProduction, employeeContext: context }),
      known: Boolean(employee?.globalJobCount > 0 && source.source !== "globalMedian"),
      evidence: direct?.jobCount > 0 ? Math.min(1, direct.jobCount / 5) * Math.pow(0.5, ageDays / 180) : 0,
    };
    cache.set(key, result);
    return result;
  };
}

async function buildDurationReplayRecords(rows, jobs, maybeYield = async () => {}) {
  const history = DurationModel.createHistory();
  const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const sortedJobs = [...jobs].sort((a, b) => a.date.localeCompare(b.date));
  const records = [];
  let rowEnd = 0, jobIndex = 0;
  let contextCutoff = "", rateFor = null;
  while (jobIndex < sortedJobs.length) {
    const date = sortedJobs[jobIndex].date;
    const cutoff = DurationModel.weekStart(date);
    while (rowEnd < sortedRows.length && sortedRows[rowEnd].date < cutoff) rowEnd++;
    // Freeze ALL history/rates at Monday for every job in that week. Receiving
    // day is not known retrospectively; real archive receipt times are separate.
    if (contextCutoff !== cutoff) {
      const context = buildDurationEmployeeContext(sortedRows.slice(0, rowEnd));
      context.asOfDate = cutoff;
      rateFor = durationRateResolver(context);
      contextCutoff = cutoff;
    }
    let next = jobIndex;
    while (next < sortedJobs.length && sortedJobs[next].date === date) {
      const job = sortedJobs[next++];
      if (!(job.duration > 0)) continue;
      const input = DurationModel.prepare(history, { ...DurationModel.historicalPlan(job), historyCutoff: cutoff }, rateFor);
      if (input) records.push({
        date, historyCutoff: cutoff, storeKey: job.storeKey, account: job.account, accountKey: job.accountKey,
        label: `${job.account} | ${job.storeName}`, actual: job.duration, input,
      });
    }
    // Reveal outcomes only AFTER predicting every job on this date.
    for (let i = jobIndex; i < next; i++) DurationModel.addJob(history, sortedJobs[i]);
    jobIndex = next;
    await maybeYield();
  }
  return records;
}

async function calibrateDurationModel() {
  const records = await buildDurationReplayRecords(state.rows, state.jobs, createAnalyticsYieldController());
  const analytics = DurationModel.analyze(records, state.jobs);
  delete analytics.testRecords;
  state.durationAnalytics = analytics;
  state.backtestMetrics = analytics.testMetrics;
  state.accuracyCache = analytics.accuracyCache;
}

function getDurationPlanningDate(storeKey) {
  const scheduled = getPrimaryScheduleForStore(storeKey)?.date;
  const today = getLocalDateStamp();
  return scheduled && scheduled > today ? scheduled : today;
}

function getDurationRateResolver(date) {
  if (!state.durationContextCache.has(date)) {
    const context = buildDurationEmployeeContext(state.rows.filter(row => row.date < date));
    context.asOfDate = getLocalDateStamp();
    state.durationContextCache.set(date, durationRateResolver(context));
  }
  return state.durationContextCache.get(date);
}

function makeDurationPlan(storeKey, crewIds, roles, modes, options = {}) {
  const store = state.stores.get(storeKey);
  if (!store) return null;
  return {
    date: options.date || getDurationPlanningDate(storeKey),
    storeKey, accountKey: store.accountKey || getLinkedAccountKey(store.account),
    typeOfInv: normalizeInventoryType(getPrimaryScheduleForStore(storeKey)?.typeOfInv || store.primaryType || "Unknown"),
    inventoryMode: options.inventoryMode === undefined ? getStoreModasMode(storeKey) : options.inventoryMode,
    employees: uniqueStrings(crewIds), roles, modes,
    useRecentAccountProduction: Boolean(options.useRecentAccountProduction),
    shrink: { percent: options.productionShrinkPercent || 0, mode: options.productionShrinkMode || "none", employeeIds: options.productionShrinkEmployeeIds || [] },
  };
}

function predictIncumbentDurationPlan(plan, options = {}) {
  if (!plan) return null;
  const analytics = state.durationAnalytics;
  const config = options.config || analytics?.byAccount?.[plan.accountKey] || analytics?.config || DurationModel.DEFAULT_CONFIG;
  const prediction = DurationModel.predict(
    options.history || state.durationHistory || DurationModel.createHistory(state.jobs),
    plan, options.rateFor || getDurationRateResolver(plan.date), config,
  );
  if (!prediction) return null;
  const storeErrors = analytics?.errorByStore?.[plan.storeKey];
  const accountErrors = analytics?.errorByAccount?.[plan.accountKey];
  const errors = storeErrors?.count >= 20 ? storeErrors : accountErrors?.count >= 40 ? accountErrors : analytics?.errorGlobal;
  const fallback = prediction.baseDuration * 0.25;
  const low = errors?.count >= 20 ? errors.p10 : -fallback;
  const high = errors?.count >= 20 ? errors.p90 : fallback;
  return {
    ...prediction, plan,
    confidenceLow: Math.max(0, Math.min(prediction.onSiteDuration, prediction.onSiteDuration + low)),
    confidenceHigh: Math.max(prediction.onSiteDuration, prediction.onSiteDuration + high),
    rangeSampleCount: errors?.count || 0,
    rangeMethod: errors?.count >= 20 ? "earlier-calibration" : "sparse-history-heuristic",
  };
}

function setFullOnsiteEnabled(enabled) {
  state.fullOnsiteEnabled = Boolean(enabled);
  updateResults();
}

function predictDurationPlan(plan, options = {}) {
  const incumbent = predictIncumbentDurationPlan(plan, options);
  if (!plan || !incumbent) return incumbent;
  let candidate = null;
  if (state.fullOnsiteData && typeof FullOnsiteModel !== "undefined") {
    const cutoff = plan.historyCutoff || plan.date;
    if (!state.fullOnsiteContexts.has(cutoff)) state.fullOnsiteContexts.set(cutoff, FullOnsiteModel.context(state.fullOnsiteData, cutoff));
    candidate = FullOnsiteModel.predict(state.fullOnsiteData, plan, state.fullOnsiteData.config, state.fullOnsiteContexts.get(cutoff));
  }
  const old = { ...incumbent, modelVersion: DurationModel.VERSION, target: "recorded-attendance-proxy", pairedFullOnsite: candidate };
  if (!state.fullOnsiteEnabled || !candidate) return { ...old, fullOnsiteFallback: state.fullOnsiteEnabled ? (state.fullOnsiteLoadError || "Insufficient full-attendance history; showing the existing attendance-proxy estimate.") : null };
  return { ...candidate, incumbentComparison: { modelVersion: DurationModel.VERSION, predictedDuration: incumbent.onSiteDuration, target: "recorded-attendance-proxy" }, pairedFullOnsite: candidate };
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
  const filtered = state.storesList
    .filter((store) =>
      `${store.account} ${store.storeName}`.toLowerCase().includes(query),
    )
    .filter((store) =>
      matchesScheduleFilter(store.scheduleRows, state.storeScheduleFilter),
    )
    .sort((left, right) => {
      if (state.storeScheduleFilter === "all") {
        const leftLabel = `${left.account} ${left.storeName}`.toLowerCase();
        const rightLabel = `${right.account} ${right.storeName}`.toLowerCase();
        return leftLabel.localeCompare(rightLabel);
      }

      const leftSchedule = getPrimaryScheduleForStore(left.storeKey);
      const rightSchedule = getPrimaryScheduleForStore(right.storeKey);
      const byDate = cleanText(leftSchedule?.date).localeCompare(
        cleanText(rightSchedule?.date),
      );
      if (byDate !== 0) return byDate;
      const byTime =
        parseScheduleTimeToMinutes(leftSchedule?.startTimeText) -
        parseScheduleTimeToMinutes(rightSchedule?.startTimeText);
      if (byTime !== 0) return byTime;
      return `${left.account} ${left.storeName}`.localeCompare(
        `${right.account} ${right.storeName}`,
      );
    });

  dom.storeSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Select Store --";
  dom.storeSelect.appendChild(placeholder);

  filtered.forEach((store) => {
    const option = document.createElement("option");
    option.value = store.storeKey;
    option.textContent = `${store.account} | ${store.storeName}`;
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
  const matchedScheduledStores = state.scheduleByStoreKey.size;
  const filterLabel = formatScheduleFilterLabel(state.storeScheduleFilter);
  dom.storeSelectMeta.textContent = selected
    ? `${filterLabel}: showing ${filtered.length} of ${state.storesList.length} stores. Scheduled matches: ${matchedScheduledStores}. Selected: ${selected.account} | ${selected.storeName}`
    : `${filterLabel}: showing ${filtered.length} of ${state.storesList.length} stores. Scheduled matches: ${matchedScheduledStores}.`;
  if (!storeChanged) refreshStoreContextPanels();
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
  refreshStoreContextPanels();
  updateResults();
  renderAccuracyReport();
}

function resetPlanInputsForNewStore() {
  state.selectedEmployees.clear();
  state.visibleEmployees = [];
  dom.employeeFilter.value = "";
  setEmployeeBulkStatus("");

  state.planningMode = "duration";
  state.targetValue = 0;
  state.productionShrinkPercent = 0;
  state.productionShrinkMode = "all";
  state.productionShrinkEmployeeIds = new Set();
  state.useRecentAccountProduction = false;
  dom.planningMode.value = state.planningMode;
  dom.targetValue.value = "";
  if (dom.productionShrinkPercent) dom.productionShrinkPercent.value = "";
  if (dom.productionShrinkMode) dom.productionShrinkMode.value = "all";
  if (dom.useRecentAccountProduction)
    dom.useRecentAccountProduction.checked = false;
  renderProductionShrinkEmployees();
  applyScheduledGoalDefault(true);

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
  refreshStoreContextPanels();
  persistToStorage();
  renderEmployeeList();
  updateResults();
  renderAccuracyReport();
}

function clearAllCardsAndPreview() {
  dom.predDuration.textContent = "-";
  dom.predManHours.textContent = "-";
  dom.predBand.textContent = "-";
  dom.predDelta.textContent = "-";
  setRecommendationStatus("Select Store", "info");
  applyMetricTone("info");
  setPredictionMeta(
    state.selectedStoreKey
      ? "Store changed. Re-select crew and roles to view a new plan."
      : "Select a store to begin.",
  );
  dom.scenarioBody.innerHTML =
    '<tr><td colspan="5" class="muted">No staffing ranking available yet.</td></tr>';
  renderDetailedBackground([]);
  dom.storeAccuracySummary.textContent =
    "Select a store and configure a crew to view store accuracy.";
  dom.accuracySummary.textContent =
    "Select a store and configure a crew to view the accuracy snapshot.";
  dom.accuracyWorstBody.innerHTML = "";
  dom.storeStats.textContent = state.selectedStoreKey
    ? "Store selected. Configure crew and roles to view plan cards."
    : "Select a store to view schedule and historical context.";
}

function toggleCompareSection() {
  const collapsed = dom.compareSection.classList.toggle("is-collapsed");
  dom.compareToggleBtn.textContent = collapsed ? "Expand" : "Collapse";
  renderComparePlanner();
}

function onCompareInputChange() {
  setCompareBulkStatus("");
  state.compareAssignment.storeAInput = cleanText(
    dom.compareStoreA.value || "",
  );
  state.compareAssignment.storeBInput = cleanText(
    dom.compareStoreB.value || "",
  );
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
  state.compareAssignment.supervisorA = cleanText(
    dom.compareSupervisorA.value || "",
  );
  state.compareAssignment.supervisorB = cleanText(
    dom.compareSupervisorB.value || "",
  );
  state.compareAssignment.roleModes.supervisorA = parseContributionMode(
    dom.compareSupervisorModeA.value,
  );
  state.compareAssignment.roleModes.supervisorB = parseContributionMode(
    dom.compareSupervisorModeB.value,
  );
  state.compareAssignment.roleModes.rx = parseContributionMode(
    dom.compareRxMode.value,
  );
  state.compareAssignment.roleModes.training = parseContributionMode(
    dom.compareTrainingMode.value,
  );
  state.compareAssignment.roleModes.earlyLate = parseContributionMode(
    dom.compareEarlyLateMode.value,
  );
  state.compareAssignment.sharedRoles.rx = getRoleChecklistValues(
    dom.compareRxEmployee,
  );
  state.compareAssignment.sharedRoles.training = getRoleChecklistValues(
    dom.compareTrainingEmployee,
  );
  state.compareAssignment.sharedRoles.earlyLate = getRoleChecklistValues(
    dom.compareEarlyLateEmployee,
  );
  if (!compareNeedsRxRole()) {
    state.compareAssignment.sharedRoles.rx = [];
  }
  state.compareAssignment.linkedPairsInput = String(
    dom.compareLinkedPairs.value || "",
  );
  state.compareAssignment.lockedStoreAInput = String(
    dom.compareLockedStoreA.value || "",
  );
  state.compareAssignment.lockedStoreBInput = String(
    dom.compareLockedStoreB.value || "",
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
  dom.compareLinkedPairs.value = cfg.linkedPairsInput || "";
  dom.compareLockedStoreA.value = cfg.lockedStoreAInput || "";
  dom.compareLockedStoreB.value = cfg.lockedStoreBInput || "";

  const available = getCompareAvailableEmployeeIds(cfg.storeA, cfg.storeB);
  const availableSet = new Set(available);
  cfg.availableEmployees = new Set(
    Array.from(cfg.availableEmployees || []).filter((id) =>
      availableSet.has(id),
    ),
  );
  const showCompareRx = compareNeedsRxRole();
  cfg.sharedRoles.rx = showCompareRx
    ? filterToSelected(cfg.sharedRoles.rx, cfg.availableEmployees)
    : [];
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
  dom.compareRxRoleGroup?.classList.toggle("is-hidden", !showCompareRx);
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
  const compareCollapsed =
    dom.compareSection?.classList.contains("is-collapsed");
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
  const constraintInfo = resolveCompareConstraints(cfg, selected);
  const constraintsValid = constraintInfo.issues.length === 0;
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
    (isRxRoleRequiredForStore(storeA) ? 1 : 0) +
    (isRxRoleRequiredForStore(storeB) ? 1 : 0);
  const rxAssignedCount = sharedRoles.rx.length;
  const rxAssignmentsEnough = rxAssignedCount >= rxRequiredCount;
  const canSuggest =
    storesDifferent &&
    goalsSet &&
    selectedCount > 0 &&
    supervisorsDifferent &&
    supervisorsInPool &&
    rxAssignmentsEnough &&
    constraintsValid;

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
  } else if (!constraintsValid) {
    metaMessage = constraintInfo.issues.join(" ");
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
    constraints: constraintInfo.constraints,
    constraintsValid,
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
  return getSchedulableEmployeeIds();
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
  setCompareBulkStatus("");
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
    .sort((a, b) => compareEmployeesByDisplayName(a.employee, b.employee))
    .filter((emp) => {
      const name = getEmployeeDisplayName(emp.employee);
      return matchesEmployeeQuery(emp.employee, filter, name);
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
      cfg.sharedRoles.rx = cfg.sharedRoles.rx.filter((id) =>
        cfg.availableEmployees.has(id),
      );
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
  const bulk = resolveBulkEmployeeSelection(
    query,
    getCompareAvailableEmployeeIds(
      state.compareAssignment.storeA,
      state.compareAssignment.storeB,
    ),
  );
  if (bulk.entries.length > 1) {
    bulk.matchedIds.forEach((id) =>
      state.compareAssignment.availableEmployees.add(id),
    );
    dom.compareEmployeeFilter.value = "";
    renderComparePlanner();
    setCompareBulkStatus(
      formatBulkSelectionMessage(bulk, "names"),
      bulk.ambiguousEntries.length || bulk.unmatchedEntries.length
        ? "warning"
        : "success",
    );
    return;
  }
  const cfg = state.compareAssignment;
  const available = getCompareAvailableEmployeeIds(cfg.storeA, cfg.storeB);
  const matches = available.filter((id) => {
    return matchesEmployeeQuery(id, query, getEmployeeDisplayName(id));
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

function onCompareEmployeeFilterPaste(event) {
  const rawText = event?.clipboardData?.getData("text") || "";
  const bulk = resolveBulkEmployeeSelection(
    rawText,
    getCompareAvailableEmployeeIds(
      state.compareAssignment.storeA,
      state.compareAssignment.storeB,
    ),
  );
  if (bulk.entries.length <= 1) return;
  event.preventDefault();
  bulk.matchedIds.forEach((id) =>
    state.compareAssignment.availableEmployees.add(id),
  );
  dom.compareEmployeeFilter.value = "";
  renderComparePlanner();
  setCompareBulkStatus(
    formatBulkSelectionMessage(bulk, "names"),
    bulk.ambiguousEntries.length || bulk.unmatchedEntries.length
      ? "warning"
      : "success",
  );
}

async function suggestTwoStoreAssignment() {
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
  const fixedA = [supA];
  const fixedB = [supB];
  const unitBuild = buildEmployeeLinkedUnits(
    selected,
    fixedA,
    fixedB,
    plannerStatus.constraints,
  );
  if (unitBuild.error) {
    setCompareMeta(unitBuild.error, "warning");
    setCompareResultVisible(false);
    return;
  }
  const solveConfig = {
    storeA,
    storeB,
    baseA: unitBuild.baseA,
    baseB: unitBuild.baseB,
    supervisorA: supA,
    supervisorB: supB,
    sharedRoles,
    roleModes: cfg.roleModes,
    freeUnits: unitBuild.freeUnits,
    goalMode,
    goalA,
    goalB,
    constraints: plannerStatus.constraints,
  };
  let result = null;
  dom.compareSuggestBtn.disabled = true;
  showComputeWaitOverlay("Building suggested assignment...");
  await nextTick();
  try {
    const useBruteForce =
      solveConfig.freeUnits.length <= BRUTE_FORCE_COMPARE_UNIT_LIMIT;
    if (useBruteForce) {
      result = await solveTwoStoreByBruteForceAsync(
        solveConfig,
        (done, total) => {
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          showComputeWaitOverlay(
            `Building suggested assignment... ${pct}% (${done.toLocaleString()} of ${total.toLocaleString()} combinations)`,
          );
        },
      );
    } else {
      showComputeWaitOverlay(
        "Building suggested assignment (optimized mode)...",
      );
      await nextTick();
      result = solveTwoStoreGreedy(solveConfig);
    }
  } finally {
    hideComputeWaitOverlay();
    renderComparePlanner();
  }

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

function solveTwoStoreGreedy(config) {
  const seedPlans = buildGreedySeedPlans(config);
  let best = null;
  seedPlans.forEach((seed) => {
    const candidate = runGreedySeed(config, seed);
    if (!candidate) return;
    if (
      !best ||
      candidate.score < best.score ||
      (candidate.score === best.score && candidate.maxErr < best.maxErr)
    ) {
      best = candidate;
    }
  });
  return best;
}

async function solveTwoStoreByBruteForceAsync(config, onProgress) {
  const { freeUnits, baseA, baseB } = config;
  let best = null;
  const total = 1 << freeUnits.length;
  const batchSize = 1024;
  for (let batchStart = 0; batchStart < total; batchStart += batchSize) {
    const batchEnd = Math.min(total, batchStart + batchSize);
    for (let mask = batchStart; mask < batchEnd; mask += 1) {
      const crewA = [...baseA];
      const crewB = [...baseB];
      for (let i = 0; i < freeUnits.length; i += 1) {
        if (mask & (1 << i)) crewA.push(...freeUnits[i]);
        else crewB.push(...freeUnits[i]);
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
    if (typeof onProgress === "function") onProgress(batchEnd, total);
    await nextTick();
  }
  return best;
}

function buildGreedySeedPlans(config) {
  const freeUnits = Array.isArray(config.freeUnits) ? config.freeUnits : [];
  const baseA = new Set(config.baseA || []);
  const baseB = new Set(config.baseB || []);
  const rxPool = new Set(config.sharedRoles?.rx || []);
  const accountA = config.storeA?.account || "";
  const accountB = config.storeB?.account || accountA;
  const needsA =
    isRxRoleRequiredForStore(config.storeA) &&
    !Array.from(baseA).some((id) => rxPool.has(id));
  const needsB =
    isRxRoleRequiredForStore(config.storeB) &&
    !Array.from(baseB).some((id) => rxPool.has(id));
  const rxFreeUnits = freeUnits
    .map((members, index) => ({ index, members }))
    .filter((unit) => unit.members.some((id) => rxPool.has(id)));
  const rankedRxFree = [...rxFreeUnits]
    .sort((a, b) => {
      const score = (unit) =>
        unit.members.reduce(
          (sum, id) =>
            sum +
            displayEmployeeSpeed(state.employees.get(id), accountA) +
            displayEmployeeSpeed(state.employees.get(id), accountB),
          0,
        );
      return score(b) - score(a);
    })
    .slice(0, MAX_GREEDY_RX_SEED_CANDIDATES);

  if (!needsA && !needsB) return [{ assignA: [], assignB: [] }];
  if (needsA && !needsB) {
    return rankedRxFree.map((unit) => ({ assignA: [unit.index], assignB: [] }));
  }
  if (!needsA && needsB) {
    return rankedRxFree.map((unit) => ({ assignA: [], assignB: [unit.index] }));
  }

  const plans = [];
  for (let i = 0; i < rankedRxFree.length; i += 1) {
    for (let j = 0; j < rankedRxFree.length; j += 1) {
      if (i === j) continue;
      plans.push({
        assignA: [rankedRxFree[i].index],
        assignB: [rankedRxFree[j].index],
      });
    }
  }
  return plans;
}

function runGreedySeed(config, seed) {
  const { baseA, baseB } = config;
  const crewA = [...baseA];
  const crewB = [...baseB];
  const freeUnits = Array.isArray(config.freeUnits) ? config.freeUnits : [];
  const freeSet = new Set(freeUnits.map((_members, index) => index));

  (seed.assignA || []).forEach((unitIndex) => {
    if (!freeSet.has(unitIndex)) return;
    crewA.push(...(freeUnits[unitIndex] || []));
    freeSet.delete(unitIndex);
  });
  (seed.assignB || []).forEach((unitIndex) => {
    if (!freeSet.has(unitIndex)) return;
    crewB.push(...(freeUnits[unitIndex] || []));
    freeSet.delete(unitIndex);
  });

  const free = freeUnits
    .map((members, index) => ({ index, members }))
    .filter((unit) => freeSet.has(unit.index));
  free.forEach((unit) => {
    const scoredA = scoreTwoStoreAssignment(
      config,
      [...crewA, ...unit.members],
      crewB,
      { skipConstraintChecks: true },
    );
    const scoredB = scoreTwoStoreAssignment(
      config,
      crewA,
      [...crewB, ...unit.members],
      { skipConstraintChecks: true },
    );
    if (!scoredA && !scoredB) return;
    if (!scoredB || (scoredA && scoredA.score <= scoredB.score))
      crewA.push(...unit.members);
    else crewB.push(...unit.members);
  });

  let best = scoreTwoStoreAssignment(config, crewA, crewB);
  if (!best) return null;
  return best;
}

function scoreTwoStoreAssignment(config, crewA, crewB, options = {}) {
  if (
    !options.skipConstraintChecks &&
    !constraintsSatisfiedForAssignment(config.constraints, crewA, crewB)
  ) {
    return null;
  }
  const setA = new Set(crewA);
  const setB = new Set(crewB);
  const rolesA = {
    supervisor: config.supervisorA,
    rx: (config.sharedRoles.rx || []).filter((id) => setA.has(id)),
    training: (config.sharedRoles.training || []).filter((id) => setA.has(id)),
    earlyLate: (config.sharedRoles.earlyLate || []).filter((id) =>
      setA.has(id),
    ),
  };
  const rolesB = {
    supervisor: config.supervisorB,
    rx: (config.sharedRoles.rx || []).filter((id) => setB.has(id)),
    training: (config.sharedRoles.training || []).filter((id) => setB.has(id)),
    earlyLate: (config.sharedRoles.earlyLate || []).filter((id) =>
      setB.has(id),
    ),
  };
  if (isRxRoleRequiredForStore(config.storeA) && rolesA.rx.length === 0)
    return null;
  if (isRxRoleRequiredForStore(config.storeB) && rolesB.rx.length === 0)
    return null;
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
  const valueA =
    config.goalMode === "duration" ? predA.onSiteDuration : predA.manHours;
  const valueB =
    config.goalMode === "duration" ? predB.onSiteDuration : predB.manHours;
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
  const roles = { supervisor: cleanText(rolesConfig?.supervisor), rx: uniqueStrings(rolesConfig?.rx), training: uniqueStrings(rolesConfig?.training), earlyLate: uniqueStrings(rolesConfig?.earlyLate) };
  const crew = uniqueStrings(crewIds);
  if (!roles.supervisor || !crew.includes(roles.supervisor)) return null;
  if (![...roles.rx, ...roles.training, ...roles.earlyLate].every(id => crew.includes(id))) return null;
  return predictDurationPlan(makeDurationPlan(storeKey, crew, roles, modesConfig || {}));
}

function effectiveEmployeeSpeedForRoles(
  employee,
  account,
  employeeId,
  roles,
  modes,
  options = {},
) {
  const baseSpeed = resolveEmployeePlanningBaseSpeed(
    employee,
    account,
    options,
  );
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

function getEmployeeMostRecentAccountProduction(employee, account) {
  if (!employee) return { piecesPerHr: 0, storeName: "", account: "" };
  const accountKey = getLinkedAccountKey(account);
  const accountStat = accountKey ? employee.accountStats?.[accountKey] : null;
  const supervisorAccountStat = accountKey
    ? employee.supervisorAccountStats?.[accountKey]
    : null;
  const peerEstimate = getPeerAdjustedAccountEstimate(employee, accountKey);
  const piecesPerHr = safeNumber(accountStat?.mostRecentPiecesPerHr);
  const supervisorPiecesPerHr = safeNumber(
    supervisorAccountStat?.mostRecentPiecesPerHr,
  );
  return {
    piecesPerHr,
    storeName: accountStat?.mostRecentStoreName || "",
    storeKey: accountStat?.mostRecentStoreKey || "",
    account: accountStat?.mostRecentAccount || "",
    supervisorOnly: !(piecesPerHr > 0) && supervisorPiecesPerHr > 0,
    supervisorPiecesPerHr,
    supervisorJobCount: safeNumber(supervisorAccountStat?.jobCount),
    supervisorStoreName: supervisorAccountStat?.mostRecentStoreName || "",
    supervisorStoreKey: supervisorAccountStat?.mostRecentStoreKey || "",
    supervisorAccount: supervisorAccountStat?.mostRecentAccount || "",
    peerEstimate,
  };
}

function resolveEmployeePlanningBaseSpeed(employee, account, options = {}) {
  const inventoryMode = options.inventoryMode === null ? null :
    (options.inventoryMode ?? getStoreModasMode());
  const baseSpeed = getEmployeePlanningSpeedSource(employee, account, inventoryMode, options.employeeContext || state).speed;
  // Matching-mode history takes precedence over the latest mixed-mode record.
  const accountKey = getLinkedAccountKey(account);
  const matching = employee?.[inventoryMode ? "modasAccountStats" : "regularAccountStats"]?.[accountKey];
  if (inventoryMode === true || (inventoryMode !== null && matching?.jobCount > 0) || !options.useRecentAccountProduction) return baseSpeed;
  const recentPiecesPerHr = safeNumber(
    employee?.accountStats?.[accountKey]?.mostRecentPiecesPerHr,
  );
  if (
    recentPiecesPerHr > 0 &&
    baseSpeed > 0 &&
    recentPiecesPerHr !== baseSpeed
  ) {
    return recentPiecesPerHr;
  }
  return baseSpeed;
}

function buildStaffingRankRows(
  store,
  crewIds,
  roles,
  modes,
  onSiteDuration,
  options = {},
) {
  if (!store) return [];
  options = { ...options, inventoryMode: options.inventoryMode === undefined ? getStoreModasMode(store.storeKey) : options.inventoryMode };
  const predictedHours = Math.max(0, safeNumber(onSiteDuration));
  return (crewIds || [])
    .map((id) => {
      const employee = state.employees.get(id);
      const originalBaseSpeed = getEmployeePlanningSpeedSource(employee, store.account, options.inventoryMode).speed;
      const baseSpeed = resolveEmployeePlanningBaseSpeed(
        employee,
        store.account,
        options,
      );
      const effectiveSpeed = effectiveEmployeeSpeedForRoles(
        employee,
        store.account,
        id,
        roles,
        modes,
        options,
      );
      const productionShrinkFactor = getEmployeeProductionShrinkFactor(
        id,
        options.productionShrinkMode,
        new Set(options.productionShrinkEmployeeIds || []),
        safeNumber(options.productionShrinkFactor) || 1,
      );
      const adjustedEffectiveSpeed = effectiveSpeed * productionShrinkFactor;
      const mostRecentAccountProduction =
        getEmployeeMostRecentAccountProduction(employee, store.account);
      return {
        id,
        originalBaseSpeed,
        baseSpeed,
        effectiveSpeed: adjustedEffectiveSpeed,
        mostRecentAccountProduction,
        predictedPieces: adjustedEffectiveSpeed * predictedHours,
      };
    })
    .filter((row) => row.baseSpeed > 0 || row.effectiveSpeed > 0)
    .sort(
      (a, b) =>
        b.predictedPieces - a.predictedPieces || b.baseSpeed - a.baseSpeed,
    );
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
  const rankedA = buildStaffingRankRows(
    storeA,
    result.crewA,
    rolesA,
    modesA,
    result.predA.onSiteDuration,
  );
  const rankedB = buildStaffingRankRows(
    storeB,
    result.crewB,
    rolesB,
    modesB,
    result.predB.onSiteDuration,
  );
  dom.compareResult.innerHTML = `<div class="compare-result">
    <article class="compare-store-block">
      <h4 class="compare-store-title">${escapeHtml(getStoreDisplayLabel(storeA) || "Store A")}</h4>
      <div class="cards compare-store-cards">
        <article class="card">
          <h3>Estimated In-Store Time</h3>
          <p class="value">${formatNumber(result.predA.onSiteDuration, 1)} hrs</p>
        </article>
        <article class="card">
          <h3>Estimated Man-Hours</h3>
          <p class="value">${formatNumber(result.predA.manHours, 1)} man-hours</p>
        </article>
        <article class="card">
          <h3>Likely On-Site Range</h3>
          <p class="value">${formatNumber(result.predA.confidenceLow, 1)} - ${formatNumber(result.predA.confidenceHigh, 1)} hrs</p>
        </article>
        <article class="card">
          <h3>Difference From Goal</h3>
          <p class="value">${formatSigned(deltaA, 1)} ${unit}</p>
        </article>
      </div>
      <table class="compare-rank-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Employee</th>
            <th>Predicted Production (pieces/hr)</th>
            <th>Predicted Total Pieces</th>
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
          <p class="value">${formatNumber(result.predB.onSiteDuration, 1)} hrs</p>
        </article>
        <article class="card">
          <h3>Estimated Man-Hours</h3>
          <p class="value">${formatNumber(result.predB.manHours, 1)} man-hours</p>
        </article>
        <article class="card">
          <h3>Likely On-Site Range</h3>
          <p class="value">${formatNumber(result.predB.confidenceLow, 1)} - ${formatNumber(result.predB.confidenceHigh, 1)} hrs</p>
        </article>
        <article class="card">
          <h3>Difference From Goal</h3>
          <p class="value">${formatSigned(deltaB, 1)} ${unit}</p>
        </article>
      </div>
      <table class="compare-rank-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Employee</th>
            <th>Predicted Production (pieces/hr)</th>
            <th>Predicted Total Pieces</th>
          </tr>
        </thead>
        <tbody>${renderCompareRankRows(rankedB)}</tbody>
      </table>
    </article>
  </div>`;
}

function renderCompareRankRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="4" class="muted">No valid speed data for assigned crew.</td></tr>';
  }
  return rows
    .map(
      (row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(getEmployeeDisplayName(row.id))}</td>
        <td>${formatNumber(row.baseSpeed, 1)}</td>
        <td>${formatNumber(row.predictedPieces, 0)}</td>
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
  const showRxRole = selectedStoreNeedsRxRole(storeKey);

  if (!showRxRole && roles.rx.length) {
    roles.rx = [];
    state.selectedRolesByStore[storeKey] = roles;
  }

  renderRoleEmployeeSelect(
    dom.supervisorEmployee,
    sortedSelected,
    true,
    roles.supervisor,
    "Select supervisor",
    false,
  );
  dom.rxRoleCard?.classList.toggle("is-hidden", !showRxRole);
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
    rx: selectedStoreNeedsRxRole(storeKey)
      ? normalizeRoleArray(current.rx)
      : [],
    training: normalizeRoleArray(current.training),
    earlyLate: normalizeRoleArray(current.earlyLate),
  };
}

function selectedStoreNeedsRxRole(storeKey) {
  if (!storeKey) return false;
  return isRxRoleRequiredForStore(state.stores.get(storeKey));
}

function compareNeedsRxRole() {
  const cfg = state.compareAssignment;
  const storeA = state.stores.get(cfg.storeA);
  const storeB = state.stores.get(cfg.storeB);
  return isRxRoleRequiredForStore(storeA) || isRxRoleRequiredForStore(storeB);
}

function syncRoleAssignmentsToSelectedCrew() {
  const storeKey = state.selectedStoreKey;
  if (!storeKey) return;

  const selectedSet = new Set(Array.from(state.selectedEmployees));
  const roles = getRoleSelectionForStore(storeKey);

  if (!selectedSet.has(roles.supervisor)) {
    roles.supervisor = "";
  }

  roles.rx = selectedStoreNeedsRxRole(storeKey)
    ? filterToSelected(roles.rx, selectedSet)
    : [];
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

function getContributionModeShortLabel(mode) {
  if (mode === "full") return "100%";
  if (mode === "none") return "0%";
  if (mode === "p30") return "30%";
  if (mode === "p50") return "50%";
  return "70%";
}

function renderStoreStats() {
  const store = state.stores.get(state.selectedStoreKey);
  if (!store) {
    dom.storeStats.textContent =
      "Select a store to see schedule and store history.";
    return;
  }
  const schedule = getPrimaryScheduleForStore(store.storeKey);
  const noteRows = [];
  if (schedule?.storeNotes)
    noteRows.push(renderBriefItem("Store Notes", schedule.storeNotes));
  if (schedule?.notes)
    noteRows.push(renderBriefItem("Schedule Notes", schedule.notes));
  const prediction = state.analyticsReady ? predict() : null;
  const finishTime =
    schedule && prediction
      ? estimateScheduleFinishTime(
          schedule.startTimeText,
          prediction.onSiteDuration,
        )
      : "";

  dom.storeStats.innerHTML = `
    <div class="store-brief">
      <section class="brief-section">
        <div class="brief-section-title">Scheduled Job</div>
        ${
          schedule
            ? `
          <div class="brief-grid">
            ${renderBriefItem("Scheduled Date", formatLongDate(schedule.date))}
            ${renderBriefItem("Start Time", schedule.startTimeText || "Not listed")}
            ${finishTime ? renderBriefItem("Finish Time", finishTime) : ""}
            ${renderBriefItem("Customer Number", formatCustomerNumber(schedule.customerNumber))}
            ${renderBriefItem("Address", formatScheduleAddress(schedule))}
            ${renderBriefItem("Phone", schedule.phone || "Not listed")}
            ${renderBriefItem("Map", schedule.mapLink ? `<a class="brief-link" href="${escapeHtml(schedule.mapLink)}" target="_blank" rel="noopener noreferrer">Open map</a>` : "Not listed", true)}
            ${renderBriefItem("Scheduled On", schedule.dateScheduled || "Not listed")}
          </div>
          ${noteRows.length ? `<div class="brief-grid brief-note">${noteRows.join("")}</div>` : ""}
        `
            : `
          <div class="brief-value muted">No linked schedule row found for this store.</div>
        `
        }
      </section>
    </div>
  `;
}

function renderLastCrewSummary() {
  if (!dom.lastCrewSummary) return;
  const store = state.stores.get(state.selectedStoreKey);
  if (!store) {
    dom.lastCrewSummary.textContent = "Select a store to view the last crew.";
    return;
  }

  const lastJob = getMostRecentJobForStore(store.storeKey);
  const lastCrew = uniqueStrings(lastJob?.employees || state.storeLastCrew.get(store.storeKey) || []);
  if (!lastCrew.length) {
    dom.lastCrewSummary.textContent =
      "No previous crew found for this store yet.";
    return;
  }

  const employeeRows = buildLastCrewEmployeeRows(lastJob, lastCrew);
  const totalPiecesPerHr = employeeRows.reduce(
    (sum, row) => sum + safeNumber(row.piecesPerHr),
    0,
  );
  const totalPieces = employeeRows.reduce(
    (sum, row) => sum + safeNumber(row.pieces),
    0,
  );
  const supervisorId = cleanText(
    lastJob?.supervisorNumber || state.storeLastSupervisor.get(store.storeKey),
  );
  const supervisorName = supervisorId
    ? getEmployeeDisplayName(supervisorId)
    : "Not available";
  dom.lastCrewSummary.innerHTML = `
    <p class="last-crew-supervisor"><strong>Supervisor:</strong> ${escapeHtml(supervisorName)}</p>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Employee</th>
          <th>Pieces/Hr</th>
          <th>In-Store Time</th>
          <th>Pieces</th>
        </tr>
      </thead>
      <tbody>
        ${employeeRows.map(renderLastCrewEmployeeRow).join("")}
        <tr>
          <td></td>
          <td><strong>Grand Total Available</strong></td>
          <td><strong>${formatNumber(totalPiecesPerHr, 0)} pieces/hr</strong></td>
          <td class="muted">Per-employee total</td>
          <td><strong>${totalPieces > 0 ? formatNumber(totalPieces, 0) : "Not available"}</strong></td>
        </tr>
      </tbody>
    </table>
    ${renderLastCrewDataNotice()}
  `;
}

function buildLastCrewEmployeeRows(lastJob, lastCrew) {
  const details = new Map(
    (lastJob?.employeeDetails || []).map((detail) => [detail.employee, detail]),
  );
  return uniqueStrings(lastCrew || [])
    .map((employeeId) => {
      const detail = details.get(employeeId) || {};
      return {
        employee: employeeId,
        displayName: getEmployeeDisplayName(employeeId),
        piecesPerHr: safeNumber(detail.piecesPerHr),
        inStoreHours: safeNumber(detail.inStoreHours),
        pieces: safeNumber(detail.pieces),
      };
    })
    .sort(
      (a, b) =>
        safeNumber(b.piecesPerHr) - safeNumber(a.piecesPerHr) ||
        safeNumber(b.pieces) - safeNumber(a.pieces) ||
        compareEmployeesByDisplayName(a.employee, b.employee),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function renderLastCrewEmployeeRow(row) {
  return `
    <tr>
      <td>${row.rank}</td>
      <td>${escapeHtml(row.displayName)}</td>
      <td>${row.piecesPerHr > 0 ? `${formatNumber(row.piecesPerHr, 0)} pieces/hr` : "Not available"}</td>
      <td>${row.inStoreHours > 0 ? `${formatNumber(row.inStoreHours, 1)} hrs` : "Not available"}</td>
      <td>${row.pieces > 0 ? formatNumber(row.pieces, 0) : "Not available"}</td>
    </tr>
  `;
}

function getMostRecentJobForStore(storeKey) {
  return (state.jobs || [])
    .filter((job) => job.storeKey === storeKey)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

function renderBriefItem(label, value, isHtml = false) {
  const safeValue = isHtml ? value : escapeHtml(String(value || "Not listed"));
  return `
    <div class="brief-item">
      <span class="brief-label">${escapeHtml(label)}</span>
      <span class="brief-value">${safeValue}</span>
    </div>
  `;
}

function formatScheduleAddress(schedule) {
  const lineOne = cleanText(schedule?.address);
  const locality = [
    cleanText(schedule?.city),
    cleanText(schedule?.stateCode),
    cleanText(schedule?.zipcode),
  ]
    .filter(Boolean)
    .join(", ")
    .replace(", ,", ",");
  return [lineOne, locality].filter(Boolean).join(" | ") || "Not listed";
}

function formatCustomerNumber(value) {
  const raw = cleanText(value).replace(/[^A-Za-z0-9]/g, "");
  if (!raw) return "Not listed";
  const padded = raw.length >= 8 ? raw : raw.padStart(8, "0");
  return `${padded.slice(0, 4)}-${padded.slice(-4)}`;
}

function renderEmployeeList() {
  const filter = (dom.employeeFilter.value || "").trim().toLowerCase();
  const selectedAccount = getSelectedAccount();
  renderSelectedCrewChips();
  const employees = getSchedulableEmployeeIds()
    .map((id) => state.employees.get(id))
    .filter(Boolean)
    .sort((a, b) => compareEmployeesByDisplayName(a.employee, b.employee))
    .filter((e) => {
      const name = getEmployeeDisplayName(e.employee);
      return matchesEmployeeQuery(e.employee, filter, name);
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
      syncProductionShrinkSelectionToCrew();
      syncRoleAssignmentsToSelectedCrew();
      renderRoleSelectors();
      renderSelectedCrewChips();
      renderProductionShrinkEmployees();
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

function renderSelectedCrewChips() {
  if (!dom.selectedCrewChips) return;
  const selected = Array.from(state.selectedEmployees || [])
    .filter(Boolean)
    .sort(compareEmployeesByDisplayName);
  if (!selected.length) {
    dom.selectedCrewChips.textContent = "No crew selected.";
    dom.selectedCrewChips.classList.add("muted");
    return;
  }
  dom.selectedCrewChips.classList.remove("muted");
  dom.selectedCrewChips.innerHTML = selected
    .map(
      (id) =>
        `<span class="chip">${escapeHtml(getEmployeeDisplayName(id))}</span>`,
    )
    .join("");
}

function renderProductionShrinkEmployees() {
  if (!dom.productionShrinkEmployees) return;
  const mode = normalizeProductionShrinkMode(state.productionShrinkMode);
  syncProductionShrinkSelectionToCrew();
  dom.productionShrinkEmployees.classList.toggle(
    "is-hidden",
    mode !== "selected",
  );
  dom.productionShrinkEmployees.innerHTML = "";

  if (dom.productionShrinkHelp) {
    const percent = normalizeProductionShrinkPercent(
      state.productionShrinkPercent,
    );
    dom.productionShrinkHelp.textContent =
      mode === "none"
        ? "Production shrink is ignored for this plan."
        : mode === "selected"
          ? `Apply the ${formatNumber(percent, 0)}% shrink only to checked crew members.`
          : `Apply the ${formatNumber(percent, 0)}% shrink to every selected crew member.`;
  }

  if (mode !== "selected") return;

  const selected = Array.from(state.selectedEmployees || [])
    .filter(Boolean)
    .sort(compareEmployeesByDisplayName);
  if (!selected.length) {
    dom.productionShrinkEmployees.innerHTML =
      '<div class="muted">Select crew members first.</div>';
    return;
  }

  const shrinkSelected = new Set(state.productionShrinkEmployeeIds || []);
  const fragment = document.createDocumentFragment();
  selected.forEach((id) => {
    const row = document.createElement("label");
    row.className = "role-check-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = id;
    checkbox.checked = shrinkSelected.has(id);
    const text = document.createElement("span");
    text.textContent = getEmployeeDisplayName(id);
    row.appendChild(checkbox);
    row.appendChild(text);
    fragment.appendChild(row);
  });
  dom.productionShrinkEmployees.appendChild(fragment);
}

function getCheckedProductionShrinkEmployeeIds() {
  return Array.from(
    dom.productionShrinkEmployees?.querySelectorAll(
      'input[type="checkbox"]:checked',
    ) || [],
  )
    .map((el) => el.value)
    .filter(Boolean);
}

function syncProductionShrinkSelectionToCrew() {
  const selectedSet = new Set(state.selectedEmployees || []);
  state.productionShrinkEmployeeIds = new Set(
    Array.from(state.productionShrinkEmployeeIds || []).filter((id) =>
      selectedSet.has(id),
    ),
  );
}

function onEmployeeFilterKeyDown(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  setEmployeeBulkStatus("");

  const query = (dom.employeeFilter.value || "").trim().toLowerCase();
  if (!query) return;
  const bulk = resolveBulkEmployeeSelection(
    query,
    getSchedulableEmployeeIds(),
    getPrimaryScheduleForStore(),
  );
  if (bulk.entries.length > 1) {
    bulk.matchedIds.forEach((id) => state.selectedEmployees.add(id));
    syncProductionShrinkSelectionToCrew();
    const assignedSupervisor = assignFirstBulkSupervisorToSelectedStore(
      bulk.matchedIds,
    );
    applyBulkRoleHintsToSelectedStore(bulk);
    syncRoleAssignmentsToSelectedCrew();
    renderRoleSelectors();
    renderProductionShrinkEmployees();
    persistToStorage();
    dom.employeeFilter.value = "";
    renderEmployeeList();
    updateResults();
    setEmployeeBulkStatus(
      `${formatBulkSelectionMessage(bulk, "names")}${assignedSupervisor ? " First pasted name set as supervisor." : ""}`,
      bulk.ambiguousEntries.length || bulk.unmatchedEntries.length
        ? "warning"
        : "success",
    );
    return;
  }
  if (state.visibleEmployees.length === 0) return;

  const exactMatch = state.visibleEmployees.find((id) => {
    const name = getEmployeeDisplayName(id).toLowerCase();
    return name === query || id.toLowerCase() === query;
  });
  const chosen = exactMatch || state.visibleEmployees[0];
  if (!chosen) return;

  state.selectedEmployees.add(chosen);
  syncProductionShrinkSelectionToCrew();
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  renderProductionShrinkEmployees();
  persistToStorage();
  renderEmployeeList();
  updateResults();

  dom.employeeFilter.value = "";
  renderEmployeeList();
}

function onEmployeeFilterPaste(event) {
  const rawText = event?.clipboardData?.getData("text") || "";
  const bulk = resolveBulkEmployeeSelection(
    rawText,
    getSchedulableEmployeeIds(),
    getPrimaryScheduleForStore(),
  );
  if (bulk.entries.length <= 1) return;
  event.preventDefault();
  bulk.matchedIds.forEach((id) => state.selectedEmployees.add(id));
  syncProductionShrinkSelectionToCrew();
  const assignedSupervisor = assignFirstBulkSupervisorToSelectedStore(
    bulk.matchedIds,
  );
  applyBulkRoleHintsToSelectedStore(bulk);
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  renderProductionShrinkEmployees();
  persistToStorage();
  dom.employeeFilter.value = "";
  renderEmployeeList();
  updateResults();
  setEmployeeBulkStatus(
    `${formatBulkSelectionMessage(bulk, "names")}${assignedSupervisor ? " First pasted name set as supervisor." : ""}`,
    bulk.ambiguousEntries.length || bulk.unmatchedEntries.length
      ? "warning"
      : "success",
  );
}

function assignFirstBulkSupervisorToSelectedStore(employeeIds) {
  const storeKey = state.selectedStoreKey;
  if (!storeKey) return false;
  const firstId = cleanText((employeeIds || []).find(Boolean));
  if (!firstId) return false;
  const roles = getRoleSelectionForStore(storeKey);
  roles.supervisor = firstId;
  state.selectedRolesByStore[storeKey] = roles;
  return true;
}

function applyBulkRoleHintsToSelectedStore(bulk) {
  const storeKey = state.selectedStoreKey;
  if (!storeKey) return;
  const roles = getRoleSelectionForStore(storeKey);
  const selectedSet = new Set(Array.from(state.selectedEmployees));
  roles.rx = filterToSelected(
    [...roles.rx, ...(bulk?.rxIds || [])],
    selectedSet,
  );
  roles.training = filterToSelected(
    [...roles.training, ...(bulk?.trainingIds || [])],
    selectedSet,
  );
  roles.earlyLate = filterToSelected(
    [...roles.earlyLate, ...(bulk?.earlyLateIds || [])],
    selectedSet,
  );
  state.selectedRolesByStore[storeKey] = roles;
}

function onPlanningInputChange() {
  state.planningMode =
    dom.planningMode.value === "manhours" ? "manhours" : "duration";
  state.targetValue = Math.max(0, toNumber(dom.targetValue.value));
  state.productionShrinkPercent = normalizeProductionShrinkPercent(
    dom.productionShrinkPercent?.value,
  );
  state.productionShrinkMode = normalizeProductionShrinkMode(
    dom.productionShrinkMode?.value,
  );
  state.productionShrinkEmployeeIds = new Set(
    getCheckedProductionShrinkEmployeeIds(),
  );
  syncProductionShrinkSelectionToCrew();
  state.useRecentAccountProduction = Boolean(
    dom.useRecentAccountProduction?.checked,
  );
  renderProductionShrinkEmployees();
  persistToStorage();
  updateResults();
}

function toggleDetailedView() {
  state.detailedView = !state.detailedView;
  updateDetailedViewVisibility();
  updateResults();
}

function updateDetailedViewVisibility() {
  dom.detailBackgroundPanel?.classList.toggle("is-hidden", !state.detailedView);
  if (dom.detailModeBtn) {
    dom.detailModeBtn.classList.toggle("is-active", state.detailedView);
    dom.detailModeBtn.textContent = state.detailedView
      ? "Hide Details"
      : "Detailed View";
  }
}

function clearEmployees() {
  state.selectedEmployees.clear();
  syncProductionShrinkSelectionToCrew();
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  renderProductionShrinkEmployees();
  persistToStorage();
  setEmployeeBulkStatus("");
  renderEmployeeList();
  updateResults();
}

function selectVisibleEmployees() {
  state.visibleEmployees.forEach((name) => state.selectedEmployees.add(name));
  syncProductionShrinkSelectionToCrew();
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  renderProductionShrinkEmployees();
  persistToStorage();
  renderEmployeeList();
  updateResults();
}

function selectLastCrew() {
  const crew = state.storeLastCrew.get(state.selectedStoreKey) || [];
  const supervisor = cleanText(
    state.storeLastSupervisor.get(state.selectedStoreKey),
  );
  const allowed = new Set(getSchedulableEmployeeIds());
  const selected = new Set(
    uniqueStrings(crew).filter((employeeId) => allowed.has(employeeId)),
  );
  const activeSupervisor = allowed.has(supervisor) ? supervisor : "";
  if (activeSupervisor) selected.add(activeSupervisor);
  state.selectedEmployees = selected;
  syncProductionShrinkSelectionToCrew();

  const storeKey = state.selectedStoreKey;
  if (storeKey) {
    const currentRoles = getRoleSelectionForStore(storeKey);
    state.selectedRolesByStore[storeKey] = {
      ...currentRoles,
      supervisor: activeSupervisor || currentRoles.supervisor || "",
    };
  }
  syncRoleAssignmentsToSelectedCrew();
  renderRoleSelectors();
  renderProductionShrinkEmployees();
  persistToStorage();
  renderEmployeeList();
  updateResults();
}

function predict() {
  if (!state.analyticsReady) return null;
  const store = state.stores.get(state.selectedStoreKey);
  const roles = getRoleSelectionForStore(state.selectedStoreKey);
  const crew = Array.from(state.selectedEmployees);
  if (!store || !crew.length || !roles.supervisor || !crew.includes(roles.supervisor)) return null;
  if (isRxRoleRequiredForStore(store) && !roles.rx.some(id => crew.includes(id))) return null;
  const modes = getRoleModesForStore(state.selectedStoreKey);
  const options = {
    useRecentAccountProduction: state.useRecentAccountProduction,
    productionShrinkPercent: state.productionShrinkPercent,
    productionShrinkMode: state.productionShrinkMode,
    productionShrinkEmployeeIds: Array.from(state.productionShrinkEmployeeIds || []),
  };
  const prediction = predictDurationPlan(makeDurationPlan(store.storeKey, crew, roles, modes, options));
  if (!prediction) return null;
  return {
    ...prediction, ...options, account: store.account, storeName: store.storeName,
    productionShrinkFactor: getProductionShrinkFactor(state.productionShrinkPercent),
    roleAssignments: roles, roleModes: modes, crewEfficiency: 1,
    delta: computeDelta(prediction.onSiteDuration, prediction.manHours),
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

function normalizeProductionShrinkPercent(value) {
  const percent = toNumber(value);
  return Math.max(0, Math.min(100, percent));
}

function normalizeProductionShrinkMode(value) {
  return ["all", "selected", "none"].includes(value) ? value : "all";
}

function getProductionShrinkFactor(percent) {
  return Math.max(0.01, 1 - normalizeProductionShrinkPercent(percent) / 100);
}

function getEmployeeProductionShrinkFactor(
  employeeId,
  mode,
  selectedEmployeeIds,
  shrinkFactor,
) {
  const normalizedMode = normalizeProductionShrinkMode(mode);
  if (normalizedMode === "none") return 1;
  if (normalizedMode === "selected")
    return selectedEmployeeIds?.has(employeeId) ? shrinkFactor : 1;
  return shrinkFactor;
}

function computePredictionForJob(job, store, options = {}) {
  // The same kernel as live and two-store planning, with job-specific modes and roles.
  // Callers doing evaluation must supply the earlier history/rate context.
  return predictDurationPlan(DurationModel.historicalPlan(job), options);
}

function updateResults() {
  clearTimeout(forecastSaveTimer);
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
    setRecommendationStatus("Preparing", "info");
    applyMetricTone("info");
    const waitMessage = !state.isLoaded
      ? "Loading data..."
      : state.analyticsScheduled
        ? "Calibrating model and store accuracy. Predictions will appear automatically when complete."
        : "Model calibration is not ready. Click Compute Accuracy to retry.";
    setPredictionMeta(
      waitMessage,
      state.analyticsScheduled ? "info" : "warning",
    );
    renderStoreStats();
    renderScenarios(null);
    return;
  }

  const prediction = predict();

  if (!prediction) {
    dom.predDuration.textContent = "-";
    dom.predManHours.textContent = "-";
    dom.predBand.textContent = "-";
    dom.predDelta.textContent = "-";
    setRecommendationStatus(
      missingSupervisor || missingRxRole ? "Needs Roles" : state.selectedStoreKey ? "Choose Crew" : "Select Store",
      missingSupervisor || missingRxRole ? "caution" : "info",
    );
    applyMetricTone("info");
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
    renderStoreStats();
    renderScenarios(null);
    return;
  }

  dom.predDuration.textContent = `${formatNumber(prediction.onSiteDuration, 1)} hrs`;
  dom.predManHours.textContent = `${formatNumber(prediction.manHours, 1)} hrs`;
  dom.predBand.textContent = `${formatNumber(prediction.confidenceLow, 1)} - ${formatNumber(prediction.confidenceHigh, 1)} hrs`;
  dom.predDelta.textContent = formatDelta(prediction.delta);
  const recommendation = getRecommendationForPrediction(prediction);
  setRecommendationStatus(recommendation.label, recommendation.tone);
  applyMetricTone(recommendation.tone);

  setPredictionMeta(
    prediction.fullOnsiteFallback || (prediction.modelVersion === FullOnsiteModel.VERSION ? `Full physical visit, including review/recounts. ${prediction.matchingHistoryCount} prior visits; ${prediction.rangeMethod === "sparse-history-heuristic" ? "heuristic range" : "development error range"}. Planned crew and roles affect this estimate. Accuracy target not yet met.` : buildPlainEnglishEstimateReason(prediction)),
    "info",
  );
  renderStoreStats();
  renderScenarios(prediction);
  if (!PRECOMPUTE_ANALYTICS_MODE) {
    forecastSaveTimer = setTimeout(() => saveCurrentForecast(true), 1200);
    renderSavedForecastStatus();
  }
}

function setPredictionMeta(message, tone = "info") {
  dom.predictionMeta.textContent = message || "";
  const isWarning = tone === "warning";
  dom.predictionMeta.classList.toggle("meta-warning", isWarning);
  dom.predictionMeta.classList.toggle("meta-success", tone === "success");
}

function setRecommendationStatus(label, tone = "info") {
  if (!dom.recommendationStatus) return;
  dom.recommendationStatus.textContent = label;
  dom.recommendationStatus.className = `recommendation-status ${tone}`;
}

function applyMetricTone(tone = "info") {
  [dom.predDuration, dom.predManHours, dom.predBand, dom.predDelta].forEach(
    (el) => {
      const card = el?.closest(".metric-card");
      if (!card) return;
      card.classList.remove("status-success", "status-caution", "status-risk");
      if (tone === "success") card.classList.add("status-success");
      if (tone === "caution") card.classList.add("status-caution");
      if (tone === "risk") card.classList.add("status-risk");
    },
  );
}

function getRecommendationForPrediction(prediction) {
  const deltaValue = safeNumber(prediction?.delta?.value);
  if (!prediction?.delta?.available) {
    return { label: "Duration Estimate", tone: "info" };
  }
  const absDelta = Math.abs(deltaValue);
  const riskBand = prediction.delta.mode === "manhours" ? 2 : 0.5;
  if (absDelta <= riskBand) return { label: "On Target", tone: "success" };
  if (deltaValue > 0) return { label: "Estimate Exceeds Goal", tone: "risk" };
  return { label: "Ahead of Goal", tone: "success" };
}

function buildPlainEnglishEstimateReason(prediction) {
  const parts = [
    "This estimates on-site time including recounts and review, using recorded employee attendance as a proxy.",
    `The duration baseline is ${formatNumber(prediction.baseDuration, 1)} hrs from ${prediction.baselineSource}.`,
    `The planned crew changes this by ${formatSigned(prediction.crewAdjustmentHours, 1)} hrs; adjustments are limited because exported crews may be incomplete.`,
    `Planned labor assumes all ${prediction.crewSize} selected employees stay for the estimated duration.`,
    prediction.rangeMethod === "earlier-calibration" ? "The range uses earlier calibration errors (10th–90th percentiles); it is not guaranteed coverage." : "The range is a ±25% planning heuristic because earlier calibration history is sparse; it has no validated coverage.",
  ];
  if (!prediction.supervisorComparable) parts.push("Supervisor production is missing from some reference crews; those comparisons use counters on both sides.");
  if (!prediction.hasStoreHistory) parts.push("No earlier store visit is available; this estimate uses broader duration history without a crew adjustment.");
  if (prediction.config.elasticity === 0) parts.push("Earlier validation favored the duration baseline without a crew adjustment for this account.");
  return parts.join(" ");
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
    dom.scenarioBody.innerHTML = `<tr><td colspan="5" class="muted">No staffing ranking available yet.</td></tr>`;
    renderDetailedBackground([]);
    return;
  }

  const ranked = buildStaffingRankRows(
    state.stores.get(state.selectedStoreKey),
    Array.from(state.selectedEmployees),
    prediction.roleAssignments,
    prediction.roleModes,
    prediction.onSiteDuration,
    {
      useRecentAccountProduction: state.useRecentAccountProduction,
      productionShrinkMode: prediction.productionShrinkMode,
      productionShrinkEmployeeIds: prediction.productionShrinkEmployeeIds,
      productionShrinkFactor: prediction.productionShrinkFactor,
    },
  );

  if (ranked.length === 0) {
    dom.scenarioBody.innerHTML = `<tr><td colspan="5" class="muted">No valid speed data for selected crew.</td></tr>`;
    renderDetailedBackground([]);
    return;
  }

  renderDetailedBackground(ranked);
  ranked.forEach((item, index) => {
    const tr = document.createElement("tr");
    const varianceTone = getProductionVarianceTone(item);
    if (varianceTone) tr.classList.add(varianceTone);
    tr.innerHTML = [
      `<td>${index + 1}</td>`,
      `<td class="crew-production-employee"><span class="employee-name-line">${escapeHtml(getEmployeeDisplayName(item.id))}${renderProductionVarianceArrow(item)}</span>${renderProductionRoleBadges(item.id, prediction.roleAssignments, prediction.roleModes)}</td>`,
      `<td>${formatNumber(item.baseSpeed, 1)}</td>`,
      `<td>${escapeHtml(formatMostRecentAccountProduction(item.mostRecentAccountProduction))}</td>`,
      `<td>${formatNumber(item.predictedPieces, 0)}</td>`,
    ].join("");
    dom.scenarioBody.appendChild(tr);
  });
  dom.scenarioBody.insertAdjacentHTML(
    "beforeend",
    renderCurrentCrewTotalRow(ranked, prediction.onSiteDuration, prediction),
  );
}

function renderProductionRoleBadges(employeeId, roles = {}, modes = {}) {
  const badges = [];
  const addBadge = (roleKey, label) => {
    const mode = parseContributionMode(modes?.[roleKey]);
    badges.push(
      `<span class="role-indicator role-indicator-${roleKey}" title="${escapeHtml(`${label}: ${getContributionModeLabel(mode)}`)}">${escapeHtml(label)} <span>${escapeHtml(getContributionModeShortLabel(mode))}</span></span>`,
    );
  };

  if (roles?.supervisor === employeeId) addBadge("supervisor", "Supervisor");
  if (normalizeRoleArray(roles?.rx).includes(employeeId)) addBadge("rx", "RX");
  if (normalizeRoleArray(roles?.training).includes(employeeId))
    addBadge("training", "Training");
  if (normalizeRoleArray(roles?.earlyLate).includes(employeeId))
    addBadge("earlyLate", "Early/Late");

  if (!badges.length) return "";
  return `<div class="role-indicator-list" aria-label="Assigned roles">${badges.join("")}</div>`;
}

function renderCurrentCrewTotalRow(rankedRows, onSiteDuration, prediction = null) {
  const rawTotalPiecesPerHr = (rankedRows || []).reduce(
    (sum, item) => sum + safeNumber(item.effectiveSpeed || item.baseSpeed),
    0,
  );
  const totalPiecesPerHr = safeNumber(prediction?.crewSpeed) || rawTotalPiecesPerHr;
  const totalPredictedPieces = (rankedRows || []).reduce(
    (sum, item) => sum + safeNumber(item.predictedPieces),
    0,
  );
  const efficiency = safeNumber(prediction?.crewEfficiency);
  const efficiencyNote =
    efficiency > 0 && efficiency < 1
      ? `after ${formatNumber(efficiency * 100, 0)}% crew-size efficiency`
      : "role-adjusted total";
  return `
    <tr>
      <td></td>
      <td><strong>Grand Total Available</strong></td>
      <td><strong>${formatNumber(totalPiecesPerHr, 1)}</strong></td>
      <td class="muted">${escapeHtml(efficiencyNote)}</td>
      <td><strong>${formatNumber(totalPredictedPieces || totalPiecesPerHr * safeNumber(onSiteDuration), 0)}</strong></td>
    </tr>
  `;
}

function renderDetailedBackground(rankedRows = []) {
  if (!dom.detailBackgroundContent) return;
  const store = state.stores.get(state.selectedStoreKey);
  if (!store) {
    dom.detailBackgroundContent.textContent =
      "Select a store and crew to view source details.";
    return;
  }

  const segmentKey =
    state.storeSegmentByStoreKey.get(store.storeKey)?.segmentKey ||
    store.segmentKey ||
    `${store.accountKey || getLinkedAccountKey(store.account)}||S1`;
  const siblingStores = (state.storesList || [])
    .filter((candidate) => candidate.segmentKey === segmentKey)
    .sort((a, b) => a.storeName.localeCompare(b.storeName));
  const otherStoreNames = siblingStores
    .filter((candidate) => candidate.storeKey !== store.storeKey)
    .map((candidate) => `${candidate.account} | ${candidate.storeName}`);
  const rows = rankedRows.length
    ? rankedRows
    : Array.from(state.selectedEmployees || []).map((id) => {
        const employee = state.employees.get(id);
        const baseSpeed = resolveEmployeePlanningBaseSpeed(
          employee,
          store.account,
          { useRecentAccountProduction: state.useRecentAccountProduction },
        );
        return {
          id,
          baseSpeed,
          effectiveSpeed: baseSpeed,
          mostRecentAccountProduction: getEmployeeMostRecentAccountProduction(
            employee,
            store.account,
          ),
        };
      });
  const prediction = predict();

  dom.detailBackgroundContent.innerHTML = `
    <div class="detail-grid">
      <section>
        <h4>Recorded Production Segment (reference only)</h4>
        <p><strong>${escapeHtml(store.segmentId || "S1")}</strong> of ${formatNumber(getSegmentCountForAccount(store), 0)} segments for ${escapeHtml(store.account)}</p>
        <p class="muted">Segment key: ${escapeHtml(segmentKey)}</p>
        ${renderAccountSegmentBreakout(store)}
      </section>
      <section>
        <h4>Other Stores In This Segment</h4>
        ${
          otherStoreNames.length
            ? `<ul>${otherStoreNames.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`
            : `<p class="muted">No other stores are currently in this segment.</p>`
        }
      </section>
      <section>
        <h4>Store Baseline Source</h4>
        ${renderBaselineDetail(prediction)}
      </section>
      <section>
        <h4>Crew Adjustment</h4>
        ${renderPredictionDifferenceImpact(prediction)}
      </section>
      <section class="detail-wide">
        <h4>Modas vs Non-Modas Account Production</h4>
        <p>Planning as <strong>${getStoreModasMode() ? "Modas" : "Non-Modas"}</strong> for ${escapeHtml(store.account)}. Modas history gets 85% weight after one inventory, 90% after two, 95% after three or four, and 100% after five. With only Modas history, it gets 100%. Without Modas history, similar employees' Modas production on this account is used, then the account Modas median. If the account has no usable Modas history, existing estimates apply. Non-Modas plans retain the 80/20 weighting.</p>
        <p class="muted">History is classified using AVG_DELTA &gt; 0 for Modas. Speeds below blend recent and long-term production and exclude supervisor-assignment days. Matching history takes priority over the most recent production toggle. For Modas plans with fewer than five Modas inventories, the planning base is also pulled toward the account Modas median. This adjustment fades out at five inventories. Role and production shrink adjustments apply afterward.</p>
        ${rows.length ? `<div style="overflow-x: auto"><table>
          <thead><tr><th>Employee</th><th>Modas History</th><th>Non-Modas History</th><th>History Weighting</th><th>Planning Base</th></tr></thead>
          <tbody>${rows.map(row => renderEmployeeModasDetail(row, store)).join("")}</tbody>
        </table></div>` : `<p class="muted">Select crew members to compare their Modas and Non-Modas account history.</p>`}
      </section>
      <section class="detail-wide">
        <h4>Recent vs Long-Term Speed</h4>
        ${
          rows.length
            ? `<table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Recent Account</th>
                    <th>Long-Term Account</th>
                    <th>Used In Plan</th>
                    <th>Source Store</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows
                    .map((row) => {
                      const source = row.mostRecentAccountProduction || {};
                      const sourceStore = source.storeName
                        ? `${source.account || store.account} | ${source.storeName}`
                        : source.peerEstimate?.speed > 0
                          ? `${formatNumber(source.peerEstimate.peerCount, 0)} similar employees with account history`
                        : source.supervisorOnly && source.supervisorStoreName
                          ? `${source.supervisorAccount || store.account} | ${source.supervisorStoreName} (supervisor-only)`
                        : "No account history";
                      return `
                        <tr>
                          <td>${escapeHtml(getEmployeeDisplayName(row.id))}</td>
                          <td>${escapeHtml(formatMostRecentAccountProduction(source))}</td>
                          <td>${escapeHtml(formatEmployeeLongTermAccountSpeed(row.id, store.account))}</td>
                          <td>${formatNumber(safeNumber(row.effectiveSpeed || row.baseSpeed), 0)} pieces/hr</td>
                          <td>${escapeHtml(sourceStore)}</td>
                        </tr>
                        ${renderPeerEstimateBreakdownRow(row, store, prediction)}
                      `;
                    })
                    .join("")}
                </tbody>
              </table>`
            : `<p class="muted">Select crew members to view employee source stores.</p>`
        }
      </section>
    </div>
  `;
}

function renderEmployeeModasDetail(row, store) {
  const employee = state.employees.get(row.id);
  const accountKey = getLinkedAccountKey(store.account);
  const modas = employee?.modasAccountStats?.[accountKey];
  const regular = employee?.regularAccountStats?.[accountKey];
  const isModas = getStoreModasMode();
  const matchingSpeed = getBlendedAccountSpeed(isModas ? modas : regular);
  const otherSpeed = getBlendedAccountSpeed(isModas ? regular : modas);
  const modeLabel = isModas ? "Modas" : "Non-Modas";
  let weighting = matchingSpeed > 0
    ? otherSpeed > 0
      ? `${isModas ? "80% Modas / 20% Non-Modas" : "20% Modas / 80% Non-Modas"}`
      : `100% ${modeLabel}`
    : `No usable ${modeLabel} history; existing estimate`;
  if (isModas) {
    const source = getModasPlanningSource(employee, accountKey);
    weighting = source?.label || "No account Modas history; existing estimate";
    if (source?.source === "modasAccount" && source.confidenceWeight < 1) {
      weighting += `; ${formatNumber((1 - source.confidenceWeight) * 100, 0)}% confidence adjustment toward account Modas median (${formatNumber(source.accountMedian, 0)} pieces/hr)`;
    }
  }
  const formatHistory = (stat) => {
    const speed = getBlendedAccountSpeed(stat);
    if (!stat?.jobCount) return `<span class="muted">No history</span>`;
    const latest = stat.mostRecentStoreName
      ? `<div class="muted">Latest: ${formatNumber(stat.mostRecentPiecesPerHr, 0)} pieces/hr at ${escapeHtml(stat.mostRecentStoreName)}</div>`
      : "";
    return `${speed > 0 ? `${formatNumber(speed, 0)} pieces/hr` : "No usable production"}
      <div class="muted">${formatNumber(stat.jobCount, 0)} inventories</div>${latest}`;
  };
  const baseSpeed = resolveEmployeePlanningBaseSpeed(employee, store.account, {
    useRecentAccountProduction: state.useRecentAccountProduction,
  });
  return `<tr>
    <td>${escapeHtml(getEmployeeDisplayName(row.id))}</td>
    <td>${formatHistory(modas)}</td>
    <td>${formatHistory(regular)}</td>
    <td>${escapeHtml(weighting)}</td>
    <td>${formatNumber(baseSpeed, 0)} pieces/hr</td>
  </tr>`;
}

function renderPeerEstimateBreakdownRow(row, store, prediction = null) {
  if (prediction?.roleAssignments?.supervisor === row?.id) return "";
  const estimate = row?.mostRecentAccountProduction?.peerEstimate;
  if (!estimate?.peers?.length) return "";
  return `
    <tr class="peer-breakdown-row">
      <td colspan="5">
        <details class="peer-breakdown">
          <summary>
            Similar employees behind ${escapeHtml(getEmployeeDisplayName(row.id))}'s estimate
          </summary>
          <div class="peer-breakdown-summary">
            <span>Final estimate: <strong>${formatNumber(estimate.speed, 0)} pieces/hr</strong></span>
            <span>Peer-only estimate: ${formatNumber(estimate.peerSpeed, 0)} pieces/hr</span>
            <span>Employee global baseline excluded: ${formatNumber(estimate.baseSpeed, 0)} pieces/hr</span>
            <span>Peer estimate weight: ${formatNumber(estimate.blendWeight * 100, 0)}%</span>
          </div>
          <table class="peer-breakdown-table">
            <thead>
              <tr>
                <th>Similar Employee</th>
                <th>${escapeHtml(store.account)} Speed</th>
                <th>Comparable Speed</th>
                <th>Shared Accounts</th>
                <th>Influence</th>
              </tr>
            </thead>
            <tbody>
              ${estimate.peers.map(renderPeerEstimateBreakdownPeerRow).join("")}
            </tbody>
          </table>
        </details>
      </td>
    </tr>
  `;
}

function renderPeerEstimateBreakdownPeerRow(peer) {
  const shared = (peer.shared || [])
    .slice(0, 4)
    .map(
      (item) =>
        `<li>${escapeHtml(formatAccountKeyLabel(item.accountKey))}: ${formatNumber(item.targetSpeed, 0)} vs ${formatNumber(item.peerSpeed, 0)} pieces/hr</li>`,
    )
    .join("");
  const extraCount = Math.max(0, safeNumber(peer.sharedCount) - 4);
  return `
    <tr>
      <td>${escapeHtml(peer.displayName || peer.employee || "Unknown")}</td>
      <td>${formatNumber(peer.targetAccountSpeed, 0)} pieces/hr (${formatNumber(peer.targetAccountJobs, 0)} jobs)</td>
      <td>
        ${formatNumber(peer.targetComparableSpeed, 0)} vs ${formatNumber(peer.peerComparableSpeed, 0)} pieces/hr
        <div class="muted">account ratio ${formatNumber(peer.accountRatio, 2)}x, similarity ${formatNumber(peer.similarity * 100, 0)}%</div>
      </td>
      <td>
        <ul class="peer-shared-list">${shared}${extraCount ? `<li>+${formatNumber(extraCount, 0)} more shared accounts</li>` : ""}</ul>
      </td>
      <td>${formatNumber(peer.weight, 2)}</td>
    </tr>
  `;
}

function formatAccountKeyLabel(accountKey) {
  const key = cleanText(accountKey);
  if (!key) return "Unknown account";
  const store = (state.storesList || []).find(
    (candidate) =>
      (candidate.accountKey || getLinkedAccountKey(candidate.account)) === key,
  );
  return store?.account || key;
}

function getSegmentCountForAccount(store) {
  const accountKey = store?.accountKey || getLinkedAccountKey(store?.account);
  return new Set(
    (state.storesList || [])
      .filter(
        (candidate) =>
          (candidate.accountKey || getLinkedAccountKey(candidate.account)) ===
          accountKey,
      )
      .map((candidate) => candidate.segmentId || "S1"),
  ).size;
}

function renderAccountSegmentBreakout(store) {
  const accountKey = store?.accountKey || getLinkedAccountKey(store?.account);
  const groups = new Map();
  (state.storesList || [])
    .filter(
      (candidate) =>
        (candidate.accountKey || getLinkedAccountKey(candidate.account)) ===
        accountKey,
    )
    .forEach((candidate) => {
      const segmentId = candidate.segmentId || "S1";
      if (!groups.has(segmentId)) groups.set(segmentId, []);
      groups.get(segmentId).push(candidate);
    });
  const entries = Array.from(groups.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  if (!entries.length) return `<p class="muted">No segment breakout available.</p>`;
  return `
    <ul class="segment-breakout">
      ${entries
        .map(([segmentId, stores]) => {
          const sortedSignals = stores
            .map(getStoreSizeSignal)
            .filter((value) => value > 0)
            .sort((a, b) => a - b);
          const low = sortedSignals[0];
          const high = sortedSignals[sortedSignals.length - 1];
          const rangeText =
            low > 0 && high > 0
              ? `${formatNumber(low, 0)}-${formatNumber(high, 0)} pieces`
              : "size range unavailable";
          return `<li><strong>${escapeHtml(segmentId)}</strong>: ${stores.length} stores, ${rangeText}</li>`;
        })
        .join("")}
    </ul>
  `;
}

function renderBaselineDetail(prediction) {
  if (prediction?.target === "physical-first-arrival-last-departure-v1") return `<p><strong>${formatNumber(prediction.baseDuration, 1)} hrs</strong> from ${escapeHtml(prediction.baselineSource)}.</p><p>First validated arrival to last departure, including supervisor review and recounts. Prior workload peers and planned crew/role contributions inform the estimate. ${prediction.storeHistoryCount} same-store visits. Model: ${escapeHtml(prediction.modelVersion)}.</p><p class="muted">Development evidence, not a ±15-minute guarantee. Account mappings and largest-count revision selections retain historical uncertainty. The existing predictor remains available.</p>`;

  if (!prediction) return `<p class="muted">Complete a plan to view its duration baseline.</p>`;
  return `<p><strong>${formatNumber(prediction.baseDuration, 1)} hrs</strong> from ${escapeHtml(prediction.baselineSource)}</p>
    <p>Method: ${escapeHtml(prediction.baselineMethod)}. Earlier store visits: ${prediction.storeHistoryCount}. Reference visits used: ${prediction.matchingHistoryCount}.</p>
    <p class="muted">On-site duration is the longest recorded non-supervisor employee time, or longest recorded employee time if no counter is present; it includes post-count attendance. Counting-finish time is not a predictor target. The export can omit former employees and supervisors. Recorded pieces and labor are partial totals and do not set this baseline. Reported PPH uses attendance hours, with an observed 2.5-hour RX adjustment whose rationale is unverified; no break deduction is assumed.</p>`;
}

function renderPredictionDifferenceImpact(prediction) {
  if (prediction?.target === "physical-first-arrival-last-departure-v1") return `<p>${formatNumber(prediction.baseDuration, 2)} hrs historical baseline → ${formatNumber(prediction.onSiteDuration, 2)} hrs with the selected crew and roles. ${formatNumber(prediction.features.overhead, 2)} hrs of prior post-count allowance is kept separate from the capacity adjustment.</p><p class="muted">Role contributions are planning assumptions. Actual-staffing historical comparisons are not proof of causal staffing effects.</p>`;

  if (!prediction) return `<p class="muted">Complete a plan to view the crew adjustment.</p>`;
  return `<p><strong>${formatSigned(prediction.crewAdjustmentHours, 2)} hrs</strong> from the crew comparison.</p>
    <p>${formatNumber(prediction.baseDuration, 2)} hrs baseline &rarr; ${formatNumber(prediction.onSiteDuration, 2)} hrs planned duration.</p>
    <p class="muted">Comparable visits use the same inventory type and counting mode where available. Crew comparisons are limited to a 15% reduction or 20% increase. Missing supervisor production is never filled with zero or added as a historical measurement. The accuracy report does not supply an additional correction to this estimate.</p>`;
}

function renderLastCrewDataNotice() {
  return `<p class="last-crew-notice">This is the crew visible in the supplied export. Former employees and some supervisors are missing, so recorded crew size, pieces and labor may be incomplete.</p>`;
}

function formatEmployeeLongTermAccountSpeed(employeeId, account) {
  const employee = state.employees.get(employeeId);
  const accountKey = getLinkedAccountKey(account);
  const accountStat = accountKey ? employee?.accountStats?.[accountKey] : null;
  const supervisorAccountStat = accountKey
    ? employee?.supervisorAccountStats?.[accountKey]
    : null;
  const peerEstimate = getPeerAdjustedAccountEstimate(employee, accountKey);
  const supervisorJobCount = safeNumber(supervisorAccountStat?.jobCount);
  const value = safeNumber(accountStat?.avgPiecesPerHr);
  if (!(value > 0)) {
    if (peerEstimate?.speed > 0) {
      const supervisorNote =
        supervisorJobCount > 0
          ? `; supervisor-only history excluded (${formatNumber(supervisorJobCount, 0)} jobs)`
          : "";
      return `Similar-peer estimate (${formatNumber(peerEstimate.peerCount, 0)} peers)${supervisorNote}`;
    }
    if (supervisorJobCount > 0) {
      return `Supervisor-only history excluded (${formatNumber(supervisorJobCount, 0)} jobs)`;
    }
    return "No account history";
  }
  return `${formatNumber(value, 0)} pieces/hr (${formatNumber(safeNumber(accountStat.jobCount), 0)} jobs)`;
}

function formatMostRecentAccountProduction(production) {
  const piecesPerHr = safeNumber(production?.piecesPerHr);
  if (!(piecesPerHr > 0)) {
    if (production?.peerEstimate?.speed > 0) {
      const supervisorNote = production?.supervisorOnly
        ? "; supervisor history excluded"
        : "";
      return `Similar-peer estimate (${formatNumber(production.peerEstimate.speed, 0)} pieces/hr)${supervisorNote}`;
    }
    const supervisorPiecesPerHr = safeNumber(production?.supervisorPiecesPerHr);
    if (production?.supervisorOnly && supervisorPiecesPerHr > 0) {
      return `Supervisor-only history excluded (${formatNumber(supervisorPiecesPerHr, 0)} pieces/hr)`;
    }
    return "No account history";
  }
  return `${formatNumber(piecesPerHr, 0)} pieces/hr`;
}

function renderProductionVarianceArrow(item) {
  const recentPiecesPerHr = safeNumber(
    item?.mostRecentAccountProduction?.piecesPerHr,
  );
  const displayedPiecesPerHr = safeNumber(item?.baseSpeed);
  if (
    !(recentPiecesPerHr > 0) ||
    !(displayedPiecesPerHr > 0) ||
    displayedPiecesPerHr === recentPiecesPerHr
  )
    return "";
  const isHigher = displayedPiecesPerHr > recentPiecesPerHr;
  const className = isHigher ? "variance-arrow up" : "variance-arrow down";
  const symbol = isHigher ? "↑" : "↓";
  const label = isHigher
    ? "Pieces/hr is higher than most recent account production"
    : "Pieces/hr is lower than most recent account production";
  const symbolHtml = isHigher ? "&uarr;" : "&darr;";
  return ` <span class="${className}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${symbolHtml}</span>`;
}

function getProductionVarianceTone(item) {
  const recentPiecesPerHr = safeNumber(
    item?.mostRecentAccountProduction?.piecesPerHr,
  );
  if (!(recentPiecesPerHr > 0)) return "";
  const variance = Math.abs(safeNumber(item.baseSpeed) - recentPiecesPerHr);
  if (variance > 1200) return "production-risk-high";
  if (variance > 700) return "production-risk-medium";
  return "";
}

function readSavedForecasts() {
  const raw = localStorage.getItem(FORECAST_LOG_KEY);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("Saved forecast data could not be read; export or recover the browser data before saving again.");
  return value;
}

function forecastScheduledStart(schedule) {
  if (!schedule?.date) return null;
  const minutes = parseScheduleTimeToMinutes(schedule.startTimeText);
  // Without a usable start time, only save before the inventory date begins.
  const time = !Number.isFinite(minutes) ? "00:00" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const stamp = new Date(`${schedule.date}T${time}:00`).getTime();
  return Number.isFinite(stamp) ? stamp : null;
}

function saveCurrentForecast(automatic = false) {
  const status = document.getElementById("forecastStatus");
  const prediction = predict();
  const schedule = getPrimaryScheduleForStore();
  const scheduledStart = forecastScheduledStart(schedule);
  if (!prediction || !scheduledStart || scheduledStart <= Date.now()) {
    if (!automatic && status) status.textContent = "Choose a future scheduled inventory and a complete crew to save a forecast before the job starts.";
    return;
  }
  try {
    const records = readSavedForecasts();
    const payload = {
      modelVersion: prediction.modelVersion || DurationModel.VERSION, dataFingerprint: state.dataFingerprint,
      storeKey: state.selectedStoreKey, scheduledDate: schedule.date,
      scheduledStart: new Date(scheduledStart).toISOString(),
      plan: prediction.plan, config: prediction.config,
      baseDuration: prediction.baseDuration, predictedDuration: prediction.onSiteDuration,
      predictedManHours: prediction.manHours, crewAdjustmentHours: prediction.crewAdjustmentHours,
      referenceVisits: prediction.matchingHistoryCount,
      historyThrough: state.jobs.reduce((date, job) => job.date < prediction.plan.date && job.date > date ? job.date : date, ""),
      sourceSnapshotId: state.historyMetadata?.snapshotId || null,
      sourceExportSha256: state.historyMetadata?.latestExportSha256 || null,
      sourceImportedAt: state.historyMetadata?.importedAt || null,
      target: prediction.target || "recorded on-site duration proxy including post-count work",
      fullAttendanceSnapshot: state.fullOnsiteData?.fingerprint || null,
      pairedForecasts: prediction.pairedFullOnsite ? [
        { modelVersion: DurationModel.VERSION, predictedDuration: prediction.incumbentComparison?.predictedDuration ?? prediction.onSiteDuration, target: "recorded-attendance-proxy" },
        { modelVersion: FullOnsiteModel.VERSION, predictedDuration: prediction.pairedFullOnsite.onSiteDuration, target: FullOnsiteModel.TARGET, config: prediction.pairedFullOnsite.config, features: prediction.pairedFullOnsite.features },
      ] : null,
      intervalLow: prediction.confidenceLow, intervalHigh: prediction.confidenceHigh,
      kind: "planning-preview",
    };
    const signature = JSON.stringify(payload);
    if (!records.some(record => record.signature === signature)) {
      records.push({ ...payload, savedAt: new Date().toISOString(), signature });
      localStorage.setItem(FORECAST_LOG_KEY, JSON.stringify(records));
    }
    renderSavedForecastStatus("Current forecast saved. ");
  } catch (error) {
    if (status) status.textContent = `Forecast was not saved: ${error.message}. Existing forecasts have not been removed.`;
    else console.error("Forecast was not saved; existing records preserved:", error);
  }
}

function evaluateLegacySavedForecasts(records) {
  const jobs = new Map(state.jobs.map(job => [`${job.date}||${job.storeKey}`, job]));
  const latest = new Map();
  for (const record of records) {
    if (!(Date.parse(record.savedAt) < Date.parse(record.scheduledStart))) continue;
    const key = `${record.scheduledDate}||${record.storeKey}`;
    const job = jobs.get(key);
    if (!job || !(job.duration > 0) || record.scheduledDate >= getLocalDateStamp()) continue;
    // The source must have been refreshed since the forecast; never score against its own input file.
    if (record.dataFingerprint === state.dataFingerprint) continue;
    if (!latest.has(key) || record.savedAt > latest.get(key).savedAt) latest.set(key, record);
  }
  return Array.from(latest, ([key, record]) => ({ ...record, actual: jobs.get(key).duration, predicted: record.predictedDuration,
    outcomeDataFingerprint: state.dataFingerprint, outcomeSnapshotId: state.historyMetadata?.snapshotId || null,
    outcomeImportedAt: state.historyMetadata?.importedAt || null }));
}

function evaluateSavedForecasts(records) {
  const legacy = evaluateLegacySavedForecasts(records.filter(r => !r.pairedForecasts));
  const latest = new Map();
  for (const record of records.filter(r => r.pairedForecasts)) {
    if (!(Date.parse(record.savedAt) < Date.parse(record.scheduledStart)) || record.fullAttendanceSnapshot === state.fullOnsiteData?.fingerprint) continue;
    const storeId = record.pairedForecasts.find(p => p.target === "physical-first-arrival-last-departure-v1")?.features?.storeId;
    const outcome = state.fullOnsiteData?.jobs.find(j => j.storeId === storeId && j.date === record.scheduledDate);
    if (!outcome || !(Date.parse(record.savedAt) < Date.parse(outcome.arrivalLocal)) || record.scheduledDate >= getLocalDateStamp()) continue;
    for (const forecast of record.pairedForecasts) {
      const key = `${record.scheduledDate}||${record.storeKey}||${forecast.modelVersion}`;
      if (!latest.has(key) || record.savedAt > latest.get(key).savedAt) latest.set(key, { ...record, modelVersion: forecast.modelVersion, actual: outcome.duration, predicted: forecast.predictedDuration, outcomeTarget: "physical-first-arrival-last-departure-v1", outcomeDataFingerprint: state.fullOnsiteData.fingerprint });
    }
  }
  return [...legacy, ...latest.values()];
}

function renderSavedForecastStatus(prefix = "") {
  const status = document.getElementById("forecastStatus");
  if (!status || PRECOMPUTE_ANALYTICS_MODE) return;
  try {
    const records = readSavedForecasts();
    const observed = evaluateSavedForecasts(records);
    const metrics = DurationModel.metrics(observed.filter(r => r.modelVersion === (state.fullOnsiteEnabled ? FullOnsiteModel.VERSION : DurationModel.VERSION)));
    status.textContent = `${prefix}${records.length} forecasts saved on this browser. ${metrics.jobs ? `${metrics.jobs} inventories matched after a data refresh; average recorded-duration error ${formatNumber(metrics.durationMae, 2)} hrs. Uses the last saved preview before each scheduled start; planned crews may differ from actual attendance.` : "Matched results will appear after completed inventories arrive in a later export."}`;
  } catch (error) { status.textContent = `Unable to read saved forecasts: ${error.message}`; }
}

function exportSavedForecasts() {
  try {
    const records = readSavedForecasts();
    const payload = { exportedAt: new Date().toISOString(), forecasts: records, matchedOutcomes: evaluateSavedForecasts(records) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = `schedule-forecasts-${getLocalDateStamp()}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    const status = document.getElementById("forecastStatus");
    if (status) status.textContent = `Forecast export failed: ${error.message}`;
  }
}

function renderAccuracyReport() {
  if (!state.analyticsReady) {
    dom.accuracySummary.textContent = "Preparing predictions from earlier history...";
    dom.storeAccuracySummary.textContent = "Historical validation will appear when processing completes.";
    dom.accuracyWorstBody.innerHTML = "";
    return;
  }
  const analytics = state.durationAnalytics;
  const cache = state.accuracyCache;
  if (!analytics || !cache?.counted) {
    dom.accuracySummary.textContent = "Not enough dated jobs for a separate test period yet. Planning uses a duration baseline.";
    dom.storeAccuracySummary.textContent = "No later-job test results are available for this store yet.";
    dom.accuracyWorstBody.innerHTML = "";
    renderSavedForecastStatus();
    return;
  }
  const selected = dom.accuracyAccountFilter.value || "__all__";
  const rows = cache.allRows.filter(row => selected === "__all__" || row.accountKey === getLinkedAccountKey(selected));
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const mae = count ? rows.reduce((sum, row) => sum + row.mae * row.count, 0) / count : 0;
  const mape = count ? rows.reduce((sum, row) => sum + row.mape * row.count, 0) / count : 0;
  const metrics = analytics.testMetrics;
  dom.accuracySummary.textContent = `${selected === "__all__" ? "All accounts" : selected}: ${count} test inventories since ${metrics.splitDate}. Average error: ${formatNumber(mae, 2)} hrs (${formatNumber(mape, 1)}%). Each prediction uses only earlier dates; settings were chosen before this test period. These are retrospective checks of recorded employee duration; omitted employees and supervisors cannot be reconstructed. ${metrics.attempted - metrics.jobs} test inventories had no usable earlier baseline.`;
  const storeRow = cache.allRows.find(row => row.storeKey === state.selectedStoreKey);
  if (storeRow) {
    const difference = storeRow.predictedAvgDuration - storeRow.actualAvgDuration;
    const trend = classifyAccuracyTrend(difference);
    dom.storeAccuracySummary.innerHTML = `<span class="accuracy-status accuracy-status-${trend.key}">${escapeHtml(trend.label)}</span><br>
      ${storeRow.count} inventories in the later test period. Average absolute error: <strong>${formatNumber(storeRow.mae, 2)} hrs</strong>.<br>
      Recorded duration: ${formatNumber(storeRow.actualAvgDuration, 1)} hrs | Predicted: ${formatNumber(storeRow.predictedAvgDuration, 1)} hrs | Average difference: ${formatSigned(difference, 1)} hrs.<br>
      <span class="muted">Available employee time is a proxy for job duration. Historical labor totals are incomplete and are not used as an accuracy target.</span>`;
  } else {
    dom.storeAccuracySummary.textContent = "This store has no scored inventory in the later test period. Its available history can still supply a planning baseline.";
  }
  const tableRows = [[selected === "__all__" ? "Model - all test jobs" : selected, mae, mape, count]];
  if (selected === "__all__") {
    for (const [label, result] of [["Model - same stores as baselines", analytics.benchmarks.pairedModel], ["Last earlier visit", analytics.benchmarks.lastVisit], ["Mean of last 3 earlier visits", analytics.benchmarks.recentStore], ["Model - no earlier store visit", analytics.benchmarks.newStores]]) {
      tableRows.push([label, result.durationMae, result.mape, result.jobs]);
    }
  }
  dom.accuracyWorstBody.innerHTML = tableRows.map(([label, error, pct, jobs]) => `<tr><td>${escapeHtml(label)}</td><td>${jobs ? formatNumber(error, 2) : "-"}</td><td>${jobs ? formatNumber(pct, 1) + "%" : "-"}</td><td>${jobs}</td></tr>`).join("");
  renderSavedForecastStatus();
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
    productionShrinkPercent: state.productionShrinkPercent,
    productionShrinkMode: state.productionShrinkMode,
    productionShrinkEmployeeIds: Array.from(
      state.productionShrinkEmployeeIds || [],
    ),
    useRecentAccountProduction: state.useRecentAccountProduction,
    modasByStore: state.modasByStore,
    selectedRolesByStore: state.selectedRolesByStore,
    roleModesByStore: state.roleModesByStore,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function restoreSelectionsFromStorage() {
  const snapshot = readStorage();
  const storedStoreKey = snapshot.selectedStoreKey;
  const firstScheduledStoreKey =
    state.storesList.find((store) => (store.scheduleRows || []).length > 0)
      ?.storeKey || null;
  state.selectedStoreKey = state.stores.has(storedStoreKey)
    ? storedStoreKey
    : firstScheduledStoreKey || state.storesList[0]?.storeKey || null;

  const savedCrew = readSavedCrew(state.selectedStoreKey);
  state.selectedEmployees = new Set(filterToSchedulableEmployees(savedCrew));
}

function restoreSettingsFromStorage() {
  const settings = readStorage().settings || {};
  state.modasByStore = settings.modasByStore || {};
  state.planningMode =
    settings.planningMode === "manhours" ? "manhours" : "duration";
  state.targetValue = Math.max(0, toNumber(settings.targetValue));
  state.productionShrinkPercent = normalizeProductionShrinkPercent(
    settings.productionShrinkPercent,
  );
  state.productionShrinkMode = normalizeProductionShrinkMode(
    settings.productionShrinkMode,
  );
  state.productionShrinkEmployeeIds = new Set(
    uniqueStrings(settings.productionShrinkEmployeeIds || []),
  );
  syncProductionShrinkSelectionToCrew();
  state.useRecentAccountProduction = Boolean(
    settings.useRecentAccountProduction,
  );
  state.storeScheduleFilter = "all";
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
  if (dom.productionShrinkPercent) {
    dom.productionShrinkPercent.value =
      state.productionShrinkPercent > 0 ? state.productionShrinkPercent : "";
  }
  if (dom.productionShrinkMode) {
    dom.productionShrinkMode.value = state.productionShrinkMode;
  }
  if (dom.useRecentAccountProduction) {
    dom.useRecentAccountProduction.checked = state.useRecentAccountProduction;
  }
  renderRoleSelectors();
  renderProductionShrinkEmployees();
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
  const input = String(text || "").replace(/\r\n/g, "\n");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return `${input.length}:${unsigned.toString(16)}`;
}

function buildAnalyticsSnapshot(fingerprint) {
  return {
    id: ANALYTICS_DB_SNAPSHOT_ID, version: 9, modelVersion: DurationModel.VERSION,
    fingerprint: String(fingerprint || ""), createdAt: new Date().toISOString(),
    durationAnalytics: state.durationAnalytics,
  };
}

function applyAnalyticsSnapshot(snapshot) {
  state.durationAnalytics = snapshot.durationAnalytics;
  state.backtestMetrics = snapshot.durationAnalytics.testMetrics;
  state.accuracyCache = snapshot.durationAnalytics.accuracyCache;
}

function isValidAnalyticsSnapshot(snapshot, fingerprint) {
  return Boolean(snapshot && snapshot.version === 9 && snapshot.modelVersion === DurationModel.VERSION
    && snapshot.durationAnalytics?.version === DurationModel.VERSION
    && snapshot.durationAnalytics?.config && snapshot.durationAnalytics?.testMetrics
    && String(snapshot.fingerprint || "") === String(fingerprint || ""));
}

function openAnalyticsCacheDb() {
  if (!window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ANALYTICS_DB_NAME, ANALYTICS_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ANALYTICS_DB_STORE)) {
        db.createObjectStore(ANALYTICS_DB_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Analytics cache database blocked"));
  });
}

async function readAnalyticsSnapshotFromIndexedDb() {
  const db = await openAnalyticsCacheDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ANALYTICS_DB_STORE, "readonly");
    const store = transaction.objectStore(ANALYTICS_DB_STORE);
    const request = store.get(ANALYTICS_DB_SNAPSHOT_ID);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function writeAnalyticsSnapshotToIndexedDb(snapshot) {
  const db = await openAnalyticsCacheDb();
  if (!db) return;

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(ANALYTICS_DB_STORE, "readwrite");
    const store = transaction.objectStore(ANALYTICS_DB_STORE);
    store.put(snapshot);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function persistAnalyticsCache(fingerprint) {
  if (!fingerprint) return;
  const snapshot = buildAnalyticsSnapshot(fingerprint);

  try {
    localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Analytics localStorage cache write failed:", error);
  }

  try {
    await writeAnalyticsSnapshotToIndexedDb(snapshot);
  } catch (error) {
    console.warn("Analytics IndexedDB cache write failed:", error);
  }
}

async function restoreAnalyticsCache(fingerprint) {
  if (!fingerprint) return false;

  try {
    const raw = localStorage.getItem(ANALYTICS_CACHE_KEY);
    if (raw) {
      const snapshot = JSON.parse(raw);
      if (isValidAnalyticsSnapshot(snapshot, fingerprint)) {
        applyAnalyticsSnapshot(snapshot);
        return true;
      }
    }
  } catch (error) {
    console.warn("Analytics localStorage cache restore failed:", error);
  }

  try {
    const snapshot = await readAnalyticsSnapshotFromIndexedDb();
    if (isValidAnalyticsSnapshot(snapshot, fingerprint)) {
      applyAnalyticsSnapshot(snapshot);
      return true;
    }
  } catch (error) {
    console.warn("Analytics IndexedDB cache restore failed:", error);
  }

  return false;
}

function displayEmployeeSpeed(employee, account = getSelectedAccount()) {
  return getEmployeePlanningSpeedSource(employee, account).speed;
}

function getModasHistoryWeight(jobCount) {
  if (jobCount >= 5) return 1;
  if (jobCount >= 3) return 0.95;
  if (jobCount >= 2) return 0.9;
  return 0.85;
}

function getAccountModasMedian(accountKey, context = state) {
  if (!context.modasMedianCache.has(accountKey)) {
    const speeds = Array.from(context.employees.values())
      .map(employee => getBlendedAccountSpeed(employee.modasAccountStats?.[accountKey]))
      .filter(speed => speed > 0);
    context.modasMedianCache.set(accountKey, speeds.length ? median(speeds) : 0);
  }
  return context.modasMedianCache.get(accountKey);
}

function getModasPlanningSource(employee, accountKey, context = state) {
  const matching = employee?.modasAccountStats?.[accountKey];
  const modeSpeed = getBlendedAccountSpeed(matching);
  const accountMedian = getAccountModasMedian(accountKey, context);
  if (modeSpeed > 0) {
    const otherSpeed = getBlendedAccountSpeed(employee?.regularAccountStats?.[accountKey]);
    const weight = otherSpeed > 0 ? getModasHistoryWeight(matching.jobCount) : 1;
    const blended = modeSpeed * weight + otherSpeed * (1 - weight);
    // Retire confidence shrinkage after five matching inventories, too.
    const confidenceWeight = Math.min(1, matching.jobCount / 5);
    return {
      speed: accountMedian > 0 ? blended * confidenceWeight + accountMedian * (1 - confidenceWeight) : blended,
      source: "modasAccount",
      label: `${formatNumber(weight * 100, 0)}% Modas history (${matching.jobCount} inventories)`,
      historyWeight: weight,
      confidenceWeight: accountMedian > 0 ? confidenceWeight : 1,
      accountMedian,
    };
  }
  const peerEstimate = getPeerAdjustedAccountEstimate(employee, accountKey, true, context);
  if (peerEstimate?.speed > 0) return {
    speed: peerEstimate.speed, source: "modasPeer", label: "Similar-peer Modas account estimate", peerEstimate,
  };
  if (accountMedian > 0) return {
    speed: accountMedian, source: "modasMedian", label: "Account Modas median (no similar-peer estimate)",
  };
  return null;
}

function getEmployeePlanningSpeedSource(employee, account = getSelectedAccount(), inventoryMode = getStoreModasMode(), context = state) {
  if (inventoryMode === true) {
    const modasSource = getModasPlanningSource(employee, getLinkedAccountKey(account), context);
    if (modasSource) return modasSource;
  }
  const fallback = safeNumber(context.global.medianEmployeeSpeed);
  if (!employee) {
    return {
      speed: fallback,
      source: "globalMedian",
      label: "Company median speed",
    };
  }

  const accountKey = getLinkedAccountKey(account);
  const accountStat = accountKey ? employee.accountStats?.[accountKey] : null;
  if (accountStat && accountStat.jobCount >= 1) {
    let blended = blendRecentAndLongSpeed(
      accountStat.avgPiecesPerHrRecent,
      accountStat.avgPiecesPerHr,
      accountStat.jobCount,
    );
    const matching = employee[inventoryMode ? "modasAccountStats" : "regularAccountStats"]?.[accountKey];
    const other = employee[inventoryMode ? "regularAccountStats" : "modasAccountStats"]?.[accountKey];
    const modeSpeed = getBlendedAccountSpeed(matching);
    if (inventoryMode !== null && modeSpeed > 0) {
      const otherSpeed = getBlendedAccountSpeed(other);
      blended = otherSpeed > 0 ? modeSpeed * 0.8 + otherSpeed * 0.2 : modeSpeed;
    }
    return {
      speed: shrinkTowardFallback(blended, fallback, accountStat.jobCount, 3),
      source: "account",
      label: `Direct account history (${formatNumber(accountStat.jobCount, 0)} jobs)`,
    };
  }

  const peerEstimate = getPeerAdjustedAccountEstimate(employee, accountKey, false, context);
  if (peerEstimate && peerEstimate.speed > 0) {
    return {
      speed: peerEstimate.speed,
      source: "peerAccount",
      label: `Similar-peer account estimate (${formatNumber(peerEstimate.peerCount, 0)} peers)`,
      peerEstimate,
    };
  }

  if (employee.globalJobCount >= 1) {
    const blended = blendRecentAndLongSpeed(
      employee.avgPiecesPerHrRecentGlobal,
      employee.avgPiecesPerHrGlobal,
      employee.globalJobCount,
    );
    return {
      speed: shrinkTowardFallback(blended, fallback, employee.globalJobCount, 4),
      source: "globalEmployee",
      label: `Employee global history (${formatNumber(employee.globalJobCount, 0)} jobs)`,
    };
  }

  return {
    speed: fallback,
    source: "globalMedian",
    label: "Company median speed",
  };
}

function getPeerAdjustedAccountEstimate(employee, accountKey, modasOnly = false, context = state) {
  if (!employee || !accountKey || !employee.accountStats) return null;
  if (!modasOnly && employee.accountStats?.[accountKey]?.jobCount >= 1) return null;
  const cacheKey = `${employee.employee || ""}||${accountKey}||${modasOnly ? "modas" : "all"}`;
  if (context.peerAccountEstimateCache?.has(cacheKey)) {
    return context.peerAccountEstimateCache.get(cacheKey);
  }

  const targetGlobalSpeed = getBlendedGlobalEmployeeSpeed(employee, context);
  const fallback = safeNumber(context.global.medianEmployeeSpeed);
  const targetAccountEntries = getComparableAccountEntries(employee, modasOnly ? null : accountKey);
  if (!targetAccountEntries.length) {
    context.peerAccountEstimateCache?.set(cacheKey, null);
    return null;
  }

  const candidates = [];
  context.employees.forEach((peer) => {
    if (!peer || peer.employee === employee.employee) return;
    const peerTargetAccount = (modasOnly ? peer.modasAccountStats : peer.accountStats)?.[accountKey];
    const peerTargetSpeed = getBlendedAccountSpeed(peerTargetAccount);
    if (!(peerTargetSpeed > 0)) return;

    const shared = [];
    targetAccountEntries.forEach((targetEntry) => {
      const peerSharedStat = peer.accountStats?.[targetEntry.accountKey];
      const peerSharedSpeed = getBlendedAccountSpeed(peerSharedStat);
      if (!(peerSharedSpeed > 0)) return;
      shared.push({
        accountKey: targetEntry.accountKey,
        targetSpeed: targetEntry.speed,
        peerSpeed: peerSharedSpeed,
        weight: Math.sqrt(
          Math.max(
            1,
            Math.min(
              safeNumber(targetEntry.jobCount),
              safeNumber(peerSharedStat.jobCount),
            ),
          ),
        ),
      });
    });

    if (!shared.length) return;

    const sharedWeight = shared.reduce((sum, item) => sum + item.weight, 0);
    if (!(sharedWeight > 0)) return;

    const targetComparableSpeed =
      shared.reduce((sum, item) => sum + item.targetSpeed * item.weight, 0) /
      sharedWeight;
    const peerComparableSpeed =
      shared.reduce((sum, item) => sum + item.peerSpeed * item.weight, 0) /
      sharedWeight;
    if (!(targetComparableSpeed > 0) || !(peerComparableSpeed > 0)) return;

    const avgLogDifference =
      shared.reduce(
        (sum, item) =>
          sum +
          Math.abs(Math.log(item.targetSpeed / item.peerSpeed)) * item.weight,
        0,
      ) / sharedWeight;
    const similarity = 1 / (1 + avgLogDifference * 4);
    if (similarity < 0.45) return;

    const accountRatio = clampNumber(peerTargetSpeed / peerComparableSpeed, 0.55, 1.75);
    const candidateSpeed = modasOnly ? peerTargetSpeed : targetComparableSpeed * accountRatio;
    const support =
      similarity *
      Math.min(1, shared.length / 3) *
      Math.sqrt(Math.min(safeNumber(peerTargetAccount.jobCount), 8) / 8) *
      Math.log1p(sharedWeight);

    if (candidateSpeed > 0 && support > 0) {
      candidates.push({
        employee: peer.employee,
        displayName: peer.displayName || peer.employee,
        speed: candidateSpeed,
        weight: support,
        sharedCount: shared.length,
        targetAccountSpeed: peerTargetSpeed,
        targetAccountJobs: safeNumber(peerTargetAccount.jobCount),
        targetComparableSpeed,
        peerComparableSpeed,
        accountRatio,
        similarity,
        shared: shared
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 6)
          .map((item) => ({
            accountKey: item.accountKey,
            targetSpeed: item.targetSpeed,
            peerSpeed: item.peerSpeed,
            weight: item.weight,
          })),
      });
    }
  });

  if (candidates.length < 2) {
    context.peerAccountEstimateCache?.set(cacheKey, null);
    return null;
  }
  candidates.sort((a, b) => b.weight - a.weight);
  const selected = candidates.slice(0, 8);
  const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);
  if (!(totalWeight > 0.35)) {
    context.peerAccountEstimateCache?.set(cacheKey, null);
    return null;
  }

  const peerSpeed =
    selected.reduce((sum, item) => sum + item.speed * item.weight, 0) /
    totalWeight;
  const baseSpeed = targetGlobalSpeed > 0 ? targetGlobalSpeed : fallback;
  if (!(baseSpeed > 0) || !(peerSpeed > 0)) {
    context.peerAccountEstimateCache?.set(cacheKey, null);
    return null;
  }

  const blendWeight = 1;
  const estimate = {
    speed: peerSpeed,
    peerSpeed,
    baseSpeed,
    blendWeight,
    peerCount: selected.length,
    sharedAccountCount: Math.max(...selected.map((item) => item.sharedCount)),
    peers: selected.map((item) => ({
      employee: item.employee,
      displayName: item.displayName,
      speed: item.speed,
      weight: item.weight,
      sharedCount: item.sharedCount,
      targetAccountSpeed: item.targetAccountSpeed,
      targetAccountJobs: item.targetAccountJobs,
      targetComparableSpeed: item.targetComparableSpeed,
      peerComparableSpeed: item.peerComparableSpeed,
      accountRatio: item.accountRatio,
      similarity: item.similarity,
      shared: item.shared,
    })),
  };
  context.peerAccountEstimateCache?.set(cacheKey, estimate);
  return estimate;
}

function getComparableAccountEntries(employee, excludeAccountKey) {
  return Object.entries(employee?.accountStats || {})
    .filter(([accountKey, stat]) => accountKey !== excludeAccountKey && safeNumber(stat?.jobCount) > 0)
    .map(([accountKey, stat]) => ({
      accountKey,
      speed: getBlendedAccountSpeed(stat),
      jobCount: safeNumber(stat.jobCount),
    }))
    .filter((entry) => entry.speed > 0);
}

function getBlendedAccountSpeed(accountStat) {
  if (!accountStat || safeNumber(accountStat.jobCount) < 1) return 0;
  return blendRecentAndLongSpeed(
    accountStat.avgPiecesPerHrRecent,
    accountStat.avgPiecesPerHr,
    accountStat.jobCount,
  );
}

function getBlendedGlobalEmployeeSpeed(employee, context = state) {
  if (!employee || safeNumber(employee.globalJobCount) < 1) return 0;
  return shrinkTowardFallback(
    blendRecentAndLongSpeed(
      employee.avgPiecesPerHrRecentGlobal,
      employee.avgPiecesPerHrGlobal,
      employee.globalJobCount,
    ),
    safeNumber(context.global.medianEmployeeSpeed),
    employee.globalJobCount,
    4,
  );
}

function clampNumber(value, min, max) {
  const n = safeNumber(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
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
  const weight = getShrinkWeight(jobCount, k);
  return v * weight + base * (1 - weight);
}

function getShrinkWeight(jobCount, k = 3) {
  const n = Math.max(0, safeNumber(jobCount));
  return n / (n + Math.max(1, safeNumber(k)));
}

function effectiveEmployeeSpeed(
  employee,
  storeKey = state.selectedStoreKey,
  account = getSelectedAccount(),
  options = {},
) {
  const baseSpeed = resolveEmployeePlanningBaseSpeed(employee, account, options);
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
  return 0; // Never mix pieces and hours as weights, or invent missing exposure.
}

function getSelectedAccount() {
  const store = state.stores.get(state.selectedStoreKey);
  return store?.accountKey || getLinkedAccountKey(store?.account) || "";
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
  return `${formatSigned(delta.value, 1)} ${unit}`;
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

function summarizeJobGroup(jobGroup) {
  const jobs = Array.isArray(jobGroup) ? jobGroup : [];
  const pieces = jobs.filter(j => Number.isFinite(j.totalPieces)).map(j => j.totalPieces);
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
      jobs.filter(j => Number.isFinite(j.totalPieces)).map(j => ({ date: j.date, value: j.totalPieces })),
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

function parseBooleanFlag(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const text = cleanText(value).toLowerCase();
  return ["1", "true", "yes", "y", "x"].includes(text);
}

function cleanScheduleText(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "0") return "";
  if (/^#error$/i.test(text)) return "";
  if (/^false$/i.test(text)) return "";
  return text;
}

function normalizeDateTimeText(value) {
  const text = cleanScheduleText(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getLocalDateStamp(offsetDays = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateString(value) {
  const text = cleanText(value);
  if (!text) return "";

  const isoLikeMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
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
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return text;
}

function formatLongDate(value) {
  const text = cleanText(value);
  if (!text) return "";
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseScheduleTimeToMinutes(value) {
  const text = cleanScheduleText(value);
  if (!text) return Number.POSITIVE_INFINITY;
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return Number.POSITIVE_INFINITY;
  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2] || 0);
  const meridiem = String(match[3] || "").toLowerCase();
  if (meridiem === "pm") hours += 12;
  return hours * 60 + minutes;
}

function estimateScheduleFinishTime(startTime, durationHours) {
  const startMinutes = parseScheduleTimeToMinutes(startTime);
  const durationMinutes = Math.round(safeNumber(durationHours) * 60);
  if (!Number.isFinite(startMinutes) || !(durationMinutes > 0)) return "";
  return formatScheduleMinutesAsTime(startMinutes + durationMinutes);
}

function formatScheduleMinutesAsTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalized =
    ((Math.round(totalMinutes) % minutesInDay) + minutesInDay) % minutesInDay;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function canonicalizeStoreName(value) {
  return canonicalizeKey(cleanText(value));
}

function formatOfficeNumber(value) {
  const office = cleanText(value);
  return office ? `Office ${office}` : "";
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

function getLinkedAccountKey(accountName) {
  const normalized = cleanText(accountName).toLowerCase();
  return accountGroupMap.get(normalized) || normalized;
}

function isRxRoleRequiredForStore(store) {
  const name = cleanText(store?.storeName);
  return /\brx\b/i.test(name);
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
