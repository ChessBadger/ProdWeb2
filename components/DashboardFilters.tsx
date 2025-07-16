import React from 'react';
import { UniqueValues, Metric } from '../types';
import { FilterState } from '../hooks/usePerformanceData';
import { METRIC_OPTIONS } from '../constants';
import ToggleSwitch from './ToggleSwitch';

interface DashboardFiltersProps {
    filters: FilterState;
    onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
    uniqueValues: UniqueValues;
    metric: Metric;
    onMetricChange: (metric: Metric) => void;
    onClearFilters: () => void;
}

const FilterSection: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="border-t border-slate-200 dark:border-slate-700 mt-6 pt-6 first:mt-0 first:pt-0 first:border-none">
        <h4 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">{title}</h4>
        <div className="space-y-4">{children}</div>
    </div>
);

const FilterSelect: React.FC<{
    id: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
}> = ({ id, label, value, onChange, options }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <select
            id={id}
            value={value}
            onChange={onChange}
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
        >
            <option value="all">All</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);


const DashboardFilters: React.FC<DashboardFiltersProps> = ({ filters, onFilterChange, uniqueValues, metric, onMetricChange, onClearFilters }) => {

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow">
                <FilterSection title="Primary Metric">
                     <div>
                        <label htmlFor="metric-filter" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Metric</label>
                        <select
                            id="metric-filter"
                            value={metric}
                            onChange={(e) => onMetricChange(e.target.value as Metric)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
                        >
                            {METRIC_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                </FilterSection>
                
                <FilterSection title="Timeframe">
                    <div>
                        <label htmlFor="timeframe-filter" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Timeframe</label>
                        <select
                            id="timeframe-filter"
                            value={filters.timeframe}
                            onChange={(e) => onFilterChange('timeframe', e.target.value as FilterState['timeframe'])}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
                        >
                            <option value="all">All Time</option>
                            <option value="last7">Last 7 Days</option>
                            <option value="last30">Last 30 Days</option>
                            <option value="last180">Last 6 Months</option>
                            <option value="last365">Last 12 Months</option>
                            <option value="custom">Custom Range</option>
                            <option value="specific">Specific Date</option>
                        </select>
                    </div>

                    {filters.timeframe === 'custom' && (
                        <>
                            <div>
                                <label htmlFor="start-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                                <input type="date" id="start-date" value={filters.startDate} onChange={e => onFilterChange('startDate', e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition" />
                            </div>
                             <div>
                                <label htmlFor="end-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                                <input type="date" id="end-date" value={filters.endDate} onChange={e => onFilterChange('endDate', e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition" />
                            </div>
                        </>
                    )}
                    {filters.timeframe === 'specific' && (
                        <div>
                            <label htmlFor="specific-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                            <input type="date" id="specific-date" value={filters.specificDate} onChange={e => onFilterChange('specificDate', e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition" />
                        </div>
                    )}
                </FilterSection>

                <FilterSection title="Data Filters">
                    <FilterSelect id='employee-filter' label='Employee' value={filters.employee} onChange={(e) => onFilterChange('employee', e.target.value)} options={uniqueValues.employees} />
                    <FilterSelect id='account-filter' label='Account Name' value={filters.account} onChange={(e) => onFilterChange('account', e.target.value)} options={uniqueValues.accounts} />
                    <FilterSelect id='store-filter' label='Store' value={filters.store} onChange={(e) => onFilterChange('store', e.target.value)} options={uniqueValues.stores} />
                    <FilterSelect id='supervisor-filter' label='Supervisor' value={filters.supervisor} onChange={(e) => onFilterChange('supervisor', e.target.value)} options={uniqueValues.supervisors} />
                    <FilterSelect id='office-filter' label='Office' value={filters.office} onChange={(e) => onFilterChange('office', e.target.value)} options={uniqueValues.offices} />
                </FilterSection>

                <FilterSection title="Chart Options">
                     <div className="flex items-center gap-2">
                        <ToggleSwitch 
                            id="top-bottom-toggle"
                            checked={filters.showTop}
                            onChange={(checked) => onFilterChange('showTop', checked)}
                            labelLeft="Bottom"
                            labelRight="Top"
                        />
                     </div>
                     <div className="flex items-center gap-2">
                        <input
                            type="number"
                            id="top-n-input"
                            value={filters.topN}
                            onChange={e => onFilterChange('topN', parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
                        />
                        <label htmlFor="top-n-input" className="text-sm font-medium text-slate-700 dark:text-slate-300">Performers</label>
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