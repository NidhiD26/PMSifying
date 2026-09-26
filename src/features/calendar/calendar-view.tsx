'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '@/lib/db/repositories/daily-log-repository';
import type { CycleDomainModel } from '@/types/health';
import { CalendarHeader } from './calendar-header';
import { CalendarGrid } from './calendar-grid';
import { SelectedDayDetails } from './selected-day-details';
import { PeriodModal } from '@/features/period-logging/period-modal';
import { Surface } from '@/components/ui/surface';
import { ErrorState, LoadingState } from '@/components/ui/state';
import { ShieldCheck } from 'lucide-react';
import { formatLocalDateIso } from '@/lib/utils/date-utils';

export const CalendarView: React.FC = () => {
  const t = useTranslations('calendar');

  // Local calendar dates throughout: toISOString() would shift the day for
  // anyone east or west of UTC.
  const todayIso = React.useMemo(() => formatLocalDateIso(new Date()), []);

  const [currentDate, setCurrentDate] = React.useState<Date>(() => new Date());
  const [selectedDateIso, setSelectedDateIso] = React.useState<string>(todayIso);
  const [cycles, setCycles] = React.useState<CycleDomainModel[]>([]);
  const [hasDailyLogForSelected, setHasDailyLogForSelected] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalCycleToEdit, setModalCycleToEdit] = React.useState<CycleDomainModel | null>(null);

  const loadCycles = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const records = await CycleRepository.getAllCyclesChronological();
      setCycles(records);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  // Whether a daily health log exists for the selected date
  React.useEffect(() => {
    if (!selectedDateIso) {
      setHasDailyLogForSelected(false);
      return;
    }
    let cancelled = false;
    DailyLogRepository.getDailyLogByDate(selectedDateIso)
      .then((log) => {
        if (!cancelled) setHasDailyLogForSelected(!!log);
      })
      .catch(() => {
        if (!cancelled) setHasDailyLogForSelected(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDateIso]);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDateIso(todayIso);
  };

  const handleSelectDate = (dateIso: string) => {
    setSelectedDateIso(dateIso);
  };

  const handleLogPeriodForDate = (dateIso: string) => {
    const existing = cycles.find((c) => c.startDate === dateIso);
    setModalCycleToEdit(
      existing ?? {
        startDate: dateIso,
        createdAt: '',
        updatedAt: '',
      }
    );
    setIsModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#2D1B2D] sm:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-[#5A5A66]">{t('subtitle')}</p>
      </header>

      {errorMsg && <ErrorState message={errorMsg} onRetry={loadCycles} />}

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          <Surface variant="bordered" className="space-y-5 p-4 sm:p-6">
            <CalendarHeader
              currentDate={currentDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onToday={handleToday}
            />

            <CalendarGrid
              currentDate={currentDate}
              selectedDate={selectedDateIso}
              cycles={cycles}
              onSelectDate={handleSelectDate}
            />
          </Surface>

          <SelectedDayDetails
            selectedDateIso={selectedDateIso}
            cycles={cycles}
            onLogPeriodForDate={handleLogPeriodForDate}
            hasDailyLog={hasDailyLogForSelected}
          />
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-[#5A5A66]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#2E8B57]" aria-hidden="true" />
        <span className="leading-relaxed">{t('offlineGuarantee')}</span>
      </div>

      <PeriodModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadCycles}
        cycleToEdit={modalCycleToEdit}
      />
    </div>
  );
};
