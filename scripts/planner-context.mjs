import { readFileSync } from "node:fs";
import vm from "node:vm";

export function createPlannerContext() {
  const context = vm.createContext({
    window: { location: { search: "?precomputeAnalytics=1" } },
    document: { getElementById: () => null, querySelector: () => null },
    URLSearchParams, console, setTimeout, clearTimeout, performance,
  });
  for (const name of ["durationmodel.js", "scheduleplanningapp.js"]) {
    const source = readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8").replace("bootstrapAuth();", "");
    vm.runInContext(source, context, { filename: name });
  }
  return context;
}

export function initializeData(context, rawJsonText) {
  context.rawJsonText = rawJsonText;
  vm.runInContext(`{
    state.rows = extractRowsFromJson(JSON.parse(rawJsonText)).map(normalizeRow).filter(row => row.valid);
    state.jobs = buildJobs(state.rows);
    state.stores = buildStoreStats(state.jobs);
    state.storesList = Array.from(state.stores.values());
    const employeeContext = buildDurationEmployeeContext(state.rows);
    state.employees = employeeContext.employees;
    state.global = buildGlobalStats(state.jobs, state.employees);
    state.durationHistory = DurationModel.createHistory(state.jobs);
    state.durationContextCache.clear();
    state.activeEmployeeIds = buildActiveEmployeeIds(extractRowsFromJson(JSON.parse(rawJsonText)), state.employees);
    state.dataFingerprint = buildDataFingerprintFromJsonText(rawJsonText);
  }`, context);
}
