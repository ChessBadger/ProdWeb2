import { EmployeeRecord, Metric } from "../types";

export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface EmployeeGrowthRow {
  employee: string;
  currentAvg: number | null;
  previousAvg: number | null;
  change: number | null;
  percentChange: number | null;
  rank: number | null;
  previousRank: number | null;
  rankChange: number | null;
  currentCount: number;
  previousCount: number;
  confidence: ConfidenceLevel;
}

export interface EmployeeAlert {
  employee: string;
  type: "positive" | "warning" | "neutral";
  title: string;
  detail: string;
  value: number | null;
}

export interface EmployeeProfileSummary {
  employee: string;
  records: EmployeeRecord[];
  average: number;
  expectedAverage: number | null;
  expectedDelta: number | null;
  consistency: number;
  confidence: ConfidenceLevel;
  firstDate: string;
  lastDate: string;
  bestStore: NamedAverage | null;
  worstStore: NamedAverage | null;
  bestAccount: NamedAverage | null;
  worstAccount: NamedAverage | null;
  recentRecords: EmployeeRecord[];
}

export interface NamedAverage {
  name: string;
  average: number;
  count: number;
}

export interface RampPoint {
  jobNumber: number;
  value: number;
  rollingAvg: number;
  date: string;
}

export const getTime = (date: string): number =>
  new Date(date.replace(/-/g, "/")).getTime();

