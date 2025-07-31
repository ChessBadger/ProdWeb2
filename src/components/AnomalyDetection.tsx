import React, { useState, useMemo } from "react";
import { EmployeeRecord, Metric } from "../types";
import { METRIC_OPTIONS } from "../constants";
import { SortAscIcon, SortDescIcon } from "./icons/Icons";
import ToggleSwitch from "./ToggleSwitch";

// Anomaly type definition
interface Anomaly {
  employee: string;
  date: string;
  store: string;
  metricValue: number;
  comparisonAverage: number;
  deviationPercent: number;
  type: "Spike" | "Dip";
}

// Sort key type for the anomaly feed
type FeedSortKey = keyof Anomaly;

// Employee summary type
interface EmployeeSummary {
  employee: string;
  spikes: number;
  dips: number;
  total: number;
  spikesPercent: number;
  dipsPercent: number;
}
type SummarySortKey = keyof EmployeeSummary;

type ComparisonMode = "self" | "all";
type ViewMode = "anomalies" | "summary";

interface AnomalyDetectionProps {
  data: EmployeeRecord[];
  overallData: EmployeeRecord[];
  metric: Metric;
  account: string;
  isDarkMode: boolean;
}

const AnomalyDetection: React.FC<AnomalyDetectionProps> = ({
  data,
  overallData,
  metric,
  account,
}) => {
  const [deviationThreshold, setDeviationThreshold] = useState<number>(30);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("self");
  const [currentView, setCurrentView] = useState<ViewMode>("anomalies");

  // Sorting state for Anomaly Feed
  const [feedSortKey, setFeedSortKey] = useState<FeedSortKey>("date");
  const [feedSortOrder, setFeedSortOrder] = useState<"asc" | "desc">("desc");

  // Sorting state for Employee Summary
  const [summarySortKey, setSummarySortKey] = useState<SummarySortKey>("total");
  const [summarySortOrder, setSummarySortOrder] = useState<"asc" | "desc">(
    "desc"
  );

  const anomalies = useMemo((): Anomaly[] => {
    if (account === "all" || !data.length) return [];

    const foundAnomalies: Anomaly[] = [];

    if (comparisonMode === "self") {
      const employeeRecords = new Map<string, number[]>();
      data.forEach((record) => {
        if (!employeeRecords.has(record.employee)) {
          employeeRecords.set(record.employee, []);
        }
        employeeRecords.get(record.employee)!.push(record[metric]);
      });

      const employeeStats = new Map<string, { mean: number }>();
      employeeRecords.forEach((values, employee) => {
        if (values.length > 0) {
          const sum = values.reduce((acc, v) => acc + v, 0);
          const mean = sum / values.length;
          employeeStats.set(employee, { mean });
        }
      });

      data.forEach((record) => {
        const stats = employeeStats.get(record.employee);
        if (!stats || stats.mean === 0) return;

        const { mean } = stats;
        const deviation = record[metric] - mean;
        const deviationPercent = (deviation / mean) * 100;

        if (Math.abs(deviationPercent) > deviationThreshold) {
          foundAnomalies.push({
            date: record.date,
            employee: record.employee,
            store: record.store,
            metricValue: record[metric],
            comparisonAverage: mean,
            deviationPercent: deviationPercent,
            type: deviation > 0 ? "Spike" : "Dip",
          });
        }
      });
    } else {
      // comparisonMode === 'all'
      const allValues = overallData.map((record) => record[metric]);
      const overallSum = allValues.reduce((acc, v) => acc + v, 0);
      const overallMean =
        allValues.length > 0 ? overallSum / allValues.length : 0;

      if (overallMean === 0) return [];

      data.forEach((record) => {
        const deviation = record[metric] - overallMean;
        const deviationPercent = (deviation / overallMean) * 100;

        if (Math.abs(deviationPercent) > deviationThreshold) {
          foundAnomalies.push({
            date: record.date,
            employee: record.employee,
            store: record.store,
            metricValue: record[metric],
            comparisonAverage: overallMean,
            deviationPercent: deviationPercent,
            type: deviation > 0 ? "Spike" : "Dip",
          });
        }
      });
    }

    return foundAnomalies;
  }, [data, overallData, metric, account, deviationThreshold, comparisonMode]);

  const employeeRecordCount = useMemo(() => {
    if (account === "all") return new Map<string, number>();
    const counts = new Map<string, number>();
    data.forEach((record) => {
      counts.set(record.employee, (counts.get(record.employee) || 0) + 1);
    });
    return counts;
  }, [data, account]);

  const employeeSummary = useMemo((): EmployeeSummary[] => {
    if (account === "all") return [];
    const summary: { [key: string]: { spikes: number; dips: number } } = {};
    anomalies.forEach((anomaly) => {
      if (!summary[anomaly.employee]) {
        summary[anomaly.employee] = { spikes: 0, dips: 0 };
      }
      if (anomaly.type === "Spike") {
        summary[anomaly.employee].spikes++;
      } else {
        summary[anomaly.employee].dips++;
      }
    });
    return Object.entries(summary).map(([employee, counts]) => {
      const totalRecords = employeeRecordCount.get(employee) || 0;
      const spikesPercent =
        totalRecords > 0 ? (counts.spikes / totalRecords) * 100 : 0;
      const dipsPercent =
        totalRecords > 0 ? (counts.dips / totalRecords) * 100 : 0;

      return {
        employee,
        spikes: counts.spikes,
        dips: counts.dips,
        total: counts.spikes + counts.dips,
        spikesPercent,
        dipsPercent,
      };
    });
  }, [anomalies, account, employeeRecordCount]);

  const sortedAnomalies = useMemo(() => {
    return [...anomalies].sort((a, b) => {
      const valA = a[feedSortKey];
      const valB = b[feedSortKey];

      if (feedSortKey === "date") {
        return feedSortOrder === "asc"
          ? new Date(valA).getTime() - new Date(valB).getTime()
          : new Date(valB).getTime() - new Date(valA).getTime();
      }
      if (typeof valA === "string" && typeof valB === "string") {
        return feedSortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      if (typeof valA === "number" && typeof valB === "number") {
        return feedSortOrder === "asc" ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [anomalies, feedSortKey, feedSortOrder]);

  const sortedEmployeeSummary = useMemo(() => {
    return [...employeeSummary].sort((a, b) => {
      const valA = a[summarySortKey];
      const valB = b[summarySortKey];

      if (typeof valA === "string" && typeof valB === "string") {
        return summarySortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      if (typeof valA === "number" && typeof valB === "number") {
        return summarySortOrder === "asc" ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [employeeSummary, summarySortKey, summarySortOrder]);

  const handleFeedSort = (key: FeedSortKey) => {
    if (feedSortKey === key) {
      setFeedSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setFeedSortKey(key);
      setFeedSortOrder("asc");
    }
  };

  const handleSummarySort = (key: SummarySortKey) => {
    if (summarySortKey === key) {
      setSummarySortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSummarySortKey(key);
      setSummarySortOrder("desc");
    }
  };

  const metricLabel =
    METRIC_OPTIONS.find((m) => m.value === metric)?.label || "Metric";

  const renderFeedSortableHeader = (key: FeedSortKey, label: string) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
      onClick={() => handleFeedSort(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        {feedSortKey === key &&
          (feedSortOrder === "asc" ? <SortAscIcon /> : <SortDescIcon />)}
      </div>
    </th>
  );

  const renderSummarySortableHeader = (key: SummarySortKey, label: string) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
      onClick={() => handleSummarySort(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        {summarySortKey === key &&
          (summarySortOrder === "asc" ? <SortAscIcon /> : <SortDescIcon />)}
      </div>
    </th>
  );

  const renderAnomaliesFeed = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-700/50">
          <tr>
            {renderFeedSortableHeader("date", "Date")}
            {renderFeedSortableHeader("employee", "Employee")}
            {renderFeedSortableHeader("store", "Store")}
            {renderFeedSortableHeader("metricValue", `Actual ${metricLabel}`)}
            {renderFeedSortableHeader(
              "comparisonAverage",
              comparisonMode === "self" ? "Employee Avg" : "Overall Avg"
            )}
            {renderFeedSortableHeader("deviationPercent", "Deviation (%)")}
            {renderFeedSortableHeader("type", "Type")}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
          {sortedAnomalies.map((anomaly, index) => (
            <tr
              key={`${anomaly.date}-${anomaly.employee}-${index}`}
              className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                {anomaly.date}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                {anomaly.employee}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                {anomaly.store}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                {anomaly.metricValue.toFixed(2)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                {anomaly.comparisonAverage.toFixed(2)}
              </td>
              <td
                className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${
                  anomaly.deviationPercent > 0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {anomaly.deviationPercent > 0 ? "+" : ""}
                {anomaly.deviationPercent.toFixed(2)}%
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    anomaly.type === "Spike"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                  }`}
                >
                  {anomaly.type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSummaryView = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-700/50">
          <tr>
            {renderSummarySortableHeader("employee", "Employee")}
            {renderSummarySortableHeader(
              "spikes",
              "Positive Anomalies (Spikes)"
            )}
            {renderSummarySortableHeader("dips", "Negative Anomalies (Dips)")}
            {renderSummarySortableHeader("total", "Total Anomalies")}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
          {sortedEmployeeSummary.map((summary) => (
            <tr
              key={summary.employee}
              className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                {summary.employee}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-500">
                {summary.spikes}
                {summary.spikes > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-1">
                    ({summary.spikesPercent.toFixed(2)}%)
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-red-500">
                {summary.dips}
                {summary.dips > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-1">
                    ({summary.dipsPercent.toFixed(2)}%)
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-200">
                {summary.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderContent = () => {
    if (account === "all") {
      return (
        <div className="flex items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">
          Please select a specific account from the sidebar filters to detect
          anomalies.
        </div>
      );
    }
    if (anomalies.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">
          No anomalies found for the current filters and settings.
        </div>
      );
    }

    return currentView === "anomalies"
      ? renderAnomaliesFeed()
      : renderSummaryView();
  };

  const tabClasses = (view: ViewMode) =>
    `whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition cursor-pointer ` +
    (currentView === view
      ? "border-primary text-primary"
      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600");

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0">
        <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
            <div>
              <label
                htmlFor="deviation-threshold"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Deviation Threshold (%)
              </label>
              <input
                type="number"
                id="deviation-threshold"
                value={deviationThreshold}
                onChange={(e) =>
                  setDeviationThreshold(parseFloat(e.target.value) || 0)
                }
                min="0"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
              />
            </div>
            <div className="flex justify-center md:justify-end h-full items-end pb-1">
              <ToggleSwitch
                id="comparison-mode-toggle"
                checked={comparisonMode === "all"}
                onChange={(checked) =>
                  setComparisonMode(checked ? "all" : "self")
                }
                labelLeft="Vs. Employee"
                labelRight="Vs. All"
              />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-slate-500 dark:text-slate-400 pt-1">
              Anomalies for{" "}
              <span className="font-bold text-primary">{metricLabel}</span> vs.{" "}
              {comparisonMode === "self" ? "each employee's" : "the overall"}{" "}
              average.
            </p>
          </div>
        </div>

        <div className="border-b border-slate-200 dark:border-slate-700 mt-4 px-4">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <button
              className={tabClasses("anomalies")}
              onClick={() => setCurrentView("anomalies")}
            >
              Anomaly Feed
            </button>
            <button
              className={tabClasses("summary")}
              onClick={() => setCurrentView("summary")}
            >
              Employee Summary
            </button>
          </nav>
        </div>
      </div>

      <div className="flex-grow overflow-auto min-h-0 pt-4">
        {renderContent()}
      </div>
    </div>
  );
};

export default AnomalyDetection;
