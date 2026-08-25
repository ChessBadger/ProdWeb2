import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmployeeRecord, Metric } from "../types";
import { METRIC_OPTIONS } from "../constants";
import {
  buildEmployeeProfile,
  buildExpectedAverageMap,
  buildGrowthRows,
  buildRampPoints,
  formatDelta,
  type ConfidenceLevel,
  type EmployeeGrowthRow,
  type EmployeeProfileSummary,
} from "../analytics/employeeAnalytics";
import { SortAscIcon, SortDescIcon } from "./icons/Icons";

interface GrowthInsightsPanelProps {
  data: EmployeeRecord[];
  overallData: EmployeeRecord[];
  metric: Metric;
  selectedEmployee: string;
  isDarkMode: boolean;
}

type GrowthStatus =
  | "Needs Review"
  | "Monitor"
  | "Growing"
  | "Returning"
  | "Stable"
  | "Low Sample";

type ViewFilter = "watchlist" | "needsPush" | "growing" | "returning" | "stable" | "all";

type SortKey =
  | "employee"
  | "riskScore"
  | "currentAvg"
  | "percentChange"
  | "trajectoryPercent"
  | "rankChange"
  | "expectedDelta"
  | "consistency"
  | "currentCount"
  | "status";

interface GrowthRiskRow extends EmployeeGrowthRow {
  profile: EmployeeProfileSummary | null;
  riskScore: number;
  status: GrowthStatus;
  reason: string;
  action: string;
  expectedDelta: number | null;
  consistency: number | null;
  trajectoryPercent: number | null;
}

const isNeedsPushCandidate = (row: GrowthRiskRow): boolean => {
  const expectedDeltaPercent = getExpectedDeltaPercent(row.expectedDelta, row.profile);
  const totalPeriodJobs = row.currentCount + row.previousCount;

  return (
    totalPeriodJobs >= 4 &&
    (row.profile?.records.length ?? 0) >= 5 &&
    expectedDeltaPercent !== null &&
    expectedDeltaPercent <= -10 &&
    (row.percentChange === null || row.percentChange > -12) &&
    (row.consistency ?? 0) >= 55
  );
};

const formatValue = (value: number | null, decimals = 2) =>
  value === null || !Number.isFinite(value) ? "-" : value.toFixed(decimals);

