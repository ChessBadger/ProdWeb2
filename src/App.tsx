import React, { useState, useMemo, useCallback, useEffect } from "react";
import { auth, googleProvider } from "./firebase";
import type { User } from "firebase/auth";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { usePerformanceData, FilterState } from "./hooks/usePerformanceData";
import DashboardFilters from "./components/DashboardFilters";
import PerformanceBarChart from "./components/PerformanceBarChart";
import PerformanceTrendChart from "./components/PerformanceTrendChart";
import DayOfWeekChart from "./components/DayOfWeekChart";
import AveragesTable, {
  PerformanceByGroupTable,
} from "./components/AveragesTable";
import RawDataTable from "./components/RawDataTable";
import AnomalyDetection from "./components/AnomalyDetection";
import KPI from "./components/KPI";
import Tabs from "./components/Tabs";
import ToggleSwitch from "./components/ToggleSwitch";
import { Metric } from "./types";
import { METRIC_OPTIONS, getLinkedAccounts } from "./constants";
import {
  ChartBarIcon,
  ChartPieIcon,
  CalendarDaysIcon,
  TrendingUpIcon,
  UsersIcon,
  CheckBadgeIcon,
  XCircleIcon,
  SunIcon,
  MoonIcon,
  ExclamationTriangleIcon,
} from "./components/icons/Icons";

const allowedUsers = [
  "jswanson@badgerinventory.com",
  "hkraemer@badgerinventory.com",
  "jfalck@badgerinventory.com",
  "spalmer@badgerinventory.com",
  "nbrock@badgerinventory.com",
  "lclark@badgerinventory.com",
  "kgrohall@badgerinventory.com",
];

const GoogleIcon = () => (
  <svg
    className="w-6 h-6"
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>Google</title>
    <path
      d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.6 2.04-4.82 2.04-5.84 0-10.62-4.78-10.62-10.62s4.78-10.62 10.62-10.62c3.32 0 5.62 1.36 6.96 2.62l2.5-2.5C20.45 1.45 17.1.22 12.48.22 5.6.22 0 5.82 0 12.7s5.6 12.48 12.48 12.48c6.68 0 11.42-4.57 11.42-11.42 0-.8-.08-1.6-.2-2.36H12.48z"
      fill="currentColor"
    />
  </svg>
);

const LoginScreen = ({ authError }: { authError: string | null }) => {
  const signInWithGoogle = () => {
    signInWithPopup(auth, googleProvider).catch((err) => {
      console.error("Google sign-in error:", err.message);
    });
  };

  return (
    <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 font-sans">
      <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl text-center">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary tracking-wider">
            BADGER
          </h1>
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            INVENTORY SERVICE, INC.
          </p>
        </div>
        <div className="pt-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Performance Dashboard
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Please sign in to continue
          </p>
        </div>
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors text-lg"
        >
          <GoogleIcon />
          Sign In with Google
        </button>
        {authError && (
          <p className="mt-4 text-center text-red-500 text-sm">{authError}</p>
        )}
      </div>
    </div>
  );
};

const initialFilterState: FilterState = {
  office: "all",
  account: "all",
  employee: "all",
  store: "all",
  supervisor: "all",
  timeframe: "last180",
  startDate: "",
  endDate: "",
  specificDate: "",
  topN: 10,
  showTop: true,
};

const Logo = () => (
  <div className="text-center mb-8">
    <h1 className="text-4xl font-bold text-primary tracking-wider">BADGER</h1>
    <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
      INVENTORY SERVICE, INC.
    </p>
    <hr className="my-3 border-slate-200 dark:border-slate-700" />
    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
      "Where Quality Counts"
    </p>
  </div>
);

