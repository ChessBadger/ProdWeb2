import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
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
  buildAlerts,
  buildEmployeeProfile,
  buildExpectedAverageMap,
  buildGrowthRows,
  buildRampPoints,
  formatDelta,
} from "../analytics/employeeAnalytics";

interface GrowthInsightsPanelProps {
  data: EmployeeRecord[];
  overallData: EmployeeRecord[];
  metric: Metric;
  selectedEmployee: string;
  isDarkMode: boolean;
}

const formatValue = (value: number | null, decimals = 2) =>
  value === null || !Number.isFinite(value) ? "-" : value.toFixed(decimals);

const confidenceClasses: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Low: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
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

  const activeEmployee = selectedEmployee !== "all" ? selectedEmployee : profileEmployee;

  const profiles = useMemo(
    () =>
      employees
        .map((employee) => buildEmployeeProfile(employee, data, metric, expectedMap))
        .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile)),
    [employees, data, metric, expectedMap]
  );

  const profile = useMemo(() => {
    const fallbackEmployee = activeEmployee || growthRows[0]?.employee || "";
    return fallbackEmployee
      ? buildEmployeeProfile(fallbackEmployee, data, metric, expectedMap)
      : null;
  }, [activeEmployee, growthRows, data, metric, expectedMap]);

  const alerts = useMemo(
    () => buildAlerts(growthRows, profiles),
    [growthRows, profiles]
  );

  const rampData = useMemo(
    () => (profile ? buildRampPoints(profile.records, metric) : []),
    [profile, metric]
  );

  const tickColor = isDarkMode ? "#94a3b8" : "#64748b";
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";
  const topGrowthRows = growthRows.slice(0, 12);

  if (!data.length) {
    return (
      <div className="text-center py-10 text-slate-500 dark:text-slate-400">
        No growth data to display for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Employee Growth Scorecard
          </h3>
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {[
                  "Employee",
                  "Last 30",
                  "Prior 30",
                  "Change",
                  "Rank",
                  "Jobs",
                  "Confidence",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {topGrowthRows.map((row) => (
                <tr key={row.employee} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                    <button
                      type="button"
                      onClick={() => setProfileEmployee(row.employee)}
                      className="text-left hover:text-primary"
                    >
                      {row.employee}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {formatValue(row.currentAvg)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {formatValue(row.previousAvg)}
                  </td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${
                      (row.change ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatDelta(row.change)}
                    {row.percentChange !== null
                      ? ` (${formatDelta(row.percentChange, 1)}%)`
                      : ""}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {row.rank ?? "-"}
                    {row.rankChange !== null ? ` (${formatDelta(row.rankChange, 0)})` : ""}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {row.currentCount} / {row.previousCount}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${confidenceClasses[row.confidence]}`}
                    >
                      {row.confidence}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Employee Profile
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {profile?.employee ?? "No employee selected"}
              </p>
            </div>
            {profile && (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${confidenceClasses[profile.confidence]}`}>
                {profile.confidence} confidence
              </span>
            )}
          </div>
          {profile ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <MetricTile label={`Avg ${metricLabel}`} value={profile.average.toFixed(2)} />
                <MetricTile
                  label="Expected"
                  value={formatValue(profile.expectedAverage)}
                />
                <MetricTile
                  label="Vs Expected"
                  value={formatDelta(profile.expectedDelta)}
                  positive={(profile.expectedDelta ?? 0) >= 0}
                />
                <MetricTile
                  label="Consistency"
                  value={profile.consistency.toFixed(1)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-5">
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
                    <XAxis
                      dataKey="jobNumber"
                      tick={{ fontSize: 12, fill: tickColor }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: tickColor }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        value.toFixed(2),
                        name === "rollingAvg" ? "5-job rolling avg" : metricLabel,
                      ]}
                      labelFormatter={(label) => `Job #${label}`}
                      contentStyle={{
                        backgroundColor: isDarkMode ? "#1e293b" : "white",
                        border: `1px solid ${gridColor}`,
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={metricLabel}
                      stroke="#b91c1c"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="rollingAvg"
                      name="5-job rolling avg"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Choose an employee to view a focused profile.
            </div>
          )}
        </div>

        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Growth Alerts
          </h3>
          <div className="space-y-3">
            {alerts.length ? (
              alerts.map((alert, index) => (
                <div
                  key={`${alert.employee}-${alert.title}-${index}`}
                  className="border border-slate-200 dark:border-slate-700 rounded-md p-3"
                >
                  <div
                    className={`text-sm font-semibold ${
                      alert.type === "positive"
                        ? "text-emerald-600"
                        : alert.type === "warning"
                          ? "text-red-600"
                          : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {alert.title}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-slate-200">
                    {alert.employee}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {alert.detail}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                No alerts for the current filters.
              </div>
            )}
          </div>
        </div>
      </section>
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
