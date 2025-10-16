import React from 'react';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
  size?: ButtonSize;
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', children, className, ...props }) => {
  const baseClasses = "flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed border";

  const variantClasses: Record<ButtonVariant, string> = {
    primary: "bg-emerald-600 border-transparent text-white hover:bg-emerald-700 focus:ring-emerald-500",
    secondary: "bg-gray-700 border-transparent text-gray-200 hover:bg-gray-600 focus:ring-gray-500",
  };
  
  const sizeClasses: Record<ButtonSize, string> = {
      md: "px-4 py-2.5 text-base",
      sm: "px-3 py-1.5 text-sm",
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;