const confidenceClasses: Record<ConfidenceLevel, string> = {
  High: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Low: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

const statusClasses: Record<GrowthStatus, string> = {
  "Needs Review": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  Monitor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Growing: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  Returning: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  Stable: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  "Low Sample": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getExpectedDeltaPercent = (
  expectedDelta: number | null,
  profile: EmployeeProfileSummary | null
): number | null => {
  const expectedAverage = profile?.expectedAverage ?? null;
  if (
    expectedDelta === null ||
    expectedAverage === null ||
    !Number.isFinite(expectedAverage) ||
    expectedAverage === 0
  ) {
    return null;
  }
  return (expectedDelta / Math.abs(expectedAverage)) * 100;
};

const getIndividualTrajectoryPercent = (
  profile: EmployeeProfileSummary | null,
  metric: Metric
): number | null => {
  if (!profile || profile.records.length < 6) return null;
  const midpoint = Math.floor(profile.records.length / 2);
  const earlyRecords = profile.records.slice(0, midpoint);
  const recentRecords = profile.records.slice(midpoint);
  const earlyAverage =
    earlyRecords.reduce((sum, record) => sum + record[metric], 0) /
    earlyRecords.length;
  const recentAverage =
    recentRecords.reduce((sum, record) => sum + record[metric], 0) /
    recentRecords.length;
  if (!Number.isFinite(earlyAverage) || earlyAverage === 0) return null;
  return ((recentAverage - earlyAverage) / Math.abs(earlyAverage)) * 100;
};

const getReturnToFormPercent = (
  profile: EmployeeProfileSummary | null,
  metric: Metric
): number | null => {
  if (!profile || profile.records.length < 8) return null;
  const recentWindowSize = Math.min(3, profile.records.length);
  const priorRecords = profile.records.slice(0, -recentWindowSize);
  const recentWindow = profile.records.slice(-Math.min(3, profile.records.length));
  const priorBest = Math.max(...priorRecords.map((record) => record[metric]));
  const recentAverage =
    recentWindow.reduce((sum, record) => sum + record[metric], 0) /
    recentWindow.length;
  if (!Number.isFinite(priorBest) || priorBest === 0) return null;
  return ((recentAverage - priorBest) / Math.abs(priorBest)) * 100;
};

const buildGrowthRiskRow = (
  row: EmployeeGrowthRow,
  profile: EmployeeProfileSummary | null,
  metric: Metric
): GrowthRiskRow => {
  const totalPeriodJobs = row.currentCount + row.previousCount;
  const percentChange = row.percentChange;
  const expectedDelta = profile?.expectedDelta ?? null;
  const consistency = profile?.consistency ?? null;
  const expectedDeltaPercent = getExpectedDeltaPercent(expectedDelta, profile);
  const trajectoryPercent = getIndividualTrajectoryPercent(profile, metric);
  const returnToFormPercent = getReturnToFormPercent(profile, metric);

  if (totalPeriodJobs < 4 || !profile || profile.records.length < 5) {
    return {
      ...row,
      profile,
      riskScore: 0,
      status: "Low Sample",
      reason: "Not enough recent work to judge confidently",
      action: "Collect more jobs before treating the trend as meaningful.",
      expectedDelta,
      consistency,
      trajectoryPercent,
    };
  }

  const isNearExpected =
    expectedDeltaPercent !== null && Math.abs(expectedDeltaPercent) <= 8;
  const isStableHighConfidence =
    isNearExpected && (consistency ?? 0) >= 75 && totalPeriodJobs >= 8;
  const isImprovingIndividually =
    (percentChange !== null && percentChange >= 12) ||
    (trajectoryPercent !== null && trajectoryPercent >= 16);
  const isStrongIndividualGrowth =
    (percentChange !== null && percentChange >= 18) ||
    (trajectoryPercent !== null && trajectoryPercent >= 25);
  const isReturningToForm =
    isImprovingIndividually &&
    returnToFormPercent !== null &&
    returnToFormPercent < -8;
  const shrinkRisk =
    percentChange !== null && percentChange < 0
      ? clamp(Math.abs(percentChange) * 1.5, 0, 40)
      : 0;
  const benchmarkRisk =
    expectedDelta !== null && expectedDelta < 0
      ? clamp(Math.abs(expectedDelta) * 1.3, 0, 30) *
        (isStrongIndividualGrowth ? 0.25 : isImprovingIndividually ? 0.5 : 1)
      : 0;
  const consistencyRisk =
    consistency !== null && consistency < 70 ? clamp((70 - consistency) * 0.6, 0, 20) : 0;
  const volumeRisk = row.currentCount < 3 ? 10 : 0;
  const growthCredit = isImprovingIndividually
    ? clamp(Math.max(percentChange ?? 0, trajectoryPercent ?? 0) * 0.85, 0, 25)
    : 0;
  const riskScore = Math.round(
    clamp(shrinkRisk + benchmarkRisk + consistencyRisk + volumeRisk - growthCredit, 0, 100)
  );

  if (isStableHighConfidence && !isStrongIndividualGrowth && shrinkRisk === 0) {
    return {
      ...row,
      profile,
      riskScore,
      status: "Stable",
      reason: "Close to expectation with steady production",
      action:
        "Keep normal monitoring. The benchmark gap is small enough that individual consistency matters more than the raw difference.",
      expectedDelta,
      consistency,
      trajectoryPercent,
    };
  }

  if (
    isImprovingIndividually &&
    riskScore < 35 &&
    (consistency ?? 0) >= 55 &&
    shrinkRisk === 0
  ) {
    return {
      ...row,
      profile,
      riskScore,
      status: isReturningToForm ? "Returning" : "Growing",
      reason:
        isReturningToForm
          ? "Recent jobs are rebounding but still below earlier form"
          : expectedDelta !== null && expectedDelta < -5
          ? "Improving individually while still below group benchmark"
          : "Individual production trend is improving",
      action:
        isReturningToForm
          ? "Treat this as recovery: reinforce the recent rebound, but compare the next jobs against the earlier baseline before calling it growth."
          : "Prioritize the growth trend: keep monitoring the benchmark gap, but reinforce the habits shown in recent jobs.",
      expectedDelta,
      consistency,
      trajectoryPercent,
    };
  }

  if (riskScore >= 55) {
    return {
      ...row,
      profile,
      riskScore,
      status: "Needs Review",
      reason:
        percentChange !== null && percentChange <= -12
          ? "Production is shrinking versus the prior 30 days"
          : expectedDelta !== null && expectedDelta <= -10
            ? "Below expected benchmark for similar work"
            : "Multiple growth-risk signals are elevated",
      action:
        "Review recent jobs, compare best/worst account context, and follow up with the supervisor on what changed.",
      expectedDelta,
      consistency,
      trajectoryPercent,
    };
  }

  if (riskScore >= 30) {
    return {
      ...row,
      profile,
      riskScore,
      status: "Monitor",
      reason:
        percentChange !== null && percentChange < 0
          ? "Recent production is drifting down"
          : "Performance is below expectation or inconsistent",
      action:
        "Watch the next few jobs and check whether the pattern repeats on the same account or store.",
      expectedDelta,
      consistency,
      trajectoryPercent,
    };
  }

  if (
    isStrongIndividualGrowth &&
    (consistency ?? 0) >= 55
  ) {
    return {
      ...row,
      profile,
      riskScore,
      status: isReturningToForm ? "Returning" : "Growing",
      reason: isReturningToForm
        ? "Strong recent rebound, but not above earlier form yet"
        : "Production is improving without a major benchmark concern",
      action:
        isReturningToForm
          ? "Recognize the rebound while keeping expectations anchored to the earlier performance level."
          : "Recognize the improvement and look at the best account/store context for repeatable habits.",
      expectedDelta,
      consistency,
      trajectoryPercent,
    };
  }

  return {
    ...row,
    profile,
    riskScore,
    status: "Stable",
    reason: "No major growth-risk signal",
    action: "No action needed beyond normal monitoring.",
    expectedDelta,
    consistency,
    trajectoryPercent,
  };
};

const GrowthInsightsPanel: React.FC<GrowthInsightsPanelProps> = ({
  data,
  overallData,
  metric,
  selectedEmployee,
  isDarkMode,
}) => {
  const [profileEmployee, setProfileEmployee] = useState(
    selectedEmployee === "all" ? "" : selectedEmployee
  );
  const [viewFilter, setViewFilter] = useState<ViewFilter>("watchlist");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const metricLabel =
    METRIC_OPTIONS.find((option) => option.value === metric)?.label || "Metric";

  const expectedMap = useMemo(
    () => buildExpectedAverageMap(overallData.length ? overallData : data, metric),
    [overallData, data, metric]
  );

  const growthRows = useMemo(() => buildGrowthRows(data, metric), [data, metric]);

  const employees = useMemo(
    () => Array.from(new Set(data.map((record) => record.employee))).sort(),
    [data]
  );

  const profileMap = useMemo(() => {
    const map = new Map<string, EmployeeProfileSummary>();
    employees.forEach((employee) => {
      const profile = buildEmployeeProfile(employee, data, metric, expectedMap);
      if (profile) map.set(employee, profile);
    });
    return map;
  }, [employees, data, metric, expectedMap]);

  const riskRows = useMemo(
    () =>
      growthRows.map((row) =>
        buildGrowthRiskRow(row, profileMap.get(row.employee) ?? null, metric)
      ),
    [growthRows, profileMap, metric]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return riskRows.filter((row) => {
      const matchesSearch =
        !query ||
        row.employee.toLowerCase().includes(query) ||
        row.profile?.bestAccount?.name.toLowerCase().includes(query) ||
        row.profile?.worstAccount?.name.toLowerCase().includes(query) ||
        row.profile?.bestStore?.name.toLowerCase().includes(query) ||
        row.profile?.worstStore?.name.toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (viewFilter === "watchlist") {
        return row.status === "Needs Review" || row.status === "Monitor";
      }
      if (viewFilter === "needsPush") return isNeedsPushCandidate(row);
      if (viewFilter === "growing") return row.status === "Growing";
      if (viewFilter === "returning") return row.status === "Returning";
      if (viewFilter === "stable") return row.status === "Stable";
      return true;
    });
  }, [riskRows, search, viewFilter]);

  const sortedRows = useMemo(
    () =>
      [...filteredRows].sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        const numA = typeof valA === "number" ? valA : Number.NEGATIVE_INFINITY;
        const numB = typeof valB === "number" ? valB : Number.NEGATIVE_INFINITY;
        return sortOrder === "asc" ? numA - numB : numB - numA;
      }),
    [filteredRows, sortKey, sortOrder]
  );

  const activeEmployee =
    selectedEmployee !== "all" ? selectedEmployee : profileEmployee || sortedRows[0]?.employee || "";

  const profile = activeEmployee ? profileMap.get(activeEmployee) ?? null : null;

  const rampData = useMemo(
    () => (profile ? buildRampPoints(profile.records, metric) : []),
    [profile, metric]
  );

  const summary = useMemo(() => {
    const needsReview = riskRows.filter((row) => row.status === "Needs Review").length;
    const monitor = riskRows.filter((row) => row.status === "Monitor").length;
    const needsPush = riskRows.filter(isNeedsPushCandidate).length;
    const growing = riskRows.filter((row) => row.status === "Growing").length;
    const returning = riskRows.filter((row) => row.status === "Returning").length;
    const avgRisk = riskRows.length
      ? riskRows.reduce((total, row) => total + row.riskScore, 0) / riskRows.length
      : 0;
    return { needsReview, monitor, needsPush, growing, returning, avgRisk };
  }, [riskRows]);

  const viewDescription =
    viewFilter === "needsPush"
      ? "At least 10% below the matched expectation, with enough work, reasonable consistency, and no sharp recent decline."
      : "All-time employee history, with latest 30 vs prior 30 signals and benchmark context.";

  const tickColor = isDarkMode ? "#94a3b8" : "#64748b";
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder(key === "employee" || key === "status" ? "asc" : "desc");
    }
  };

  const renderHeader = (key: SortKey, label: string, className = "") => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 ${className}`}
      onClick={() => handleSort(key)}
    >
      <div className={`flex items-center gap-1 ${className.includes("text-center") ? "justify-center" : ""}`}>
        {label}
        {sortKey === key &&
          (sortOrder === "asc" ? <SortAscIcon /> : <SortDescIcon />)}
      </div>
    </th>
  );

  if (!data.length) {
    return (
      <div className="text-center py-10 text-slate-500 dark:text-slate-400">
        No growth data to display for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <SummaryTile label="Needs Review" value={summary.needsReview.toLocaleString()} tone="risk" />
        <SummaryTile label="Monitor" value={summary.monitor.toLocaleString()} tone="warn" />
        <SummaryTile label="Needs a Push" value={summary.needsPush.toLocaleString()} tone="warn" />
        <SummaryTile label="Growing" value={summary.growing.toLocaleString()} tone="good" />
        <SummaryTile label="Returning" value={summary.returning.toLocaleString()} tone="info" />
        <SummaryTile label="Avg Risk" value={summary.avgRisk.toFixed(0)} tone="neutral" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Growth Watchlist
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {viewDescription}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  View
                  <select
                    value={viewFilter}
                    onChange={(event) => setViewFilter(event.target.value as ViewFilter)}
                    className="mt-1 block w-40 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value="watchlist">Watchlist</option>
                    <option value="needsPush">Needs a Push</option>
                    <option value="growing">Growing</option>
                    <option value="returning">Returning</option>
                    <option value="stable">Stable</option>
                    <option value="all">All Employees</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Search
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Employee, account, store"
                    className="mt-1 block w-56 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  {renderHeader("employee", "Employee")}
                  {renderHeader("status", "Status")}
                  {renderHeader("currentAvg", "Last 30", "text-center")}
                  {renderHeader("percentChange", "Growth", "text-center")}
                  {renderHeader("trajectoryPercent", "Trajectory", "text-center")}
                  {renderHeader("expectedDelta", "Vs Expected", "text-center")}
                  {renderHeader("consistency", "Consistency", "text-center")}
                  {renderHeader("currentCount", "Jobs", "text-center")}
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Readout
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {sortedRows.map((row) => (
                  <tr key={row.employee} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                      <button
                        type="button"
                        onClick={() => setProfileEmployee(row.employee)}
                        className="text-left hover:text-primary"
                      >
                        {row.employee}
                      </button>
                      <div className="mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${confidenceClasses[row.confidence]}`}>
                          {row.confidence}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClasses[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-slate-500 dark:text-slate-400">
                      {formatValue(row.currentAvg)}
                      <div className="text-xs">prior {formatValue(row.previousAvg)}</div>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-semibold ${(row.percentChange ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {row.percentChange !== null ? `${formatDelta(row.percentChange, 1)}%` : "-"}
                      <div className="text-xs">{formatDelta(row.change)}</div>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-semibold ${(row.trajectoryPercent ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {row.trajectoryPercent !== null
                        ? `${formatDelta(row.trajectoryPercent, 1)}%`
                        : "-"}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-semibold ${(row.expectedDelta ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatDelta(row.expectedDelta)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-slate-500 dark:text-slate-400">
                      {formatValue(row.consistency, 1)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-slate-500 dark:text-slate-400">
                      {row.currentCount} / {row.previousCount}
                    </td>
                    <td className="px-4 py-3 min-w-72 text-sm text-slate-700 dark:text-slate-200">
                      <div className="font-semibold">{row.reason}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {row.action}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sortedRows.length && (
              <div className="py-10 text-center text-slate-500 dark:text-slate-400">
                No employees match the selected growth view.
              </div>
            )}
          </div>
        </div>

        <EmployeeProfileCard
          profile={profile}
          employees={employees}
          profileEmployee={profileEmployee}
          selectedEmployee={selectedEmployee}
          setProfileEmployee={setProfileEmployee}
          metricLabel={metricLabel}
          rampData={rampData}
          tickColor={tickColor}
          gridColor={gridColor}
          isDarkMode={isDarkMode}
          metric={metric}
        />
      </section>
    </div>
  );
};

const EmployeeProfileCard = ({
  profile,
  employees,
  profileEmployee,
  selectedEmployee,
  setProfileEmployee,
  metricLabel,
  rampData,
  tickColor,
  gridColor,
  isDarkMode,
  metric,
}: {
  profile: EmployeeProfileSummary | null;
  employees: string[];
  profileEmployee: string;
  selectedEmployee: string;
  setProfileEmployee: (employee: string) => void;
  metricLabel: string;
  rampData: ReturnType<typeof buildRampPoints>;
  tickColor: string;
  gridColor: string;
  isDarkMode: boolean;
  metric: Metric;
}) => (
  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Employee Profile
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {profile?.employee ?? "No employee selected"}
        </p>
      </div>
      {selectedEmployee === "all" && (
        <select
          value={profileEmployee}
          onChange={(event) => setProfileEmployee(event.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Auto profile</option>
          {employees.map((employee) => (
            <option key={employee} value={employee}>
              {employee}
            </option>
          ))}
        </select>
      )}
    </div>
    {profile ? (
      <>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <MetricTile label={`Avg ${metricLabel}`} value={profile.average.toFixed(2)} />
          <MetricTile label="Expected" value={formatValue(profile.expectedAverage)} />
          <MetricTile
            label="Vs Expected"
            value={formatDelta(profile.expectedDelta)}
            positive={(profile.expectedDelta ?? 0) >= 0}
          />
          <MetricTile label="Consistency" value={profile.consistency.toFixed(1)} />
        </div>
        <div className="space-y-3 text-sm mb-5">
          <ProfileList
            title="Best/Worst Stores"
            rows={[
              ["Best", profile.bestStore],
              ["Worst", profile.worstStore],
            ]}
          />
          <ProfileList
            title="Best/Worst Accounts"
            rows={[
              ["Best", profile.bestAccount],
              ["Worst", profile.worstAccount],
            ]}
          />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rampData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="jobNumber" tick={{ fontSize: 12, fill: tickColor }} />
              <YAxis tick={{ fontSize: 12, fill: tickColor }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value.toFixed(2),
                  name === "rollingAvg" ? "Recent avg" : metricLabel,
                ]}
                labelFormatter={(label) => `Job #${label}`}
                contentStyle={{
                  backgroundColor: isDarkMode ? "#1e293b" : "white",
                  border: `1px solid ${gridColor}`,
                  borderRadius: "0.5rem",
                }}
              />
              <Line
                type="monotone"
                dataKey="rollingAvg"
                name="Recent avg"
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={metricLabel}
                stroke="#b91c1c"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Store</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{metricLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {profile.recentRecords.slice(0, 5).map((record, index) => (
                <tr key={`${record.date}-${record.store}-${index}`}>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{record.date}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{record.store}</td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">
                    {formatValue(record[metric])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ) : (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Choose an employee to view a focused profile.
      </div>
    )}
  </div>
);

const SummaryTile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "risk" | "warn" | "good" | "info" | "neutral";
}) => {
  const color =
    tone === "risk"
      ? "text-red-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "good"
          ? "text-emerald-600"
          : tone === "info"
            ? "text-sky-600"
          : "text-primary";
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
};

const MetricTile = ({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) => (
  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
      {label}
    </div>
    <div
      className={`text-xl font-bold ${
        positive === undefined
          ? "text-slate-800 dark:text-slate-100"
          : positive
            ? "text-emerald-600"
            : "text-red-600"
      }`}
    >
      {value}
    </div>
  </div>
);

const ProfileList = ({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, { name: string; average: number; count: number } | null]>;
}) => (
  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
      {title}
    </div>
    <div className="space-y-2">
      {rows.map(([label, row]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-slate-400">{label}</span>
          <span className="text-right text-slate-800 dark:text-slate-100">
            {row ? `${row.name} (${row.average.toFixed(2)}, ${row.count})` : "-"}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export default GrowthInsightsPanel;
