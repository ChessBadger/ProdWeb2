import assert from "node:assert/strict";
import vm from "node:vm";
import { createPlannerContext, initializeData } from "../scripts/planner-context.mjs";

const context = createPlannerContext();
const model = context.DurationModel;
const plain = value => JSON.parse(JSON.stringify(value));
const rateFor = id => ({ speed: id === "fast" ? 1000 : 100, known: true });
const job = (date, duration, extra = {}) => ({
  date, duration, storeKey: "a||s", accountKey: "a", account: "A", storeName: "S",
  typeOfInv: "Grocery", inventoryMode: true, employees: ["a", "b"], supervisorNumber: "sup", ...extra,
});
const plan = { ...model.historicalPlan(job("2026-03-01", 4)), employees: ["a", "b", "sup"] };
const config = { baseline: "last", elasticity: 0.5 };
const history = model.createHistory([job("2026-01-01", 4), job("2026-03-01", 800), job("2026-04-01", 999)]);
const prediction = model.predict(history, plan, rateFor, config);
assert.equal(prediction.baseDuration, 4, "same-date and future visits cannot affect a prediction");
assert.equal(prediction.onSiteDuration, 4, "an unrecorded supervisor must not create extra historical capacity");
assert.equal(prediction.crewSize, 3);
const nonCountingSupervisor = model.predict(history, { ...plan, modes: { supervisor: "none" } }, rateFor, config);
assert.equal(nonCountingSupervisor.crewSize, 3, "non-counting roles still belong to the crew");
assert.equal(nonCountingSupervisor.manHours, nonCountingSupervisor.onSiteDuration * 3);
assert.equal(nonCountingSupervisor.onSiteDuration, prediction.onSiteDuration, "missing supervisor production is unknown on both sides");
assert.equal(model.predict(history, { ...plan, roles: { supervisor: "sup", rx: ["a", "b"] }, modes: { supervisor: "none", rx: "none" } }, rateFor, config), null, "a crew explicitly assigned no counting contribution cannot produce a valid forecast");

const faster = model.predict(history, { ...plan, employees: ["a", "b", "fast", "sup"] }, rateFor, config);
assert.ok(faster.onSiteDuration < prediction.onSiteDuration);
assert.ok(faster.onSiteDuration >= prediction.baseDuration * 0.85);
const slower = model.predict(history, { ...plan, employees: ["a", "sup"], shrink: { percent: 99, mode: "all" } }, rateFor, config);
assert.ok(slower.onSiteDuration <= prediction.baseDuration * 1.20);

const changedPieces = model.createHistory([job("2026-01-01", 4, { totalPieces: 999999999, totalManHours: 100000 })]);
assert.equal(model.predict(changedPieces, plan, rateFor, config).onSiteDuration, prediction.onSiteDuration);
const matching = model.createHistory([job("2026-01-01", 5), job("2026-02-01", 9, { inventoryMode: false })]);
assert.equal(model.predict(matching, plan, rateFor, config).baseDuration, 5, "prefer matching counting mode");
const newStore = model.predict(history, { ...plan, storeKey: "new" }, rateFor, config);
assert.equal(newStore.hasStoreHistory, false);
assert.equal(newStore.crewAdjustmentFactor, 1, "do not infer crew capacity from unrelated stores");
const unknownModeHistory = model.createHistory([job("2026-01-01", 4, { inventoryMode: null })]);
assert.equal(model.prepare(unknownModeHistory, { ...plan, inventoryMode: null }, rateFor).samples[0].reliability, 0,
  "two unknown counting modes are not evidence for a compatible crew adjustment");
console.log("Duration baselines, date isolation, partial supervisors, headcount and adjustment limits passed.");

// Integration fixtures have enough dated visits for disjoint tuning and testing.
const rows = [];
for (let i = 0; i < 120; i++) {
  const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
  for (const employee of [1, 2]) rows.push({
    Employee: employee, SupervisorNumber: 99, AccountName: "KROGER", StoreName: "Store",
    DateOfInv: date, Expr1: 4 + (i % 3) / 10, Total_Ext_Qty: 400, PiecesPerHr: 100 + i,
    TypeOfInv: "Grocery", AVG_DELTA: 1,
  });
}
// A second inventory on a date must not see that date's other inventory's output.
rows.push({ ...rows[40], StoreName: "Other", PiecesPerHr: 99999 });
initializeData(context, JSON.stringify({ sheet: rows }));
const firstReplay = await vm.runInContext("buildDurationReplayRecords(state.rows, state.jobs)", context);
context.replay = firstReplay;
const analytics = vm.runInContext("DurationModel.analyze(replay, state.jobs)", context);
assert.ok(analytics.validationEnd < analytics.testMetrics.splitDate);
assert.equal(analytics.testMetrics.attempted, analytics.testMetrics.jobs);
context.analytics = analytics;

vm.runInContext(`
  state.selectedStoreKey = "KROGER||Store";
  state.selectedRolesByStore[state.selectedStoreKey] = { supervisor: "1", rx: ["2"], training: ["1"], earlyLate: [] };
  state.modasByStore[state.selectedStoreKey] = false;
  state.roleModesByStore[state.selectedStoreKey] = { supervisor: "none", training: "none" };
  state.useRecentAccountProduction = true;
  state.global.medianEmployeeSpeed = 100000000;
`, context);
const secondReplay = await vm.runInContext("buildDurationReplayRecords(state.rows, state.jobs)", context);
assert.deepEqual(plain(secondReplay), plain(firstReplay), "saved UI roles/modes and global rates must not affect historical evaluation");

