import { useState, useEffect, useMemo } from "react";
import { EmployeeRecord, UniqueValues } from "../types";

export interface FilterState {
  office: string;
  account: string;
  employee: string;
  store: string;
  supervisor: string;
  timeframe:
    | "all"
    | "last7"
    | "last30"
    | "last180"
    | "last365"
    | "custom"
    | "specific";
  startDate: string;
  endDate: string;
  specificDate: string;
  topN: number;
  showTop: boolean;
}

interface RawEmployeeRecord {
  Employee: number;
  FirstName: string;
  LastName: string;
  OfficeName: string;
  AccountName: string;
  StoreName: string;
  DateOfInv: string;
  PiecesPerHr: number;
  DollarPerHr: number;
  SkusPerHr: number;
  AVG_DELTA: number;
  GAP5_COUNT: number;
  GAP10_COUNT: number;
  GAP15_COUNT: number;
  SupervisorNumber: number;
}

export const usePerformanceData = () => {
  const [data, setData] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("data/EmployeeProductionExport.json");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const rawJsonData: { [key: string]: RawEmployeeRecord[] } =
          await response.json();

        const rawDataArray = Object.values(rawJsonData).flat();

        if (!Array.isArray(rawDataArray)) {
          throw new Error(
            "Loaded data is not in the expected format (array not found)."
          );
        }

        // Create a map of employee ID to employee name to resolve supervisor names.
        const employeeIdToNameMap = new Map<number, string>();
        rawDataArray.forEach((record) => {
          const name = `${record.FirstName.trim()} ${record.LastName.trim()}`;
          if (!employeeIdToNameMap.has(record.Employee)) {
            employeeIdToNameMap.set(record.Employee, name);
          }
        });

        const transformedData: EmployeeRecord[] = rawDataArray.map((record) => {
          const supervisorId = record.SupervisorNumber;
          const supervisorName =
            employeeIdToNameMap.get(supervisorId) || String(supervisorId);

          return {
            employee: `${record.FirstName.trim()} ${record.LastName.trim()}`,
            office: record.OfficeName,
            account: record.AccountName,
            store: record.StoreName,
            supervisor: supervisorName,
            date: record.DateOfInv.split(" ")[0], // Keep only YYYY-MM-DD
            pieces: record.PiecesPerHr,
            dollars: record.DollarPerHr,
            skus: record.SkusPerHr,
            avg_delta: record.AVG_DELTA,
            gap5_count: record.GAP5_COUNT,
            gap10_count: record.GAP10_COUNT,
            gap15_count: record.GAP15_COUNT,
          };
        });

        // Sort data by date ascending by default
        const sortedData = transformedData.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setData(sortedData);
      } catch (e: any) {
        setError(e.message || "Failed to load performance data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const uniqueValues = useMemo((): UniqueValues => {
    if (!data.length) {
      return {
        employees: [],
        accounts: [],
        offices: [],
        stores: [],
        supervisors: [],
      };
    }
    const employees = new Set<string>();
    const accounts = new Set<string>();
    const offices = new Set<string>();
    const stores = new Set<string>();
    const supervisors = new Set<string>();

    data.forEach((record) => {
      employees.add(record.employee);
      accounts.add(record.account);
      offices.add(record.office);
      stores.add(record.store);
      supervisors.add(record.supervisor);
    });

    return {
      employees: Array.from(employees).sort(),
      accounts: Array.from(accounts).sort(),
      offices: Array.from(offices).sort(),
      stores: Array.from(stores).sort(),
      supervisors: Array.from(supervisors).sort(),
    };
  }, [data]);

  return { data, loading, error, uniqueValues };
};
