import React, { useState, useMemo } from 'react';
import { EmployeeRecord } from '../types';
import { METRIC_OPTIONS } from '../constants';
import { SortAscIcon, SortDescIcon, ChevronLeftIcon, ChevronRightIcon } from './icons/Icons';

interface RawDataTableProps {
    data: EmployeeRecord[];
}

type SortKey = keyof EmployeeRecord;
const ITEMS_PER_PAGE = 10;

const RawDataTable: React.FC<RawDataTableProps> = ({ data }) => {
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => {
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
    }, [data, sortKey, sortOrder]);
    
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedData, currentPage]);
    
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
        setCurrentPage(1);
    };

    const renderHeader = (key: SortKey, label: string) => (
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort(key)}>
            <div className="flex items-center gap-1">
                {label}
                {sortKey === key && (sortOrder === 'asc' ? <SortAscIcon /> : <SortDescIcon />)}
            </div>
        </th>
    );

    if (!data.length) {
        return <div className="text-center py-10 text-slate-500 dark:text-slate-400">No data to display.</div>;
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            {renderHeader('date', 'Date')}
                            {renderHeader('employee', 'Employee')}
                            {renderHeader('office', 'Office')}
                            {renderHeader('account', 'Account')}
                            {renderHeader('store', 'Store')}
                            {METRIC_OPTIONS.map(m => renderHeader(m.value, m.label))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {paginatedData.map((row, index) => (
                            <tr key={`${row.date}-${row.employee}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{row.date}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-200">{row.employee}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{row.office}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{row.account}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{row.store}</td>
                                {METRIC_OPTIONS.map(m => (
                                    <td key={m.value} className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{row[m.value]}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-4 py-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                            disabled={currentPage === 1}
                            className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            aria-label="Previous Page"
                        >
                            <ChevronLeftIcon />
                        </button>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            aria-label="Next Page"
                        >
                            <ChevronRightIcon />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default RawDataTable;
