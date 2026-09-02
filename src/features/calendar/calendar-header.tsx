'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}) => {
  const t = useTranslations('calendar');
  const locale = useLocale();

  const formattedMonthYear = React.useMemo(() => {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(currentDate);
  }, [currentDate, locale]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2D8D0]">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-[#2D1B2D] capitalize">{formattedMonthYear}</h2>
        <Button variant="outline" size="sm" onClick={onToday} className="min-h-[36px] text-xs">
          <CalendarIcon className="h-3.5 w-3.5 mr-1" />
          {t('today')}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevMonth}
          aria-label={t('prevMonth')}
          className="min-h-[40px] px-3"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNextMonth}
          aria-label={t('nextMonth')}
          className="min-h-[40px] px-3"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
