import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// --------------------------------------------
// Base Input
// --------------------------------------------

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, error, leftIcon, rightIcon, ...props }, ref) {
    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-lg border bg-white px-4 py-2.5',
            'text-gray-900 placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'transition-all duration-200',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            error 
              ? 'border-red-300 focus:ring-red-500' 
              : 'border-gray-200 hover:border-gray-300',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

// --------------------------------------------
// Search Input (specialized)
// --------------------------------------------

interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'type'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onClear, className, ...props }, ref) {
    const hasValue = Boolean(value);

    return (
      <Input
        ref={ref}
        type="search"
        value={value}
        leftIcon={
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
            />
          </svg>
        }
        rightIcon={
          hasValue && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          ) : undefined
        }
        className={cn('pr-10', className)}
        {...props}
      />
    );
  }
);

// --------------------------------------------
// Select (basic)
// --------------------------------------------

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ options, placeholder, error, className, ...props }, ref) {
    return (
      <div>
        <select
          ref={ref}
          className={cn(
            'w-full rounded-lg border bg-white px-4 py-2.5',
            'text-gray-900',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'transition-all duration-200',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            error 
              ? 'border-red-300 focus:ring-red-500' 
              : 'border-gray-200 hover:border-gray-300',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);
