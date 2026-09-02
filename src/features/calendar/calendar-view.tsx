'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import type { CycleDomainModel } from '@/types/health';
import { CalendarHeader } from './calendar-header';
import { CalendarGrid } from './calendar-grid';
import { SelectedDayDetails } from './selected-day-details';
import { PeriodModal } from '@/features/period-logging/period-modal';
import { Surface } from '@/components/ui/surface';
import { AlertCircle, ShieldCheck } from 'lucide-react';

export const CalendarView: React.FC = () => {
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');

  const todayIso = React.useMemo(() => new Date().toISOString().split('T')[0], []);

  const [currentDate, setCurrentDate] = React.useState<Date>(() => new Date());
  const [selectedDateIso, setSelectedDateIso] = React.useState<string>(todayIso);
  const [cycles, setCycles] = React.useState<CycleDomainModel[]>([]);
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

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateIso(now.toISOString().split('T')[0]);
  };

  const handleLogPeriodForDate = (dateIso: string) => {
    // Check if date already matches an existing cycle start date
    const existing = cycles.find((c) => c.startDate === dateIso);
    if (existing) {
      setModalCycleToEdit(existing);
    } else {
      setModalCycleToEdit({
        startDate: dateIso,
        createdAt: '',
        updatedAt: '',
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#2D1B2D]">{t('title')}</h1>
        <p className="text-sm text-[#5A5A66] mt-1">{t('subtitle')}</p>
      </div>

      {/* Error State */}
      {errorMsg && (
        <Surface variant="bordered" className="p-4 border-[#C94A46]/30 bg-[#C94A46]/10 flex items-center gap-3 text-sm text-[#C94A46]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{errorMsg}</p>
        </Surface>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-[#5A5A66]">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2D1B2D] border-t-transparent mx-auto mb-3" />
          <span>{tCommon('loading')}</span>
        </div>
      ) : (
        <div className="space-y-8">
          <Surface variant="bordered" className="p-6 space-y-6">
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
              onSelectDate={setSelectedDateIso}
            />
          </Surface>

          {/* Contextual Selected Date Details */}
          <SelectedDayDetails
            selectedDateIso={selectedDateIso}
            cycles={cycles}
            onLogPeriodForDate={handleLogPeriodForDate}
          />
        </div>
      )}

      {/* Local Offline Guarantee Footer */}
      <div className="p-3.5 rounded-xl bg-[#F9EBEA]/60 border border-[#E2D8D0] flex items-center justify-between gap-3 text-xs text-[#5A5A66]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#2E8B57] shrink-0" />
          <span>100% Offline Personal Health Calendar — Recorded facts only (No prediction AI)</span>
        </div>
      </div>

      {/* Period Modal */}
      <PeriodModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadCycles}
        cycleToEdit={modalCycleToEdit}
      />
    </div>
  );
};
