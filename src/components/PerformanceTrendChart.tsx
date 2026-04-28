import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
  Label,
} from "recharts";
import { EmployeeRecord, Metric } from "../types";
import { METRIC_OPTIONS } from "../constants";
import ToggleSwitch from "./ToggleSwitch";

interface PerformanceTrendChartProps {
  data: EmployeeRecord[];
  overallData: EmployeeRecord[];
  metric: Metric;
  employee: string;
  isDarkMode: boolean;
}

const STDEV_THRESHOLD = 1.5;

const PerformanceTrendChart: React.FC<PerformanceTrendChartProps> = ({
  data,
  overallData,
  metric,
  employee,
  isDarkMode,
}) => {
  const [trendView, setTrendView] = useState<"monthly" | "store">("monthly");
  const [showOverallAvg, setShowOverallAvg] = useState(true);

  const { chartData, peak, lowest, spikes, dips } = useMemo(() => {
    if (!data) {
      return { chartData: [], peak: null, lowest: null, spikes: [], dips: [] };
    }

    const isOverallView = employee === "all";
    const sourceData = isOverallView
      ? data
      : data.filter((d) => d.employee === employee);
    const viewMode = isOverallView ? "overall" : trendView;

    if (sourceData.length === 0) {
      return { chartData: [], peak: null, lowest: null, spikes: [], dips: [] };
    }

    let finalChartData: any[] = [];

    if (viewMode === "monthly" || viewMode === "overall") {
      const monthlyData = new Map<string, { total: number; count: number }>();

      sourceData.forEach((record) => {
        const month = record.date.substring(0, 7);
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { total: 0, count: 0 });
        }
        const current = monthlyData.get(month)!;
        current.total += record[metric];
        current.count += 1;
      });

      finalChartData = Array.from(monthlyData.entries())
        .map(([month, values]) => ({
          date: month,
          [metric]: values.total / values.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // build overall-employees monthly average map
      const overallMonthly = new Map<
        string,
        { total: number; count: number }
      >();
      overallData.forEach((r) => {
        const month = r.date.substring(0, 7);
        if (!overallMonthly.has(month)) {
          overallMonthly.set(month, { total: 0, count: 0 });
        }
        const cur = overallMonthly.get(month)!;
        cur.total += r[metric];
        cur.count += 1;
      });
      const overallMap = new Map(
        Array.from(overallMonthly.entries()).map(([m, v]) => [
          m,
          v.total / v.count,
        ])
      );

      // merge into each point
      finalChartData = finalChartData.map((pt) => ({
        ...pt,
        overallAvg: overallMap.get(pt.date) ?? null,
      }));
    } else {
      const storeTotals = new Map<string, { total: number; count: number }>();

      overallData.forEach((record) => {
        if (!storeTotals.has(record.store)) {
          storeTotals.set(record.store, { total: 0, count: 0 });
        }
        const current = storeTotals.get(record.store)!;
        current.total += record[metric];
        current.count += 1;
      });

      const storeAverageMap = new Map(
        Array.from(storeTotals.entries()).map(([store, values]) => [
          store,
          values.total / values.count,
        ])
      );

      finalChartData = [...sourceData]
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
        .map((record) => ({
          ...record,
          overallAvg: storeAverageMap.get(record.store) ?? null,
        }));
    }

    if (employee !== "all" && viewMode === "store") {
      finalChartData = finalChartData.map((point, index) => ({
        ...point,
        chartKey: `${point.date}-${point.store}-${index}`,
      }));
    }

    if (employee !== "all" && viewMode !== "store") {
      finalChartData = finalChartData.map((point) => ({
        ...point,
        chartKey: point.date,
      }));
    }

    if (employee === "all") {
      finalChartData = finalChartData.map((point) => ({
        ...point,
        chartKey: point.date,
      }));
    }

    // Anomaly detection logic
    if (finalChartData.length < 3) {
      return {
        chartData: finalChartData,
        peak: null,
        lowest: null,
        spikes: [],
        dips: [],
      };
    }

    let peak: any = null;
    let lowest: any = null;
    const spikes: any[] = [];
    const dips: any[] = [];

    const metricValues = finalChartData.map((d) => d[metric]);
    const mean =
      metricValues.reduce((sum, val) => sum + val, 0) / metricValues.length;
    const stdDev = Math.sqrt(
      metricValues
        .map((x) => Math.pow(x - mean, 2))
        .reduce((a, b) => a + b, 0) / metricValues.length
    );
    const upperThreshold = mean + STDEV_THRESHOLD * stdDev;
    const lowerThreshold = mean - STDEV_THRESHOLD * stdDev;

    let maxVal = -Infinity;
    let minVal = Infinity;
    finalChartData.forEach((point) => {
      const value = point[metric];
      if (value > maxVal) {
        maxVal = value;
        peak = point;
      }
      if (value < minVal) {
        minVal = value;
        lowest = point;
      }
    });
    finalChartData.forEach((point) => {
      const value = point[metric];
      if (value > upperThreshold && point !== peak) spikes.push(point);
      if (value < lowerThreshold && point !== lowest) dips.push(point);
    });

    return { chartData: finalChartData, peak, lowest, spikes, dips };
  }, [data, overallData, metric, employee, trendView]);

  // Calculate Y-axis ticks and max value
  const maxDataValue = chartData.length
    ? Math.max(...chartData.map((d) => Math.max(d[metric], d.overallAvg || 0)))
    : 0;
  const yAxisMax = Math.ceil(maxDataValue / 1000) * 1000;
  const yAxisTicks = Array.from(
    { length: yAxisMax / 1000 + 1 },
    (_, i) => i * 1000
  );

  const metricLabel =
    METRIC_OPTIONS.find((m) => m.value === metric)?.label || metric;

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
        No trend data available for this selection.
      </div>
    );
  }

  const tooltipFormatter = (value: any, name: string, props: any) => {
    if (typeof value !== "number") return null;
    const { payload } = props;
    if (name === "Store Avg") {
      return [value.toFixed(2), `${payload.store} Avg`];
    }
    if (employee !== "all" && trendView === "store" && payload.store) {
      return [value.toFixed(2), payload.store];
    }
    return [value.toFixed(2), name];
  };

  const xAxisDataKey =
    employee !== "all" && trendView === "store" ? "chartKey" : "date";

  const renderAnnotationDot = (point: any, label: string, color: string) => {
    if (!point) return null;
    return (
      <ReferenceDot
        x={point[xAxisDataKey]}
        y={point[metric]}
        r={5}
        fill={color}
        stroke={isDarkMode ? "#1e293b" : "white"}
        strokeWidth={2}
        ifOverflow="extendDomain"
      >
        <Label
          value={label}
          position="top"
          offset={10}
          fill={color}
          fontSize={12}
          fontWeight="bold"
        />
      </ReferenceDot>
    );
  };

  const tickColor = isDarkMode ? "#94a3b8" : "#64748b";
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";

  const getLineName = () => {
    if (employee === "all") return `Overall Avg. ${metricLabel}`;
    if (trendView === "monthly") return `${metricLabel} (Monthly Avg)`;
    return `${metricLabel} (by Store)`;
  };

  return (
    <div className="h-full flex flex-col">
      {employee !== "all" && (
        <div className="flex justify-end mb-4 flex-shrink-0 space-x-4">
          <ToggleSwitch
            id="show-overall-avg"
            checked={showOverallAvg}
            onChange={(ch) => setShowOverallAvg(ch)}
            labelLeft="Show Overall Avg"
            labelRight=""
          />
          <ToggleSwitch
            id="trend-view-toggle"
            checked={trendView === "store"}
            onChange={(ch) => setTrendView(ch ? "store" : "monthly")}
            labelLeft="Monthly Avg"
            labelRight="By Store"
          />
        </div>
      )}
      <div className="flex-grow min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 20, left: -10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey={xAxisDataKey}
                tick={{ fontSize: 12, fill: tickColor }}
                tickFormatter={(value) =>
                  employee !== "all" && trendView === "store"
                    ? String(value).split("-").slice(0, 3).join("-")
                    : value
                }
              />
            <YAxis
              tick={{ fontSize: 12, fill: tickColor }}
              domain={[0, yAxisMax]}
              ticks={yAxisTicks}
            />
            <Tooltip
              formatter={tooltipFormatter}
              labelFormatter={(label, payload) => {
                if (
                  payload &&
                  payload.length > 0 &&
                  employee !== "all" &&
                  trendView === "store"
                ) {
                  const record = payload[0].payload;
                  return `Date: ${record.date}`;
                }
                return label;
              }}
              cursor={{
                fill: isDarkMode
                  ? "rgba(185, 28, 28, 0.1)"
                  : "rgba(185, 28, 28, 0.1)",
              }}
              contentStyle={{
                backgroundColor: isDarkMode ? "#1e293b" : "white",
                border: `1px solid ${gridColor}`,
                borderRadius: "0.5rem",
                color: isDarkMode ? "#e2e8f0" : "#1e293b",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "14px", color: tickColor }} />

            {/* main metric line */}
            <Line
              type="monotone"
              dataKey={metric}
              name={getLineName()}
              stroke="#b91c1c"
              strokeWidth={2}
              dot={{ r: 4, fill: "#b91c1c" }}
              activeDot={{ r: 8 }}
            />

            {/* dashed overall‑avg line */}
            {employee !== "all" &&
              (trendView === "monthly" || trendView === "store") &&
              showOverallAvg && (
                <Line
                  type="monotone"
                  dataKey="overallAvg"
                  name={trendView === "store" ? "Store Avg" : "Overall Avg"}
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#2563eb" }}
                  activeDot={{ r: 7 }}
                  strokeDasharray={trendView === "store" ? undefined : "5 5"}
                />
              )}

            {renderAnnotationDot(peak, "Peak", "#22c55e")}
            {renderAnnotationDot(lowest, "Lowest", "#ef4444")}
            {spikes.map((p, i) => (
              <React.Fragment key={`spike-${i}`}>
                {renderAnnotationDot(p, "Spike", "#f59e0b")}
              </React.Fragment>
            ))}
            {dips.map((p, i) => (
              <React.Fragment key={`dip-${i}`}>
                {renderAnnotationDot(p, "Dip", "#3b82f6")}
              </React.Fragment>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceTrendChart;
