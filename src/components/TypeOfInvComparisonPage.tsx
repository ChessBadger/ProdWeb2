import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { METRIC_OPTIONS, getAccountGroupLabel } from "../constants";
import { EmployeeRecord, Metric } from "../types";
import { SortAscIcon, SortDescIcon } from "./icons/Icons";
import {
  Aggregate,
  BAR_COLORS,
  ChartRow,
  GraphTab,
  TIMEFRAME_OPTIONS,
  TableSortKey,
  Timeframe,
  filterByTimeframe,
  getDiffStats,
} from "./comparisonShared";

type BreakdownDimension = "store" | "employee" | "supervisor" | "account";

const BREAKDOWN_LABELS: Record<BreakdownDimension, string> = {
  store: "Store",
  employee: "Employee",
  supervisor: "Group",
  account: "Account",
};

const getModasBucket = (record: EmployeeRecord): "Modas" | "Non-Modas" =>
  Number(record.avg_delta) > 0 ? "Modas" : "Non-Modas";

const TypeOfInvComparisonPage: React.FC<{
  data: EmployeeRecord[];
  isDarkMode: boolean;
}> = ({ data, isDarkMode }) => {
  const [breakdownBy, setBreakdownBy] =
    useState<BreakdownDimension>("store");
  const [metric, setMetric] = useState<Metric>("pieces");
  const [timeframe, setTimeframe] = useState<Timeframe>("last90");
  const [office, setOffice] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [specificDate, setSpecificDate] = useState("");
  const [selectedMember, setSelectedMember] = useState("all");
  const [topN, setTopN] = useState(8);
  const [activeGraphTab, setActiveGraphTab] = useState<GraphTab>("overall");
  const [tableSortKey, setTableSortKey] = useState<TableSortKey>("label");
  const [tableSortOrder, setTableSortOrder] = useState<"asc" | "desc">("asc");

  const handleClearCompareFilters = () => {
    setBreakdownBy("store");
    setMetric("pieces");
    setTimeframe("last90");
    setOffice("all");
    setSelectedAccount("");
    setStartDate("");
    setEndDate("");
    setSpecificDate("");
    setSelectedMember("all");
    setTopN(8);
    setActiveGraphTab("overall");
    setTableSortKey("label");
    setTableSortOrder("asc");
  };

  const metricLabel =
    METRIC_OPTIONS.find((option) => option.value === metric)?.label || "Metric";
  const breakdownLabel = BREAKDOWN_LABELS[breakdownBy];

  const timeframeFilteredData = useMemo(
    () => filterByTimeframe(data, timeframe, startDate, endDate, specificDate),
    [data, timeframe, startDate, endDate, specificDate]
  );

  const availableOffices = useMemo(() => {
    const offices = new Set<string>();
    data.forEach((record) => offices.add(record.office));
    return Array.from(offices).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const officeFilteredData = useMemo(() => {
    if (office === "all") return timeframeFilteredData;
    return timeframeFilteredData.filter((record) => record.office === office);
  }, [timeframeFilteredData, office]);

  const accountOptions = useMemo(() => {
    const accountTypeMap = new Map<string, Set<string>>();

    officeFilteredData.forEach((record) => {
      const accountLabel = getAccountGroupLabel(record.account);
      let typeSet = accountTypeMap.get(accountLabel);
      if (!typeSet) {
        typeSet = new Set<string>();
        accountTypeMap.set(accountLabel, typeSet);
      }
      typeSet.add(getModasBucket(record));
    });

    return Array.from(accountTypeMap.entries())
      .map(([accountLabel, typeSet]) => ({
        accountLabel,
        typeCount: typeSet.size,
      }))
      .filter((option) => option.typeCount > 1)
      .sort(
        (a, b) =>
          b.typeCount - a.typeCount ||
          a.accountLabel.localeCompare(b.accountLabel)
      );
  }, [officeFilteredData]);

  const eligibleAccountCount = useMemo(
    () => accountOptions.length,
    [accountOptions]
  );

  const selectedAccountOption = useMemo(
    () =>
      accountOptions.find((option) => option.accountLabel === selectedAccount) ??
      null,
    [accountOptions, selectedAccount]
  );

  useEffect(() => {
    if (
      selectedAccount &&
      !accountOptions.some((option) => option.accountLabel === selectedAccount)
    ) {
      setSelectedAccount("");
    }
  }, [accountOptions, selectedAccount]);

  const accountScopedData = useMemo(() => {
    if (!selectedAccount) return [];
    return officeFilteredData.filter(
      (record) => getAccountGroupLabel(record.account) === selectedAccount
    );
  }, [officeFilteredData, selectedAccount]);

  const availableTypes = useMemo(() => {
    const values = new Set<string>();
    accountScopedData.forEach((record) => values.add(getModasBucket(record)));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [accountScopedData]);

  const compareBuckets = useMemo(
    () => ["Modas", "Non-Modas"].filter((bucket) => availableTypes.includes(bucket)),
    [availableTypes]
  );

  const scopedData = accountScopedData;

  const getBreakdownMember = useMemo(
    () => (record: EmployeeRecord) => {
      switch (breakdownBy) {
        case "store":
          return record.store;
        case "employee":
          return record.employee;
        case "supervisor":
          return record.supervisor;
        case "account":
          return record.account;
      }
    },
    [breakdownBy]
  );

  const aggregatesByMember = useMemo(() => {
    const byMember = new Map<string, Map<string, Aggregate>>();

    scopedData.forEach((record) => {
      const memberKey = getBreakdownMember(record);
      const typeKey = getModasBucket(record);

      let byType = byMember.get(memberKey);
      if (!byType) {
        byType = new Map<string, Aggregate>();
        byMember.set(memberKey, byType);
      }

      const current = byType.get(typeKey) ?? { total: 0, count: 0 };
      byType.set(typeKey, {
        total: current.total + record[metric],
        count: current.count + 1,
      });
    });

    return byMember;
  }, [scopedData, getBreakdownMember, metric]);

  const memberAverages = useMemo(() => {
    const rows = Array.from(aggregatesByMember.entries()).map(
      ([member, byType]) => {
        let total = 0;
        let count = 0;

        byType.forEach((aggregate) => {
          total += aggregate.total;
          count += aggregate.count;
        });

        return { member, average: count > 0 ? total / count : 0 };
      }
    );

    return rows.sort((a, b) => b.average - a.average);
  }, [aggregatesByMember]);

  const availableMembers = useMemo(
    () =>
      Array.from(aggregatesByMember.keys()).sort((a, b) => a.localeCompare(b)),
    [aggregatesByMember]
  );

  const memberHasAllCompareBuckets = useMemo(
    () => (member: string) => {
      const byType = aggregatesByMember.get(member);
      if (!byType) return false;

      return compareBuckets.every((bucket) => {
        const aggregate = byType.get(bucket);
        return Boolean(aggregate && aggregate.count > 0);
      });
    },
    [aggregatesByMember, compareBuckets]
  );

  useEffect(() => {
    if (selectedMember !== "all" && !availableMembers.includes(selectedMember)) {
      setSelectedMember("all");
    }
  }, [availableMembers, selectedMember]);

  const displayedMembers = useMemo(() => {
    if (selectedMember !== "all") return [selectedMember];

    const cappedTopN = Math.max(1, Math.min(topN, 25));
    return memberAverages.slice(0, cappedTopN).map((row) => row.member);
  }, [selectedMember, topN, memberAverages]);

  const displayedChartMembers = useMemo(() => {
    if (selectedMember !== "all") return displayedMembers;
    if (breakdownBy !== "store") return displayedMembers;

    return displayedMembers.filter(memberHasAllCompareBuckets);
  }, [
    selectedMember,
    breakdownBy,
    displayedMembers,
    memberHasAllCompareBuckets,
  ]);

  const buildComparisonRows = (members: string[]) => {
    return members.map((member) => {
      const row: ChartRow = { label: member, delta: null, percentDiff: null };
      const byType = aggregatesByMember.get(member);
      const numericValues: number[] = [];

      compareBuckets.forEach((type) => {
        const aggregate = byType?.get(type);
        if (!aggregate || aggregate.count === 0) {
          row[type] = null;
          return;
        }

        const average = aggregate.total / aggregate.count;
        row[type] = average;
        numericValues.push(average);
      });

      const diffStats = getDiffStats(numericValues);
      row.delta = diffStats.delta;
      row.percentDiff = diffStats.percentDiff;

      return row;
    });
  };

  const chartRows = useMemo(
    () => buildComparisonRows(displayedChartMembers),
    [displayedChartMembers, aggregatesByMember, compareBuckets]
  );

  const tableRows = useMemo(
    () => buildComparisonRows(availableMembers),
    [availableMembers, aggregatesByMember, compareBuckets]
  );

  const typeSummary = useMemo(() => {
    const totals = new Map<string, Aggregate>();

    scopedData.forEach((record) => {
      const bucket = getModasBucket(record);
      const current = totals.get(bucket) ?? { total: 0, count: 0 };
      totals.set(bucket, {
        total: current.total + record[metric],
        count: current.count + 1,
      });
    });

    return compareBuckets
      .map((type) => {
        const aggregate = totals.get(type);
        if (!aggregate || aggregate.count === 0) {
          return {
            entity: type,
            average: null as number | null,
            count: 0,
          };
        }

        return {
          entity: type,
          average: aggregate.total / aggregate.count,
          count: aggregate.count,
        };
      })
      .sort((a, b) => {
        const aValue = a.average ?? Number.NEGATIVE_INFINITY;
        const bValue = b.average ?? Number.NEGATIVE_INFINITY;
        return bValue - aValue;
      });
  }, [scopedData, metric, compareBuckets]);

  const bestType = typeSummary.find((row) => row.average !== null) ?? null;
  const selectedAccountHasMultipleTypes =
    (selectedAccountOption?.typeCount ?? 0) >= 2;

  const overallComparisonData = useMemo(
    () =>
      typeSummary.map((row) => ({
        entity: row.entity,
        average: row.average,
      })),
    [typeSummary]
  );

  const overallComparisonStats = useMemo(() => {
    const values = typeSummary
      .map((row) => row.average)
      .filter((value): value is number => value !== null);

    return getDiffStats(values);
  }, [typeSummary]);

  const typeSummaryMap = useMemo(
    () => new Map(typeSummary.map((row) => [row.entity, row])),
    [typeSummary]
  );

  const totalTableRow = useMemo(() => {
    const row: ChartRow = {
      label: "Overall Avg/HR",
      delta: null,
      percentDiff: null,
    };
    const numericValues: number[] = [];

    compareBuckets.forEach((type) => {
      const average = typeSummaryMap.get(type)?.average ?? null;
      row[type] = average;

      if (typeof average === "number") {
        numericValues.push(average);
      }
    });

    const diffStats = getDiffStats(numericValues);
    row.delta = diffStats.delta;
    row.percentDiff = diffStats.percentDiff;

    return row;
  }, [compareBuckets, typeSummaryMap]);

  const typeColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    compareBuckets.forEach((type, index) => {
      colorMap.set(type, BAR_COLORS[index % BAR_COLORS.length]);
    });
    return colorMap;
  }, [compareBuckets]);

  const trendData = useMemo(() => {
    const byMonth = new Map<string, Map<string, Aggregate>>();

    scopedData.forEach((record) => {
      const month = record.date.substring(0, 7);

      if (!byMonth.has(month)) {
        byMonth.set(month, new Map<string, Aggregate>());
      }

      const monthMap = byMonth.get(month)!;
      const bucket = getModasBucket(record);
      const current = monthMap.get(bucket) ?? { total: 0, count: 0 };
      monthMap.set(bucket, {
        total: current.total + record[metric],
        count: current.count + 1,
      });
    });

    return Array.from(byMonth.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((month) => {
        const row: { [key: string]: string | number | null } = { date: month };
        const monthMap = byMonth.get(month);

        compareBuckets.forEach((type) => {
          const aggregate = monthMap?.get(type);
          row[type] =
            aggregate && aggregate.count > 0
              ? aggregate.total / aggregate.count
              : null;
        });

        return row;
      });
  }, [scopedData, metric, compareBuckets]);

  const hasTrendData = useMemo(
    () =>
      trendData.some((point) =>
        compareBuckets.some((type) => typeof point[type] === "number")
      ),
    [trendData, compareBuckets]
  );

  const handleTableSort = (key: TableSortKey) => {
    if (tableSortKey === key) {
      setTableSortOrder((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setTableSortKey(key);
    setTableSortOrder("asc");
  };

  const sortedTableRows = useMemo(() => {
    const rows = [...tableRows];

    const getSortValue = (row: ChartRow): string | number | null => {
      if (tableSortKey === "label") return row.label;
      if (tableSortKey === "delta") return row.delta;
      if (tableSortKey === "percentDiff") return row.percentDiff;
      if (tableSortKey.startsWith("entity:")) {
        const entity = tableSortKey.replace("entity:", "");
        const value = row[entity];
        return typeof value === "number" ? value : null;
      }
      return null;
    };

    rows.sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (typeof aValue === "string" && typeof bValue === "string") {
        return tableSortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      const aNumber = typeof aValue === "number" ? aValue : null;
      const bNumber = typeof bValue === "number" ? bValue : null;

      if (aNumber === null && bNumber === null) return 0;
      if (aNumber === null) return 1;
      if (bNumber === null) return -1;

      return tableSortOrder === "asc"
        ? aNumber - bNumber
        : bNumber - aNumber;
    });

    return rows;
  }, [tableRows, tableSortKey, tableSortOrder]);

  const tickColor = isDarkMode ? "#94a3b8" : "#64748b";
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";

  const renderSortIndicator = (key: TableSortKey) => {
    if (tableSortKey !== key) return null;
    return tableSortOrder === "asc" ? <SortAscIcon /> : <SortDescIcon />;
  };

  const sortableHeaderClass =
    "px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300";
  const firstSortableHeaderClass =
    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300";

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Compare Modas vs Non-Modas
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Pick one account, then compare Modas vs Non-Modas production by
              store, employee, group, or underlying account.
            </p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {selectedAccount
              ? `${compareBuckets.length} buckets found`
              : `${eligibleAccountCount} mixed accounts in scope`}
          </p>
        </div>

        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={handleClearCompareFilters}
            className="px-4 py-2 bg-slate-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            Clear Compare Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Account
            <select
              value={selectedAccount}
              onChange={(event) => setSelectedAccount(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              <option value="">Select an account</option>
              {accountOptions.map((option) => (
                <option key={option.accountLabel} value={option.accountLabel}>
                  {option.accountLabel}
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
              <option value="supervisor">Group</option>
              <option value="account">Account</option>
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Metric (per hour)
            <select
              value={metric}
              onChange={(event) => setMetric(event.target.value as Metric)}
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              {METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
            {breakdownLabel}
            <select
              value={selectedMember}
              onChange={(event) => setSelectedMember(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              <option value="all">Top {topN} ({breakdownLabel}s)</option>
              {availableMembers.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
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

        {selectedMember === "all" && (
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mt-4 max-w-xs">
            Top {breakdownLabel}s to Display
            <input
              type="number"
              min={1}
              max={25}
              value={topN}
              onChange={(event) => {
                const parsed = parseInt(event.target.value, 10);
                if (Number.isNaN(parsed)) {
                  setTopN(1);
                  return;
                }
                setTopN(Math.max(1, Math.min(25, parsed)));
              }}
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
          </label>
        )}

        <div className="mt-4">
          {!selectedAccount ? (
            <div className="rounded-md border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
              Select an account to compare Modas vs Non-Modas history.
            </div>
          ) : !selectedAccountHasMultipleTypes ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {selectedAccount} currently has only{" "}
              {selectedAccountOption?.typeCount ?? 0} Modas bucket in this
              scope.
            </div>
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              Comparing Modas vs Non-Modas for {selectedAccount}.
            </div>
          )}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Graph Views
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {scopedData.length.toLocaleString()} records in scope
          </p>
        </div>

        <div
          role="group"
          aria-label="Modas comparison graph tabs"
          className="inline-flex rounded-md shadow-sm mb-4"
        >
          <button
            type="button"
            onClick={() => setActiveGraphTab("overall")}
            className={`px-4 py-2 text-sm font-medium border rounded-l-md ${
              activeGraphTab === "overall"
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
            }`}
          >
            Overall Comparison
          </button>
          <button
            type="button"
            onClick={() => setActiveGraphTab("breakdown")}
            className={`px-4 py-2 text-sm font-medium border ${
              activeGraphTab === "breakdown"
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
            }`}
          >
            Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveGraphTab("trend")}
            className={`px-4 py-2 text-sm font-medium border rounded-r-md ${
              activeGraphTab === "trend"
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
            }`}
          >
            Trend
          </button>
        </div>

        {activeGraphTab === "overall" && (
          <>
            {bestType && (
              <p className="mb-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                Best overall bucket:{" "}
                <span className="text-slate-800 dark:text-slate-100">
                  {bestType.entity}
                </span>{" "}
                ({bestType.average!.toFixed(2)} avg/hr{" "}
                {metricLabel.toLowerCase()})
              </p>
            )}

            {!selectedAccount ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Select an account to start comparing Modas vs Non-Modas.
              </div>
            ) : !selectedAccountHasMultipleTypes ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                This account only has one bucket in the current scope, so there
                is nothing to compare yet.
              </div>
            ) : overallComparisonData.every((row) => row.average === null) ? (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No production/hr data available for the selected filters.
              </div>
            ) : (
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={overallComparisonData.map((row) => ({
                      entity: row.entity,
                      average: row.average ?? 0,
                    }))}
                    margin={{ top: 28, right: 20, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="entity"
                      tick={{ fontSize: 12, fill: tickColor }}
                      interval={0}
                      angle={overallComparisonData.length > 4 ? -20 : 0}
                      textAnchor={
                        overallComparisonData.length > 4 ? "end" : "middle"
                      }
                      height={overallComparisonData.length > 4 ? 70 : 50}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: tickColor }}
                      domain={[
                        0,
                        (dataMax: number) =>
                          dataMax > 0 ? Number((dataMax * 1.12).toFixed(2)) : 1,
                      ]}
                    />
                    <Tooltip
                      formatter={(value: number | string) => [
                        typeof value === "number" ? value.toFixed(2) : value,
                        `Avg/HR ${metricLabel}`,
                      ]}
                      contentStyle={{
                        backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                        border: `1px solid ${isDarkMode ? "#334155" : "#e2e8f0"}`,
                        borderRadius: "0.5rem",
                        color: isDarkMode ? "#e2e8f0" : "#1e293b",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "14px", color: tickColor }}
                    />
                    <Bar dataKey="average" name={`Avg/HR ${metricLabel}`}>
                      <LabelList
                        dataKey="average"
                        position="top"
                        formatter={(value: number | string) =>
                          typeof value === "number" ? value.toFixed(2) : value
                        }
                        fill={tickColor}
                        fontSize={12}
                      />
                      {overallComparisonData.map((row, index) => (
                        <Cell
                          key={`overall-cell-${row.entity}`}
                          fill={
                            typeColorMap.get(row.entity) ??
                            BAR_COLORS[index % BAR_COLORS.length]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {typeof overallComparisonStats.delta === "number" && (
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                Avg/hr delta across Modas buckets:{" "}
                {overallComparisonStats.delta.toFixed(2)}
                {typeof overallComparisonStats.percentDiff === "number"
                  ? ` (${overallComparisonStats.percentDiff.toFixed(2)}%)`
                  : ""}
              </p>
            )}
          </>
        )}

        {activeGraphTab === "breakdown" && (
          <>
            <p className="mb-4 text-sm font-medium text-slate-600 dark:text-slate-300">
              {metricLabel} breakdown by {breakdownLabel.toLowerCase()}.
            </p>
            {!selectedAccount ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Select an account to start comparing Modas vs Non-Modas.
              </div>
            ) : !selectedAccountHasMultipleTypes ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                This account only has one bucket in the current scope, so there
                is nothing to compare yet.
              </div>
            ) : chartRows.length === 0 ? (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No breakdown data available for the selected filters.
              </div>
            ) : (
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartRows}
                    margin={{ top: 5, right: 20, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: tickColor }}
                      interval={0}
                      angle={chartRows.length > 8 ? -20 : 0}
                      textAnchor={chartRows.length > 8 ? "end" : "middle"}
                      height={chartRows.length > 8 ? 70 : 50}
                    />
                    <YAxis tick={{ fontSize: 12, fill: tickColor }} />
                    <Tooltip
                      formatter={(value: number | string | null) => [
                        typeof value === "number"
                          ? value.toFixed(2)
                          : value ?? "-",
                        metricLabel,
                      ]}
                      contentStyle={{
                        backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                        border: `1px solid ${isDarkMode ? "#334155" : "#e2e8f0"}`,
                        borderRadius: "0.5rem",
                        color: isDarkMode ? "#e2e8f0" : "#1e293b",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "14px", color: tickColor }}
                    />
                    {compareBuckets.map((type, index) => (
                      <Bar
                        key={type}
                        dataKey={type}
                        name={type}
                        fill={BAR_COLORS[index % BAR_COLORS.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {activeGraphTab === "trend" && (
          <>
            <p className="mb-4 text-sm font-medium text-slate-600 dark:text-slate-300">
              Monthly avg/hr trend with one line for Modas and one for
              Non-Modas.
            </p>
            {!selectedAccount ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Select an account to start comparing Modas vs Non-Modas.
              </div>
            ) : !selectedAccountHasMultipleTypes ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                This account only has one bucket in the current scope, so there
                is no trend comparison yet.
              </div>
            ) : !hasTrendData ? (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No trend data available for the selected filters.
              </div>
            ) : (
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 5, right: 20, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: tickColor }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: tickColor }} />
                    <Tooltip
                      formatter={(value: number | string | null) => [
                        typeof value === "number"
                          ? value.toFixed(2)
                          : value ?? "-",
                        `Avg/HR ${metricLabel}`,
                      ]}
                      contentStyle={{
                        backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                        border: `1px solid ${isDarkMode ? "#334155" : "#e2e8f0"}`,
                        borderRadius: "0.5rem",
                        color: isDarkMode ? "#e2e8f0" : "#1e293b",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "14px", color: tickColor }}
                    />
                    {compareBuckets.map((type, index) => (
                      <Line
                        key={`trend-${type}`}
                        type="monotone"
                        dataKey={type}
                        name={type}
                        stroke={BAR_COLORS[index % BAR_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
          Side-by-Side Comparison Table
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th
                  className={firstSortableHeaderClass}
                  onClick={() => handleTableSort("label")}
                >
                  <div className="flex items-center gap-1">
                    {breakdownLabel} / Overall Avg
                    {renderSortIndicator("label")}
                  </div>
                </th>
                {compareBuckets.map((type) => (
                  <th
                    key={`header-${type}`}
                    className={sortableHeaderClass}
                    onClick={() => handleTableSort(`entity:${type}`)}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {type}
                      {renderSortIndicator(`entity:${type}`)}
                    </div>
                  </th>
                ))}
                <th
                  className={sortableHeaderClass}
                  onClick={() => handleTableSort("delta")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Delta
                    {renderSortIndicator("delta")}
                  </div>
                </th>
                <th
                  className={sortableHeaderClass}
                  onClick={() => handleTableSort("percentDiff")}
                >
                  <div className="flex items-center justify-end gap-1">
                    % Diff
                    {renderSortIndicator("percentDiff")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {compareBuckets.length === 0 ? (
                <tr>
                  <td
                    colSpan={compareBuckets.length + 3}
                    className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No rows to display.
                  </td>
                </tr>
              ) : (
                <>
                  <tr className="bg-slate-50 dark:bg-slate-700/40">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {totalTableRow.label}
                    </td>
                    {compareBuckets.map((type) => {
                      const value = totalTableRow[type];
                      return (
                        <td
                          key={`total-${type}`}
                          className="px-4 py-3 text-right text-sm font-semibold text-slate-700 dark:text-slate-200"
                        >
                          {typeof value === "number" ? value.toFixed(2) : "-"}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {typeof totalTableRow.delta === "number"
                        ? totalTableRow.delta.toFixed(2)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {typeof totalTableRow.percentDiff === "number"
                        ? `${totalTableRow.percentDiff.toFixed(2)}%`
                        : "-"}
                    </td>
                  </tr>

                  {sortedTableRows.map((row) => (
                    <tr
                      key={row.label}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {row.label}
                      </td>
                      {compareBuckets.map((type) => {
                        const value = row[type];
                        return (
                          <td
                            key={`${row.label}-${type}`}
                            className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-300"
                          >
                            {typeof value === "number" ? value.toFixed(2) : "-"}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {typeof row.delta === "number"
                          ? row.delta.toFixed(2)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {typeof row.percentDiff === "number"
                          ? `${row.percentDiff.toFixed(2)}%`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {typeSummary.length > 0 && (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            {typeSummary.map((row) => (
              <p key={`summary-${row.entity}`}>
                {row.entity}: {row.average === null ? "-" : row.average.toFixed(2)}{" "}
                avg/hr {metricLabel.toLowerCase()} ({row.count.toLocaleString()}{" "}
                records)
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default TypeOfInvComparisonPage;
