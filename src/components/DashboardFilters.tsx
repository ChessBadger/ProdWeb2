import React, { useEffect, useMemo, useState } from "react";
import { UniqueValues, Metric } from "../types";
import { FilterState } from "../hooks/usePerformanceData";
import { METRIC_OPTIONS } from "../constants";
import ToggleSwitch from "./ToggleSwitch";

interface DashboardFiltersProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => void;
  uniqueValues: UniqueValues;
  metric: Metric;
  onMetricChange: (metric: Metric) => void;
  onClearFilters: () => void;
}

const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="border-t border-slate-200 dark:border-slate-700 mt-6 pt-6 first:mt-0 first:pt-0 first:border-none">
    <h4 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
      {title}
    </h4>
    <div className="space-y-4">{children}</div>
  </div>
);

const FilterSearchInput: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}> = ({ id, label, value, onChange, options }) => {
  const [query, setQuery] = useState(value === "all" ? "" : value);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(value === "all" ? "" : value);
  }, [value]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      option.toLowerCase().includes(normalizedQuery)
    );
  }, [options, normalizedQuery]);

  const visibleOptions = filteredOptions.slice(0, 8);

  const commitValue = (nextValue: string) => {
    setQuery(nextValue);
    onChange(nextValue);
    setIsOpen(false);
  };

  const resetToAppliedValue = () => {
    setQuery(value === "all" ? "" : value);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const exactMatch = options.find(
        (option) => option.toLowerCase() === normalizedQuery
      );

      if (exactMatch) {
        commitValue(exactMatch);
        return;
      }

      if (filteredOptions.length === 1) {
        commitValue(filteredOptions[0]);
      }
    }

    if (event.key === "Escape") {
      resetToAppliedValue();
    }
  };

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setIsOpen(true);

            if (!nextQuery.trim()) {
              onChange("all");
            }
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              resetToAppliedValue();
            }, 120);
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Type to search ${label.toLowerCase()}`}
          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
          autoComplete="off"
        />
        {(query || value !== "all") && (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              setQuery("");
              onChange("all");
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label={`Clear ${label} filter`}
          >
            ×
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {value === "all" ? "Showing all values" : `Selected: ${value}`}
      </p>
      {isOpen && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {visibleOptions.length > 0 ? (
            <>
              <div className="max-h-56 overflow-y-auto py-1">
                {visibleOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      commitValue(option);
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                      value === option
                        ? "bg-primary/10 text-primary dark:bg-primary/20"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {normalizedQuery
                  ? `Showing ${visibleOptions.length} of ${filteredOptions.length} matches`
                  : `Showing ${visibleOptions.length} of ${options.length} values. Type to narrow.`}
              </div>
            </>
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              No matches found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  filters,
  onFilterChange,
  uniqueValues,
  metric,
  onMetricChange,
  onClearFilters,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow">
        <FilterSection title="Primary Metric">
          <div>
            <label
              htmlFor="metric-filter"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Metric
            </label>
            <select
              id="metric-filter"
              value={metric}
              onChange={(e) => onMetricChange(e.target.value as Metric)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </FilterSection>

        <FilterSection title="Timeframe">
          <div>
            <label
              htmlFor="timeframe-filter"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Timeframe
            </label>
            <select
              id="timeframe-filter"
              value={filters.timeframe}
              onChange={(e) =>
                onFilterChange(
                  "timeframe",
                  e.target.value as FilterState["timeframe"]
                )
              }
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
            >
              <option value="all">All Time</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="last90">Last 3 months</option>
              <option value="last180">Last 6 Months</option>
              <option value="last365">Last 12 Months</option>
              <option value="custom">Custom Range</option>
              <option value="specific">Specific Date</option>
            </select>
          </div>

          {filters.timeframe === "custom" && (
            <>
              <div>
                <label
                  htmlFor="start-date"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="start-date"
                  value={filters.startDate}
                  onChange={(e) => onFilterChange("startDate", e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
                />
              </div>
              <div>
                <label
                  htmlFor="end-date"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="end-date"
                  value={filters.endDate}
                  onChange={(e) => onFilterChange("endDate", e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
                />
              </div>
            </>
          )}
          {filters.timeframe === "specific" && (
            <div>
              <label
                htmlFor="specific-date"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Date
              </label>
              <input
                type="date"
                id="specific-date"
                value={filters.specificDate}
                onChange={(e) => onFilterChange("specificDate", e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
              />
            </div>
          )}
        </FilterSection>

        <FilterSection title="Data Filters">
          <FilterSearchInput
            id="employee-filter"
            label="Employee"
            value={filters.employee}
            onChange={(value) => onFilterChange("employee", value)}
            options={uniqueValues.employees}
          />
          <FilterSearchInput
            id="account-filter"
            label="Account Name"
            value={filters.account}
            onChange={(value) => onFilterChange("account", value)}
            options={uniqueValues.accounts}
          />
          <FilterSearchInput
            id="store-filter"
            label="Store"
            value={filters.store}
            onChange={(value) => onFilterChange("store", value)}
            options={uniqueValues.stores}
          />
          <FilterSearchInput
            id="supervisor-filter"
            label="Supervisor"
            value={filters.supervisor}
            onChange={(value) => onFilterChange("supervisor", value)}
            options={uniqueValues.supervisors}
          />
          <FilterSearchInput
            id="office-filter"
            label="Office"
            value={filters.office}
            onChange={(value) => onFilterChange("office", value)}
            options={uniqueValues.offices}
          />
        </FilterSection>

        <FilterSection title="Chart Options">
          <div className="flex items-center gap-2">
            <ToggleSwitch
              id="top-bottom-toggle"
              checked={filters.showTop}
              onChange={(checked) => onFilterChange("showTop", checked)}
              labelLeft="Bottom"
              labelRight="Top"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              id="top-n-input"
              value={filters.topN}
              onChange={(e) =>
                onFilterChange("topN", parseInt(e.target.value) || 1)
              }
              min="1"
              className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
            />
            <label
              htmlFor="top-n-input"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Performers
            </label>
          </div>
        </FilterSection>
      </div>
      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={onClearFilters}
          className="w-full px-4 py-2 bg-slate-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );
};

export default DashboardFilters;
