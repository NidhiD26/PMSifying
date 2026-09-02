import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'period' | 'fertile' | 'ovulation' | 'accent';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  children,
  ...props
}) => {
  const variants = {
    neutral: 'bg-[#5A5A66]/10 text-[#1E1E24]',
    period: 'bg-[#C94A46]/15 text-[#C94A46]',
    fertile: 'bg-[#B8860B]/15 text-[#B8860B]',
    ovulation: 'bg-[#2E8B57]/15 text-[#2E8B57]',
    accent: 'bg-[#E8837D]/20 text-[#2D1B2D]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
