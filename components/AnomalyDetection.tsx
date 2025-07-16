import React, { useState, useMemo } from 'react';
import { EmployeeRecord, Metric } from '../types';
import { METRIC_OPTIONS } from '../constants';
import { SortAscIcon, SortDescIcon } from './icons/Icons';

// Anomaly type definition
interface Anomaly {
    employee: string;
    date: string;
    store: string;
    metricValue: number;
    employeeAverage: number;
    deviationPercent: number;
    type: 'Spike' | 'Dip';
}

// Sort key type
type SortKey = keyof Anomaly;


interface AnomalyDetectionProps {
    data: EmployeeRecord[];
    metric: Metric;
    account: string;
    isDarkMode: boolean;
}


const AnomalyDetection: React.FC<AnomalyDetectionProps> = ({ data, metric, account }) => {
    const [deviationThreshold, setDeviationThreshold] = useState<number>(30);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const anomalies = useMemo((): Anomaly[] => {
        if (account === 'all' || !data.length) return [];

        // Data is already filtered by account from App.tsx.
        
        // 1. Group data by employee to calculate their average for the selected metric.
        const employeeRecords = new Map<string, number[]>();
        data.forEach(record => {
            if (!employeeRecords.has(record.employee)) {
                employeeRecords.set(record.employee, []);
            }
            employeeRecords.get(record.employee)!.push(record[metric]);
        });

        const employeeStats = new Map<string, { mean: number }>();
        employeeRecords.forEach((values, employee) => {
            if (values.length > 0) {
                const sum = values.reduce((acc, v) => acc + v, 0);
                const mean = sum / values.length;
                employeeStats.set(employee, { mean });
            }
        });

        // 2. Find anomalies based on percentage deviation from the employee's mean.
        const foundAnomalies: Anomaly[] = [];
        data.forEach(record => {
            const stats = employeeStats.get(record.employee);
            // Skip if no stats or if mean is 0 to avoid division by zero errors.
            if (!stats || stats.mean === 0) return; 

            const { mean } = stats;
            const deviation = record[metric] - mean;
            const deviationPercent = (deviation / mean) * 100;

            if (Math.abs(deviationPercent) > deviationThreshold) {
                foundAnomalies.push({
                    date: record.date,
                    employee: record.employee,
                    store: record.store,
                    metricValue: record[metric],
                    employeeAverage: mean,
                    deviationPercent: deviationPercent,
                    type: deviation > 0 ? 'Spike' : 'Dip',
                });
            }
        });

        return foundAnomalies;
    }, [data, metric, account, deviationThreshold]);


    const sortedAnomalies = useMemo(() => {
        return [...anomalies].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            if (sortKey === 'date') {
                 return sortOrder === 'asc' ? new Date(valA).getTime() - new Date(valB).getTime() : new Date(valB).getTime() - new Date(valA).getTime();
            }
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });
    }, [anomalies, sortKey, sortOrder]);


    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };
    
    const metricLabel = METRIC_OPTIONS.find(m => m.value === metric)?.label || 'Metric';

    const renderSortableHeader = (key: SortKey, label: string) => (
        <th
            className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
            onClick={() => handleSort(key)}
        >
            <div className="flex items-center gap-1">
                {label}
                {sortKey === key && (sortOrder === 'asc' ? <SortAscIcon /> : <SortDescIcon />)}
            </div>
        </th>
    );

    const renderContent = () => {
        if (account === 'all') {
            return <div className="flex items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">Please select a specific account from the sidebar filters to detect anomalies.</div>;
        }
        if (anomalies.length === 0) {
            return <div className="flex items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">No anomalies found for the current filters and settings.</div>;
        }

        return (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            {renderSortableHeader('date', 'Date')}
                            {renderSortableHeader('employee', 'Employee')}
                            {renderSortableHeader('store', 'Store')}
                            {renderSortableHeader('metricValue', `Actual ${metricLabel}`)}
                            {renderSortableHeader('employeeAverage', 'Employee Avg')}
                            {renderSortableHeader('deviationPercent', 'Deviation (%)')}
                            {renderSortableHeader('type', 'Type')}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {sortedAnomalies.map((anomaly, index) => (
                             <tr key={`${anomaly.date}-${anomaly.employee}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{anomaly.date}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">{anomaly.employee}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{anomaly.store}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{anomaly.metricValue.toFixed(2)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{anomaly.employeeAverage.toFixed(2)}</td>
                                <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${anomaly.deviationPercent > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {anomaly.deviationPercent > 0 ? '+' : ''}{anomaly.deviationPercent.toFixed(2)}%
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                     <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                         anomaly.type === 'Spike'
                                             ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                                             : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                                     }`}>
                                         {anomaly.type}
                                     </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex flex-wrap items-center gap-4 p-2 mb-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg flex-shrink-0">
                 <div className="flex-grow">
                    <label htmlFor="deviation-threshold" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Deviation Threshold (%)
                    </label>
                    <input
                        type="number"
                        id="deviation-threshold"
                        value={deviationThreshold}
                        onChange={e => setDeviationThreshold(parseFloat(e.target.value) || 0)}
                        min="0"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition"
                    />
                </div>
                 <div className="flex-grow">
                    <p className="text-sm text-slate-500 dark:text-slate-400 pt-6">
                        Anomalies for <span className="font-bold text-primary">{metricLabel}</span> vs employee average.
                    </p>
                </div>
            </div>
            
            <div className="flex-grow overflow-auto min-h-0">
                {renderContent()}
            </div>
        </div>
    );
};

export default AnomalyDetection;