import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-white/80">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          'w-full rounded-lg border bg-white/[0.04] px-3 py-2.5 text-sm text-[#f8f8fc] placeholder-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-transparent',
          error ? 'border-[#e2718a]' : 'border-white/10',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-[#e2718a]">{error}</p>}
      {helperText && !error && <p className="text-xs text-white/45">{helperText}</p>}
    </div>
  ),
);
Input.displayName = 'Input';
