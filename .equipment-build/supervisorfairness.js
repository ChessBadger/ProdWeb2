const REQUIRED_COLUMNS = [
  { label: "SupervisorNumber", aliases: ["supervisornumber", "supervisor"] },
  { label: "DateOfInv", aliases: ["dateofinv", "date", "inventorydate"] },
  { label: "StoreName", aliases: ["storename", "store"] },
  { label: "Employee", aliases: ["employee", "employeenumber", "employeeid"] },
  { label: "Man Hrs", aliases: ["manhrs", "hours", "manhours", "expr1"] },
  { label: "PiecesPerHr", aliases: ["piecesperhr", "pph"] },
  { label: "DollarPerHr", aliases: ["dollarperhr", "dollarsperhr"] },
  { label: "SkusPerHr", aliases: ["skusperhr", "skuperhr"] },
  {
    label: "Total_Ext_Qty",
    aliases: ["totalextqty", "totalqty", "extendedqty"],
  },
  {
    label: "Total_Ext_Price",
    aliases: ["totalextprice", "totalprice", "extendedprice"],
  },
  { label: "OfficeName", aliases: ["officename", "office"] },
  { label: "TypeOfInv", aliases: ["typeofinv", "inventorytype"] },
];

const SIGNIFICANCE_LEVEL = 0.05;
const DATA_JSON_PATH = "data/EmployeeProductionExport.json";
const EMPTY_STATE_TEXT = "Load JSON data to begin.";
const BASELINE_HALF_LIFE_DAYS = 90;
const MIN_SHIFTS_FOR_SIGNIFICANCE = 12;
const RELIABILITY_MEDIUM_SHIFT_COUNT = 24;
const RELIABILITY_HIGH_SHIFT_COUNT = 50;
const ROBUSTNESS_ITERATIONS = 120;
const FE_DEMEAN_ITERS = 10;

const state = {
  cleanedRows: [],
  employeeBaselines: new Map(),
  employeeNames: new Map(),
  selectedSupervisor: "",
  quality: null,
  lastAnalysis: null,
};

const dom = {
  loadJsonBtn: document.getElementById("loadJsonBtn"),
  fileInput: document.getElementById("fileInput"),
  dataStatus: document.getElementById("dataStatus"),
  qualitySummary: document.getElementById("qualitySummary"),
  supervisorSelect: document.getElementById("supervisorSelect"),
  officeSelect: document.getElementById("officeSelect"),
  typeSelect: document.getElementById("typeSelect"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  exportAuditBtn: document.getElementById("exportAuditBtn"),
  verdictBox: document.getElementById("verdictBox"),
  verdictText: document.getElementById("verdictText"),
  kpiCards: document.getElementById("kpiCards"),
  comparisonBody: document.getElementById("comparisonBody"),
  allSuperSummary: document.getElementById("allSuperSummary"),
  allSuperBody: document.getElementById("allSuperBody"),
  shiftChart: document.getElementById("shiftChart"),
  crewChart: document.getElementById("crewChart"),
  storeSizeChart: document.getElementById("storeSizeChart"),
  trendChart: document.getElementById("trendChart"),
  trendInsight: document.getElementById("trendInsight"),
  storeBody: document.getElementById("storeBody"),
};

init();

function init() {
  dom.loadJsonBtn.addEventListener("click", loadBundledJson);
  dom.fileInput.addEventListener("change", onJsonUpload);
  dom.analyzeBtn.addEventListener("click", runAnalysis);
  dom.officeSelect.addEventListener("change", runAnalysis);
  dom.typeSelect.addEventListener("change", runAnalysis);
  dom.startDate.addEventListener("change", runAnalysis);
  dom.endDate.addEventListener("change", runAnalysis);
  dom.supervisorSelect.addEventListener("change", runAnalysis);
  dom.exportAuditBtn.addEventListener("click", exportAuditCsv);
  renderEmptyState(EMPTY_STATE_TEXT);
  loadBundledJson();
}

async function loadBundledJson() {
  setDataStatus(`Loading ${DATA_JSON_PATH}...`, "muted");
  try {
    const response = await fetch(DATA_JSON_PATH, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    ingestJsonPayload(payload, DATA_JSON_PATH);
  } catch (error) {
    setDataStatus(
      `Could not load ${DATA_JSON_PATH}: ${error?.message || "unknown error"}`,
      "bad",
    );
    renderEmptyState("Could not load bundled JSON data.");
  }
}

function onJsonUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) {
    return;
  }

  setDataStatus(`Loading ${file.name}...`, "muted");
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || "{}"));
      ingestJsonPayload(payload, file.name);
    } catch (error) {
      setDataStatus(
        `Could not parse ${file.name}: ${error?.message || "invalid JSON"}`,
        "bad",
      );
    }
  };
  reader.onerror = () => {
    setDataStatus(`Could not read ${file.name}.`, "bad");
  };
  reader.readAsText(file);
}

function ingestJsonPayload(payload, sourceName) {
  const rawRows = extractRowsFromPayload(payload);
  if (!Array.isArray(rawRows) || !rawRows.length) {
    setDataStatus("No row array was found in the JSON payload.", "bad");
    renderEmptyState("JSON did not contain a usable row array.");
    return;
  }

  const firstRow = rawRows.find((row) => row && typeof row === "object") || {};
  const headerKeys = Object.keys(firstRow).map(canonicalizeKey).filter(Boolean);
  const headerSet = new Set(headerKeys);
  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !column.aliases.some((alias) => headerSet.has(alias)),
  );

  const cleanedRows = [];
  let droppedRows = 0;
  for (const rawRow of rawRows) {
    const normalized = normalizeRow(rawRow);
    if (!normalized.valid) {
      droppedRows += 1;
      continue;
    }
    cleanedRows.push(normalized);
  }

  if (!cleanedRows.length) {
    setDataStatus("No valid employee rows remained after cleaning.", "bad");
    renderEmptyState("No valid rows remained after cleaning.");
    return;
  }

  state.cleanedRows = cleanedRows;
  state.employeeBaselines = buildEmployeeBaselines(cleanedRows);
  state.employeeNames = buildEmployeeNameMap(cleanedRows);
  state.quality = {
    sourceName,
    rawCount: rawRows.length,
    cleanedCount: cleanedRows.length,
    droppedRows,
    missingColumns: missingColumns.map((item) => item.label),
  };

  populateStaticFilters(cleanedRows);
  populateDateFilters(cleanedRows);
  renderQualitySummary(cleanedRows);
  setDataStatus(
    `Loaded ${sourceName}: ${cleanedRows.length.toLocaleString()} valid rows (${droppedRows.toLocaleString()} dropped).`,
    missingColumns.length ? "warn" : "muted",
  );

  runAnalysis();
}

function populateDateFilters(rows) {
  const previousStart = dom.startDate.value;
  const previousEnd = dom.endDate.value;
  const dates = rows
    .map((row) => row.date)
    .filter(Boolean)
    .sort();
  const minDate = dates[0] || "";
  const maxDate = dates.at(-1) || "";

  if (!previousStart || previousStart < minDate || previousStart > maxDate) {
    dom.startDate.value = minDate;
  }
  if (!previousEnd || previousEnd > maxDate || previousEnd < minDate) {
    dom.endDate.value = maxDate;
  }
}

function extractRowsFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const keys = Object.keys(payload);
    for (const key of keys) {
      if (Array.isArray(payload[key])) {
        return payload[key];
      }
    }
  }
  return [];
}

function normalizeRow(rawRow) {
  const row = {};
  Object.keys(rawRow || {}).forEach((key) => {
    row[canonicalizeKey(key)] = rawRow[key];
  });

  const supervisorId = cleanText(
    getFieldValue(row, ["supervisornumber", "supervisor"]),
  );
  const date = normalizeDate(
    getFieldValue(row, ["dateofinv", "date", "inventorydate"]),
  );
  const storeName = cleanText(getFieldValue(row, ["storename", "store"]));
  const employee = cleanText(
    getFieldValue(row, ["employee", "employeenumber", "employeeid"]),
  );
  const firstName = cleanText(getFieldValue(row, ["firstname", "fname"]));
  const lastName = cleanText(getFieldValue(row, ["lastname", "lname"]));
  const fullName = cleanText(getFieldValue(row, ["employeename", "name"]));
  const officeName =
    cleanText(getFieldValue(row, ["officename", "office"])) || "Unknown";
  const typeOfInv =
    cleanText(getFieldValue(row, ["typeofinv", "inventorytype"])) || "Unknown";

  const manHrs = parseNumber(
    getFieldValue(row, ["manhrs", "hours", "manhours", "expr1"]),
  );
  const piecesPerHr = parseNumber(getFieldValue(row, ["piecesperhr", "pph"]));
  const dollarPerHr = parseNumber(
    getFieldValue(row, ["dollarperhr", "dollarsperhr"]),
  );
  const skusPerHr = parseNumber(getFieldValue(row, ["skusperhr", "skuperhr"]));
  const totalExtQty = parseNumber(
    getFieldValue(row, ["totalextqty", "totalqty", "extendedqty"]),
  );
  const totalExtPrice = parseNumber(
    getFieldValue(row, ["totalextprice", "totalprice", "extendedprice"]),
  );

  const storeSize =
    Number.isFinite(totalExtQty) && totalExtQty > 0
      ? totalExtQty
      : Number.isFinite(totalExtPrice) && totalExtPrice > 0
        ? totalExtPrice
        : Number.NaN;

  return {
    valid: Boolean(supervisorId && date && storeName && employee),
    supervisorId,
    date,
    month: date ? date.slice(0, 7) : "",
    storeName,
    employee,
    employeeName: cleanDisplayName(
      `${firstName} ${lastName}`.trim() || fullName,
    ),
    officeName,
    typeOfInv,
    manHrs: manHrs > 0 ? manHrs : Number.NaN,
    piecesPerHr: piecesPerHr > 0 ? piecesPerHr : Number.NaN,
    dollarPerHr: dollarPerHr > 0 ? dollarPerHr : Number.NaN,
    skusPerHr: skusPerHr > 0 ? skusPerHr : Number.NaN,
    totalExtQty: totalExtQty > 0 ? totalExtQty : Number.NaN,
    totalExtPrice: totalExtPrice > 0 ? totalExtPrice : Number.NaN,
    storeSize,
  };
}

function buildEmployeeNameMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const employeeId = cleanText(row.employee);
    const name = cleanDisplayName(row.employeeName);
    if (!employeeId || !name) {
      return;
    }

    const existing = map.get(employeeId);
    if (!existing || existing.length < name.length) {
      map.set(employeeId, name);
    }
  });
  return map;
}

function getFieldValue(row, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) {
      return row[alias];
    }
  }
  return "";
}

function populateStaticFilters(rows) {
  const officePrevious = dom.officeSelect.value || "__all__";
  const typePrevious = dom.typeSelect.value || "__all__";

  const offices = Array.from(new Set(rows.map((row) => row.officeName))).sort(
    (left, right) => left.localeCompare(right),
  );
  const invTypes = Array.from(new Set(rows.map((row) => row.typeOfInv))).sort(
    (left, right) => left.localeCompare(right),
  );

  dom.officeSelect.innerHTML = "";
  dom.officeSelect.appendChild(new Option("All Offices", "__all__"));
  offices.forEach((office) =>
    dom.officeSelect.appendChild(new Option(office, office)),
  );
  dom.officeSelect.value = offices.includes(officePrevious)
    ? officePrevious
    : "__all__";

  dom.typeSelect.innerHTML = "";
  dom.typeSelect.appendChild(new Option("All Types", "__all__"));
  invTypes.forEach((type) =>
    dom.typeSelect.appendChild(new Option(type, type)),
  );
  dom.typeSelect.value = invTypes.includes(typePrevious)
    ? typePrevious
    : "__all__";
}

function renderQualitySummary(rows) {
  const supervisors = new Set(rows.map((row) => row.supervisorId));
  const employees = new Set(rows.map((row) => row.employee));
  const dates = rows
    .map((row) => row.date)
    .filter(Boolean)
    .sort();

  const minDate = dates[0] || "-";
  const maxDate = dates.at(-1) || "-";
  const baselineCoverage = state.employeeBaselines.size;
  const quality = state.quality || {};
  const missingColumnsText = quality.missingColumns?.length
    ? quality.missingColumns.join(", ")
    : "None";

  const lines = [
    `Rows Loaded: ${(quality.rawCount || 0).toLocaleString()}`,
    `Rows Used: ${rows.length.toLocaleString()}`,
    `Rows Dropped: ${(quality.droppedRows || 0).toLocaleString()}`,
    `Date Range: ${minDate} to ${maxDate}`,
    `Supervisors: ${supervisors.size.toLocaleString()}`,
    `Employees: ${employees.size.toLocaleString()}`,
    `Employee Baselines Built: ${baselineCoverage.toLocaleString()}`,
    `Missing Required Columns: ${missingColumnsText}`,
  ];

  dom.qualitySummary.innerHTML = lines
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");
}

function runAnalysis() {
  if (!state.cleanedRows.length) {
    state.lastAnalysis = null;
    renderEmptyState(EMPTY_STATE_TEXT);
    return;
  }

  const officeFilter = dom.officeSelect.value || "__all__";
  const typeFilter = dom.typeSelect.value || "__all__";
  const startDate = dom.startDate.value || "";
  const endDate = dom.endDate.value || "";

  if (startDate && endDate && startDate > endDate) {
    state.lastAnalysis = null;
    renderEmptyState("Start date must be before end date.");
    return;
  }

  const filteredRows = state.cleanedRows.filter((row) => {
    if (officeFilter !== "__all__" && row.officeName !== officeFilter) {
      return false;
    }
    if (typeFilter !== "__all__" && row.typeOfInv !== typeFilter) {
      return false;
    }
    if (startDate && row.date < startDate) {
      return false;
    }
    if (endDate && row.date > endDate) {
      return false;
    }
    return true;
  });

  if (!filteredRows.length) {
    state.lastAnalysis = null;
    renderEmptyState("No rows match the current filters.");
    return;
  }

  const storeGroups = buildStoreGroups(filteredRows, state.employeeBaselines);
  if (!storeGroups.length) {
    state.lastAnalysis = null;
    renderEmptyState(
      "No store-level groups could be formed from the current scope.",
    );
    return;
  }

  const summaries = buildSupervisorSummaries(filteredRows, storeGroups);
  if (!summaries.length) {
    state.lastAnalysis = null;
    renderEmptyState("No supervisors found in this filtered scope.");
    return;
  }

  populateSupervisorFilter(summaries);
  const selectedSupervisor = dom.supervisorSelect.value;
  state.selectedSupervisor = selectedSupervisor;

  const company = buildCompanySummary(storeGroups);
  const regressions = runRegressionsForSupervisors(
    storeGroups,
    summaries.map((item) => item.supervisorId),
  );
  const selectedSummary =
    summaries.find((item) => item.supervisorId === selectedSupervisor) ||
    summaries[0];
  const selectedRegression = regressions.get(selectedSummary.supervisorId) || {
    shift: null,
    crew: null,
  };
  const selectedRobustness = runRobustnessChecks(
    storeGroups,
    selectedSummary.supervisorId,
  );
  const reliability = getReliabilityTier(selectedSummary.shiftCount);
  const trendRows = buildMonthlyTrend(
    storeGroups,
    selectedSummary.supervisorId,
  );
  const trendDecomposition = decomposeTrendGap(trendRows);

  renderVerdict(
    selectedSummary,
    company,
    selectedRegression,
    selectedRobustness,
    reliability,
    trendDecomposition,
    storeGroups.length,
  );
  renderCards(selectedSummary, company, reliability);
  renderSelectedVsCompanyTable(selectedSummary, company);
  renderSupervisorTable(summaries, regressions, selectedSummary.supervisorId);
  renderCharts(
    summaries,
    storeGroups,
    selectedSummary.supervisorId,
    company,
    trendRows,
  );
  renderStoreTable(storeGroups, selectedSummary.supervisorId);

  dom.allSuperSummary.textContent = `Scope contains ${storeGroups.length.toLocaleString()} store-level shifts across ${summaries.length.toLocaleString()} supervisors. Models use store+month fixed effects and clustered errors.`;

  state.lastAnalysis = {
    generatedAt: new Date().toISOString(),
    filters: { office: officeFilter, type: typeFilter, startDate, endDate },
    selectedSupervisorId: selectedSummary.supervisorId,
    selectedSupervisorLabel: selectedSummary.supervisorLabel,
    reliability,
    summaries,
    company,
    regressions,
    selectedRegression,
    selectedRobustness,
    trendDecomposition,
    scopedShiftCount: storeGroups.length,
  };
}

function populateSupervisorFilter(summaries) {
  const previous = dom.supervisorSelect.value || state.selectedSupervisor;
  dom.supervisorSelect.innerHTML = "";

  summaries.forEach((summary) => {
    const option = new Option(
      `${summary.supervisorLabel} (${summary.shiftCount.toLocaleString()} shifts)`,
      summary.supervisorId,
    );
    dom.supervisorSelect.appendChild(option);
  });

  const ids = summaries.map((item) => item.supervisorId);
  dom.supervisorSelect.value = ids.includes(previous)
    ? previous
    : summaries[0].supervisorId;
}

