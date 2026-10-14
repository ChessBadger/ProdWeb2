import {visitModes} from '../local_app/counting-mode.mjs';
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function createPlannerContext() {
  const context = vm.createContext({
    window: { location: { search: "?precomputeAnalytics=1" } },
    document: { getElementById: () => null, querySelector: () => null },
    URLSearchParams, console, setTimeout, clearTimeout, performance,
  });
  for (const name of ["durationmodel.js", "onsitemodel.js", "scheduleplanningapp.js"]) {
    const source = readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8").replace("bootstrapAuth();", "");
    vm.runInContext(source, context, { filename: name });
  }
  return context;
}

export function initializeData(context, rawJsonText) {
  context.rawJsonText = rawJsonText;
  const parsed=JSON.parse(rawJsonText);context.verifiedVisitModes=Object.fromEntries(visitModes(Object.values(parsed).filter(Array.isArray).flat()));
  vm.runInContext(`{
    state.historyMetadata = JSON.parse(rawJsonText)._meta || null;
    state.hasExplicitRoster = Array.isArray(state.historyMetadata?.latestEmployeeIds);
    state.rows = extractRowsFromJson(JSON.parse(rawJsonText)).map(normalizeRow).filter(row => row.valid);
    for(const row of state.rows)row.isModas=verifiedVisitModes[row.storeKey+'|'+row.date]??null;
    state.jobs = buildJobs(state.rows);
    state.stores = buildStoreStats(state.jobs);
    state.storesList = Array.from(state.stores.values());
    const employeeContext = buildDurationEmployeeContext(state.rows);
    state.employees = employeeContext.employees;
    state.global = buildGlobalStats(state.jobs, state.employees);
    state.durationHistory = DurationModel.createHistory(state.jobs);
    state.durationContextCache.clear();
    state.activeEmployeeIds = buildActiveEmployeeIds(state.hasExplicitRoster ? state.historyMetadata.latestEmployeeIds.map(Employee => ({ Employee })) : extractRowsFromJson(JSON.parse(rawJsonText)), state.employees);
    state.dataFingerprint = buildDataFingerprintFromJsonText(rawJsonText);
  }`, context);
}
