'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', isLoading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' &&
          'bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-500',
        variant === 'secondary' &&
          'bg-gray-800 text-gray-100 hover:bg-gray-700 focus-visible:ring-gray-600',
        variant === 'ghost' &&
          'text-gray-400 hover:bg-gray-800 hover:text-white focus-visible:ring-gray-600',
        variant === 'danger' &&
          'bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500',
        className,
      )}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
