import React from 'react';

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectInputProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  // FIX: Add optional 'disabled' prop to support disabling the select input.
  disabled?: boolean;
}

const SelectInput = <T extends string>({ label, value, onChange, options, disabled = false }: SelectInputProps<T>) => {
  return (
    <div className="w-full">
      <label htmlFor={label} className="block text-sm font-medium text-gray-400 mb-2">
        {label}
      </label>
      <div className="relative">
        <select
          id={label}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          // FIX: Apply the disabled prop and corresponding styles.
          disabled={disabled}
          className="w-full appearance-none bg-gray-800/70 border border-gray-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
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

export default SelectInput;
