import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  BAR_COLORS,
  ChartRow,
  GraphTab,
  MAX_SELECTED_ENTITIES,
  TableSortKey,
  TIMEFRAME_OPTIONS,
  Timeframe,
  Aggregate,
  areArraysEqual,
  filterByTimeframe,
  getDiffStats,
} from "./comparisonShared";

type CompareDimension = "account" | "store";
type BreakdownDimension = "employee" | "supervisor";

const ProductionComparisonPage: React.FC<{
  data: EmployeeRecord[];
  isDarkMode: boolean;
}> = ({ data, isDarkMode }) => {
  const [compareBy, setCompareBy] = useState<CompareDimension>("account");
  const [breakdownBy, setBreakdownBy] = useState<BreakdownDimension>(
    "employee"
  );
  const [metric, setMetric] = useState<Metric>("pieces");
  const [timeframe, setTimeframe] = useState<Timeframe>("last90");
  const [office, setOffice] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [specificDate, setSpecificDate] = useState("");
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [entitySearch, setEntitySearch] = useState("");
  const [selectedMember, setSelectedMember] = useState("all");
  const [topN, setTopN] = useState(8);
  const [activeGraphTab, setActiveGraphTab] = useState<GraphTab>("overall");
  const [tableSortKey, setTableSortKey] = useState<TableSortKey>("label");
  const [tableSortOrder, setTableSortOrder] = useState<"asc" | "desc">("asc");

  const handleClearCompareFilters = () => {
    setCompareBy("account");
    setBreakdownBy("employee");
    setMetric("pieces");
    setTimeframe("last90");
    setOffice("all");
    setStartDate("");
    setEndDate("");
    setSpecificDate("");
    setSelectedEntities([]);
    setEntitySearch("");
    setSelectedMember("all");
    setTopN(8);
    setActiveGraphTab("overall");
    setTableSortKey("label");
    setTableSortOrder("asc");
  };

  const metricLabel =
    METRIC_OPTIONS.find((option) => option.value === metric)?.label || "Metric";
  const compareLabel = compareBy === "account" ? "Account" : "Store";
  const breakdownLabel =
    breakdownBy === "employee" ? "Employee" : "Supervisor Group";

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

  const getComparisonEntity = useMemo(
    () => (record: EmployeeRecord) =>
      compareBy === "account"
        ? getAccountGroupLabel(record.account)
        : record.store,
    [compareBy]
  );

  const availableEntities = useMemo(() => {
    const values = new Set<string>();
    officeFilteredData.forEach((record) =>
      values.add(getComparisonEntity(record))
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [officeFilteredData, getComparisonEntity]);

  useEffect(() => {
    setSelectedEntities((previous) => {
      const stillValid = previous.filter((entity) => availableEntities.includes(entity));
      if (areArraysEqual(previous, stillValid)) return previous;
      return stillValid;
    });
  }, [availableEntities]);

  const filteredEntitySuggestions = useMemo(() => {
    const search = entitySearch.trim().toLowerCase();

    return availableEntities
      .filter((entity) => !selectedEntities.includes(entity))
      .filter(
        (entity) => !search || entity.toLowerCase().includes(search)
      )
      .slice(0, 12);
  }, [availableEntities, selectedEntities, entitySearch]);

  const addEntity = (entity: string) => {
    setSelectedEntities((previous) => {
      if (previous.includes(entity)) return previous;
      if (previous.length >= MAX_SELECTED_ENTITIES) return previous;
      return [...previous, entity];
    });
    setEntitySearch("");
  };

  const removeEntity = (entity: string) => {
    setSelectedEntities((previous) =>
      previous.filter((item) => item !== entity)
    );
  };

  const handleAddFromSearch = () => {
    if (selectedEntities.length >= MAX_SELECTED_ENTITIES) return;

    const search = entitySearch.trim().toLowerCase();
    if (!search) return;

    const exactMatch = availableEntities.find(
      (entity) =>
        entity.toLowerCase() === search && !selectedEntities.includes(entity)
    );
    if (exactMatch) {
      addEntity(exactMatch);
      return;
    }

    const firstSuggestion = filteredEntitySuggestions[0];
    if (firstSuggestion) addEntity(firstSuggestion);
  };

  const selectedEntitySet = useMemo(
    () => new Set(selectedEntities),
    [selectedEntities]
  );

  const scopedData = useMemo(
    () =>
      officeFilteredData.filter((record) =>
        selectedEntitySet.has(getComparisonEntity(record))
      ),
    [officeFilteredData, selectedEntitySet, getComparisonEntity]
  );

  const aggregatesByMember = useMemo(() => {
    const byMember = new Map<string, Map<string, Aggregate>>();

    scopedData.forEach((record) => {
      const memberKey = record[breakdownBy];
      const entityKey = getComparisonEntity(record);

      let byEntity = byMember.get(memberKey);
      if (!byEntity) {
        byEntity = new Map<string, Aggregate>();
        byMember.set(memberKey, byEntity);
      }

      const current = byEntity.get(entityKey) ?? { total: 0, count: 0 };
      byEntity.set(entityKey, {
        total: current.total + record[metric],
        count: current.count + 1,
      });
    });

    return byMember;
  }, [scopedData, breakdownBy, getComparisonEntity, metric]);

  const memberAverages = useMemo(() => {
    const rows = Array.from(aggregatesByMember.entries()).map(
      ([member, byEntity]) => {
        let total = 0;
        let count = 0;

        byEntity.forEach((aggregate) => {
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

  const buildComparisonRows = (members: string[]) => {
    return members.map((member) => {
      const row: ChartRow = { label: member, delta: null, percentDiff: null };
      const byEntity = aggregatesByMember.get(member);
      const numericValues: number[] = [];

      selectedEntities.forEach((entity) => {
        const aggregate = byEntity?.get(entity);
        if (!aggregate || aggregate.count === 0) {
          row[entity] = null;
          return;
        }

        const average = aggregate.total / aggregate.count;
        row[entity] = average;
        numericValues.push(average);
      });

      const diffStats = getDiffStats(numericValues);
      row.delta = diffStats.delta;
      row.percentDiff = diffStats.percentDiff;

      return row;
    });
  };

  const chartRows = useMemo(
    () => buildComparisonRows(displayedMembers),
    [displayedMembers, aggregatesByMember, selectedEntities]
  );

  const tableRows = useMemo(
    () => buildComparisonRows(availableMembers),
    [availableMembers, aggregatesByMember, selectedEntities]
  );

  const entitySummary = useMemo(() => {
    const totals = new Map<string, Aggregate>();

    scopedData.forEach((record) => {
      const entityKey = getComparisonEntity(record);
      const current = totals.get(entityKey) ?? { total: 0, count: 0 };
      totals.set(entityKey, {
        total: current.total + record[metric],
        count: current.count + 1,
      });
    });

    return selectedEntities
      .map((entity) => {
        const aggregate = totals.get(entity);
        if (!aggregate || aggregate.count === 0) {
          return {
            entity,
            average: null as number | null,
            count: 0,
          };
        }
        return {
          entity,
          average: aggregate.total / aggregate.count,
          count: aggregate.count,
        };
      })
      .sort((a, b) => {
        const aValue = a.average ?? Number.NEGATIVE_INFINITY;
        const bValue = b.average ?? Number.NEGATIVE_INFINITY;
        return bValue - aValue;
      });
  }, [scopedData, getComparisonEntity, metric, selectedEntities]);

  const bestEntity = entitySummary.find((row) => row.average !== null) ?? null;
  const hasEnoughEntities = selectedEntities.length >= 2;
  const hasSelectedEntities = selectedEntities.length > 0;

  const overallComparisonData = useMemo(
    () =>
      entitySummary.map((row) => ({
        entity: row.entity,
        average: row.average,
      })),
    [entitySummary]
  );

  const overallComparisonStats = useMemo(() => {
    const values = entitySummary
      .map((row) => row.average)
      .filter((value): value is number => value !== null);

    return getDiffStats(values);
  }, [entitySummary]);

  const entitySummaryMap = useMemo(
    () => new Map(entitySummary.map((row) => [row.entity, row])),
    [entitySummary]
  );

  const totalTableRow = useMemo(() => {
    const row: ChartRow = {
      label: "Overall Avg/HR",
      delta: null,
      percentDiff: null,
    };
    const numericValues: number[] = [];

    selectedEntities.forEach((entity) => {
      const average = entitySummaryMap.get(entity)?.average ?? null;
      row[entity] = average;

      if (typeof average === "number") {
        numericValues.push(average);
      }
    });

    const diffStats = getDiffStats(numericValues);
    row.delta = diffStats.delta;
    row.percentDiff = diffStats.percentDiff;

    return row;
  }, [selectedEntities, entitySummaryMap]);

  const entityColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    selectedEntities.forEach((entity, index) => {
      colorMap.set(entity, BAR_COLORS[index % BAR_COLORS.length]);
    });
    return colorMap;
  }, [selectedEntities]);

  const trendData = useMemo(() => {
    const byMonth = new Map<string, Map<string, Aggregate>>();

    scopedData.forEach((record) => {
      const month = record.date.substring(0, 7);
      const entity = getComparisonEntity(record);

      if (!byMonth.has(month)) {
        byMonth.set(month, new Map<string, Aggregate>());
      }
      const monthMap = byMonth.get(month)!;
      const current = monthMap.get(entity) ?? { total: 0, count: 0 };
      monthMap.set(entity, {
        total: current.total + record[metric],
        count: current.count + 1,
      });
    });

    return Array.from(byMonth.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((month) => {
        const row: { [key: string]: string | number | null } = { date: month };
        const monthMap = byMonth.get(month);

        selectedEntities.forEach((entity) => {
          const aggregate = monthMap?.get(entity);
          row[entity] =
            aggregate && aggregate.count > 0
              ? aggregate.total / aggregate.count
              : null;
        });

        return row;
      });
  }, [scopedData, getComparisonEntity, metric, selectedEntities]);

  const hasTrendData = useMemo(
    () =>
      trendData.some((point) =>
        selectedEntities.some((entity) => typeof point[entity] === "number")
      ),
    [trendData, selectedEntities]
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

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Compare Production
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Compare selected accounts or stores by employee or supervisor
              group averages.
            </p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Select 2 to {MAX_SELECTED_ENTITIES} {compareBy}s
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
            Compare
            <select
              value={compareBy}
              onChange={(event) =>
                setCompareBy(event.target.value as CompareDimension)
              }
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            >
              <option value="account">Accounts</option>
              <option value="store">Stores</option>
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
              <option value="employee">Employee</option>
              <option value="supervisor">Supervisor Group</option>
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

        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
            Search and Add {compareBy === "account" ? "Accounts" : "Stores"}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={entitySearch}
              onChange={(event) => setEntitySearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddFromSearch();
                }
              }}
              placeholder={`Search ${compareBy} name...`}
              className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleAddFromSearch}
              disabled={
                selectedEntities.length >= MAX_SELECTED_ENTITIES ||
                entitySearch.trim().length === 0
              }
              className="px-3 py-2 text-sm font-semibold rounded-md bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {selectedEntities.map((entity) => (
              <button
                key={`selected-${entity}`}
                type="button"
                onClick={() => removeEntity(entity)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {entity}
                <span aria-hidden="true">x</span>
              </button>
            ))}
          </div>

          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Click a selected item to remove it.
          </div>

          <div className="mt-3 max-h-48 overflow-y-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {filteredEntitySuggestions.map((entity) => (
              <button
                key={`suggestion-${entity}`}
                type="button"
                onClick={() => addEntity(entity)}
                disabled={selectedEntities.length >= MAX_SELECTED_ENTITIES}
                className="text-left rounded-md border border-slate-200 dark:border-slate-700 px-2 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {entity}
              </button>
            ))}
          </div>
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
          aria-label="Comparison graph tabs"
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
            {bestEntity && (
              <p className="mb-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                Best overall {compareLabel.toLowerCase()}:{" "}
                <span className="text-slate-800 dark:text-slate-100">
                  {bestEntity.entity}
                </span>{" "}
                ({bestEntity.average!.toFixed(2)} avg/hr{" "}
                {metricLabel.toLowerCase()})
              </p>
            )}

            {!hasEnoughEntities ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Select at least two {compareBy}s to run comparisons.
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
                    margin={{ top: 5, right: 20, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="entity"
                      tick={{ fontSize: 12, fill: tickColor }}
                      interval={0}
                      angle={overallComparisonData.length > 6 ? -20 : 0}
                      textAnchor={
                        overallComparisonData.length > 6 ? "end" : "middle"
                      }
                      height={overallComparisonData.length > 6 ? 70 : 50}
                    />
                    <YAxis tick={{ fontSize: 12, fill: tickColor }} />
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
                    <Bar
                      dataKey="average"
                      name={`Avg/HR ${metricLabel}`}
                    >
                      {overallComparisonData.map((row, index) => (
                        <Cell
                          key={`overall-cell-${row.entity}`}
                          fill={
                            entityColorMap.get(row.entity) ??
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
                Avg/hr delta across selected {compareBy}s:{" "}
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
            {!hasEnoughEntities ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Select at least two {compareBy}s to run comparisons.
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
                    {selectedEntities.map((entity, index) => (
                      <Bar
                        key={entity}
                        dataKey={entity}
                        name={entity}
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
              Monthly avg/hr trend with one line per selected {compareBy}.
            </p>
            {!hasSelectedEntities ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Select at least one {compareBy} to view trend data.
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
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: tickColor }} />
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
                    <Legend wrapperStyle={{ fontSize: "14px", color: tickColor }} />
                    {selectedEntities.map((entity, index) => (
                      <Line
                        key={`trend-${entity}`}
                        type="monotone"
                        dataKey={entity}
                        name={entity}
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
          {(() => {
            const renderSortIndicator = (key: TableSortKey) => {
              if (tableSortKey !== key) return null;
              return tableSortOrder === "asc" ? (
                <SortAscIcon />
              ) : (
                <SortDescIcon />
              );
            };

            const sortableHeaderClass =
              "px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300";
            const firstSortableHeaderClass =
              "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300";

            return (
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
                {selectedEntities.map((entity) => (
                  <th
                    key={`header-${entity}`}
                    className={sortableHeaderClass}
                    onClick={() => handleTableSort(`entity:${entity}`)}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {entity}
                      {renderSortIndicator(`entity:${entity}`)}
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
              {selectedEntities.length === 0 ? (
                <tr>
                  <td
                    colSpan={selectedEntities.length + 3}
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
                    {selectedEntities.map((entity) => {
                      const value = totalTableRow[entity];
                      return (
                        <td
                          key={`total-${entity}`}
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
                      {selectedEntities.map((entity) => {
                        const value = row[entity];
                        return (
                          <td
                            key={`${row.label}-${entity}`}
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
            );
          })()}
        </div>

        {entitySummary.length > 0 && (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            {entitySummary.map((row) => (
              <p key={`summary-${row.entity}`}>
                {row.entity}:{" "}
                {row.average === null ? "-" : row.average.toFixed(2)} avg/hr{" "}
                {metricLabel.toLowerCase()} ({row.count.toLocaleString()}{" "}
                records)
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProductionComparisonPage;
