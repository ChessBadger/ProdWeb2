import React, { useMemo, useState } from "react";
import { METRIC_OPTIONS } from "../constants";
import { EmployeeRecord, Metric } from "../types";
import { SortAscIcon, SortDescIcon } from "./icons/Icons";

type SortKey = "account" | "inventoryCount" | "recordCount" | Metric;

type AccountDateSummary = {
  account: string;
  inventoryCount: number;
  recordCount: number;
  averages: { [K in Metric]: number };
};

interface AccountDateInstancesTableProps {
  data: EmployeeRecord[];
}

const AccountDateInstancesTable: React.FC<AccountDateInstancesTableProps> = ({
  data,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>("inventoryCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const accountSummaries = useMemo((): AccountDateSummary[] => {
    const accountGroups = new Map<string, EmployeeRecord[]>();

    data.forEach((record) => {
      if (!accountGroups.has(record.account)) {
        accountGroups.set(record.account, []);
      }
      accountGroups.get(record.account)!.push(record);
    });

    return Array.from(accountGroups.entries()).map(([account, records]) => {
      const averages = {} as { [K in Metric]: number };
      const recordCount = records.length;

      METRIC_OPTIONS.forEach(({ value }) => {
        averages[value] =
          records.reduce((sum, record) => sum + record[value], 0) /
          recordCount;
      });

      return {
        account,
        inventoryCount: new Set(records.map((record) => record.store)).size,
        recordCount,
        averages,
      };
    });
  }, [data]);

  const sortedData = useMemo(() => {
    return [...accountSummaries].sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      if (sortKey === "account") {
        valA = a.account;
        valB = b.account;
      } else if (sortKey === "inventoryCount" || sortKey === "recordCount") {
        valA = a[sortKey];
        valB = b[sortKey];
      } else {
        valA = a.averages[sortKey];
        valB = b.averages[sortKey];
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return sortOrder === "asc"
        ? Number(valA) - Number(valB)
        : Number(valB) - Number(valA);
    });
  }, [accountSummaries, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder(key === "account" ? "asc" : "desc");
    }
  };

  const renderHeader = (key: SortKey, label: string, className = "") => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 ${className}`}
      onClick={() => handleSort(key)}
    >
      <div
        className={`flex items-center gap-1 ${
          className.includes("text-center") ? "justify-center" : ""
        }`}
      >
        {label}
        {sortKey === key &&
          (sortOrder === "asc" ? <SortAscIcon /> : <SortDescIcon />)}
      </div>
    </th>
  );

  if (!sortedData.length) {
    return (
      <div className="text-center py-10 text-slate-500 dark:text-slate-400">
        No data to display for the selected timeframe.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-700/50">
          <tr>
            {renderHeader("account", "Account")}
            {renderHeader("inventoryCount", "# of Inventories", "text-center")}
            {renderHeader("recordCount", "Records", "text-center")}
            {METRIC_OPTIONS.map((metric) =>
              renderHeader(metric.value, `Avg ${metric.label}`, "text-center")
            )}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
          {sortedData.map((row) => (
            <tr
              key={row.account}
              className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                {row.account}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                {row.inventoryCount}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-slate-500 dark:text-slate-400">
                {row.recordCount}
              </td>
              {METRIC_OPTIONS.map((metric) => (
                <td
                  key={metric.value}
                  className="px-4 py-3 whitespace-nowrap text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {row.averages[metric.value].toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AccountDateInstancesTable;
