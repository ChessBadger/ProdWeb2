
export interface EmployeeRecord {
  employee: string;
  office: string;
  account: string;
  store: string;
  supervisor: string;
  date: string; // YYYY-MM-DD
  pieces: number;
  dollars: number;
  skus: number;
  avg_delta: number;
  gap5_count: number;
  gap10_count: number;
  gap15_count: number;
}

export type Metric = keyof Omit<EmployeeRecord, 'employee' | 'office' | 'account' | 'store' | 'date' | 'supervisor'>;

export interface UniqueValues {
    employees: string[];
    accounts: string[];
    offices: string[];
    stores: string[];
    supervisors: string[];
}