import React from 'react';

interface CardProps {
    title: string;
    children: React.ReactNode;
    headerAction?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children, headerAction }) => {
    return (
        <div className="bg-gray-800 rounded-xl shadow-lg">
            <div className="p-4 sm:p-6 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                {headerAction}
            </div>
            <div className="p-4 sm:p-6">
                {children}
            </div>
        </div>
    );
};

export default Card;