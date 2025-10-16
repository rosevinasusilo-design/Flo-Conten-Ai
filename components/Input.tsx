import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  wrapperClassName?: string;
}

const Input: React.FC<InputProps> = ({ label, wrapperClassName, ...props }) => {
  return (
    <div className={wrapperClassName}>
      <label htmlFor={props.id || props.name} className="block text-sm font-medium text-gray-400 mb-2">
        {label}
      </label>
      <input
        {...props}
        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
      />
    </div>
  );
};

export default Input;