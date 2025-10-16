import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

const Select: React.FC<SelectProps> = ({ label, children, ...props }) => {
  return (
    <div className="w-full">
      <label htmlFor={props.id || props.name} className="block text-sm font-medium text-gray-400 mb-2">
        {label}
      </label>
      <div className="relative">
        <select
          {...props}
          className={`w-full appearance-none bg-gray-700 border border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition ${props.className}`}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Select;