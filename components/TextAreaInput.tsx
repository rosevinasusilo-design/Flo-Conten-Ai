import React from 'react';

interface TextAreaInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

const TextAreaInput: React.FC<TextAreaInputProps> = ({ label, value, onChange, placeholder, rows = 4 }) => {
  return (
    <div>
      {label && (
        <label htmlFor={label} className="block text-sm font-medium text-gray-400 mb-2">
          {label}
        </label>
      )}
      <textarea
        id={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-gray-900/80 border border-gray-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
      />
    </div>
  );
};

export default TextAreaInput;