import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'flat' | 'bordered' | 'elevated';
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant = 'bordered', children, ...props }, ref) => {
    const baseStyles = 'rounded-2xl p-6 transition-all';

    const variants = {
      flat: 'bg-[#F9EBEA]/40',
      bordered: 'border border-[#E2D8D0] bg-[#FFFFFF]',
      elevated: 'bg-[#FFFFFF] shadow-sm border border-[#E2D8D0]/60',
    };

    return (
      <div ref={ref} className={cn(baseStyles, variants[variant], className)} {...props}>
        {children}
      </div>
    );
  }
);

Surface.displayName = 'Surface';
