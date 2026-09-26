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

interface GridCell {
  dateIso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
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

  const gridCells = React.useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: GridCell[] = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      cells.push({
        dateIso: formatLocalDateIso(new Date(year, month - 1, prevDay)),
        dayNumber: prevDay,
        isCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        dateIso: formatLocalDateIso(new Date(year, month, day)),
        dayNumber: day,
        isCurrentMonth: true,
      });
    }

    const totalCells = cells.length > 35 ? 42 : 35;
    for (let day = 1; day <= totalCells - cells.length; day++) {
      cells.push({
        dateIso: formatLocalDateIso(new Date(year, month + 1, day)),
        dayNumber: day,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [year, month]);

  // Weeks, so the grid is announced row by row rather than as one long run.
  const weeks = React.useMemo(() => {
    const rows: GridCell[][] = [];
    for (let i = 0; i < gridCells.length; i += 7) {
      rows.push(gridCells.slice(i, i + 7));
    }
    return rows;
  }, [gridCells]);

  // One lookup per day instead of scanning every cycle for every cell.
  const periodStateByDate = React.useMemo(() => {
    const map = new Map<
      string,
      { isStart: boolean; isPeriodDay: boolean; isOngoing: boolean; isEnd: boolean }
    >();
    for (const cycle of cycles) {
      const end = cycle.endDate ?? todayIso;
      for (
        let date = cycle.startDate;
        date <= end;
        date = formatLocalDateIso(addDays(new Date(`${date}T00:00:00`), 1))
      ) {
        if (map.has(date)) continue;
        map.set(date, {
          isStart: date === cycle.startDate,
          isPeriodDay: true,
          isOngoing: !cycle.endDate,
          isEnd: !!cycle.endDate && cycle.endDate === date,
        });
      }
    }
    return map;
  }, [cycles, todayIso]);

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
    <div className="w-full space-y-3" role="grid" aria-label={t('title')}>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[#5A5A66]" role="row">
        {weekdays.map((day, idx) => (
          <div key={idx} role="columnheader" className="truncate py-1" title={day}>
            {day}
          </div>
        ))}
      </div>

      <div className="space-y-1 sm:space-y-1.5" role="rowgroup">
        {weeks.map((week) => (
          <div key={week[0].dateIso} role="row" className="grid grid-cols-7 gap-1 sm:gap-2">
            {week.map((cell) => {
              const isSelected = cell.dateIso === selectedDate;
              const isToday = cell.dateIso === todayIso;
              const periodState = periodStateByDate.get(cell.dateIso);

              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${cell.dateIso}${
                    periodState?.isPeriodDay ? `, ${t('recordedPeriod')}` : ''
                  }${isToday ? `, ${t('today')}` : ''}`}
                  onClick={() => onSelectDate(cell.dateIso)}
                  className={cn(
                    'relative flex min-h-[48px] flex-col items-center justify-between rounded-xl border p-1.5 text-sm transition-colors sm:min-h-[64px] sm:p-2',
                    'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]',
                    cell.isCurrentMonth
                      ? 'bg-[#FFFFFF] text-[#1E1E24]'
                      : 'bg-transparent text-[#5A5A66]/50',
                    periodState?.isPeriodDay && 'border-[#C94A46]/40 bg-[#C94A46]/10',
                    periodState?.isOngoing && 'border-dashed border-[#C94A46]',
                    isToday && 'border-[#2D1B2D] font-bold',
                    isSelected && 'border-[#2D1B2D] bg-[#F9EBEA] ring-2 ring-[#2D1B2D]'
                  )}
                >
                  <span className="self-end text-xs leading-none sm:text-sm">{cell.dayNumber}</span>
                  <span className="flex h-2 items-center justify-center" aria-hidden="true">
                    {periodState?.isStart ? (
                      <span className="h-2 w-2 rounded-full bg-[#C94A46]" />
                    ) : periodState?.isPeriodDay ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#C94A46]/60" />
                    ) : isToday ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2D1B2D]" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#E2D8D0] pt-3 text-xs text-[#5A5A66]">
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#C94A46]" aria-hidden="true" />
          {t('legendPeriod')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2D1B2D]" aria-hidden="true" />
          {t('legendToday')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-[#2D1B2D] bg-[#F9EBEA]" aria-hidden="true" />
          {t('legendSelected')}
        </li>
      </ul>
    </div>
  );
};

/** Local-midnight date arithmetic, so no cell ever shifts across a UTC boundary. */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
