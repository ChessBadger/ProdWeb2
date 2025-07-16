import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EmployeeRecord, Metric } from '../types';
import { METRIC_OPTIONS } from '../constants';

interface PerformanceBarChartProps {
    data: EmployeeRecord[];
    metric: Metric;
    topN: number;
    showTop: boolean;
    isDarkMode: boolean;
}

const PerformanceBarChart: React.FC<PerformanceBarChartProps> = ({ data, metric, topN, showTop, isDarkMode }) => {
    const chartData = useMemo(() => {
        if (!data.length) return [];
        
        const employeeMetrics = new Map<string, { total: number; count: number }>();

        data.forEach(record => {
            if (!employeeMetrics.has(record.employee)) {
                employeeMetrics.set(record.employee, { total: 0, count: 0 });
            }
            const current = employeeMetrics.get(record.employee)!;
            current.total += record[metric];
            current.count += 1;
        });

        const aggregatedData = Array.from(employeeMetrics.entries()).map(([employee, values]) => ({
            employee,
            [metric]: values.total / values.count,
        }));
        
        const sortedData = aggregatedData.sort((a, b) => (b[metric] as number) - (a[metric] as number));

        const finalData = showTop ? sortedData : sortedData.reverse();

        return finalData.slice(0, topN);

    }, [data, metric, topN, showTop]);

    const metricLabel = METRIC_OPTIONS.find(m => m.value === metric)?.label || metric;

    if (!chartData.length) {
        return <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">No data available for the selected filters.</div>;
    }
    
    const tickColor = isDarkMode ? '#94a3b8' : '#64748b';
    const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="employee" tick={{ fontSize: 12, fill: tickColor }} />
                <YAxis tick={{ fontSize: 12, fill: tickColor }} />
                <Tooltip 
                    formatter={(value: number) => [value.toFixed(2), metricLabel]}
                    cursor={{fill: isDarkMode ? 'rgba(185, 28, 28, 0.1)' : 'rgba(185, 28, 28, 0.1)'}}
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1e293b' : 'white',
                      border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                      borderRadius: '0.5rem',
                      color: isDarkMode ? '#e2e8f0' : '#1e293b'
                    }}
                />
                <Legend wrapperStyle={{fontSize: "14px", color: tickColor}} />
                <Bar dataKey={metric} name={`Average ${metricLabel}`} fill="#b91c1c" />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default PerformanceBarChart;