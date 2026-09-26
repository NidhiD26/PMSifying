'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LocaleLink } from '@/components/navigation/locale-link';
import type { CycleDomainModel } from '@/types/health';
import { cycleDayForDate } from '@/features/shared/cycle-status';
import { formatLocalDateIso } from '@/lib/utils/date-utils';
import { Calendar as CalendarIcon, Plus, ShieldCheck, NotebookPen } from 'lucide-react';

export interface SelectedDayDetailsProps {
  selectedDateIso: string; // YYYY-MM-DD
  cycles: CycleDomainModel[];
  onLogPeriodForDate: (dateIso: string) => void;
  hasDailyLog?: boolean;
}

const flowLabelKey = (level: string): string =>
  `flow${level.charAt(0).toUpperCase()}${level.slice(1)}`;

export const SelectedDayDetails: React.FC<SelectedDayDetailsProps> = ({
  selectedDateIso,
  cycles,
  onLogPeriodForDate,
  hasDailyLog = false,
}) => {
  const t = useTranslations('calendar');
  const tPeriod = useTranslations('period');
  const tPrivacy = useTranslations('privacy');
  const tCommon = useTranslations('common');

  const todayIso = React.useMemo(() => formatLocalDateIso(new Date()), []);

  // Only recorded facts: a day is part of a period because a cycle says so.
  const matchingCycle = React.useMemo(() => {
    return cycles.find((cycle) => {
      if (cycle.startDate === selectedDateIso) return true;
      if (cycle.endDate && selectedDateIso >= cycle.startDate && selectedDateIso <= cycle.endDate) {
        return true;
      }
      if (!cycle.endDate && selectedDateIso >= cycle.startDate && selectedDateIso <= todayIso) {
        return true;
      }
      return false;
    });
  }, [cycles, selectedDateIso, todayIso]);

  const cycleDay = React.useMemo(
    () => cycleDayForDate(cycles, selectedDateIso),
    [cycles, selectedDateIso]
  );

  const isStart = matchingCycle?.startDate === selectedDateIso;
  const isEnd = matchingCycle?.endDate === selectedDateIso;
  const isOngoing = matchingCycle != null && matchingCycle.endDate == null;
  const isFuture = selectedDateIso > todayIso;

  return (
    <Surface variant="bordered" className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-[#E2D8D0] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D1B2D] text-[#FDFBF7]">
            <CalendarIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#2D1B2D]">{selectedDateIso}</h2>
            {cycleDay ? (
              <p className="text-xs text-[#5A5A66]">{t('cycleDay', { day: cycleDay })}</p>
            ) : (
              <p className="text-xs text-[#5A5A66]">{t('beforeFirstRecord')}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {hasDailyLog && <Badge variant="ovulation">{t('dailyLogRecorded')}</Badge>}
          {isStart && <Badge variant="period">{t('periodStarted')}</Badge>}
          {isEnd && <Badge variant="neutral">{t('periodEnded')}</Badge>}
          {isOngoing && !isStart && <Badge variant="period">{t('ongoingPeriod')}</Badge>}
          {matchingCycle && !isStart && !isEnd && !isOngoing && (
            <Badge variant="period">{t('recordedPeriod')}</Badge>
          )}
        </div>
      </div>

      {matchingCycle ? (
        <dl className="divide-y divide-[#F1E7E3]">
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-sm text-[#5A5A66]">{tPeriod('startDate')}</dt>
            <dd className="text-sm font-semibold text-[#2D1B2D]">{matchingCycle.startDate}</dd>
          </div>
          {matchingCycle.endDate && (
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-sm text-[#5A5A66]">{tPeriod('endDate')}</dt>
              <dd className="text-sm font-semibold text-[#2D1B2D]">{matchingCycle.endDate}</dd>
            </div>
          )}
          {matchingCycle.flow && (
            <div className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-sm text-[#5A5A66]">{tPeriod('flow')}</dt>
              <dd className="text-sm font-semibold text-[#2D1B2D]">
                {tPeriod(flowLabelKey(matchingCycle.flow))}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="py-1 text-sm leading-relaxed text-[#5A5A66]">
          {isFuture ? t('futureDateHint') : t('noRecordHint')}
        </p>
      )}

      {matchingCycle?.notes && (
        <div className="border-t border-[#E2D8D0] pt-3">
          <span className="mb-1 block text-xs font-semibold text-[#5A5A66]">
            {tPeriod('notes')}
          </span>
          <p className="rounded-lg border border-[#E2D8D0] bg-[#F9EBEA]/50 p-2.5 text-xs italic leading-relaxed text-[#1E1E24]">
            {matchingCycle.notes}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-[#E2D8D0] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-[#2E8B57]">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{tPrivacy('localDexieVault')}</span>
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <LocaleLink
            href={`/health?date=${selectedDateIso}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#E2D8D0] px-4 py-2 text-sm font-medium text-[#1E1E24] transition-colors hover:bg-[#FDFBF7]"
          >
            <NotebookPen className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t('logHealthForDate')}
          </LocaleLink>
          {!isFuture && (
            <Button variant="primary" size="sm" onClick={() => onLogPeriodForDate(selectedDateIso)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {isStart || isOngoing ? tCommon('edit') : t('logPeriodForDate')}
            </Button>
          )}
        </div>
      </div>
    </Surface>
  );
};
