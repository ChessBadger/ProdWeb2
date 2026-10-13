import { readFileSync, writeFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { createPlannerContext, initializeData } from "./planner-context.mjs";

const context = createPlannerContext();
const historyPath = new URL("../public/data/EmployeeProductionHistory.json", import.meta.url);
initializeData(context, readFileSync(existsSync(historyPath) ? historyPath : new URL("../public/data/EmployeeProductionExport.json", import.meta.url), "utf8"));
const started = performance.now();
await vm.runInContext("calibrateDurationModel()", context);
const summary = vm.runInContext(`({
  modelVersion: DurationModel.VERSION, sourceJobs: state.jobs.length,
  config: state.durationAnalytics.config, byAccount: state.durationAnalytics.byAccount,
  validationJobs: state.durationAnalytics.validationJobs, validationEnd: state.durationAnalytics.validationEnd,
  calibrationJobs: state.durationAnalytics.calibrationJobs, interval: state.durationAnalytics.interval,
  evaluationPolicy: state.durationAnalytics.evaluationPolicy,
  test: state.durationAnalytics.testMetrics, benchmarks: state.durationAnalytics.benchmarks,
})`, context);
console.log(JSON.stringify({ ...summary, elapsedSeconds: (performance.now() - started) / 1000 }, null, 2));
if (process.argv.includes("--write-snapshot")) {
  const snapshot = vm.runInContext("buildAnalyticsSnapshot(state.dataFingerprint)", context);
  for (const dir of ["data", "public/data", "docs/data"]) {
    writeFileSync(new URL(`../${dir}/ScheduleAnalyticsSnapshot.json`, import.meta.url), JSON.stringify(snapshot, null, 2) + "\n");
  }
  console.log("Updated local analytics snapshots.");
}
