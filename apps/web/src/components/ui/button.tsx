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
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' &&
          'bg-gold text-[#14100a] hover:bg-gold-bright focus-visible:ring-gold shadow-gold',
        variant === 'secondary' &&
          'bg-white/[0.06] text-[#f8f8fc] hover:bg-white/[0.1] focus-visible:ring-white/20',
        variant === 'ghost' &&
          'text-white/60 hover:bg-white/[0.06] hover:text-[#f8f8fc] focus-visible:ring-white/20',
        variant === 'danger' &&
          'bg-[#e2718a] text-[#1a0810] hover:bg-[#e88ea3] focus-visible:ring-[#e2718a]',
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