const Dashboard: React.FC = () => {
  const { data, loading, error, uniqueValues } = usePerformanceData();

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined" && localStorage.getItem("theme")) {
      return localStorage.getItem("theme") === "dark";
    }
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [selectedMetric, setSelectedMetric] = useState<Metric>("pieces");
  const [groupBy, setGroupBy] = useState<"store" | "supervisor">("store");
  const [activeChart, setActiveChart] = useState<
    "comparison" | "trend" | "dayOfWeek" | "anomaly"
  >("comparison");

  const handleFilterChange = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleClearFilters = useCallback(() => {
    setFilters(initialFilterState);
    setSelectedMetric("pieces");
  }, []);

  const filteredData = useMemo(() => {
    if (!data) return [];
    let result = data;
    const now = new Date();

    if (filters.office !== "all")
      result = result.filter((d) => d.office === filters.office);

    if (filters.account !== "all") {
      const linkedAccounts = getLinkedAccounts(filters.account);
      result = result.filter((d) =>
        linkedAccounts.includes(d.account.toLowerCase())
      );
    }

    if (filters.employee !== "all")
      result = result.filter((d) => d.employee === filters.employee);
    if (filters.store !== "all")
      result = result.filter((d) => d.store === filters.store);
    if (filters.supervisor !== "all")
      result = result.filter((d) => d.supervisor === filters.supervisor);

    switch (filters.timeframe) {
      case "custom":
        if (filters.startDate && filters.endDate) {
          const start = new Date(filters.startDate);
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          result = result.filter((d) => {
            const recordDate = new Date(d.date.replace(/-/g, "/"));
            return recordDate >= start && recordDate <= end;
          });
        }
        break;
      case "specific":
        if (filters.specificDate) {
          result = result.filter((d) => d.date === filters.specificDate);
        }
        break;
      case "last7":
      case "last30":
      case "last180":
      case "last365":
        const days = parseInt(filters.timeframe.replace("last", ""));
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - days);
        result = result.filter(
          (d) => new Date(d.date.replace(/-/g, "/")) >= cutoffDate
        );
        break;
    }
    return result;
  }, [data, filters]);

  const kpiValues = useMemo(() => {
    if (!filteredData.length) {
      return {
        avgMetric: 0,
        uniqueEmployees: 0,
        bestPerformer: { name: "N/A", value: 0 },
      };
    }
    const metricValues = filteredData.map((d) => d[selectedMetric]);
    const avgMetric =
      metricValues.reduce((a, b) => a + b, 0) / metricValues.length;

    const employeeTotals = new Map<string, number>();
    const employeeCounts = new Map<string, number>();

    filteredData.forEach((d) => {
      employeeTotals.set(
        d.employee,
        (employeeTotals.get(d.employee) || 0) + d[selectedMetric]
      );
      employeeCounts.set(d.employee, (employeeCounts.get(d.employee) || 0) + 1);
    });

    let bestPerformer = { name: "N/A", value: 0 };
    let maxAvg = -Infinity;

    employeeTotals.forEach((total, employee) => {
      const avg = total / employeeCounts.get(employee)!;
      if (avg > maxAvg) {
        maxAvg = avg;
        bestPerformer = { name: employee, value: avg };
      }
    });

    return {
      avgMetric,
      uniqueEmployees: new Set(filteredData.map((d) => d.employee)).size,
      bestPerformer,
    };
  }, [filteredData, selectedMetric]);

  const metricLabel =
    METRIC_OPTIONS.find((m) => m.value === selectedMetric)?.label || "Metric";

  const renderActiveChart = () => {
    switch (activeChart) {
      case "comparison":
        return (
          <PerformanceBarChart
            data={filteredData}
            metric={selectedMetric}
            topN={filters.topN}
            showTop={filters.showTop}
            isDarkMode={isDarkMode}
          />
        );
      case "trend":
        return (
          <PerformanceTrendChart
            data={filteredData}
            metric={selectedMetric}
            employee={filters.employee}
            isDarkMode={isDarkMode}
          />
        );
      case "dayOfWeek":
        return (
          <DayOfWeekChart
            data={filteredData}
            metric={selectedMetric}
            isDarkMode={isDarkMode}
          />
        );
      case "anomaly":
        return (
          <AnomalyDetection
            data={filteredData}
            metric={selectedMetric}
            account={filters.account}
            isDarkMode={isDarkMode}
          />
        );
      default:
        return null;
    }
  };

  const ChartButton = ({
    chartType,
    label,
    icon: Icon,
  }: {
    chartType: typeof activeChart;
    label: string;
    icon: React.FC<{ className?: string }>;
  }) => (
    <button
      onClick={() => setActiveChart(chartType)}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
        activeChart === chartType
          ? "bg-primary text-white"
          : "hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
      }`}
    >
      <Icon className="h-5 w-5" /> {label}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-2xl font-semibold">
        Loading Dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500 bg-red-50 dark:bg-red-900/10 p-4">
        <div className="text-center">
          <XCircleIcon className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-2xl font-semibold text-slate-800 dark:text-slate-100">
            Dashboard Error
          </h2>
          <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen font-sans">
      <aside className="w-80 flex-shrink-0 bg-white dark:bg-slate-800 shadow-lg p-6 flex flex-col">
        <Logo />
        <div className="flex-grow overflow-y-auto scrollbar-thin pr-2">
          <DashboardFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            uniqueValues={uniqueValues}
            metric={selectedMetric}
            onMetricChange={setSelectedMetric}
            onClearFilters={handleClearFilters}
          />
        </div>
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-sm font-semibold rounded-lg shadow-sm hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            {isDarkMode ? <SunIcon /> : <MoonIcon />}
            <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
          </button>
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-2 bg-slate-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <header className="mb-6">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            Employee Production Dashboard
          </h2>
          {/* <p className="text-slate-500 dark:text-slate-400 mt-1">
            Analyze employee performance across various metrics.
          </p> */}
        </header>

        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            filters.employee === "all" ? "lg:grid-cols-3" : "lg:grid-cols-2"
          } gap-6 mb-6`}
        >
          <KPI
            title={`Avg. ${metricLabel}`}
            value={kpiValues.avgMetric.toFixed(2)}
            icon={<TrendingUpIcon className="h-6 w-6 text-primary" />}
          />
          {filters.employee === "all" && (
            <KPI
              title="Filtered Employees"
              value={kpiValues.uniqueEmployees.toLocaleString()}
              icon={<UsersIcon className="h-6 w-6 text-primary" />}
            />
          )}
          <KPI
            title={`Top Performer (${metricLabel})`}
            value={kpiValues.bestPerformer.name}
            subtitle={`Avg: ${kpiValues.bestPerformer.value.toFixed(2)}`}
            icon={<CheckBadgeIcon className="h-6 w-6 text-primary" />}
          />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Performance Analysis
            </h3>
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
              <ChartButton
                chartType="comparison"
                label="Comparison"
                icon={ChartBarIcon}
              />
              <ChartButton
                chartType="trend"
                label="Trend"
                icon={ChartPieIcon}
              />
              <ChartButton
                chartType="dayOfWeek"
                label="Day of Week"
                icon={CalendarDaysIcon}
              />
              <ChartButton
                chartType="anomaly"
                label="Anomalies"
                icon={ExclamationTriangleIcon}
              />
            </div>
          </div>
          <div className="h-[350px]">{renderActiveChart()}</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
          <Tabs
            tabs={[
              {
                label: "Averages by Employee",
                content: (
                  <AveragesTable data={filteredData} metric={selectedMetric} />
                ),
              },
              {
                label: "Store & Supervisor",
                content: (
                  <>
                    <div className="flex justify-end p-4">
                      <ToggleSwitch
                        id="group-by-toggle"
                        checked={groupBy === "supervisor"}
                        onChange={(checked) =>
                          setGroupBy(checked ? "supervisor" : "store")
                        }
                        labelLeft="Group by Store"
                        labelRight="Group by Supervisor"
                      />
                    </div>
                    <PerformanceByGroupTable
                      data={filteredData}
                      groupBy={groupBy}
                    />
                  </>
                ),
              },
              {
                label: "All Stores",
                content: <RawDataTable data={filteredData} />,
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
};
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setAuthError(null);
      if (
        firebaseUser?.email &&
        allowedUsers.includes(firebaseUser.email.toLowerCase())
      ) {
        setUser(firebaseUser);
      } else {
        if (firebaseUser) {
          setAuthError("Unauthorized access. Please contact an administrator.");
          auth.signOut();
        }
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-2xl font-semibold bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        Authenticating...
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginScreen authError={authError} />;
};

export default App;
