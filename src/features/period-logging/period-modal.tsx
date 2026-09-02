'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import type { CycleDomainModel, FlowLevel } from '@/types/health';
import { AlertCircle } from 'lucide-react';

export interface PeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cycleToEdit?: CycleDomainModel | null;
}

export const PeriodModal: React.FC<PeriodModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cycleToEdit,
}) => {
  const t = useTranslations('period');
  const tCommon = useTranslations('common');

  const todayIso = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');
  const [flow, setFlow] = React.useState<FlowLevel | ''>('');
  const [notes, setNotes] = React.useState<string>('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (cycleToEdit) {
      setStartDate(cycleToEdit.startDate || '');
      setEndDate(cycleToEdit.endDate || '');
      setFlow(cycleToEdit.flow || '');
      setNotes(cycleToEdit.notes || '');
    } else {
      setStartDate(todayIso);
      setEndDate('');
      setFlow('');
      setNotes('');
    }
    setErrorMsg(null);
  }, [cycleToEdit, isOpen, todayIso]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Client Validation
    if (!startDate) {
      setErrorMsg(t('validation.startDateRequired'));
      return;
    }

    if (startDate > todayIso) {
      setErrorMsg(t('validation.futureDateDisallowed'));
      return;
    }

    if (endDate && endDate < startDate) {
      setErrorMsg(t('validation.endDateBeforeStart'));
      return;
    }

    setIsSubmitting(true);

    try {
      if (cycleToEdit && cycleToEdit.id) {
        await CycleRepository.updateCycle(cycleToEdit.id, {
          startDate,
          endDate: endDate || undefined,
          flow: (flow as FlowLevel) || undefined,
          notes: notes || undefined,
        });
      } else {
        await CycleRepository.createCycle({
          startDate,
          endDate: endDate || undefined,
          flow: (flow as FlowLevel) || undefined,
          notes: notes || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const flowOptions: { value: FlowLevel; labelKey: string }[] = [
    { value: 'spotting', labelKey: 'flowSpotting' },
    { value: 'light', labelKey: 'flowLight' },
    { value: 'medium', labelKey: 'flowMedium' },
    { value: 'heavy', labelKey: 'flowHeavy' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cycleToEdit ? t('editPeriod') : t('logPeriod')}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-[#C94A46]/10 border border-[#C94A46]/30 flex items-center gap-2 text-sm text-[#C94A46]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <Input
          type="date"
          label={t('startDate')}
          value={startDate}
          max={todayIso}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />

        <Input
          type="date"
          label={t('endDate')}
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#1E1E24]">{t('flow')}</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {flowOptions.map((opt) => {
              const isSelected = flow === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setFlow(isSelected ? '' : opt.value)}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#2D1B2D] bg-[#2D1B2D] text-[#FDFBF7]'
                      : 'border-[#E2D8D0] bg-[#FFFFFF] text-[#1E1E24] hover:bg-[#F9EBEA]'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="period-notes" className="text-sm font-medium text-[#1E1E24]">
            {t('notes')}
          </label>
          <textarea
            id="period-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] p-3 text-base text-[#1E1E24] placeholder:text-[#5A5A66] focus-visible:border-[#E8837D]"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? t('saving') : tCommon('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
