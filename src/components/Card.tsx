
import React from 'react';

interface CardProps {
    title: string;
    children: React.ReactNode;
    className?: string;
    titleIcon?: React.ReactNode;
    action?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', titleIcon, action }) => {
    return (
        <section className={`bg-base-100 rounded-lg shadow p-4 sm:p-6 ${className}`}>
             <div className="flex items-center mb-4">
                {titleIcon && <div className="mr-3 text-brand-primary h-6 w-6">{titleIcon}</div>}
                <h2 className="text-xl font-bold text-brand-primary">
                    {title}
                </h2>
                {action && <div className="ml-auto">{action}</div>}
            </div>
            <div>
                {children}
            </div>
        </section>
    );
};

export default Card;