export const average = (values: number[]): number | null => {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const formatDelta = (value: number | null, decimals = 2): string => {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}`;
};

export const getConfidenceLevel = (count: number): ConfidenceLevel => {
  if (count >= 30) return "High";
  if (count >= 10) return "Medium";
  return "Low";
};

export const getConsistencyScore = (
  records: EmployeeRecord[],
  metric: Metric
): number => {
  if (records.length < 2) return records.length === 1 ? 100 : 0;
  const values = records.map((record) => record[metric]);
  const mean = average(values) ?? 0;
  if (mean === 0) return values.every((value) => value === 0) ? 100 : 0;
  const variance =
    values.map((value) => Math.pow(value - mean, 2)).reduce((a, b) => a + b) /
    values.length;
  const cv = Math.sqrt(variance) / Math.abs(mean);
  return Math.max(0, 1 - cv) * 100;
};

export const groupRecords = <T extends string>(
  records: EmployeeRecord[],
  getKey: (record: EmployeeRecord) => T
): Map<T, EmployeeRecord[]> => {
  const groups = new Map<T, EmployeeRecord[]>();
  records.forEach((record) => {
    const key = getKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  });
  return groups;
};

export const getNamedAverages = (
  records: EmployeeRecord[],
  metric: Metric,
  getName: (record: EmployeeRecord) => string
): NamedAverage[] =>
  Array.from(groupRecords(records, getName).entries())
    .map(([name, groupedRecords]) => ({
      name,
      average: average(groupedRecords.map((record) => record[metric])) ?? 0,
      count: groupedRecords.length,
    }))
    .sort((a, b) => b.average - a.average);

export const buildExpectedAverageMap = (
  records: EmployeeRecord[],
  metric: Metric
): Map<string, number> => {
  const groups = groupRecords(
    records,
    (record) => `${record.store}||${record.account}||${record.typeOfInv}`
  );
  return new Map(
    Array.from(groups.entries()).map(([key, groupedRecords]) => [
      key,
      average(groupedRecords.map((record) => record[metric])) ?? 0,
    ])
  );
};

export const getExpectedAverageForRecords = (
  records: EmployeeRecord[],
  expectedMap: Map<string, number>
): number | null => {
  const values = records
    .map((record) =>
      expectedMap.get(`${record.store}||${record.account}||${record.typeOfInv}`)
    )
    .filter((value): value is number => typeof value === "number");
  return average(values);
};

export const buildGrowthRows = (
  records: EmployeeRecord[],
  metric: Metric,
  anchorDate?: Date
): EmployeeGrowthRow[] => {
  if (!records.length) return [];
  const now = anchorDate ?? new Date(Math.max(...records.map((record) => getTime(record.date))));
  now.setDate(now.getDate() + 1);
  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - 30);
  const previousStart = new Date(now);
  previousStart.setDate(now.getDate() - 60);

  const employees = Array.from(new Set(records.map((record) => record.employee)));

  const buildPeriodRows = (start: Date, end: Date) =>
    employees
      .map((employee) => {
        const periodRecords = records.filter((record) => {
          if (record.employee !== employee) return false;
          const time = getTime(record.date);
          return time >= start.getTime() && time < end.getTime();
        });
        return {
          employee,
          average: average(periodRecords.map((record) => record[metric])),
          count: periodRecords.length,
        };
      })
      .sort((a, b) => (b.average ?? -Infinity) - (a.average ?? -Infinity));

  const currentRows = buildPeriodRows(currentStart, now);
  const previousRows = buildPeriodRows(previousStart, currentStart);
  const currentRank = new Map(
    currentRows.map((row, index) => [row.employee, row.average === null ? null : index + 1])
  );
  const previousRank = new Map(
    previousRows.map((row, index) => [row.employee, row.average === null ? null : index + 1])
  );
  const currentByEmployee = new Map(currentRows.map((row) => [row.employee, row]));
  const previousByEmployee = new Map(previousRows.map((row) => [row.employee, row]));

  return employees
    .map((employee) => {
      const current = currentByEmployee.get(employee);
      const previous = previousByEmployee.get(employee);
      const currentAvg = current?.average ?? null;
      const previousAvg = previous?.average ?? null;
      const change =
        currentAvg !== null && previousAvg !== null ? currentAvg - previousAvg : null;
      const percentChange =
        change !== null && previousAvg !== null && previousAvg !== 0
          ? (change / Math.abs(previousAvg)) * 100
          : null;
      const rank = currentRank.get(employee) ?? null;
      const prevRank = previousRank.get(employee) ?? null;

      return {
        employee,
        currentAvg,
        previousAvg,
        change,
        percentChange,
        rank,
        previousRank: prevRank,
        rankChange: rank !== null && prevRank !== null ? prevRank - rank : null,
        currentCount: current?.count ?? 0,
        previousCount: previous?.count ?? 0,
        confidence: getConfidenceLevel((current?.count ?? 0) + (previous?.count ?? 0)),
      };
    })
    .sort((a, b) => (b.percentChange ?? -Infinity) - (a.percentChange ?? -Infinity));
};

export const buildEmployeeProfile = (
  employee: string,
  records: EmployeeRecord[],
  metric: Metric,
  expectedMap: Map<string, number>
): EmployeeProfileSummary | null => {
  const employeeRecords = records
    .filter((record) => record.employee === employee)
    .sort((a, b) => getTime(a.date) - getTime(b.date));
  if (!employeeRecords.length) return null;

  const storeAverages = getNamedAverages(employeeRecords, metric, (record) => record.store);
  const accountAverages = getNamedAverages(
    employeeRecords,
    metric,
    (record) => record.account
  );
  const employeeAverage = average(employeeRecords.map((record) => record[metric])) ?? 0;
  const expectedAverage = getExpectedAverageForRecords(employeeRecords, expectedMap);

  return {
    employee,
    records: employeeRecords,
    average: employeeAverage,
    expectedAverage,
    expectedDelta:
      expectedAverage !== null ? employeeAverage - expectedAverage : null,
    consistency: getConsistencyScore(employeeRecords, metric),
    confidence: getConfidenceLevel(employeeRecords.length),
    firstDate: employeeRecords[0].date,
    lastDate: employeeRecords[employeeRecords.length - 1].date,
    bestStore: storeAverages[0] ?? null,
    worstStore: storeAverages.at(-1) ?? null,
    bestAccount: accountAverages[0] ?? null,
    worstAccount: accountAverages.at(-1) ?? null,
    recentRecords: [...employeeRecords].reverse().slice(0, 8),
  };
};

export const buildRampPoints = (
  records: EmployeeRecord[],
  metric: Metric,
  windowSize = 5
): RampPoint[] => {
  const sortedRecords = [...records].sort((a, b) => getTime(a.date) - getTime(b.date));
  return sortedRecords.map((record, index) => {
    const windowRecords = sortedRecords.slice(Math.max(0, index - windowSize + 1), index + 1);
    return {
      jobNumber: index + 1,
      value: record[metric],
      rollingAvg: average(windowRecords.map((item) => item[metric])) ?? record[metric],
      date: record.date,
    };
  });
};

export const buildAlerts = (
  growthRows: EmployeeGrowthRow[],
  profiles: EmployeeProfileSummary[]
): EmployeeAlert[] => {
  const alerts: EmployeeAlert[] = [];

  growthRows.forEach((row) => {
    if (row.currentCount < 3 || row.previousCount < 3) return;
    if (row.percentChange !== null && row.percentChange <= -12) {
      alerts.push({
        employee: row.employee,
        type: "warning",
        title: "Production trending down",
        detail: `${formatDelta(row.percentChange, 1)}% vs previous 30 days`,
        value: row.percentChange,
      });
    }
    if (row.percentChange !== null && row.percentChange >= 12) {
      alerts.push({
        employee: row.employee,
        type: "positive",
        title: "Production improving",
        detail: `${formatDelta(row.percentChange, 1)}% vs previous 30 days`,
        value: row.percentChange,
      });
    }
    if (row.rankChange !== null && row.rankChange >= 3) {
      alerts.push({
        employee: row.employee,
        type: "positive",
        title: "Rank moving up",
        detail: `Moved up ${row.rankChange} places`,
        value: row.rankChange,
      });
    }
  });

  profiles.forEach((profile) => {
    if (profile.expectedDelta !== null && profile.expectedDelta <= -10 && profile.records.length >= 10) {
      alerts.push({
        employee: profile.employee,
        type: "warning",
        title: "Below expected benchmark",
        detail: `${formatDelta(profile.expectedDelta)} vs store/account/type expectation`,
        value: profile.expectedDelta,
      });
    }
    if (profile.consistency >= 85 && profile.records.length >= 10) {
      alerts.push({
        employee: profile.employee,
        type: "positive",
        title: "Strong consistency",
        detail: `${profile.consistency.toFixed(1)} consistency score`,
        value: profile.consistency,
      });
    }
  });

  return alerts.slice(0, 12);
};
