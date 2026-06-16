import { useState, useEffect, useMemo } from "react";
import { EmployeeRecord, UniqueValues } from "../types";
import { normalizeTypeOfInv } from "../constants";

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
    | "last90"
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
  TypeOfInv: string;
  StoreName: string;
  DateOfInv: string;
  Count_Record: number | null;
  Total_Ext_Qty: number | null;
  Total_Ext_Price: number | null;
  PiecesPerHr: number | null;
  DollarPerHr: number | null;
  SkusPerHr: number | null;
  AVG_DELTA: number | null;
  GAP5_COUNT: number | null;
  GAP10_COUNT: number | null;
  GAP15_COUNT: number | null;
  SupervisorNumber: number;
  Rx?: boolean;
}

const toNumber = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toBoolean = (value: unknown): boolean =>
  value === true ||
  value === 1 ||
  (typeof value === "string" &&
    ["true", "yes", "y", "1"].includes(value.trim().toLowerCase()));

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
            "Loaded data is not in the expected format (array not found).",
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
            typeOfInv: normalizeTypeOfInv(record.TypeOfInv),
            store: record.StoreName,
            supervisor: supervisorName,
            rx: toBoolean(record.Rx),
            date: record.DateOfInv.split(" ")[0], // Keep only YYYY-MM-DD
            totalPieces: toNumber(record.Total_Ext_Qty),
            totalDollars: toNumber(record.Total_Ext_Price),
            totalSkus: toNumber(record.Count_Record),
            pieces: toNumber(record.PiecesPerHr),
            dollars: toNumber(record.DollarPerHr),
            skus: toNumber(record.SkusPerHr),
            avg_delta: toNumber(record.AVG_DELTA),
            gap5_count: toNumber(record.GAP5_COUNT),
            gap10_count: toNumber(record.GAP10_COUNT),
            gap15_count: toNumber(record.GAP15_COUNT),
          };
        });

        // Sort data by date ascending by default
        const sortedData = transformedData.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
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
