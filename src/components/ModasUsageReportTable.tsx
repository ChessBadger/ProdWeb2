import React, { useMemo, useState } from "react";
import { EmployeeRecord } from "../types";
import { SortAscIcon, SortDescIcon } from "./icons/Icons";

type SortKey =
  | "employee"
  | "modasInventoryCount"
  | "modasRecordCount"
  | "accountCount"
  | "lastUsed";

type ModasUsageSummary = {
  employee: string;
  modasInventoryCount: number;
  modasRecordCount: number;
  accountCount: number;
  accounts: string;
  firstUsed: string;
  lastUsed: string;
};

interface ModasUsageReportTableProps {
  data: EmployeeRecord[];
}

const isModasRecord = (record: EmployeeRecord) => Number(record.avg_delta) > 0;

const escapeCsvValue = (value: string | number) => {
  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const ModasUsageReportTable: React.FC<ModasUsageReportTableProps> = ({
  data,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>("modasInventoryCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const modasSummaries = useMemo((): ModasUsageSummary[] => {
    const employeeGroups = new Map<string, EmployeeRecord[]>();

    data.forEach((record) => {
      if (!employeeGroups.has(record.employee)) {
        employeeGroups.set(record.employee, []);
      }
      if (isModasRecord(record)) {
        employeeGroups.get(record.employee)!.push(record);
      }
    });

    return Array.from(employeeGroups.entries()).map(([employee, records]) => {
      const sortedDates = records
        .map((record) => record.date)
        .sort((a, b) => a.localeCompare(b));
      const accounts = Array.from(
        new Set(records.map((record) => record.account))
      ).sort((a, b) => a.localeCompare(b));

      return {
        employee,
        modasInventoryCount: new Set(records.map((record) => record.store))
          .size,
        modasRecordCount: records.length,
        accountCount: accounts.length,
        accounts: accounts.join(", "),
        firstUsed: sortedDates[0] ?? "",
        lastUsed: sortedDates.at(-1) ?? "",
      };
    });
  }, [data]);

  const sortedData = useMemo(() => {
    return [...modasSummaries].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return sortOrder === "asc"
        ? Number(valA) - Number(valB)
        : Number(valB) - Number(valA);
    });
  }, [modasSummaries, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder(key === "employee" ? "asc" : "desc");
    }
  };

  const handleExport = () => {
    const headers = [
      "Employee",
      "Modas Uses",
      "Records",
      "Accounts",
      "First Used",
      "Last Used",
      "Account List",
    ];
    const rows = sortedData.map((row) => [
      row.employee,
      row.modasInventoryCount,
      row.modasRecordCount,
      row.accountCount,
      row.firstUsed,
      row.lastUsed,
      row.accounts,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `modas-usage-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
        No Modas usage to display for the selected timeframe.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={handleExport}
          className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-white hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
        >
          Export to Excel
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {renderHeader("employee", "Employee")}
              {renderHeader(
                "modasInventoryCount",
                "Modas Uses",
                "text-center"
              )}
              {renderHeader("modasRecordCount", "Records", "text-center")}
              {renderHeader("accountCount", "Accounts", "text-center")}
              {renderHeader("lastUsed", "Last Used")}
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Account List
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {sortedData.map((row) => (
              <tr
                key={row.employee}
                className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">
                  {row.employee}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {row.modasInventoryCount}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-slate-500 dark:text-slate-400">
                  {row.modasRecordCount}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-slate-500 dark:text-slate-400">
                  {row.accountCount}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                  {row.lastUsed}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 min-w-72">
                  {row.accounts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModasUsageReportTable;
