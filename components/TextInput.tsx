import React from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const TextInput: React.FC<TextInputProps> = ({ label, ...props }) => {
  return (
    <div>
      <label htmlFor={props.id || props.name} className="block text-sm font-medium text-gray-400 mb-2">
        {label}
      </label>
      <input
        {...props}
        className="w-full bg-slate-800/70 border border-gray-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
      />
    </div>
  );
};

export default TextInput;