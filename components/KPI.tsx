import React from 'react';

interface KPIProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}

const KPI: React.FC<KPIProps> = ({ title, value, subtitle, icon }) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm flex items-start gap-4">
      <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-lg">
        {icon}
      </div>
      <div className="flex-grow">
        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</h4>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
      </div>
    </div>
  );
};

export default KPI;