import React from 'react';

interface ToggleSwitchProps {
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    labelLeft: string;
    labelRight: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, checked, onChange, labelLeft, labelRight }) => {
    return (
        <div className="flex items-center space-x-2">
            <span className={`text-sm font-medium ${!checked ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`}>{labelLeft}</span>
            <label htmlFor={id} className="inline-flex relative items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    id={id}
                    className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-primary peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-200 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
             <span className={`text-sm font-medium ${checked ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`}>{labelRight}</span>
        </div>
    );
};

export default ToggleSwitch;