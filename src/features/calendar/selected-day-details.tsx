'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CycleDomainModel } from '@/types/health';
import { Calendar as CalendarIcon, Plus, ShieldCheck } from 'lucide-react';

export interface SelectedDayDetailsProps {
  selectedDateIso: string; // YYYY-MM-DD
  cycles: CycleDomainModel[];
  onLogPeriodForDate: (dateIso: string) => void;
  hasDailyLog?: boolean;
}

export const SelectedDayDetails: React.FC<SelectedDayDetailsProps> = ({
  selectedDateIso,
  cycles,
  onLogPeriodForDate,
  hasDailyLog = false,
}) => {
  const t = useTranslations('calendar');
  const tPeriod = useTranslations('period');
  const tPrivacy = useTranslations('privacy');

  const todayIso = new Date().toISOString().split('T')[0];

  // Find cycle matching selected date
  const matchingCycle = React.useMemo(() => {
    return cycles.find((c) => {
      if (c.startDate === selectedDateIso) return true;
      if (c.endDate && selectedDateIso >= c.startDate && selectedDateIso <= c.endDate) return true;
      if (!c.endDate && selectedDateIso >= c.startDate && selectedDateIso <= todayIso) return true;
      return false;
    });
  }, [cycles, selectedDateIso, todayIso]);

  const isStart = matchingCycle?.startDate === selectedDateIso;
  const isEnd = matchingCycle?.endDate === selectedDateIso;
  const isOngoing = matchingCycle && !matchingCycle.endDate;

  return (
    <Surface variant="bordered" className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2D8D0]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#2D1B2D] flex items-center justify-center text-[#FDFBF7]">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#2D1B2D]">{selectedDateIso}</h3>
            <span className="text-xs text-[#5A5A66]">
              {matchingCycle ? t('recordedPeriod') : t('noRecord')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {hasDailyLog && <Badge variant="ovulation">{t('dailyLogRecorded')}</Badge>}
          {matchingCycle ? (
            <>
              {isStart && <Badge variant="period">{t('periodStarted')}</Badge>}
              {isEnd && <Badge variant="neutral">{t('periodEnded')}</Badge>}
              {isOngoing && <Badge variant="period">{t('ongoingPeriod')}</Badge>}
              {!isStart && !isEnd && !isOngoing && <Badge variant="period">{t('recordedPeriod')}</Badge>}
            </>
          ) : (
            <Badge variant="neutral">{t('noRecord')}</Badge>
          )}
        </div>
      </div>

      {matchingCycle ? (
        <div className="space-y-2 text-sm text-[#1E1E24]">
          <div className="flex items-center justify-between py-1">
            <span className="text-[#5A5A66]">{tPeriod('startDate')}:</span>
            <span className="font-semibold">{matchingCycle.startDate}</span>
          </div>
          {matchingCycle.endDate && (
            <div className="flex items-center justify-between py-1">
              <span className="text-[#5A5A66]">{tPeriod('endDate')}:</span>
              <span className="font-semibold">{matchingCycle.endDate}</span>
            </div>
          )}
          {matchingCycle.flow && (
            <div className="flex items-center justify-between py-1">
              <span className="text-[#5A5A66]">{tPeriod('flow')}:</span>
              <span className="font-semibold capitalize">{matchingCycle.flow}</span>
            </div>
          )}
          {matchingCycle.notes && (
            <div className="pt-2 border-t border-[#E2D8D0]/60">
              <span className="text-xs font-semibold text-[#5A5A66] block mb-1">
                {tPeriod('notes')}:
              </span>
              <p className="text-xs italic text-[#1E1E24] bg-[#F9EBEA]/50 p-2.5 rounded-lg border border-[#E2D8D0]">
                &quot;{matchingCycle.notes}&quot;
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="py-2 text-sm text-[#5A5A66] space-y-3">
          <p>{t('noRecord')}</p>
        </div>
      )}

      <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#E2D8D0]">
        <div className="flex items-center gap-1.5 text-xs text-[#2E8B57]">
          <ShieldCheck className="h-4 w-4" />
          <span>{tPrivacy('localDexieVault')}</span>
        </div>
        <Button variant="primary" size="sm" onClick={() => onLogPeriodForDate(selectedDateIso)}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t('logPeriodForDate')}
        </Button>
      </div>
    </Surface>
  );
};
