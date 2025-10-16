
import React, { ChangeEvent } from 'react';
import type { Option } from '../types';

interface SelectDropdownProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  options: Option[];
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}

export const SelectDropdown: React.FC<SelectDropdownProps> = ({ id, label, icon, options, value, onChange }) => {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
        <span className="w-5 h-5 text-gray-400">{icon}</span>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          className="w-full appearance-none bg-gray-700/80 border border-gray-600 text-white rounded-lg py-2.5 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
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