function buildEmployeeBaselines(rows) {
  const employeeTotals = new Map();
  const finiteDateValues = rows
    .map((row) => dateToMs(row.date))
    .filter((value) => Number.isFinite(value));
  const maxDateMs = finiteDateValues.length
    ? Math.max(...finiteDateValues)
    : Date.now();

  rows.forEach((row) => {
    if (!employeeTotals.has(row.employee)) {
      employeeTotals.set(row.employee, {
        piecesWeightedSum: 0,
        piecesWeight: 0,
        dollarWeightedSum: 0,
        dollarWeight: 0,
        skusWeightedSum: 0,
        skusWeight: 0,
      });
    }
    const bucket = employeeTotals.get(row.employee);
    const ageDays = Math.max(0, (maxDateMs - dateToMs(row.date)) / 86400000);
    const recencyWeight = Math.exp(-ageDays / BASELINE_HALF_LIFE_DAYS);

    if (Number.isFinite(row.piecesPerHr)) {
      bucket.piecesWeightedSum += row.piecesPerHr * recencyWeight;
      bucket.piecesWeight += recencyWeight;
    }
    if (Number.isFinite(row.dollarPerHr)) {
      bucket.dollarWeightedSum += row.dollarPerHr * recencyWeight;
      bucket.dollarWeight += recencyWeight;
    }
    if (Number.isFinite(row.skusPerHr)) {
      bucket.skusWeightedSum += row.skusPerHr * recencyWeight;
      bucket.skusWeight += recencyWeight;
    }
  });

  const employeeAverages = [];
  employeeTotals.forEach((bucket, employee) => {
    employeeAverages.push({
      employee,
      avgPiecesPerHr: bucket.piecesWeight
        ? bucket.piecesWeightedSum / bucket.piecesWeight
        : Number.NaN,
      avgDollarPerHr: bucket.dollarWeight
        ? bucket.dollarWeightedSum / bucket.dollarWeight
        : Number.NaN,
      avgSkusPerHr: bucket.skusWeight
        ? bucket.skusWeightedSum / bucket.skusWeight
        : Number.NaN,
    });
  });

  const piecesStats = meanAndStd(
    employeeAverages.map((item) => item.avgPiecesPerHr),
  );
  const dollarStats = meanAndStd(
    employeeAverages.map((item) => item.avgDollarPerHr),
  );
  const skusStats = meanAndStd(
    employeeAverages.map((item) => item.avgSkusPerHr),
  );

  const baselineMap = new Map();
  employeeAverages.forEach((item) => {
    const zScores = [];
    if (Number.isFinite(item.avgPiecesPerHr) && piecesStats.std > 0) {
      zScores.push((item.avgPiecesPerHr - piecesStats.mean) / piecesStats.std);
    }
    if (Number.isFinite(item.avgDollarPerHr) && dollarStats.std > 0) {
      zScores.push((item.avgDollarPerHr - dollarStats.mean) / dollarStats.std);
    }
    if (Number.isFinite(item.avgSkusPerHr) && skusStats.std > 0) {
      zScores.push((item.avgSkusPerHr - skusStats.mean) / skusStats.std);
    }

    if (!zScores.length) {
      return;
    }

    const compositeZ = mean(zScores);
    const baselineSkillIndex = 100 + compositeZ * 10;
    if (Number.isFinite(baselineSkillIndex)) {
      baselineMap.set(item.employee, baselineSkillIndex);
    }
  });

  return baselineMap;
}

