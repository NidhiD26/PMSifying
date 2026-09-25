'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { CycleDomainModel } from '@/types/health';
import { cn } from '@/lib/utils/cn';
import { formatLocalDateIso } from '@/lib/utils/date-utils';

export interface CalendarGridProps {
  currentDate: Date;
  selectedDate: string; // YYYY-MM-DD
  cycles: CycleDomainModel[];
  onSelectDate: (dateIso: string) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  selectedDate,
  cycles,
  onSelectDate,
}) => {
  const t = useTranslations('calendar');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const todayIso = formatLocalDateIso(new Date());

  // Derive grid cells for the current month
  const gridCells = React.useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { dateIso: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, prevDay);
      const iso = formatLocalDateIso(prevDate);
      cells.push({ dateIso: iso, dayNumber: prevDay, isCurrentMonth: false });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const iso = formatLocalDateIso(dayDate);
      cells.push({ dateIso: iso, dayNumber: day, isCurrentMonth: true });
    }

    // Next month padding (to complete 35 or 42 grid cells)
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextDate = new Date(year, month + 1, day);
      const iso = formatLocalDateIso(nextDate);
      cells.push({ dateIso: iso, dayNumber: day, isCurrentMonth: false });
    }

    return cells;
  }, [year, month]);

  // Derived Period State Map for quick day lookup
  const getPeriodStateForDate = React.useCallback(
    (dateIso: string) => {
      for (const cycle of cycles) {
        if (cycle.startDate === dateIso) {
          return { isStart: true, isPeriodDay: true, isOngoing: !cycle.endDate };
        }
        if (cycle.endDate && dateIso >= cycle.startDate && dateIso <= cycle.endDate) {
          return { isStart: false, isPeriodDay: true, isOngoing: false, isEnd: cycle.endDate === dateIso };
        }
        if (!cycle.endDate && dateIso >= cycle.startDate && dateIso <= todayIso) {
          return { isStart: false, isPeriodDay: true, isOngoing: true };
        }
      }
      return null;
    },
    [cycles, todayIso]
  );

  const weekdays = [
    t('weekdays.sun'),
    t('weekdays.mon'),
    t('weekdays.tue'),
    t('weekdays.wed'),
    t('weekdays.thu'),
    t('weekdays.fri'),
    t('weekdays.sat'),
  ];

  return (
    <div className="w-full space-y-2" role="grid" aria-label={t('title')}>
      {/* Weekday Header */}
      <div className="grid grid-cols-7 gap-1 text-center font-medium text-xs text-[#5A5A66] py-2" role="row">
        {weekdays.map((day, idx) => (
          <div key={idx} role="columnheader" className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2" role="rowgroup">
        {gridCells.map((cell) => {
          const isSelected = cell.dateIso === selectedDate;
          const isToday = cell.dateIso === todayIso;
          const periodState = getPeriodStateForDate(cell.dateIso);

          return (
            <button
              type="button"
              key={cell.dateIso}
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${cell.dateIso}${periodState?.isPeriodDay ? `, ${t('recordedPeriod')}` : ''}`}
              onClick={() => onSelectDate(cell.dateIso)}
              className={cn(
                'relative flex flex-col items-center justify-between p-2 min-h-[52px] sm:min-h-[64px] rounded-xl border text-sm font-medium transition-all cursor-pointer focus-visible:z-10',
                cell.isCurrentMonth ? 'text-[#1E1E24]' : 'text-[#5A5A66]/40 opacity-40',
                periodState?.isPeriodDay
                  ? 'bg-[#C94A46]/10 border-[#C94A46]/30 text-[#2D1B2D]'
                  : 'border-[#E2D8D0]/60 bg-[#FFFFFF] hover:bg-[#F9EBEA]/50',
                periodState?.isOngoing && 'border-dashed border-[#C94A46]',
                isToday && 'ring-2 ring-[#E8837D] font-bold',
                isSelected && 'ring-2 ring-[#2D1B2D] bg-[#F9EBEA]'
              )}
            >
              <span className="self-end text-xs sm:text-sm">{cell.dayNumber}</span>

              {/* Period Markers */}
              <div className="flex items-center gap-1 mt-1">
                {periodState?.isStart && (
                  <span
                    className="h-2 w-2 rounded-full bg-[#C94A46]"
                    title={t('periodStarted')}
                  />
                )}
                {periodState?.isPeriodDay && !periodState?.isStart && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#C94A46]/60"
                    title={t('recordedPeriod')}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
