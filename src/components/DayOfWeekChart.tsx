import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EmployeeRecord, Metric } from '../types';
import { METRIC_OPTIONS } from '../constants';

interface DayOfWeekChartProps {
    data: EmployeeRecord[];
    metric: Metric;
    isDarkMode: boolean;
}

const DayOfWeekChart: React.FC<DayOfWeekChartProps> = ({ data, metric, isDarkMode }) => {

    const chartData = useMemo(() => {
        if (!data.length) return [];
        
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayMetrics = Array.from({ length: 7 }, (_, i) => ({
            day: days[i],
            total: 0,
            count: 0
        }));

        data.forEach(record => {
            const recordDate = new Date(record.date.replace(/-/g, '/'));
            const dayIndex = recordDate.getDay();
            dayMetrics[dayIndex].total += record[metric];
            dayMetrics[dayIndex].count++;
        });

        return dayMetrics.map(dayData => ({
            name: dayData.day,
            [metric]: dayData.count > 0 ? dayData.total / dayData.count : 0,
        }));

    }, [data, metric]);

    const metricLabel = METRIC_OPTIONS.find(m => m.value === metric)?.label || metric;

    if (!chartData.length || chartData.every(d => d[metric] === 0)) {
        return <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">No data available for this view.</div>;
    }

    const tickColor = isDarkMode ? '#94a3b8' : '#64748b';
    const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: tickColor }} />
                <YAxis tick={{ fontSize: 12, fill: tickColor }} />
                <Tooltip 
                    formatter={(value: number) => [value.toFixed(2), `Avg ${metricLabel}`]}
                    cursor={{fill: isDarkMode ? 'rgba(185, 28, 28, 0.1)' : 'rgba(185, 28, 28, 0.1)'}}
                    contentStyle={{
                        backgroundColor: isDarkMode ? '#1e293b' : 'white',
                        border: `1px solid ${gridColor}`,
                        borderRadius: '0.5rem',
                        color: isDarkMode ? '#e2e8f0' : '#1e293b'
                    }}
                />
                <Legend wrapperStyle={{fontSize: "14px", color: tickColor}}/>
                <Bar dataKey={metric} name={`Average ${metricLabel}`} fill="#b91c1c" />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default DayOfWeekChart;