const changedRows = rows.map(row => row.DateOfInv >= analytics.testMetrics.splitDate
  ? { ...row, Expr1: row.Expr1 * 2, Total_Ext_Qty: 500000, PiecesPerHr: 500000 } : row);
initializeData(context, JSON.stringify({ sheet: changedRows }));
const changedReplay = await vm.runInContext("buildDurationReplayRecords(state.rows, state.jobs)", context);
context.changedReplay = changedReplay;
const changedAnalytics = vm.runInContext("DurationModel.analyze(changedReplay, state.jobs)", context);
assert.deepEqual(plain(changedAnalytics.config), plain(analytics.config), "test outcomes must not choose model parameters");
assert.deepEqual(plain(changedAnalytics.byAccount), plain(analytics.byAccount));
const firstTestInput = firstReplay.find(r => r.date >= analytics.testMetrics.splitDate).input;
assert.deepEqual(plain(changedReplay.find(r => r.date >= analytics.testMetrics.splitDate).input), plain(firstTestInput), "a held-out job's own production must not enter its prediction");
const sameDayDate = rows.at(-1).DateOfInv;
initializeData(context, JSON.stringify({ sheet: rows.map(row => row.StoreName === "Other" ? { ...row, PiecesPerHr: 2, Expr1: 100 } : row) }));
const sameDayReplay = await vm.runInContext("buildDurationReplayRecords(state.rows, state.jobs)", context);
assert.deepEqual(plain(sameDayReplay.find(r => r.date === sameDayDate && r.storeKey === "KROGER||Store").input), plain(firstReplay.find(r => r.date === sameDayDate && r.storeKey === "KROGER||Store").input), "another inventory on the same date cannot change a prediction");
console.log("Earlier-only employee history, same-day isolation, UI independence and untouched test selection passed.");

initializeData(context, JSON.stringify({ sheet: rows }));
vm.runInContext(`
  state.durationAnalytics = analytics;
  state.analyticsReady = true;
  state.selectedStoreKey = "KROGER||Store";
  state.selectedEmployees = new Set(["1", "2", "99"]);
  state.selectedRolesByStore[state.selectedStoreKey] = { supervisor: "99", rx: [], training: [], earlyLate: [] };
  state.roleModesByStore[state.selectedStoreKey] = { supervisor: "none" };
  state.useRecentAccountProduction = false;
  state.modasByStore[state.selectedStoreKey] = true;
  state.durationContextCache.clear();
  globalThis.live = predict();
  globalThis.assigned = predictForAssignedCrew(state.selectedStoreKey, ["1", "2", "99"], getRoleSelectionForStore(state.selectedStoreKey), getRoleModesForStore(state.selectedStoreKey));
  globalThis.replayed = computePredictionForJob({ ...state.jobs.filter(j => j.storeKey === state.selectedStoreKey).at(-1), date: live.plan.date, employees: ["1", "2", "99"], supervisorNumber: "99", inventoryMode: true }, state.stores.get(state.selectedStoreKey));
  globalThis.snapshot = buildAnalyticsSnapshot(state.dataFingerprint);
  globalThis.valid = isValidAnalyticsSnapshot(snapshot, state.dataFingerprint);
  globalThis.oldValid = isValidAnalyticsSnapshot({ ...snapshot, version: 7 }, state.dataFingerprint);
  globalThis.wrongDataValid = isValidAnalyticsSnapshot(snapshot, "different-data");
  applyAnalyticsSnapshot(JSON.parse(JSON.stringify(snapshot)));
  globalThis.restored = predict();
`, context);
assert.equal(context.live.onSiteDuration, context.assigned.onSiteDuration);
assert.equal(context.live.onSiteDuration, context.replayed.onSiteDuration);
assert.equal(context.live.crewSize, 3);
assert.equal(context.live.onSiteDuration, context.restored.onSiteDuration);
assert.equal(context.valid, true);
assert.equal(context.oldValid, false);
assert.equal(context.wrongDataValid, false);
console.log("Live, assigned-crew and replay parity plus snapshot invalidation/restore passed.");

const storage = new Map();
context.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
vm.runInContext(`
  state.historyMetadata = { snapshotId: "test-snapshot", latestExportSha256: "test-source-hash", importedAt: "2026-01-01T00:00:00Z" };
  state.scheduleByStoreKey.set(state.selectedStoreKey, [{ date: "2099-01-01", startTimeText: "8:00 AM", typeOfInv: "Grocery" }]);
  saveCurrentForecast(); saveCurrentForecast();
  globalThis.loggedOnce = readSavedForecasts();
  state.dataFingerprint = "next-export";
  saveCurrentForecast();
  globalThis.loggedTwice = readSavedForecasts();
  globalThis.midnightFallback = forecastScheduledStart({ date: "2099-01-01", startTimeText: "" });
`, context);
assert.equal(context.loggedOnce.length, 1, "identical previews should be deduplicated");
assert.equal(context.loggedOnce[0].sourceSnapshotId, "test-snapshot");
assert.equal(context.loggedOnce[0].sourceExportSha256, "test-source-hash");
assert.equal(context.loggedOnce[0].modelVersion, model.VERSION);
assert.ok(Date.parse(context.loggedOnce[0].savedAt) < Date.parse(context.loggedOnce[0].scheduledStart));
assert.equal(context.loggedTwice.length, 2, "a new export produces a new immutable forecast");
assert.deepEqual(plain(context.loggedOnce[0]), plain(context.loggedTwice[0]));
assert.ok(Number.isFinite(context.midnightFallback));
console.log("Forecast deduplication, immutable history and missing start time handling passed.");
