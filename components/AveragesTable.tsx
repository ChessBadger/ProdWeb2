import React, { useMemo, useState } from 'react';
import { EmployeeRecord, Metric } from '../types';
import { METRIC_OPTIONS } from '../constants';
import { SortAscIcon, SortDescIcon } from './icons/Icons';

interface AveragesTableProps {
    data: EmployeeRecord[];
    metric: Metric;
}

type SortKey = Metric | 'employee' | 'consistency';


interface PerformanceByGroupTableProps {
    data: EmployeeRecord[];
    groupBy: 'store' | 'supervisor';
}

type GroupData = {
    groupName: string;
    count: number;
    averages: { [K in Metric]: number };
}

type GroupSortKey = 'groupName' | Metric;

export const PerformanceByGroupTable: React.FC<PerformanceByGroupTableProps> = ({ data, groupBy }) => {
    const [sortKey, setSortKey] = useState<GroupSortKey>('groupName');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');


    const groupedData = useMemo((): GroupData[] => {
        if (!data.length) return [];
        
        const groups = new Map<string, EmployeeRecord[]>();

        data.forEach(record => {
            const key = record[groupBy];
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(record);
        });

        return Array.from(groups.entries()).map(([groupName, records]) => {
            const count = records.length;
            const averages = {} as { [K in Metric]: number };

            METRIC_OPTIONS.forEach(({ value: metric }) => {
                const values = records.map(r => r[metric]);
                const sum = values.reduce((acc, v) => acc + v, 0);
                const avg = count > 0 ? sum / count : 0;
                averages[metric] = avg;
            });

            return { groupName, count, averages };
        });
    }, [data, groupBy]);

    const sortedData = useMemo(() => {
        return [...groupedData].sort((a, b) => {
            let valA, valB;

            if (sortKey === 'groupName') {
                valA = a[sortKey];
                valB = b[sortKey];
            } else {
                const metric = sortKey as Metric;
                valA = a.averages[metric];
                valB = b.averages[metric];
            }
            
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });
    }, [groupedData, sortKey, sortOrder]);


    const handleSort = (key: GroupSortKey) => {
        if (sortKey === key) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };
    
    const renderSortableHeader = (key: GroupSortKey, label: string, className = "") => (
        <th 
            className={`px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 ${className}`}
            onClick={() => handleSort(key)}
        >
            <div className={`flex items-center gap-1 ${className.includes('text-center') ? 'justify-center' : ''}`}>
                {label}
                {sortKey === key && (sortOrder === 'asc' ? <SortAscIcon /> : <SortDescIcon />)}
            </div>
        </th>
    );

    if (!groupedData.length) {
        return <div className="text-center py-10 text-slate-500 dark:text-slate-400">No data to display for the selected filters.</div>;
    }
    
    const headerLabel = groupBy === 'store' ? 'Store' : 'Supervisor';
    
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                         <th 
                            className="sticky left-0 bg-slate-50 dark:bg-slate-700/50 z-10 px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                            onClick={() => handleSort('groupName')}
                        >
                            <div className="flex items-center gap-1">
                                {headerLabel}
                                {sortKey === 'groupName' && (sortOrder === 'asc' ? <SortAscIcon /> : <SortDescIcon />)}
                            </div>
                        </th>
                        {METRIC_OPTIONS.map(m => renderSortableHeader(m.value, `Avg ${m.label}`, 'text-center'))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {sortedData.map(row => (
                        <tr key={row.groupName} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 group">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50">{row.groupName}</td>
                            {METRIC_OPTIONS.map(m => (
                                <td key={`avg-${m.value}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 text-center">{row.averages[m.value].toFixed(2)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}


const AveragesTable: React.FC<AveragesTableProps> = ({ data, metric }) => {
    const [sortKey, setSortKey] = useState<SortKey>('employee');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const overallAverages = useMemo(() => {
        if (!data.length) return null;

        const totals = METRIC_OPTIONS.reduce((acc, metric) => {
            acc[metric.value] = 0;
            return acc;
        }, {} as { [K in Metric]: number });
        
        data.forEach(record => {
            METRIC_OPTIONS.forEach(({ value }) => {
                totals[value] += record[value];
            });
        });

        const averages = {} as { [K in Metric]: number };
        METRIC_OPTIONS.forEach(({ value }) => {
            averages[value] = totals[value] / data.length;
        });
        
        return averages;
    }, [data]);

    const overallConsistencyScore = useMemo(() => {
        if (data.length < 2) return data.length === 1 ? 100 : 0;
        
        const metricValues = data.map(r => r[metric]);
        const mean = metricValues.reduce((a, b) => a + b, 0) / metricValues.length;
        
        if (mean === 0) {
            const isAllZeros = metricValues.every(v => v === 0);
            return isAllZeros ? 100 : 0;
        }

        const stdDev = Math.sqrt(metricValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / metricValues.length);
        const cv = stdDev / Math.abs(mean);
        return Math.max(0, 1 - cv) * 100;
    }, [data, metric]);
    
    const averagesData = useMemo(() => {
        if (!data.length) return [];
        
        const employeeGroups = new Map<string, EmployeeRecord[]>();
        data.forEach(record => {
            if (!employeeGroups.has(record.employee)) {
                employeeGroups.set(record.employee, []);
            }
            employeeGroups.get(record.employee)!.push(record);
        });

        return Array.from(employeeGroups.entries()).map(([employee, records]) => {
            const averages: any = { employee };
            const count = records.length;

            METRIC_OPTIONS.forEach(({ value }) => {
                averages[value] = records.reduce((sum, r) => sum + r[value], 0) / count;
            });
            
            const metricValues = records.map(r => r[metric]);
            let consistencyScore = 0;
            if (metricValues.length > 1) {
                const mean = averages[metric];
                const stdDev = Math.sqrt(metricValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / metricValues.length);
                if (mean !== 0) {
                    const cv = stdDev / Math.abs(mean);
                    consistencyScore = Math.max(0, 1 - cv) * 100;
                } else {
                    consistencyScore = stdDev === 0 ? 100 : 0;
                }
            } else if (metricValues.length === 1) {
                consistencyScore = 100;
            }
            
            averages.consistency = consistencyScore;
            return averages;
        });
    }, [data, metric]);
    
    const sortedData = useMemo(() => {
        if (!averagesData) return [];
        return [...averagesData].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });
    }, [averagesData, sortKey, sortOrder]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };
    
    const renderHeader = (key: SortKey, label: string) => (
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort(key)}>
            <div className="flex items-center gap-1">
                {label}
                {sortKey === key && (sortOrder === 'asc' ? <SortAscIcon /> : <SortDescIcon />)}
            </div>
        </th>
    );

    if (!sortedData.length) {
        return <div className="text-center py-10 text-slate-500 dark:text-slate-400">No data to display.</div>;
    }

    return (
        <div>
            {overallAverages && (
                <div className="p-4 mb-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">Overall Averages & Consistency</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-4">
                        {METRIC_OPTIONS.map(m => (
                            <div key={`overall-${m.value}`}>
                                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{m.label}</div>
                                <div className="text-xl font-bold text-primary">{overallAverages[m.value].toFixed(2)}</div>
                            </div>
                        ))}
                         <div>
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Consistency Score</div>
                            <div className="text-xl font-bold text-primary">{overallConsistencyScore.toFixed(1)}</div>
                        </div>
                    </div>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            {renderHeader('employee', 'Employee')}
                            {renderHeader('consistency', 'Consistency Score')}
                            {METRIC_OPTIONS.map(m => renderHeader(m.value, `Avg ${m.label}`))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {sortedData.map((row) => (
                            <tr key={row.employee} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">{row.employee}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-semibold">{row.consistency.toFixed(1)}</td>
                                {METRIC_OPTIONS.map(m => (
                                    <td key={m.value} className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{row[m.value].toFixed(2)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AveragesTable;