function buildStoreGroups(rows, baselineMap) {
  const groups = new Map();

  rows.forEach((row) => {
    const key = `${row.supervisorId}||${row.date}||${row.storeName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        supervisorId: row.supervisorId,
        supervisorLabel: formatSupervisorLabel(row.supervisorId),
        date: row.date,
        month: row.month,
        officeName: row.officeName,
        typeOfInv: row.typeOfInv,
        storeName: row.storeName,
        employees: new Set(),
        shiftSum: 0,
        shiftCount: 0,
        piecesSum: 0,
        piecesCount: 0,
        dollarSum: 0,
        dollarCount: 0,
        skusSum: 0,
        skusCount: 0,
        storeSizeSum: 0,
        storeSizeCount: 0,
      });
    }

    const group = groups.get(key);
    group.employees.add(row.employee);

    if (Number.isFinite(row.manHrs)) {
      group.shiftSum += row.manHrs;
      group.shiftCount += 1;
    }
    if (Number.isFinite(row.piecesPerHr)) {
      group.piecesSum += row.piecesPerHr;
      group.piecesCount += 1;
    }
    if (Number.isFinite(row.dollarPerHr)) {
      group.dollarSum += row.dollarPerHr;
      group.dollarCount += 1;
    }
    if (Number.isFinite(row.skusPerHr)) {
      group.skusSum += row.skusPerHr;
      group.skusCount += 1;
    }
    if (Number.isFinite(row.storeSize) && row.storeSize > 0) {
      group.storeSizeSum += row.storeSize;
      group.storeSizeCount += 1;
    }
  });

  const result = [];
  groups.forEach((group) => {
    let baselineSkills = Array.from(group.employees)
      .filter(
        (employee) => cleanText(employee) !== cleanText(group.supervisorId),
      )
      .map((employee) => baselineMap.get(employee))
      .filter((value) => Number.isFinite(value));

    if (!baselineSkills.length) {
      baselineSkills = Array.from(group.employees)
        .map((employee) => baselineMap.get(employee))
        .filter((value) => Number.isFinite(value));
    }

    result.push({
      supervisorId: group.supervisorId,
      supervisorLabel: group.supervisorLabel,
      date: group.date,
      month: group.month,
      officeName: group.officeName,
      typeOfInv: group.typeOfInv,
      storeName: group.storeName,
      crewSize: group.employees.size,
      storeSize: group.storeSizeCount
        ? group.storeSizeSum / group.storeSizeCount
        : Number.NaN,
      avgShiftLength: group.shiftCount
        ? group.shiftSum / group.shiftCount
        : Number.NaN,
      avgPiecesPerHr: group.piecesCount
        ? group.piecesSum / group.piecesCount
        : Number.NaN,
      avgDollarPerHr: group.dollarCount
        ? group.dollarSum / group.dollarCount
        : Number.NaN,
      avgSkusPerHr: group.skusCount
        ? group.skusSum / group.skusCount
        : Number.NaN,
      crewQuality: baselineSkills.length ? mean(baselineSkills) : Number.NaN,
    });
  });

  return result;
}

function buildSupervisorSummaries(rows, storeGroups) {
  const map = new Map();

  storeGroups.forEach((group) => {
    if (!map.has(group.supervisorId)) {
      map.set(group.supervisorId, {
        supervisorId: group.supervisorId,
        supervisorLabel: group.supervisorLabel,
        shiftCount: 0,
        shiftSum: 0,
        shiftValueCount: 0,
        crewQualitySum: 0,
        crewQualityCount: 0,
        piecesSum: 0,
        piecesCount: 0,
        dollarSum: 0,
        dollarCount: 0,
        skusSum: 0,
        skusCount: 0,
        storeSizeSum: 0,
        storeSizeCount: 0,
        employeeSet: new Set(),
      });
    }

    const bucket = map.get(group.supervisorId);
    bucket.shiftCount += 1;

    if (Number.isFinite(group.avgShiftLength)) {
      bucket.shiftSum += group.avgShiftLength;
      bucket.shiftValueCount += 1;
    }
    if (Number.isFinite(group.crewQuality)) {
      bucket.crewQualitySum += group.crewQuality;
      bucket.crewQualityCount += 1;
    }
    if (Number.isFinite(group.avgPiecesPerHr)) {
      bucket.piecesSum += group.avgPiecesPerHr;
      bucket.piecesCount += 1;
    }
    if (Number.isFinite(group.avgDollarPerHr)) {
      bucket.dollarSum += group.avgDollarPerHr;
      bucket.dollarCount += 1;
    }
    if (Number.isFinite(group.avgSkusPerHr)) {
      bucket.skusSum += group.avgSkusPerHr;
      bucket.skusCount += 1;
    }
    if (Number.isFinite(group.storeSize)) {
      bucket.storeSizeSum += group.storeSize;
      bucket.storeSizeCount += 1;
    }
  });

  rows.forEach((row) => {
    const bucket = map.get(row.supervisorId);
    if (bucket) {
      bucket.employeeSet.add(row.employee);
    }
  });

  return Array.from(map.values())
    .map((bucket) => ({
      supervisorId: bucket.supervisorId,
      supervisorLabel: bucket.supervisorLabel,
      shiftCount: bucket.shiftCount,
      uniqueEmployees: bucket.employeeSet.size,
      avgShiftLength: bucket.shiftValueCount
        ? bucket.shiftSum / bucket.shiftValueCount
        : Number.NaN,
      avgCrewQuality: bucket.crewQualityCount
        ? bucket.crewQualitySum / bucket.crewQualityCount
        : Number.NaN,
      avgPiecesPerHr: bucket.piecesCount
        ? bucket.piecesSum / bucket.piecesCount
        : Number.NaN,
      avgDollarPerHr: bucket.dollarCount
        ? bucket.dollarSum / bucket.dollarCount
        : Number.NaN,
      avgSkusPerHr: bucket.skusCount
        ? bucket.skusSum / bucket.skusCount
        : Number.NaN,
      avgStoreSize: bucket.storeSizeCount
        ? bucket.storeSizeSum / bucket.storeSizeCount
        : Number.NaN,
    }))
    .sort((left, right) =>
      left.supervisorLabel.localeCompare(right.supervisorLabel, undefined, {
        numeric: true,
      }),
    );
}

function buildCompanySummary(storeGroups) {
  return {
    avgShiftLength: mean(storeGroups.map((item) => item.avgShiftLength)),
    avgCrewQuality: mean(storeGroups.map((item) => item.crewQuality)),
    avgPiecesPerHr: mean(storeGroups.map((item) => item.avgPiecesPerHr)),
    avgDollarPerHr: mean(storeGroups.map((item) => item.avgDollarPerHr)),
    avgSkusPerHr: mean(storeGroups.map((item) => item.avgSkusPerHr)),
    avgStoreSize: mean(storeGroups.map((item) => item.storeSize)),
  };
}

function runRegressionsForSupervisors(storeGroups, supervisorIds) {
  const map = new Map();

  supervisorIds.forEach((supervisorId) => {
    map.set(supervisorId, {
      shift: runIndicatorRegression(
        storeGroups,
        supervisorId,
        "avgShiftLength",
      ),
      crew: runIndicatorRegression(storeGroups, supervisorId, "crewQuality"),
    });
  });

  return map;
}

function runIndicatorRegression(storeGroups, supervisorId, outcomeKey) {
  const rows = storeGroups.filter(
    (group) =>
      Number.isFinite(group[outcomeKey]) &&
      Number.isFinite(group.storeSize) &&
      group.storeSize > 0 &&
      Number.isFinite(group.crewSize) &&
      group.crewSize > 0,
  );

  if (rows.length < 18) {
    return null;
  }

  const selectedCount = rows.filter(
    (row) => row.supervisorId === supervisorId,
  ).length;
  const peerCount = rows.length - selectedCount;
  if (selectedCount < 5 || peerCount < 8) {
    return null;
  }

  const prepared = prepareRegressionRows(rows, supervisorId, outcomeKey);
  if (!prepared || prepared.rows.length < 18) {
    return null;
  }

  const fit = fitRegressionWithFixedEffects(prepared);
  if (!fit) {
    return null;
  }

  const coefficient = fit.beta[2];
  const standardError = fit.se[2];
  if (
    !Number.isFinite(coefficient) ||
    !Number.isFinite(standardError) ||
    standardError <= 0
  ) {
    return null;
  }

  const tValue = coefficient / standardError;
  const pValue = 2 * (1 - normalCdf(Math.abs(tValue)));

  return {
    coefficient,
    standardError,
    tValue,
    pValue,
    significant: pValue < SIGNIFICANCE_LEVEL,
    significantReliable:
      pValue < SIGNIFICANCE_LEVEL &&
      selectedCount >= MIN_SHIFTS_FOR_SIGNIFICANCE,
    sampleSize: prepared.rows.length,
    selectedCount,
    peerCount,
    clusteredBy: "store",
    controls: "store_size, crew_size, store_fe, month_fe",
  };
}

function prepareRegressionRows(rows, supervisorId, outcomeKey) {
  const preparedRows = rows.map((row) => ({
    outcome: row[outcomeKey],
    storeSize: Math.log1p(row.storeSize),
    crewSize: row.crewSize,
    indicator: row.supervisorId === supervisorId ? 1 : 0,
    storeFe: `${row.officeName}||${row.storeName}`,
    monthFe: row.month,
    cluster: `${row.officeName}||${row.storeName}`,
  }));

  const storeValues = preparedRows.map((row) => row.storeSize);
  const crewValues = preparedRows.map((row) => row.crewSize);
  const zStore = zNormalize(storeValues);
  const zCrew = zNormalize(crewValues);

  preparedRows.forEach((row, index) => {
    row.storeSize = zStore[index];
    row.crewSize = zCrew[index];
  });

  return { rows: preparedRows };
}

function fitRegressionWithFixedEffects(prepared) {
  const y = prepared.rows.map((row) => row.outcome);
  const xStore = prepared.rows.map((row) => row.storeSize);
  const xCrew = prepared.rows.map((row) => row.crewSize);
  const xIndicator = prepared.rows.map((row) => row.indicator);
  const storeGroups = prepared.rows.map((row) => row.storeFe);
  const monthGroups = prepared.rows.map((row) => row.monthFe);

  const residualized = demeanTwoWay(
    [y, xStore, xCrew, xIndicator],
    storeGroups,
    monthGroups,
    FE_DEMEAN_ITERS,
  );

  const yRes = residualized[0];
  const X = yRes.map((_, index) => [
    residualized[1][index],
    residualized[2][index],
    residualized[3][index],
  ]);
  const fit = olsFitNoIntercept(X, yRes);
  if (!fit) {
    return null;
  }

  const clusterIds = prepared.rows.map((row) => row.cluster);
  const clusterVariance = clusterRobustVariance(
    X,
    fit.residuals,
    fit.xtxInv,
    clusterIds,
  );
  if (!clusterVariance) {
    return null;
  }
  const se = clusterVariance.map((value) => Math.sqrt(Math.max(value, 0)));

  return {
    beta: fit.beta,
    se,
    residuals: fit.residuals,
  };
}

function runRobustnessChecks(storeGroups, supervisorId) {
  return {
    shift: runRobustnessForOutcome(storeGroups, supervisorId, "avgShiftLength"),
    crew: runRobustnessForOutcome(storeGroups, supervisorId, "crewQuality"),
  };
}

function runRobustnessForOutcome(storeGroups, supervisorId, outcomeKey) {
  const rows = storeGroups.filter(
    (group) =>
      Number.isFinite(group[outcomeKey]) &&
      Number.isFinite(group.storeSize) &&
      group.storeSize > 0 &&
      Number.isFinite(group.crewSize) &&
      group.crewSize > 0,
  );

  if (rows.length < 25) {
    return null;
  }

  const selectedCount = rows.filter(
    (row) => row.supervisorId === supervisorId,
  ).length;
  if (selectedCount < MIN_SHIFTS_FOR_SIGNIFICANCE) {
    return null;
  }

  const prepared = prepareRegressionRows(rows, supervisorId, outcomeKey);
  const fit = fitRegressionWithFixedEffects(prepared);
  if (!fit || !Number.isFinite(fit.beta[2])) {
    return null;
  }

  const observed = fit.beta[2];
  const permuted = [];
  const bootstrapped = [];
  const baseRows = prepared.rows;

  for (let i = 0; i < ROBUSTNESS_ITERATIONS; i += 1) {
    const permutationIndicators = shuffleArray(
      baseRows.map((row) => row.indicator),
    );
    const permRows = baseRows.map((row, index) => ({
      ...row,
      indicator: permutationIndicators[index],
    }));
    const permFit = fitRegressionWithFixedEffects({ rows: permRows });
    if (permFit && Number.isFinite(permFit.beta[2])) {
      permuted.push(permFit.beta[2]);
    }

    const bootRows = sampleWithReplacement(baseRows);
    const bootFit = fitRegressionWithFixedEffects({ rows: bootRows });
    if (bootFit && Number.isFinite(bootFit.beta[2])) {
      bootstrapped.push(bootFit.beta[2]);
    }
  }

  const permutationP = twoTailedEmpiricalP(observed, permuted);
  const bootstrapP = twoTailedEmpiricalP(observed, bootstrapped);

  return {
    observed,
    permutationP,
    bootstrapP,
    iterations: ROBUSTNESS_ITERATIONS,
  };
}

function renderVerdict(
  selected,
  company,
  selectedRegression,
  robustness,
  reliability,
  trendDecomposition,
  groupCount,
) {
  if (!selected) {
    renderEmptyState("Select a supervisor to run the analysis.");
    return;
  }

  const shiftModel = selectedRegression.shift;
  const crewModel = selectedRegression.crew;
  const shiftDiff = selected.avgShiftLength - company.avgShiftLength;
  const crewDiff = selected.avgCrewQuality - company.avgCrewQuality;
  const robustShift = robustness?.shift;
  const robustCrew = robustness?.crew;

  let verdictClass = "neutral";
  const statements = [];

  if (
    shiftModel &&
    shiftModel.significantReliable &&
    shiftModel.coefficient > 0
  ) {
    statements.push(
      `After controls (store FE, month FE, crew size, store size), shift length is higher by ${formatHours(shiftModel.coefficient)} (clustered p=${formatPValue(shiftModel.pValue)}).`,
    );
    verdictClass = "bad";
  } else if (
    shiftModel &&
    shiftModel.significantReliable &&
    shiftModel.coefficient < 0
  ) {
    statements.push(
      `After controls, shift length is lower by ${formatHours(Math.abs(shiftModel.coefficient))} (clustered p=${formatPValue(shiftModel.pValue)}).`,
    );
    verdictClass = "good";
  } else {
    statements.push(
      "No reliable statistically significant adjusted shift-length difference was detected.",
    );
    verdictClass = "warn";
  }

  if (crewModel && crewModel.significantReliable && crewModel.coefficient < 0) {
    statements.push(
      `Crew quality is lower by ${formatIndex(Math.abs(crewModel.coefficient))} after controls (clustered p=${formatPValue(crewModel.pValue)}).`,
    );
    verdictClass = "bad";
  } else if (
    crewModel &&
    crewModel.significantReliable &&
    crewModel.coefficient > 0
  ) {
    statements.push(
      `Crew quality is higher by ${formatIndex(crewModel.coefficient)} after controls (clustered p=${formatPValue(crewModel.pValue)}).`,
    );
    if (verdictClass !== "bad") {
      verdictClass = "good";
    }
  } else {
    statements.push(
      "No reliable statistically significant adjusted crew-quality difference was detected.",
    );
    if (verdictClass === "neutral") {
      verdictClass = "warn";
    }
  }

  if (reliability.tier === "Low") {
    statements.push(
      "Reliability is low due to small selected-supervisor shift count, so significance labels are suppressed.",
    );
  } else {
    if (robustShift) {
      statements.push(
        `Shift robustness: bootstrap p=${formatPValue(robustShift.bootstrapP)}, permutation p=${formatPValue(robustShift.permutationP)}.`,
      );
    }
    if (robustCrew) {
      statements.push(
        `Crew robustness: bootstrap p=${formatPValue(robustCrew.bootstrapP)}, permutation p=${formatPValue(robustCrew.permutationP)}.`,
      );
    }
  }

  if (trendDecomposition) {
    statements.push(`Trend decomposition: ${trendDecomposition.summary}`);
  }

  const summary = [
    `${selected.supervisorLabel} is supervising ${selected.shiftCount.toLocaleString()} shifts in the current scope.`,
    `Reliability: ${reliability.tier}.`,
    `Raw shift difference vs company average: ${formatSignedHours(shiftDiff)}.`,
    `Raw crew quality difference vs company average: ${formatSignedIndex(crewDiff)}.`,
    `Model sample includes ${groupCount.toLocaleString()} store-level shifts.`,
    ...statements,
  ];

  dom.verdictBox.className = `verdict ${verdictClass}`;
  dom.verdictText.textContent = summary.join(" ");
}

function renderCards(selected, company, reliability) {
  const cards = [
    {
      label: "Shifts Supervised",
      value: selected.shiftCount.toLocaleString(),
      sub: "Store-level shifts",
    },
    {
      label: "Unique Employees",
      value: selected.uniqueEmployees.toLocaleString(),
      sub: "Crew members assigned",
    },
    {
      label: "Avg Shift Delta",
      value: formatSignedHours(
        selected.avgShiftLength - company.avgShiftLength,
      ),
      sub: `Selected ${formatHours(selected.avgShiftLength)} vs Company ${formatHours(company.avgShiftLength)}`,
    },
    {
      label: "Crew Quality Delta",
      value: formatSignedIndex(
        selected.avgCrewQuality - company.avgCrewQuality,
      ),
      sub: `Selected ${formatIndex(selected.avgCrewQuality)} vs Company ${formatIndex(company.avgCrewQuality)}`,
    },
    {
      label: "Pieces/Hr Delta",
      value: formatSignedNumber(
        selected.avgPiecesPerHr - company.avgPiecesPerHr,
        1,
      ),
      sub: `Selected ${formatNumber(selected.avgPiecesPerHr, 1)} vs Company ${formatNumber(company.avgPiecesPerHr, 1)}`,
    },
    {
      label: "Store Size Delta",
      value: formatSignedNumber(
        selected.avgStoreSize - company.avgStoreSize,
        0,
      ),
      sub: `Selected ${formatStoreSize(selected.avgStoreSize)} vs Company ${formatStoreSize(company.avgStoreSize)}`,
    },
    {
      label: "Reliability",
      value: reliability.tier,
      sub: "Based on selected supervisor shift count",
    },
  ];

  dom.kpiCards.innerHTML = cards
    .map(
      (card) => `
        <article class="card">
          <div class="card-label">${escapeHtml(card.label)}</div>
          <div class="card-value">${escapeHtml(card.value)}</div>
          <div class="card-sub">${escapeHtml(card.sub)}</div>
        </article>
      `,
    )
    .join("");
}

function renderSelectedVsCompanyTable(selected, company) {
  const rows = [
    {
      label: "Avg Shift Length (hrs)",
      selected: formatHours(selected.avgShiftLength),
      company: formatHours(company.avgShiftLength),
      diff: formatSignedHours(selected.avgShiftLength - company.avgShiftLength),
    },
    {
      label: "Crew Quality Index",
      selected: formatIndex(selected.avgCrewQuality),
      company: formatIndex(company.avgCrewQuality),
      diff: formatSignedIndex(selected.avgCrewQuality - company.avgCrewQuality),
    },
    {
      label: "Avg PiecesPerHr",
      selected: formatNumber(selected.avgPiecesPerHr, 1),
      company: formatNumber(company.avgPiecesPerHr, 1),
      diff: formatSignedNumber(
        selected.avgPiecesPerHr - company.avgPiecesPerHr,
        1,
      ),
    },
    {
      label: "Avg DollarPerHr",
      selected: formatMoneyLike(selected.avgDollarPerHr),
      company: formatMoneyLike(company.avgDollarPerHr),
      diff: formatSignedMoneyLike(
        selected.avgDollarPerHr - company.avgDollarPerHr,
      ),
    },
    {
      label: "Avg SkusPerHr",
      selected: formatNumber(selected.avgSkusPerHr, 1),
      company: formatNumber(company.avgSkusPerHr, 1),
      diff: formatSignedNumber(selected.avgSkusPerHr - company.avgSkusPerHr, 1),
    },
    {
      label: "Avg Store Size",
      selected: formatStoreSize(selected.avgStoreSize),
      company: formatStoreSize(company.avgStoreSize),
      diff: formatSignedStoreSize(selected.avgStoreSize - company.avgStoreSize),
    },
  ];

  dom.comparisonBody.innerHTML = rows
    .map((row) => {
      const diffClass = classifySigned(row.diff);
      return `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(row.selected)}</td>
          <td>${escapeHtml(row.company)}</td>
          <td class="${diffClass}">${escapeHtml(row.diff)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderSupervisorTable(summaries, regressions, selectedSupervisorId) {
  dom.allSuperBody.innerHTML = summaries
    .map((summary) => {
      const regression = regressions.get(summary.supervisorId) || {};
      const reliability = getReliabilityTier(summary.shiftCount);
      const shiftText = formatRegressionCell(
        regression.shift,
        formatHours,
        true,
        reliability,
      );
      const crewText = formatRegressionCell(
        regression.crew,
        formatIndex,
        true,
        reliability,
      );
      const rowClass =
        summary.supervisorId === selectedSupervisorId ? "selected-row" : "";
      const reliabilityClass =
        reliability.tier === "High"
          ? "num-pos"
          : reliability.tier === "Medium"
            ? "num-warn"
            : "muted";
      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(summary.supervisorLabel)}</td>
          <td>${escapeHtml(String(summary.shiftCount))}</td>
          <td>${escapeHtml(String(summary.uniqueEmployees))}</td>
          <td>${escapeHtml(formatHours(summary.avgShiftLength))}</td>
          <td>${escapeHtml(formatIndex(summary.avgCrewQuality))}</td>
          <td>${escapeHtml(formatNumber(summary.avgPiecesPerHr, 1))}</td>
          <td>${escapeHtml(formatMoneyLike(summary.avgDollarPerHr))}</td>
          <td>${escapeHtml(formatNumber(summary.avgSkusPerHr, 1))}</td>
          <td>${escapeHtml(formatStoreSize(summary.avgStoreSize))}</td>
          <td class="${shiftText.className}">${escapeHtml(shiftText.text)}</td>
          <td class="${crewText.className}">${escapeHtml(crewText.text)}</td>
          <td class="${reliabilityClass}">${escapeHtml(reliability.tier)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderCharts(
  summaries,
  storeGroups,
  selectedSupervisorId,
  companySummary,
  trendRows,
) {
  renderBarChart(
    dom.shiftChart,
    summaries.map((item) => ({
      id: item.supervisorId,
      label: item.supervisorLabel,
      value: item.avgShiftLength,
    })),
    {
      selectedId: selectedSupervisorId,
      formatter: formatHours,
      companyReference: companySummary.avgShiftLength,
      highIsBad: true,
    },
  );

  renderBarChart(
    dom.crewChart,
    summaries.map((item) => ({
      id: item.supervisorId,
      label: item.supervisorLabel,
      value: item.avgCrewQuality,
    })),
    {
      selectedId: selectedSupervisorId,
      formatter: formatIndex,
      companyReference: companySummary.avgCrewQuality,
      highIsBad: false,
    },
  );

  renderStoreSizeHistogram(
    dom.storeSizeChart,
    storeGroups.map((item) => item.storeSize),
  );
  renderTrendChart(dom.trendChart, trendRows);
  const trend = decomposeTrendGap(trendRows);
  dom.trendInsight.textContent = trend
    ? trend.summary
    : "Not enough monthly overlap for trend decomposition.";
}

function renderBarChart(container, rows, options) {
  const finiteRows = rows
    .filter((row) => Number.isFinite(row.value))
    .sort((left, right) => right.value - left.value);
  if (!finiteRows.length) {
    container.innerHTML = `<div class="chart-empty">No chart data in current scope.</div>`;
    return;
  }

  const maxValue = Math.max(...finiteRows.map((row) => row.value));
  const topRows = finiteRows.slice(0, 18);
  const reference = options.companyReference;

  container.innerHTML = `
    <div class="bar-list">
      ${topRows
        .map((row) => {
          const widthPct = maxValue > 0 ? (row.value / maxValue) * 100 : 0;
          let fillClass = "";
          if (Number.isFinite(reference)) {
            const isWorse = options.highIsBad
              ? row.value > reference
              : row.value < reference;
            const isMuchWorse = options.highIsBad
              ? row.value > reference * 1.08
              : row.value < reference * 0.92;
            if (isMuchWorse) {
              fillClass = " bad";
            } else if (isWorse) {
              fillClass = " warn";
            }
          }

          const rowLabel =
            row.id === options.selectedId
              ? `${row.label} (Selected)`
              : row.label;
          return `
            <div class="bar-row">
              <div class="bar-label">${escapeHtml(rowLabel)}</div>
              <div class="bar-track">
                <div class="bar-fill${fillClass}" style="width:${Math.max(2, widthPct).toFixed(1)}%"></div>
              </div>
              <div class="bar-value">${escapeHtml(options.formatter(row.value))}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderStoreSizeHistogram(container, values) {
  const finite = values.filter((value) => Number.isFinite(value) && value > 0);
  if (finite.length < 3) {
    container.innerHTML = `<div class="chart-empty">Not enough store-size values for a distribution chart.</div>`;
    return;
  }

  const binCount = 12;
  const minValue = Math.min(...finite);
  const maxValue = Math.max(...finite);
  const span = Math.max(maxValue - minValue, 1);
  const binSize = span / binCount;
  const bins = new Array(binCount).fill(0);

  finite.forEach((value) => {
    const rawIndex = Math.floor((value - minValue) / binSize);
    const index = Math.min(binCount - 1, Math.max(0, rawIndex));
    bins[index] += 1;
  });

  const maxBin = Math.max(...bins, 1);
  const barsHtml = bins
    .map((count) => {
      const heightPct = (count / maxBin) * 100;
      return `<div class="hist-bin" style="height:${Math.max(2, heightPct).toFixed(1)}%"></div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="histogram">${barsHtml}</div>
    <div class="hist-labels">
      <span>${escapeHtml(formatStoreSize(minValue))}</span>
      <span>${escapeHtml(formatStoreSize(maxValue))}</span>
    </div>
  `;
}

function buildMonthlyTrend(storeGroups, selectedSupervisorId) {
  const monthly = new Map();

  storeGroups.forEach((group) => {
    if (!Number.isFinite(group.avgShiftLength)) {
      return;
    }

    if (!monthly.has(group.month)) {
      monthly.set(group.month, {
        month: group.month,
        companySum: 0,
        companyCount: 0,
        selectedSum: 0,
        selectedCount: 0,
      });
    }

    const bucket = monthly.get(group.month);
    bucket.companySum += group.avgShiftLength;
    bucket.companyCount += 1;

    if (group.supervisorId === selectedSupervisorId) {
      bucket.selectedSum += group.avgShiftLength;
      bucket.selectedCount += 1;
    }
  });

  return Array.from(monthly.values())
    .map((bucket) => ({
      month: bucket.month,
      company: bucket.companyCount
        ? bucket.companySum / bucket.companyCount
        : Number.NaN,
      selected: bucket.selectedCount
        ? bucket.selectedSum / bucket.selectedCount
        : Number.NaN,
    }))
    .sort((left, right) => left.month.localeCompare(right.month));
}

function renderTrendChart(container, trendRows) {
  if (!trendRows.length) {
    container.innerHTML = `<div class="chart-empty">No monthly trend data.</div>`;
    return;
  }

  const width = 760;
  const height = 250;
  const padding = { left: 42, right: 16, top: 14, bottom: 34 };
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const xStep = trendRows.length > 1 ? usableWidth / (trendRows.length - 1) : 0;

  const allValues = trendRows
    .flatMap((row) => [row.company, row.selected])
    .filter((value) => Number.isFinite(value));
  if (!allValues.length) {
    container.innerHTML = `<div class="chart-empty">No finite monthly shift values.</div>`;
    return;
  }

  const yMinRaw = Math.min(...allValues);
  const yMaxRaw = Math.max(...allValues);
  const yPad = Math.max((yMaxRaw - yMinRaw) * 0.1, 0.2);
  const yMin = yMinRaw - yPad;
  const yMax = yMaxRaw + yPad;
  const ySpan = Math.max(yMax - yMin, 1e-6);

  const toX = (index) => padding.left + xStep * index;
  const toY = (value) =>
    padding.top + usableHeight * (1 - (value - yMin) / ySpan);

  const companyPath = buildLinePath(
    trendRows.map((row, index) =>
      Number.isFinite(row.company)
        ? { x: toX(index), y: toY(row.company) }
        : null,
    ),
  );
  const selectedPath = buildLinePath(
    trendRows.map((row, index) =>
      Number.isFinite(row.selected)
        ? { x: toX(index), y: toY(row.selected) }
        : null,
    ),
  );

  const gridLines = 4;
  const yGrid = [];
  for (let i = 0; i <= gridLines; i += 1) {
    const value = yMin + (ySpan * i) / gridLines;
    const y = toY(value);
    yGrid.push(
      `<line x1="${padding.left}" y1="${y.toFixed(2)}" x2="${(width - padding.right).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#d5dfdc" stroke-width="1"></line>`,
    );
    yGrid.push(
      `<text x="${(padding.left - 6).toFixed(2)}" y="${(y + 4).toFixed(2)}" text-anchor="end" fill="#59656d" font-size="10">${escapeHtml(formatNumber(value, 2))}</text>`,
    );
  }

  const firstLabel = trendRows[0]?.month || "";
  const middleLabel = trendRows[Math.floor(trendRows.length / 2)]?.month || "";
  const lastLabel = trendRows.at(-1)?.month || "";

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="240" role="img" aria-label="Monthly trend chart for selected supervisor and company average">
      ${yGrid.join("")}
      <line x1="${padding.left}" y1="${(height - padding.bottom).toFixed(2)}" x2="${(width - padding.right).toFixed(2)}" y2="${(height - padding.bottom).toFixed(2)}" stroke="#9eaead" stroke-width="1.2"></line>
      <path d="${companyPath}" fill="none" stroke="#1f6f89" stroke-width="2.4"></path>
      <path d="${selectedPath}" fill="none" stroke="#cf6b25" stroke-width="2.4"></path>
      <text x="${padding.left}" y="${height - 10}" fill="#59656d" font-size="10">${escapeHtml(firstLabel)}</text>
      <text x="${width / 2}" y="${height - 10}" text-anchor="middle" fill="#59656d" font-size="10">${escapeHtml(middleLabel)}</text>
      <text x="${width - padding.right}" y="${height - 10}" text-anchor="end" fill="#59656d" font-size="10">${escapeHtml(lastLabel)}</text>
    </svg>
    <div class="trend-legend">
      <span><span class="legend-chip chip-company"></span>Company Avg Shift</span>
      <span><span class="legend-chip chip-selected"></span>Selected Supervisor</span>
    </div>
  `;
}

function buildLinePath(points) {
  let path = "";
  let open = false;
  points.forEach((point) => {
    if (!point) {
      open = false;
      return;
    }
    const command = open ? "L" : "M";
    path += `${command}${point.x.toFixed(2)},${point.y.toFixed(2)} `;
    open = true;
  });
  return path.trim();
}

function renderStoreTable(storeGroups, selectedSupervisorId) {
  const rows = [...storeGroups]
    .sort((left, right) => {
      const dateDiff = right.date.localeCompare(left.date);
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return safeNumber(right.avgShiftLength) - safeNumber(left.avgShiftLength);
    })
    .slice(0, 140);

  dom.storeBody.innerHTML = rows
    .map((row) => {
      const rowClass =
        row.supervisorId === selectedSupervisorId ? "selected-row" : "";
      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(row.supervisorLabel)}</td>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.officeName)}</td>
          <td>${escapeHtml(row.storeName)}</td>
          <td>${escapeHtml(String(row.crewSize))}</td>
          <td>${escapeHtml(formatStoreSize(row.storeSize))}</td>
          <td>${escapeHtml(formatHours(row.avgShiftLength))}</td>
          <td>${escapeHtml(formatNumber(row.avgPiecesPerHr, 1))}</td>
          <td>${escapeHtml(formatMoneyLike(row.avgDollarPerHr))}</td>
          <td>${escapeHtml(formatNumber(row.avgSkusPerHr, 1))}</td>
          <td>${escapeHtml(formatIndex(row.crewQuality))}</td>
        </tr>
      `;
    })
    .join("");
}

function renderEmptyState(message) {
  dom.verdictBox.className = "verdict neutral";
  dom.verdictText.textContent = message;
  dom.kpiCards.innerHTML = "";
  dom.comparisonBody.innerHTML = `<tr><td colspan="4" class="muted">${escapeHtml(message)}</td></tr>`;
  dom.allSuperSummary.textContent = message;
  dom.allSuperBody.innerHTML = `<tr><td colspan="12" class="muted">${escapeHtml(message)}</td></tr>`;
  dom.shiftChart.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
  dom.crewChart.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
  dom.storeSizeChart.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
  dom.trendChart.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
  dom.trendInsight.textContent = message;
  dom.storeBody.innerHTML = `<tr><td colspan="11" class="muted">${escapeHtml(message)}</td></tr>`;
}

function setDataStatus(message, kind) {
  dom.dataStatus.textContent = message;
  if (kind === "bad") {
    dom.dataStatus.className = "meta num-neg";
  } else if (kind === "warn") {
    dom.dataStatus.className = "meta num-warn";
  } else {
    dom.dataStatus.className = "meta muted";
  }
}

function formatRegressionCell(model, formatter, withPValue, reliability) {
  if (!model) {
    return { text: "Insufficient data", className: "muted" };
  }
  if (reliability && reliability.tier === "Low") {
    return { text: "Suppressed (low sample)", className: "muted" };
  }

  const sign = model.coefficient > 0 ? "+" : "";
  const effect = `${sign}${formatter(model.coefficient)}`;
  const pText = withPValue
    ? ` (clustered p=${formatPValue(model.pValue)})`
    : "";
  let className = "muted";
  if (model.significantReliable) {
    className = model.coefficient > 0 ? "num-neg" : "num-pos";
  }
  return { text: `${effect}${pText}`, className };
}

function classifySigned(textValue) {
  if (textValue.startsWith("+")) {
    return "num-neg";
  }
  if (textValue.startsWith("-")) {
    return "num-pos";
  }
  return "";
}

function meanAndStd(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) {
    return { mean: Number.NaN, std: Number.NaN };
  }
  const meanValue =
    finite.reduce((sum, value) => sum + value, 0) / finite.length;
  if (finite.length < 2) {
    return { mean: meanValue, std: 0 };
  }
  const variance =
    finite.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) /
    (finite.length - 1);
  return { mean: meanValue, std: Math.sqrt(Math.max(variance, 0)) };
}

function zNormalize(values) {
  const stats = meanAndStd(values);
  if (
    !Number.isFinite(stats.mean) ||
    !Number.isFinite(stats.std) ||
    stats.std === 0
  ) {
    return values.map(() => 0);
  }
  return values.map((value) => (value - stats.mean) / stats.std);
}

function olsFit(X, y) {
  const n = X.length;
  if (!n || n !== y.length) {
    return null;
  }
  const k = X[0].length;
  if (n <= k + 1) {
    return null;
  }

  const Xt = transpose(X);
  const XtX = multiplyMatrices(Xt, X);
  const XtY = multiplyMatrixVector(Xt, y);
  const XtXInv = invertMatrix(XtX);
  if (!XtXInv) {
    return null;
  }

  const beta = multiplyMatrixVector(XtXInv, XtY);
  const residuals = X.map((row, index) => y[index] - dot(row, beta));
  const rss = residuals.reduce((sum, value) => sum + value * value, 0);
  const dof = n - k;
  if (dof <= 0) {
    return null;
  }

  const sigma2 = rss / dof;
  const se = [];
  for (let i = 0; i < k; i += 1) {
    se.push(Math.sqrt(Math.max(XtXInv[i][i] * sigma2, 0)));
  }

  return { beta, se, n, k, dof, rss };
}

function olsFitNoIntercept(X, y) {
  const n = X.length;
  if (!n || n !== y.length) {
    return null;
  }
  const k = X[0].length;
  if (n <= k + 1) {
    return null;
  }

  const Xt = transpose(X);
  const XtX = multiplyMatrices(Xt, X);
  const XtY = multiplyMatrixVector(Xt, y);
  const xtxInv = invertMatrix(XtX);
  if (!xtxInv) {
    return null;
  }

  const beta = multiplyMatrixVector(xtxInv, XtY);
  const residuals = X.map((row, index) => y[index] - dot(row, beta));
  return { beta, residuals, xtxInv };
}

function demeanTwoWay(vectors, groupA, groupB, iterations) {
  const output = vectors.map((vector) => vector.slice());
  for (let iter = 0; iter < iterations; iter += 1) {
    applyGroupDemean(output, groupA);
    applyGroupDemean(output, groupB);
  }
  return output;
}

function applyGroupDemean(vectors, groups) {
  const sums = new Map();
  const counts = new Map();

  groups.forEach((group, index) => {
    if (!sums.has(group)) {
      sums.set(
        group,
        vectors.map(() => 0),
      );
      counts.set(group, 0);
    }
    const sumRow = sums.get(group);
    counts.set(group, counts.get(group) + 1);
    for (let col = 0; col < vectors.length; col += 1) {
      sumRow[col] += vectors[col][index];
    }
  });

  const means = new Map();
  sums.forEach((sumRow, group) => {
    const count = counts.get(group) || 1;
    means.set(
      group,
      sumRow.map((value) => value / count),
    );
  });

  groups.forEach((group, index) => {
    const meanRow = means.get(group);
    for (let col = 0; col < vectors.length; col += 1) {
      vectors[col][index] -= meanRow[col];
    }
  });
}

function clusterRobustVariance(X, residuals, xtxInv, clusterIds) {
  const k = X[0]?.length || 0;
  if (!k || clusterIds.length !== X.length) {
    return null;
  }

  const meat = Array.from({ length: k }, () => Array(k).fill(0));
  const clusterScores = new Map();

  for (let i = 0; i < X.length; i += 1) {
    const cluster = clusterIds[i];
    if (!clusterScores.has(cluster)) {
      clusterScores.set(cluster, Array(k).fill(0));
    }
    const score = clusterScores.get(cluster);
    for (let col = 0; col < k; col += 1) {
      score[col] += X[i][col] * residuals[i];
    }
  }

  clusterScores.forEach((score) => {
    for (let r = 0; r < k; r += 1) {
      for (let c = 0; c < k; c += 1) {
        meat[r][c] += score[r] * score[c];
      }
    }
  });

  const left = multiplyMatrices(xtxInv, meat);
  const variance = multiplyMatrices(left, xtxInv);
  const clusterCount = clusterScores.size;
  const n = X.length;
  const correction =
    clusterCount > 1 && n > k
      ? (clusterCount / (clusterCount - 1)) * ((n - 1) / (n - k))
      : 1;
  const diagonal = [];
  for (let i = 0; i < k; i += 1) {
    diagonal.push(variance[i][i] * correction);
  }
  return diagonal;
}

function shuffleArray(values) {
  const copy = values.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function sampleWithReplacement(values) {
  const sample = [];
  for (let i = 0; i < values.length; i += 1) {
    sample.push(values[Math.floor(Math.random() * values.length)]);
  }
  return sample;
}

function twoTailedEmpiricalP(observed, samples) {
  const finite = samples.filter((value) => Number.isFinite(value));
  if (!finite.length || !Number.isFinite(observed)) {
    return Number.NaN;
  }
  const hits = finite.filter(
    (value) => Math.abs(value) >= Math.abs(observed),
  ).length;
  return (hits + 1) / (finite.length + 1);
}

function transpose(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function multiplyMatrices(a, b) {
  const rows = a.length;
  const cols = b[0].length;
  const shared = b.length;
  const out = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      let sum = 0;
      for (let k = 0; k < shared; k += 1) {
        sum += a[i][k] * b[k][j];
      }
      out[i][j] = sum;
    }
  }
  return out;
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0),
  );
}

function invertMatrix(matrix) {
  const size = matrix.length;
  const augmented = matrix.map((row, rowIndex) => [
    ...row.map((value) => value),
    ...Array.from({ length: size }, (_, colIndex) =>
      colIndex === rowIndex ? 1 : 0,
    ),
  ]);

  for (let col = 0; col < size; col += 1) {
    let pivotRow = col;
    let pivotValue = Math.abs(augmented[col][col]);

    for (let row = col + 1; row < size; row += 1) {
      const candidate = Math.abs(augmented[row][col]);
      if (candidate > pivotValue) {
        pivotValue = candidate;
        pivotRow = row;
      }
    }

    if (pivotValue < 1e-12) {
      return null;
    }

    if (pivotRow !== col) {
      const temp = augmented[col];
      augmented[col] = augmented[pivotRow];
      augmented[pivotRow] = temp;
    }

    const pivot = augmented[col][col];
    for (let j = 0; j < size * 2; j += 1) {
      augmented[col][j] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === col) {
        continue;
      }
      const factor = augmented[row][col];
      for (let j = 0; j < size * 2; j += 1) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  return augmented.map((row) => row.slice(size));
}

function dot(left, right) {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] * right[index];
  }
  return sum;
}

function normalCdf(value) {
  return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function canonicalizeKey(value) {
  return cleanText(value)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function cleanDisplayName(value) {
  const text = cleanText(value);
  if (!text) {
    return "";
  }
  const isAllCaps = /[A-Z]/.test(text) && text === text.toUpperCase();
  if (!isAllCaps) {
    return text;
  }
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseNumber(value) {
  if (value === null || value === undefined) {
    return Number.NaN;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  const cleaned = String(value)
    .replace(/[$,%\s]/g, "")
    .replaceAll(",", "");
  if (!cleaned) {
    return Number.NaN;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeDate(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 20000 &&
    value < 80000
  ) {
    return excelSerialToDate(value);
  }

  const text = cleanText(value);
  if (!text) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const excelCandidate = Number(text);
  if (
    Number.isFinite(excelCandidate) &&
    excelCandidate > 20000 &&
    excelCandidate < 80000
  ) {
    return excelSerialToDate(excelCandidate);
  }

  const slashDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashDate) {
    const month = Number(slashDate[1]);
    const day = Number(slashDate[2]);
    const yearRaw = Number(slashDate[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function dateToMs(dateText) {
  const normalized = normalizeDate(dateText);
  if (!normalized) {
    return Number.NaN;
  }
  const parsed = Date.parse(`${normalized}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function excelSerialToDate(serial) {
  const millis = Math.round((serial - 25569) * 86400000);
  const date = new Date(millis);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) {
    return Number.NaN;
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function getReliabilityTier(shiftCount) {
  if (
    !Number.isFinite(shiftCount) ||
    shiftCount < RELIABILITY_MEDIUM_SHIFT_COUNT
  ) {
    return { tier: "Low" };
  }
  if (shiftCount < RELIABILITY_HIGH_SHIFT_COUNT) {
    return { tier: "Medium" };
  }
  return { tier: "High" };
}

function decomposeTrendGap(trendRows) {
  const gaps = trendRows
    .map((row, index) => ({
      index,
      month: row.month,
      gap:
        Number.isFinite(row.selected) && Number.isFinite(row.company)
          ? row.selected - row.company
          : Number.NaN,
    }))
    .filter((row) => Number.isFinite(row.gap));

  if (gaps.length < 4) {
    return null;
  }

  const xMean = mean(gaps.map((row) => row.index));
  const yMean = mean(gaps.map((row) => row.gap));
  let numerator = 0;
  let denominator = 0;
  gaps.forEach((row) => {
    numerator += (row.index - xMean) * (row.gap - yMean);
    denominator += (row.index - xMean) ** 2;
  });
  const slope = denominator > 0 ? numerator / denominator : 0;

  const absValues = gaps.map((row) => Math.abs(row.gap)).sort((a, b) => b - a);
  const topCount = Math.max(1, Math.floor(absValues.length * 0.25));
  const topShare =
    absValues.slice(0, topCount).reduce((sum, value) => sum + value, 0) /
    Math.max(
      absValues.reduce((sum, value) => sum + value, 0),
      1e-6,
    );

  let pattern = "stable";
  if (slope > 0.07) {
    pattern = "worsening";
  } else if (slope < -0.07) {
    pattern = "improving";
  }

  const concentrated =
    topShare > 0.55 ? "concentrated in a short period" : "spread over time";
  const summary = `Gap appears ${pattern} month-to-month and is ${concentrated}.`;

  return { slope, topShare, summary };
}

function exportAuditCsv() {
  if (!state.lastAnalysis) {
    setDataStatus("Run analysis before exporting audit output.", "warn");
    return;
  }

  const analysis = state.lastAnalysis;
  const rows = [];
  rows.push(["section", "key", "value"]);
  rows.push(["metadata", "generated_at", analysis.generatedAt]);
  rows.push([
    "metadata",
    "selected_supervisor",
    analysis.selectedSupervisorLabel,
  ]);
  rows.push([
    "metadata",
    "selected_supervisor_id",
    analysis.selectedSupervisorId,
  ]);
  rows.push([
    "metadata",
    "scoped_store_shifts",
    String(analysis.scopedShiftCount),
  ]);
  rows.push(["filter", "office", analysis.filters.office]);
  rows.push(["filter", "inventory_type", analysis.filters.type]);
  rows.push(["filter", "start_date", analysis.filters.startDate || ""]);
  rows.push(["filter", "end_date", analysis.filters.endDate || ""]);
  rows.push(["method", "fixed_effects", "store + month"]);
  rows.push([
    "method",
    "controls",
    "log_store_size + crew_size + supervisor_indicator",
  ]);
  rows.push(["method", "clustered_standard_errors", "store"]);
  rows.push(["method", "robustness_checks", "bootstrap + permutation"]);
  rows.push([
    "method",
    "crew_quality",
    "recency-weighted employee baseline, supervisor excluded where possible",
  ]);

  const shiftModel = analysis.selectedRegression.shift;
  const crewModel = analysis.selectedRegression.crew;
  const robustShift = analysis.selectedRobustness?.shift;
  const robustCrew = analysis.selectedRobustness?.crew;

  rows.push([
    "selected_model_shift",
    "coefficient",
    formatRawNumber(shiftModel?.coefficient),
  ]);
  rows.push([
    "selected_model_shift",
    "clustered_p",
    formatRawNumber(shiftModel?.pValue),
  ]);
  rows.push([
    "selected_model_shift",
    "bootstrap_p",
    formatRawNumber(robustShift?.bootstrapP),
  ]);
  rows.push([
    "selected_model_shift",
    "permutation_p",
    formatRawNumber(robustShift?.permutationP),
  ]);
  rows.push([
    "selected_model_crew",
    "coefficient",
    formatRawNumber(crewModel?.coefficient),
  ]);
  rows.push([
    "selected_model_crew",
    "clustered_p",
    formatRawNumber(crewModel?.pValue),
  ]);
  rows.push([
    "selected_model_crew",
    "bootstrap_p",
    formatRawNumber(robustCrew?.bootstrapP),
  ]);
  rows.push([
    "selected_model_crew",
    "permutation_p",
    formatRawNumber(robustCrew?.permutationP),
  ]);
  rows.push(["selected_model", "reliability", analysis.reliability.tier]);

  rows.push([]);
  rows.push([
    "supervisor_summary",
    "supervisor",
    "shifts",
    "unique_employees",
    "avg_shift_hrs",
    "avg_crew_quality",
    "avg_pieces_per_hr",
    "avg_dollar_per_hr",
    "avg_skus_per_hr",
    "avg_store_size",
    "adj_shift_effect",
    "adj_shift_clustered_p",
    "adj_crew_effect",
    "adj_crew_clustered_p",
    "reliability",
  ]);

  analysis.summaries.forEach((summary) => {
    const model = analysis.regressions.get(summary.supervisorId) || {};
    rows.push([
      "supervisor_summary",
      summary.supervisorLabel,
      String(summary.shiftCount),
      String(summary.uniqueEmployees),
      formatRawNumber(summary.avgShiftLength),
      formatRawNumber(summary.avgCrewQuality),
      formatRawNumber(summary.avgPiecesPerHr),
      formatRawNumber(summary.avgDollarPerHr),
      formatRawNumber(summary.avgSkusPerHr),
      formatRawNumber(summary.avgStoreSize),
      formatRawNumber(model.shift?.coefficient),
      formatRawNumber(model.shift?.pValue),
      formatRawNumber(model.crew?.coefficient),
      formatRawNumber(model.crew?.pValue),
      getReliabilityTier(summary.shiftCount).tier,
    ]);
  });

  const csvText = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const fileName = `supervisor_audit_${analysis.generatedAt.slice(0, 10)}.csv`;
  triggerCsvDownload(fileName, csvText);
  setDataStatus(`Exported ${fileName}`, "muted");
}

function formatSupervisorLabel(supervisorId) {
  const key = cleanText(supervisorId);
  const name = state.employeeNames.get(key);
  if (name) {
    return name;
  }
  return `Supervisor ${supervisorId}`;
}

function formatHours(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(2)} hrs`;
}

function formatSignedHours(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)} hrs`;
}

function formatIndex(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(1);
}

function formatSignedIndex(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatStoreSize(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return Math.round(value).toLocaleString();
}

function formatSignedStoreSize(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}`;
}

function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(decimals);
}

function formatSignedNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

function formatMoneyLike(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `$${value.toFixed(2)}`;
}

function formatSignedMoneyLike(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}$${value.toFixed(2)}`;
}

function formatPValue(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (value < 0.001) {
    return "<0.001";
  }
  return value.toFixed(3);
}

function formatRawNumber(value) {
  if (!Number.isFinite(value)) {
    return "";
  }
  return String(value);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!text.includes(",") && !text.includes('"') && !text.includes("\n")) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function triggerCsvDownload(fileName, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
