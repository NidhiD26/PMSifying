import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 min-h-[48px] px-5 py-2.5 cursor-pointer rounded-xl';

    const variants = {
      primary: 'bg-[#2D1B2D] text-[#FDFBF7] hover:bg-[#3D283D] active:bg-[#1E111E]',
      secondary: 'bg-[#F9EBEA] text-[#2D1B2D] hover:bg-[#F2D7D5]',
      outline: 'border border-[#E2D8D0] bg-transparent text-[#1E1E24] hover:bg-[#FDFBF7]',
      ghost: 'bg-transparent text-[#2D1B2D] hover:bg-[#F9EBEA]',
      danger: 'bg-[#C94A46] text-white hover:bg-[#A83835]',
    };

    const sizes = {
      sm: 'text-sm min-h-[40px] px-4',
      md: 'text-base min-h-[48px] px-5',
      lg: 'text-lg min-h-[54px] px-6',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
