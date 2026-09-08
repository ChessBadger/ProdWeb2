import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/scheduleplanningapp.js", import.meta.url), "utf8")
  .replace("bootstrapAuth();", "");
const context = vm.createContext({
  window: { location: { search: "" } },
  document: { getElementById: () => null, querySelector: () => null },
  URLSearchParams, console,
});
vm.runInContext(source, context);
vm.runInContext(`
  state.global.medianEmployeeSpeed = 100;
  state.stores.set("k", { account: "KROGER" });
  state.selectedStoreKey = "k";
  const raw = { Employee: 1, StoreName: "KROGER 1", AccountName: "KROGER",
    DateOfInv: "2026-09-01", Expr1: 1, PiecesPerHr: 200, AVG_DELTA: 2 };
  const modasRow = normalizeRow(raw);
  const regularRow = normalizeRow({ ...raw, AVG_DELTA: 0, PiecesPerHr: 100, DateOfInv: "2026-08-01" });
  const employee = buildEmployeeStats([modasRow, regularRow]).get("1");
  employee.modasAccountStats = buildEmployeeStats([modasRow]).get("1").accountStats;
  employee.regularAccountStats = buildEmployeeStats([regularRow]).get("1").accountStats;
  globalThis.results = {
    classified: modasRow.isModas && !regularRow.isModas && !normalizeRow({ ...raw, AVG_DELTA: undefined }).isModas,
    defaultMode: getStoreModasMode(),
    modas: getEmployeePlanningSpeedSource(employee, "KROGER", true).speed,
    regular: getEmployeePlanningSpeedSource(employee, "KROGER", false).speed,
    historical: resolveEmployeePlanningBaseSpeed(employee, "KROGER", { inventoryMode: null }),
    original: getEmployeePlanningSpeedSource(employee, "KROGER", null).speed,
    recentOverride: resolveEmployeePlanningBaseSpeed(employee, "KROGER", { useRecentAccountProduction: true }),
  };
  state.modasByStore.k = false;
  results.override = getStoreModasMode();
  delete employee.modasAccountStats;
  results.fallback = getEmployeePlanningSpeedSource(employee, "KROGER", true).speed;
`, context);
const r = context.results;
assert.equal(r.classified, true);
assert.equal(r.defaultMode, true);
assert.equal(r.override, false);
assert.equal(r.modas, 185); // One Modas inventory: 85/15; no account median in this fixture.
assert.equal(r.regular, 108);
assert.equal(r.historical, r.original);
assert.equal(r.fallback, r.original);
assert.equal(r.recentOverride, r.modas);
console.log("Modas classification, defaults, weighting, fallback, and historical isolation passed.");


vm.runInContext(`
  const stat = (speed, count) => ({ avgPiecesPerHr: speed, avgPiecesPerHrRecent: speed, jobCount: count });
  const counter = { employee: "counter", accountStats: { kroger: stat(3000, 20) },
    modasAccountStats: { kroger: stat(1000, 5) }, regularAccountStats: { kroger: stat(3000, 20) } };
  const peer = { employee: "peer", accountStats: { kroger: stat(3000, 20) },
    modasAccountStats: { kroger: stat(1200, 10) } };
  state.employees = new Map([["counter", counter], ["peer", peer]]);
  state.modasMedianCache.clear();
  state.peerAccountEstimateCache.clear();
  state.global.medianEmployeeSpeed = 5000;
  globalThis.adaptive = {
    weights: [1, 2, 3, 4, 5, 20].map(getModasHistoryWeight),
    experienced: getEmployeePlanningSpeedSource(counter, "KROGER", true).speed,
  };
  counter.modasAccountStats.kroger.jobCount = 1;
  adaptive.sparse = getEmployeePlanningSpeedSource(counter, "KROGER", true).speed;
  state.employees.set("peer2", { ...peer, employee: "peer2" });
  counter.modasAccountStats = {};
  adaptive.peer = getEmployeePlanningSpeedSource(counter, "KROGER", true);
  adaptive.unknown = getEmployeePlanningSpeedSource(null, "KROGER", true);
`, context);
assert.deepEqual(Array.from(context.adaptive.weights), [0.85, 0.9, 0.95, 0.95, 1, 1]);
assert.equal(context.adaptive.experienced, 1000);
assert.equal(context.adaptive.sparse, 1140); // 20% of 1300 + 80% of account median 1100.
assert.equal(context.adaptive.peer.source, "modasPeer");
assert.equal(context.adaptive.peer.speed, 1200);
assert.equal(context.adaptive.unknown.source, "modasMedian");
assert.equal(context.adaptive.unknown.speed, 1100);
console.log("Adaptive Modas weights, confidence adjustment, peer and median fallbacks passed.");
