import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  METRIC_OPTIONS,
  getAccountGroupLabel,
  normalizeTypeOfInv,
} from "../constants";
import { EmployeeRecord, Metric } from "../types";
import {
  TIMEFRAME_OPTIONS,
  Timeframe,
  filterByTimeframe,
} from "./comparisonShared";
import { SortAscIcon, SortDescIcon } from "./icons/Icons";

type BreakdownDimension = "store" | "employee" | "supervisor" | "typeOfInv";
type SortKey =
  | "label"
  | "inventoryCount"
  | "recordCount"
  | "employeeCount"
  | `inventoryAvg:${TotalMetricKey}`
  | `avg:${Metric}`;

type MetricSummary = Record<Metric, { total: number; average: number }>;
type TotalMetricKey = "totalPieces" | "totalDollars" | "totalSkus";
type TotalMetricSummary = Record<TotalMetricKey, number>;

type BreakdownRow = {
  label: string;
  inventoryCount: number;
  recordCount: number;
  employeeCount: number;
  metrics: MetricSummary;
  inventoryAverages: TotalMetricSummary;
};

const TOTAL_METRICS: { key: TotalMetricKey; label: string }[] = [
  { key: "totalPieces", label: "Pieces" },
  { key: "totalDollars", label: "Dollars" },
  { key: "totalSkus", label: "SKUs" },
];

const BREAKDOWN_LABELS: Record<BreakdownDimension, string> = {
  store: "Store",
  employee: "Employee",
  supervisor: "Supervisor",
  typeOfInv: "Inventory Type",
};

const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);

const formatMetricValue = (
  metric: Metric | TotalMetricKey,
  value: number,
  digits = 0
) => {
  if (metric === "dollars" || metric === "totalDollars") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value);
  }

  return formatNumber(value, digits);
};

const getInventoryKey = (record: EmployeeRecord) =>
  `${record.date}||${record.store}||${getAccountGroupLabel(record.account)}`;

const createMetricSummary = (records: EmployeeRecord[]): MetricSummary => {
  const summary = {} as MetricSummary;
  const count = records.length || 1;

  METRIC_OPTIONS.forEach(({ value }) => {
    const total = records.reduce((sum, record) => sum + record[value], 0);
    summary[value] = {
      total,
      average: total / count,
    };
  });

  return summary;
};

const createAverageInventoryTotalSummary = (
  records: EmployeeRecord[]
): TotalMetricSummary => {
  const byInventory = new Map<string, TotalMetricSummary>();

  records.forEach((record) => {
    const key = getInventoryKey(record);
    const current = byInventory.get(key) ?? {
      totalPieces: 0,
      totalDollars: 0,
      totalSkus: 0,
    };

    byInventory.set(key, {
      totalPieces: current.totalPieces + record.totalPieces,
      totalDollars: current.totalDollars + record.totalDollars,
      totalSkus: current.totalSkus + record.totalSkus,
    });
  });

  if (!byInventory.size) {
    return {
      totalPieces: 0,
      totalDollars: 0,
      totalSkus: 0,
    };
  }

  const totals = Array.from(byInventory.values()).reduce(
    (sum, inventoryTotal) => ({
      totalPieces: sum.totalPieces + inventoryTotal.totalPieces,
      totalDollars: sum.totalDollars + inventoryTotal.totalDollars,
      totalSkus: sum.totalSkus + inventoryTotal.totalSkus,
    }),
    {
      totalPieces: 0,
      totalDollars: 0,
      totalSkus: 0,
    }
  );

  return {
    totalPieces: totals.totalPieces / byInventory.size,
    totalDollars: totals.totalDollars / byInventory.size,
    totalSkus: totals.totalSkus / byInventory.size,
  };
};

const getBreakdownLabel = (
  record: EmployeeRecord,
  breakdownBy: BreakdownDimension
) => {
  if (breakdownBy === "typeOfInv") return normalizeTypeOfInv(record.typeOfInv);
  return record[breakdownBy];
};

