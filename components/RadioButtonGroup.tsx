import React from 'react';

interface RadioOption<T extends string> {
  value: T;
  label: string;
}

interface RadioButtonGroupProps<T extends string> {
  label: string;
  name: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

const RadioButtonGroup = <T extends string>({ label, name, options, value, onChange }: RadioButtonGroupProps<T>) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
      <div className="flex items-center gap-2 p-1 bg-gray-800/70 rounded-lg">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            name={name}
            onClick={() => onChange(option.value)}
            className={`w-full py-1 text-xs font-semibold rounded-md transition-colors ${
              value === option.value ? 'bg-gray-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RadioButtonGroup;
