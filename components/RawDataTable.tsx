import React, { useEffect, useState, useMemo } from 'react';
import { EmployeeRecord } from '../types';
import { METRIC_OPTIONS } from '../constants';
import { SortAscIcon, SortDescIcon } from './icons/Icons';
import PaginationControls, { ITEMS_PER_PAGE } from './PaginationControls';

interface RawDataTableProps {
    data: EmployeeRecord[];
}

type SortKey = keyof EmployeeRecord;

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
    
    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

    useEffect(() => {
        setCurrentPage(1);
    }, [data]);

    useEffect(() => {
        setCurrentPage(page => Math.min(Math.max(1, page), Math.max(1, totalPages)));
    }, [totalPages]);

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
            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        </>
    );
};

export default RawDataTable;
