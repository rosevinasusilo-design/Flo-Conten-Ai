import React from 'react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
}

export const AuthInput: React.FC<AuthInputProps> = ({ id, label, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      <input
          id={id}
          className="w-full rounded-md border border-gray-600 bg-gray-700/50 py-2.5 px-4 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:text-sm transition"
          {...props}
        />
    </div>
  );
};