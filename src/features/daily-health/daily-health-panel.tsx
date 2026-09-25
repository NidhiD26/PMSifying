'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DailyLogRepository } from '@/lib/db/repositories/daily-log-repository';
import type { DailyLogDomainModel } from '@/types/health';
import { todayIso, isValidIsoDate } from '@/lib/health/date-utils';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { DailyHealthForm } from './daily-health-form';
import { ShieldCheck, Plus, AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';

export interface DailyHealthPanelProps {
  initialDate?: string;
}

export const DailyHealthPanel: React.FC<DailyHealthPanelProps> = ({ initialDate }) => {
  const t = useTranslations('dailyHealth');
  const tCommon = useTranslations('common');

  const validInitial = initialDate && isValidIsoDate(initialDate) ? initialDate : todayIso();

  const [selectedDate, setSelectedDate] = React.useState<string>(validInitial);
  const [existingLog, setExistingLog] = React.useState<DailyLogDomainModel | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const loadLog = React.useCallback(
    async (date: string) => {
      setIsLoading(true);
      setLoadError(null);
      setSuccessMsg(null);
      setIsCreating(false);
      try {
        const log = await DailyLogRepository.getDailyLogByDate(date);
        setExistingLog(log ?? null);
      } catch {
        setLoadError(t('loadFailed'));
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  React.useEffect(() => {
    loadLog(selectedDate);
  }, [selectedDate, loadLog]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSaveError(null);
  };

  const handleStartCreate = () => {
    setIsCreating(true);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setSaveError(null);
  };

  const handleSave = async (values: {
    date: string;
    symptoms: { id: string }[];
    mood: { id: string }[];
    painLevel: number;
    sleepHours: string;
    hydrationMl: string;
    notes: string;
  }) => {
    setSaveError(null);
    setSuccessMsg(null);

    const sleepNumber = values.sleepHours === '' ? 0 : Number(values.sleepHours);
    const hydrationNumber = values.hydrationMl === '' ? 0 : Number(values.hydrationMl);

    if (Number.isNaN(sleepNumber) || sleepNumber < 0 || sleepNumber > 24) {
      setSaveError(t('validation.invalidSleep'));
      return;
    }
    if (Number.isNaN(hydrationNumber) || hydrationNumber < 0 || hydrationNumber > 10000) {
      setSaveError(t('validation.invalidHydration'));
      return;
    }
    if (!isValidIsoDate(values.date)) {
      setSaveError(t('validation.invalidDate'));
      return;
    }
    if (values.date > todayIso()) {
      setSaveError(t('validation.futureDateDisallowed'));
      return;
    }

    setIsSaving(true);
    try {
      const sleepHours = sleepNumber;
      const hydrationMl = hydrationNumber;

      await DailyLogRepository.upsertDailyLog({
        date: values.date,
        symptoms: values.symptoms,
        mood: values.mood,
        painLevel: values.painLevel,
        sleepHours,
        hydrationMl,
        notes: values.notes || undefined,
      });

      setSuccessMsg(t('saveSuccess'));
      await loadLog(values.date);
    } catch {
      setSaveError(t('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await DailyLogRepository.deleteDailyLogByDate(selectedDate);
      setExistingLog(null);
      setIsCreating(false);
      setSuccessMsg(t('deleteSuccess'));
      setIsDeleteConfirmOpen(false);
    } catch {
      setSaveError(t('saveFailed'));
      setIsDeleteConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#2D1B2D]">{t('title')}</h2>
          <p className="text-sm text-[#5A5A66] mt-0.5">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="daily-health-date" className="text-sm font-medium text-[#1E1E24]">
            {t('dateLabel')}
          </label>
          <input
            id="daily-health-date"
            type="date"
            value={selectedDate}
            max={todayIso()}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1E1E24] focus-visible:border-[#E8837D] focus-visible:outline-none"
          />
        </div>
      </div>

      {/* Local banner */}
      <div className="p-3.5 rounded-xl bg-[#F9EBEA]/60 border border-[#E2D8D0] flex items-center gap-2 text-xs text-[#5A5A66]">
        <ShieldCheck className="h-4 w-4 text-[#2E8B57] shrink-0" />
        <span>{tCommon('offlineMode')} — {selectedDate}</span>
      </div>

      {successMsg && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#2E8B57]/10 border border-[#2E8B57]/30 flex items-center gap-2 text-sm text-[#2E8B57]"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-[#5A5A66]">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2D1B2D] border-t-transparent mx-auto mb-3" />
          <span>{tCommon('loading')}</span>
        </div>
      ) : loadError ? (
        <Surface variant="bordered" className="p-6 text-center">
          <p className="text-sm text-[#C94A46] mb-4">{loadError}</p>
          <Button variant="primary" size="sm" onClick={() => loadLog(selectedDate)}>
            {tCommon('retry')}
          </Button>
        </Surface>
      ) : existingLog || isCreating ? (
        <Surface variant="bordered" className="p-5 sm:p-6">
          {existingLog && (
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#2E8B57]/10 px-3 py-1 text-xs font-semibold text-[#2E8B57]">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {t('editingLabel')}
              </span>
            </div>
          )}
          <DailyHealthForm
            key={`${selectedDate}-${existingLog ? 'edit' : 'new'}`}
            initialDate={selectedDate}
            initialValues={
              existingLog
                ? {
                    symptoms: existingLog.symptoms,
                    mood: existingLog.mood,
                    painLevel: existingLog.painLevel,
                    sleepHours: String(existingLog.sleepHours),
                    hydrationMl: String(existingLog.hydrationMl),
                    notes: existingLog.notes ?? '',
                  }
                : undefined
            }
            isEditing={!!existingLog}
            isSaving={isSaving}
            isDeleting={isDeleting}
            errorMsg={saveError}
            onSave={handleSave}
            onDelete={existingLog ? () => setIsDeleteConfirmOpen(true) : undefined}
            onCancel={existingLog ? undefined : handleCancelCreate}
          />
        </Surface>
      ) : (
        <Surface variant="bordered" className="p-8 sm:p-10 text-center">
          <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-[#F9EBEA] flex items-center justify-center">
            <ClipboardList className="h-7 w-7 text-[#2D1B2D]" />
          </div>
          <h3 className="text-lg font-semibold text-[#1E1E24]">{t('noLogTitle')}</h3>
          <p className="text-sm text-[#5A5A66] mt-1 mb-6 max-w-md mx-auto">
            {t('noLogDescription')}
          </p>
          <Button variant="primary" onClick={handleStartCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t('startLogging')}
          </Button>
        </Surface>
      )}

      {/* Delete confirmation */}
      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title={t('deleteTitle')}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-[#C94A46]/10 border border-[#C94A46]/30 flex items-start gap-3 text-sm text-[#C94A46]">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{t('deleteMessage')}</p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? tCommon('loading') : t('deleteConfirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
