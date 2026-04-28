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
import AccountDateInstancesTable from "./components/AccountDateInstancesTable";
import AnomalyDetection from "./components/AnomalyDetection";
import KPI from "./components/KPI";
import Tabs from "./components/Tabs";
import ProductionComparisonPage from "./components/ProductionComparisonPage";
import TypeOfInvComparisonPage from "./components/TypeOfInvComparisonPage";
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
  "files@badgerinventory.com",
  "qianabatton@gmail.com",
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
          {authError && (
            <p className="mt-2 text-red-500 font-medium">{authError}</p>
          )}
        </div>
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors text-lg"
        >
          <GoogleIcon />
          Sign In with Google
        </button>
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
  timeframe: "last90",
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
  const [groupBy, setGroupBy] = useState<"store" | "supervisor" | "account">(
    "store"
  );

  const [activeChart, setActiveChart] = useState<
    "comparison" | "trend" | "dayOfWeek" | "anomaly"
  >("comparison");
  const [activePage, setActivePage] = useState<
    "dashboard" | "compare" | "typeOfInv"
  >("dashboard");

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
      case "last90":
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

  const dataForAnomalyOverall = useMemo(() => {
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

    // Intentionally skip employee filter

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
      case "last90":
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
  }, [
    data,
    filters.office,
    filters.account,
    filters.store,
    filters.supervisor,
    filters.timeframe,
    filters.startDate,
    filters.endDate,
    filters.specificDate,
  ]);

  const productionData = useMemo(
    () => filteredData.filter((record) => !record.rx),
    [filteredData]
  );

  const productionOverallData = useMemo(
    () => dataForAnomalyOverall.filter((record) => !record.rx),
    [dataForAnomalyOverall]
  );

  const productionBaseData = useMemo(
    () => data.filter((record) => !record.rx),
    [data]
  );

  const kpiValues = useMemo(() => {
    if (!productionData.length) {
      return {
        avgMetric: 0,
        uniqueEmployees: 0,
        bestPerformer: { name: "N/A", value: 0 },
      };
    }
    const metricValues = productionData.map((d) => d[selectedMetric]);
    const avgMetric =
      metricValues.reduce((a, b) => a + b, 0) / metricValues.length;

    const employeeTotals = new Map<string, number>();
    const employeeCounts = new Map<string, number>();

    productionData.forEach((d) => {
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
  }, [filteredData, productionData, selectedMetric]);

  const metricLabel =
    METRIC_OPTIONS.find((m) => m.value === selectedMetric)?.label || "Metric";
  const isSingleStoreView = filters.store !== "all";

  const renderActiveChart = () => {
    switch (activeChart) {
      case "comparison":
        return (
          <PerformanceBarChart
            data={productionData}
            metric={selectedMetric}
            topN={filters.topN}
            showTop={filters.showTop}
            isDarkMode={isDarkMode}
          />
        );
      case "trend":
        return (
          <PerformanceTrendChart
            data={productionData}
            overallData={productionOverallData}
            metric={selectedMetric}
            employee={filters.employee}
            isDarkMode={isDarkMode}
          />
        );
      case "dayOfWeek":
        return (
          <DayOfWeekChart
            data={productionData}
            metric={selectedMetric}
            isDarkMode={isDarkMode}
          />
        );
      case "anomaly":
        return (
          <AnomalyDetection
            data={productionData}
            overallData={productionOverallData}
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
    <div className="flex min-h-screen font-sans">
      <aside className="w-80 flex-shrink-0 bg-white dark:bg-slate-800 shadow-lg p-6 flex flex-col">
        <Logo />
        {activePage === "dashboard" ? (
          <div className="flex-grow pr-2">
            <DashboardFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              uniqueValues={uniqueValues}
              metric={selectedMetric}
              onMetricChange={setSelectedMetric}
              onClearFilters={handleClearFilters}
            />
          </div>
        ) : activePage === "compare" ? (
          <div className="flex-grow pr-2">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                Compare Production Page
              </p>
              <p>
                This view uses its own filters so you can compare accounts or
                stores by employee or supervisor group.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-grow pr-2">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                Modas vs Non-Modas Page
              </p>
              <p>
                Pick one account and compare Modas vs Non-Modas production by
                store, employee, group, or underlying account.
              </p>
            </div>
          </div>
        )}
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

      <main className="flex-1 p-6 lg:p-8">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                {activePage === "dashboard"
                  ? "Employee Production Dashboard"
                  : activePage === "compare"
                    ? "Production Comparison"
                    : "Modas vs Non-Modas"}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                {activePage === "dashboard"
                  ? "Analyze employee performance across production metrics."
                  : activePage === "compare"
                    ? "Compare production between selected accounts or stores by employee or group."
                    : "Compare Modas vs Non-Modas performance inside one account across stores, employees, groups, and accounts."}
              </p>
            </div>
            <div
              role="group"
              aria-label="Page selector"
              className="inline-flex rounded-md shadow-sm"
            >
              <button
                type="button"
                onClick={() => setActivePage("dashboard")}
                className={`px-4 py-2 text-sm font-medium border rounded-l-md ${
                  activePage === "dashboard"
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setActivePage("compare")}
                className={`px-4 py-2 text-sm font-medium border ${
                  activePage === "compare"
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                }`}
              >
                Compare Production
              </button>
              <button
                type="button"
                onClick={() => setActivePage("typeOfInv")}
                className={`px-4 py-2 text-sm font-medium border rounded-r-md ${
                  activePage === "typeOfInv"
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                }`}
              >
                Modas vs Non-Modas
              </button>
            </div>
          </div>
        </header>

        {activePage === "dashboard" ? (
          <>
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
              <div className="h-[450px]">{renderActiveChart()}</div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
              <Tabs
                tabs={[
                  {
                    label: "Averages by Employee",
                    content: (
                      <AveragesTable
                        data={isSingleStoreView ? filteredData : productionData}
                        overallData={productionData}
                        attendanceData={filteredData}
                        metric={selectedMetric}
                        showRxBadges={isSingleStoreView}
                      />
                    ),
                  },
                  {
                    label: "Performance by Group",
                    content: (
                      <>
                        <div className="flex justify-end p-4">
                          <div
                            role="group"
                            aria-label="Group by"
                            className="inline-flex rounded-md shadow-sm"
                          >
                            {(["store", "supervisor", "account"] as const).map(
                              (option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => setGroupBy(option)}
                                  className={`
            px-4 py-2 text-sm font-medium border
            ${
              groupBy === option
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
            }
            ${option === "store" ? "rounded-l-md" : ""}
            ${option === "account" ? "rounded-r-md" : ""}
          `}
                                >
                                  {option.charAt(0).toUpperCase() +
                                    option.slice(1)}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                        <PerformanceByGroupTable
                          data={productionData}
                          groupBy={groupBy}
                        />
                      </>
                    ),
                  },
                  {
                    label: "All Stores",
                    content: (
                      <RawDataTable
                        data={filteredData}
                        showRxBadges={isSingleStoreView}
                      />
                    ),
                  },
                  {
                    label: "Account Frequency",
                    content: (
                      <AccountDateInstancesTable data={productionData} />
                    ),
                  },
                ]}
              />
            </div>
          </>
        ) : (
          activePage === "compare" ? (
            <ProductionComparisonPage data={productionBaseData} isDarkMode={isDarkMode} />
          ) : (
            <TypeOfInvComparisonPage data={productionBaseData} isDarkMode={isDarkMode} />
          )
        )}
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
      if (
        firebaseUser?.email &&
        allowedUsers.includes(firebaseUser.email.toLowerCase())
      ) {
        setUser(firebaseUser);
        setAuthError(null); // clear only on success
      } else if (firebaseUser) {
        setAuthError("Unauthorized access. Please contact an administrator.");
        signOut(auth).catch(() => {}); // <-- correct API
        setUser(null);
      } else {
        setUser(null); // keep existing authError after signOut
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
