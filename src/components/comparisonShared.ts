import { EmployeeRecord } from "../types";

export type GraphTab = "overall" | "breakdown" | "trend";
export type TableSortKey =
  | "label"
  | "delta"
  | "percentDiff"
  | `entity:${string}`;
export type Timeframe =
  | "all"
  | "last7"
  | "last30"
  | "last90"
  | "last180"
  | "last365"
  | "custom"
  | "specific";

export type ChartRow = {
  label: string;
  delta: number | null;
  percentDiff: number | null;
  [key: string]: string | number | null;
};

export type Aggregate = {
  total: number;
  count: number;
};

export const MAX_SELECTED_ENTITIES = 6;

export const BAR_COLORS = [
  "#b91c1c",
  "#0f766e",
  "#1d4ed8",
  "#b45309",
  "#9333ea",
  "#0369a1",
];

export const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "last90", label: "Last 3 months" },
  { value: "last180", label: "Last 6 Months" },
  { value: "last365", label: "Last 12 Months" },
  { value: "custom", label: "Custom Range" },
  { value: "specific", label: "Specific Date" },
];

export const areArraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export const filterByTimeframe = (
  data: EmployeeRecord[],
  timeframe: Timeframe,
  startDate: string,
  endDate: string,
  specificDate: string
) => {
  if (!data.length) return [];

  const now = new Date();
  return data.filter((record) => {
    if (timeframe === "all") return true;

    const recordDate = new Date(record.date.replace(/-/g, "/"));

    if (timeframe === "custom") {
      if (!startDate || !endDate) return true;
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return recordDate >= start && recordDate <= end;
    }

    if (timeframe === "specific") {
      if (!specificDate) return true;
      return record.date === specificDate;
    }

    const days = parseInt(timeframe.replace("last", ""), 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - days);
    return recordDate >= cutoffDate;
  });
};

export const getDiffStats = (values: number[]) => {
  if (!values.length) {
    return { delta: null as number | null, percentDiff: null as number | null };
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const delta = maxValue - minValue;
  const percentDiff =
    minValue === 0 ? null : (delta / Math.abs(minValue)) * 100;

  return { delta, percentDiff };
};
