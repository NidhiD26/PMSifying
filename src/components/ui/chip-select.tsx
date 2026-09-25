'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface ChipOption {
  value: string;
  label: string;
}

export interface ChipSelectProps {
  name: string;
  options: ChipOption[];
  selected: string[];
  onToggle: (value: string) => void;
  allowDeselect?: boolean;
  ariaLabel: string;
  className?: string;
}

export const ChipSelect: React.FC<ChipSelectProps> = ({
  name,
  options,
  selected,
  onToggle,
  allowDeselect = true,
  ariaLabel,
  className,
}) => {
  const handleClick = (value: string) => {
    if (allowDeselect && selected.includes(value)) {
      onToggle(value);
      return;
    }
    if (!selected.includes(value)) {
      onToggle(value);
    }
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-2.5', className)}
    >
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            type="button"
            key={opt.value}
            name={name}
            aria-pressed={isSelected}
            onClick={() => handleClick(opt.value)}
            className={cn(
              'min-h-[44px] px-4 py-2 rounded-full border text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D] focus-visible:ring-offset-1',
              isSelected
                ? 'border-[#2D1B2D] bg-[#2D1B2D] text-[#FDFBF7]'
                : 'border-[#E2D8D0] bg-[#FFFFFF] text-[#1E1E24] hover:bg-[#F9EBEA]'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
