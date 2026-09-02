import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#1E1E24]">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'flex min-h-[48px] w-full rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] px-4 py-3 text-base text-[#1E1E24] placeholder:text-[#5A5A66] transition-colors focus-visible:border-[#E8837D] disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-[#C94A46]',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-[#C94A46]">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