const AccountMetricsPage: React.FC<{
  data: EmployeeRecord[];
  isDarkMode: boolean;
}> = ({ data, isDarkMode }) => {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>("last90");
  const [office, setOffice] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [specificDate, setSpecificDate] = useState("");
  const [breakdownBy, setBreakdownBy] =
    useState<BreakdownDimension>("store");
  const [sortKey, setSortKey] = useState<SortKey>("inventoryCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const accountOptions = useMemo(() => {
    const accounts = new Set<string>();
    data.forEach((record) => accounts.add(getAccountGroupLabel(record.account)));
    return Array.from(accounts).sort((a, b) => a.localeCompare(b));
  }, [data]);

  useEffect(() => {
    if (!selectedAccount && accountOptions.length) {
      setSelectedAccount(accountOptions[0]);
      return;
    }

    if (selectedAccount && !accountOptions.includes(selectedAccount)) {
      setSelectedAccount(accountOptions[0] ?? "");
    }
  }, [accountOptions, selectedAccount]);

  const timeframeFilteredData = useMemo(
    () => filterByTimeframe(data, timeframe, startDate, endDate, specificDate),
    [data, timeframe, startDate, endDate, specificDate]
  );

  const availableOffices = useMemo(() => {
    const offices = new Set<string>();
    timeframeFilteredData.forEach((record) => offices.add(record.office));
    return Array.from(offices).sort((a, b) => a.localeCompare(b));
  }, [timeframeFilteredData]);

  const scopedData = useMemo(() => {
    return timeframeFilteredData.filter((record) => {
      if (selectedAccount && getAccountGroupLabel(record.account) !== selectedAccount) {
        return false;
      }
      if (office !== "all" && record.office !== office) return false;
      return true;
    });
  }, [timeframeFilteredData, selectedAccount, office]);

  const metrics = useMemo(() => createMetricSummary(scopedData), [scopedData]);
  const inventoryAverages = useMemo(
    () => createAverageInventoryTotalSummary(scopedData),
    [scopedData]
  );

  const inventoryEmployeeCounts = useMemo(() => {
    const byInventory = new Map<string, Set<string>>();

    scopedData.forEach((record) => {
      const key = getInventoryKey(record);
      const employees = byInventory.get(key) ?? new Set<string>();
      employees.add(record.employee);
      byInventory.set(key, employees);
    });

    return Array.from(byInventory.values()).map((employees) => employees.size);
  }, [scopedData]);

  const summary = useMemo(() => {
    const inventoryCount = new Set(scopedData.map(getInventoryKey)).size;
    const employeeCount = new Set(scopedData.map((record) => record.employee)).size;
    const storeCount = new Set(scopedData.map((record) => record.store)).size;
    const dateCount = new Set(scopedData.map((record) => record.date)).size;
    const supervisorCount = new Set(
      scopedData.map((record) => record.supervisor)
    ).size;
    const avgEmployeesPerInventory = inventoryEmployeeCounts.length
      ? inventoryEmployeeCounts.reduce((sum, count) => sum + count, 0) /
        inventoryEmployeeCounts.length
      : 0;

    return {
      inventoryCount,
      employeeCount,
      storeCount,
      dateCount,
      supervisorCount,
      avgEmployeesPerInventory,
      avgRecordsPerInventory: inventoryCount
        ? scopedData.length / inventoryCount
        : 0,
    };
  }, [scopedData, inventoryEmployeeCounts]);

  const accountComposition = useMemo(() => {
    const sourceAccounts = new Map<string, number>();
    const inventoryTypes = new Map<string, number>();

    scopedData.forEach((record) => {
      sourceAccounts.set(
        record.account,
        (sourceAccounts.get(record.account) ?? 0) + 1
      );
      const typeLabel = normalizeTypeOfInv(record.typeOfInv);
      inventoryTypes.set(typeLabel, (inventoryTypes.get(typeLabel) ?? 0) + 1);
    });

    const toRows = (values: Map<string, number>) =>
      Array.from(values.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    return {
      sourceAccounts: toRows(sourceAccounts),
      inventoryTypes: toRows(inventoryTypes),
    };
  }, [scopedData]);

  const breakdownRows = useMemo((): BreakdownRow[] => {
    const groups = new Map<string, EmployeeRecord[]>();

    scopedData.forEach((record) => {
      const label = getBreakdownLabel(record, breakdownBy);
      const records = groups.get(label) ?? [];
      records.push(record);
      groups.set(label, records);
    });

    return Array.from(groups.entries()).map(([label, records]) => ({
      label,
      inventoryCount: new Set(records.map(getInventoryKey)).size,
      recordCount: records.length,
      employeeCount: new Set(records.map((record) => record.employee)).size,
      metrics: createMetricSummary(records),
      inventoryAverages: createAverageInventoryTotalSummary(records),
    }));
  }, [scopedData, breakdownBy]);

  const sortedRows = useMemo(() => {
    const getValue = (row: BreakdownRow): string | number => {
      if (sortKey === "label") return row.label;
      if (sortKey === "inventoryCount") return row.inventoryCount;
      if (sortKey === "recordCount") return row.recordCount;
      if (sortKey === "employeeCount") return row.employeeCount;

      const [kind, metric] = sortKey.split(":") as [
        "inventoryAvg" | "avg",
        Metric | TotalMetricKey,
      ];
      return kind === "inventoryAvg"
        ? row.inventoryAverages[metric as TotalMetricKey]
        : row.metrics[metric as Metric].average;
    };

    return [...breakdownRows].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortOrder === "asc"
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue);
    });
  }, [breakdownRows, sortKey, sortOrder]);

  const chartData = useMemo(
    () =>
      sortedRows.slice(0, 12).map((row) => ({
        label: row.label,
        pieces: row.inventoryAverages.totalPieces,
        dollars: row.inventoryAverages.totalDollars,
        skus: row.inventoryAverages.totalSkus,
      })),
    [sortedRows]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortOrder(key === "label" ? "asc" : "desc");
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortOrder === "asc" ? <SortAscIcon /> : <SortDescIcon />;
  };

  const renderHeader = (key: SortKey, label: string, align = "text-right") => (
    <th
      className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 ${align}`}
      onClick={() => handleSort(key)}
    >
      <div
        className={`flex items-center gap-1 ${
          align === "text-left" ? "justify-start" : "justify-end"
        }`}
      >
        {label}
        {renderSortIndicator(key)}
      </div>
    </th>
  );

  const tickColor = isDarkMode ? "#94a3b8" : "#64748b";
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Account Metrics
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Select an account to review average inventory totals, per-hour
              averages, staffing, stores, inventory types, and employee
              activity.
            </p>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {scopedData.length.toLocaleString()} records in scope
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Account
            <select
              value={selectedAccount}
              onChange={(event) => setSelectedAccount(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              {accountOptions.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Timeframe
            <select
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value as Timeframe)}
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              {TIMEFRAME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Office
            <select
              value={office}
              onChange={(event) => setOffice(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              <option value="all">All Offices</option>
              {availableOffices.map((officeName) => (
                <option key={officeName} value={officeName}>
                  {officeName}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Breakdown
            <select
              value={breakdownBy}
              onChange={(event) =>
                setBreakdownBy(event.target.value as BreakdownDimension)
              }
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              <option value="store">Store</option>
              <option value="employee">Employee</option>
              <option value="supervisor">Supervisor</option>
              <option value="typeOfInv">Inventory Type</option>
            </select>
          </label>
        </div>

        {timeframe === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Start Date
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              End Date
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}

        {timeframe === "specific" && (
          <div className="mt-4 max-w-sm">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Date
              <input
                type="date"
                value={specificDate}
                onChange={(event) => setSpecificDate(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Inventories",
            value: formatNumber(summary.inventoryCount),
            sub: `${formatNumber(summary.avgRecordsPerInventory, 1)} records avg`,
          },
          {
            label: "Avg Employees",
            value: formatNumber(summary.avgEmployeesPerInventory, 1),
            sub: "per inventory",
          },
          {
            label: "Employees",
            value: formatNumber(summary.employeeCount),
            sub: `${formatNumber(summary.supervisorCount)} supervisors`,
          },
          {
            label: "Stores",
            value: formatNumber(summary.storeCount),
            sub: `${formatNumber(summary.dateCount)} inventory dates`,
          },
        ].map((tile) => (
          <div
            key={tile.label}
            className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {tile.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tile.sub}
            </p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
            Average Inventory Totals
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TOTAL_METRICS.map((metric) => (
              <div
                key={`total-${metric.key}`}
                className="rounded-md border border-slate-200 dark:border-slate-700 p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Avg Inventory {metric.label}
                </p>
                <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">
                  {formatMetricValue(
                    metric.key,
                    inventoryAverages[metric.key],
                    0
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
            Averages Per Record
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {METRIC_OPTIONS.map((metric) => (
              <div
                key={`avg-${metric.value}`}
                className="rounded-md border border-slate-200 dark:border-slate-700 p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Avg {metric.label}
                </p>
                <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">
                  {formatMetricValue(
                    metric.value,
                    metrics[metric.value].average,
                    2
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Top {BREAKDOWN_LABELS[breakdownBy]} Average Inventory Totals
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              First 12 rows by current sort
            </p>
          </div>
          {chartData.length ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: -10, bottom: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: tickColor }}
                    interval={0}
                    angle={chartData.length > 5 ? -20 : 0}
                    textAnchor={chartData.length > 5 ? "end" : "middle"}
                    height={chartData.length > 5 ? 80 : 50}
                  />
                  <YAxis tick={{ fontSize: 12, fill: tickColor }} />
                  <Tooltip
                    formatter={(value: number | string, name: string) => [
                      name === "dollars"
                        ? formatMetricValue("dollars", Number(value), 0)
                        : formatNumber(Number(value), 0),
                      name.charAt(0).toUpperCase() + name.slice(1),
                    ]}
                    contentStyle={{
                      backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                      border: `1px solid ${isDarkMode ? "#334155" : "#e2e8f0"}`,
                      borderRadius: "0.5rem",
                      color: isDarkMode ? "#e2e8f0" : "#1e293b",
                    }}
                  />
                  <Bar dataKey="pieces" fill="#b91c1c" />
                  <Bar dataKey="dollars" fill="#0f766e" />
                  <Bar dataKey="skus" fill="#1d4ed8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No account data available for the selected filters.
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
            Account Mix
          </h3>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Source Accounts
              </p>
              <div className="space-y-2">
                {accountComposition.sourceAccounts.slice(0, 8).map((row) => (
                  <div
                    key={`source-${row.label}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-600 dark:text-slate-300 truncate">
                      {row.label}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Inventory Types
              </p>
              <div className="space-y-2">
                {accountComposition.inventoryTypes.slice(0, 8).map((row) => (
                  <div
                    key={`type-${row.label}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-600 dark:text-slate-300 truncate">
                      {row.label}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
          {BREAKDOWN_LABELS[breakdownBy]} Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {renderHeader("label", BREAKDOWN_LABELS[breakdownBy], "text-left")}
                {renderHeader("inventoryCount", "Inventories")}
                {renderHeader("recordCount", "Records")}
                {renderHeader("employeeCount", "Employees")}
                {renderHeader("inventoryAvg:totalPieces", "Avg Inv Pieces")}
                {renderHeader("inventoryAvg:totalDollars", "Avg Inv Dollars")}
                {renderHeader("inventoryAvg:totalSkus", "Avg Inv SKUs")}
                {renderHeader("avg:pieces", "Avg Pieces/Hr")}
                {renderHeader("avg:dollars", "Avg Dollars/Hr")}
                {renderHeader("avg:skus", "Avg SKUs/Hr")}
                {renderHeader("avg:avg_delta", "Avg Delta")}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {sortedRows.length ? (
                sortedRows.map((row) => (
                  <tr
                    key={row.label}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                      {row.label}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {row.inventoryCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {row.recordCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {row.employeeCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {formatMetricValue(
                        "totalPieces",
                        row.inventoryAverages.totalPieces,
                        0
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {formatMetricValue(
                        "totalDollars",
                        row.inventoryAverages.totalDollars,
                        0
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {formatMetricValue(
                        "totalSkus",
                        row.inventoryAverages.totalSkus,
                        0
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {formatMetricValue("pieces", row.metrics.pieces.average, 2)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {formatMetricValue("dollars", row.metrics.dollars.average, 2)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {formatMetricValue("skus", row.metrics.skus.average, 2)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {formatMetricValue(
                        "avg_delta",
                        row.metrics.avg_delta.average,
                        2
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No rows to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AccountMetricsPage;
