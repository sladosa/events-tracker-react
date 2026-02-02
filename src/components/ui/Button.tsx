import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

// --------------------------------------------
// Types
// --------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// --------------------------------------------
// Styles
// --------------------------------------------

const baseStyles = `
  inline-flex items-center justify-center
  font-medium rounded-lg
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
`;

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-indigo-600 text-white
    hover:bg-indigo-700
    focus:ring-indigo-500
    shadow-sm hover:shadow-md
  `,
  secondary: `
    bg-gray-100 text-gray-800
    hover:bg-gray-200
    focus:ring-gray-500
  `,
  ghost: `
    bg-transparent text-gray-700
    hover:bg-gray-100
    focus:ring-gray-500
  `,
  danger: `
    bg-red-600 text-white
    hover:bg-red-700
    focus:ring-red-500
  `,
  outline: `
    border-2 border-indigo-600 text-indigo-600 bg-transparent
    hover:bg-indigo-50
    focus:ring-indigo-500
  `
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2',
  icon: 'p-2'
};

// --------------------------------------------
// Component
// --------------------------------------------

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" className="text-current" />
        ) : leftIcon ? (
          <span className="flex-shrink-0">{leftIcon}</span>
        ) : null}
        
        {children && <span>{children}</span>}
        
        {rightIcon && !loading && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

// --------------------------------------------
// Icon Button variant
// --------------------------------------------

interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'children'> {
  icon: React.ReactNode;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon, className, ...props }, ref) {
    return (
      <Button
        ref={ref}
        size="icon"
        className={cn('rounded-full', className)}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);
